"""Tests for session working summary."""

import pytest

from app.config import build_system_prompt_with_task
from app.summary import (
    KEEP_RECENT,
    SUMMARIZE_NEW,
    SummaryRegistry,
    SummaryState,
    should_summarize,
    summarize_range,
)


@pytest.fixture
def reg():
    return SummaryRegistry()


# --- SummaryRegistry ---

def test_get_missing_returns_none(reg):
    assert reg.get("s1") is None


def test_set_and_get(reg):
    state = SummaryState(text="some summary", version=1, summarized_until=8)
    reg.set("s1", state)
    assert reg.get("s1") is state


def test_clear_removes_state(reg):
    reg.set("s1", SummaryState(text="x", version=1, summarized_until=4))
    reg.clear("s1")
    assert reg.get("s1") is None


def test_clear_missing_is_silent(reg):
    reg.clear("ghost")  # must not raise


def test_session_isolation(reg):
    reg.set("s1", SummaryState(text="s1 summary", version=1, summarized_until=8))
    reg.set("s2", SummaryState(text="s2 summary", version=1, summarized_until=12))
    assert reg.get("s1").text == "s1 summary"
    assert reg.get("s2").text == "s2 summary"


def test_clear_does_not_affect_other_session(reg):
    reg.set("s1", SummaryState(text="a", version=1, summarized_until=4))
    reg.set("s2", SummaryState(text="b", version=1, summarized_until=8))
    reg.clear("s1")
    assert reg.get("s1") is None
    assert reg.get("s2") is not None


def test_get_summarized_until_missing(reg):
    assert reg.get_summarized_until("ghost") == 0


def test_get_summarized_until_with_state(reg):
    reg.set("s1", SummaryState(text="x", version=1, summarized_until=16))
    assert reg.get_summarized_until("s1") == 16


# --- should_summarize ---

def test_should_not_summarize_below_threshold():
    assert not should_summarize(SUMMARIZE_NEW + KEEP_RECENT - 1, 0)


def test_should_summarize_at_threshold():
    assert should_summarize(SUMMARIZE_NEW + KEEP_RECENT, 0)


def test_should_summarize_above_threshold():
    assert should_summarize(SUMMARIZE_NEW + KEEP_RECENT + 5, 0)


def test_should_not_summarize_when_recently_summarized():
    assert not should_summarize(SUMMARIZE_NEW + KEEP_RECENT - 1, SUMMARIZE_NEW)


def test_should_summarize_after_enough_new_messages():
    assert should_summarize(SUMMARIZE_NEW + KEEP_RECENT + SUMMARIZE_NEW, SUMMARIZE_NEW)


# --- summarize_range ---

def test_summarize_range_initial():
    start, end = summarize_range(SUMMARIZE_NEW + KEEP_RECENT, 0)
    assert start == 0
    assert end == SUMMARIZE_NEW


def test_summarize_range_after_prior_summary():
    start, end = summarize_range(SUMMARIZE_NEW + KEEP_RECENT + SUMMARIZE_NEW, SUMMARIZE_NEW)
    assert start == SUMMARIZE_NEW
    assert end == SUMMARIZE_NEW + SUMMARIZE_NEW
    assert end == 16


def test_summarize_range_keeps_recent():
    history_len = 30
    _, end = summarize_range(history_len, 0)
    assert history_len - end == KEEP_RECENT


# --- prompt injection ---

def test_prompt_with_no_summary_omits_block():
    result = build_system_prompt_with_task("jarvis", task=None, summary=None)
    assert "## Session Summary" not in result


def test_prompt_with_empty_summary_omits_block():
    summary = SummaryState(text="", version=1, summarized_until=8)
    result = build_system_prompt_with_task("jarvis", task=None, summary=summary)
    assert "## Session Summary" not in result


def test_prompt_with_summary_injects_block():
    summary = SummaryState(text="Decision: use OpenAI TTS", version=1, summarized_until=8)
    result = build_system_prompt_with_task("jarvis", task=None, summary=summary)
    assert "## Session Summary" in result
    assert "Decision: use OpenAI TTS" in result


def test_summary_appears_before_task_in_prompt():
    from app.task import TaskState
    summary = SummaryState(text="prior context", version=1, summarized_until=8)
    task = TaskState(title="current task")
    result = build_system_prompt_with_task("jarvis", task=task, summary=summary)
    summary_pos = result.index("## Session Summary")
    task_pos = result.index("## Current Task")
    assert summary_pos < task_pos
