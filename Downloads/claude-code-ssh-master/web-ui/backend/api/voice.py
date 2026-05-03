"""
Deepgram Voice Agent bridge and transcript handoff endpoints.
"""

import asyncio
from datetime import datetime
import json
import logging
from typing import Any, Dict, List, Literal, Optional
import uuid

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field
import websockets
from websockets.exceptions import ConnectionClosed

from core.agent_console import add_console_event
from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

KEEPALIVE_SECONDS = 5
MAX_TRANSCRIPT_CHARS = 18000
MAX_TRANSCRIPT_TURNS = 120


class TranscriptEntry(BaseModel):
    """Single transcript turn captured by the browser voice UI."""

    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1, max_length=4000)
    createdAt: Optional[str] = None


class VoiceHandoffRequest(BaseModel):
    """Voice transcript handoff request."""

    transcript: List[TranscriptEntry] = Field(min_length=1, max_length=MAX_TRANSCRIPT_TURNS)
    sessionId: Optional[str] = None


def _deepgram_settings() -> Dict[str, Any]:
    """Build the Voice Agent Settings message sent before audio frames."""
    sample_rate = settings.DEEPGRAM_VOICE_SAMPLE_RATE
    return {
        "type": "Settings",
        "tags": ["claude_code_ssh", "agent_studio", "voice_handoff"],
        "audio": {
            "input": {
                "encoding": "linear16",
                "sample_rate": sample_rate,
            },
            "output": {
                "encoding": "linear16",
                "sample_rate": sample_rate,
                "container": "none",
            },
        },
        "agent": {
            "language": "en",
            "listen": {
                "provider": {
                    "type": "deepgram",
                    "model": settings.DEEPGRAM_LISTEN_MODEL,
                    "smart_format": False,
                },
            },
            "think": {
                "provider": {
                    "type": settings.DEEPGRAM_THINK_PROVIDER,
                    "model": settings.DEEPGRAM_THINK_MODEL,
                    "temperature": 0.5,
                },
                "prompt": settings.DEEPGRAM_VOICE_PROMPT,
            },
            "speak": {
                "provider": {
                    "type": "deepgram",
                    "model": settings.DEEPGRAM_SPEAK_MODEL,
                },
            },
            "greeting": settings.DEEPGRAM_VOICE_GREETING,
        },
    }


def _state_for_event(event_type: str) -> Optional[str]:
    """Map Deepgram event names to compact client state names."""
    return {
        "Welcome": "ready",
        "SettingsApplied": "listening",
        "UserStartedSpeaking": "listening",
        "AgentThinking": "thinking",
        "AgentStartedSpeaking": "speaking",
        "AgentAudioDone": "listening",
    }.get(event_type)


def _client_event(event: Dict[str, Any]) -> Dict[str, Any]:
    """Normalize Deepgram JSON events for the browser UI while retaining raw data."""
    event_type = str(event.get("type", "Unknown"))

    if event_type == "ConversationText":
        return {
            "type": "conversation_text",
            "role": event.get("role", "assistant"),
            "content": event.get("content", ""),
            "event": event,
        }

    if event_type in {"Error", "AgentError"}:
        return {
            "type": "voice_error",
            "message": event.get("description") or event.get("message") or "Deepgram voice error",
            "event": event,
        }

    state = _state_for_event(event_type)
    if state:
        return {
            "type": "voice_state",
            "state": state,
            "event": event,
        }

    return {
        "type": "deepgram_event",
        "event": event,
    }


async def _safe_send_json(websocket: WebSocket, payload: Dict[str, Any]) -> None:
    try:
        await websocket.send_json(payload)
    except RuntimeError:
        pass


@router.websocket("/ws/voice")
async def websocket_voice(websocket: WebSocket):
    """
    Browser-to-Deepgram Voice Agent bridge.

    The browser sends 24 kHz linear16 PCM frames as binary WebSocket messages.
    This backend owns the Deepgram API key, forwards media to Deepgram, and
    relays JSON events plus raw output audio back to the browser.
    """
    await websocket.accept()

    if not settings.DEEPGRAM_API_KEY:
        await websocket.send_json({
            "type": "voice_error",
            "message": "DEEPGRAM_API_KEY is not configured on the server.",
        })
        await websocket.close(code=1011)
        return

    connection_id = str(uuid.uuid4())
    add_console_event(
        "voice",
        "Voice bridge connected",
        metadata={"connectionId": connection_id},
    )

    try:
        async with websockets.connect(
            settings.DEEPGRAM_VOICE_AGENT_URL,
            extra_headers={"Authorization": f"Token {settings.DEEPGRAM_API_KEY}"},
            max_size=None,
            ping_interval=20,
        ) as deepgram_ws:
            await deepgram_ws.send(json.dumps(_deepgram_settings()))
            await websocket.send_json({
                "type": "voice_ready",
                "connectionId": connection_id,
                "sampleRate": settings.DEEPGRAM_VOICE_SAMPLE_RATE,
            })

            stop_event = asyncio.Event()

            async def client_to_deepgram() -> None:
                try:
                    while not stop_event.is_set():
                        message = await websocket.receive()
                        if message.get("type") == "websocket.disconnect":
                            break

                        audio = message.get("bytes")
                        if audio:
                            await deepgram_ws.send(audio)
                            continue

                        text = message.get("text")
                        if not text:
                            continue

                        try:
                            payload = json.loads(text)
                        except json.JSONDecodeError:
                            continue

                        if payload.get("type") == "close":
                            break
                finally:
                    stop_event.set()

            async def deepgram_to_client() -> None:
                try:
                    while not stop_event.is_set():
                        deepgram_message = await deepgram_ws.recv()
                        if isinstance(deepgram_message, bytes):
                            await websocket.send_bytes(deepgram_message)
                            continue

                        try:
                            event = json.loads(deepgram_message)
                        except json.JSONDecodeError:
                            event = {"type": "Unknown", "raw": deepgram_message}

                        await _safe_send_json(websocket, _client_event(event))
                finally:
                    stop_event.set()

            async def keepalive() -> None:
                try:
                    while not stop_event.is_set():
                        await asyncio.sleep(KEEPALIVE_SECONDS)
                        if not stop_event.is_set():
                            await deepgram_ws.send(json.dumps({"type": "KeepAlive"}))
                finally:
                    stop_event.set()

            tasks = [
                asyncio.create_task(client_to_deepgram()),
                asyncio.create_task(deepgram_to_client()),
                asyncio.create_task(keepalive()),
            ]
            done, pending = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            stop_event.set()

            for task in pending:
                task.cancel()
            await asyncio.gather(*pending, return_exceptions=True)

            for task in done:
                if task.cancelled():
                    continue
                error = task.exception()
                if error and not isinstance(error, (WebSocketDisconnect, ConnectionClosed)):
                    raise error

    except WebSocketDisconnect:
        add_console_event(
            "voice",
            "Voice bridge disconnected",
            metadata={"connectionId": connection_id},
        )
    except ConnectionClosed as exc:
        add_console_event(
            "voice",
            "Deepgram voice connection closed",
            level="warning",
            detail=str(exc),
            metadata={"connectionId": connection_id},
        )
        await _safe_send_json(websocket, {
            "type": "voice_error",
            "message": "Deepgram voice connection closed.",
        })
    except Exception as exc:
        logger.error("Voice bridge error: %s", exc, exc_info=True)
        add_console_event(
            "voice",
            "Voice bridge error",
            level="error",
            detail=str(exc),
            metadata={"connectionId": connection_id},
        )
        await _safe_send_json(websocket, {
            "type": "voice_error",
            "message": str(exc),
        })
    finally:
        add_console_event(
            "voice",
            "Voice bridge cleaned up",
            metadata={"connectionId": connection_id},
        )


def _handoff_prompt(entries: List[TranscriptEntry]) -> str:
    """Create the Claude Code prompt for a completed voice conversation."""
    transcript_lines = []
    total = 0

    for entry in entries:
        clean_content = " ".join(entry.content.split())
        if not clean_content:
            continue

        line = f"{entry.role.upper()}: {clean_content}"
        if total + len(line) > MAX_TRANSCRIPT_CHARS:
            remaining = max(0, MAX_TRANSCRIPT_CHARS - total)
            if remaining > 40:
                transcript_lines.append(line[:remaining] + "...")
            break

        transcript_lines.append(line)
        total += len(line) + 1

    transcript = "\n".join(transcript_lines)
    captured_at = datetime.utcnow().isoformat()

    return "\n".join([
        "Voice handoff from the Deepgram Voice Agent.",
        "",
        "Summarize the conversation briefly, extract concrete tasks, identify constraints or required context, then proceed in execute mode on the user's requested work.",
        "Before acting, inspect relevant local files, configured skills, MCP servers, and environment details if they matter.",
        "Continue to require explicit confirmation for destructive actions, credential changes, deployments, or anything that would materially affect external systems.",
        "",
        f"Captured at UTC: {captured_at}",
        "",
        "Transcript:",
        transcript,
    ])


@router.post("/voice/handoff")
async def create_voice_handoff(payload: VoiceHandoffRequest):
    """Return a backend-generated Claude Code prompt from a voice transcript."""
    prompt = _handoff_prompt(payload.transcript)
    if not prompt.strip():
        raise HTTPException(status_code=400, detail="Transcript is empty")

    add_console_event(
        "voice",
        "Voice transcript prepared for handoff",
        level="success",
        metadata={
            "sessionId": payload.sessionId,
            "turns": len(payload.transcript),
            "characters": len(prompt),
        },
    )

    return {
        "prompt": prompt,
        "turnCount": len(payload.transcript),
        "createdAt": datetime.utcnow().isoformat(),
    }
