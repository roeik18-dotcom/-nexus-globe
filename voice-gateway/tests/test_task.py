"""Tests for per-session task state."""

import pytest

from app.config import build_system_prompt_with_task
from app.task import TaskRegistry, TaskState


@pytest.fixture
def reg():
    return TaskRegistry()


def test_set_creates_task(reg):
    task = reg.set("s1", "Build feature X")
    assert task.title == "Build feature X"
    assert task.description == ""
    assert task.status == "active"
    assert task.updated_at


def test_set_with_description(reg):
    task = reg.set("s1", "Deploy", "push to prod after tests pass")
    assert task.description == "push to prod after tests pass"


def test_get_returns_task(reg):
    reg.set("s1", "Task A")
    assert reg.get("s1") is not None
    assert reg.get("s1").title == "Task A"


def test_get_missing_returns_none(reg):
    assert reg.get("unknown") is None


def test_task_isolation(reg):
    reg.set("s1", "Task for s1")
    reg.set("s2", "Task for s2")
    assert reg.get("s1").title == "Task for s1"
    assert reg.get("s2").title == "Task for s2"


def test_update_title(reg):
    reg.set("s1", "Old title")
    reg.update("s1", title="New title")
    assert reg.get("s1").title == "New title"


def test_update_refreshes_updated_at(reg):
    task = reg.set("s1", "Task")
    original_ts = task.updated_at
    reg.update("s1", description="added context")
    assert reg.get("s1").updated_at >= original_ts


def test_update_missing_session_returns_none(reg):
    assert reg.update("ghost", title="x") is None


def test_complete_sets_status(reg):
    reg.set("s1", "Task")
    reg.complete("s1")
    assert reg.get("s1").status == "completed"


def test_complete_missing_session_returns_none(reg):
    assert reg.complete("ghost") is None


def test_clear_removes_task(reg):
    reg.set("s1", "Task")
    reg.clear("s1")
    assert reg.get("s1") is None


def test_clear_does_not_affect_other_sessions(reg):
    reg.set("s1", "Task A")
    reg.set("s2", "Task B")
    reg.clear("s1")
    assert reg.get("s1") is None
    assert reg.get("s2").title == "Task B"


def test_clear_missing_session_is_silent(reg):
    reg.clear("ghost")  # must not raise


def test_set_overwrites_existing(reg):
    reg.set("s1", "Old")
    reg.set("s1", "New")
    assert reg.get("s1").title == "New"


# --- build_system_prompt_with_task ---

def test_prompt_with_no_task_returns_base(monkeypatch):
    monkeypatch.setenv("PERSONA", "jarvis")
    result = build_system_prompt_with_task("jarvis", task=None)
    assert "## Current Task" not in result


def test_prompt_with_task_injects_block():
    task = TaskState(title="Write tests", status="active")
    result = build_system_prompt_with_task("jarvis", task=task)
    assert "## Current Task" in result
    assert "Write tests" in result
    assert "active" in result


def test_prompt_with_task_includes_description():
    task = TaskState(title="Deploy", description="push to prod", status="active")
    result = build_system_prompt_with_task("jarvis", task=task)
    assert "push to prod" in result


def test_prompt_task_block_omits_empty_description():
    task = TaskState(title="Task", description="", status="active")
    result = build_system_prompt_with_task("jarvis", task=task)
    assert "Context:" not in result


def test_task_registry_is_in_memory_only(reg, tmp_path):
    """TaskRegistry never writes to the filesystem."""
    import os
    reg.set("s1", "Test task")
    reg.update("s1", title="Updated")
    reg.complete("s1")
    reg.clear("s1")
    # No file should have been created anywhere under tmp_path
    assert list(tmp_path.iterdir()) == []
