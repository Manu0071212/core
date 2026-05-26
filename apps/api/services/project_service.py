# apps/api/services/project_service.py

from datetime import datetime, timezone
from typing import List
from sqlmodel import Session, select
from db.models import Project, ProjectMember, User, StatusHistory
from services.notification_service import notify, notify_project_members
import logging

logger = logging.getLogger(__name__)

ALLOWED_TRANSITIONS = {
    "pending":  ["active", "rejected"],
    "active":   ["completed", "archived"],
}


def _add_history(session: Session, entity_id: int, old_status: str, new_status: str, changed_by: int, note: str = None):
    history = StatusHistory(
        entity_type="project",
        entity_id=entity_id,
        old_status=old_status,
        new_status=new_status,
        changed_by=changed_by,
        note=note
    )
    session.add(history)


def list_projects(session: Session) -> List[Project]:
    return session.exec(select(Project).order_by(Project.created_at.desc())).all()


def get_project(session: Session, project_id: int) -> dict:
    from sqlmodel import select

    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    members = session.exec(
        select(ProjectMember).where(ProjectMember.project_id == project_id)
    ).all()

    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "course": project.course,
        "academic_year": project.academic_year,
        "group_number": project.group_number,
        "created_by": project.created_by,
        "status": project.status,
        "tags": project.tags,
        "links": project.links,
        "approved_at": project.approved_at,
        "created_at": project.created_at,
        "members": [{"user_id": m.user_id, "role": m.role} for m in members],
    }


def create_project(session: Session, data: dict, created_by: int) -> dict:
    members_data = data.get("members", [])
    supervisors = [m for m in members_data if m.get("role") == "supervisor"]

    for sup in supervisors:
        user = session.get(User, sup["user_id"])
        if not user or user.role != "professor":
            raise ValueError(f"User {sup['user_id']} is not a professor {user.role}")

    project = Project(
        name=data["name"],
        description=data.get("description"),
        course=data.get("course"),
        academic_year=data.get("academic_year"),
        group_number=data.get("group_number"),
        created_by=created_by,
        status="pending",
        tags=data.get("tags"),
        links=data.get("links"),
    )
    session.add(project)
    session.flush()

    session.add(ProjectMember(project_id=project.id, user_id=created_by, role="leader"))

    for m in members_data:
        user_id = m["user_id"]
        role = m.get("role", "member")
        if user_id == created_by:
            continue
        member = session.get(User, user_id)
        if not member:
            raise ValueError(f"User {user_id} not found")
        session.add(ProjectMember(project_id=project.id, user_id=user_id, role=role))
        notify(session, user_id,
            title=f"Added to project: {project.name}",
            message=f"You were added to the project '{project.name}' as {role}.",
            type="info",
            reference_type="project", reference_id=project.id)

    try:
        _add_history(session, project.id, None, "pending", created_by, "Project created")
    except Exception as e:
        logger.warning(f"Could not write status history: {e}")

    session.commit()
    session.refresh(project)
    return get_project(session, project.id)


def add_member(session: Session, project_id: int, user_id: int, requested_by: int) -> None:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    if project.created_by != requested_by:
        raise PermissionError("Only the project creator can add members")

    user = session.get(User, user_id)
    if not user:
        raise ValueError("User not found")

    existing = session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
    ).first()
    if existing:
        raise ValueError("User is already a member")

    session.add(ProjectMember(project_id=project_id, user_id=user_id, role="member"))
    session.commit()


def remove_member(session: Session, project_id: int, user_id: int, requested_by: int) -> None:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    if project.created_by != requested_by:
        raise PermissionError("Only the project creator can remove members")

    member = session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == user_id
        )
    ).first()
    if not member:
        raise ValueError("Member not found")

    if member.role == "leader":
        raise ValueError("Cannot remove the project leader")

    session.delete(member)
    session.commit()


def update_project_status(session: Session, project_id: int, new_status: str,
                          changed_by: int, rejection_reason: str = None) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    valid_next = ALLOWED_TRANSITIONS.get(project.status, [])
    if new_status not in valid_next:
        raise ValueError(f"Cannot transition from '{project.status}' to '{new_status}'")

    old_status = project.status
    project.status = new_status

    if new_status == "approved":
        project.approved_at = datetime.now(timezone.utc)
        notify_project_members(session, project_id,
            title=f"Project approved: {project.name}",
            message=f"Your project '{project.name}' has been approved.",
            type="approval",
            reference_type="project", reference_id=project_id)

    elif new_status == "rejected":
        from sqlmodel import select as sel
        from db.models import EquipmentRequest
        reqs = session.exec(sel(EquipmentRequest).where(EquipmentRequest.project_id == project_id)).all()
        for req in reqs:
            session.delete(req)

        reason_text = rejection_reason or "No reason provided."
        notify_project_members(session, project_id,
            title=f"Project rejected: {project.name}",
            message=f"Your project '{project.name}' was rejected. Reason: {reason_text}",
            type="warning",
            reference_type="project", reference_id=project_id)

    elif new_status == "active":
        notify_project_members(session, project_id,
            title=f"Project is now active: {project.name}",
            message=f"Your project '{project.name}' is now active.",
            type="info",
            reference_type="project", reference_id=project_id)

    try:
        _add_history(session, project_id, old_status, new_status, changed_by, rejection_reason)
    except Exception as e:
        logger.warning(f"Could not write status history: {e}")

    session.commit()
    session.refresh(project)
    return get_project(session, project_id)

def update_project(session: Session, project_id: int, data: dict, requested_by: int) -> dict:
    project = session.get(Project, project_id)
    if not project:
        raise ValueError("Project not found")

    # Só o criador ou membros com role leader podem editar
    from sqlmodel import select
    member = session.exec(
        select(ProjectMember).where(
            ProjectMember.project_id == project_id,
            ProjectMember.user_id == requested_by,
            ProjectMember.role == "leader"
        )
    ).first()
    if not member and project.created_by != requested_by:
        raise PermissionError("Only the project leader can edit the project")

    for field, value in data.items():
        setattr(project, field, value)

    session.commit()
    session.refresh(project)
    return get_project(session, project_id)

def list_pending_projects(session: Session) -> List[Project]:
    return session.exec(
        select(Project).where(Project.status == "pending").order_by(Project.created_at.desc())
    ).all()