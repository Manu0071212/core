# apps/api/routers/equipment.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List, Optional
from db.database import get_session
from db.models import User
from routers.schemas import EquipmentModelRead, EquipmentRead, EquipmentCatalogItemRead
from services.inventory_service import list_catalog, sync_catalog, sync_equipment, list_equipment_catalog_from_snipeit
from auth.dependencies import require_any, require_lab_tech, require_optional

router = APIRouter(prefix="/equipment", tags=["equipment"])

def _parse_price(value):
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        v = value.strip()
        if not v:
            return None
        for ch in ["€", "$", "£", " "]:
            v = v.replace(ch, "")
        v = v.replace(",", "")
        try:
            return float(v)
        except ValueError:
            return None
    return None

@router.get("/catalog", response_model=List[EquipmentCatalogItemRead])
def get_catalog(session: Session = Depends(get_session), current_user: Optional[User] = Depends(require_optional)):
    return list_equipment_catalog_from_snipeit(session=session)

@router.post("/catalog/sync", status_code=status.HTTP_200_OK)
def trigger_catalog_sync(session: Session = Depends(get_session), current_user: User = Depends(require_any)):
    """
    Triggers an on-demand sync of Snipe-IT models to the local database.
    (In real life, restrict this to admins).
    """
    try:
        stats = sync_catalog(session)
        return {"message": "Sync completed successfully", "stats": stats}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{equipment_id}", response_model=EquipmentCatalogItemRead)
def get_equipment_detail(equipment_id: int, current_user: Optional[User] = Depends(require_optional)):
    from services.snipeit.assets import get_asset

    asset = get_asset(equipment_id)
    if not asset:
        raise HTTPException(status_code=404, detail="Snipe-IT asset not found")

    location_name = (
        asset.location.name if asset.location else
        asset.rtd_location.name if asset.rtd_location else
        None
    )

    return {
        "id": asset.id,
        "name": asset.name or (asset.model.name if asset.model else "Unnamed"),
        "category": asset.category.name if asset.category else None,
        "supplier": (
            asset.supplier.name if asset.supplier else (
                asset.model.manufacturer.name
                if asset.model and hasattr(asset.model, "manufacturer") and asset.model.manufacturer
                else None
            )
        ),
        "price": _parse_price(asset.purchase_cost),
        "location": location_name,
        "image": asset.image,
        "status": asset.status_label.name if asset.status_label else "unknown",
    }

@router.post("/{equipment_id}/refresh", response_model=EquipmentRead)
def refresh_local_equipment(equipment_id: int, session: Session = Depends(get_session), current_user: User = Depends(require_any)):
    """
    Forces a local DB cache refresh of this specific equipment by fetching from Snipe-IT.
    """
    from services.inventory_service import sync_equipment
    try:
        updated_equipment = sync_equipment(session, equipment_id)
        return updated_equipment
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/{equipment_id}/projects")
def get_equipment_projects(
    equipment_id: int,
    session: Session = Depends(get_session)
):
    from sqlmodel import select
    from db.models import Equipment as EquipmentModel, EquipmentUsage, Project

    equip = session.exec(
        select(EquipmentModel).where(EquipmentModel.snipeit_asset_id == equipment_id)
    ).first()

    if not equip:
        return []

    usages = session.exec(
        select(EquipmentUsage).where(EquipmentUsage.equipment_id == equip.id)
    ).all()

    project_ids = list({u.project_id for u in usages})

    projects = []
    for pid in project_ids:
        proj = session.get(Project, pid)
        if proj:
            projects.append({
                "id": proj.id,
                "name": proj.name,
                "status": proj.status,
                "course": proj.course,
            })

    return projects

@router.get("/catalog/available", response_model=List[EquipmentCatalogItemRead])
def get_available_catalog(
    session: Session = Depends(get_session),
    current_user: Optional[User] = Depends(require_optional)
):
    from sqlmodel import select
    from db.models import (
        EquipmentUsage,
        Equipment,
        EquipmentRequest,
    )

    active_usage_equipment_ids = session.exec(
        select(EquipmentUsage.equipment_id)
        .where(EquipmentUsage.status.in_(["checked_out", "assigned"]))
    ).all()

    pending_request_asset_ids = session.exec(
        select(EquipmentRequest.snipeit_asset_id)
        .where(EquipmentRequest.status == "pending")
        .where(EquipmentRequest.snipeit_asset_id.is_not(None))
    ).all()

    active_usage_asset_ids = session.exec(
        select(Equipment.snipeit_asset_id)
        .where(Equipment.id.in_(active_usage_equipment_ids))
        .where(Equipment.snipeit_asset_id.is_not(None))
    ).all()

    blocked_asset_ids = (
        set(active_usage_asset_ids) |
        set(pending_request_asset_ids)
    )

    all_catalog = list_equipment_catalog_from_snipeit(session=session)

    return [
        item for item in all_catalog
        if item["available"] and item["id"] not in blocked_asset_ids
    ]