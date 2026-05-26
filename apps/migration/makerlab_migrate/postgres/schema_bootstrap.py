# apps/migration/makerlab_migrate/postgres/schema_bootstrap.py

from sqlalchemy import text
from .engine import get_engine


SCHEMA_CHANGES = [
    # Add legacy_id to users
    """
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS legacy_id BIGINT NULL
    """,

    # Add unique constraint on users.legacy_id
    """
    ALTER TABLE users
    ADD CONSTRAINT uq_users_legacy_id UNIQUE (legacy_id)
    """,

    # Add index on users.legacy_id
    """
    CREATE INDEX IF NOT EXISTS idx_users_legacy_id
    ON users(legacy_id)
    WHERE legacy_id IS NOT NULL
    """,

    # Add legacy_id to projects
    """
    ALTER TABLE projects
    ADD COLUMN IF NOT EXISTS legacy_id BIGINT NULL
    """,

    # Add unique constraint on projects.legacy_id
    """
    ALTER TABLE projects
    ADD CONSTRAINT uq_projects_legacy_id UNIQUE (legacy_id)
    """,

    # Add index on projects.legacy_id
    """
    CREATE INDEX IF NOT EXISTS idx_projects_legacy_id
    ON projects(legacy_id)
    WHERE legacy_id IS NOT NULL
    """,

    # Add legacy_id to equipment_models
    """
    ALTER TABLE equipment_models
    ADD COLUMN IF NOT EXISTS legacy_id BIGINT NULL
    """,

    # Add unique constraint on equipment_models.legacy_id
    """
    ALTER TABLE equipment_models
    ADD CONSTRAINT uq_equipment_models_legacy_id UNIQUE (legacy_id)
    """,

    # Add legacy_reference_code to equipment_models
    """
    ALTER TABLE equipment_models
    ADD COLUMN IF NOT EXISTS legacy_reference_code TEXT NULL
    """,

    # Add index on equipment_models.legacy_id
    """
    CREATE INDEX IF NOT EXISTS idx_equipment_models_legacy_id
    ON equipment_models(legacy_id)
    WHERE legacy_id IS NOT NULL
    """,

    # Add legacy_id to equipment
    """
    ALTER TABLE equipment
    ADD COLUMN IF NOT EXISTS legacy_id BIGINT NULL
    """,

    # Add unique constraint on equipment.legacy_id
    """
    ALTER TABLE equipment
    ADD CONSTRAINT uq_equipment_legacy_id UNIQUE (legacy_id)
    """,

    # Add index on equipment.legacy_id
    """
    CREATE INDEX IF NOT EXISTS idx_equipment_legacy_id
    ON equipment(legacy_id)
    WHERE legacy_id IS NOT NULL
    """,
    
    # Ensure uniqueness on project_members (project_id, user_id)
    """
    CREATE UNIQUE INDEX IF NOT EXISTS idx_project_members_unique
    ON project_members(project_id, user_id)
    """,

    # Create migration_state table for incremental tracking
    """
    CREATE TABLE IF NOT EXISTS migration_state (
        entity_type VARCHAR(50) PRIMARY KEY,
        last_legacy_id BIGINT NOT NULL,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
    """,

    # Add missing columns to equipment_request
    """
    ALTER TABLE equipment_request
    ADD COLUMN IF NOT EXISTS snipeit_asset_id BIGINT NULL
    """,
    """
    ALTER TABLE equipment_request
    ADD COLUMN IF NOT EXISTS checked_out_at TIMESTAMP NULL
    """,
    """
    ALTER TABLE equipment_request
    ADD COLUMN IF NOT EXISTS returned_at TIMESTAMP NULL
    """,
    """
    ALTER TABLE equipment_request
    ADD COLUMN IF NOT EXISTS expected_checkin TIMESTAMP NULL
    """,
]


def ensure_schema_bootstrap(postgres_uri: str) -> None:
    """
    Ensure the database schema has the required legacy_id columns and indexes.
    Runs in a separate connection with autocommit for DDL operations.
    """
    engine = get_engine(postgres_uri)
    
    with engine.connect() as conn:
        # DDL operations require autocommit
        conn = conn.execution_options(isolation_level="AUTOCOMMIT")
        
        for sql in SCHEMA_CHANGES:
            try:
                conn.execute(text(sql))
            except Exception as e:
                # Some databases might not support IF NOT EXISTS for all operations
                # Log but continue (constraint may already exist)
                if "already exists" not in str(e).lower():
                    print(f"Warning: {e}")
        
        conn.close()
