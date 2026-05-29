# Snipe-IT API Integration Guide

This guide explains how the DETI Maker Lab backend connects to the Snipe-IT inventory system, and how to configure a new API token if the environment is ever reset.

## Overview

We use Snipe-IT as the authoritative source of truth for physical inventory. Our backend (`makerlab-api`) interacts with the Snipe-IT REST API to check out assets, return assets, and synchronize the equipment catalog.

To do this, the backend needs two environment variables set in the `apps/api/.env` file:
```env
SNIPEIT_BASE_URL=http://snipeit
SNIPEIT_API_TOKEN=your_generated_token_here
```

*Note: Inside docker-compose, `http://snipeit` is the internal service name. External testing from a local Python script might require the public Snipe-IT URL (e.g. `https://deti-makerlab.ua.pt/new/snipe-it`) with SSL verification disabled. The public URL is set via `SNIPEIT_PUBLIC_URL` in `apps/api/.env`.*

---

## How to configure / update the Snipe-IT API Token

To connect the MakerLab API and Snipe-IT, the backend needs the `SNIPEIT_API_TOKEN` environment variable set in `apps/api/.env`. You can configure this token using one of the following methods:

### Method A: Automated Bootstrapping (Recommended)
If you are deploying for the first time or want to regenerate the token automatically, run the bootstrap script from the repository root:
```bash
./infra/docker/bootstrap-snipeit.sh
```
This script will wait for Snipe-IT to initialize, create the admin user (if missing), register the personal access client, generate a token, update `apps/api/.env`, and automatically restart the backend.

> [!WARNING]
> If the script somehow would not connect Maker Lab with Snipe-IT automatically, then you should copy the admin account credentials that were provided in command line result of `./infra/docker/bootstrap-snipeit.sh` and proceed with method B.

### Method B: Manual Generation (Fallback)
If you prefer to generate a token manually via the web interface:

1. **Login to Snipe-IT**
   Navigate to your Snipe-IT dashboard (the URL configured in `SNIPEIT_PUBLIC_URL`, e.g. `https://deti-makerlab.ua.pt/new/snipe-it`) and log in with an Administrator account.

2. **Access Profile Settings**
   Click on your profile name / avatar in the **top-right corner** of the screen.

3. **Manage API Keys**
   Select **"Manage API Keys"** from the drop-down menu.

4. **Create a New Token**
   - Click the **"Create New Token"** button.
   - You will be prompted to give the token a description (e.g., "MakerLab Backend Integration").
   - Click "Create".

5. **Copy the Token**
   Snipe-IT will display a long alphanumeric JSON Web Token (JWT).
   > [!WARNING]
   > This is the **only** time Snipe-IT will show you the full token string. Copy it immediately to your clipboard.

6. **Update the Environment variables**
   Open the `/apps/api/.env` file in the codebase and paste the token:
   ```env
   SNIPEIT_API_TOKEN=eyJ0eXAiOiJKV1QiLCJhbG...<rest of your token>
   ```

7. **Restart the API Container**
   Restart the FastAPI service to pull in the new environment variables:
   ```bash
   cd infra/docker
   docker compose up -d --build api
   ```

## Verifying the Connection

Once the backend is configured, you can verify the connection by triggering the catalog sync endpoint from your API browser or Swagger UI (`http://localhost:8000/docs`):

**`POST /api/equipment/catalog/sync`**

If the token is valid, it will return a success message with stats of how many items were updated. If the token is invalid, it will return a `401 Unauthorized` exception.


---

## Managing Lab Technicians

The DETI Maker Lab system dynamically maps University SSO accounts to the `lab_technician` role on login. Only users with the `lab_technician` role are granted access to the Snipe-IT inventory system.

### How to Add a Technician
To grant a user technician privileges:
1. Open the `/apps/api/.env` file in the codebase.
2. Locate the `LAB_TECHNICIANS` environment variable. It contains a comma-separated list of technician emails:
   ```env
   LAB_TECHNICIANS=lab.tech@ua.pt,another.labtech@ua.pt
   ```
3. Add the user's university email to this list (separated by a comma). All emails are case-insensitive.
   *Example:*
   ```env
   LAB_TECHNICIANS=lab.tech@ua.pt,another.labtech@ua.pt,new.tech@ua.pt
   ```
4. Restart the API container to load the updated environment variables:
   ```bash
   cd infra/docker
   docker compose up -d --build api
   ```
5. The next time the user logs in via the University SSO, their role in the Maker Lab database will automatically be updated to `lab_technician`. In addition:
   - They will be auto-provisioned inside Snipe-IT if their account doesn't exist yet.
   - They will automatically be granted superuser (`admin`) permissions inside Snipe-IT.

### How to Remove a Technician
To revoke technician privileges:
1. Open the `/apps/api/.env` file in the codebase.
2. Locate the `LAB_TECHNICIANS` environment variable.
3. Remove the user's email from the comma-separated list.
4. Restart the API container:
   ```bash
   cd infra/docker
   docker compose up -d --build api
   ```
5. The next time the user logs in via SSO, their role in the Maker Lab database will automatically revert back to their default university role (e.g. `student` or `professor`), immediately revoking their access to Snipe-IT at the API and proxy level.
