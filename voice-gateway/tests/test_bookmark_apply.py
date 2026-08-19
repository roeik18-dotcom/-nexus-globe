"""Offline unit tests for app.capabilities.bookmark_audit.apply_models,
apply.py's pure logic, and browser_guard.py — no network, no n8n, and no
dependency on real machine process state (subprocess.run is mocked so
these tests are deterministic regardless of whether Chrome/Safari happen
to be running when the suite executes). Live mutation/backup/verify/restore
and live browser-running/not-running behavior against real process state
and a real bookmark file are proven manually and reported in the
BOOKMARK_APPLY build summaries — not repeated here as network/OS-dependent
automated tests.
"""

import asyncio
import subprocess
from unittest.mock import patch

import pytest

from app.capabilities.bookmark_audit.apply import build_approval, build_preview
from app.capabilities.bookmark_audit.apply_models import MutationRequest
from app.capabilities.bookmark_audit.browser_guard import (
    BrowserRunningError,
    assert_browser_not_running,
    is_browser_running,
)


def _mkmutation(**overrides):
    base = dict(
        bookmark_id="x", url="https://a.com", browser="chrome",
        expected_current_title="t", expected_current_folder_path=("Bookmark Bar",),
        operation="DELETE",
    )
    base.update(overrides)
    return MutationRequest(**base)


# ── MutationRequest validation ──────────────────────────────────────────────

def test_mutation_request_rejects_invalid_operation():
    with pytest.raises(ValueError):
        _mkmutation(operation="TRASH_IT")


def test_rename_requires_new_title():
    with pytest.raises(ValueError):
        _mkmutation(operation="RENAME")


def test_move_requires_new_folder_path():
    with pytest.raises(ValueError):
        _mkmutation(operation="MOVE")


def test_delete_needs_no_extra_fields():
    m = _mkmutation(operation="DELETE")
    assert m.operation == "DELETE"


def test_browser_field_is_required():
    with pytest.raises(TypeError):
        MutationRequest(
            bookmark_id="x", url="https://a.com",  # browser omitted
            expected_current_title="t", expected_current_folder_path=("Bookmark Bar",),
            operation="DELETE",
        )


# ── preview / approval ───────────────────────────────────────────────────────

def test_build_preview_is_deterministic():
    mutations = [_mkmutation(operation="RENAME", new_title="new")]
    p1 = build_preview(mutations)
    p2 = build_preview(mutations)
    assert p1.inputs_hash == p2.inputs_hash
    assert p1.operations == ("RENAME",)
    assert p1.mutation_count == 1
    assert p1.browsers == frozenset({"chrome"})


def test_build_preview_hash_changes_with_content():
    m1 = [_mkmutation(operation="RENAME", new_title="new")]
    m2 = [_mkmutation(operation="RENAME", new_title="different")]
    assert build_preview(m1).inputs_hash != build_preview(m2).inputs_hash


def test_build_preview_tracks_multiple_browsers():
    mutations = [
        _mkmutation(bookmark_id="x", browser="chrome"),
        _mkmutation(bookmark_id="y", browser="safari"),
    ]
    preview = build_preview(mutations)
    assert preview.browsers == frozenset({"chrome", "safari"})


def test_build_approval_binds_to_preview_hash():
    preview = build_preview([_mkmutation()])
    approval = build_approval(preview, operations_approved=["DELETE"], approved=True)
    assert approval["inputs_hash"] == preview.inputs_hash
    assert approval["approved"] is True
    assert approval["operations_approved"] == ["DELETE"]


def test_build_approval_does_not_default_to_approved():
    preview = build_preview([_mkmutation()])
    approval = build_approval(preview, operations_approved=["DELETE"], approved=False)
    assert approval["approved"] is False


def test_apply_refuses_locally_when_approval_bound_to_different_preview():
    from app.capabilities.bookmark_audit.apply import apply

    preview_a = build_preview([_mkmutation(bookmark_id="x")])
    preview_b = build_preview([_mkmutation(bookmark_id="y", url="https://b.com")])
    approval_for_b = build_approval(preview_b, operations_approved=["DELETE"], approved=True)

    # approval_for_b.inputs_hash != preview_a.inputs_hash — apply() must
    # refuse locally. Both browsers are mocked "not running" so this
    # isolates the approval-mismatch path from the browser gate.
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=1)
        outcome = asyncio.run(apply(preview_a, approval_for_b))
    assert outcome.status == "rejected"
    assert outcome.code == "approval_mismatch_local"


def test_requires_delete_approval_detection():
    from app.capabilities.bookmark_audit.apply import requires_delete_approval

    rename_only = [_mkmutation(operation="RENAME", new_title="n")]
    with_delete = rename_only + [_mkmutation(bookmark_id="y", url="https://b.com", operation="DELETE")]
    with_merge = rename_only + [_mkmutation(bookmark_id="z", url="https://c.com", operation="MERGE_DUPLICATE")]
    assert requires_delete_approval(rename_only) is False
    assert requires_delete_approval(with_delete) is True
    assert requires_delete_approval(with_merge) is True


# ── browser_guard ────────────────────────────────────────────────────────────

def test_is_browser_running_true_when_pgrep_finds_it():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)
        assert is_browser_running("chrome") is True
        mock_run.assert_called_once()
        assert mock_run.call_args[0][0] == ["pgrep", "-x", "Google Chrome"]


def test_is_browser_running_false_when_pgrep_finds_nothing():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=1)
        assert is_browser_running("safari") is False
        assert mock_run.call_args[0][0] == ["pgrep", "-x", "Safari"]


def test_is_browser_running_rejects_unknown_browser():
    with pytest.raises(ValueError):
        is_browser_running("firefox")


def test_assert_browser_not_running_raises_typed_error_when_running():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)
        with pytest.raises(BrowserRunningError) as excinfo:
            assert_browser_not_running("chrome")
        assert excinfo.value.code == "BROWSER_RUNNING"
        assert excinfo.value.browser == "chrome"


def test_assert_browser_not_running_passes_silently_when_not_running():
    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=1)
        assert_browser_not_running("safari")  # must not raise


def test_apply_rejects_before_any_network_call_when_browser_running():
    """The core acceptance property: when the gate fires, apply() must
    return BROWSER_RUNNING without ever calling the n8n client — proven by
    patching send_bookmark_apply_action_request to explode if called."""
    from app.capabilities.bookmark_audit import apply as apply_module

    preview = build_preview([_mkmutation(browser="chrome")])
    approval = build_approval(preview, operations_approved=["DELETE"], approved=True)

    async def _explode(*a, **kw):
        raise AssertionError("n8n must never be called when the browser-running gate fires")

    with patch("subprocess.run") as mock_run, \
         patch.object(apply_module, "send_bookmark_apply_action_request", _explode):
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=0)  # "running"
        outcome = asyncio.run(apply_module.apply(preview, approval))

    assert outcome.status == "rejected"
    assert outcome.code == "BROWSER_RUNNING"
    assert outcome.backup_path is None


def test_apply_reaches_approval_check_when_browser_not_running():
    """Mirror of the above: when the browser is not running, apply()
    proceeds past the gate to the (already-tested) approval-hash check."""
    from app.capabilities.bookmark_audit import apply as apply_module

    preview_a = build_preview([_mkmutation(browser="safari", bookmark_id="x")])
    preview_b = build_preview([_mkmutation(browser="safari", bookmark_id="y", url="https://b.com")])
    mismatched_approval = build_approval(preview_b, operations_approved=["DELETE"], approved=True)

    with patch("subprocess.run") as mock_run:
        mock_run.return_value = subprocess.CompletedProcess(args=[], returncode=1)  # "not running"
        outcome = asyncio.run(apply_module.apply(preview_a, mismatched_approval))

    # Reached the approval-hash check (a different rejection reason than
    # BROWSER_RUNNING) — proves the gate let it through.
    assert outcome.status == "rejected"
    assert outcome.code == "approval_mismatch_local"
