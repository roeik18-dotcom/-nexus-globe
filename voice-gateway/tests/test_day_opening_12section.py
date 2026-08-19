"""Regression tests for the 2026-08-07 12-section Master Day Opening
rewrite: open-loop classification (A-E), the 3-item priority stack, the
Philos imbalance assessment, what-changed diffing, the new collectors
(World/External, Nexus Globe, Personal Orientation, Behavior/Physical), and
the Control Interface health line inside Merlin/Infrastructure.
"""

from unittest.mock import MagicMock

from service.day_opening_collectors import (
    _control_interface_health,
    collect_all,
    collect_behavior_physical,
    collect_nexus_globe,
    collect_philos_personal_orientation,
    collect_world_external,
)
from service.day_opening_models import DomainStatus, Lifecycle, OpenLoopClass, Provenance
from service.day_opening_planner import (
    apply_what_changed,
    assess_imbalance,
    build_priorities,
    classify_open_loop,
    plan,
)
from service.day_opening_renderer import render


def _status(**kw):
    defaults = dict(domain="d", label_he="D", provenance=Provenance.FACT, summary_he="ok")
    defaults.update(kw)
    return DomainStatus(**defaults)


# ── open-loop classification (A-E) ───────────────────────────────────────

def test_open_loop_blocked_when_blocker_present():
    assert classify_open_loop(_status(blocker_he="stuck")) == OpenLoopClass.BLOCKED


def test_open_loop_blocked_when_collector_errored():
    assert classify_open_loop(_status(error="boom")) == OpenLoopClass.BLOCKED


def test_open_loop_waiting_when_unknown_provenance():
    assert classify_open_loop(_status(provenance=Provenance.UNKNOWN)) == OpenLoopClass.WAITING


def test_open_loop_completed_when_master_final():
    assert classify_open_loop(_status(lifecycle=Lifecycle.MASTER_FINAL)) == OpenLoopClass.COMPLETED


def test_open_loop_unfinished_when_draft_lifecycle():
    assert classify_open_loop(_status(lifecycle=Lifecycle.DRAFT)) == OpenLoopClass.UNFINISHED


def test_open_loop_unfinished_when_explicit_unfinished_note():
    assert classify_open_loop(_status(unfinished_he="still missing X")) == OpenLoopClass.UNFINISHED


def test_open_loop_active_when_next_action_with_no_blocker_or_lifecycle():
    assert classify_open_loop(_status(next_action_he="do the thing")) == OpenLoopClass.ACTIVE


def test_open_loop_completed_when_nothing_outstanding():
    assert classify_open_loop(_status()) == OpenLoopClass.COMPLETED


def test_renderer_never_presents_completed_work_as_unfinished():
    completed = _status(domain="a", label_he="A")   # -> COMPLETED
    blocked = _status(domain="b", label_he="B", blocker_he="x")   # -> BLOCKED
    report = plan([completed, blocked], [])
    text = render(report)
    assert "A (הושלם)" not in text
    assert "B (חסום)" in text


# ── priority stack: max 3, slot 3 reserved for balance ───────────────────

def test_priorities_are_always_exactly_three():
    from service.day_opening_models import ImbalanceAssessment
    imbalance = ImbalanceAssessment(provenance=Provenance.UNKNOWN, statement_he="insufficient data")
    items = build_priorities([], imbalance)
    assert len(items) == 3
    assert [p.label for p in items] == ["PRIORITY 1", "PRIORITY 2", "PRIORITY 3"]


def test_priority_three_is_never_a_work_candidate():
    """PRIORITY 3 must always be the physical/personal balancing slot, never
    a third work item, even when 3+ strong work candidates exist."""
    from service.day_opening_models import ImbalanceAssessment, OutcomeCandidate
    candidates = [
        OutcomeCandidate(domain="a", text_he="work A", strategic_value=3),
        OutcomeCandidate(domain="b", text_he="work B", strategic_value=3),
        OutcomeCandidate(domain="c", text_he="work C", strategic_value=3),
    ]
    imbalance = ImbalanceAssessment(provenance=Provenance.UNKNOWN, statement_he="insufficient data")
    items = build_priorities(candidates, imbalance)
    assert len(items) == 3
    assert items[2].text_he == "insufficient data"
    assert "work C" not in [p.text_he for p in items]


# ── imbalance assessment — evidence-only, never assumed ──────────────────

def test_imbalance_unknown_when_either_input_missing():
    assert assess_imbalance(None, None).provenance == Provenance.UNKNOWN


def test_imbalance_unknown_when_either_input_is_unknown_provenance():
    personal = _status(provenance=Provenance.UNKNOWN)
    behavior = _status(provenance=Provenance.FACT)
    assert assess_imbalance(personal, behavior).provenance == Provenance.UNKNOWN


def test_imbalance_statement_is_the_fixed_honest_sentence_not_a_guess():
    result = assess_imbalance(None, None)
    assert "אין מספיק נתונים" in result.statement_he


# ── what-changed diffing — states WHETHER, never WHAT, changed ───────────

def test_what_changed_blank_with_no_prior_run():
    domains = [_status(domain="human_config")]
    apply_what_changed(domains, None)
    assert domains[0].what_changed_he == ""


def test_what_changed_flags_new_domain():
    domains = [_status(domain="new_domain")]
    apply_what_changed(domains, [{"domain": "other_domain", "summary_he": "x"}])
    assert "חדש" in domains[0].what_changed_he


def test_what_changed_flags_unchanged_domain_as_blank():
    domains = [_status(domain="human_config", summary_he="same")]
    apply_what_changed(domains, [{"domain": "human_config", "summary_he": "same"}])
    assert domains[0].what_changed_he == ""


def test_what_changed_flags_a_real_difference_without_inventing_specifics():
    domains = [_status(domain="human_config", summary_he="new state")]
    apply_what_changed(domains, [{"domain": "human_config", "summary_he": "old state"}])
    assert domains[0].what_changed_he != ""
    # never claims to know WHAT changed in detail — no diff/LLM exists here
    assert "new state" not in domains[0].what_changed_he
    assert "old state" not in domains[0].what_changed_he


# ── new collectors: honest UNKNOWN where no source exists ────────────────

def test_world_external_is_always_unknown_no_source_exists():
    status = collect_world_external()
    assert status.provenance == Provenance.UNKNOWN
    assert "UNKNOWN" in status.summary_he


def test_personal_orientation_is_always_unknown_no_source_exists():
    status = collect_philos_personal_orientation()
    assert status.provenance == Provenance.UNKNOWN


def test_behavior_physical_is_always_unknown_no_source_exists():
    status = collect_behavior_physical()
    assert status.provenance == Provenance.UNKNOWN
    assert "%" not in status.summary_he


def test_nexus_globe_reads_real_git_state():
    status = collect_nexus_globe()
    assert status.domain == "nexus_globe"
    assert status.error is None
    if status.provenance == Provenance.FACT:
        assert "branch" in status.details or status.details.get("revision")


# ── control interface health — real evidence, not assumed ────────────────

def test_control_interface_health_reports_one_sentence_when_healthy():
    cs = MagicMock()
    cs.last_error = None
    cs.invariant_violations = []
    cs.day_opening_double_clap_enabled = True
    cs.runtime_state = "IDLE"
    line = _control_interface_health(cs)
    assert "ממשק השליטה תקין" in line
    # One compact sentence, not a bloated multi-problem list (the "; "
    # separator is only used when there ARE multiple named failures).
    assert "; " not in line
    assert line.rstrip().endswith(".") and line.rstrip().count(". ") == 0


def test_control_interface_health_names_exact_failure_when_clap_disarmed():
    cs = MagicMock()
    cs.last_error = None
    cs.invariant_violations = []
    cs.day_opening_double_clap_enabled = False
    cs.runtime_state = "IDLE"
    line = _control_interface_health(cs)
    assert "אבל" in line
    assert "clap trigger אינו מחובר" in line


def test_control_interface_health_never_claims_healthy_without_evidence():
    cs = MagicMock()
    cs.last_error = "some real error"
    cs.invariant_violations = []
    cs.day_opening_double_clap_enabled = True
    cs.runtime_state = "IDLE"
    line = _control_interface_health(cs)
    assert "תקין" not in line
    assert "some real error" in line


# ── full pipeline: exactly 13 domains (11 original + Phase 7's
#    canonical_person/canonical_music), section 3 excludes completed ─────

def test_collect_all_produces_all_thirteen_domains():
    from service.control_state import RuntimeControlState
    from service.turn_state import TurnController

    orientation, domains, candidates = collect_all(RuntimeControlState(), TurnController())
    assert len(domains) == 13
    ids = {d.domain for d in domains}
    assert ids == {
        "world_external", "human_config", "music_config", "studio", "nexus_globe",
        "course", "professional_readiness", "philos", "canonical_person", "canonical_music", "merlin",
        "personal_orientation", "behavior_physical",
    }


def test_render_never_greets_or_asks_how_can_i_help():
    from service.control_state import RuntimeControlState
    from service.turn_state import TurnController

    orientation, domains, candidates = collect_all(RuntimeControlState(), TurnController())
    report = plan(domains, candidates)
    text = render(report, orientation_he=orientation)
    for forbidden in ("בוקר טוב", "שלום", "איך אני יכול לעזור", "כיצד אוכל לעזור"):
        assert forbidden not in text
