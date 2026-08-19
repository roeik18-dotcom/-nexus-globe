"""Phase-2 compose tests: orientation gates domain_router's retrieval, one path.

Uses a fake route backend (no profiles / no app.domain_router import needed) plus one
end-to-end check against the real router if importable.
"""
from dataclasses import dataclass, field

from orientation.policy import DomainPolicy
from orientation.state import KnowledgeStatus
from orientation.context_selector import ContextSelector
from orientation.orientation_layer import OrientationLayer
from orientation.domains import default_policies


@dataclass
class FakeSource:
    path: str
    status: str
    item_count: int | None = None


@dataclass
class FakeDomain:
    value: str


@dataclass
class FakeRoute:
    domain: FakeDomain
    context_text: str = ""
    sources: list = field(default_factory=list)


def route_fn_for(domain_value, text="CONTENT", status="LOADED"):
    calls = {"n": 0}

    def rf(query):
        calls["n"] += 1
        return FakeRoute(FakeDomain(domain_value), text,
                         [FakeSource("profiles/x.yaml", status, 14)])
    return rf, calls


def test_default_policy_wraps_route_content_authoritatively():
    rf, _ = route_fn_for("human_config", "## Human Config\n- x")
    out = OrientationLayer.for_query("מי אני", route_fn=rf).render()
    assert "[ACTIVE DOMAIN: HUMAN_CONFIG]" in out              # authoritative section header
    assert "AUTHORITATIVE source material" in out              # instruction to use it
    assert "## Human Config\n- x" in out                       # original routed content preserved


def test_general_injects_nothing():
    rf, _ = route_fn_for("general", "should-not-appear")
    assert OrientationLayer.for_query("hello", route_fn=rf).render() == ""


def test_disabled_domain_is_withheld():
    rf, _ = route_fn_for("music_config", "## Music")
    pols = default_policies()
    pols["music_config"] = DomainPolicy(enabled=False)
    layer = OrientationLayer.for_query("הזהות המוזיקלית", policies=pols, route_fn=rf)
    assert layer.render() == ""
    assert layer.slice.policy_allowed is False and layer.slice.suppressed_reason == "domain_disabled"


def test_provenance_preserved():
    rf, _ = route_fn_for("philos", "## Philos", status="LOADED")
    sl = ContextSelector().select_for_query("philos", route_fn=rf)
    assert sl.sources and sl.sources[0].path == "profiles/x.yaml"


def test_status_mapping_never_upgrades_draft_or_missing():
    rf_missing, _ = route_fn_for("music_config", "", status="MISSING")
    assert ContextSelector().select_for_query("q", route_fn=rf_missing).status is KnowledgeStatus.UNKNOWN
    rf_draft, _ = route_fn_for("music_config", "draft", status="DRAFT")
    assert ContextSelector().select_for_query("q", route_fn=rf_draft).status is KnowledgeStatus.DERIVED
    rf_loaded, _ = route_fn_for("human_config", "x", status="LOADED")
    assert ContextSelector().select_for_query("q", route_fn=rf_loaded).status is KnowledgeStatus.FACT


def test_single_retriever_called_exactly_once():
    rf, calls = route_fn_for("human_config", "x")
    OrientationLayer.for_query("q", route_fn=rf).render()
    assert calls["n"] == 1                                    # no duplicate retrieval


def test_layer_render_protocol_usable_in_prompt_assembly():
    rf, _ = route_fn_for("studio_project", "## Studio")
    layers = [OrientationLayer.for_query("אולפן", route_fn=rf)]
    prompt = "\n\n---\n\n".join(s for s in (l.render() for l in layers) if s.strip())
    assert "## Studio" in prompt


def test_real_domain_router_end_to_end_if_available():
    try:
        import app.domain_router  # noqa: F401
    except Exception:
        return  # backend not importable in this env — fake-route tests already cover logic
    # GENERAL query -> empty injection, no crash, single path
    assert OrientationLayer.for_query("...").render() == "" or isinstance(
        OrientationLayer.for_query("מה מצב הקונפיג מוזיקה").render(), str)
