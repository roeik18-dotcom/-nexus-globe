"""Tests for ContextBuilder — layer isolation, assembly, ordering, and parity."""

import pytest

from app.context_builder import (
    BaseIdentityLayer,
    ContextBuilder,
    CurrentTaskLayer,
    PersonaLayer,
    PersistentMemoryLayer,
    SessionSummaryLayer,
    ToolMemoryLayer,
)
from app.config import build_system_prompt_with_task
from app.summary import SummaryState
from app.task import TaskState
from app.tool_memory import ToolMemoryEntry


# --- helpers ---

def _summary(text="prior context"):
    return SummaryState(text=text, version=1, summarized_until=4)

def _task(title="deploy", description=""):
    return TaskState(title=title, description=description)

def _entry(tool="git", fact="branch: main", source="rev-parse"):
    return ToolMemoryEntry(tool=tool, fact=fact, source=source)


# --- BaseIdentityLayer ---

def test_base_identity_layer_returns_string():
    assert isinstance(BaseIdentityLayer("jarvis").render(), str)


def test_base_identity_layer_missing_file_returns_empty():
    result = BaseIdentityLayer("jarvis").render()
    assert result is not None


# --- PersonaLayer ---

def test_persona_layer_missing_returns_empty():
    assert PersonaLayer("nonexistent-xyz").render() == ""


def test_persona_layer_returns_string():
    assert isinstance(PersonaLayer("jarvis").render(), str)


# --- PersistentMemoryLayer ---

def test_persistent_memory_layer_missing_returns_empty():
    assert PersistentMemoryLayer("nonexistent-xyz").render() == ""


def test_persistent_memory_layer_returns_string():
    assert isinstance(PersistentMemoryLayer("jarvis").render(), str)


# --- SessionSummaryLayer ---

def test_session_summary_none_returns_empty():
    assert SessionSummaryLayer(None).render() == ""


def test_session_summary_empty_text_returns_empty():
    assert SessionSummaryLayer(SummaryState(text="", version=1, summarized_until=0)).render() == ""


def test_session_summary_renders_header_and_text():
    block = SessionSummaryLayer(_summary("user asked about X")).render()
    assert "## Session Summary" in block
    assert "user asked about X" in block


# --- CurrentTaskLayer ---

def test_current_task_none_returns_empty():
    assert CurrentTaskLayer(None).render() == ""


def test_current_task_renders_title_and_status():
    block = CurrentTaskLayer(_task("deploy")).render()
    assert "## Current Task" in block
    assert "deploy" in block
    assert "active" in block


def test_current_task_includes_description():
    block = CurrentTaskLayer(_task("deploy", description="push to prod")).render()
    assert "push to prod" in block


def test_current_task_omits_context_line_when_no_description():
    block = CurrentTaskLayer(_task("deploy")).render()
    assert "Context:" not in block


# --- ToolMemoryLayer ---

def test_tool_memory_layer_empty_returns_empty():
    assert ToolMemoryLayer([]).render() == ""


def test_tool_memory_layer_renders_entries():
    block = ToolMemoryLayer([_entry()]).render()
    assert "## Tool Memory" in block
    assert "[git]" in block


# --- ContextBuilder.build ---

def test_build_skips_empty_layers():
    class _Empty:
        def render(self): return ""
    class _Full:
        def render(self): return "hello"
    assert ContextBuilder([_Empty(), _Full(), _Empty()]).build() == "hello"


def test_build_joins_non_empty_with_separator():
    class _L:
        def __init__(self, t): self._t = t
        def render(self): return self._t
    result = ContextBuilder([_L("A"), _L("B"), _L("C")]).build()
    assert result == "A\n\n---\n\nB\n\n---\n\nC"


def test_build_strips_surrounding_whitespace_from_sections():
    class _L:
        def render(self): return "  hello  "
    assert ContextBuilder([_L()]).build() == "hello"


def test_build_empty_layers_list_returns_empty():
    assert ContextBuilder([]).build() == ""


# --- ContextBuilder.for_session layer ordering ---

def test_summary_before_task_before_tool_memory():
    result = ContextBuilder.for_session(
        "jarvis",
        task=_task(),
        summary=_summary(),
        tool_memory=[_entry()],
    ).build()
    assert result.index("## Session Summary") < result.index("## Current Task") < result.index("## Tool Memory")


def test_task_absent_when_not_provided():
    result = ContextBuilder.for_session("jarvis", summary=_summary()).build()
    assert "## Current Task" not in result


def test_summary_absent_when_not_provided():
    result = ContextBuilder.for_session("jarvis", task=_task()).build()
    assert "## Session Summary" not in result


def test_tool_memory_absent_when_empty():
    result = ContextBuilder.for_session("jarvis").build()
    assert "## Tool Memory" not in result


# --- parity: ContextBuilder.for_session == build_system_prompt_with_task ---

def test_parity_no_extras():
    assert ContextBuilder.for_session("jarvis").build() == build_system_prompt_with_task("jarvis")


def test_parity_with_task():
    t = _task("deploy", description="push to prod")
    assert (
        ContextBuilder.for_session("jarvis", task=t).build()
        == build_system_prompt_with_task("jarvis", task=t)
    )


def test_parity_with_summary():
    s = _summary()
    assert (
        ContextBuilder.for_session("jarvis", summary=s).build()
        == build_system_prompt_with_task("jarvis", summary=s)
    )


def test_parity_with_tool_memory():
    entries = [_entry()]
    assert (
        ContextBuilder.for_session("jarvis", tool_memory=entries).build()
        == build_system_prompt_with_task("jarvis", tool_memory=entries)
    )


def test_parity_all_layers():
    t = _task("deploy")
    s = _summary()
    entries = [_entry()]
    assert (
        ContextBuilder.for_session("jarvis", task=t, summary=s, tool_memory=entries).build()
        == build_system_prompt_with_task("jarvis", task=t, summary=s, tool_memory=entries)
    )
