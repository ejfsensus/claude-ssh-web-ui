"""
Configuration and environment variables for Claude SSH Web UI.
"""

import os
from typing import List
from pathlib import Path

from dotenv import load_dotenv


load_dotenv("/data/web-ui/.env")


class Settings:
    """Application settings."""

    # Application
    APP_NAME: str = "Claude SSH Web UI"
    DEBUG: bool = False
    VERSION: str = "1.0.0"

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = int(os.getenv("PORT", "8080"))

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
    WEB_UI_DATA_DIR: str = os.getenv("WEB_UI_DATA_DIR", "/data/web-ui")
    DATABASE_URL: str = f"sqlite+aiosqlite:///{WEB_UI_DATA_DIR}/sessions.db"
    DATA_VOLUME_DIR: str = os.getenv("DATA_VOLUME_DIR", "/data")

    # File storage
    UPLOAD_DIR: Path = Path(WEB_UI_DATA_DIR) / "uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB

    # Deepgram Voice Agent
    DEEPGRAM_API_KEY: str = os.getenv("DEEPGRAM_API_KEY", "")
    DEEPGRAM_VOICE_AGENT_URL: str = os.getenv(
        "DEEPGRAM_VOICE_AGENT_URL",
        "wss://api.eu.deepgram.com/v1/agent/converse",
    )
    DEEPGRAM_LISTEN_MODEL: str = os.getenv("DEEPGRAM_LISTEN_MODEL", "nova-3")
    DEEPGRAM_THINK_PROVIDER: str = os.getenv("DEEPGRAM_THINK_PROVIDER", "open_ai")
    DEEPGRAM_THINK_MODEL: str = os.getenv("DEEPGRAM_THINK_MODEL", "gpt-4o-mini")
    DEEPGRAM_SPEAK_MODEL: str = os.getenv("DEEPGRAM_SPEAK_MODEL", "aura-2-thalia-en")
    DEEPGRAM_VOICE_SAMPLE_RATE: int = int(os.getenv("DEEPGRAM_VOICE_SAMPLE_RATE", "24000"))
    DEEPGRAM_VOICE_PROMPT: str = os.getenv(
        "DEEPGRAM_VOICE_PROMPT",
        (
            "You are the live voice intake layer for a personal Claude Code agent. "
            "Keep spoken replies concise, clarify ambiguous requests, and gather the "
            "files, constraints, preferred mode, risks, and desired outcome needed for "
            "a clean handoff to Claude Code."
        ),
    )
    DEEPGRAM_VOICE_GREETING: str = os.getenv(
        "DEEPGRAM_VOICE_GREETING",
        "Voice mode is online. What should we work through?",
    )

    # Claude Code CLI
    CLAUDE_BINARY: str = os.getenv("CLAUDE_BINARY", "/data/home/.local/bin/claude")
    CLAUDE_WORKSPACE: str = os.getenv("CLAUDE_WORKSPACE", "/workspace")
    SKILLS_ROOTS: str = os.getenv(
        "SKILLS_ROOTS",
        ":".join([
            "/skills",
            "/home/claude/.agents/skills",
            "/home/claude/.claude/skills",
            "/home/claude/.codex/skills",
            "/workspace/skills",
            "/workspace/.agents/skills",
            "/workspace/.claude/skills",
            "/workspace/.codex/skills",
            "/data/skills",
        ]),
    )
    MCP_CONFIG_PATHS: str = os.getenv(
        "MCP_CONFIG_PATHS",
        ":".join([
            "/workspace/.mcp.json",
            "/workspace/.claude.json",
            "/home/claude/.claude.json",
            "/home/claude/.config/claude/mcp.json",
        ]),
    )

    # Frontend
    FRONTEND_BUILD_PATH: str = os.getenv(
        "FRONTEND_BUILD_PATH",
        "/home/claude/web-ui/frontend/out",
    )

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
