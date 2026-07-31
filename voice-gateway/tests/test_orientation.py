"""V&V for the Orientation Runtime (RFC-020 execution shell)."""
from mos.events import EventBus, new_event
from mos.orientation import OrientationResult, OrientationRuntime
from mos.runtime import Runtime
from mos.world_graph import WorldGraph


def _graph_and_bus():
    rt = Runtime()
    rt.handle_intent("ask_time", 0.95)
    return WorldGraph.from_events(rt.bus.log), rt.bus


def test_returns_canonical_contract():
    g, bus = _graph_and_bus()
    r = OrientationRuntime(bus).run(g, goals=["ship"], correlation_id="o1")
    c = r.to_canonical()
    assert set(c) == {"orientation", "confidence", "conflicts", "recommended_actions"}
    assert 0.0 <= c["confidence"] <= 1.0


def test_emits_result_and_proposal():
    g, bus = _graph_and_bus()
    OrientationRuntime(bus).run(g, correlation_id="o2")
    types = [e.type for e in bus.log]
    assert "orientation.result" in types
    assert "decision.proposal" in types
    # proposal is caused by the result (traceable chain, INV-5)
    res = [e for e in bus.log if e.type == "orientation.result"][-1]
    prop = [e for e in bus.log if e.type == "decision.proposal"][-1]
    assert prop.causation_id == res.id


class _AlgoV2:
    version = "philos@0.9-test"

    def orient(self, world_graph, context, goals, constraints) -> OrientationResult:
        return OrientationResult(orientation="v2 says go", confidence=0.9,
                                 recommended_actions=[{"action": "advance"}])


def test_algorithm_is_swappable():
    g, bus = _graph_and_bus()
    r = OrientationRuntime(bus, algorithm=_AlgoV2()).run(g, correlation_id="o3")
    assert r.orientation == "v2 says go"
    assert r.engine_version == "philos@0.9-test"
    res = [e for e in bus.log if e.type == "orientation.result"][-1]
    assert res.payload["engine_version"] == "philos@0.9-test"
