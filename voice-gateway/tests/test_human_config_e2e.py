"""Human Config (אדם+) domain-boundary E2E tests.

Scope: the full request → routing contract → retrieval → domain-isolated
StructuredResult path for the HUMAN_CONFIG domain, end to end. Complements
(does not duplicate) the existing coverage:
  - tests/test_domain_router.py            — classify() keyword-cue unit tests only
  - tests/test_runtime_knowledge_fix.py    — _retrieve_human_config() against a
                                              FIXTURE master (missing/loaded/UNKNOWN)
  - tests/test_routing_probe_and_persona.py — zero-cue probe + persona narrative strip
  - orientation/tests/test_context_selector.py — orientation gating against FAKE routes

This file adds what none of those exercise: domain_router.route() (the full
classify+retrieve+log entry point, not just the internal helper) against the
REAL live Dropbox master; the production ContextBuilder.for_session("merlin", ...)
path for a human_config turn; the _domain_bucket / _emit_domain_audit
leak-detection contract for the "human_config" bucket specifically; and a
pinned regression for a known, currently-open retrieval gap.

Tests that require the real Dropbox human master are skipped (not failed) when
that file is unreachable in the running environment — they assert real
production data, not synthetic fixtures, so they are meaningful only where the
data exists, per the project's own "no giant config injection, no invented
content" honesty rule.
"""
from __future__ import annotations

import logging

import pytest

from app import master_config as mc
from app.domain_router import Domain, route


def _human_master_available() -> bool:
    return mc.human_master_path() is not None


requires_live_human_master = pytest.mark.skipif(
    not _human_master_available(),
    reason="real Human Config master (Dropbox קונפינג-אדם-MASTER-PRODUCTION-*.xlsx) not reachable in this environment",
)


# ── A. route() against the real master — representative Hebrew + English ──────

@requires_live_human_master
@pytest.mark.parametrize("query", [
    "קונפיג האדם",
    "מה אתה יודע על הערכים שלי?",
    "מה העקרונות שלי בעבודה?",
    "תזכיר לי מי אני",
    "what's my personal working style?",
    "human config",
    "מה אתה יודע על הדרך שאני מעדיף לעבוד?",
])
def test_human_config_query_routes_and_retrieves_from_real_master(query):
    rr = route(query)
    assert rr.domain is Domain.HUMAN_CONFIG
    assert rr.confidence > 0
    assert rr.context_text.strip(), "HUMAN_CONFIG route must inject real content, not an empty slice"
    assert rr.sources and all(s.status == "LOADED" for s in rr.sources)
    # every source is the real workbook, never the v1 profiles/*.yaml stub
    assert all(s.path.endswith(".xlsx") and "MASTER-PRODUCTION" in s.path for s in rr.sources)
    assert rr.retrieved_unit_ids, "no unit ids means nothing provenance-tagged was actually returned"


@requires_live_human_master
def test_general_chitchat_does_not_pull_human_master():
    rr = route("מה שלומך היום?")
    assert rr.domain is Domain.GENERAL
    assert rr.context_text == ""
    assert not rr.sources


# ── B. Provenance — never fabricated, always traceable to a real row ──────────

@requires_live_human_master
def test_human_config_provenance_is_real_not_fabricated():
    rr = route("קונפיג האדם")
    for s in rr.sources:
        # SourceRef.note carries "Canonical_ID=... Source_ID=..." set from the
        # real workbook row in master_config._master_route/prov(); a fabricated
        # or synthesized answer would have no such row-level trace.
        assert "Canonical_ID=" in s.note and "Source_ID=" in s.note
    for unit_id in rr.retrieved_unit_ids:
        assert unit_id and unit_id != "?"


@requires_live_human_master
def test_unscored_general_query_is_marked_representative_not_a_false_match():
    """A broad 'what do you know about me' style query with no strong token
    overlap falls back to a representative SAMPLE (master_config._query_master:
    `representative = not hits`) — it must still be real rows from the master,
    just not scored as relevant. Confirms this never silently becomes an
    invented summary."""
    res = mc.retrieve_human_master("askjdhaksjdh_no_real_overlap_zzz")
    assert res["status"] == "LOADED"
    assert res["representative"] is True
    assert res["rows"], "representative sample must still be real rows, not empty/invented"
    assert all(r["canonical_id"] for r in res["rows"])


# ── C. UNKNOWN handling — missing/unreadable master never silently degrades ──

def test_route_reports_unknown_when_human_master_unreachable(monkeypatch):
    monkeypatch.setattr(mc, "human_master_path", lambda: None)
    rr = route("קונפיג האדם")
    assert rr.domain is Domain.HUMAN_CONFIG
    # confidence here reflects CLASSIFICATION confidence (a clear keyword-cue
    # match), which is independent of whether retrieval then succeeds — the
    # retrieval-failure signal is sources[].status / fallback_reason / an
    # empty context_text, asserted below, not a dropped confidence score.
    assert rr.sources and rr.sources[0].status == "UNKNOWN"
    assert "not returned as authoritative" in rr.fallback_reason
    # the v1 profiles/person.yaml stub must never be silently promoted to
    # look like the master just because the master is offline
    assert "MASTER" not in rr.context_text
    assert rr.context_text == ""


def test_route_reports_unknown_when_human_master_unreadable(monkeypatch, tmp_path):
    bad = tmp_path / "קונפינג-אדם-MASTER-PRODUCTION-9.9-corrupt.xlsx"
    bad.write_text("not a real workbook", encoding="utf-8")
    monkeypatch.setattr(mc, "human_master_path", lambda: bad)
    rr = route("קונפיג האדם")
    assert rr.sources[0].status == "UNKNOWN"
    assert "unreadable" in rr.fallback_reason.lower() or "offline" in rr.fallback_reason.lower()


# ── D. Domain isolation — no cross-domain bleed, either direction ─────────────

@requires_live_human_master
def test_human_config_route_never_returns_music_or_philos_sources():
    rr = route("קונפיג האדם")
    for s in rr.sources:
        assert "MASTER_MUSIC" not in s.path
        assert "PHILOS-ORCHESTRATION" not in s.path


def test_music_and_philos_routes_never_return_human_master_path(monkeypatch):
    # music: force MUSIC_CONFIG regardless of live-file availability via a clear cue
    rr_music = route("קונפיג מוזיקה")
    assert rr_music.domain is Domain.MUSIC_CONFIG
    for s in rr_music.sources:
        assert "קונפינג-אדם" not in s.path and "MASTER-PRODUCTION" not in s.path

    rr_philos = route("מה קורה בפילוס?")
    assert rr_philos.domain is Domain.PHILOS
    for s in rr_philos.sources:
        assert "קונפינג-אדם" not in s.path and "MASTER-PRODUCTION" not in s.path


def test_domain_bucket_maps_human_config_correctly():
    from app.context_builder import _domain_bucket
    assert _domain_bucket("human_config") == "human_config"
    assert _domain_bucket(None) == "general"
    assert _domain_bucket("music_config") == "music_config"
    assert _domain_bucket("philos") == "philos"


def test_emit_domain_audit_strips_philos_leak_from_human_config_bucket(caplog):
    """Direct contract test for app.context_builder.ContextBuilder._emit_domain_audit,
    independent of whether today's for_session("merlin", ...) call site happens to
    include narrative layers. This is the same leak-scan mechanism that caught a
    real production bug on 2026-08-09 (see the _PHILOS_MARK comment in
    context_builder.py) — it must keep catching a reintroduced leak even if no
    current call site currently exercises it."""
    from app.context_builder import ContextBuilder

    class PersistentMemoryLayer:  # name matters: matched by class name in _NARRATIVE_LAYERS
        def render(self):
            return "recalled note: Philos value hub progress is strong this week"

    class OrientationLayer:
        def render(self):
            return "## HUMAN CONFIG MASTER — real human content, no leak"

    cb = ContextBuilder([PersistentMemoryLayer(), OrientationLayer()], bucket="human_config",
                        query="קונפיג האדם")
    with caplog.at_level(logging.ERROR, logger="app.context_builder"):
        out = cb.build()

    assert "Philos value hub" not in out                 # leaked section physically removed
    assert "HUMAN CONFIG MASTER" in out                  # legitimate domain content kept
    assert any("DOMAIN_ISOLATION_VIOLATION" in r.message for r in caplog.records)


def test_emit_domain_audit_clean_human_config_turn_has_no_violation(caplog):
    from app.context_builder import ContextBuilder

    class OrientationLayer:
        def render(self):
            return "## HUMAN CONFIG MASTER — clean content"

    cb = ContextBuilder([OrientationLayer()], bucket="human_config", query="קונפיג האדם")
    with caplog.at_level(logging.ERROR, logger="app.context_builder"):
        out = cb.build()

    assert "HUMAN CONFIG MASTER" in out
    assert not any("DOMAIN_ISOLATION_VIOLATION" in r.message for r in caplog.records)


@requires_live_human_master
def test_for_session_merlin_human_config_turn_excludes_other_masters():
    """Full production path: ContextBuilder.for_session(persona='merlin', query=...)
    is the exact call site used by the live adapter. A human_config turn must
    surface the human master and must not surface the music master path or the
    Philos orchestration doc path anywhere in the assembled prompt."""
    from app.context_builder import ContextBuilder

    cb = ContextBuilder.for_session("merlin", query="קונפיג האדם")
    assert cb._bucket == "human_config"
    prompt = cb.build()

    assert "MASTER_MUSIC" not in prompt
    assert "PHILOS-ORCHESTRATION-LAYER" not in prompt


# ── E. Formerly-open gap — fixed 2026-08-13, now a regression lock ────────────

@requires_live_human_master
def test_goal_aspiration_query_now_routes_correctly_via_direct_cues():
    """Was: 'מה המטרות והשאיפות שלי' (goals/aspirations) fell through to GENERAL
    (see MERLIN_KNOWLEDGE_GAP_REPORT.md §B and the 2026-08-13 Human Config audit
    addendum, finding #3). Root cause: no direct keyword cue for מטרות/שאיפות/
    יעדים, so the query depended on route()'s zero-cue content-token probe, which
    ties MUSIC/HUMAN 1-1 on the generic word and refuses to guess.

    Fixed 2026-08-13 by adding direct cues ("מטרות", "שאיפות", "יעדים", "goals",
    "aspirations") to domain_router._CUES[Domain.HUMAN_CONFIG]. Proven, not
    assumed: classify()'s cue match is a SUBSTRING check against the raw query
    (not a token match), so "מטרות" as a cue matches inside "המטרות" (with its
    ה prefix attached) directly — the fix routes the prefixed form too, without
    needing (and without depending on) any change to master_config._tokens().
    """
    from app.domain_router import classify

    assert classify("מה המטרות והשאיפות שלי") == (Domain.HUMAN_CONFIG, 1.0)
    assert classify("מטרות") == (Domain.HUMAN_CONFIG, 1.0)
    assert classify("יעדים שלי") == (Domain.HUMAN_CONFIG, 1.0)
    assert classify("goals") == (Domain.HUMAN_CONFIG, 1.0)

    rr = route("מה המטרות והשאיפות שלי")
    assert rr.domain is Domain.HUMAN_CONFIG
    assert rr.confidence == 1.0
    assert rr.context_text.strip()
    assert rr.sources and all(s.status == "LOADED" for s in rr.sources)
    assert all("MASTER-PRODUCTION" in s.path for s in rr.sources)


def test_hebrew_prefix_tokenizer_gap_still_unfixed_at_the_token_level():
    """Companion to the cue fix above: master_config._tokens() itself still has
    NO Hebrew prefix-stripping — a prefix-stripping fix was tried and reverted
    as unsafe (it corrupts real root words like 'מוזיקה' -> 'וזיקה'; see the
    audit addendum). The cue fix above routes the specific documented queries
    correctly via substring matching in classify(), but any HUMAN/MUSIC query
    that (a) has no matching keyword cue AND (b) uses a Hebrew-prefixed content
    word can still fail to be retrieved/ranked correctly by the token-based
    probe/scorer. This pins that the underlying tokenizer limitation is real
    and unchanged, so it isn't mistaken for fully resolved."""
    from app import master_config as mc

    assert mc._tokens("המטרות") == ["המטרות"]     # NOT normalized to "מטרות"
    assert mc._tokens("מטרות") == ["מטרות"]        # bare form still works fine
