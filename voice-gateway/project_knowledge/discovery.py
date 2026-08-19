"""DISCOVERY — walk the source tree and produce a manifest of meaningful files.

Read-only. Honors the exclude rules in config. Each record:
project, path, filename, type, modified_at, size, content_hash.
"""
from __future__ import annotations
import hashlib
import os
from dataclasses import dataclass, asdict

from . import config


@dataclass
class FileRecord:
    project: str
    path: str
    filename: str
    type: str
    modified_at: float
    size: int
    content_hash: str
    indexable: bool  # False when too large / unreadable — still surfaced, never chunked


def _hash_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def _excluded_path(path: str) -> bool:
    return any(sub in path for sub in config.EXCLUDE_PATH_SUBSTR)


def discover(root: str | None = None):
    """Yield FileRecord for every indexable file under root."""
    root = root or config.ROOT
    for dirpath, dirnames, filenames in os.walk(root):
        # prune excluded dirs in-place so os.walk never descends into them
        dirnames[:] = [d for d in dirnames if d not in config.EXCLUDE_DIRS and not d.startswith(".")]
        for fn in filenames:
            if fn in config.EXCLUDE_FILENAMES:
                continue
            ext = os.path.splitext(fn)[1].lower()
            ftype = config.INCLUDE_EXT.get(ext)
            if not ftype:
                continue
            path = os.path.join(dirpath, fn)
            if _excluded_path(path):
                continue
            try:
                stat = os.stat(path)
            except OSError:
                continue
            size = stat.st_size
            indexable = 0 < size <= config.MAX_BYTES
            try:
                with open(path, "rb") as fh:
                    raw = fh.read() if indexable else fh.read(4096)
                content_hash = _hash_bytes(raw) if indexable else _hash_bytes(raw + str(size).encode())
            except OSError:
                continue
            yield FileRecord(
                project=config.project_for(path),
                path=path,
                filename=fn,
                type=ftype,
                modified_at=round(stat.st_mtime, 3),
                size=size,
                content_hash=content_hash,
                indexable=indexable,
            )


def discover_list(root: str | None = None):
    return [asdict(r) for r in discover(root)]
