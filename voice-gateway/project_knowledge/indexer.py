"""INDEXER — incremental build: DISCOVERY -> chunk changed files -> STORE.

Freshness: a file is re-chunked only when its content_hash differs from the stored
one (or it is new). Removed files are pruned. Returns a summary dict.
"""
from __future__ import annotations
import hashlib
import time

from . import config, store
from .discovery import discover
from .chunker import chunk_file


def _chunk_id(path: str, line_start: int, line_end: int) -> str:
    # Unique per (file, line-range) so provenance is never overwritten across files.
    return hashlib.sha1(f"{path}:{line_start}-{line_end}".encode("utf-8")).hexdigest()[:20]


def _read_text(path: str) -> str | None:
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            return fh.read()
    except OSError:
        return None


def reindex(root: str | None = None, db_path: str | None = None, force: bool = False) -> dict:
    root = root or config.ROOT
    conn = store.connect(db_path)
    t0 = time.time()
    seen, changed, new, unchanged, chunked = set(), 0, 0, 0, 0
    for rec in discover(root):
        seen.add(rec.path)
        prev = store.get_file_hash(conn, rec.path)
        is_new = prev is None
        is_changed = prev is not None and prev != rec.content_hash
        store.upsert_file(conn, {
            "path": rec.path, "project": rec.project, "filename": rec.filename, "type": rec.type,
            "modified_at": rec.modified_at, "size": rec.size, "content_hash": rec.content_hash,
            "indexable": int(rec.indexable),
        })
        if is_new:
            new += 1
        elif is_changed:
            changed += 1
        else:
            unchanged += 1
        if not rec.indexable:
            continue
        if force or is_new or is_changed:
            text = _read_text(rec.path)
            if text is None:
                continue
            rows = []
            for c, chash in chunk_file(text, rec.type):
                rows.append({
                    "chunk_id": _chunk_id(rec.path, c.line_start, c.line_end),
                    "project": rec.project, "source_path": rec.path,
                    "section": c.section, "heading": c.heading,
                    "line_start": c.line_start, "line_end": c.line_end,
                    "content": c.content, "content_hash": chash, "indexed_at": time.time(),
                })
            store.replace_chunks(conn, rec.path, rows)
            chunked += len(rows)
    removed = store.delete_missing(conn, seen)
    files_n, chunks_n = store.counts(conn)
    store.set_meta(conn, "last_indexing_time", time.time())
    store.set_meta(conn, "root", root)
    conn.commit()
    summary = {
        "root": root, "files_indexed": files_n, "chunks_indexed": chunks_n,
        "new": new, "changed": changed, "unchanged": unchanged, "removed": removed,
        "chunks_written_this_run": chunked, "latency_ms": round((time.time() - t0) * 1000),
    }
    conn.close()
    return summary
