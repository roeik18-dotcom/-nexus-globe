"""Structured per-turn observability events for the Merlin Control Center.

Append-only JSONL. Never logs secrets or full prompt/transcript text — only what
docs/MERLIN_CONTROL_SPEC.md §"Runtime observability" specifies.
"""

from __future__ import annotations

import json
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

EVENTS_PATH = Path(__file__).parent.parent / "dashboard" / "events.jsonl"
_MAX_TRANSCRIPT_CHARS = 120  # short excerpt only, never the full text

_lock = threading.Lock()


def new_turn_id() -> str:
    return uuid.uuid4().hex[:12]


def append_event(
    *,
    turn_id: str,
    runtime_state: str,
    transcript_excerpt: str = "",
    detected_language: str | None = None,
    requested_language: str | None = None,
    enforced_output_language: str | None = None,
    config_version: int | None = None,
    trigger_matched: str | None = None,
    tool_requested: str | None = None,
    tool_allowed: bool | None = None,
    response_language_ok: bool | None = None,
    interruption_status: str = "not_implemented",
    error: str | None = None,
) -> None:
    event = {
        "turn_id": turn_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "runtime_state": runtime_state,
        "transcript_excerpt": (transcript_excerpt or "")[:_MAX_TRANSCRIPT_CHARS],
        "detected_language": detected_language,
        "requested_language": requested_language,
        "enforced_output_language": enforced_output_language,
        "config_version": config_version,
        "trigger_matched": trigger_matched,
        "tool_requested": tool_requested,
        "tool_allowed": tool_allowed,
        "response_language_ok": response_language_ok,
        "interruption_status": interruption_status,
        "error": error,
    }
    line = json.dumps(event, ensure_ascii=False)
    with _lock:
        EVENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with EVENTS_PATH.open("a", encoding="utf-8") as fh:
            fh.write(line + "\n")


def read_last_events(n: int = 20) -> list[dict]:
    if not EVENTS_PATH.exists():
        return []
    try:
        lines = EVENTS_PATH.read_text(encoding="utf-8").strip().splitlines()
    except Exception:
        return []
    out = []
    for line in lines[-n:]:
        try:
            out.append(json.loads(line))
        except Exception:
            continue
    return out
