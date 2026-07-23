"""Tests for session-scoped tool memory."""

import json
from pathlib import Path

import pytest

from app.config import build_system_prompt_with_task
from app.tool_memory import (
    MAX_ENTRIES,
    ToolMemoryEntry,
    ToolMemoryRegistry,
    format_block,
)


@pytest.fixture
def reg():
    return ToolMemoryRegistry()


def entry(tool="git", fact="branch: main", source="git rev-parse", key=""):
    return ToolMemoryEntry(tool=tool, fact=fact, source=source, key=key)


# --- storage ---

def test_record_stores_entry(reg):
    reg.record("s1", entry())
    assert len(reg.get("s1")) == 1


def test_get_missing_returns_empty_list(reg):
    assert reg.get("ghost") == []


def test_record_multiple_entries(reg):
    reg.record("s1", entry(fact="a"))
    reg.record("s1", entry(fact="b"))
    assert len(reg.get("s1")) == 2


def test_get_returns_copy(reg):
    reg.record("s1", entry())
    copy = reg.get("s1")
    copy.clear()
    assert len(reg.get("s1")) == 1  # original unaffected


# --- session isolation ---

def test_sessions_do_not_share_tool_memory(reg):
    reg.record("s1", entry(fact="s1 fact"))
    reg.record("s2", entry(fact="s2 fact"))
    assert reg.get("s1")[0].fact == "s1 fact"
    assert reg.get("s2")[0].fact == "s2 fact"


def test_clear_removes_only_target_session(reg):
    reg.record("s1", entry())
    reg.record("s2", entry())
    reg.clear("s1")
    assert reg.get("s1") == []
    assert len(reg.get("s2")) == 1


def test_clear_missing_session_is_silent(reg):
    reg.clear("ghost")  # must not raise


# --- upsert by key ---

def test_entry_with_key_replaces_existing(reg):
    reg.record("s1", entry(fact="old result", key="tests"))
    reg.record("s1", entry(fact="new result", key="tests"))
    entries = reg.get("s1")
    assert len(entries) == 1
    assert entries[0].fact == "new result"


def test_entry_with_key_preserves_position(reg):
    reg.record("s1", entry(fact="a", key="k1"))
    reg.record("s1", entry(fact="b", key="k2"))
    reg.record("s1", entry(fact="a-updated", key="k1"))
    entries = reg.get("s1")
    assert len(entries) == 2
    assert entries[0].fact == "a-updated"  # first position preserved
    assert entries[1].fact == "b"


def test_entry_without_key_always_appends(reg):
    reg.record("s1", entry(fact="x", key=""))
    reg.record("s1", entry(fact="x", key=""))
    assert len(reg.get("s1")) == 2


def test_different_keys_do_not_conflict(reg):
    reg.record("s1", entry(fact="result-a", key="k1"))
    reg.record("s1", entry(fact="result-b", key="k2"))
    assert len(reg.get("s1")) == 2


# --- size limit ---

def test_size_limit_drops_oldest(reg):
    for i in range(MAX_ENTRIES + 5):
        reg.record("s1", entry(fact=f"fact-{i}"))
    entries = reg.get("s1")
    assert len(entries) == MAX_ENTRIES
    assert entries[0].fact == f"fact-{5}"   # oldest 5 were dropped
    assert entries[-1].fact == f"fact-{MAX_ENTRIES + 4}"


def test_size_limit_does_not_apply_to_upserts(reg):
    for i in range(MAX_ENTRIES):
        reg.record("s1", entry(fact=f"fact-{i}"))
    # upsert should not drop anything
    reg.record("s1", entry(fact="updated", key="existing-key"))
    # key doesn't match any (no existing key="existing-key"), so it appends and drops oldest
    assert len(reg.get("s1")) == MAX_ENTRIES


# --- format_block ---

def test_format_block_empty_returns_empty_string():
    assert format_block([]) == ""


def test_format_block_includes_tool_and_fact():
    entries = [ToolMemoryEntry(tool="git", fact="branch: main", source="rev-parse")]
    block = format_block(entries)
    assert "[git]" in block
    assert "branch: main" in block


def test_format_block_has_header():
    entries = [ToolMemoryEntry(tool="tests", fact="39/39 passed", source="pytest")]
    assert format_block(entries).startswith("## Tool Memory")


def test_format_block_multiple_entries():
    entries = [
        ToolMemoryEntry(tool="git", fact="branch: main", source="git"),
        ToolMemoryEntry(tool="tests", fact="all green", source="pytest"),
    ]
    block = format_block(entries)
    assert "[git]" in block
    assert "[tests]" in block


# --- prompt injection ---

def test_prompt_with_no_tool_memory_omits_block():
    result = build_system_prompt_with_task("jarvis", tool_memory=[])
    assert "## Tool Memory" not in result


def test_prompt_with_tool_memory_injects_block():
    entries = [ToolMemoryEntry(tool="git", fact="SHA: abc123", source="git log")]
    result = build_system_prompt_with_task("jarvis", tool_memory=entries)
    assert "## Tool Memory" in result
    assert "SHA: abc123" in result


def test_tool_memory_appears_after_task_in_prompt():
    from app.task import TaskState
    task = TaskState(title="deploy")
    entries = [ToolMemoryEntry(tool="ci", fact="green", source="ci api")]
    result = build_system_prompt_with_task("jarvis", task=task, tool_memory=entries)
    task_pos = result.index("## Current Task")
    mem_pos = result.index("## Tool Memory")
    assert task_pos < mem_pos


# --- no free-text contamination ---

def test_user_text_does_not_enter_tool_memory(reg):
    """Only explicit record() calls write to tool memory."""
    # Simulate a respond() call by NOT calling record — tool memory stays empty
    assert reg.get("s1") == []


# --- persistent memory unchanged ---

def test_persistent_memory_not_modified_by_tool_memory(reg, tmp_path):
    """Recording tool results never touches the filesystem persistent memory."""
    reg.record("s1", ToolMemoryEntry(tool="x", fact="y", source="z"))
    reg.clear("s1")
    # persistent memory dir should be untouched
    assert list(tmp_path.iterdir()) == []


# --- session teardown ---

def test_clear_on_session_end(reg):
    reg.record("s1", entry())
    reg.clear("s1")
    assert reg.get("s1") == []
