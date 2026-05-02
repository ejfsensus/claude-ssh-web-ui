"""
Chat API endpoints and session persistence for the web interface.
"""

import json
import logging
import uuid
from typing import Any, Dict, Optional

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel

from core.agent_console import add_console_event
from core.claude_wrapper import get_claude
from core.database import (
    create_message,
    create_session,
    delete_session,
    get_messages,
    list_sessions,
)

router = APIRouter()
logger = logging.getLogger(__name__)

# Active WebSocket connections: {connection_id: WebSocket}
active_connections: Dict[str, WebSocket] = {}

# Connection session mapping: {connection_id: session_id}
connection_sessions: Dict[str, str] = {}


class SessionCreateRequest(BaseModel):
    """Request body for creating a chat session."""

    title: str = "New Session"


def _timestamp(value: Any) -> str:
    """Return API-friendly timestamps from SQLite strings or datetimes."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return str(value)


def _json_list(value: Any) -> list:
    """Decode JSON list values stored in SQLite."""
    if isinstance(value, list):
        return value
    if not value:
        return []

    try:
        parsed = json.loads(value)
    except (TypeError, json.JSONDecodeError):
        return []

    return parsed if isinstance(parsed, list) else []


def _session_response(session: dict, message_count: Optional[int] = None) -> dict:
    response = {
        "id": session["id"],
        "title": session["title"],
        "createdAt": _timestamp(session["created_at"]),
        "lastActiveAt": _timestamp(session["last_active_at"]),
    }

    if message_count is not None:
        response["messageCount"] = message_count

    return response


def _message_response(message: dict) -> dict:
    return {
        "id": message["id"],
        "role": message["role"],
        "content": message["content"],
        "attachments": _json_list(message.get("attachments")),
        "createdAt": _timestamp(message["created_at"]),
    }


def _claude_prompt(content: str, mode: str, attachments: list) -> str:
    """Add execution mode and attachment context to the CLI prompt."""
    mode_guidance = {
        "ask": "Mode: ask. Answer the user directly and avoid changing files unless explicitly asked.",
        "plan": "Mode: plan. Produce a plan only. Do not edit files, run commands, deploy, delete, or change environment variables.",
        "execute": "Mode: execute. The user has approved this request. Continue to require confirmation before any additional destructive or deployment action not covered by the request.",
    }.get(mode, "Mode: ask. Answer the user directly and avoid changing files unless explicitly asked.")

    parts = [mode_guidance, "", content]
    if attachments:
        skill_attachments = [
            attachment for attachment in attachments
            if isinstance(attachment, dict) and attachment.get("mimeType") == "application/x-skill"
        ]
        file_attachments = [
            attachment for attachment in attachments
            if not (isinstance(attachment, dict) and attachment.get("mimeType") == "application/x-skill")
        ]

        if skill_attachments:
            parts.extend(["", "Selected skills to consider:"])
            for attachment in skill_attachments:
                name = attachment.get("name", "skill")
                path = attachment.get("path", "")
                description = attachment.get("description", "")
                parts.append(f"- {name}: {path}")
                if description:
                    parts.append(f"  Summary: {description}")

        if file_attachments:
            parts.extend(["", "Attached files available to inspect:"])

            for attachment in file_attachments:
                if isinstance(attachment, dict):
                    name = attachment.get("name", "attachment")
                    path = attachment.get("path", "")
                    size = attachment.get("size")
                    size_label = f", size: {size} bytes" if isinstance(size, int) else ""
                    parts.append(f"- {name}: {path}{size_label}")
                else:
                    parts.append(f"- {attachment}")

    return "\n".join(parts)


@router.get("/sessions")
async def list_sessions_api(limit: int = 50):
    """List all sessions."""
    sessions = list_sessions(limit=limit)

    return {
        "sessions": [
            _session_response(session, message_count=len(get_messages(session["id"])))
            for session in sessions
        ]
    }


@router.post("/sessions")
async def create_session_api(payload: Optional[SessionCreateRequest] = None):
    """Create a new session."""
    session = create_session(str(uuid.uuid4()), payload.title if payload else "New Session")
    return {"session": _session_response(session)}


@router.get("/sessions/{session_id}")
async def get_session_api(session_id: str):
    """Get a session by ID."""
    from core.database import get_session

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return {"session": _session_response(session)}


@router.delete("/sessions/{session_id}")
async def delete_session_api(session_id: str):
    """Delete a session and its messages."""
    from core.database import get_session

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    delete_session(session_id)
    return {"deleted": True}


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, limit: int = 100):
    """Get messages for a session."""
    from core.database import get_session

    session = get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = get_messages(session_id, limit=limit)
    return {"messages": [_message_response(message) for message in messages]}


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for streaming chat.

    Client sends:
    {"type": "message", "content": "text", "sessionId": "uuid", "attachments": []}

    Server sends:
    {"type": "token", "content": "word", "sessionId": "uuid"}
    {"type": "error", "message": "error text"}
    {"type": "done", "sessionId": "uuid"}
    """
    await websocket.accept()

    connection_id = str(uuid.uuid4())
    active_connections[connection_id] = websocket
    logger.info("WebSocket connection established: %s", connection_id)
    add_console_event("websocket", "WebSocket connected", metadata={"connectionId": connection_id})

    try:
        await websocket.send_json({
            "type": "connected",
            "connectionId": connection_id,
        })

        while True:
            data = await websocket.receive_json()
            message_type = data.get("type")

            if message_type == "message":
                content = data.get("content", "")
                session_id = data.get("sessionId")
                attachments = data.get("attachments", [])
                mode = data.get("mode", "ask")
                client_action_id = data.get("clientActionId")
                approved = data.get("approved", False)

                if not content:
                    add_console_event("chat", "Rejected empty message", level="warning")
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message content is required",
                        "clientActionId": client_action_id,
                    })
                    continue

                if mode == "execute" and not approved:
                    add_console_event(
                        "approval",
                        "Execute request waiting for approval",
                        level="warning",
                        metadata={"clientActionId": client_action_id, "sessionId": session_id},
                    )
                    await websocket.send_json({
                        "type": "needs_approval",
                        "message": "Confirm this execute-mode request before it reaches Claude Code.",
                        "sessionId": session_id,
                        "clientActionId": client_action_id,
                    })
                    continue

                if not session_id:
                    session = create_session(str(uuid.uuid4()), "New Chat")
                    session_id = session["id"]
                    connection_sessions[connection_id] = session_id

                    await websocket.send_json({
                        "type": "session_created",
                        "sessionId": session_id,
                        "clientActionId": client_action_id,
                    })
                    add_console_event("session", "Session created", metadata={"sessionId": session_id})

                create_message(session_id, "user", content, attachments)
                add_console_event(
                    "chat",
                    f"Message received in {mode} mode",
                    metadata={
                        "sessionId": session_id,
                        "clientActionId": client_action_id,
                        "attachments": len(attachments) if isinstance(attachments, list) else 0,
                    },
                )

                claude = await get_claude()
                response_buffer = ""
                await websocket.send_json({
                    "type": "thinking",
                    "mode": mode,
                    "sessionId": session_id,
                    "clientActionId": client_action_id,
                })
                add_console_event("agent", "Claude Code thinking", metadata={"sessionId": session_id})

                prompt = _claude_prompt(content, mode, attachments)
                stream_started = False

                async for token in claude.stream_response(prompt, session_id):
                    response_buffer += token
                    if not stream_started:
                        stream_started = True
                        add_console_event("agent", "Claude Code streaming response", metadata={"sessionId": session_id})
                    await websocket.send_json({
                        "type": "token",
                        "content": token,
                        "sessionId": session_id,
                        "clientActionId": client_action_id,
                    })

                create_message(session_id, "assistant", response_buffer, [])
                add_console_event(
                    "agent",
                    "Response complete",
                    level="success",
                    metadata={"sessionId": session_id, "characters": len(response_buffer)},
                )

                await websocket.send_json({
                    "type": "done",
                    "sessionId": session_id,
                    "clientActionId": client_action_id,
                })

            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})

            else:
                add_console_event("websocket", f"Unknown message type: {message_type}", level="warning")
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}",
                    "clientActionId": data.get("clientActionId"),
                })

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected: %s", connection_id)
        add_console_event("websocket", "WebSocket disconnected", metadata={"connectionId": connection_id})

    except Exception as e:
        logger.error("WebSocket error: %s", e, exc_info=True)
        add_console_event("websocket", "WebSocket error", level="error", detail=str(e))

        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
            })
        except Exception:
            pass

    finally:
        active_connections.pop(connection_id, None)
        connection_sessions.pop(connection_id, None)
        logger.info("WebSocket connection cleaned up: %s", connection_id)
