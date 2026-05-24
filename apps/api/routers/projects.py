# apps/api/routers/projects.py

from fastapi import APIRouter, Depends, HTTPException, status
from sqlmodel import Session
from typing import List
from db.database import get_session
from db.models import User
from routers.schemas import (
    ProjectCreate, ProjectRead, ProjectReadDetail,
    ProjectMemberAdd, ProjectStatusUpdate, ProjectUpdate,
)
from auth.dependencies import require_any, require_user, require_lab_tech
import services.project_service as proj_svc

router = APIRouter(prefix="/projects", tags=["projects"])

@router.get("", response_model=List[ProjectRead])
def list_projects(
    session: Session = Depends(get_session)
):
    return proj_svc.list_projects(session)


@router.get("/pending", response_model=List[ProjectRead])
def list_pending_projects(
    session: Session = Depends(get_session),
):
    return proj_svc.list_pending_projects(session)


@router.get("/{project_id}", response_model=ProjectReadDetail)
def get_project(
    project_id: int,
    session: Session = Depends(get_session),
):
    try:
        return proj_svc.get_project(session, project_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("", response_model=ProjectRead, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any)
):
    try:
        return proj_svc.create_project(session, data.dict(), current_user.id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.patch("/{project_id}", response_model=ProjectReadDetail)
def update_project(
    project_id: int,
    data: ProjectUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any)
):
    try:
        return proj_svc.update_project(session, project_id, data.model_dump(exclude_none=True), current_user.id)
    except (ValueError, PermissionError) as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/{project_id}/members", status_code=status.HTTP_201_CREATED)
def add_member(
    project_id: int,
    data: ProjectMemberAdd,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any)
):
    try:
        proj_svc.add_member(session, project_id, data.user_id, current_user.id)
        return {"message": "Member added successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/{project_id}/members/{user_id}", status_code=status.HTTP_200_OK)
def remove_member(
    project_id: int,
    user_id: int,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any)
):
    try:
        proj_svc.remove_member(session, project_id, user_id, current_user.id)
        return {"message": "Member removed successfully"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.patch("/{project_id}/status", response_model=ProjectReadDetail)
def update_project_status(
    project_id: int,
    data: ProjectStatusUpdate,
    session: Session = Depends(get_session),
    current_user: User = Depends(require_any)
):
    try:
        return proj_svc.update_project_status(
            session, project_id, data.status, current_user.id, data.rejection_reason
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))