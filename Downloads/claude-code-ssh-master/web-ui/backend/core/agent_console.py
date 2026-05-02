"""
In-memory agent console event buffer.

This is intentionally read-only from the public API. It gives the web UI a
faithful activity trace for backend-managed events without exposing an
interactive terminal.
"""

from collections import deque
from datetime import datetime
import uuid
from typing import Any, Deque, Dict, List, Optional

MAX_EVENTS = 240

_events: Deque[dict] = deque(maxlen=MAX_EVENTS)


def add_console_event(
    kind: str,
    label: str,
    level: str = "info",
    detail: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> dict:
    """Append a console event and return the API-ready payload."""
    event = {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "level": level,
        "label": label,
        "detail": detail,
        "metadata": metadata or {},
        "createdAt": datetime.utcnow().isoformat(),
    }
    _events.appendleft(event)
    return event


def list_console_events(limit: int = 100) -> List[dict]:
    """Return recent console events, newest first."""
    safe_limit = max(1, min(limit, MAX_EVENTS))
    return list(_events)[:safe_limit]
