"""
Read-only agent context endpoints for skills, MCP status, and console events.
"""

import asyncio
from datetime import datetime
import json
import logging
from pathlib import Path
import re
from typing import Any, Dict, Iterable, List, Optional

from fastapi import APIRouter, Query

from core.agent_console import add_console_event, list_console_events
from core.claude_wrapper import get_claude
from core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

MAX_SKILLS = 240
MAX_SKILL_READ = 96 * 1024


def _split_paths(value: str) -> List[Path]:
    paths = []
    for item in value.split(":"):
        item = item.strip()
        if item:
            paths.append(Path(item).expanduser())
    return paths


def _workspace_augmented_roots() -> List[Path]:
    roots = _split_paths(settings.SKILLS_ROOTS)
    workspace = Path(settings.CLAUDE_WORKSPACE)
    roots.extend([
        workspace / "skills",
        workspace / ".agents" / "skills",
        workspace / ".claude" / "skills",
        workspace / ".codex" / "skills",
    ])

    seen = set()
    unique_roots = []
    for root in roots:
        resolved = root.resolve() if root.exists() else root
        key = str(resolved)
        if key not in seen:
            seen.add(key)
            unique_roots.append(root)
    return unique_roots


def _frontmatter_value(text: str, key: str) -> Optional[str]:
    if not text.startswith("---"):
        return None

    lines = text.splitlines()
    try:
        end = lines[1:].index("---") + 1
    except ValueError:
        return None

    frontmatter = lines[1:end]
    for index, line in enumerate(frontmatter):
        match = re.match(rf"^{re.escape(key)}:\s*(.*)$", line)
        if not match:
            continue

        value = match.group(1).strip().strip("\"'")
        if value in {">", "|", ">-", "|-"}:
            block = []
            for following in frontmatter[index + 1:]:
                if not following.startswith((" ", "\t", "- ")):
                    break
                block.append(following.strip(" -"))
            return " ".join(part for part in block if part).strip() or None

        return value or None

    return None


def _skill_from_file(skill_file: Path, root: Path) -> Optional[dict]:
    try:
        text = skill_file.read_text(encoding="utf-8", errors="replace")[:MAX_SKILL_READ]
        stat = skill_file.stat()
    except OSError as exc:
        logger.warning("Could not read skill file %s: %s", skill_file, exc)
        return None

    name = _frontmatter_value(text, "name") or skill_file.parent.name
    description = _frontmatter_value(text, "description") or ""
    relative = None
    try:
        relative = str(skill_file.parent.resolve().relative_to(root.resolve()))
    except ValueError:
        relative = skill_file.parent.name

    skill_id = re.sub(r"[^A-Za-z0-9_.:-]+", "-", f"{root.name}:{relative}").strip("-")

    return {
        "id": skill_id,
        "name": name,
        "description": description,
        "path": str(skill_file),
        "directory": str(skill_file.parent),
        "source": str(root),
        "updatedAt": datetime.utcfromtimestamp(stat.st_mtime).isoformat(),
    }


def _iter_skill_files(root: Path) -> Iterable[Path]:
    if not root.exists() or not root.is_dir():
        return []

    files = []
    for skill_file in root.rglob("SKILL.md"):
        parts = set(skill_file.parts)
        if ".git" in parts or "node_modules" in parts:
            continue
        files.append(skill_file)
        if len(files) >= MAX_SKILLS:
            break

    return files


def _parse_mcp_config(path: Path) -> List[dict]:
    if not path.exists() or not path.is_file():
        return []

    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return []

    servers = data.get("mcpServers")
    if not isinstance(servers, dict):
        return []

    parsed = []
    for name, config in servers.items():
        if not isinstance(config, dict):
            continue
        command = config.get("command") or config.get("url") or config.get("transport") or "configured"
        args = config.get("args") if isinstance(config.get("args"), list) else []
        parsed.append({
            "name": name,
            "status": "configured",
            "command": " ".join([str(command), *[str(arg) for arg in args]]).strip(),
            "source": str(path),
        })
    return parsed


def _parse_mcp_cli_output(output: str) -> List[dict]:
    servers = []
    for line in output.splitlines():
        cleaned = line.strip()
        if not cleaned or cleaned.lower().startswith(("name", "server", "no mcp")):
            continue
        if set(cleaned) <= {"-", " ", "|", "+"}:
            continue

        status = "active" if re.search(r"\b(active|connected|running|enabled)\b|✓", cleaned, re.I) else "listed"
        parts = re.split(r"\s{2,}|\t+", cleaned, maxsplit=2)
        name = parts[0].strip("│| ")
        detail = parts[1].strip("│| ") if len(parts) > 1 else cleaned
        command = parts[2].strip("│| ") if len(parts) > 2 else detail
        if name:
            servers.append({
                "name": name,
                "status": status,
                "command": command,
                "source": "claude mcp list",
            })
    return servers


async def _claude_mcp_list() -> dict:
    claude = await get_claude()
    command = [claude._resolve_claude_binary(), "mcp", "list"]

    try:
        process = await asyncio.create_subprocess_exec(
            *command,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=settings.CLAUDE_WORKSPACE,
            env=claude._subprocess_env(),
        )
        stdout, stderr = await asyncio.wait_for(process.communicate(), timeout=8)
    except Exception as exc:
        return {
            "status": "error",
            "raw": str(exc),
            "servers": [],
        }

    raw = "\n".join(
        part.decode("utf-8", errors="replace").strip()
        for part in [stdout, stderr]
        if part
    ).strip()

    return {
        "status": "available" if process.returncode == 0 else "error",
        "raw": raw,
        "servers": _parse_mcp_cli_output(raw),
    }


@router.get("/skills")
async def list_skills():
    """List skills discoverable from configured skill roots."""
    skills = []
    roots = _workspace_augmented_roots()

    for root in roots:
        for skill_file in _iter_skill_files(root):
            skill = _skill_from_file(skill_file, root)
            if skill:
                skills.append(skill)
            if len(skills) >= MAX_SKILLS:
                break
        if len(skills) >= MAX_SKILLS:
            break

    skills.sort(key=lambda item: item["name"].lower())
    add_console_event(
        kind="skills",
        label=f"Skills indexed: {len(skills)}",
        level="info",
        metadata={"roots": [str(root) for root in roots if root.exists()]},
    )
    return {
        "skills": skills,
        "roots": [{"path": str(root), "exists": root.exists()} for root in roots],
        "checkedAt": datetime.utcnow().isoformat(),
    }


@router.get("/mcp")
async def list_mcp():
    """List MCP servers known to the Claude CLI and local config files."""
    cli_result = await _claude_mcp_list()
    servers_by_key: Dict[str, dict] = {
        server["name"]: server for server in cli_result.get("servers", [])
    }

    for path in _split_paths(settings.MCP_CONFIG_PATHS):
        for server in _parse_mcp_config(path.expanduser()):
            servers_by_key.setdefault(server["name"], server)

    servers = sorted(servers_by_key.values(), key=lambda item: item["name"].lower())
    add_console_event(
        kind="mcp",
        label=f"MCP list refreshed: {len(servers)} server{'s' if len(servers) != 1 else ''}",
        level="info" if cli_result["status"] == "available" else "warning",
        detail=cli_result.get("raw") or None,
    )
    return {
        "status": cli_result["status"],
        "servers": servers,
        "raw": cli_result.get("raw", ""),
        "command": "claude mcp list",
        "checkedAt": datetime.utcnow().isoformat(),
    }


@router.get("/console/events")
async def console_events(limit: int = Query(default=100, ge=1, le=240)):
    """Return recent backend agent console events."""
    return {
        "events": list_console_events(limit=limit),
        "checkedAt": datetime.utcnow().isoformat(),
    }
