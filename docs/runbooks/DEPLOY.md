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
```

See `apps/api/.env.example` for a full list of variables with explanations.

### 2b. Snipe-IT environment

```bash
cp infra/snipeit/.env.snipeit.example infra/snipeit/.env.snipeit
```

Set `APP_URL` to match `SNIPEIT_PUBLIC_URL`:
```env
APP_URL=https://deti-makerlab.ua.pt/new/snipe-it
```

### 2c. Deployment URLs in docker-compose.yml

Open `infra/docker/docker-compose.yml` and update the URL variables near the top:

```yaml
# nginx environment (controls reverse-proxy routing and redirects):
environment:
  NGINX_FRONTEND_HOST: "deti-makerlab.ua.pt"
  NGINX_BASE_PATH: "/new"
  NGINX_API_PATH: "/new/api"
  NGINX_SNIPEIT_PATH: "/new/snipe-it"
  NGINX_FRONTEND_URL: "https://deti-makerlab.ua.pt/new"
  NGINX_SNIPEIT_URL:  "https://deti-makerlab.ua.pt/new/snipe-it"
  NGINX_API_URL:      "https://deti-makerlab.ua.pt/new/api"

# web build args (baked into the Next.js bundle at build time):
args:
  NEXT_PUBLIC_BASE_PATH: "/new"
  NEXT_PUBLIC_API_URL: "/new/api"   # must equal NGINX_API_PATH
  NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/new/snipe-it"
```

---

## 3. URL Configuration Guide

### Variables explained

| Variable | Where set | Purpose |
|---|---|---|
| `FRONTEND_URL` | `apps/api/.env` | Backend: CORS, SSO redirect, logout redirect |
| `SNIPEIT_PUBLIC_URL` | `apps/api/.env` | Backend: used in nginx 401 redirect config |
| `SSO_CALLBACK_URL` | `apps/api/.env` | Fixed SSO callback URL registered at identity.ua.pt |
| `SNIPEIT_BASE_URL` | `apps/api/.env` | Internal Docker URL for backend API calls to Snipe-IT |
| `APP_URL` | `infra/snipeit/.env.snipeit` | Snipe-IT self-URL (must match `SNIPEIT_PUBLIC_URL`) |
| `NGINX_*` vars | `docker-compose.yml` nginx env | nginx routing, proxy_redirect, error redirects |
| `NEXT_PUBLIC_BASE_PATH` | `docker-compose.yml` web build.args | Next.js path prefix, baked at build time |
| `NEXT_PUBLIC_API_URL` | `docker-compose.yml` web build.args | Frontend API path prefix — **must equal `NGINX_API_PATH`** (e.g. `/new/api` or `/api`) |
| `NEXT_PUBLIC_SNIPEIT_URL` | `docker-compose.yml` web build.args | Snipe-IT link in the sidebar |

### Example: deployment under `/new` (current testing)

```
MakerLab URL:  https://deti-makerlab.ua.pt/new
API URL:       https://deti-makerlab.ua.pt/new/api
Snipe-IT URL:  https://deti-makerlab.ua.pt/new/snipe-it
SSO Callback:  https://deti-makerlab.ua.pt/auth/auth  ← no /new prefix
```

```env
# apps/api/.env
FRONTEND_URL=https://deti-makerlab.ua.pt/new
SNIPEIT_PUBLIC_URL=https://deti-makerlab.ua.pt/new/snipe-it
SSO_CALLBACK_URL=https://deti-makerlab.ua.pt/auth/auth
```
```env
# infra/snipeit/.env.snipeit
APP_URL=https://deti-makerlab.ua.pt/new/snipe-it
```
```yaml
# docker-compose.yml — nginx environment
NGINX_FRONTEND_HOST: "deti-makerlab.ua.pt"
NGINX_BASE_PATH: "/new"
NGINX_API_PATH: "/new/api"
NGINX_SNIPEIT_PATH: "/new/snipe-it"
NGINX_FRONTEND_URL: "https://deti-makerlab.ua.pt/new"
NGINX_SNIPEIT_URL:  "https://deti-makerlab.ua.pt/new/snipe-it"
NGINX_API_URL:      "https://deti-makerlab.ua.pt/new/api"

# docker-compose.yml — web build args
NEXT_PUBLIC_BASE_PATH: "/new"
NEXT_PUBLIC_API_URL: "/new/api"   # must match NGINX_API_PATH
NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/new/snipe-it"
```

### Example: final deployment at root (no prefix)

```
MakerLab URL:  https://deti-makerlab.ua.pt
API URL:       https://deti-makerlab.ua.pt/api
Snipe-IT URL:  https://deti-makerlab.ua.pt/snipe-it
SSO Callback:  https://deti-makerlab.ua.pt/auth/auth
```

```env
# apps/api/.env
FRONTEND_URL=https://deti-makerlab.ua.pt
SNIPEIT_PUBLIC_URL=https://deti-makerlab.ua.pt/snipe-it
SSO_CALLBACK_URL=https://deti-makerlab.ua.pt/auth/auth
```
```env
# infra/snipeit/.env.snipeit
APP_URL=https://deti-makerlab.ua.pt/snipe-it
```
```yaml
# docker-compose.yml — nginx environment
NGINX_FRONTEND_HOST: "deti-makerlab.ua.pt"
NGINX_BASE_PATH: ""
NGINX_API_PATH: "/api"
NGINX_SNIPEIT_PATH: "/snipe-it"
NGINX_FRONTEND_URL: "https://deti-makerlab.ua.pt"
NGINX_SNIPEIT_URL:  "https://deti-makerlab.ua.pt/snipe-it"
NGINX_API_URL:      "https://deti-makerlab.ua.pt/api"

# docker-compose.yml — web build args
NEXT_PUBLIC_BASE_PATH: ""
NEXT_PUBLIC_API_URL: "/api"       # matches NGINX_API_PATH (root deployment)
NEXT_PUBLIC_SNIPEIT_URL: "https://deti-makerlab.ua.pt/snipe-it"
```

> [!WARNING]
> When changing URL variables, you **must rebuild** the containers because `NEXT_PUBLIC_*` variables are baked into the Next.js bundle at build time:
> ```bash
> docker compose -f infra/docker/docker-compose.yml up -d --build
> ```

---

## 4. Start the stack
```bash
docker compose -f infra/docker/docker-compose.yml up -d --build
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


## 8. Run the migration (optional but recommended)

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
