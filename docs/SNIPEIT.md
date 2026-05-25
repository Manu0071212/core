# Snipe-IT API Integration Guide

This guide explains how the DETI Maker Lab backend connects to the Snipe-IT inventory system, and how to configure a new API token if the environment is ever reset.

## Overview

We use Snipe-IT as the authoritative source of truth for physical inventory. Our backend (`makerlab-api`) interacts with the Snipe-IT REST API to check out assets, return assets, and synchronize the equipment catalog.

To do this, the backend needs two environment variables set in the `apps/api/.env` file:
```env
SNIPEIT_BASE_URL=http://snipeit
SNIPEIT_API_TOKEN=your_generated_token_here
```

*Note: Inside docker-compose, `http://snipeit` is the internal service name. External testing from a local Python script might require `https://deti-makerlab.ua.pt/new/snipe-it` with SSL verification disabled.*

---

## How to generate a new Snipe-IT API Token

If you are setting up Snipe-IT for the first time, or if your token expires/gets revoked, follow these steps to generate a new one:

1. **Login to Snipe-IT**
   Navigate to your Snipe-IT dashboard (e.g., `https://deti-makerlab.ua.pt/new/snipe-it`) and log in with an Administrator account.

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
   docker compose up -d --build
   ```

## Verifying the Connection

Once the backend is configured, you can verify the connection by triggering the catalog sync endpoint from your API browser or Swagger UI (`http://localhost:8000/docs`):

**`POST /api/equipment/catalog/sync`**

If the token is valid, it will return a success message with stats of how many items were updated. If the token is invalid, it will return a `401 Unauthorized` exception.

