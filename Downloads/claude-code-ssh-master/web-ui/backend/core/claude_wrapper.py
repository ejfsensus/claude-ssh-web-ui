"""
Claude Code CLI wrapper - handles subprocess communication.
"""

import subprocess
import asyncio
import logging
import os
import shutil
from typing import AsyncIterator, Optional
from pathlib import Path

from core.config import settings

logger = logging.getLogger(__name__)


class ClaudeWrapper:
    """Wrapper for Claude Code CLI subprocess."""

    def __init__(self, workspace: str = None):
        self.workspace = workspace or settings.CLAUDE_WORKSPACE
        self.claude_binary = settings.CLAUDE_BINARY
        self.process: Optional[asyncio.subprocess.Process] = None

    def _resolve_claude_binary(self) -> str:
        """Find Claude Code in the persistent home first, then PATH."""
        candidates = [
            self.claude_binary,
            "/data/home/.local/bin/claude",
            "/home/claude/.local/bin/claude",
            shutil.which("claude") or "",
        ]

        for candidate in candidates:
            if candidate and Path(candidate).exists():
                return candidate

        return self.claude_binary

    def _subprocess_env(self) -> dict:
        """Preserve Railway/container env while making Claude's home explicit."""
        env = os.environ.copy()
        env.update({
            "PATH": "/data/home/.local/bin:/home/claude/.local/bin:/usr/local/bin:/usr/bin:/bin",
            "HOME": "/data/home",
            "LANG": "en_US.UTF-8",
            "LC_ALL": "en_US.UTF-8",
            "USER": "claude",
        })
        return env

    async def is_available(self) -> bool:
        """Check if Claude CLI is available."""
        try:
            result = await asyncio.create_subprocess_exec(
                self._resolve_claude_binary(),
                "--version",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=self._subprocess_env(),
            )
            await result.communicate()
            return result.returncode == 0
        except Exception as e:
            logger.error(f"Claude CLI not available: {e}")
            return False

    async def stream_response(
        self,
        prompt: str,
        session_id: str = None
    ) -> AsyncIterator[str]:
        """
        Stream Claude's response to a prompt.

        Yields tokens/chunks as they arrive from the CLI.
        """
        if not await self.is_available():
            yield "Error: Claude CLI is not available. Please check the installation."
            return

        try:
            # Create subprocess with stdin/stdout/stderr pipes
            self.process = await asyncio.create_subprocess_exec(
                self._resolve_claude_binary(),
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,  # Merge stderr into stdout
                cwd=self.workspace,
                env=self._subprocess_env(),
            )

            # Send the prompt
            self.process.stdin.write(prompt.encode() + b"\n")
            await self.process.stdin.drain()
            # Close stdin to signal EOF
            self.process.stdin.close()

            # Stream output line by line
            buffer = ""
            while True:
                line = await self.process.stdout.readline()
                if not line:
                    break

                line_text = line.decode("utf-8", errors="ignore")

                # Buffer lines to emit complete tokens/words
                buffer += line_text

                # Try to emit at word boundaries
                if " " in buffer or "\n" in buffer:
                    parts = buffer.split(" ", 1)
                    if len(parts) == 2:
                        token = parts[0] + " "
                        buffer = parts[1]
                        yield token
                    else:
                        # No space found, check for newline
                        if "\n" in buffer:
                            lines = buffer.split("\n", 1)
                            token = lines[0] + "\n"
                            buffer = lines[1]
                            yield token

            # Yield any remaining buffer
            if buffer:
                yield buffer

            # Wait for process to complete
            await self.process.wait()

            if self.process.returncode != 0:
                logger.warning(f"Claude CLI exited with code {self.process.returncode}")

        except Exception as e:
            logger.error(f"Error streaming Claude response: {e}")
            yield f"Error: {str(e)}"

        finally:
            # Clean up process
            if self.process:
                try:
                    self.process.kill()
                    await self.process.wait()
                except:
                    pass
                self.process = None

    async def execute_command(
        self,
        command: str,
        timeout: int = 300
    ) -> tuple[str, str, int]:
        """
        Execute a Claude CLI command synchronously.

        Returns:
            tuple: (stdout, stderr, return_code)
        """
        try:
            process = await asyncio.create_subprocess_exec(
                *command.split(),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                cwd=self.workspace,
                env=self._subprocess_env(),
            )

            stdout, stderr = await asyncio.wait_for(
                process.communicate(),
                timeout=timeout
            )

            return (
                stdout.decode("utf-8", errors="ignore"),
                stderr.decode("utf-8", errors="ignore"),
                process.returncode
            )

        except asyncio.TimeoutError:
            process.kill()
            await process.wait()
            return "", f"Command timed out after {timeout}s", -1

        except Exception as e:
            return "", f"Error: {str(e)}", -1


# Singleton instance
claude = ClaudeWrapper()


async def get_claude() -> ClaudeWrapper:
    """Get the Claude wrapper instance."""
    return claude
