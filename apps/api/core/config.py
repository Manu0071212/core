# apps/api/core/config.py

from urllib.parse import urlparse
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    POSTGRES_USER: str
    POSTGRES_PASSWORD: str
    POSTGRES_SERVER: str
    POSTGRES_PORT: int = 5432
    POSTGRES_DB: str

    DML_AUTH_KEY: str
    DML_AUTH_SECRET: str
    JWT_SECRET_KEY: str
    JWT_ALGORITHM: str
    JWT_EXPIRE_MINUTES: int

    # Public browser-facing root URL of the MakerLab frontend (no trailing slash).
    # Example with prefix: https://deti-makerlab.ua.pt/new
    # Example without:     https://deti-makerlab.ua.pt
    FRONTEND_URL: str

    # Public browser-facing URL of the Snipe-IT interface (no trailing slash).
    # Example: https://deti-makerlab.ua.pt/new/snipe-it
    SNIPEIT_PUBLIC_URL: str

    # SSO callback URL registered at identity.ua.pt — does NOT include path prefix.
    SSO_CALLBACK_URL: str

    # Internal Docker network URL for backend → Snipe-IT API calls (never browser-facing).
    SNIPEIT_BASE_URL: str
    SNIPEIT_API_TOKEN: str
    SNIPEIT_TIMEOUT_SECONDS: int = 10
    SNIPEIT_DEPLOYABLE_STATUS_LABELS: str = "Ready to Deploy"  # Comma-separated list for dynamic resolution
    SNIPEIT_RESERVED_STATUS_ID: int = 4

    @property
    def DATABASE_URI(self) -> str:
        """
        Property that dynamically builds the valid SQLModel database URI.
        """
        return f"postgresql+psycopg2://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    @property
    def COOKIE_DOMAIN(self) -> str | None:
        """
        Extracts the domain from FRONTEND_URL for use in cookie deletion.
        Returns None for localhost, which makes Set-Cookie domain-agnostic.
        """
        hostname = urlparse(self.FRONTEND_URL).hostname or ""
        return None if hostname in ("localhost", "127.0.0.1") else hostname

    # Configuration to read from the .env file
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

# Create a global instance to import in other files
settings = Settings()