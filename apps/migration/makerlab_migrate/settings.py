# apps/migration/makerlab_migrate/settings.py

import os
from pathlib import Path
from typing import Dict, Optional
from pydantic_settings import BaseSettings
from pydantic import Field


class MigrationSettings(BaseSettings):
    """Configuration for the migration module."""
    
    # Dump file path - can be set via env var or passed directly
    dump_path: Path = Field(default_factory=lambda: Path(os.getenv("DUMP_PATH", ".")))
    
    # PostgreSQL connection - can be POSTGRES_URL or DATABASE_URL
    postgres_uri: str = Field(default_factory=lambda: os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL", ""))
    
    # Snipe-IT configuration
    snipeit_url: str = Field(default="")
    snipeit_token: str = Field(default="")
    snipeit_timeout_seconds: int = 10
    

    
    # Rate limiting
    snipeit_api_delay_ms: int = 100
    
    # Batch size for processing
    batch_size: int = 100
    
    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "extra": "ignore"
    }
    
    @classmethod
    def from_env(cls, dump_path: str) -> "MigrationSettings":
        """Load settings from environment variables."""
        import os
        import json
        from dotenv import load_dotenv
        
        # Explicitly load .env file from the migration directory (parent of this file's dir)
        # Do not override already-set environment variables, so shell exports like
        # DATABASE_URL take precedence over the repository .env defaults.
        env_path = Path(__file__).parent.parent / ".env"
        if env_path.exists():
            load_dotenv(env_path, override=False)
            print(f"Loaded .env from: {env_path}")
        

        
        return cls(
            dump_path=Path(dump_path),
            postgres_uri=os.getenv("POSTGRES_URL") or os.getenv("DATABASE_URL", ""),
            snipeit_url=os.getenv("SNIPEIT_BASE_URL", ""),
            snipeit_token=os.getenv("SNIPEIT_API_TOKEN", ""),
            snipeit_timeout_seconds=int(os.getenv("SNIPEIT_TIMEOUT_SECONDS", "10")),
            snipeit_api_delay_ms=int(os.getenv("SNIPEIT_API_DELAY_MS", "100")),
            batch_size=int(os.getenv("MIGRATION_BATCH_SIZE", "100"))
        )
    
    def validate(self, skip_snipeit: bool = False, skip_db_validation: bool = False) -> list[str]:
        """Validate required settings and return list of errors."""
        errors = []

        if not self.dump_path.exists():
            errors.append(f"Dump file does not exist: {self.dump_path}")

        # Only validate database settings if not skipping
        if not skip_db_validation:
            if not self.postgres_uri:
                errors.append("POSTGRES_URL or DATABASE_URL environment variable is required")

        # Only validate Snipe-IT settings if not skipping
        if not skip_snipeit and not skip_db_validation:
            if not self.snipeit_url:
                errors.append("SNIPEIT_BASE_URL environment variable is required")

            if not self.snipeit_token:
                errors.append("SNIPEIT_API_TOKEN environment variable is required")

        return errors
