"""
Database connection and models using SQLite.
"""

import sqlite3
import logging
import json
from typing import Optional, List
from datetime import datetime
from pathlib import Path

logger = logging.getLogger(__name__)

# Database path
DB_PATH = "/data/web-ui/sessions.db"


def get_db():
    """Get database connection."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize database and create tables."""
    Path(DB_PATH).parent.mkdir(parents=True, exist_ok=True)

    conn = get_db()
    cursor = conn.cursor()

    # Create sessions table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_active_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Create messages table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL,
            attachments TEXT DEFAULT '[]',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (session_id) REFERENCES sessions (id) ON DELETE CASCADE
        )
    """)

    # Create processes table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS processes (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            command TEXT,
            session_id TEXT,
            status TEXT NOT NULL,
            output TEXT,
            exit_code INTEGER,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    conn.commit()
    conn.close()

    logger.info("Database initialized successfully")


# Session operations
def create_session(session_id: str, title: str = "New Session"):
    """Create a new session."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "INSERT INTO sessions (id, title, created_at, last_active_at) VALUES (?, ?, ?, ?)",
        (session_id, title, datetime.utcnow(), datetime.utcnow())
    )

    conn.commit()
    conn.close()

    logger.info(f"Created session: {session_id}")

    return {
        "id": session_id,
        "title": title,
        "createdAt": datetime.utcnow().isoformat(),
        "lastActiveAt": datetime.utcnow().isoformat()
    }


def get_session(session_id: str) -> Optional[dict]:
    """Get a session by ID."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM sessions WHERE id = ?", (session_id,))
    row = cursor.fetchone()

    conn.close()

    if row:
        return dict(row)
    return None


def list_sessions(limit: int = 50) -> List[dict]:
    """List all sessions."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "SELECT * FROM sessions ORDER BY last_active_at DESC LIMIT ?",
        (limit,)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages."""
    conn = get_db()
    cursor = conn.cursor()

    # Delete associated messages first
    cursor.execute("DELETE FROM messages WHERE session_id = ?", (session_id,))

    # Delete the session
    cursor.execute("DELETE FROM sessions WHERE id = ?", (session_id,))

    conn.commit()
    conn.close()

    logger.info(f"Deleted session: {session_id}")
    return True


def update_session_activity(session_id: str):
    """Update session last active timestamp."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        "UPDATE sessions SET last_active_at = ? WHERE id = ?",
        (datetime.utcnow(), session_id)
    )

    conn.commit()
    conn.close()


# Message operations
def create_message(
    session_id: str,
    role: str,
    content: str,
    attachments: List[str] = None
) -> dict:
    """Create a new message."""
    conn = get_db()
    cursor = conn.cursor()

    message_id = str(int(datetime.utcnow().timestamp() * 1000))

    cursor.execute(
        """INSERT INTO messages (id, session_id, role, content, attachments, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (message_id, session_id, role, content, json.dumps(attachments or []), datetime.utcnow())
    )

    conn.commit()
    conn.close()

    # Update session activity
    update_session_activity(session_id)

    return {
        "id": message_id,
        "sessionId": session_id,
        "role": role,
        "content": content,
        "attachments": attachments or [],
        "createdAt": datetime.utcnow().isoformat()
    }


def get_messages(session_id: str, limit: int = 100) -> List[dict]:
    """Get messages for a session."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT * FROM messages WHERE session_id = ?
           ORDER BY created_at ASC LIMIT ?""",
        (session_id, limit)
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]


# Background process operations
def create_process(
    process_id: str,
    name: str,
    command: str,
    session_id: str = None
) -> dict:
    """Create a new background process record."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """INSERT INTO processes (id, name, command, session_id, status, created_at)
           VALUES (?, ?, ?, ?, ?, ?)""",
        (process_id, name, command, session_id, "starting", datetime.utcnow())
    )

    conn.commit()
    conn.close()

    logger.info(f"Created process: {process_id}")

    return {
        "id": process_id,
        "name": name,
        "command": command,
        "sessionId": session_id,
        "status": "starting",
        "createdAt": datetime.utcnow().isoformat()
    }


def update_process_status(
    process_id: str,
    status: str,
    output: str = None
) -> dict:
    """Update process status and output."""
    conn = get_db()
    cursor = conn.cursor()

    update_fields = ["status = ?", "updatedAt = ?"]
    update_values = [status, datetime.utcnow().isoformat()]

    if output is not None:
        update_fields.append("output = ?")
        update_values.append(output)

    if status in ["completed", "failed", "stopped"]:
        update_fields.append("exit_code = ?")
        update_values.append(0 if status == "completed" else 1)

    update_values.append(process_id)

    cursor.execute(
        f"UPDATE processes SET {', '.join(update_fields)} WHERE id = ?",
        update_values
    )

    conn.commit()
    conn.close()

    return {"id": process_id, "status": status}


def get_active_processes() -> List[dict]:
    """Get all active/running processes."""
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute(
        """SELECT * FROM processes WHERE status IN ('starting', 'running')
           ORDER BY created_at DESC"""
    )

    rows = cursor.fetchall()
    conn.close()

    return [dict(row) for row in rows]
