"""V&V for the multi-step Planner (v0.2)."""
from mos.alpha import AlphaRuntime
from mos.events import EventBus, new_event
from mos.planner import Planner


def _plan_for(decision):
    bus = EventBus()
    Planner(bus)
    bus.publish(new_event("decision.made", "mos.cognition", "x",
                          {"decision": decision, "goal": "g", "confidence": 0.9}))
    return [e for e in bus.log if e.type == "plan.created"][0].payload


def test_morning_brief_expands_to_multi_step_with_dependencies():
    p = _plan_for("run_morning_brief")
    actions = [s["action"] for s in p["steps"]]
    assert actions == ["read_mission_control", "read_clock", "run_morning_brief"]
    assert p["n_steps"] == 3
    assert p["steps"][0]["depends_on"] is None
    assert p["steps"][1]["depends_on"] == "read_mission_control"   # linear dependency


def test_plain_decision_is_single_step():
    p = _plan_for("read_clock")
    assert p["n_steps"] == 1
    assert p["steps"][0]["action"] == "read_clock"


def test_multi_step_plan_executes_all_steps_end_to_end():
    rt = AlphaRuntime()
    rt.speak("בוקר טוב", correlation_id="b")
    tools = [e.payload["tool"] for e in rt.bus.log
             if e.type == "tool.executed" and e.correlation_id == "b"]
    assert tools == ["read_mission_control", "read_clock", "run_morning_brief"]
