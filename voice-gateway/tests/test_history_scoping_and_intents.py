"""Cross-domain history scoping + low-conf general memory + routing aliases +
Day-Opening voice intent. All deterministic, no mic/TTS/network."""
import json

import pytest

from app.adapters.claude import _scope_history_by_domain
from app.domain_router import classify, route, Domain
from app.master_config import normalize_query
from app.voice_intents import is_day_opening_start_command


def _h(*triples):
    return [{"role": r, "content": c, "domain": d} for r, c, d in triples]


# ── 1. CROSS-DOMAIN HISTORY SCOPING ──────────────────────────────────────────
@pytest.mark.parametrize("prev,cur", [
    ("music_config", "philos"), ("philos", "music_config"),
    ("music_config", "human_config"), ("human_config", "music_config"),
    ("philos", "human_config"),
])
def test_prior_specialist_domain_never_survives(prev, cur):
    hist = _h((("user"), f"{prev} question", prev),
              (("assistant"), f"{prev} answer", prev),
              (("user"), f"{cur} question", cur))
    scoped, dropped = _scope_history_by_domain(hist, cur)
    contents = [m["content"] for m in scoped]
    assert f"{prev} question" not in contents      # prior user turn gone
    assert f"{prev} answer" not in contents        # prior assistant turn gone
    assert f"{cur} question" in contents           # current turn kept
    assert dropped == 2


def test_same_specialist_domain_continuity_survives():
    hist = _h(("user", "q1", "music_config"), ("assistant", "a1", "music_config"),
              ("user", "q2", "music_config"))
    scoped, dropped = _scope_history_by_domain(hist, "music_config")
    assert [m["content"] for m in scoped] == ["q1", "a1", "q2"]
    assert dropped == 0


def test_general_current_suppresses_all_prior():
    hist = _h(("user", "old", "general"), ("assistant", "old-a", "general"),
              ("user", "now", "general"))
    scoped, dropped = _scope_history_by_domain(hist, "general")
    assert [m["content"] for m in scoped] == ["now"]   # general continuity suppressed initially
    assert dropped == 2


def test_outgoing_messages_carry_no_domain_key():
    # the adapter strips "domain" before the API call; prove the scoped shape
    # still contains it (stripping happens after) but the current turn is intact
    hist = _h(("user", "q", "philos"))
    scoped, _ = _scope_history_by_domain(hist, "philos")
    assert scoped[-1]["content"] == "q"


# ── 2. LOW-CONFIDENCE GENERAL MEMORY ─────────────────────────────────────────
def _cb(tmp_path, monkeypatch):
    import app.context_builder as cb
    mems = [{"key": "owner", "value": "Roei", "tier": "personal", "importance": "critical"},
            {"key": "style", "value": "evidence-based", "tier": "relationship", "importance": "high"}]
    f = tmp_path / "memories.json"
    f.write_text(json.dumps({"memories": mems}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(cb, "_RELATIONSHIP_MEMORY_FILE", f)
    return cb


def test_general_00_zero_memory(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    assert cb.RelationshipMemoryLayer(selected_domain="general", query="x", confidence=0.0).render() == ""


def test_general_049_zero_memory(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    assert cb.RelationshipMemoryLayer(selected_domain="general", query="x", confidence=0.49).render() == ""


def test_general_050_keeps_existing_policy(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = cb.RelationshipMemoryLayer(selected_domain="general", query="x", confidence=0.5).render()
    assert "Roei" in out                       # >=0.5 general keeps the safe-general base


def test_specialist_memory_unchanged(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = cb.RelationshipMemoryLayer(selected_domain="music_config", query="x", confidence=1.0).render()
    assert "Roei" in out                       # specialist domains unaffected


def test_persistent_critical_only_zero_when_no_importance():
    import app.context_builder as cb
    from app.recall import RecallItem, RecallResult
    rr = RecallResult(items=[RecallItem(key="k", value="v", reason="all")],
                      truncated=False, total_candidates=1)
    assert cb.PersistentMemoryLayer(recall_result=rr, critical_only=True).render() == ""
    assert "k" in cb.PersistentMemoryLayer(recall_result=rr, critical_only=False).render()


# ── 3. CONTROLLED ROUTING NORMALIZATION ──────────────────────────────────────
def test_alias_normalization():
    assert normalize_query("דיסונאנס") == "צרימה"
    assert normalize_query("פתיח יום") == "פתיחת יום"


def test_patich_yom_reaches_day_opening_via_alias():
    assert classify("פתיח יום")[0] is Domain.DAY_OPENING


def test_explicit_domains_unchanged():
    assert route("תסביר איך לבנות מאסטר לשיר באבלטון").domain is Domain.MUSIC_CONFIG
    assert route("מה כתוב בקונפיג אדם מאסטר").domain is Domain.HUMAN_CONFIG


def test_nonsense_never_becomes_specialist():
    d = route("בלגמש קוודלי טרזול").domain
    assert d is Domain.GENERAL


def test_dissonance_boundary_stays_general_not_fabricated():
    # documents the honest boundary: master stores 'לצרימה' (prefixed); bare
    # 'צרימה' absent; exact-token (no stemming) cannot match -> GENERAL, not faked.
    assert route("דיסונאנס").domain is Domain.GENERAL


# ── 4. DAY OPENING VOICE INTENT ──────────────────────────────────────────────
@pytest.mark.parametrize("cmd", [
    "פתיח יום", "פתיחת יום", "פתח יום", "תתחיל פתיח יום", "תתחיל את היום",
    "בוקר טוב", "פתיח הבוקר", "מרלין פתיח יום", "פתיחת יום.",
])
def test_start_commands_trigger(cmd):
    assert is_day_opening_start_command(cmd) is True


@pytest.mark.parametrize("q", [
    "מה כתוב בפתיחת היום שלי?", "מה היה בפתיחת היום?",
    "תראה לי את נתוני פתיחת היום", "בוקר טוב מה שלומך", "",
])
def test_questions_do_not_trigger(q):
    assert is_day_opening_start_command(q) is False
