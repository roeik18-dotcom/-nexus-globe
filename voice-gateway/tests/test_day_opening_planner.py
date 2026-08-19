"""Tests for service.day_opening_planner — pure logic, no hardware."""

from service.day_opening_models import DomainStatus, OutcomeCandidate, Provenance
from service.day_opening_planner import (
    build_synthesis_lines,
    choose_next_action,
    select_top_outcomes,
)


def _status(domain, label, provenance=Provenance.FACT, summary="ok"):
    return DomainStatus(domain=domain, label_he=label, provenance=provenance, summary_he=summary)


def test_synthesis_line_order_is_deterministic():
    domains = [
        _status("merlin", "Merlin"),
        _status("human_config", "אדם"),
        _status("music_config", "מוזיקה"),
    ]
    lines = build_synthesis_lines(domains)
    # Fixed order regardless of input order — section 2's canonical sequence
    # (world → human → music → studio → nexus → course → readiness → philos
    # → merlin → personal orientation → behavior). Only 3 domains were
    # supplied, so every other slot renders UNKNOWN — assert their relative
    # order (world_external, missing from input, is now first overall).
    assert lines[0] == "עולם — UNKNOWN"
    human_idx = next(i for i, l in enumerate(lines) if l.startswith("אדם"))
    music_idx = next(i for i, l in enumerate(lines) if l.startswith("מוזיקה"))
    merlin_idx = next(i for i, l in enumerate(lines) if l.startswith("Merlin"))
    assert human_idx < music_idx < merlin_idx


def test_missing_domain_reports_unknown_not_fabricated():
    lines = build_synthesis_lines([_status("merlin", "Merlin")])
    assert "אדם — UNKNOWN" in lines
    assert "מוזיקה — UNKNOWN" in lines


def test_unknown_provenance_domain_reports_unknown_even_with_summary_text():
    """A collector that couldn't establish real state must never have its
    summary text leak into the synthesis line as if it were a fact."""
    domains = [_status("human_config", "אדם", provenance=Provenance.UNKNOWN, summary="לא נמדד")]
    lines = build_synthesis_lines(domains)
    assert "אדם — UNKNOWN" in lines


def test_maximum_three_outcomes_even_with_many_candidates():
    candidates = [
        OutcomeCandidate(domain=f"d{i}", text_he=f"outcome {i}", strategic_value=i)
        for i in range(10)
    ]
    outcomes = select_top_outcomes(candidates)
    assert len(outcomes) == 3


def test_outcomes_are_whole_day_not_per_domain():
    """Even if every domain proposes its own candidate, the cap is 3 total."""
    candidates = [
        OutcomeCandidate(domain=d, text_he=f"{d} action", strategic_value=1)
        for d in ["human_config", "music_config", "studio", "course", "professional_readiness", "philos", "merlin"]
    ]
    assert len(select_top_outcomes(candidates)) == 3


def test_blocker_removal_outranks_everything_else():
    candidates = [
        OutcomeCandidate(domain="a", text_he="high strategic value", strategic_value=3),
        OutcomeCandidate(domain="b", text_he="removes a blocker", blocker_removal=True, strategic_value=0),
    ]
    top = select_top_outcomes(candidates, max_outcomes=1)
    assert top == ["removes a blocker"]


def test_exactly_one_next_action_now():
    candidates = [
        OutcomeCandidate(domain="a", text_he="action A", strategic_value=2),
        OutcomeCandidate(domain="b", text_he="action B", blocker_removal=True),
    ]
    action = choose_next_action([], candidates)
    assert action == "action B"
    assert isinstance(action, str)


def test_next_action_with_no_candidates_is_honest_not_fabricated():
    action = choose_next_action([], [])
    assert "אין מספיק מידע" in action
