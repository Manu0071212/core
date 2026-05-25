import os
from datetime import datetime, timezone
from typing import List
from sqlmodel import Session, select
from db.models import EquipmentRequest, Project, User, StatusHistory
from services.notification_service import notify_project_members
import logging

logger = logging.getLogger(__name__)

RESERVED_STATUS_ID = int(os.getenv("SNIPEIT_RESERVED_STATUS_ID", "4"))

def _add_history(session, entity_id, old_status, new_status, changed_by, note=None):
    session.add(StatusHistory(
        entity_type="equipment_request",
        entity_id=entity_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note,
    ))

def create_requisition(session: Session, project_id: int, user_id: int,
                       snipeit_asset_ids: List[int]) -> List[EquipmentRequest]:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")
    if not snipeit_asset_ids:
        raise ValueError("At least one equipment item is required")

    created = []
    for asset_id in snipeit_asset_ids:
        req = EquipmentRequest(
            project_id=project_id,
            requested_by=user_id,
            snipeit_asset_id=asset_id,
            status="pending",
        )
        session.add(req)
        session.flush()
        _add_history(session, req.id, None, "pending", user_id, "Requisition created")
        created.append(req)

    session.commit()
    for r in created:
        session.refresh(r)
    return created


def approve_requisition(session: Session, req_id: int, user_id: int) -> EquipmentRequest:
    req = session.get(EquipmentRequest, req_id)
    if not req:
        raise ValueError("Requisition not found")
    if req.status != "pending":
        raise ValueError("Only pending requisitions can be approved")

    if req.snipeit_asset_id:
        try:
            from services.snipeit.client import snipeit_client
            snipeit_client.patch(
                f"/api/v1/hardware/{req.snipeit_asset_id}",
                json_data={"status_id": RESERVED_STATUS_ID}
            )
        except Exception as e:
            logger.warning(f"Could not update Snipe-IT status for asset {req.snipeit_asset_id}: {e}")

    old_status = req.status
    req.status = "reserved"
    req.approved_at = datetime.now(timezone.utc)
    _add_history(session, req.id, old_status, "reserved", user_id, "Approved")

    try:
        project = session.get(Project, req.project_id)
        project_name = project.name if project else f"Project #{req.project_id}"
        notify_project_members(
            session, req.project_id,
            title="Equipment request approved",
            message=f'Your request for asset #{req.snipeit_asset_id} on "{project_name}" was approved. You can now pick up the equipment.',
            type="approval",
            reference_type="equipment_request",
            reference_id=req.id,
        )
    except Exception as e:
        logger.warning(f"Notification failed: {e}")

    session.commit()
    session.refresh(req)
    return req


def reject_requisition(session: Session, req_id: int, user_id: int, reason: str) -> EquipmentRequest:
    req = session.get(EquipmentRequest, req_id)
    if not req:
        raise ValueError("Requisition not found")
    if req.status != "pending":
        raise ValueError("Only pending requisitions can be rejected")

    old_status = req.status
    req.status = "rejected"
    req.rejection_reason = reason
    _add_history(session, req.id, old_status, "rejected", user_id, f"Rejected: {reason}")

    try:
        project = session.get(Project, req.project_id)
        project_name = project.name if project else f"Project #{req.project_id}"
        notify_project_members(
            session, req.project_id,
            title="Equipment request rejected",
            message=f'Your request for asset #{req.snipeit_asset_id} on "{project_name}" was rejected. Reason: {reason}',
            type="warning",
            reference_type="equipment_request",
            reference_id=req.id,
        )
    except Exception as e:
        logger.warning(f"Notification failed: {e}")

    session.commit()
    session.refresh(req)
    return req

def _parse_snipeit_date(date_val):
    if not date_val:
        return datetime.now(timezone.utc)
    if isinstance(date_val, dict):
        date_str = date_val.get("datetime")
    else:
        date_str = date_val
    if not date_str:
        return datetime.now(timezone.utc)
    try:
        return datetime.strptime(date_str, "%Y-%m-%d %H:%M:%S")
    except Exception:
        return datetime.now(timezone.utc)


def sync_from_snipeit_logs(session: Session) -> dict:
    from services.snipeit.client import snipeit_client

    stats = {"checked_out": 0, "returned": 0, "errors": 0}

    try:
        response = snipeit_client.get(
            "/api/v1/reports/activity",
            params={"limit": 200}
        )
        rows = response.get("rows") or []
    except Exception as e:
        logger.error(f"Failed to fetch Snipe-IT activity logs: {e}")
        return stats

    for row in rows:
        try:
            action_type = row.get("action_type", "")
            item = row.get("item") or {}
            asset_id = item.get("id") if item.get("type") == "asset" else None

            if not asset_id or action_type not in ("checkout", "checkin from"):
                continue

            req = session.exec(
                select(EquipmentRequest)
                .where(EquipmentRequest.snipeit_asset_id == asset_id)
                .where(EquipmentRequest.status.in_(["reserved", "checked_out"]))
            ).first()

            if not req:
                continue

            if action_type == "checkout" and req.status == "reserved":
                action_date = _parse_snipeit_date(row.get("action_date"))
                
                if req.created_at and action_date < req.created_at.replace(tzinfo=None):
                    continue
                
                log_meta = row.get("log_meta") or {}
                expected_raw = None
                if "expected_checkin" in log_meta:
                    val = log_meta["expected_checkin"]
                    expected_raw = val.get("new") if isinstance(val, dict) else val

                req.status = "checked_out"
                req.checked_out_at = action_date
                if expected_raw:
                    try:
                        req.expected_checkin = datetime.strptime(expected_raw, "%Y-%m-%d")
                    except Exception:
                        pass

                _add_history(session, req.id, "reserved", "checked_out", 1,
                             "Auto-synced: checkout detected in Snipe-IT")
                stats["checked_out"] += 1

            elif action_type == "checkin from" and req.status == "checked_out":
                action_date = _parse_snipeit_date(row.get("action_date"))

                if req.checked_out_at and action_date < req.checked_out_at:
                    continue
                
                req.status = "returned"
                req.returned_at = action_date
                _add_history(session, req.id, "checked_out", "returned", 1,
                             "Auto-synced: checkin detected in Snipe-IT")
                stats["returned"] += 1

        except Exception as e:
            logger.warning(f"Error processing row {row.get('id')}: {e}")
            session.rollback()
            stats["errors"] += 1

    try:
        session.commit()
    except Exception as e:
        logger.error(f"Failed to commit sync: {e}")
        session.rollback()

    return stats


def list_project_requisitions(session: Session, project_id: int) -> List[EquipmentRequest]:
    return session.exec(
        select(EquipmentRequest)
        .where(EquipmentRequest.project_id == project_id)
        .order_by(EquipmentRequest.created_at.desc())
    ).all()


def list_all_requisitions(session: Session) -> List[EquipmentRequest]:
    return session.exec(
        select(EquipmentRequest).order_by(EquipmentRequest.created_at.desc())
    ).all()


def get_requisition(session: Session, req_id: int) -> EquipmentRequest:
    req = session.get(EquipmentRequest, req_id)
    if not req:
        raise ValueError("Requisition not found")
    return req