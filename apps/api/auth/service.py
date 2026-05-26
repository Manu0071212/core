# apps/api/auth/service.py

import os
import ssl
import jwt
from sqlmodel import select
from requests_oauthlib import OAuth1Session
from requests.adapters import HTTPAdapter
from urllib3.poolmanager import PoolManager
from db.models import User
from db.database import get_session
from dotenv import load_dotenv
from datetime import datetime, timedelta, timezone
import logging

load_dotenv()
logger = logging.getLogger(__name__)

REQUEST_TOKEN_URL = "https://identity.ua.pt/oauth/request_token"
AUTHORIZATION_URL = "https://identity.ua.pt/oauth/authorize"
ACCESS_TOKEN_URL  = "https://identity.ua.pt/oauth/access_token"
PROTECTED_URL     = "https://identity.ua.pt/oauth/get_data"

CLIENT_KEY    = os.getenv("DML_AUTH_KEY")
CLIENT_SECRET = os.getenv("DML_AUTH_SECRET")
SECRET_KEY    = os.getenv("JWT_SECRET_KEY")
FRONTEND_URL  = os.getenv("FRONTEND_URL", "https://localhost:3000")

if not CLIENT_KEY or not CLIENT_SECRET or not SECRET_KEY:
    raise RuntimeError("DML_AUTH_KEY, DML_AUTH_SECRET e JWT_SECRET_KEY devem estar definidos no .env")

__owner_resources: dict[str, str] = {}


class TLSAdapter(HTTPAdapter):
    def __init__(self, ssl_context=None, **kwargs):
        self.ssl_context = ssl_context
        super().__init__(**kwargs)

    def init_poolmanager(self, *args, **kwargs):
        kwargs["ssl_context"] = self.ssl_context
        self.poolmanager = PoolManager(*args, **kwargs)


def _make_ssl_context():
    ctx = ssl.create_default_context()
    ctx.set_ciphers("DEFAULT@SECLEVEL=1")
    return ctx


def get_oauth1_session(resource_owner_key=None, resource_owner_secret=None):
    oauth = OAuth1Session(
        client_key=CLIENT_KEY,
        client_secret=CLIENT_SECRET,
        resource_owner_key=resource_owner_key,
        resource_owner_secret=resource_owner_secret,
    )
    oauth.mount("https://", TLSAdapter(_make_ssl_context()))
    return oauth


def save_request_token(key: str, secret: str):
    __owner_resources[key] = secret


def get_access_token(oauth_token: str, oauth_verifier: str):
    resource_owner_secret = __owner_resources.pop(oauth_token, None)
    if resource_owner_secret is None:
        raise ValueError(f"Token desconhecido ou já usado: {oauth_token}")
    oauth = get_oauth1_session(oauth_token, resource_owner_secret)
    tokens = oauth.fetch_access_token(ACCESS_TOKEN_URL, verifier=oauth_verifier)
    return tokens["oauth_token"], tokens["oauth_token_secret"]


def get_user_data(resource_owner_key: str, resource_owner_secret: str):
    oauth = get_oauth1_session(resource_owner_key, resource_owner_secret)

    r_uu = oauth.get(f"{PROTECTED_URL}?scope=uu&format=json")
    r_uu.raise_for_status()
    data_uu = r_uu.json()

    r_name = oauth.get(f"{PROTECTED_URL}?scope=name&format=json")
    r_name.raise_for_status()
    data_name = r_name.json()

    student_info = {}
    role = "professor"
    try:
        r_student = oauth.get(f"{PROTECTED_URL}?scope=student_info&format=json")
        r_student.raise_for_status()
        raw = r_student.json().get("NewDataSet", {}).get("ObterDadosAluno", {})
        student_info = raw[0] if isinstance(raw, list) and raw else (raw if isinstance(raw, dict) else {})
        if student_info:
            role = "student"
    except Exception:
        role = "professor"

    return {
        "email":         data_uu.get("email", ""),
        "iupi":          data_uu.get("iupi", ""),
        "name":          data_name.get("name", ""),
        "surname":       data_name.get("surname", ""),
        "nmec":          student_info.get("NMec", ""),
        "course":        student_info.get("Curso", ""),
        "academic_year": student_info.get("AnoCurricular", ""),
        "role":          role,
    }


def _create_snipeit_user(name: str, email: str) -> None:
    try:
        from services.snipeit.client import snipeit_client
        parts = name.strip().split(" ", 1)
        first_name = parts[0]
        last_name  = parts[1] if len(parts) > 1 else ""
        username   = email.split("@")[0]

        response = snipeit_client.get("/api/v1/users", params={"search": email, "limit": 1})
        rows = response.get("rows", [])
        if rows and rows[0].get("email", "").lower() == email.lower():
            existing_user = rows[0]
            perms = existing_user.get("permissions") or {}
            if not isinstance(perms, dict) or str(perms.get("superuser")) not in ("1", "True"):
                user_id = existing_user.get("id")
                snipeit_client.patch(f"/api/v1/users/{user_id}", json_data={
                    "permissions": {"superuser": 1}
                })
                logger.info(f"Updated SnipeIT user permissions for {email} to superuser")
            return

        snipeit_client.post("/api/v1/users", json_data={
            "first_name":            first_name,
            "last_name":             last_name,
            "email":                 email,
            "username":              username,
            "password":              "ChangeMe123!",
            "password_confirmation": "ChangeMe123!",
            "activated":             True,
            "permissions":           {"superuser": 1},
        })
        logger.info(f"SnipeIT user created for {email}")
    except Exception as e:
        logger.warning(f"Failed to create/update SnipeIT user for {email}: {e}")


def get_or_create_user(user_data: dict):
    db = next(get_session())
    try:
        user = db.exec(select(User).where(User.email == user_data["email"])).first()
        full_name = f"{user_data.get('name', '')} {user_data.get('surname', '')}".strip()
        is_new = user is None

        # Parse authorized technicians from environment
        tech_emails_str = os.getenv("LAB_TECHNICIANS", "manuel.arez@ua.pt,jakub.suliga@ua.pt")
        tech_emails = [email.strip().lower() for email in tech_emails_str.split(",") if email.strip()]

        if not user:
            user_email = user_data["email"]
            assigned_role = "lab_technician" if user_email.lower() in tech_emails else user_data.get("role", "student")

            user = User(
                name=full_name or user_email.split("@")[0],
                email=user_email,
                role=assigned_role,
                nmec=user_data.get("nmec") or user_data.get("iupi"),
                course=user_data.get("course") or None,
                academic_year=user_data.get("academic_year") or None,
            )
            db.add(user)
        else:
            user_email = user_data["email"]
            if user_email.lower() in tech_emails:
                user.role = "lab_technician"
            elif user.role == "lab_technician":
                # If they were a technician but are no longer in the environment variable list, revert to their SSO role
                user.role = user_data.get("role", "student")

            if full_name:
                user.name = full_name
            if user_data.get("nmec"):
                user.nmec = user_data["nmec"]
            elif user_data.get("iupi") and not user.nmec:
                user.nmec = user_data["iupi"]
            if user_data.get("course"):
                user.course = user_data["course"]
            if user_data.get("academic_year"):
                user.academic_year = user_data["academic_year"]

        db.commit()
        db.refresh(user)

        if is_new:
            _create_snipeit_user(user.name, user.email)

        return user
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def create_jwt_for_user(user: User) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    payload = {"sub": user.email, "exp": expire}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")


def is_mobile_login(oauth_token: str) -> bool:
    return __owner_resources.pop(f"mobile_{oauth_token}", None) == "1"


def get_web_redirect(oauth_token: str) -> str | None:
    return __owner_resources.pop(f"web_redirect_{oauth_token}", None)