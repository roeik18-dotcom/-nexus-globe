"""V&V for the Cognition Engine v0 (RFC-020 shell). Contract-level, not algorithm."""
from mos.cognition import CognitionEngine, OrientationInput, SEAMS
from mos.events import EventBus, new_event


def _run(intent, conf):
    bus = EventBus()
    eng = CognitionEngine(bus)
    o = eng.orient(OrientationInput(intent=intent, intent_confidence=conf,
                                    correlation_id=f"t::{intent}"))
    return bus, o


def test_known_intent_produces_decision():
    bus, o = _run("ask_time", 0.95)
    assert o.goal == "answer_user"
    assert o.decision == "read_clock"
    assert o.confidence == 0.95
    assert o.engine_version.startswith("philos@")
    # compact shape Roei specified
    assert o.as_min() == {"intent": "ask_time", "goal": "answer_user",
                          "decision": "read_clock", "confidence": 0.95}


def test_unknown_intent_abstains_not_fabricates():
    # I-4 / evidence discipline: no fabricated action for an unknown intent
    _, o = _run("frobnicate", 0.6)
    assert o.decision == "ask_clarify"
    assert o.confidence <= 0.3


def test_every_seam_is_observable():
    bus, _ = _run("ask_time", 0.9)
    seam_types = {e.type for e in bus.log if e.type.startswith("cognition.seam.")}
    for s in SEAMS:
        assert f"cognition.seam.{s}" in seam_types, f"missing seam event: {s}"
    assert any(e.type == "decision.made" for e in bus.log)


def test_state_is_fold_over_events():
    bus, _ = _run("ask_status", 0.8)
    decisions = bus.fold(
        lambda acc, e: acc + [e.payload["decision"]] if e.type == "decision.made" else acc,
        [])
    assert decisions == ["read_mission_control"]


def test_causation_chain_is_recorded():
    # every cognition event traces back to the triggering intent (INV-5 explainability)
    bus = EventBus()
    eng = CognitionEngine(bus)
    trigger = bus.publish(new_event("intent.classified", "mos.intent", "intent:stop",
                                    {"intent": "stop", "confidence": 0.99},
                                    correlation_id="t::stop"))
    eng.orient(OrientationInput(intent="stop", intent_confidence=0.99,
                                correlation_id="t::stop", cause=trigger.id))
    cog = [e for e in bus.log if e.actor == "mos.cognition"]
    assert cog and all(e.causation_id == trigger.id for e in cog)
