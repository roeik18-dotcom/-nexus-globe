"""Tests for app.studio_index — read-only Studio ledger retrieval.

All tests use tmp_path fixtures / monkeypatched module paths; none touch the
real ~/Dropbox/-STUDIO-SYSTEM. This module is standalone (no domain_router or
master_config dependency), so these tests import only app.studio_index.
"""
from __future__ import annotations

import json

import pytest

from app import studio_index as si


def _project(id_, name, stage, **overrides):
    base = {
        "id": id_, "name": name, "folder": f"Projects/{name}",
        "head_set": f"{name}.als", "last_modified": "2026-08-01",
        "first_seen": "2020-01-01", "days_since_touched": 12,
        "backup_count": 5, "set_count": 1, "bounce_count": 0,
        "latest_bounce": None, "bounce_after_last_edit": None,
        "evidence": {"tempo": 120.0, "midi_tracks": 10, "audio_tracks": 2,
                     "return_tracks": 0, "live_version": "Ableton Live 11.2",
                     "master_chain_devices": 20, "parse_error": None},
        "inferred_stage": stage,
        "stage_basis": f"synthetic basis for {stage}",
        "revival_score": 50.0, "total_tracks": 12, "warnings": [],
    }
    base.update(overrides)
    return base


@pytest.fixture(autouse=True)
def _clear_cache():
    si._cache.clear()
    yield
    si._cache.clear()


def _write_ledger(tmp_path, monkeypatch, projects, scanned_at="2026-08-13 12:00"):
    ledger_dir = tmp_path / "ledger"
    ledger_dir.mkdir()
    ledger_file = ledger_dir / "ledger.json"
    ledger_file.write_text(json.dumps({
        "scanned_at": scanned_at, "studio_root": "/fake/DROBOX-ABLETON",
        "project_count": len(projects), "projects": projects,
    }, ensure_ascii=False), encoding="utf-8")
    overrides_file = ledger_dir / "overrides.json"
    focus_file = ledger_dir / "focus.json"
    monkeypatch.setattr(si, "_LEDGER_FILE", ledger_file)
    monkeypatch.setattr(si, "_OVERRIDES_FILE", overrides_file)
    monkeypatch.setattr(si, "_FOCUS_FILE", focus_file)
    return ledger_dir, ledger_file, overrides_file, focus_file


def test_missing_ledger_is_unknown(tmp_path, monkeypatch):
    monkeypatch.setattr(si, "_LEDGER_FILE", tmp_path / "nope.json")
    monkeypatch.setattr(si, "_OVERRIDES_FILE", tmp_path / "nope2.json")
    monkeypatch.setattr(si, "_FOCUS_FILE", tmp_path / "nope3.json")
    r = si.retrieve_studio_project("anything")
    assert r["status"] == "UNKNOWN"
    assert r["matches"] == []


def test_exact_name_match_returns_structured_record(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "SIA Project", "MIX")])
    r = si.retrieve_studio_project("SIA Project")
    assert r["status"] == "LOADED" and not r["ambiguous"] and not r["representative"]
    m = r["matches"][0]
    assert m["project_identity"]["id"] == "p1"
    assert m["status_stage"]["value"] == "MIX" and m["status_stage"]["source"] == "inferred"
    assert m["arrangement_state"]["status"] == "REACHED"
    assert m["mix_state"]["status"] == "REACHED"
    assert m["master_state"]["status"] == "NOT_YET"
    assert m["provenance"]["record_id"] == "p1"


def test_recording_state_always_unknown_no_fabrication(tmp_path, monkeypatch):
    """The ledger has zero recording/take-level data; this must never be
    inferred from track counts or filenames."""
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "Any Project", "MASTER")])
    r = si.retrieve_studio_project("Any Project")
    assert r["matches"][0]["recording_state"] == {
        "status": "UNKNOWN", "reason": "ledger has no recording/take-level data source"}


def test_duplicate_project_name_is_ambiguous_not_silently_resolved(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [
        _project("dup-a", "1-DUBSTEP", "SKETCH", folder="A/1-DUBSTEP"),
        _project("dup-b", "1-DUBSTEP", "SKETCH", folder="B/1-DUBSTEP"),
    ])
    r = si.retrieve_studio_project("1-DUBSTEP")
    assert r["ambiguous"] is True
    assert r["match_count"] == 2
    ids = {m["project_identity"]["id"] for m in r["matches"]}
    assert ids == {"dup-a", "dup-b"}


def test_generic_query_returns_representative_sample_by_revival_score(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [
        _project("low", "Low Score", "SKETCH", revival_score=10.0),
        _project("high", "High Score", "MIX", revival_score=90.0),
    ])
    r = si.retrieve_studio_project("what's happening in the studio")
    assert r["representative"] is True
    assert r["matches"][0]["project_identity"]["id"] == "high"


def test_override_stage_takes_precedence_and_is_labeled(tmp_path, monkeypatch):
    ledger_dir, _, overrides_file, _ = _write_ledger(
        tmp_path, monkeypatch, [_project("p1", "Overridden Project", "SKETCH")])
    overrides_file.write_text(json.dumps({"p1": {"stage": "MASTER", "note": "sent for master"}}),
                              encoding="utf-8")
    r = si.retrieve_studio_project("Overridden Project")
    m = r["matches"][0]
    assert m["status_stage"]["value"] == "MASTER"
    assert m["status_stage"]["source"] == "override"
    assert "SKETCH" in m["status_stage"]["basis"]      # original scanner stage still cited
    assert m["outstanding_tasks"] == {"status": "LOADED", "note": "sent for master"}


def test_no_override_note_is_unknown_not_empty_string(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "Plain Project", "SKETCH")])
    r = si.retrieve_studio_project("Plain Project")
    assert r["matches"][0]["outstanding_tasks"] == {
        "status": "UNKNOWN", "reason": "no overrides.json note recorded for this project"}


def test_mixdown_inferred_stage_maps_to_master_via_focus_py_table(tmp_path, monkeypatch):
    """MIXDOWN isn't in the 6-stage pipeline itself — it maps to MASTER,
    exactly as ~/Dropbox/-STUDIO-SYSTEM/bin/focus.py's own INFERRED_TO_STAGE
    does, so this module's derived states agree with the studio system."""
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "Bounced Project", "MIXDOWN")])
    m = si.retrieve_studio_project("Bounced Project")["matches"][0]
    assert m["status_stage"]["canonical_stage"] == "MASTER"
    assert m["master_state"]["status"] == "REACHED"


def test_dropped_stage_has_unknown_progress_not_guessed(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "Killed Project", "DROPPED")])
    m = si.retrieve_studio_project("Killed Project")["matches"][0]
    assert m["status_stage"]["canonical_stage"] is None
    assert m["arrangement_state"]["status"] == "UNKNOWN"
    assert m["mix_state"]["status"] == "UNKNOWN"


def test_stale_ledger_is_flagged(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "SKETCH")],
                  scanned_at="2020-01-01 00:00")
    r = si.retrieve_studio_project("X")
    assert r["ledger"]["stale"] is True
    assert r["ledger"]["age_days"] > si._STALE_LEDGER_DAYS


def test_fresh_ledger_is_not_stale(tmp_path, monkeypatch):
    import datetime
    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M")
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "SKETCH")], scanned_at=now)
    r = si.retrieve_studio_project("X")
    assert r["ledger"]["stale"] is False


def test_active_project_unknown_when_focus_file_absent(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "SKETCH")])
    r = si.retrieve_studio_project("X")
    assert r["active_project"]["status"] == "UNKNOWN"


def test_active_project_loaded_when_focus_file_present(tmp_path, monkeypatch):
    _, _, _, focus_file = _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "SKETCH")])
    focus_file.write_text(json.dumps({
        "active": {"id": "p1", "name": "X", "folder": "Projects/X",
                    "stage": "SKETCH", "started": "2026-08-10", "sessions": []},
        "history": [],
    }), encoding="utf-8")
    r = si.retrieve_studio_project("X")
    assert r["active_project"]["status"] == "LOADED"
    assert r["active_project"]["id"] == "p1"


def test_technical_notes_reports_only_real_evidence_fields(tmp_path, monkeypatch):
    """No fabricated plugin/session state: only literal evidence values,
    nothing invented (no plugin names, no LUFS numbers, etc.)."""
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "MIX")])
    notes = si.retrieve_studio_project("X")["matches"][0]["technical_notes"]
    assert notes["tempo_bpm"] == 120.0
    assert notes["master_chain_device_count"] == 20
    assert set(notes.keys()) == {
        "status", "tempo_bpm", "live_version", "midi_tracks", "audio_tracks",
        "return_tracks", "master_chain_device_count", "backup_count",
        "bounce_count", "latest_bounce", "bounce_after_last_edit",
        "parse_error", "warnings",
    }


def test_referenced_paths_uses_studio_root_and_folder(tmp_path, monkeypatch):
    _write_ledger(tmp_path, monkeypatch, [_project("p1", "X", "MIX")])
    paths = si.retrieve_studio_project("X")["matches"][0]["referenced_paths"]
    assert paths["status"] == "LOADED"
    assert paths["folder_relative"] == "Projects/X"
    assert paths["folder_absolute"] == "/fake/DROBOX-ABLETON/Projects/X"
    assert paths["head_set_file"] == "X.als"


def test_no_domain_router_or_master_config_import():
    """This adapter must stay standalone this batch — no coupling with the
    shared routing files. Checked via the AST (not a substring search) so the
    module's own docstring, which names both files in prose, can't trip it."""
    import ast
    tree = ast.parse(open(si.__file__, encoding="utf-8").read())
    imported = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            imported.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module)
    assert not any("domain_router" in m or "master_config" in m for m in imported)
