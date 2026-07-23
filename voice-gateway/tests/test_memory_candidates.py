"""Tests for MemoryCandidateRegistry and the propose → approve/reject flow."""

import json

import pytest

import app.memory_promotion as mp
import app.context_builder as cb_module
from app.memory_candidates import MemoryCandidateRegistry, PERSONAL_CATEGORIES
from app.context_builder import ContextBuilder


@pytest.fixture(autouse=True)
def patch_dirs(tmp_path, monkeypatch):
    monkeypatch.setattr(mp, "_MEMORY_DIR", tmp_path)
    monkeypatch.setattr(cb_module, "_MEMORY_DIR", tmp_path)
    return tmp_path


@pytest.fixture
def reg():
    return MemoryCandidateRegistry()


def _propose(reg, session_id="s1", persona="jarvis", key="lang", value="Hebrew",
             category="general", **kwargs):
    return reg.propose(session_id, persona, key, value, category, **kwargs)


# --- propose does not touch disk ---

def test_propose_does_not_write_to_disk(reg, tmp_path):
    _propose(reg)
    assert not (tmp_path / "jarvis.json").exists()


# --- approve writes to disk ---

def test_approve_writes_to_disk(reg, tmp_path):
    c = _propose(reg, key="owner", value="Roei")
    mp.promote(c.persona, c.key, c.value)
    data = json.loads((tmp_path / "jarvis.json").read_text(encoding="utf-8"))
    assert data["owner"] == "Roei"


# --- reject does not touch disk ---

def test_reject_does_not_write_to_disk(reg, tmp_path):
    c = _propose(reg)
    reg.remove("s1", c.id)
    assert not (tmp_path / "jarvis.json").exists()


# --- idempotency by key ---

def test_approve_twice_does_not_create_duplicate(reg, tmp_path):
    c = _propose(reg, key="owner", value="Roei")
    mp.promote(c.persona, c.key, c.value)
    mp.promote(c.persona, c.key, c.value)
    data = json.loads((tmp_path / "jarvis.json").read_text(encoding="utf-8"))
    assert list(data.keys()).count("owner") == 1
    assert data["owner"] == "Roei"


# --- candidate removed after approval ---

def test_candidate_removed_after_approval(reg):
    c = _propose(reg)
    mp.promote(c.persona, c.key, c.value)
    reg.remove("s1", c.id)
    assert reg.get("s1", c.id) is None


# --- session isolation ---

def test_candidates_isolated_by_session(reg):
    _propose(reg, session_id="s1", key="k1")
    _propose(reg, session_id="s2", key="k2")
    s1_keys = [c.key for c in reg.list("s1")]
    s2_keys = [c.key for c in reg.list("s2")]
    assert "k2" not in s1_keys
    assert "k1" not in s2_keys


def test_get_returns_none_for_wrong_session(reg):
    c = _propose(reg, session_id="s1")
    assert reg.get("s2", c.id) is None


# --- persona stored in candidate ---

def test_candidate_stores_persona(reg):
    c = _propose(reg, persona="jarvis")
    assert c.persona == "jarvis"


def test_approve_uses_candidates_persona(reg, tmp_path):
    c_j = _propose(reg, session_id="s1", persona="jarvis", key="pref", value="short")
    c_p = _propose(reg, session_id="s1", persona="philos", key="mode", value="analysis", category="fact")
    mp.promote(c_j.persona, c_j.key, c_j.value)
    mp.promote(c_p.persona, c_p.key, c_p.value)
    assert (tmp_path / "jarvis.json").exists()
    assert (tmp_path / "philos.json").exists()
    assert "pref" not in json.loads((tmp_path / "philos.json").read_text())
    assert "mode" not in json.loads((tmp_path / "jarvis.json").read_text())


# --- philos policy ---

def test_philos_blocked_from_preference(reg):
    with pytest.raises(ValueError, match="philos"):
        _propose(reg, persona="philos", category="preference")


def test_philos_blocked_from_personal(reg):
    with pytest.raises(ValueError, match="philos"):
        _propose(reg, persona="philos", category="personal")


def test_philos_blocked_from_identity(reg):
    with pytest.raises(ValueError, match="philos"):
        _propose(reg, persona="philos", category="identity")


def test_philos_allows_general_category(reg):
    c = _propose(reg, persona="philos", category="general")
    assert c is not None


def test_philos_allows_fact_category(reg):
    c = _propose(reg, persona="philos", category="fact")
    assert c is not None


def test_jarvis_allows_all_personal_categories(reg):
    for cat in PERSONAL_CATEGORIES:
        c = _propose(reg, persona="jarvis", category=cat)
        assert c is not None


# --- validation ---

def test_empty_key_raises(reg):
    with pytest.raises(ValueError):
        reg.propose("s1", "jarvis", "", "val", "general")


def test_whitespace_key_raises(reg):
    with pytest.raises(ValueError):
        reg.propose("s1", "jarvis", "   ", "val", "general")


# --- candidate structure ---

def test_candidate_has_unique_id(reg):
    c1 = _propose(reg, key="a")
    c2 = _propose(reg, key="b")
    assert c1.id != c2.id


def test_candidate_stores_all_fields(reg):
    c = _propose(reg, key="pref", value="short", category="preference",
                 reason="stated explicitly", source="session", confidence=0.9)
    assert c.key == "pref"
    assert c.value == "short"
    assert c.category == "preference"
    assert c.reason == "stated explicitly"
    assert c.source == "session"
    assert c.confidence == 0.9
    assert c.proposed_at


def test_candidate_key_is_stripped(reg):
    c = _propose(reg, key="  lang  ")
    assert c.key == "lang"


# --- list ---

def test_list_returns_all_candidates(reg):
    _propose(reg, key="a")
    _propose(reg, key="b")
    assert len(reg.list("s1")) == 2


def test_list_empty_when_no_candidates(reg):
    assert reg.list("ghost") == []


# --- remove ---

def test_remove_deletes_candidate(reg):
    c = _propose(reg)
    reg.remove("s1", c.id)
    assert reg.get("s1", c.id) is None


def test_remove_unknown_id_is_silent(reg):
    reg.remove("s1", "nonexistent")  # must not raise


def test_remove_returns_true_when_found(reg):
    c = _propose(reg)
    assert reg.remove("s1", c.id) is True


def test_remove_returns_false_when_not_found(reg):
    assert reg.remove("s1", "fake") is False


# --- clear ---

def test_clear_removes_all_candidates_for_session(reg):
    _propose(reg)
    _propose(reg)
    reg.clear("s1")
    assert reg.list("s1") == []


def test_clear_does_not_affect_other_sessions(reg):
    _propose(reg, session_id="s1")
    _propose(reg, session_id="s2")
    reg.clear("s1")
    assert len(reg.list("s2")) == 1


def test_clear_missing_session_is_silent(reg):
    reg.clear("ghost")  # must not raise


# --- ContextBuilder only sees approved memory ---

def test_context_builder_excludes_unapproved_candidate(reg):
    _propose(reg, key="new_pref", value="terse")
    result = ContextBuilder.for_session("jarvis").build()
    assert "new_pref" not in result


def test_context_builder_includes_approved_memory(reg, tmp_path):
    c = _propose(reg, key="new_pref", value="terse")
    mp.promote(c.persona, c.key, c.value)
    result = ContextBuilder.for_session("jarvis").build()
    assert "new_pref" in result
