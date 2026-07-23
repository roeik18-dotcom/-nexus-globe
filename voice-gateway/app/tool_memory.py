"""Per-session tool memory — structured facts produced by tool calls."""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

MAX_ENTRIES: int = 20


@dataclass
class ToolMemoryEntry:
    tool: str
    fact: str
    source: str
    created_at: str = field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat(timespec="seconds")
    )
    key: str = ""  # if non-empty, upserts — new entry replaces existing with same key


class ToolMemoryRegistry:
    def __init__(self) -> None:
        self._sessions: dict[str, list[ToolMemoryEntry]] = {}

    def record(self, session_id: str, entry: ToolMemoryEntry) -> None:
        entries = self._sessions.setdefault(session_id, [])
        if entry.key:
            for i, e in enumerate(entries):
                if e.key == entry.key:
                    entries[i] = entry
                    logger.info("tool_memory[%s] replaced key=%r: %s", session_id, entry.key, entry.fact)
                    return
        if len(entries) >= MAX_ENTRIES:
            dropped = entries.pop(0)
            logger.info("tool_memory[%s] max reached, dropped oldest: %s", session_id, dropped.fact)
        entries.append(entry)
        logger.info("tool_memory[%s] recorded [%s]: %s", session_id, entry.tool, entry.fact)

    def get(self, session_id: str) -> list[ToolMemoryEntry]:
        return list(self._sessions.get(session_id, []))

    def clear(self, session_id: str) -> None:
        self._sessions.pop(session_id, None)
        logger.info("tool_memory[%s] cleared", session_id)


def format_block(entries: list[ToolMemoryEntry]) -> str:
    if not entries:
        return ""
    lines = [f"- [{e.tool}] {e.fact}" for e in entries]
    return "## Tool Memory\n\n" + "\n".join(lines)


tool_memory_registry = ToolMemoryRegistry()
