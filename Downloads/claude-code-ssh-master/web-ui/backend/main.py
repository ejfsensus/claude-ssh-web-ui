#!/usr/bin/env python3
"""
FastAPI backend for Claude SSH web interface.
Wraps Claude Code CLI with WebSocket streaming and REST API.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
from pathlib import Path

from core.config import settings
from core.claude_wrapper import get_claude
from api.chat import router as chat_router
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
    web_ui_root = Path(settings.WEB_UI_DATA_DIR)
    web_ui_dirs = [
        web_ui_root,
        web_ui_root / "uploads",
        web_ui_root / "sessions",
        web_ui_root / "audio",
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
app.include_router(files_router, prefix="/api", tags=["files"])
app.include_router(processes_router, prefix="/api", tags=["processes"])

# Mount static files from the Next.js export.
#
# Next's static export emits assets under out/_next, not out/static. Mounting a
# missing out/static directory raises at import time, which prevents uvicorn from
# binding port 8080 and makes Railway report that the application failed to
# respond.
frontend_build_path = Path(settings.FRONTEND_BUILD_PATH)
frontend_next_path = frontend_build_path / "_next"
if frontend_next_path.exists():
    app.mount("/_next", StaticFiles(directory=str(frontend_next_path)), name="next-assets")
    logger.info(f"Serving Next.js assets from {frontend_next_path}")
else:
    logger.warning(f"Next.js asset directory not found at {frontend_next_path}")


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "claude-ssh-web-ui",
        "version": "1.0.0"
    }


@app.get("/api/status")
async def status_check():
    """Runtime status for the personal agent interface."""
    claude = await get_claude()
    claude_available = await claude.is_available()
    workspace = Path(settings.CLAUDE_WORKSPACE)

    return {
        "status": "ready" if claude_available else "degraded",
        "service": "claude-ssh-web-ui",
        "version": "1.0.0",
        "agent": {
            "name": "Claude Code",
            "available": claude_available,
        },
        "workspace": {
            "path": str(workspace),
            "exists": workspace.exists(),
        },
        "features": {
            "chat": True,
            "uploads": True,
            "workspacePreview": True,
            "voice": False,
            "mutationsRequireConfirmation": True,
        },
    }


@app.get("/")
async def root():
    """Root endpoint - serve frontend."""
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


@app.get("/{full_path:path}", include_in_schema=False)
async def serve_frontend_asset_or_app(full_path: str):
    """Serve exported frontend files and fall back to the app shell."""
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API route not found")

    if frontend_build_path.exists():
        requested_path = (frontend_build_path / full_path).resolve()
        build_root = frontend_build_path.resolve()

        try:
            requested_path.relative_to(build_root)
        except ValueError:
            raise HTTPException(status_code=404, detail="File not found")

        if requested_path.is_file():
            return FileResponse(requested_path)

        index_file = frontend_build_path / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend not built")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8080,
        reload=settings.DEBUG,
        log_level="info"
    )
