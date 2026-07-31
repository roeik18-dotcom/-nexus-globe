"""Permission Capability (Sprint 2, #2).

Contract:  intent.recognized  ──▶  action.allowed | action.needs_approval | action.denied

No component runs an action directly — every intent passes the gate first.
Policy follows RFC-000 §8 (auto / ask / refuse) and INV-8 (human authority over
irreversible/outward actions).
"""
from __future__ import annotations

from kernel import Kernel
from kernel.event import Event

# Auto: read-only / reversible → allowed without asking.
_AUTO_ALLOW = {"ask_time", "list_projects", "greet", "acknowledge"}
# Ask: irreversible / outward-facing → needs human approval (INV-8).
_NEEDS_APPROVAL = {"send_message", "purchase", "delete_data", "post_public"}
# Everything else (incl. "unknown") → refused: never act on an unclear intent.


def decide(intent: str) -> tuple[str, str]:
    if intent in _AUTO_ALLOW:
        return "allowed", "auto: read-only / reversible (§8)"
    if intent in _NEEDS_APPROVAL:
        return "needs_approval", "irreversible / outward — human approval required (INV-8)"
    return "denied", "unlisted or unclear intent — refuse (§8)"


class PermissionCapability:
    name = "permissions"

    def attach(self, kernel: Kernel) -> None:
        kernel.registry.register("intent.recognized", self._marker)
        kernel.bus.subscribe(self._make_handler(kernel))

    def _make_handler(self, kernel: Kernel):
        def handler(event: Event) -> None:
            if event.type != "intent.recognized":
                return
            intent = event.payload.get("intent", "unknown")
            outcome, reason = decide(intent)
            kernel.publish(Event(
                f"action.{outcome}",
                event.subject,
                {"intent": intent, "reason": reason, "source_event": event.type},
                actor="capability:permissions",
            ))
        return handler

    def _marker(self, event: Event) -> None:  # pragma: no cover - registry catalog
        pass
