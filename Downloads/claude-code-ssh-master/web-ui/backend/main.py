#!/usr/bin/env python3
"""
FastAPI backend for Claude SSH web interface.
Wraps Claude Code CLI with WebSocket streaming and REST API.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from typing import Dict
from pathlib import Path

from core.config import settings
from core.security import get_password_hash, verify_password, create_access_token
from api.chat import router as chat_router
from api.sessions import router as sessions_router
from api.files import router as files_router
from api.processes import router as processes_router

# Logging setup
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager."""
    logger.info("Starting Claude SSH Web UI backend...")
    # Initialize database
    from core.database import init_db
    init_db()
    logger.info("Database initialized")

    # Initialize web-ui directories
    from pathlib import Path
    web_ui_dirs = [
        Path("/data/web-ui"),
        Path("/data/web-ui/uploads"),
        Path("/data/web-ui/sessions"),
        Path("/data/web-ui/audio"),
    ]
    for dir_path in web_ui_dirs:
        dir_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"Ensured directory exists: {dir_path}")

    yield

    logger.info("Shutting down Claude SSH Web UI backend...")


# Create FastAPI app
app = FastAPI(
    title="Claude SSH Web UI",
    description="Web interface for Claude Code CLI",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Include routers
app.include_router(chat_router, prefix="/api", tags=["chat"])
app.include_router(sessions_router, prefix="/api", tags=["sessions"])
app.include_router(files_router, prefix="/api", tags=["files"])
app.include_router(processes_router, prefix="/api", tags=["processes"])

# Mount static files from Next.js build
frontend_build_path = Path("/home/claude/web-ui/frontend/out")
if frontend_build_path.exists():
    app.mount("/static", StaticFiles(directory=str(frontend_build_path / "static")), name="static")
    logger.info(f"Serving static files from {frontend_build_path}")
else:
    logger.warning(f"Frontend build not found at {frontend_build_path}")


# Active WebSocket connections
active_connections: Dict[str, WebSocket] = {}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "claude-ssh-web-ui",
        "version": "1.0.0"
    }


@app.get("/")
async def root():
    """Root endpoint - serve frontend."""
    frontend_build_path = Path("/home/claude/web-ui/frontend/out")
    index_file = frontend_build_path / "index.html"

    if index_file.exists():
        return FileResponse(index_file)
    else:
        return {
            "name": "Claude SSH Web UI API",
            "version": "1.0.0",
            "docs": "/docs",
            "health": "/api/health",
            "status": "frontend_not_built"
        }


@app.get("/api")
async def api_info():
    """API info endpoint."""
    return {
        "name": "Claude SSH Web UI API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=settings.DEBUG,
        log_level="info"
    )
