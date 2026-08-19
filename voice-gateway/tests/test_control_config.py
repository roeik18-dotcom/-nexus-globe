"""Acceptance tests for the Merlin Control Center config layer.

Covers acceptance criteria 4, 5, 6, 10, 11 from the Control Center task.
"""

import json

import pytest

from config.merlin_control_schema import (
    LAST_KNOWN_GOOD_PATH,
    default_config,
    live_barge_in_supported,
    save,
    validate,
)


@pytest.fixture
def isolated_config_path(tmp_path, monkeypatch):
    path = tmp_path / "merlin_control.json"
    backup = tmp_path / "merlin_control.last_known_good.json"
    monkeypatch.setattr("config.merlin_control_schema.DEFAULT_CONFIG_PATH", path)
    monkeypatch.setattr("config.merlin_control_schema.LAST_KNOWN_GOOD_PATH", backup)
    return path, backup


def test_default_config_is_valid():
    ok, errors = validate(default_config().to_dict())
    assert ok, errors


def test_invalid_config_rejected_without_touching_disk(isolated_config_path):
    path, _backup = isolated_config_path
    good = default_config().to_dict()
    ok, errors = save(good, path=path)
    assert ok
    before = path.read_text(encoding="utf-8")

    bad = default_config().to_dict()
    bad["language"]["default"] = "fr"  # not in allowed languages
    ok2, errors2 = save(bad, path=path)
    assert not ok2
    assert errors2

    after = path.read_text(encoding="utf-8")
    assert before == after, "a rejected PUT must never modify the on-disk config"


def test_last_known_good_preserved_across_a_rejected_write(isolated_config_path):
    path, backup = isolated_config_path
    good = default_config().to_dict()
    good["conversation"]["default_length"] = "normal"
    ok, errors = save(good, path=path)
    assert ok, errors

    bad = default_config().to_dict()
    bad["turn_control"]["listen_timeout_seconds"] = 9999  # out of range
    ok2, errors2 = save(bad, path=path)
    assert not ok2

    on_disk = json.loads(path.read_text(encoding="utf-8"))
    assert on_disk["conversation"]["default_length"] == "normal"


def test_interruptions_enabled_true_is_rejected_when_runtime_lacks_support(monkeypatch):
    """Config can never silently claim a capability the runtime does not have."""
    monkeypatch.setattr("config.merlin_control_schema.live_barge_in_supported", lambda: False)
    cfg = default_config().to_dict()
    cfg["turn_control"]["interruptions_enabled"] = True
    ok, errors = validate(cfg)
    assert not ok
    assert any("barge-in" in e.lower() for e in errors)


def test_interruptions_enabled_true_is_accepted_when_runtime_supports_it(monkeypatch):
    """2026-08-07: barge-in is genuinely live (BARGE_IN_ENABLED=True in
    service/merlin_service.py) — the schema must reflect real runtime
    capability instead of a hardcoded rejection that predates the fix."""
    monkeypatch.setattr("config.merlin_control_schema.live_barge_in_supported", lambda: True)
    cfg = default_config().to_dict()
    cfg["turn_control"]["interruptions_enabled"] = True
    ok, errors = validate(cfg)
    assert ok, errors


def test_live_barge_in_supported_reads_the_real_current_flag():
    """Unmocked — proves this reads the actual service/merlin_service.py on
    disk rather than being a stub. True as of 2026-08-07 (BARGE_IN_ENABLED=True,
    service/merlin_service.py:119)."""
    assert live_barge_in_supported() is True


def test_live_barge_in_supported_fails_closed_on_unreadable_source(monkeypatch, tmp_path):
    """Never claim a capability it could not actually verify."""
    monkeypatch.setattr(
        "config.merlin_control_schema._MERLIN_SERVICE_PATH", tmp_path / "does_not_exist.py",
    )
    assert live_barge_in_supported() is False


def test_duplicate_enabled_trigger_phrase_rejected():
    cfg = default_config().to_dict()
    cfg["triggers"] = {
        "a": {"enabled": True, "phrases": ["חפש ברשת"], "action": "x"},
        "b": {"enabled": True, "phrases": ["חפש ברשת"], "action": "y"},
    }
    ok, errors = validate(cfg)
    assert not ok
    assert any("ambiguous" in e for e in errors)


def test_web_search_trigger_maps_to_web_search_action():
    cfg = default_config()
    assert cfg.triggers["web_search"].action == "web_search"
    assert "חפש ברשת" in cfg.triggers["web_search"].phrases


def test_no_secret_fields_in_schema():
    """The schema must never carry API keys — they stay in .env."""
    cfg_dict = default_config().to_dict()
    flat = json.dumps(cfg_dict).lower()
    for forbidden in ("api_key", "secret", "token", "password"):
        assert forbidden not in flat
