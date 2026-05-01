"""
Chat API endpoints - WebSocket for streaming chat.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException, status
from typing import Dict, Set
import json
import logging
import uuid
from datetime import datetime

from core.security import get_current_user
from core.claude_wrapper import get_claude
from core.database import create_session, create_message, get_messages

router = APIRouter()
logger = logging.getLogger(__name__)

# Active WebSocket connections: {connection_id: WebSocket}
active_connections: Dict[str, WebSocket] = {}

# Connection session mapping: {connection_id: session_id}
connection_sessions: Dict[str, str] = {}


@router.get("/sessions")
async def list_sessions_api(limit: int = 50):
    """List all sessions."""
    from core.database import list_sessions

    sessions = await list_sessions(limit=limit)

    return {
        "sessions": [
            {
                "id": s.id,
                "title": s.title,
                "createdAt": s.createdAt.isoformat(),
                "lastActiveAt": s.lastActiveAt.isoformat(),
                "messageCount": len(await get_messages(s.id))
            }
            for s in sessions
        ]
    }


@router.post("/sessions")
async def create_session_api(title: str = "New Session"):
    """Create a new session."""
    session_id = str(uuid.uuid4())
    session = await create_session(session_id, title)

    return {
        "session": {
            "id": session.id,
            "title": session.title,
            "createdAt": session.createdAt.isoformat(),
            "lastActiveAt": session.lastActiveAt.isoformat(),
        }
    }


@router.get("/sessions/{session_id}/messages")
async def get_session_messages(session_id: str, limit: int = 100):
    """Get messages for a session."""
    from core.database import get_session

    session = await get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = await get_messages(session_id, limit=limit)

    return {
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "attachments": m.attachments,
                "createdAt": m.createdAt.isoformat(),
            }
            for m in messages
        ]
    }


@router.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    """
    WebSocket endpoint for streaming chat.

    Client sends:
    {"type": "message", "content": "text", "sessionId": "uuid", "attachments": []}

    Server sends:
    {"type": "token", "content": "word", "sessionId": "uuid"}
    {"type": "tool_use", "tool": "name", "input": {}}
    {"type": "error", "message": "error text"}
    {"type": "done", "sessionId": "uuid"}
    """
    await websocket.accept()

    # Generate connection ID
    connection_id = str(uuid.uuid4())
    active_connections[connection_id] = websocket

    logger.info(f"WebSocket connection established: {connection_id}")

    try:
        # Send connection confirmation
        await websocket.send_json({
            "type": "connected",
            "connectionId": connection_id
        })

        while True:
            # Receive message from client
            data = await websocket.receive_json()

            message_type = data.get("type")

            if message_type == "message":
                content = data.get("content", "")
                session_id = data.get("sessionId")
                attachments = data.get("attachments", [])

                if not content:
                    await websocket.send_json({
                        "type": "error",
                        "message": "Message content is required"
                    })
                    continue

                # Create session if not provided
                if not session_id:
                    from core.database import create_session
                    session = await create_session(str(uuid.uuid4()), "New Chat")
                    session_id = session.id
                    connection_sessions[connection_id] = session_id

                    # Notify client of new session
                    await websocket.send_json({
                        "type": "session_created",
                        "sessionId": session_id
                    })

                # Save user message to database
                await create_message(
                    session_id,
                    "user",
                    content,
                    attachments
                )

                # Stream Claude's response
                claude = await get_claude()

                response_buffer = ""
                async for token in claude.stream_response(content, session_id):
                    response_buffer += token

                    # Send token to client
                    await websocket.send_json({
                        "type": "token",
                        "content": token,
                        "sessionId": session_id
                    })

                # Save assistant message to database
                await create_message(
                    session_id,
                    "assistant",
                    response_buffer,
                    []
                )

                # Send completion signal
                await websocket.send_json({
                    "type": "done",
                    "sessionId": session_id
                })

            elif message_type == "ping":
                # Heartbeat
                await websocket.send_json({"type": "pong"})

            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                })

    except WebSocketDisconnect:
        logger.info(f"WebSocket disconnected: {connection_id}")

    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)

        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass

    finally:
        # Clean up connection
        if connection_id in active_connections:
            del active_connections[connection_id]
        if connection_id in connection_sessions:
            del connection_sessions[connection_id]

        logger.info(f"WebSocket connection cleaned up: {connection_id}")
