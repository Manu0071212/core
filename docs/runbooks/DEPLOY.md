# Production Deployment Runbook

## Prerequisites
- Docker and Docker Compose installed on the server
- Domain `deti-makerlab.ua.pt` pointing to the server IP
- SSL certificates placed in `infra/nginx/certs/` (selfsigned.crt / selfsigned.key)
- Snipe-IT already running and accessible

## 1. Clone the repository
```bash
git clone <repo-url> deti-maker-lab
cd deti-maker-lab
```

## 2. Configure environment variables

Copy and fill in the API env file:
```bash
cp apps/api/.env.example apps/api/.env
```

Required values for production:

```env
APP_ENV=production
APP_DEBUG=false

DATABASE_URL=postgresql+psycopg://makerlab_app:password@postgres:5432/makerlab
POSTGRES_USER=makerlab
POSTGRES_PASSWORD=makerlab
POSTGRES_SERVER=postgres
POSTGRES_PORT=5432
POSTGRES_DB=makerlab

SNIPEIT_BASE_URL=http://snipeit
SNIPEIT_API_TOKEN=YOUR_SNIPEIT_API_TOKEN
SNIPEIT_RESERVED_STATUS_ID=<status ID for "Reserved" in your Snipe-IT instance>

SSO_CALLBACK_URL=https://deti-makerlab.ua.pt/auth/auth

# OAuth1 / Universidade
DML_AUTH_KEY=your_client_key_here
DML_AUTH_SECRET=your_client_secret_here

# JWT
JWT_SECRET_KEY=supersecretkey
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60

# Frontend
FRONTEND_URL=https://deti-makerlab.ua.pt/new
```

## 3. Start the stack
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
```

## 4. Verify
- `https://deti-makerlab.ua.pt/new` — web app
- `https://deti-makerlab.ua.pt/new/api/docs` — API docs
- `https://deti-makerlab.ua.pt/new/snipe-it` — Snipe-IT

## 5. Configure Snipe-IT Status Labels

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


## 6. Run the migration (optional but recommended)

If migrating data from the legacy Maker Lab Wiki, run the migration module after the stack is up:

```bash
# Dry run first to validate
python apps/migration/makerlab_migrate/cli.py \
  --dump-path /path/to/dump-1776931288 \
  --dry-run

# Full migration
python apps/migration/makerlab_migrate/cli.py \
  --dump-path /path/to/dump-1776931288
```

Full migration documentation: `docs/migration/migration-module-plan-2d9421.md`

## 7. First-time database
The database schema is applied automatically on first start via `infra/db/init/`.
If you need to reset: `docker compose -f infra/docker/docker-compose.yml down -v`
