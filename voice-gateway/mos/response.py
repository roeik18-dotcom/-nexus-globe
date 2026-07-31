"""Merlin OS · Responder (v0) — tool.executed → response.generated.

Closes the loop with a user-facing response. v0: a simple templated text; the real
responder (TTS phrasing, persona, Philos rationale) replaces it behind the same event.
"""
from __future__ import annotations

from .events import Event, EventBus, new_event

_PHRASING = {
    "run_morning_brief": "פותח יום — הנה התדרוך …",
    "launch_application": "פתחתי את האפליקציה.",
    "ask_clarify": "לא הבנתי — תוכל לחזור?",
}


def _phrase(tool: str, result: dict) -> str:
    # prefer the tool's REAL result when present
    if tool == "read_clock" and result.get("time"):
        return f"השעה עכשיו {result['time']}."
    if tool == "read_mission_control" and result.get("summary"):
        return f"מצב המערכת: {result['summary']}."
    if tool == "read_weather" and result.get("note"):
        return result["note"]
    if tool == "launch_application" and result.get("app"):
        app = result["app"]
        if result.get("launched"):
            return f"פתחתי את {app}."
        if result.get("dry_run"):
            return f"מוכן לפתוח את {app} (dry-run — הכלי האמיתי כבוי)."
        return f"לא הצלחתי לפתוח את {app}: {result.get('error', 'שגיאה')}"
    return _PHRASING.get(tool, f"בוצע: {tool}")


class Responder:
    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        bus.subscribe(self._on)

    def _on(self, e: Event) -> None:
        if e.type != "tool.executed":
            return
        tool = e.payload.get("tool", "")
        result = e.payload.get("result") or {}
        self.bus.publish(new_event(
            "response.generated", "mos.response", e.subject,
            {"text": _phrase(tool, result), "tool": tool},
            correlation_id=e.correlation_id, causation_id=e.id))
