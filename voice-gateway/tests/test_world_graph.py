"""V&V for the World Graph projection."""
from mos.runtime import Runtime
from mos.world_graph import WorldGraph


def _graph():
    rt = Runtime()
    for i, c in [("ask_time", 0.95), ("day_opener", 0.88)]:
        rt.handle_intent(i, c)
    return WorldGraph.from_events(rt.bus.log)


def test_projection_has_nodes_and_edges():
    g = _graph()
    snap = g.snapshot()
    assert snap["n_nodes"] > 0 and snap["n_edges"] > 0


def test_decision_nodes_carry_facts():
    g = _graph()
    decisions = [n for n in g.nodes.values() if n.kind == "decision"]
    assert decisions
    assert any(n.attrs.get("decision") == "read_clock" for n in decisions)
    assert all("confidence" in n.attrs for n in decisions)


def test_is_pure_fold_deterministic():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    g1 = WorldGraph.from_events(rt.bus.log)
    g2 = WorldGraph.from_events(rt.bus.log)
    assert g1.snapshot() == g2.snapshot()
