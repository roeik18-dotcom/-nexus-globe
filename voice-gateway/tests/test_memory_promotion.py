"""Tests for memory_promotion.promote()."""

import json
from pathlib import Path

import pytest

import app.memory_promotion as mp


@pytest.fixture(autouse=True)
def patch_memory_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(mp, "_MEMORY_DIR", tmp_path)
    return tmp_path


def _read(tmp_path, persona="jarvis") -> dict:
    return json.loads((tmp_path / f"{persona}.json").read_text(encoding="utf-8"))


# --- basic writes ---

def test_creates_file_when_missing(tmp_path):
    mp.promote("jarvis", "owner", "Roei")
    assert (tmp_path / "jarvis.json").exists()


def test_sets_string_value(tmp_path):
    mp.promote("jarvis", "owner", "Roei")
    assert _read(tmp_path)["owner"] == "Roei"


def test_sets_list_value(tmp_path):
    mp.promote("jarvis", "tags", ["a", "b"])
    assert _read(tmp_path)["tags"] == ["a", "b"]


def test_sets_dict_value(tmp_path):
    mp.promote("jarvis", "meta", {"k": "v"})
    assert _read(tmp_path)["meta"] == {"k": "v"}


def test_sets_null_value(tmp_path):
    mp.promote("jarvis", "cleared", None)
    assert _read(tmp_path)["cleared"] is None


def test_sets_numeric_value(tmp_path):
    mp.promote("jarvis", "count", 42)
    assert _read(tmp_path)["count"] == 42


# --- updates ---

def test_overwrites_existing_key(tmp_path):
    mp.promote("jarvis", "owner", "old")
    mp.promote("jarvis", "owner", "new")
    assert _read(tmp_path)["owner"] == "new"


def test_preserves_other_keys(tmp_path):
    (tmp_path / "jarvis.json").write_text(
        json.dumps({"owner": "Roei", "notes": []}), encoding="utf-8"
    )
    mp.promote("jarvis", "lang", "he")
    data = _read(tmp_path)
    assert data["owner"] == "Roei"
    assert data["notes"] == []
    assert data["lang"] == "he"


def test_strips_key_whitespace(tmp_path):
    mp.promote("jarvis", "  owner  ", "Roei")
    assert "owner" in _read(tmp_path)
    assert "  owner  " not in _read(tmp_path)


# --- validation ---

def test_empty_key_raises():
    with pytest.raises(ValueError):
        mp.promote("jarvis", "", "value")


def test_whitespace_only_key_raises():
    with pytest.raises(ValueError):
        mp.promote("jarvis", "   ", "value")


# --- multiple personas ---

def test_different_personas_do_not_share_memory(tmp_path):
    mp.promote("jarvis", "owner", "Roei")
    mp.promote("philos", "focus", "analysis")
    assert "focus" not in _read(tmp_path, "jarvis")
    assert "owner" not in _read(tmp_path, "philos")


# --- atomic write ---

def test_result_is_valid_json(tmp_path):
    mp.promote("jarvis", "key", {"nested": [1, 2]})
    raw = (tmp_path / "jarvis.json").read_text(encoding="utf-8")
    parsed = json.loads(raw)  # must not raise
    assert parsed["key"] == {"nested": [1, 2]}


def test_no_tmp_file_left_after_write(tmp_path):
    mp.promote("jarvis", "key", "val")
    assert not (tmp_path / "jarvis.json.tmp").exists()


# --- directory creation ---

def test_creates_memory_dir_when_missing(tmp_path, monkeypatch):
    nested = tmp_path / "deep" / "nested"
    monkeypatch.setattr(mp, "_MEMORY_DIR", nested)
    mp.promote("jarvis", "x", 1)
    assert (nested / "jarvis.json").exists()
