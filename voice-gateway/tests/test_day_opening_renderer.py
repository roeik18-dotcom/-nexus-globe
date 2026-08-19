"""Tests for service.day_opening_renderer — pure string assembly, no hardware."""

from service.day_opening_models import DayOpeningReport, DomainStatus, Provenance
from service.day_opening_planner import plan
from service.day_opening_renderer import OPENING_FRAME_HE, render


def test_render_starts_with_opening_frame():
    report = DayOpeningReport()
    text = render(report)
    assert text.startswith(OPENING_FRAME_HE)


def test_render_ends_with_final_orientation_block():
    """Section 12's closing structure replaces the old single 'next action'
    sentence — direction / open loop / next action / Philos balance, in
    that order, nothing after it (no motivational filler, no 'how can I help')."""
    report = plan(
        [DomainStatus(domain="merlin", label_he="Merlin", provenance=Provenance.FACT, summary_he="תקין")],
        [],
    )
    text = render(report)
    assert "כיוון היום:" in text
    assert "הלולאה הפתוחה המרכזית:" in text
    assert "הפעולה הבאה:" in text
    assert text.rstrip().endswith(report.final.philos_balance_he)
    direction_idx = text.index("כיוון היום:")
    balance_idx = text.rindex("איזון Philos, סיכום:")
    assert direction_idx < balance_idx, "final block must be the last thing rendered"


def test_render_never_fabricates_completion_for_unknown_domain():
    d = DomainStatus(domain="human_config", label_he="אדם", provenance=Provenance.UNKNOWN,
                       summary_he="לא נמדד עדיין")
    report = plan([d], [])
    text = render(report)
    assert "לא נמדד עדיין" in text
    assert "הושלם" not in text
    assert "MASTER FINAL" not in text or "לא" in text.split("MASTER FINAL")[0][-10:] if "MASTER FINAL" in text else True


def test_render_includes_blocker_when_present():
    d = DomainStatus(domain="merlin", label_he="Merlin", provenance=Provenance.FACT,
                       summary_he="תקין", blocker_he="STT לא אמין")
    report = plan([d], [])
    text = render(report)
    assert "חסם פעיל: STT לא אמין" in text


def test_render_survives_a_collector_error_without_crashing_whole_briefing():
    ok = DomainStatus(domain="merlin", label_he="Merlin", provenance=Provenance.FACT, summary_he="תקין")
    broken = DomainStatus(domain="music_config", label_he="מוזיקה", provenance=Provenance.UNKNOWN,
                            summary_he="", error="collector timeout")
    report = plan([ok, broken], [])
    text = render(report)
    assert "תקין" in text
    assert "לא ניתן היה לאסוף נתונים כרגע" in text
    assert "collector timeout" in text


def test_full_text_is_stored_on_report_for_reuse():
    report = plan([], [])
    text = render(report)
    assert report.full_text_he == text
