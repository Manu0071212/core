# apps/api/main.py

from fastapi import FastAPI, Depends
from sqlmodel import Session, text
from db.database import get_session
from auth.router import router as auth_router
from routers.equipment import router as equipment_router
from routers.requisitions import router as requisitions_router
from routers.projects import router as projects_router
from routers.users import router as users_router
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

# root_path is intentionally NOT set here — the path prefix (e.g. /new/api) is
# handled entirely by the nginx reverse proxy. FastAPI must not know about it to
# avoid generating incorrect URLs in docs/redirects.
app = FastAPI(title="DETI Maker Lab API", version="1.0")

# CORS: allow requests from the configured public frontend URL.
# FRONTEND_URL is set in apps/api/.env — no hardcoding required.
origins = [
    "http://localhost:8081",       # Expo (mobile/web dev)
    "http://localhost:3000",       # Next.js local dev
    settings.FRONTEND_URL,        # Production public frontend URL
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, tags=["auth"])
app.include_router(equipment_router)
app.include_router(requisitions_router)
app.include_router(projects_router)
app.include_router(users_router)

@app.get("/")
def read_root():
    return {"message": "Hello World"}

@app.get("/health-db")
def health_check(session: Session = Depends(get_session)):
    """
    Health check endpoint to verify database connectivity.
    """
    try:
        # Execute a simple query to test the database connection
        session.exec(text("SELECT 1")).first()
        return {"status": "ok", "message": "Successfully connected to the PostgreSQL database!"}
    except Exception as e:
        return {"status": "error", "message": str(e)}