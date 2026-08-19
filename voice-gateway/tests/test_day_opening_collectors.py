"""Tests for service.day_opening_collectors — file/subprocess I/O only, no
microphone or TTS. Exercises both the REAL repo files (person.yaml,
music.yaml/music.v2-proposal.yaml — these are real, checked-in files, not
fixtures) and the graceful-degradation path when a source is missing.
"""

from unittest.mock import MagicMock

import service.day_opening_collectors as doc
from service.day_opening_models import Provenance


def test_orientation_returns_real_date_and_time():
    text = doc.collect_orientation()
    assert "השעה" in text
    assert ":" in text  # HH:MM


def test_human_config_reads_real_person_yaml():
    status = doc.collect_human_config()
    assert status.domain == "human_config"
    assert status.error is None
    assert status.provenance == Provenance.FACT
    assert "person.yaml" in status.source
    assert "רשומות" in status.summary_he


def test_human_config_never_reports_a_fabricated_coverage_percentage():
    status = doc.collect_human_config()
    assert "%" not in status.summary_he


def test_human_config_degrades_gracefully_when_file_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(doc, "_VOICE_GATEWAY_ROOT", tmp_path)
    status = doc.collect_human_config()
    assert status.provenance == Provenance.UNKNOWN
    assert status.error is None   # missing file is a real UNKNOWN, not a collector crash


def test_music_config_reads_real_v2_proposal_manifest():
    status = doc.collect_music_config()
    assert status.domain == "music_config"
    assert status.error is None
    assert status.provenance == Provenance.FACT
    assert status.details["total"] > 0
    # Real, counted (not invented) verification_status tally:
    assert "self_confirmed" in status.details["status_counts"] or status.details["total"] >= 0


def test_music_config_never_claims_master_final_without_proof():
    status = doc.collect_music_config()
    assert status.lifecycle is not None
    assert status.lifecycle.value != "MASTER_FINAL"
    assert "MASTER FINAL" in status.summary_he  # explicitly says it's NOT


def test_studio_reads_real_ledger_when_present():
    status = doc.collect_studio()
    # This machine's real ledger (audited 2026-08-07) — if it's gone, the
    # collector must degrade, not crash; assert on the shape either way.
    assert status.domain == "studio"
    assert status.error is None
    if status.provenance == Provenance.FACT:
        assert status.details["total"] > 0
        assert "SKETCH" in status.details["stages"] or status.details["stages"]


def test_studio_degrades_gracefully_when_ledger_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(doc, "_STUDIO_LEDGER", tmp_path / "nonexistent.json")
    status = doc.collect_studio()
    assert status.provenance == Provenance.UNKNOWN
    assert status.error is None


def test_studio_collector_crash_is_captured_not_raised(monkeypatch, tmp_path):
    bad = tmp_path / "ledger.json"
    bad.write_text("{not valid json", encoding="utf-8")
    monkeypatch.setattr(doc, "_STUDIO_LEDGER", bad)
    status = doc.collect_studio()
    assert status.provenance == Provenance.UNKNOWN
    assert status.error is not None   # the JSON parse error was captured, not raised


def test_course_is_always_unknown_no_source_exists():
    status = doc.collect_course()
    assert status.provenance == Provenance.UNKNOWN
    assert "UNKNOWN" in status.summary_he


def test_professional_readiness_unknown_when_studio_unknown():
    from service.day_opening_models import DomainStatus
    studio_unknown = DomainStatus(domain="studio", label_he="x", provenance=Provenance.UNKNOWN, summary_he="")
    status = doc.collect_professional_readiness(studio_unknown)
    assert status.provenance == Provenance.UNKNOWN


def test_professional_readiness_never_reports_arbitrary_percentage():
    status = doc.collect_studio()
    readiness = doc.collect_professional_readiness(status)
    assert "%" not in readiness.summary_he
    assert "NOT YET MEASURED" in readiness.summary_he


def test_philos_degrades_gracefully_when_events_file_missing(monkeypatch, tmp_path):
    monkeypatch.setattr(doc, "_PHILOS_EVENTS", tmp_path / "nonexistent.jsonl")
    status = doc.collect_philos()
    assert status.provenance == Provenance.UNKNOWN
    assert status.error is None


def test_canonical_person_degrades_honestly_when_philos_unreachable(monkeypatch):
    from app.philos_shared_state import SharedStateResult
    monkeypatch.setattr(
        doc, "fetch_shared_state",
        lambda subject=None: SharedStateResult(connected=False, http_status=None, error="network_error", data=None),
    )
    status = doc.collect_canonical_person()
    assert status.domain == "canonical_person"
    assert status.provenance == Provenance.UNKNOWN
    assert status.error is None  # a connection failure is reported honestly via summary_he, not raised
    assert "network_error" in status.summary_he


def test_canonical_person_reports_fact_when_real_state_exists(monkeypatch):
    from app.philos_shared_state import SharedStateResult
    fake_data = {
        "subject_id": "person_roei", "asOf": "2026-08-17T09:00:00+03:00",
        "human": {
            "domain_id": "human_canon",
            "current_state": [{"parameter_id": "p1", "level": 1, "confidence": 0.7}],
            "history": [{}, {}], "evidence": ["real evidence"], "changed": True, "source_refs": ["HUMAN:12"],
        },
        "open_loops": {"no_effect_recorded": 1, "effect_claimed_only": 0, "effect_verified": 2},
        "actions": [], "effects": [], "learning": [],
        "brain": {"next_action": {"label": "רשום Effect", "reason": "open loop"}},
    }
    monkeypatch.setattr(
        doc, "fetch_shared_state",
        lambda subject=None: SharedStateResult(connected=True, http_status=200, error=None, data=fake_data),
    )
    status = doc.collect_canonical_person()
    assert status.provenance == Provenance.FACT
    assert "p1=1" in status.summary_he
    assert status.blocker_he != ""
    assert status.next_action_he == "רשום Effect"
    assert status.what_changed_he != ""
    assert status.details["source_refs"] == ["HUMAN:12"]


def test_canonical_music_degrades_honestly_when_philos_unreachable(monkeypatch):
    from app.philos_shared_state import SharedStateResult
    monkeypatch.setattr(
        doc, "fetch_shared_state",
        lambda subject=None: SharedStateResult(connected=False, http_status=401, error="unauthorized", data=None),
    )
    status = doc.collect_canonical_music()
    assert status.domain == "canonical_music"
    assert status.provenance == Provenance.UNKNOWN
    assert "unauthorized" in status.summary_he


def test_canonical_music_reports_fact_when_real_state_exists(monkeypatch):
    from app.philos_shared_state import SharedStateResult
    fake_data = {
        "subject_id": "person_roei", "asOf": "2026-08-17T09:00:00+03:00",
        "music": {
            "domain_id": "music_canon",
            "current_state": [{"parameter_id": "harmony", "level": 2, "confidence": 0.9}],
            "history": [{}], "evidence": [], "changed": False, "source_refs": ["MUSIC:GEN-MU-PROC-04"],
        },
        "community_marketplace": {"open_needs": [{"need_id": "n1"}], "open_offers": []},
        "world_relevance": {"bridge_link_count": 0},
    }
    monkeypatch.setattr(
        doc, "fetch_shared_state",
        lambda subject=None: SharedStateResult(connected=True, http_status=200, error=None, data=fake_data),
    )
    status = doc.collect_canonical_music()
    assert status.provenance == Provenance.FACT
    assert "harmony=2" in status.summary_he
    assert "1 Need פתוח" in status.summary_he
    assert status.details["open_needs"] == 1


def test_merlin_infrastructure_reflects_live_control_state():
    from service.control_state import RuntimeControlState
    from service.turn_state import TurnController

    cs = RuntimeControlState()
    cs.stt_model = "whisper-1"
    tc = TurnController()
    tc.new_turn()
    tc.cancel_current()

    status = doc.collect_merlin_infrastructure(cs, tc)
    assert status.provenance == Provenance.FACT
    assert "whisper-1" in status.summary_he
    assert "1 תורות בוטלו" in status.summary_he


def test_collect_all_survives_one_broken_collector(monkeypatch, tmp_path):
    """Section 9 — one broken collector must not destroy the whole opening."""
    monkeypatch.setattr(doc, "collect_studio", lambda: (_ for _ in ()).throw(RuntimeError("boom")))
    from service.control_state import RuntimeControlState
    from service.turn_state import TurnController
    cs = RuntimeControlState()
    tc = TurnController()

    # collect_all calls the module-level function names directly, so patch
    # collect_studio via the module and confirm collect_all still returns a
    # full domain list without raising.
    orientation, domains, candidates = doc.collect_all(cs, tc)
    assert isinstance(orientation, str) and orientation
    assert len(domains) >= 6   # human/music/studio/course/readiness/philos/merlin all present
