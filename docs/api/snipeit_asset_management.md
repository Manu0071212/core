# Snipe-IT Asset Management API

This document details the REST endpoints implemented in the DETI Maker Lab backend to manage the Snipe-IT inventory integration, equipment catalog, and the asset requisition workflow.

## Overview

The integration uses a unidirectional authority model:
1. **Snipe-IT** is the source of truth for **Models** and **Physical Assets**.
2. **Maker Lab API** is the source of truth for **Projects**, **Requisitions**, and **Assignments**.

---

## 1. Equipment & Catalog Endpoints

These endpoints manage equipment capabilities, fetching available hardware scopes, and synchronizing core asset data. All paths are prefixed with `/api/equipment`.

### `GET /api/equipment/catalog`
- **Purpose**: Returns the list of physical assets.
- **Use Case**: Used by the frontend UI to display available hardware and allow students to select specific physical assets to request.
- **Workflow**: Fetches assets directly from Snipe-IT via the API wrapper, mapping their location, category, status, and availability.

### `GET /api/equipment/catalog/available`
- **Purpose**: Returns a list of available physical assets that can currently be requested.
- **Workflow**: Fetches assets from Snipe-IT and filters out any assets that are currently checked out, assigned to active projects, or blocked by pending requests.

### `POST /api/equipment/catalog/sync`
- **Purpose**: Triggers an on-demand sync of Snipe-IT models.
- **Use Case**: Used by administrators to update the local database with new model categories and metadata from Snipe-IT.
- **Workflow**: Queries Snipe-IT's `/api/v1/models` and updates/inserts local `EquipmentModel` records.

### `GET /api/equipment/{equipment_id}`
- **Purpose**: Fetches instantaneous details of a Snipe-IT asset.
- **Use Case**: Used to view real-time information of a specific physical device.
- **Workflow**: Fetches details directly from Snipe-IT by asset ID (the Snipe-IT Asset ID, not the local DB ID).

### `POST /api/equipment/{equipment_id}/refresh`
- **Purpose**: Forces a local DB cache refresh of this specific equipment by fetching from Snipe-IT.
- **Workflow**: Given a local `equipment_id`, the system references its underlying `snipeit_asset_id`, hits the Snipe-IT detail endpoint, updates local columns, and returns the fresh profile.

---

## 2. Requisition Endpoints

These endpoints handle the requisition and reservation lifecycle. The physical checkout and return of equipment are performed directly within the Snipe-IT interface by a lab technician, and then synchronized back to the Maker Lab application. All paths are prefixed with `/api`.

### `POST /api/projects/{project_id}/requisitions`
- **Purpose**: A student requests to borrow specific physical assets for a project.
- **Payload**:
  ```json
  {
    "items": [12, 15]
  }
  ```
  *(where `items` is a list of physical Snipe-IT asset IDs).*
- **Workflow**: Creates an `EquipmentRequest` record with status `pending` for each asset ID. Emits a `StatusHistory` breadcrumb.

### `POST /api/requisitions/{req_id}/approve`
- **Purpose**: Admin action to approve a request.
- **Workflow**:
  1. Transitions the `EquipmentRequest` status from `pending` to `reserved`.
  2. Patches the corresponding physical asset status in Snipe-IT to `Reserved` (defined by `SNIPEIT_RESERVED_STATUS_ID`).
  3. Sends a notification to the project members.

### `POST /api/requisitions/{req_id}/reject`
- **Purpose**: Admin action to decline a request.
- **Payload**:
  ```json
  {
    "reason": "Insufficient description of need."
  }
  ```
- **Workflow**: Transitions the `EquipmentRequest` status to `rejected`, stores the reason, and notifies the project members.

### `POST /api/requisitions/sync-snipeit`
- **Purpose**: Synchronize the checked-out and returned status of reserved equipment based on Snipe-IT activity logs.
- **Workflow**:
  1. Fetches the latest activity logs from Snipe-IT (up to 200 logs).
  2. For `checkout` actions, if the asset corresponds to a local requisition in `reserved` status, it updates the requisition status to `checked_out`, sets `checked_out_at`, and optionally parses `expected_checkin`.
  3. For `checkin from` actions, if the asset corresponds to a local requisition in `checked_out` status, it updates the status to `returned` and sets `returned_at`.
  4. Records the status changes in the `StatusHistory` table.
