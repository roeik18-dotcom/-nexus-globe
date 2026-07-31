"""Intent Capability (Sprint 2, #1).

Contract:  user.spoke  ──▶  intent.recognized
Deterministic, simple, replaceable. It does NOT 'understand the world' — it maps an
utterance to a canonical structure, creating a clean contract between Voice and the
rest of the system.

    intent.recognized payload = {
        "intent": str, "confidence": float, "entities": dict, "source_event": str
    }
"""
from __future__ import annotations

from kernel import Kernel
from kernel.event import Event

# v0 rules: first matching keyword-set wins. Deterministic (RFC-000 INV-6).
_RULES: list[tuple[tuple[str, ...], str]] = [
    (("מה השעה", "השעה", "what time", "the time", "clock"), "ask_time"),
    (("פרויקט", "פרויקטים", "project", "projects"),         "list_projects"),
    (("תודה", "thanks", "thank you"),                        "acknowledge"),
    (("שלום", "היי", "hello", "hi ", "מרלין", "merlin"),     "greet"),
]


def classify(text: str) -> tuple[str, float]:
    t = (text or "").lower().strip()
    for keys, intent in _RULES:
        if any(k in t for k in keys):
            return intent, 0.95
    return "unknown", 0.30


class IntentCapability:
    name = "intent"

    def attach(self, kernel: Kernel) -> None:
        kernel.registry.register("user.spoke", self._on_event)   # catalog (Capability Registry)
        kernel.bus.subscribe(self._make_handler(kernel))          # wire to the bus

    def _make_handler(self, kernel: Kernel):
        def handler(event: Event) -> None:
            if event.type != "user.spoke":
                return
            intent, confidence = classify(event.payload.get("message", ""))
            kernel.publish(Event(
                "intent.recognized",
                event.subject,
                {"intent": intent, "confidence": confidence,
                 "entities": {}, "source_event": event.type},
                actor="capability:intent",
            ))
        return handler

    # exposed for the registry catalog / tests
    def _on_event(self, event: Event) -> None:  # pragma: no cover - catalog marker
        pass
