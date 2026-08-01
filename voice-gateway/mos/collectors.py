"""Merlin OS · Morning collectors.

Each collector answers for exactly ONE source and reports its own health. None of
them interpret: `git` says "6 commits", never "you were productive".

Only three sources exist on this machine today — clock/host, system health, and
git. Every other domain in DOMAINS ships as an explicit `not_configured`
collector rather than being left out, so `run_morning_brief` can state what
Merlin is blind to instead of quietly omitting it.
"""
from __future__ import annotations

import datetime
import os
import platform
import shutil
import subprocess
from pathlib import Path

from .snapshot import (
    Collector,
    SourceCoverage,
    SourceReading,
    SourceStatus,
    not_configured,
    now_iso,
)

REPO_ROOT = Path(__file__).resolve().parent.parent.parent


def _ok(
    source_id: str,
    domain: str,
    payload: dict,
    *,
    absence_is_meaningful: bool,
    confidence: float,
    evidence: list[str],
    data_age_seconds: float | None = 0.0,
    collected_at: str | None = None,
) -> SourceReading:
    return SourceReading(
        coverage=SourceCoverage(
            source_id=source_id,
            domain=domain,
            status=SourceStatus.AVAILABLE,
            collected_at=collected_at or now_iso(),
            data_age_seconds=data_age_seconds,
            absence_is_meaningful=absence_is_meaningful,
            confidence=confidence,
            evidence=evidence,
        ),
        payload=payload,
    )


# ── awareness: where and when we are ─────────────────────────────────────────


class ClockCollector:
    """Local time, date and zone from the machine itself.

    absence_is_meaningful=False by construction: a clock is never empty, so the
    flag would be meaningless. It is set false rather than true to avoid implying
    that a missing clock would tell us something.
    """

    source_id = "awareness.clock"
    domain = "awareness"

    def collect(self) -> SourceReading:
        now = datetime.datetime.now().astimezone()
        return _ok(
            self.source_id, self.domain,
            {
                "iso": now.isoformat(timespec="seconds"),
                "local": now.strftime("%A, %d %B %Y, %H:%M"),
                "timezone": now.tzname(),
                "utc_offset": now.strftime("%z"),
            },
            absence_is_meaningful=False,
            confidence=1.0,
            evidence=["system clock"],
        )


class HostHealthCollector:
    """Host identity and disk headroom — what we can read without extra tooling.

    Deliberately NOT reporting docker/services: nothing here queries them, and a
    silent omission would read as "all services fine".
    """

    source_id = "awareness.host"
    domain = "awareness"

    def collect(self) -> SourceReading:
        usage = shutil.disk_usage(str(REPO_ROOT))
        free_pct = usage.free / usage.total * 100 if usage.total else 0.0
        return _ok(
            self.source_id, self.domain,
            {
                "host": platform.node(),
                "os": f"{platform.system()} {platform.release()}",
                "python": platform.python_version(),
                "disk_free_gb": round(usage.free / 1e9, 1),
                "disk_free_pct": round(free_pct, 1),
                "services_checked": [],
                "services_note": "no service/docker probe wired up",
            },
            absence_is_meaningful=False,
            confidence=1.0,
            evidence=["platform", "shutil.disk_usage"],
        )


# ── git: the one source whose silence is evidence ────────────────────────────


class GitCollector:
    """Commits and working-tree state for the repo.

    This is the ONLY collector here with absence_is_meaningful=True: git is
    authoritative about its own history, so zero commits genuinely means no
    commits were made. That is exactly the distinction the rest of the module
    exists to protect.
    """

    source_id = "git.repo"
    domain = "git"

    def __init__(self, root: Path | None = None, since: str = "24 hours ago") -> None:
        self.root = root or REPO_ROOT
        self.since = since

    def _git(self, *args: str) -> str:
        return subprocess.run(
            ["git", "-C", str(self.root), *args],
            capture_output=True, text=True, timeout=15, check=True,
        ).stdout.strip()

    def collect(self) -> SourceReading:
        if not (self.root / ".git").exists():
            return not_configured(
                self.source_id, self.domain, f"no git repository at {self.root}",
            )
        try:
            log = self._git(
                "log", f"--since={self.since}", "--pretty=%H%x1f%an%x1f%aI%x1f%s",
            )
            commits = [
                dict(zip(("sha", "author", "at", "subject"), line.split("\x1f")))
                for line in log.splitlines() if line
            ]
            porcelain = self._git("status", "--porcelain")
            changed = [ln[3:] for ln in porcelain.splitlines() if ln]
            branch = self._git("rev-parse", "--abbrev-ref", "HEAD")
            ahead = self._git("rev-list", "--count", "@{u}..HEAD") if self._has_upstream() else None
        except subprocess.CalledProcessError as ex:
            return SourceReading(
                coverage=SourceCoverage(
                    source_id=self.source_id, domain=self.domain,
                    status=SourceStatus.ERROR, collected_at=now_iso(),
                    data_age_seconds=None, absence_is_meaningful=False,
                    confidence=0.0, evidence=[],
                    note=f"git failed: {(ex.stderr or '').strip()[:120]}",
                ),
                payload={},
            )
        return _ok(
            self.source_id, self.domain,
            {
                "branch": branch,
                "window": self.since,
                "commit_count": len(commits),
                "commits": commits,
                "changed_file_count": len(changed),
                "changed_files": changed,
                "unpushed_commits": int(ahead) if ahead is not None else None,
            },
            absence_is_meaningful=True,   # ← git's silence IS evidence
            confidence=1.0,
            evidence=[f"git log --since={self.since}", "git status --porcelain"],
        )

    def _has_upstream(self) -> bool:
        try:
            self._git("rev-parse", "--abbrev-ref", "@{u}")
            return True
        except subprocess.CalledProcessError:
            return False


class ProjectActivityCollector:
    """Per-project activity, derived from git paths only.

    Coverage is partial by nature: it sees committed work in this repo and
    nothing else. Music worked on in Ableton, or thinking done away from the
    keyboard, is invisible here — hence absence_is_meaningful=False, even though
    the underlying git data is authoritative.
    """

    source_id = "projects.git_activity"
    domain = "projects"

    #: project → path prefixes that count as that project
    PROJECTS = {
        "philos": ("app/", "docs/", "data/"),
        "merlin": ("voice-gateway/",),
        "multi_agent": ("voice-gateway/mos/", "kernel/", "capabilities/"),
        "music": (),   # no path in this repo represents music work
    }

    def __init__(self, root: Path | None = None, since: str = "24 hours ago") -> None:
        self.root = root or REPO_ROOT
        self.since = since

    def collect(self) -> SourceReading:
        if not (self.root / ".git").exists():
            return not_configured(
                self.source_id, self.domain, f"no git repository at {self.root}",
            )
        try:
            out = subprocess.run(
                ["git", "-C", str(self.root), "log", f"--since={self.since}", "--name-only",
                 "--pretty=format:%H"],
                capture_output=True, text=True, timeout=20, check=True,
            ).stdout
        except subprocess.CalledProcessError as ex:
            return SourceReading(
                coverage=SourceCoverage(
                    source_id=self.source_id, domain=self.domain,
                    status=SourceStatus.ERROR, collected_at=now_iso(),
                    data_age_seconds=None, absence_is_meaningful=False,
                    confidence=0.0, evidence=[], note=f"git failed: {ex}",
                ),
                payload={},
            )
        touched = {p for p in out.splitlines() if p and "/" in p}
        projects = {
            name: sum(1 for p in touched if any(p.startswith(pre) for pre in prefixes))
            for name, prefixes in self.PROJECTS.items()
        }
        return _ok(
            self.source_id, self.domain,
            {
                "window": self.since,
                "files_touched_by_project": projects,
                "coverage_note": (
                    "git paths in this repo only — work outside it (Ableton, "
                    "reading, conversations) is not observable here"
                ),
            },
            # a project at 0 here may simply have happened elsewhere
            absence_is_meaningful=False,
            confidence=0.6,
            evidence=[f"git log --since={self.since} --name-only"],
        )


# ── domains with no source yet ───────────────────────────────────────────────
# Present on purpose. Omitting them would let a later layer treat "no data" as
# "nothing happened" — the exact failure this pipeline is built to prevent.


class NotConfiguredCollector:
    """A domain Merlin is currently blind to, declared rather than hidden."""

    def __init__(self, source_id: str, domain: str, note: str) -> None:
        self.source_id = source_id
        self.domain = domain
        self._note = note

    def collect(self) -> SourceReading:
        return not_configured(self.source_id, self.domain, self._note)


def default_collectors(root: Path | None = None, since: str = "24 hours ago") -> list[Collector]:
    """The collector set for this machine, today.

    Three real sources; the rest declare their absence. As each is wired up it
    replaces its NotConfiguredCollector here and nothing else changes.
    """
    return [
        ClockCollector(),
        HostHealthCollector(),
        GitCollector(root, since),
        ProjectActivityCollector(root, since),
        NotConfiguredCollector(
            "personal_config.profile", "personal_config",
            "no profile store wired up — cannot report version or changes since last session",
        ),
        NotConfiguredCollector(
            "music.ableton", "music",
            "no Ableton project path configured — song, mix and master state unobservable",
        ),
        NotConfiguredCollector(
            "communications.gmail", "communications",
            "Gmail not authenticated — zero messages here would mean no access, not no mail",
        ),
        NotConfiguredCollector(
            "communications.calendar", "communications",
            "no calendar source configured — today's events unobservable",
        ),
        NotConfiguredCollector(
            "finance.ledger", "finance",
            "no ledger or bank source configured — expenses and upcoming charges unobservable",
        ),
        NotConfiguredCollector(
            "ideas.store", "ideas",
            "no idea store configured — new/updated/archived ideas unobservable",
        ),
        NotConfiguredCollector(
            "blockers.registry", "blockers",
            "no blocker registry — shortages of people, equipment, knowledge and time "
            "are not tracked anywhere Merlin can read",
        ),
    ]
