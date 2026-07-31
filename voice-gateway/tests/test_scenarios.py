"""End-to-End Scenario Tests — Merlin's ACCEPTANCE tests (prove the system is alive).

These assert the full event-driven chain, not units:
    text → intent → cognition → decision → plan → (permission?) → tool → response
and that the whole chain is traceable (INV-5) and replayable.
"""
from mos.alpha import AlphaRuntime
from mos.trace import causal_chain, render, summarize


def test_scenario_morning_brief_runs_without_approval():
    rt = AlphaRuntime()
    rt.speak("בוקר טוב מרלין", correlation_id="brief")
    chain = render(rt.bus.log, "brief")
    for stage in ["intent.classified", "decision.made", "plan.created",
                  "tool.executed", "response.generated"]:
        assert stage in chain, f"missing stage: {stage}"
    assert "permission.required" not in chain          # safe action → no gate
    assert rt.response_for("brief")                     # a response was produced
    assert summarize(rt.bus.log, "brief").outcome == "done"


def test_scenario_open_application_requires_approval():
    rt = AlphaRuntime()
    rt.speak("פתח Ableton", correlation_id="open")
    # before approval: permission required, tool NOT yet executed (INV-6)
    pre = render(rt.bus.log, "open")
    assert "permission.required" in pre
    assert "tool.executed" not in pre
    # approve → tool executes, response generated
    rt.approve(rt.pending_token())
    post = render(rt.bus.log, "open")
    assert "tool.executed" in post
    assert rt.response_for("open")


def test_full_chain_is_traceable_to_root():
    rt = AlphaRuntime()
    rt.speak("בוקר טוב", correlation_id="t")
    resp = [e for e in rt.bus.log
            if e.type == "response.generated" and e.correlation_id == "t"][-1]
    chain = causal_chain(rt.bus.log, resp.id)
    assert chain[0].type == "intent.classified"        # root
    assert chain[-1].type == "response.generated"       # leaf
    # the causal chain threads the whole pipeline
    types = {e.type for e in chain}
    assert {"decision.made", "plan.created", "tool.executed"} <= types


def test_chain_is_replayable_from_durable_log(tmp_path):
    path = str(tmp_path / "alpha.jsonl")
    rt = AlphaRuntime(store_path=path)
    rt.speak("בוקר טוב", correlation_id="r")
    # simulated restart: a fresh runtime rebuilds state from the durable log
    rt2 = AlphaRuntime(store_path=path)
    responses = [e for e in rt2.bus.log if e.type == "response.generated"]
    assert responses, "durable log did not replay the completed chain"
