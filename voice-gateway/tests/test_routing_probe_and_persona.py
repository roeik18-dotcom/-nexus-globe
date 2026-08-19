"""Zero-cue master-retrieval probe + general persona narrative suppression.

Probe rule (domain_router.route): when keyword classification yields GENERAL,
score the query against the MUSIC and HUMAN masters by content-token overlap and
route to a CLEAR winner (strictly greater, >= _PROBE_MIN_OVERLAP). Ties / no
overlap stay GENERAL — no keyword-list growth, no false routing.

Persona rule (context_builder): a merlin GENERAL turn strips the project/Philos/
About-Roei narrative from the persona so it never volunteers Philos.
"""
import app.domain_router as dr
from app.context_builder import PersonaLayer, _strip_persona_narrative


def test_probe_clear_music_winner_routes_music(monkeypatch):
    monkeypatch.setattr(dr, "master_probe_scores", lambda q: {"music_config": 2, "human_config": 0},
                        raising=False)
    # master_probe_scores is imported inside route(); patch the source module too
    import app.master_config as mc
    monkeypatch.setattr(mc, "master_probe_scores", lambda q: {"music_config": 2, "human_config": 0})
    monkeypatch.setattr(dr, "_retrieve_music_config",
                        lambda q: dr.RouteResult(domain=dr.Domain.MUSIC_CONFIG, query=q, confidence=0.5))
    rr = dr.route("some uncued content word")
    assert rr.domain is dr.Domain.MUSIC_CONFIG


def test_probe_clear_human_winner_routes_human(monkeypatch):
    import app.master_config as mc
    monkeypatch.setattr(mc, "master_probe_scores", lambda q: {"music_config": 0, "human_config": 3})
    monkeypatch.setattr(dr, "_retrieve_human_config",
                        lambda q: dr.RouteResult(domain=dr.Domain.HUMAN_CONFIG, query=q, confidence=0.5))
    rr = dr.route("some uncued content word")
    assert rr.domain is dr.Domain.HUMAN_CONFIG


def test_probe_tie_stays_general(monkeypatch):
    import app.master_config as mc
    monkeypatch.setattr(mc, "master_probe_scores", lambda q: {"music_config": 1, "human_config": 1})
    rr = dr.route("ambiguous words shared by both")
    assert rr.domain is dr.Domain.GENERAL


def test_probe_zero_overlap_stays_general(monkeypatch):
    import app.master_config as mc
    monkeypatch.setattr(mc, "master_probe_scores", lambda q: {"music_config": 0, "human_config": 0})
    rr = dr.route("truly unrelated question")
    assert rr.domain is dr.Domain.GENERAL


def test_explicit_cue_unaffected_by_probe(monkeypatch):
    # a cue-matched query must NOT even consult the probe
    called = {"n": 0}
    import app.master_config as mc
    def _spy(q):
        called["n"] += 1
        return {"music_config": 9, "human_config": 9}
    monkeypatch.setattr(mc, "master_probe_scores", _spy)
    d, _ = dr.classify("מה מצב קונפיג מוזיקה")
    assert d is dr.Domain.MUSIC_CONFIG            # cue already decided it
    # route() on a GENERAL-classified query is the only probe caller
    assert called["n"] == 0


def test_persona_strip_removes_project_narrative():
    stripped = PersonaLayer("merlin", keep_project_narrative=False).render()
    assert "## Persona" in stripped and "## Responsibilities" in stripped
    for gone in ("## Projects", "## About Roei", "Philos"):
        assert gone not in stripped, gone


def test_persona_full_keeps_narrative():
    full = PersonaLayer("merlin", keep_project_narrative=True).render()
    assert "## Projects" in full and "Philos" in full


def test_strip_helper_is_section_scoped():
    md = "# T\n## Persona\nkeep\n## Projects\ndrop\n## Responsibilities\nkeep2\n## About Roei\ndrop2"
    out = _strip_persona_narrative(md)
    assert "keep" in out and "keep2" in out
    assert "drop" not in out and "drop2" not in out
