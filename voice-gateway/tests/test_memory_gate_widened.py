"""Fix #1 — widened relationship-memory gate.

general / low-confidence => ONLY personal + relationship memory.
specific domain => personal + relationship + project memory RELEVANT to that domain.
philos/nexus => only in a philos turn. selected_domain=None => no gating.
"""
import json
import pytest


MEMS = [
    {"key": "project_philos", "value": "philos orientation engine", "tier": "project",
     "category": "project", "importance": "high", "tags": ["philos"]},
    {"key": "project_nexus", "value": "nexus-globe repo", "tier": "project",
     "category": "project", "importance": "high", "tags": ["nexus"]},
    {"key": "studio_rme", "value": "RME Babyface routing in the studio", "tier": "project",
     "category": "studio", "importance": "high", "tags": ["studio"]},
    {"key": "music_identity", "value": "psytrance genre, melody and vocal arrangement", "tier": "project",
     "category": "music", "importance": "high", "tags": ["music"]},
    {"key": "audio_transcription", "value": "hebrew transcription and merlin stt status", "tier": "project",
     "category": "runtime", "importance": "high", "tags": ["audio"]},
    {"key": "owner_name", "value": "Roei", "tier": "personal", "category": "person",
     "importance": "critical", "tags": []},
    {"key": "comm_style", "value": "prefers evidence-based debugging", "tier": "relationship",
     "category": "preference", "importance": "high", "tags": []},
]


def _cb(tmp_path, monkeypatch):
    import app.context_builder as cb
    f = tmp_path / "memories.json"
    f.write_text(json.dumps({"memories": MEMS}, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(cb, "_RELATIONSHIP_MEMORY_FILE", f)
    return cb


def _out(cb, **kw):
    return cb.RelationshipMemoryLayer(**kw).render()


def test_general_only_personal_and_relationship(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="general", query="מה קורה")
    assert "Roei" in out and "evidence-based" in out                 # personal + relationship kept
    for leak in ("orientation engine", "nexus-globe", "RME Babyface", "psytrance", "transcription"):
        assert leak not in out, leak                                  # no project/philos leak


def test_studio_turn_gets_studio_project_not_music_or_philos(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="studio_project", query="מה מצב האולפן")
    assert "RME Babyface" in out and "Roei" in out                   # relevant project + personal
    for leak in ("psytrance", "orientation engine", "nexus-globe", "transcription"):
        assert leak not in out, leak


def test_music_turn_gets_music_project_not_studio(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="music_config", query="הזהות המוזיקלית")
    assert "psytrance" in out and "Roei" in out
    assert "RME Babyface" not in out and "orientation engine" not in out


def test_philos_turn_allows_philos_and_nexus(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="philos", query="מה חדש בפילוס")
    assert "orientation engine" in out and "nexus-globe" in out and "Roei" in out
    assert "RME Babyface" not in out and "psytrance" not in out


def test_runtime_turn_gets_transcription_memory(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="runtime", query="מה מצב מרלין")
    assert "transcription" in out and "Roei" in out
    assert "psytrance" not in out and "orientation engine" not in out


def test_low_confidence_specific_domain_treated_as_general(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain="music_config", query="…", confidence=0.2)
    assert "Roei" in out and "psytrance" not in out                  # low conf => general behavior


def test_none_domain_no_gating_backward_compat(tmp_path, monkeypatch):
    cb = _cb(tmp_path, monkeypatch)
    out = _out(cb, selected_domain=None)
    for keep in ("orientation engine", "RME Babyface", "psytrance", "Roei"):
        assert keep in out, keep                                     # non-merlin persona unchanged
