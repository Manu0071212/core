# Production Deployment Runbook

## Prerequisites
- Docker and Docker Compose installed on the server
- SSL certificates placed in `infra/nginx/certs/` (selfsigned.crt / selfsigned.key)

---

## 1. Clone the repository
```bash
git clone <repo-url> deti-maker-lab
cd deti-maker-lab
```

---

## 2. Configure environment variables

### 2a. API environment

Copy and fill in the API env file:
```bash
cp apps/api/.env.example apps/api/.env
```

The key URL variables to configure:

```env
# Must match infra/db/.env.postgres
POSTGRES_USER=makerlab
POSTGRES_PASSWORD=<same password as infra/db/.env.postgres>
POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_DB=makerlab

# Leave blank for now — bootstrap fills this in
SNIPEIT_API_TOKEN=
# fill in after Step 7
SNIPEIT_RESERVED_STATUS_ID=4

# ─── Public browser-facing URLs ─────────────────────────────────────────────
# The full public URL where the MakerLab frontend is accessible (no trailing slash).
FRONTEND_URL=https://deti-makerlab.ua.pt/new

# The full public URL where Snipe-IT is accessible (no trailing slash).
SNIPEIT_PUBLIC_URL=https://deti-makerlab.ua.pt/new/snipe-it

# SSO callback URL registered at identity.ua.pt — fixed, do NOT add a path prefix.
SSO_CALLBACK_URL=https://deti-makerlab.ua.pt/auth/auth

# ─── Internal Docker network URL ─────────────────────────────────────────────
# Used only for backend-to-Snipe-IT API calls. Never exposed to the browser.
SNIPEIT_BASE_URL=http://snipeit

# Generate with: python3 -c "import secrets; print(secrets.token_hex(32))"
JWT_SECRET_KEY=<random strong secret>
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
```

See `apps/api/.env.example` for a full list of variables with explanations.

### 2b. Snipe-IT environment

```bash
cp infra/snipeit/.env.snipeit.example infra/snipeit/.env.snipeit
nano infra/snipeit/.env.snipeit
```

Set these values. The DB passwords must match each other:
```dotenv
APP_KEY=base64:/APP_KEY
APP_URL=https://deti-makerlab.ua.pt/snipe-it   # or /new/snipe-it if using prefix

DB_PASSWORD=<snipeit db password>
MYSQL_ROOT_PASSWORD=<snipeit root password>
MYSQL_PASSWORD=<same as DB_PASSWORD>
```

### 2c. PostgreSQL

```bash
cp infra/db/.env.postgres.example infra/db/.env.postgres
nano infra/db/.env.postgres
```

```dotenv
POSTGRES_USER=makerlab_app
POSTGRES_PASSWORD=<strong password>
POSTGRES_DB=makerlab
```


### 2d. Deployment URLs in docker-compose.yml

Open `infra/docker/docker-compose.yml` and update the `x-deployment: &deployment` parameters block near the top. This is the single source of truth for all containers:

```yaml
x-deployment: &deployment
  MAKERLAB_DOMAIN: "deti-makerlab.ua.pt"
  NEXT_PUBLIC_BASE_PATH: "/new" # or ""
  FRONTEND_URL: "https://deti-makerlab.ua.pt/new" # or "https://deti-makerlab.ua.pt"
  NEXT_PUBLIC_API_URL: "/new/api" # or "/api"
  API_PUBLIC_URL: "https://deti-makerlab.ua.pt/new/api" # or "https://deti-makerlab.ua.pt/api"
  SNIPEIT_PATH: "/new/snipe-it" # or "/snipe-it"
  NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/new/snipe-it" # or "https://deti-makerlab.ua.pt/snipe-it"
  APP_URL: "https://deti-makerlab.ua.pt/new/snipe-it" # or "https://deti-makerlab.ua.pt/snipe-it"
  SNIPEIT_PUBLIC_URL: "https://deti-makerlab.ua.pt/new/snipe-it" # or "https://deti-makerlab.ua.pt/snipe-it"
```

> The `FRONTEND_URL` and `SNIPEIT_PUBLIC_URL` in `apps/api/.env` must match
> the values in this block.

---

## 3. URL Configuration Guide

To switch between `/new` prefix and root path deployment, you only need to change the values inside the `x-deployment: &deployment` block in `docker-compose.yml` and run the build command. Docker Compose will automatically override the values in `.env` files for the backend and Snipe-IT containers.

### Example: deployment under `/new` (current testing)

```yaml
x-deployment: &deployment
  MAKERLAB_DOMAIN: "deti-makerlab.ua.pt"
  NEXT_PUBLIC_BASE_PATH: "/new"
  FRONTEND_URL: "https://deti-makerlab.ua.pt/new"
  NEXT_PUBLIC_API_URL: "/new/api"
  API_PUBLIC_URL: "https://deti-makerlab.ua.pt/new/api"
  SNIPEIT_PATH: "/new/snipe-it"
  NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/new/snipe-it"
  APP_URL: "https://deti-makerlab.ua.pt/new/snipe-it"
  SNIPEIT_PUBLIC_URL: "https://deti-makerlab.ua.pt/new/snipe-it"
```

### Example: final deployment at root (no prefix)

```yaml
x-deployment: &deployment
  MAKERLAB_DOMAIN: "deti-makerlab.ua.pt"
  NEXT_PUBLIC_BASE_PATH: ""
  FRONTEND_URL: "https://deti-makerlab.ua.pt"
  NEXT_PUBLIC_API_URL: "/api"
  API_PUBLIC_URL: "https://deti-makerlab.ua.pt/api"
  SNIPEIT_PATH: "/snipe-it"
  NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/snipe-it"
  APP_URL: "https://deti-makerlab.ua.pt/snipe-it"
  SNIPEIT_PUBLIC_URL: "https://deti-makerlab.ua.pt/snipe-it"
```

> [!WARNING]
> When changing URL parameters, you **must rebuild** the containers because the Next.js frontend has variables baked in at build time:
> ```bash
> docker compose -f infra/docker/docker-compose.yml up -d --build
> ```

---

## 4. Start the stack
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

Check all containers are running:
```bash
docker compose -f infra/docker/docker-compose.yml ps
```

All should show `Up`. If any shows `Exit`:
```bash
docker compose -f infra/docker/docker-compose.yml logs <service> --tail=50
```

---

## 5. Bootstrap Snipe-IT and API integration

DETI Maker Lab includes an automated bootstrapping script to configure Snipe-IT (creating the first administrative user, setting up database keys, generating the API Personal Access Token) and automatically inject the generated API token into the backend API environment configuration (`.env`).

The script reads `FRONTEND_URL` from `apps/api/.env` to configure the Snipe-IT logout redirect URL automatically.

Run the bootstrap script from the repository root:
```bash
./infra/docker/bootstrap-snipeit.sh
```

This script will wait for Snipe-IT to fully initialize, create the admin credentials, generate the API token, save it to `apps/api/.env`, and restart the backend service automatically.

> [!WARNING]
> If the script fails to configure the Snipe-IT automatically, then see the `WARNING` section in [Automated Bootstrapping](../SNIPEIT.md#method-a-automated-bootstrapping-recommended).

---

## 6. Verify
- `https://deti-makerlab.ua.pt/new` — web app (or your configured FRONTEND_URL)
- `https://deti-makerlab.ua.pt/new/api/docs` — API docs
- `https://deti-makerlab.ua.pt/new/snipe-it` — Snipe-IT (or your configured SNIPEIT_PUBLIC_URL)

---

## 7. Configure Snipe-IT Status Labels

Before starting the stack, the Snipe-IT instance needs specific status labels configured.

Go to **Settings → Status Labels** in Snipe-IT and:

1. Edit the existing **"Ready to Deploy"** status:
   - Change the name to **"Available"**
   - Status type: **Deployable**

2. Create a new status **"Reserved"**:
   - Status type: **Deployable**
   - After saving, note the numeric ID (visible in the URL when editing: `.../statuslabels/X/edit`)
   - This ID goes into `SNIPEIT_RESERVED_STATUS_ID` in `apps/api/.env`

3. Create a new status **"Checked Out"**:
   - Status type: **Deployable**

After updating `SNIPEIT_RESERVED_STATUS_ID`:
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build api
```

---

## 8. Run the migration (optional but recommended)

If migrating data from the legacy Maker Lab Wiki, run the migration module after the stack is up:

```bash
cd apps/migration

cp .env.example .env

python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Dry run first to validate
python3 -m makerlab_migrate.cli \
  --dump-path /path/to/dump-1776931288 \
  --dry-run

# Full migration
python3 -m makerlab_migrate.cli \
  --dump-path /path/to/dump-1776931288
```

Full migration documentation: `docs/migration/migration-module-plan-2d9421.md`

## 9. First-time database
The database schema is applied automatically on first start via `infra/db/init/`.
If you need to reset: `docker compose -f infra/docker/docker-compose.yml down -v`

## 10. Managing Lab Technicians

The system restricts Snipe-IT access exclusively to users with the `lab_technician` role. This mapping is controlled dynamically at login using the `LAB_TECHNICIANS` environment variable:

- **Adding a Technician**: Add their university email address to the comma-separated list in `LAB_TECHNICIANS` inside `/apps/api/.env`, then rebuild/restart the `api` container:
  ```bash
  docker compose -f infra/docker/docker-compose.yml up -d --build api
  ```
- **Removing a Technician**: Remove their email from the list, then rebuild/restart the `api` container. Their role will automatically revert back to their default SSO role (e.g., student or professor) upon their next login.

For more details on role synchronization and access control setup, see [SNIPEIT.md](../SNIPEIT.md).
