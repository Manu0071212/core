# apps/api/auth/router.py

import jwt
from fastapi import APIRouter, Request, Response, HTTPException, Depends
from fastapi.responses import RedirectResponse
from sqlmodel import Session, select
from db.database import get_session
from db.models import User
from core.config import settings
from .service import (
    get_oauth1_session,
    save_request_token,
    get_access_token,
    get_user_data,
    get_or_create_user,
    create_jwt_for_user,
    is_mobile_login,
    get_web_redirect,
    REQUEST_TOKEN_URL,
    AUTHORIZATION_URL,
)
from .dependencies import get_current_user
from .schemas import UserRead

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/sso/login")
def sso_login():
    oauth = get_oauth1_session(callback_uri=settings.SSO_CALLBACK_URL)
    fetch_response = oauth.fetch_request_token(REQUEST_TOKEN_URL)
    resource_owner_key    = fetch_response.get("oauth_token")
    resource_owner_secret = fetch_response.get("oauth_token_secret")
    save_request_token(resource_owner_key, resource_owner_secret)
    authorization_url = oauth.authorization_url(AUTHORIZATION_URL)
    return RedirectResponse(authorization_url)


@router.get("/sso/callback")
def sso_callback(oauth_token: str, oauth_verifier: str):
    is_mobile     = is_mobile_login(oauth_token)
    web_redirect  = get_web_redirect(oauth_token)

    try:
        resource_owner_key, resource_owner_secret = get_access_token(oauth_token, oauth_verifier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    user_data = get_user_data(resource_owner_key, resource_owner_secret)
    user      = get_or_create_user(user_data)
    token     = create_jwt_for_user(user)

    if web_redirect:
        # Mobile web — redirect to the mobile web frontend
        return RedirectResponse(f"{web_redirect}?token={token}")
    if is_mobile:
        # Native — deep link
        return RedirectResponse(f"detimakerlab://auth?token={token}")
    # Normal web login — redirect to configured frontend auth callback
    return RedirectResponse(f"{settings.FRONTEND_URL}/auth/callback?token={token}")

@router.get("/me", response_model=UserRead)
def get_me(current_user = Depends(get_current_user)):
    return current_user

@router.get("/sso/callback/mobile")
def sso_callback_mobile(oauth_token: str, oauth_verifier: str):
    """Mobile-specific callback — redirects to deep link."""
    try:
        resource_owner_key, resource_owner_secret = get_access_token(oauth_token, oauth_verifier)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    user_data = get_user_data(resource_owner_key, resource_owner_secret)
    user      = get_or_create_user(user_data)
    token     = create_jwt_for_user(user)
    return RedirectResponse(f"detimakerlab://auth?token={token}")

@router.get("/sso/login/mobile")
def sso_login_mobile(web_redirect: str = ""):
    oauth = get_oauth1_session(callback_uri=settings.SSO_CALLBACK_URL)
    fetch_response = oauth.fetch_request_token(REQUEST_TOKEN_URL)
    resource_owner_key    = fetch_response.get("oauth_token")
    resource_owner_secret = fetch_response.get("oauth_token_secret")
    save_request_token(resource_owner_key, resource_owner_secret)
    # Store web_redirect if present (mobile running in browser)
    if web_redirect:
        save_request_token(f"web_redirect_{resource_owner_key}", web_redirect)
    else:
        save_request_token(f"mobile_{resource_owner_key}", "1")
    authorization_url = oauth.authorization_url(AUTHORIZATION_URL)
    return RedirectResponse(authorization_url)


@router.get("/snipeit/verify")
def verify_snipeit(request: Request, db: Session = Depends(get_session)):
    # 1. Read token from cookie or query parameter / original URI
    token = request.cookies.get("token")
    should_set_cookie = False

    if not token:
        token = request.query_params.get("token")
        if token:
            should_set_cookie = True

    if not token:
        orig_uri = request.headers.get("x-original-uri")
        if orig_uri and "?" in orig_uri:
            from urllib.parse import urlparse, parse_qs
            try:
                parsed = urlparse(orig_uri)
                q_params = parse_qs(parsed.query)
                token_list = q_params.get("token")
                if token_list:
                    token = token_list[0]
                    should_set_cookie = True
            except Exception:
                pass

    if not token:
        raise HTTPException(status_code=401, detail="No token provided")

    # 2. Decode the JWT token
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        email: str = payload.get("sub")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid token payload")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # 3. Retrieve user from database
    user = db.exec(select(User).where(User.email == email)).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    # 4. Enforce technician-only access
    if user.role != "lab_technician":
        raise HTTPException(status_code=403, detail="Forbidden: Technicians only")

    # 5. Ensure the user exists in Snipe-IT
    from auth.service import _create_snipeit_user
    _create_snipeit_user(user.name, user.email)

    # 6. Return response with X-Remote-User header
    response = Response(status_code=200)
    response.headers["X-Remote-User"] = user.email.split("@")[0]

    # If the token was retrieved from query params or original URI, store it in the browser's cookies
    if should_set_cookie:
        response.set_cookie(
            key="token",
            value=token,
            path="/",
            max_age=60 * 60 * 24 * 7,
            secure=True,
            httponly=True,
            samesite="lax"
        )
    return response


@router.get("/logout")
def logout():
    # Redirect to the configured frontend URL after clearing the auth cookie.
    # The cookie domain is derived from FRONTEND_URL to avoid hardcoding.
    response = RedirectResponse(f"{settings.FRONTEND_URL}/")
    cookie_domain = settings.COOKIE_DOMAIN
    if cookie_domain:
        response.delete_cookie("token", domain=cookie_domain, path="/")
    response.delete_cookie("token", path="/")
    return response