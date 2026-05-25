# Migration Module Implementation Plan (apps/migration)

This plan defines a Python-based, idempotent, incremental migration module that imports legacy data from the `dump-1776931288` PostgreSQL dump into our current PostgreSQL schema (via SQLModel) and synchronizes with Snipe-IT (via `requests`), with an end-to-end `--dry-run` mode.

## Goals / Non-goals

- **Goals**
  - Upsert users, projects, project members, equipment models, and equipment/assets.
  - Preserve idempotency by storing legacy identifiers in **`legacy_id` columns** (you selected this option).
  - Support **incremental re-runs** without duplicates (safe to run multiple times).
  - Include `--dry-run` that logs intended operations without writing to Postgres or Snipe-IT.

- **Non-goals (initial cut)**
  - Full fidelity migration of wiki history/revisions.
  - Reconstructing legacy requisition event streams (we can add a second phase later).

## Current Repo Findings (relevant constraints)

- `apps/migration` is fully implemented and contains the python-based migration module.
- Backend models live in `apps/api/db/models.py` (SQLModel).
- Snipe-IT access exists in `apps/api/services/snipeit/*` and already uses `requests`.
- No Alembic migration tooling is present in the repo; schema changes need to be applied either:
  - via manual SQL, or
  - via a migration script that executes `ALTER TABLE` statements.

### Critical Schema Constraints (must respect)

- **`users.role`**: CHECK constraint allows only `('student', 'professor', 'lab_technician')` — NOT 'admin' or 'user'.
- **`projects.status`**: CHECK constraint allows `('pending', 'active', 'rejected', 'completed', 'archived')` — model default is "draft" which violates this.
- **`project_members.role`**: CHECK constraint allows `('leader', 'member', 'observer', 'advisor', 'supervisor')`.
- **Missing model**: `EquipmentRequestItem` SQLModel class is not defined but `EquipmentUsage` references it via FK.

## Target Schema Changes (required for `legacy_id` tracking)

Add nullable `legacy_id` columns and unique indexes to support upsert-by-legacy-id.

- **`users`**
  - `legacy_id BIGINT NULL UNIQUE`
- **`projects`**
  - `legacy_id BIGINT NULL UNIQUE`
- **`equipment_models`**
  - `legacy_id BIGINT NULL UNIQUE`
  - `legacy_reference_code TEXT NULL` — stores exact original wiki Código (may differ from normalized `reference_code`).
- **`equipment`**
  - `legacy_id BIGINT NULL UNIQUE` (legacy equipment article_id)

For M:N tables, keep natural uniqueness:
- **`project_members`**
  - ensure a uniqueness constraint on `(project_id, user_id)` (if not already)
  - no `legacy_id` needed; membership is derived from legacy project XML.

Implementation detail: include a bootstrap step in the migration tool that runs `ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...` and creates indexes if missing.

## Proposed File Structure (apps/migration)

```
apps/migration/
  README.md
  pyproject.toml                  # optional; otherwise rely on apps/api venv
  makerlab_migrate/
    __init__.py
    cli.py                        # entrypoint: argparse, --dry-run, --limit, --since, --entity
    settings.py                   # env loading: DB url, snipe-it url/token, dump path
    logging.py                    # structured logging helpers

    dump/
      __init__.py
      dump_reader.py              # reads dump-1776931288; extracts COPY blocks
      wiki_extractors.py          # parses wiki_articlerevision.content (XML wrapper with markdown-like content) into typed dicts
      models.py                   # Pydantic dataclasses: LegacyUser, LegacyProfile, LegacyProject, LegacyEquipment

    postgres/
      __init__.py
      engine.py                   # SQLModel engine/session factory for direct CLI use
      schema_bootstrap.py         # ensure legacy_id columns + indexes exist
      repos.py                    # upsert functions for User/Project/EquipmentModel/Equipment/ProjectMember

    snipeit/
      __init__.py
      client.py                   # small wrapper around requests (or import apps/api/services/snipeit/client.py)
      upsert.py                   # upsert logic: user by email, model by name/model_number, asset by asset_tag

    orchestration/
      __init__.py
      migrator.py                 # coordinates per-entity migration and batching
      state.py                    # incremental state (optional): local checkpoint file OR DB table

  scripts/
    run_migration.sh              # optional convenience wrapper
```

Notes:
- To minimize duplicated code, the migration module can either:
  - import `apps/api/services/snipeit/*` directly, or
  - implement its own minimal `requests` wrappers. The plan assumes a **minimal local wrapper** to keep the module self-contained, but reusing existing code is fine.

## Incremental / Idempotent Strategy

Idempotency will be enforced at two layers:

- **Postgres layer**
  - Upsert by `legacy_id` if present.
  - For `users`, also de-duplicate by `email` (because emails are strong natural keys and already unique).

- **Snipe-IT layer**
  - Users: lookup by `email` (`/api/v1/users?search=`) before creating.
  - Assets: lookup by `asset_tag` (or by searching hardware list) before creating.
  - Models: lookup by model name / model_number before creating.

Incremental runs:
- The default behavior is “scan all legacy entities and upsert”. This is safe but can be slow.
- Optional optimization (recommended): store a checkpoint cursor per entity type.
  - **Option 1**: DB table `migration_state(entity_type primary key, last_legacy_id, updated_at)`.
  - **Option 2**: local JSON file under `apps/migration/.state/`.

Even without checkpoints, uniqueness constraints + upsert guarantees correctness.

## CLI Contract (apps/migration/makerlab_migrate/cli.py)

- `--dump-path /path/to/dump-1776931288` (required)
- `--dry-run` (default false)
- `--entity users|projects|equipment|all` (default `all`)
- `--limit N` (optional, for testing small batches)
- `--since-legacy-id X` (optional quick incremental - manually specify start ID)
- `--incremental` (default false, enable automatic checkpoint tracking via migration_state table)
- `--batch-size N` (default 100, for Snipe-IT rate limiting)
- `--skip-snipeit` (default false, for testing Postgres-only migration)
- `--validate-only` (default false, parse dump and validate without any DB operations)

Exit codes:
- `0` success
- `1` configuration error (missing env vars, invalid paths)
- `2` database connection error
- `3` Snipe-IT API error
- `4` dump parsing error
- `5` validation error (schema constraints would be violated)

## Step-by-step Logic Flow (Pseudocode)

### 0) Process startup

```python
args = parse_args()
logger = setup_logging(verbose=args.verbose)

settings = load_settings(
  dump_path=args.dump_path,
  postgres_uri=env_or_settings(),
  snipeit_url=env_or_settings(),
  snipeit_token=env_or_settings(),
)

# Schema bootstrap runs in separate connection (DDL auto-commits)
ensure_schema_bootstrap(settings.postgres_uri)  # add legacy_id columns + indexes if missing

pg = PostgresUnitOfWork(settings.postgres_uri, dry_run=args.dry_run)
snipe = SnipeITGateway(settings.snipeit_url, settings.snipeit_token, dry_run=args.dry_run)

# Load all data first (pure memory operation, no DB needed yet)
reader = DumpReader(settings.dump_path)
legacy_data = load_and_normalize_all(reader, limit=args.limit, since=args.since_legacy_id)

### 1) Data already loaded

```python
# Data was loaded in Step 0: legacy_data contains:
# - legacy_auth_users (from auth_user table)
# - legacy_projects (latest revisions with type="project")
# - legacy_equipment (latest revisions with type="equipment")
# All normalized and ready for migration loops.
```

#### Wiki Content Parsing Specification

Equipment content uses markdown-like syntax (not XML). Extractor must parse:
```regex
\* \*\* Família: \*\* (.*?)
\* \*\* Sub-Família: \*\* (.*?)
\* \*\* Código: \*\* (.*?)
\* \*\* Preço \(c/ IVA\): \*\* ([\d.,]+)
\* \*\* Fornecedor: \*\* (.*?)
\* \*\* Localização: \*\* (.*?)
```

Handle variations:
- Different spacing around `**`
- Missing fields (empty string after colon)
- Price formats: "8.61€", "12.18€", "0.0€" → parse as Decimal
- Dates in format: "2017/03/23"

#### Normalization Rules

- user.name = f"{first_name} {last_name}".strip()
- **user.role mapping (CRITICAL - schema constraint)**:
  - `is_superuser=True` or `is_staff=True` → `"lab_technician"`
  - Regular users → `"student"` (professor detection via email domain: `@ua.pt` with faculty prefix, or manual mapping)
  - **nmec/course**: NOT in auth_user table — leave null or parse from username if it contains nmec (e.g., "12345" in "12345@student.ua.pt")
- **project.status**: Always use `"pending"` (not "draft" which violates CHECK constraint)
- project.description pulled from `<content>` node (strip markdown, keep plain text first 500 chars)
- **project membership role mapping**:
  - XML `<owner>` → `"leader"`
  - XML `<member>` → `"member"`
  - XML `<mentor>` → `"advisor"`
- equipment fields extracted from wiki content (see regex above)

### 2) Migration loop: Users

```python
for legacy_user in iter_users(legacy_auth_users, limit=args.limit, since=args.since_legacy_id):
    # 2.1 Upsert Postgres user
    existing = session.exec(select(User).where(User.legacy_id == legacy_user.id)).first()
    if not existing:
        # fallback dedupe by email
        existing = session.exec(select(User).where(User.email == legacy_user.email)).first()

    if existing:
        planned_action = "UPDATE"
        apply_user_updates(existing, legacy_user)
        existing.legacy_id = existing.legacy_id or legacy_user.id
    else:
        planned_action = "INSERT"
        new_user = User(
            legacy_id=legacy_user.id,
            name=legacy_user.name,
            email=legacy_user.email,
            role=legacy_user.role,
            nmec=legacy_user.nmec,
            course=legacy_user.course,
        )
        session.add(new_user)

    logger.info({"entity": "user", "legacy_id": legacy_user.id, "action": planned_action})

    # 2.2 Upsert Snipe-IT user (optional phase toggle)
    # - Only if email exists
    if legacy_user.email:
        s_user = snipe.find_user_by_email(legacy_user.email)
        if not s_user:
            snipe.create_user(payload_from_legacy_user(legacy_user))

# COMMIT HERE - users are self-contained, projects need them but we resolve by legacy_id lookup
# This breaks the giant transaction into manageable chunks
if dry_run:
    session.rollback()
else:
    session.commit()
    logger.info(f"Phase 1 (Users) complete: {users_processed} users")
```

### 3) Migration loop: Projects + Members

```python
# For dry-run with FK integrity, use nested transactions (savepoints)
# or commit users first even in dry-run, rolling back only at final end

for legacy_project in iter_projects(legacy_projects, limit=args.limit, since=args.since_legacy_id):
    # Resolve created_by user from project owner (XML <owner> element)
    # Every project MUST have an owner; skip if owner user wasn't migrated
    owner_user = session.exec(
        select(User).where(User.legacy_id == legacy_project.owner_legacy_user_id)
    ).first()
    
    if not owner_user:
        logger.error(f"Skipping project {legacy_project.id}: owner user {legacy_project.owner_legacy_user_id} not found")
        continue
    
    # Ensure status respects CHECK constraint (pending, active, rejected, completed, archived)
    project = upsert_project_by_legacy_id(
        session, 
        legacy_project, 
        default_status="pending",
        created_by_user_id=owner_user.id  # FK to users table
    )

    # Membership reconciliation (includes owner + members + mentors)
    desired_members = legacy_project.members  # list of {legacy_user_id, role}

    for m in desired_members:
        user = session.exec(select(User).where(User.legacy_id == m.legacy_user_id)).first()
        if not user:
            logger.warning("Skipping member; user not migrated yet", extra={...})
            continue

        # Role mapping: owner→leader, member→member, mentor→advisor
        upsert_project_member(session, project_id=project.id, user_id=user.id, role=m.role)

# COMMIT HERE - projects committed, now they exist for equipment to reference (if needed in future)
if dry_run:
    session.rollback()
else:
    session.commit()
    logger.info(f"Phase 2 (Projects) complete: {projects_processed} projects, {members_processed} members")
```

### 4) Migration loop: Equipment Models + Assets (Postgres + Snipe-IT)

```python
# Dynamic Creation: Snipe-IT category and manufacturer are dynamically 
# resolved or created on the fly if they do not exist.
# Mappings: family → category, supplier → manufacturer

# PHASE 1: Deduplicate equipment by Código to create unique EquipmentModels
# Multiple wiki revisions share the same Código (e.g., different color filaments with same SKU)
# CRITICAL: Skip equipment with empty/blank Código — cannot create model without identifier
model_signatures = group_equipment_by_codigo([e for e in legacy_equipment if e.codigo and e.codigo.strip()])

# Log skipped items for manual review
skipped_empty_codigo = [e for e in legacy_equipment if not e.codigo or not e.codigo.strip()]
if skipped_empty_codigo:
    logger.warning(f"Skipping {len(skipped_empty_codigo)} equipment items with empty Código")

for codigo, equipment_group in model_signatures.items():
    # Use first equipment in group as model template
    template = equipment_group[0]
    
    # 4.1 Upsert EquipmentModel (Postgres)
    # Código → reference_code AND legacy_reference_code (exact original)
    model = upsert_equipment_model(
        session, 
        name=template.name,
        family=template.family,
        sub_family=template.sub_family,
        reference_code=normalize_codigo(codigo),  # cleaned version
        legacy_reference_code=codigo,  # exact original
        supplier=template.supplier,
        price=template.price,
        legacy_id=template.article_id  # or generate model-level legacy_id
    )

    # 4.2 Upsert Snipe-IT Model
    # lookup by model_number (which stores the Código/SKU)
    s_model = snipe.find_model(model_number=codigo)
    if not s_model:
        # Dynamically lookup or create category and manufacturer in Snipe-IT
        category_id = snipe.find_or_create_category(template.family)
        manufacturer_id = snipe.find_or_create_manufacturer(template.supplier)
        
        s_model = snipe.create_model(payload_from_equipment_model(
            model, 
            category_id=category_id,
            manufacturer_id=manufacturer_id
        ))

    # store snipeit_model_id back to postgres model
    if s_model and not args.dry_run:
        model.snipeit_model_id = s_model.id

    # 4.3 Create individual Assets for each equipment revision
    # Each revision becomes one physical asset in Snipe-IT
    for idx, legacy_eq in enumerate(equipment_group):
        # Generate unique asset_tag: use article_id or sequential (CODIGO-001, CODIGO-002)
        asset_tag = f"{codigo}-{idx+1}" if len(equipment_group) > 1 else codigo
        
        # Check for quantity field in XML
        # Interpretation: quantity=0 or missing means "quantity not tracked" → create 1 asset
        # quantity > 1 means "N physical units exist" → create N assets with sequential tags
        quantity = legacy_eq.quantity if legacy_eq.quantity and legacy_eq.quantity > 0 else 1
        
        for q in range(quantity):
            unique_asset_tag = f"{asset_tag}-{q+1}" if quantity > 1 else asset_tag
            
            s_asset = snipe.find_asset_by_asset_tag(unique_asset_tag)
            if not s_asset:
                s_asset = snipe.create_asset(payload_from_legacy_asset(
                    legacy_eq, 
                    s_model_id=s_model.id,
                    asset_tag=unique_asset_tag
                ))

            # 4.4 Upsert Equipment (Postgres) linking to Snipe-IT asset id
            # Note: derive_status() is intentionally undefined (see Open Decisions)
            # Default implementation: return "available"
            equipment = upsert_equipment(session,
                legacy_id=legacy_eq.article_id,
                model_id=model.id,
                snipeit_asset_id=(s_asset.id if s_asset else None),
                location=legacy_eq.location,
                status=derive_status(legacy_eq),  # Implement as: return "available"
            )

# SINGLE FINAL COMMIT/ROLLBACK for Phase 3 (Equipment)
if dry_run:
    session.rollback()
    logger.info("DRY-RUN complete: all changes rolled back")
else:
    session.commit()
    if args.incremental:
        state.save_checkpoint('equipment', last_processed_legacy_id)
    logger.info(f"Phase 3 (Equipment) complete: {models_processed} models, {assets_processed} assets")
```

### 5) Dry-run semantics (hard requirement)

- **Postgres**
  - Schema bootstrap (DDL) runs in a **separate connection** before main transaction — DDL auto-commits anyway.
  - **Three separate transactions** (one per phase) to avoid long-running transactions during Snipe-IT API calls:
    1. Users phase → commit
    2. Projects phase → commit (queries users by legacy_id for FKs)
    3. Equipment phase → commit (self-contained, no FKs to other entities)
  - This prevents holding DB locks during slow external API calls.
  - If any phase fails, earlier phases remain committed (idempotent - re-running is safe).
  - **Batch size default**: 100 entities per batch to balance memory and performance.

- **Snipe-IT**
  - `SnipeITGateway` must short-circuit all mutating calls (`POST`, `PATCH`, checkout/checkin endpoints).
  - In dry-run, it should:
    - log the endpoint + payload
    - optionally still perform GETs for "what would happen" planning (configurable)
    - return mock IDs for created resources so downstream code can proceed (e.g., `{"id": -1}`)
  - **Rate limiting**: Add 100ms delay between Snipe-IT write operations (even in dry-run for realistic timing)

### 6) Observability / Reporting

- Log per entity:
  - `entity_type`, `legacy_id`, `target_id` (if known), `action` (INSERT/UPDATE/SKIP), `reason`.
- Summaries at end:
  - counts of inserted/updated/skipped/errors.

## Snipe-IT Configuration Requirements

Add to `settings.py` or environment:

```python
# Rate limiting (milliseconds between API calls)
SNIPEIT_API_DELAY_MS: int = 100
```

**Dynamic Entity Creation**: 
The migration module automatically queries the Snipe-IT API for Categories and Manufacturers based on the legacy database's `family` and `supplier` fields. If they are not found, the module creates them on the fly. You **do not** need to pre-create or manually map Categories or Manufacturers.

**Pre-flight Checklist**:
- [ ] API token has permission to read and create categories, manufacturers, models, assets, and users
- [ ] Snipe-IT instance is reachable and not in maintenance mode

## Open Decisions (captured for implementation)

- Whether to migrate equipment requisition history into our `equipment_request` tables is deferred; initial phase focuses on users/projects/assets.
- Add `EquipmentRequestItem` SQLModel class to `apps/api/db/models.py` or remove FK reference from `EquipmentUsage`.
- Equipment status derivation: Currently undefined. Options:
  - All imported equipment → `"available"` (simplest)
  - Parse from wiki `<active_requisitions>` field if present
  - Default to available, manually review after migration

## Testing Strategy (Recommended Implementation Order)

1. **Phase 0: Validation** — Run `--validate-only` to parse entire dump and report issues without any DB operations.
2. **Phase 1: Postgres-only** — Run `--skip-snipeit --limit 10` to test user/project migration logic.
3. **Phase 2: Dry-run full** — Run `--dry-run` to test Snipe-IT integration without actual writes.
4. **Phase 3: Incremental users** — Run `--entity users` to migrate just users, verify in both DBs.
5. **Phase 4: Full migration** — Run without flags to complete migration.

**Entity Dependencies** (critical for incremental runs):
- `--entity users` can run standalone (no dependencies)
- `--entity projects` requires users to exist first (FK: created_by → users.id, project_members → users.id)
- `--entity equipment` requires no other entities (self-contained with Snipe-IT)
- Recommended order: users → projects → equipment (if running separately)

**Rollback Plan**:
- If migration fails: fix issue, re-run (idempotent - will resume/upsert).
- If data corruption suspected: restore Postgres from backup; Snipe-IT can be wiped and re-migrated.
- `legacy_id` columns enable identifying and selectively deleting migrated data if needed.

## Acceptance Criteria

- Running twice produces no duplicates in Postgres or Snipe-IT.
- `--dry-run` produces logs of intended operations and performs **zero writes**.
- You can run `--entity users` then later `--entity projects` incrementally.
- All schema CHECK constraints pass (no constraint violations).
- Empty Código equipment items are logged but don't crash migration.
- Snipe-IT API rate limits are respected (no 429 errors during normal operation).
