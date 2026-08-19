"""Unit tests for app.domain_router — production repair section 5.

Locks in the exact routing examples from the spec: a music question must
never be answered with Philos/Day-Opening boilerplate, a Human Config
question must route to human_config only, etc. Classification is pure and
needs no I/O, so these run without mocking the filesystem or network.
"""

import pytest

from app.domain_router import Domain, classify


def test_music_question_routes_to_music_not_philos():
    d, conf = classify("מה אתה יודע על המוזיקה שלי?")
    assert d == Domain.MUSIC_CONFIG
    assert conf > 0


def test_human_config_question_routes_to_human_config():
    d, _ = classify("מה אתה יודע על קונפינג אדם שלי?")
    assert d == Domain.HUMAN_CONFIG


def test_project_status_question_routes_to_studio_project():
    d, _ = classify("מה מצב הפרויקט X")
    assert d == Domain.STUDIO_PROJECT


def test_philos_question_routes_to_philos():
    d, _ = classify("מה קורה בפילוס?")
    assert d == Domain.PHILOS


def test_philos_progress_question_routes_to_philos_not_studio():
    d, _ = classify("מה ההתקדמות בפילוס?")
    assert d == Domain.PHILOS


def test_merlin_status_question_routes_to_runtime():
    d, _ = classify("מה מצב מרלין?")
    assert d == Domain.RUNTIME


def test_bdok_reshet_routes_to_runtime_not_a_knowledge_domain():
    """'בדוק רשת' is a network/tool intent — it must not accidentally match
    human/music/philos keywords and pull in unrelated context."""
    d, _ = classify("בדוק רשת")
    assert d == Domain.RUNTIME


def test_studio_status_question_routes_to_studio_project():
    d, _ = classify("מה מצב האולפן")
    assert d == Domain.STUDIO_PROJECT


def test_music_config_status_routes_to_music_config():
    d, _ = classify("מה מצב קונפיג מוזיקה")
    assert d == Domain.MUSIC_CONFIG


def test_human_config_status_routes_to_human_config():
    d, _ = classify("מה מצב קונפיג אדם")
    assert d == Domain.HUMAN_CONFIG


def test_plain_conversation_routes_to_general_with_no_domain_dump():
    d, conf = classify("מה שלומך היום?")
    assert d == Domain.GENERAL
    assert conf == 0.0


def test_empty_query_routes_to_general():
    d, conf = classify("")
    assert d == Domain.GENERAL
    assert conf == 0.0


def test_english_music_question_routes_to_music():
    d, _ = classify("what do you know about my music?")
    assert d == Domain.MUSIC_CONFIG


def test_day_opening_phrase_routes_to_day_opening():
    d, _ = classify("בוקר טוב")
    assert d == Domain.DAY_OPENING


def test_working_style_paraphrase_routes_to_human_config():
    """2026-08-08 live-test regression: this exact phrase was misrouted to
    GENERAL before the HUMAN_CONFIG cue list was extended to cover natural
    paraphrase, not just the literal 'קונפיג אדם' phrase."""
    d, _ = classify("מה אתה יודע על הדרך שאני מעדיף לעבוד?")
    assert d == Domain.HUMAN_CONFIG


# 2026-08-13 DAW/production-terminology coverage gap (live routing audit):
# these unambiguous production terms fell to GENERAL before their cues
# existed, even though the MUSIC master has real production/Ableton content
# — see MERLIN_KNOWLEDGE_GAP_REPORT.md. Bare "Ableton" specifically used to
# route to STUDIO_PROJECT (an unindexed project ledger) instead of the
# 579-unit MUSIC master that actually answers it.
@pytest.mark.parametrize("query", [
    "Ableton", "Pro Tools", "MIDI", "audio routing", "arrangement",
    "studio workflow",
])
def test_daw_terminology_routes_to_music_config(query):
    d, conf = classify(query)
    assert d == Domain.MUSIC_CONFIG
    assert conf > 0


def test_bare_master_stays_general_not_misrouted_to_music():
    """Deliberate exclusion: bare 'master' collides with the Human-config
    phrasing 'מאסטר אדם' / 'אדם מאסטר', so it is intentionally NOT a
    MUSIC_CONFIG cue. Confirms it doesn't fall through to MUSIC_CONFIG by
    accident via some other path."""
    d, conf = classify("master")
    assert d == Domain.GENERAL
    assert conf == 0.0
