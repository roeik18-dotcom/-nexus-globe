"""V&V for the Learning layer (closes the §4 loop)."""
from mos.alpha import AlphaRuntime
from mos.learning import Priors


def test_priors_fold_counts_intents_tools_outcomes():
    rt = AlphaRuntime()
    rt.speak("מה השעה", correlation_id="a")
    rt.speak("מה השעה", correlation_id="b")
    p = Priors.from_events(rt.bus.log)
    assert p.intents["ask_time"] == 2
    assert p.tools["read_clock"] == 2
    assert p.outcomes["executed"] >= 2


def test_learning_updated_emitted_after_each_turn():
    rt = AlphaRuntime()
    rt.speak("מה השעה", correlation_id="t")
    assert any(e.type == "learning.updated" for e in rt.bus.log)


def test_loop_is_closed_learning_present_in_turn():
    rt = AlphaRuntime()
    rt.speak("בוקר טוב", correlation_id="loop")
    types = [e.type for e in rt.bus.log if e.correlation_id == "loop"]
    # full loop: intent → decision → plan → tool → response → learning
    for stage in ["intent.classified", "decision.made", "plan.created",
                  "tool.executed", "response.generated", "learning.updated"]:
        assert stage in types, f"loop missing: {stage}"


def test_gated_turn_counts_as_gated_outcome():
    rt = AlphaRuntime()
    rt.speak("פתח Ableton", correlation_id="g")
    p = Priors.from_events(rt.bus.log)
    assert p.outcomes.get("gated", 0) >= 1
