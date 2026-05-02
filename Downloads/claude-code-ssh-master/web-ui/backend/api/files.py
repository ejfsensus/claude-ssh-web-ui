"""
Files and workspace API endpoints.
"""

from datetime import datetime
import mimetypes
from pathlib import Path
import re
import uuid

from fastapi import APIRouter, File, HTTPException, Query, UploadFile

from core.agent_console import add_console_event
from core.config import settings

router = APIRouter()

MAX_TEXT_PREVIEW_SIZE = 1024 * 1024
MAX_UPLOAD_SIZE = settings.MAX_UPLOAD_SIZE


def _workspace_root() -> Path:
    return Path(settings.CLAUDE_WORKSPACE).resolve()


def _safe_workspace_path(path: str = "") -> Path:
    root = _workspace_root()
    candidate = (root / path.lstrip("/")).resolve()

    try:
        candidate.relative_to(root)
    except ValueError:
        raise HTTPException(status_code=400, detail="Path must stay inside the workspace")

    return candidate


def _relative_workspace_path(path: Path) -> str:
    relative = path.resolve().relative_to(_workspace_root())
    return "" if str(relative) == "." else str(relative)


def _file_response(path: Path) -> dict:
    stat = path.stat()
    return {
        "name": path.name,
        "path": _relative_workspace_path(path),
        "type": "directory" if path.is_dir() else "file",
        "size": 0 if path.is_dir() else stat.st_size,
        "modifiedAt": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
        "mimeType": None if path.is_dir() else mimetypes.guess_type(path.name)[0],
    }


def _safe_upload_name(filename: str) -> str:
    name = Path(filename or "upload").name
    sanitized = re.sub(r"[^A-Za-z0-9._-]+", "-", name).strip(".-")
    return sanitized or "upload"


@router.post("/files/upload")
async def upload_file(file: UploadFile = File(...)):
    """Upload a file into persistent web UI storage."""
    upload_dir = settings.UPLOAD_DIR
    upload_dir.mkdir(parents=True, exist_ok=True)

    file_id = str(uuid.uuid4())
    original_name = _safe_upload_name(file.filename or file_id)
    stored_name = f"{file_id}-{original_name}"
    destination = upload_dir / stored_name

    size = 0
    with destination.open("wb") as output:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > MAX_UPLOAD_SIZE:
                destination.unlink(missing_ok=True)
                raise HTTPException(status_code=413, detail="Upload is too large")
            output.write(chunk)

    response = {
        "file": {
            "id": file_id,
            "name": original_name,
            "path": str(destination),
            "size": size,
            "mimeType": file.content_type or mimetypes.guess_type(original_name)[0],
            "uploadedAt": datetime.utcnow().isoformat(),
        }
    }
    add_console_event(
        kind="files",
        label=f"File uploaded: {original_name}",
        level="success",
        metadata={"size": size, "path": str(destination)},
    )
    return response


@router.get("/files/list")
async def list_files(path: str = ""):
    """List workspace files for backwards compatibility with the frontend."""
    return await workspace_tree(path=path)


@router.get("/workspace/tree")
async def workspace_tree(path: str = ""):
    """List direct children for a workspace directory."""
    directory = _safe_workspace_path(path)
    if not directory.exists():
        raise HTTPException(status_code=404, detail="Path not found")
    if not directory.is_dir():
        raise HTTPException(status_code=400, detail="Path is not a directory")

    children = []
    for child in sorted(directory.iterdir(), key=lambda item: (not item.is_dir(), item.name.lower())):
        if child.name.startswith(".git"):
            continue
        children.append(_file_response(child))

    return {
        "path": _relative_workspace_path(directory),
        "files": children,
    }


@router.get("/workspace/file")
async def workspace_file(path: str = Query(..., min_length=1)):
    """Preview a text file from the workspace."""
    target = _safe_workspace_path(path)
    if not target.exists():
        raise HTTPException(status_code=404, detail="File not found")
    if not target.is_file():
        raise HTTPException(status_code=400, detail="Path is not a file")
    if target.stat().st_size > MAX_TEXT_PREVIEW_SIZE:
        raise HTTPException(status_code=413, detail="File is too large to preview")

    data = target.read_bytes()
    if b"\x00" in data:
        raise HTTPException(status_code=415, detail="Binary files cannot be previewed")

    try:
        content = data.decode("utf-8")
    except UnicodeDecodeError:
        content = data.decode("utf-8", errors="replace")

    return {
        "file": {
            **_file_response(target),
            "content": content,
        }
    }


@router.delete("/files/{file_path:path}")
async def delete_file(file_path: str):
    """Reject destructive file deletion until approval plumbing exists."""
    raise HTTPException(status_code=405, detail="Delete requires an approved agent action")
