"""
Configuration and environment variables for Claude SSH Web UI.
"""

import os
from typing import List
from pathlib import Path


class Settings:
    """Application settings."""

    # Application
    APP_NAME: str = "Claude SSH Web UI"
    DEBUG: bool = False
    VERSION: str = "1.0.0"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8080

    # CORS
    ALLOWED_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://localhost:8080",
    ]

    # Railway-specific
    RAILWAY_ENVIRONMENT: str = os.getenv("RAILWAY_ENVIRONMENT", "development")
    RAILWAY_PUBLIC_DOMAIN: str = os.getenv("RAILWAY_PUBLIC_DOMAIN", "")

    # Authentication
    WEB_UI_PASSWORD: str = os.getenv("WEB_UI_PASSWORD", "")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "change-this-in-production")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # Database
    DATABASE_URL: str = "sqlite+aiosqlite:///data/web-ui/sessions.db"

    # File storage
    UPLOAD_DIR: Path = Path("/data/web-ui/uploads")
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB

    # Claude Code CLI
    CLAUDE_BINARY: str = "/home/claude/.local/bin/claude"
    CLAUDE_WORKSPACE: str = "/workspace"

    # Rate limiting
    RATE_LIMIT_REQUESTS: int = 1000
    RATE_LIMIT_PERIOD: int = 3600  # 1 hour

    # WebSocket
    WS_MESSAGE_QUEUE_SIZE: int = 100
    WS_MAX_CONNECTIONS: int = 50

    def __init__(self):
        # Update ALLOWED_ORIGINS if Railway domain is available
        if self.RAILWAY_PUBLIC_DOMAIN:
            railway_url = f"https://{self.RAILWAY_PUBLIC_DOMAIN}"
            if railway_url not in self.ALLOWED_ORIGINS:
                self.ALLOWED_ORIGINS.append(railway_url)


# Create settings instance
settings = Settings()
