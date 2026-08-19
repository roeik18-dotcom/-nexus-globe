"""Thread-safe JSON-backed automation store. Mirrors app/memory/store.py's
persistence shape (write .tmp -> os.replace) deliberately, so this module
follows an already-proven pattern rather than inventing a new one."""

from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Callable

from app.automation.models import Automation

DEFAULT_PATH = Path(__file__).resolve().parents[2] / "state" / "capability_automations.json"


class AutomationStore:
    """CRUD for standing automations. Thread-safe: every read/write holds
    the internal lock. Writes are atomic (write .tmp -> os.replace)."""

    def __init__(self, path: Path = DEFAULT_PATH) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._items: dict[str, Automation] = {}
        path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            self._items = {d["id"]: Automation.from_dict(d) for d in data.get("automations", [])}
        except Exception:  # noqa: BLE001 — a corrupt file must never crash the store
            self._items = {}

    def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        payload = {"automations": [a.to_dict() for a in self._items.values()]}
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    def create(self, automation: Automation) -> None:
        with self._lock:
            self._items[automation.id] = automation
            self._save()

    def get(self, automation_id: str) -> Automation | None:
        with self._lock:
            return self._items.get(automation_id)

    def list(self) -> list[Automation]:
        with self._lock:
            return list(self._items.values())

    def find_by_dedup_key(self, dedup_key: str) -> Automation | None:
        with self._lock:
            for a in self._items.values():
                if a.dedup_key == dedup_key and a.status.value in ("active", "paused"):
                    return a
            return None

    def update(self, automation: Automation) -> None:
        with self._lock:
            if automation.id not in self._items:
                raise KeyError(automation.id)
            self._items[automation.id] = automation
            self._save()

    def mutate(self, automation_id: str, fn: Callable[[Automation], Any]) -> Any:
        """Atomic read-modify-write: `fn` runs with the store's lock held, may
        mutate the automation in place, and its return value is passed back
        to the caller. The (possibly mutated) automation is always persisted
        afterward. This is the ONLY safe way to both read current state and
        act on it — a separate get() then update() has a race window where
        another caller's mutate()/update() in between gets silently
        clobbered by the later write (see app/automation/engine.py's use of
        this for the exact scenario it closes: a fire in progress must never
        stomp a concurrent pause/resume/cancel, and vice versa).
        Raises KeyError if automation_id doesn't exist."""
        with self._lock:
            a = self._items.get(automation_id)
            if a is None:
                raise KeyError(automation_id)
            result = fn(a)
            self._items[automation_id] = a
            self._save()
            return result

    def delete(self, automation_id: str) -> None:
        with self._lock:
            self._items.pop(automation_id, None)
            self._save()


_default_store: AutomationStore | None = None


def get_default_store() -> AutomationStore:
    """Process-wide singleton over DEFAULT_PATH, lazily constructed so
    importing this module never touches the filesystem. Tests replace it via
    `set_default_store_for_testing()` rather than relying on the real
    state/capability_automations.json path."""
    global _default_store
    if _default_store is None:
        _default_store = AutomationStore()
    return _default_store


def set_default_store_for_testing(store: AutomationStore | None) -> None:
    global _default_store
    _default_store = store
