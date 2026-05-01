"""
Database connection and models using Prisma.
"""

from prisma import Prisma
from prisma.models import (
    Session,
    Message,
    FileReference,
    BackgroundProcess,
)
import logging
from typing import Optional
from datetime import datetime

logger = logging.getLogger(__name__)

# Global Prisma client instance
prisma = None


async def init_db():
    """Initialize database connection and create tables."""
    global prisma

    try:
        prisma = Prisma(
            datasource={
                "url": "sqlite+aiosqlite:///data/web-ui/sessions.db"
            }
        )

        # Connect and create tables if they don't exist
        await prisma.connect()

        # Run migrations (creates tables)
        # Note: In production, you'd run prisma migrate separately
        # For this demo, we'll let Prisma auto-create tables

        logger.info("Database connected successfully")

    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        raise


async def get_db():
    """Get database client instance."""
    if prisma is None:
        await init_db()

    return prisma


# Session operations
async def create_session(session_id: str, title: str = "New Session") -> Session:
    """Create a new session."""
    db = await get_db()

    session = await db.session.create(
        data={
            "id": session_id,
            "title": title,
            "createdAt": datetime.utcnow(),
            "lastActiveAt": datetime.utcnow(),
        }
    )

    logger.info(f"Created session: {session_id}")
    return session


async def get_session(session_id: str) -> Optional[Session]:
    """Get a session by ID."""
    db = await get_db()
    return await db.session.find_unique(where={"id": session_id})


async def update_session_activity(session_id: str) -> Session:
    """Update session last active timestamp."""
    db = await get_db()

    session = await db.session.update(
        where={"id": session_id},
        data={"lastActiveAt": datetime.utcnow()}
    )

    return session


async def list_sessions(limit: int = 50) -> list[Session]:
    """List all sessions, ordered by last active."""
    db = await get_db()

    sessions = await db.session.find_many(
        take=limit,
        order={"lastActiveAt": "desc"}
    )

    return sessions


async def delete_session(session_id: str) -> bool:
    """Delete a session and all its messages."""
    db = await get_db()

    # Delete associated messages first
    await db.message.delete_many(where={"sessionId": session_id})

    # Delete the session
    await db.session.delete(where={"id": session_id})

    logger.info(f"Deleted session: {session_id}")
    return True


# Message operations
async def create_message(
    session_id: str,
    role: str,
    content: str,
    attachments: list[str] = None
) -> Message:
    """Create a new message."""
    db = await get_db()

    message = await db.message.create(
        data={
            "sessionId": session_id,
            "role": role,
            "content": content,
            "attachments": attachments or [],
            "createdAt": datetime.utcnow(),
        }
    )

    # Update session activity
    await update_session_activity(session_id)

    return message


async def get_messages(session_id: str, limit: int = 100) -> list[Message]:
    """Get messages for a session."""
    db = await get_db()

    messages = await db.message.find_many(
        where={"sessionId": session_id},
        take=limit,
        order={"createdAt": "asc"}
    )

    return messages


# Background process operations
async def create_process(
    process_id: str,
    name: str,
    command: str,
    session_id: str = None
) -> BackgroundProcess:
    """Create a new background process record."""
    db = await get_db()

    process = await db.backgroundprocess.create(
        data={
            "id": process_id,
            "name": name,
            "command": command,
            "sessionId": session_id,
            "status": "starting",
            "createdAt": datetime.utcnow(),
        }
    )

    logger.info(f"Created process: {process_id}")
    return process


async def update_process_status(
    process_id: str,
    status: str,
    output: str = None
) -> BackgroundProcess:
    """Update process status and output."""
    db = await get_db()

    update_data = {"status": status}
    if output is not None:
        update_data["output"] = output

    if status in ["completed", "failed", "stopped"]:
        update_data["exitCode"] = 0 if status == "completed" else 1

    process = await db.backgroundprocess.update(
        where={"id": process_id},
        data=update_data
    )

    return process


async def get_active_processes() -> list[BackgroundProcess]:
    """Get all active/running processes."""
    db = await get_db()

    processes = await db.backgroundprocess.find_many(
        where={"status": {"in": ["starting", "running"]}},
        order={"createdAt": "desc"}
    )

    return processes
