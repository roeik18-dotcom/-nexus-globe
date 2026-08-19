"""Hard runtime safety gate: refuses BOOKMARK_APPLY against a browser whose
process is currently running, before any network call, before any backup,
before any write.

Why this check runs in Merlin (Python), not n8n:
  n8n's Code-node sandbox has no subprocess/exec access (confirmed earlier
  in this project for other modules), and this n8n installation has no
  Execute Command node registered. An attempt to detect Chrome's
  SingletonLock file's existence via n8n's own readWriteFile node was
  built and tested against the real, currently-running Chrome — and
  discarded: Chrome's lock is a broken symlink (its target is a marker
  string "hostname-PID", not a real path), and n8n's file read follows
  symlinks via stat(), which fails with ENOENT for a broken symlink the
  same way it does for a genuinely absent path. n8n could not tell "Chrome
  is running" from "Chrome is not running" through that path, confirmed
  empirically (probe workflow, deleted after the test), so it was not used.

  This means the browser-running check is NOT independently re-verified by
  n8n the way auth/expiry/approval/idempotency are — a real, disclosed
  architectural limit of this n8n installation's sandbox, not a shortcut.
  It is still a hard gate in the sense that matters most: when it fires,
  apply() returns before send_bookmark_apply_action_request is ever
  called, so n8n never receives the request — no backup, no write, no
  partial execution, because n8n was never invoked at all.

Detection: `pgrep -x <exact process name>`, a plain Python subprocess call
with no sandbox restriction. Verified against real, live process state on
this Mac before being trusted: Chrome running -> pgrep -x "Google Chrome"
found PID 26944 (matching the PID actually encoded in Chrome's own
SingletonLock symlink target, cross-checked); Safari not running ->
pgrep -x "Safari" found nothing. Both checked independently of each other.
"""

from __future__ import annotations

import logging
import subprocess

logger = logging.getLogger("merlin.bookmark_audit.apply")

_BROWSER_PROCESS_NAMES = {
    "chrome": "Google Chrome",
    "safari": "Safari",
}


class BrowserRunningError(Exception):
    """Typed error for the BROWSER_RUNNING rejection. Carries `.code` so
    callers can surface a stable machine-readable reason, same pattern as
    StructuredResult.code elsewhere in this capability."""

    code = "BROWSER_RUNNING"

    def __init__(self, browser: str):
        self.browser = browser
        super().__init__(
            f"BROWSER_RUNNING: {browser} process is currently running — "
            "refusing to touch its live bookmark file"
        )


def is_browser_running(browser: str) -> bool:
    process_name = _BROWSER_PROCESS_NAMES.get(browser)
    if process_name is None:
        raise ValueError(f"unknown browser: {browser!r} (known: {sorted(_BROWSER_PROCESS_NAMES)})")
    result = subprocess.run(
        ["pgrep", "-x", process_name], capture_output=True, timeout=5, check=False,
    )
    return result.returncode == 0


def assert_browser_not_running(browser: str) -> None:
    """Raises BrowserRunningError if `browser`'s process is currently
    running. Must be called before any network call to n8n's Bookmark
    Apply webhook — never after backup/write has already started."""
    if is_browser_running(browser):
        logger.warning("bookmark_apply: BROWSER_RUNNING — refusing to touch %s's live bookmark file", browser)
        raise BrowserRunningError(browser)
