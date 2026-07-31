"""Merlin OS · Philos plug-point (RFC-020 §Scope / INV-9).

This is the seam where Philos's LOCKED THEORY connects to the engineering shell.
Whoever implements `OrientationAlgorithm` OWNS the orientation logic (that owner is
Roei / the Philos docs). The shell (`CognitionEngine`) only CALLS and MEASURES this
interface — it never prescribes what happens inside. Swapping the implementation
changes no consumer (INV-7).

v0 ships `RuleStub`: a deliberately trivial, transparent placeholder so the shell
runs and is measurable NOW. It is NOT the Philos algorithm — it is scaffolding that
the real algorithm replaces, same interface.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Protocol, runtime_checkable


@dataclass
class SeamResult:
    """What the orientation algorithm returns (fills RFC-020 §2 output fields)."""
    goal: str
    decision: str
    confidence: float
    rationale: str
    weighed_factors: list[dict] = field(default_factory=list)
    alternatives: list[dict] = field(default_factory=list)
    conflicts: list[dict] = field(default_factory=list)


@runtime_checkable
class OrientationAlgorithm(Protocol):
    """The locked-theory plug-point. `version` identifies the engine (RFC-012)."""
    version: str

    def orient(self, intent: str, intent_confidence: float,
               context: dict, evidence: list) -> SeamResult: ...


# --- v0 placeholder (NOT the Philos algorithm) -------------------------------------
_POLICY: dict[str, tuple[str, str]] = {
    "ask_time":    ("answer_user", "read_clock"),
    "ask_status":  ("answer_user", "read_mission_control"),
    "ask_weather": ("answer_user", "read_weather"),
    "open_app":    ("act_for_user", "launch_application"),
    "stop":        ("obey_control", "halt_speech"),
    "day_opener":  ("serve_routine", "run_morning_brief"),
}


class RuleStub:
    """Transparent placeholder implementing OrientationAlgorithm. Replaceable."""
    version = "philos@0.0-stub"

    def orient(self, intent, intent_confidence, context, evidence) -> SeamResult:
        factors = [{"factor": "intent_confidence", "weight": intent_confidence}]
        if intent in _POLICY:
            goal, decision = _POLICY[intent]
            return SeamResult(
                goal=goal, decision=decision, confidence=intent_confidence,
                weighed_factors=factors,
                alternatives=[{"option": decision, "score": intent_confidence},
                              {"option": "ask_clarify", "score": 1 - intent_confidence}],
                conflicts=[],
                rationale=(f"Intent '{intent}' → goal '{goal}', action '{decision}' "
                           f"(v0 rule stub); confidence carried from intent."))
        # I-4 honesty: never fabricate an action for an unknown intent
        return SeamResult(
            goal="clarify", decision="ask_clarify",
            confidence=min(0.3, intent_confidence), weighed_factors=factors,
            alternatives=[{"option": "ask_clarify", "score": 1.0}], conflicts=[],
            rationale=(f"Unknown intent '{intent}' — no policy. Abstaining and asking "
                       f"for clarification rather than acting (evidence discipline)."))
