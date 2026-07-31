"""V&V for the Merlin OS runtime: loop wiring, INV-6 gating, INV-7 swappability."""
from mos.philos_seam import SeamResult
from mos.runtime import Runtime


def test_reversible_executes_irreversible_gated():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)      # reversible -> execute
    rt.handle_intent("open_app", 0.9)       # irreversible/outward -> gated (INV-6)
    assert "read_clock" in rt.action.executed
    assert "launch_application" in rt.action.gated
    assert "launch_application" not in rt.action.executed
    # the gate is a first-class event, not a hidden branch
    assert any(e.type == "action.gated" for e in rt.bus.log)


def test_full_turn_emits_intent_decision_and_action():
    rt = Runtime()
    rt.handle_intent("ask_status", 0.8)
    types = [e.type for e in rt.bus.log]
    assert "intent.classified" in types
    assert "decision.made" in types
    assert "action.result" in types        # ask_status -> read_mission_control (reversible)


def test_gated_action_executes_only_after_approval():
    rt = Runtime()
    rt.handle_intent("open_app", 0.9)               # irreversible -> gated
    assert "launch_application" not in rt.action.executed
    tok = next(iter(rt.pending_tokens()))
    assert rt.pending_tokens()[tok] == "launch_application"
    rt.approve(tok)                                 # INV-6 approval, first-class event
    assert "launch_application" in rt.action.executed
    assert rt.pending_tokens() == {}
    assert any(e.type == "approval.granted" for e in rt.bus.log)
    res = [e for e in rt.bus.log if e.type == "action.result"][-1]
    assert res.payload["post_approval"] is True


class _AlgoV2:
    """A different orientation algorithm — proves INV-7: swap it, shell unchanged."""
    version = "philos@0.2-test"

    def orient(self, intent, intent_confidence, context, evidence) -> SeamResult:
        return SeamResult(goal="test_goal", decision="test_decision",
                          confidence=0.42, rationale="v2 test algorithm")


def test_algorithm_is_swappable_without_touching_shell():
    rt = Runtime(algorithm=_AlgoV2())
    o = rt.handle_intent("ask_time", 0.95)
    assert o.decision == "test_decision"
    assert o.confidence == 0.42
    assert o.engine_version == "philos@0.2-test"
    # decision.made carries the swapped engine version (comparability, RFC-020 §4)
    made = [e for e in rt.bus.log if e.type == "decision.made"][0]
    assert made.payload["engine_version"] == "philos@0.2-test"
