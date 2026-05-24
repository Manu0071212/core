from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session, select
from typing import List
from db.database import get_session
from db.models import User, EquipmentRequest
from routers.schemas import RequisitionRead, RequisitionCreate, RequisitionReject
from auth.dependencies import require_any, require_lab_tech
import services.requisition_service as req_svc

router = APIRouter(tags=["requisitions"])

@router.get("/requisitions", response_model=List[RequisitionRead])
def list_all_requisitions(
    session: Session = Depends(get_session)
):
    return req_svc.list_all_requisitions(session)

@router.get("/projects/{project_id}/requisitions", response_model=List[RequisitionRead])
def list_project_requisitions(
    project_id: int,
    session: Session = Depends(get_session),
):
    return req_svc.list_project_requisitions(session, project_id)

@router.get("/requisitions/{req_id}", response_model=RequisitionRead)
def get_requisition(
    req_id: int,
    session: Session = Depends(get_session),
):
    try:
        return req_svc.get_requisition(session, req_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/projects/{project_id}/requisitions",
             response_model=List[RequisitionRead],
             status_code=status.HTTP_201_CREATED)
def create_project_requisitions(
    project_id: int,
    data: RequisitionCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any),
):
    try:
        return req_svc.create_requisition(
            session, project_id,
            user_id=current_user.id,
            snipeit_asset_ids=data.items,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/requisitions/{req_id}/approve", response_model=RequisitionRead)
def approve_requisition(
    req_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_lab_tech),
):
    try:
        return req_svc.approve_requisition(session, req_id, current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/requisitions/{req_id}/reject", response_model=RequisitionRead)
def reject_requisition(
    req_id: int,
    data: RequisitionReject,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_lab_tech),
):
    try:
        return req_svc.reject_requisition(session, req_id, current_user.id, data.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/requisitions/sync-snipeit", status_code=status.HTTP_200_OK)
def sync_from_snipeit(
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any),
):
    stats = req_svc.sync_from_snipeit_logs(session)
    return {"message": "Sync completed", "stats": stats}