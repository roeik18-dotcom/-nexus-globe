"""Merlin OS · Responder (v0) — tool.executed → response.generated.

Closes the loop with a user-facing response. v0: a simple templated text; the real
responder (TTS phrasing, persona, Philos rationale) replaces it behind the same event.
"""
from __future__ import annotations

from .events import Event, EventBus, new_event

_PHRASING = {
    "read_clock": "השעה עכשיו …",
    "read_mission_control": "הנה מצב המערכת …",
    "run_morning_brief": "פותח יום — הנה התדרוך …",
    "launch_application": "פתחתי את האפליקציה.",
    "ask_clarify": "לא הבנתי — תוכל לחזור?",
}


class Responder:
    def __init__(self, bus: EventBus) -> None:
        self.bus = bus
        bus.subscribe(self._on)

    def _on(self, e: Event) -> None:
        if e.type != "tool.executed":
            return
        tool = e.payload.get("tool", "")
        self.bus.publish(new_event(
            "response.generated", "mos.response", e.subject,
            {"text": _PHRASING.get(tool, f"בוצע: {tool}"), "tool": tool},
            correlation_id=e.correlation_id, causation_id=e.id))
