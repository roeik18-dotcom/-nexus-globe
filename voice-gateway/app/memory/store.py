"""Thread-safe JSON-backed memory store."""

from __future__ import annotations

import json
import os
import threading
from datetime import datetime, timezone
from pathlib import Path

from .schema import Memory, _now

_IMPORTANCE_RANK = {"critical": 0, "high": 1, "medium": 2, "low": 3}


def _ts(iso: str) -> float:
    try:
        return datetime.fromisoformat(iso).timestamp()
    except Exception:
        return 0.0


class MemoryStore:
    """CRUD for relationship memories stored in a single JSON file.

    Thread-safe: reads and writes always hold the internal lock.
    Writes are atomic (write .tmp → os.replace).
    """

    def __init__(self, path: Path) -> None:
        self._path = path
        self._lock = threading.Lock()
        self._mem: dict[str, Memory] = {}
        path.parent.mkdir(parents=True, exist_ok=True)
        self._load()

    # ── persistence ───────────────────────────────────────────────────────────

    def _load(self) -> None:
        if not self._path.exists():
            return
        try:
            data = json.loads(self._path.read_text(encoding="utf-8"))
            self._mem = {
                d["id"]: Memory.from_dict(d)
                for d in data.get("memories", [])
            }
        except Exception:
            self._mem = {}

    def _save(self) -> None:
        tmp = self._path.with_suffix(".tmp")
        payload = {"memories": [m.to_dict() for m in self._mem.values()]}
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, self._path)

    # ── write operations ──────────────────────────────────────────────────────

    def upsert(self, memory: Memory) -> None:
        """Insert or update a memory.  Protected (editable=False) memories are untouched."""
        with self._lock:
            existing = self._mem.get(memory.id)
            if existing and not existing.editable:
                return
            if existing:
                memory.created_at = existing.created_at   # keep original birth date
            memory.updated_at = _now()
            self._mem[memory.id] = memory
            self._save()

    def touch(self, memory_id: str) -> None:
        """Record that a memory was used right now."""
        with self._lock:
            if memory_id in self._mem:
                self._mem[memory_id].last_used = _now()
                self._save()

    def delete(self, memory_id: str) -> bool:
        """Delete a memory. Returns False if not found or protected."""
        with self._lock:
            mem = self._mem.get(memory_id)
            if not mem or not mem.editable:
                return False
            del self._mem[memory_id]
            self._save()
            return True

    def delete_by_key(self, key: str) -> bool:
        with self._lock:
            target = next((m for m in self._mem.values() if m.key == key and m.editable), None)
            if not target:
                return False
            del self._mem[target.id]
            self._save()
            return True

    # ── read operations ───────────────────────────────────────────────────────

    def get(self, memory_id: str) -> Memory | None:
        return self._mem.get(memory_id)

    def find_by_key(self, key: str) -> Memory | None:
        return next((m for m in self._mem.values() if m.key == key), None)

    def all(self) -> list[Memory]:
        return list(self._mem.values())

    def query(
        self,
        tier: str | None = None,
        category: str | None = None,
        importance_min: str = "low",
        tags: list[str] | None = None,
        limit: int = 50,
    ) -> list[Memory]:
        """Return memories sorted by importance then recency, filtered by criteria."""
        min_rank = _IMPORTANCE_RANK.get(importance_min, 3)
        results: list[Memory] = []

        for m in self._mem.values():
            if tier     and m.tier     != tier:         continue
            if category and m.category != category:     continue
            if _IMPORTANCE_RANK.get(m.importance, 3) > min_rank: continue
            if tags and not any(t in m.tags for t in tags):       continue
            results.append(m)

        results.sort(
            key=lambda m: (
                _IMPORTANCE_RANK.get(m.importance, 3),
                -_ts(m.last_used),
            )
        )
        return results[:limit]

    def for_context(self, max_items: int = 20) -> list[Memory]:
        """Top memories for system prompt injection: critical + high always, medium if space."""
        critical_high = self.query(importance_min="high", limit=max_items)
        if len(critical_high) < max_items:
            medium = self.query(importance_min="medium", limit=max_items - len(critical_high))
            seen_ids = {m.id for m in critical_high}
            critical_high += [m for m in medium if m.id not in seen_ids]
        return critical_high[:max_items]
