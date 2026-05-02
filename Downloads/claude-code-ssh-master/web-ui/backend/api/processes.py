"""
Processes API endpoints.

Process execution is intentionally disabled from the REST API until it can be
bound to the same explicit approval flow used by execute-mode chat requests.
"""

from fastapi import APIRouter, HTTPException

from core.database import get_active_processes

router = APIRouter()


def _process_response(process: dict) -> dict:
    return {
        "id": process["id"],
        "name": process["name"],
        "command": process.get("command"),
        "sessionId": process.get("session_id"),
        "status": process["status"],
        "output": process.get("output"),
        "createdAt": str(process.get("created_at")),
    }


@router.get("/processes")
async def list_processes():
    """List active background process records."""
    return {"processes": [_process_response(process) for process in get_active_processes()]}


@router.post("/processes/start")
async def start_process():
    """Reject process starts until explicit approval routing is available."""
    raise HTTPException(status_code=405, detail="Process start requires an approved agent action")


@router.get("/processes/{process_id}")
async def get_process(process_id: str):
    """Process detail lookup is not available in this V1 surface."""
    raise HTTPException(status_code=404, detail=f"Process not found: {process_id}")


@router.delete("/processes/{process_id}")
async def stop_process(process_id: str):
    """Reject process stops until explicit approval routing is available."""
    raise HTTPException(status_code=405, detail="Process stop requires an approved agent action")
