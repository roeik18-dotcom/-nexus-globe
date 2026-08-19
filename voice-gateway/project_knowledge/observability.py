"""OBSERVABILITY — KNOWLEDGE_QUERY logging + stats snapshot for the Control Panel."""
from __future__ import annotations
import json
import os
import time

from . import config, store


def log_query(query: str, project, hits: int, top_sources: list[str], latency_ms: int):
    line = (
        "KNOWLEDGE_QUERY "
        f"query={json.dumps(query, ensure_ascii=False)} "
        f"project={project or '*'} hits={hits} "
        f"top_sources={json.dumps(top_sources, ensure_ascii=False)} "
        f"latency_ms={latency_ms}"
    )
    try:
        with open(config.LOG_PATH, "a", encoding="utf-8") as fh:
            fh.write(line + "\n")
    except OSError:
        pass
    return line


def record_last_query(query: str, sources: list[str]):
    """Persist the most recent query + sources so the Control Panel can display them."""
    try:
        conn = store.connect()
        store.set_meta(conn, "last_query", query)
        store.set_meta(conn, "last_sources", json.dumps(sources, ensure_ascii=False))
        store.set_meta(conn, "last_query_at", time.time())
        conn.commit(); conn.close()
    except Exception:
        pass


def stats() -> dict:
    """Snapshot for the Control Panel: indexed sources, chunks, last indexing, last query."""
    conn = store.connect()
    files_n, chunks_n = store.counts(conn)
    last_index = store.get_meta(conn, "last_indexing_time")
    last_query = store.get_meta(conn, "last_query")
    last_query_at = store.get_meta(conn, "last_query_at")
    last_sources = store.get_meta(conn, "last_sources")
    conn.close()
    snap = {
        "indexed_sources": files_n,
        "indexed_chunks": chunks_n,
        "last_indexing_time": float(last_index) if last_index else None,
        "last_query": last_query,
        "last_query_at": float(last_query_at) if last_query_at else None,
        "last_sources_used": json.loads(last_sources) if last_sources else [],
    }
    try:
        with open(config.STATS_PATH, "w", encoding="utf-8") as fh:
            json.dump(snap, fh, ensure_ascii=False, indent=2)
    except OSError:
        pass
    return snap
