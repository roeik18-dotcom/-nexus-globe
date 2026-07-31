"""V&V for the Trace engine (causal chain reconstruction over the event log)."""
from mos.runtime import Runtime
from mos.trace import causal_chain, correlations, render, summarize, turn_events


def test_turn_events_are_ordered_and_scoped():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    rt.handle_intent("ask_status", 0.8)
    ev = turn_events(rt.bus.log, "turn::ask_time")
    assert ev and all(e.correlation_id == "turn::ask_time" for e in ev)
    assert [e.seq for e in ev] == sorted(e.seq for e in ev)


def test_summarize_outcomes():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)     # reversible -> done
    rt.handle_intent("open_app", 0.9)      # irreversible -> awaiting_approval
    assert summarize(rt.bus.log, "turn::ask_time").outcome == "done"
    assert summarize(rt.bus.log, "turn::open_app").outcome == "awaiting_approval"


def test_causal_chain_reaches_root():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    made = [e for e in rt.bus.log if e.type == "decision.made"][0]
    chain = causal_chain(rt.bus.log, made.id)
    assert chain[0].type == "intent.classified"     # root of the turn
    assert chain[-1].id == made.id


def test_render_and_correlations():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    assert "intent.classified" in render(rt.bus.log, "turn::ask_time")
    assert "turn::ask_time" in correlations(rt.bus.log)
