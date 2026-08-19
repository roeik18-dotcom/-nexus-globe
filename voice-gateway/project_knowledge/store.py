"""STORE — SQLite persistence for the manifest + chunks, with freshness by hash.

Tables:
  files(path PK, project, filename, type, modified_at, size, content_hash, indexable, seen_at)
  chunks(chunk_id PK, project, source_path, section, heading, line_start, line_end,
         content, content_hash, indexed_at)
  meta(key PK, value)
"""
from __future__ import annotations
import sqlite3
import time

from . import config

SCHEMA = """
CREATE TABLE IF NOT EXISTS files(
  path TEXT PRIMARY KEY, project TEXT, filename TEXT, type TEXT,
  modified_at REAL, size INTEGER, content_hash TEXT, indexable INTEGER, seen_at REAL
);
CREATE TABLE IF NOT EXISTS chunks(
  chunk_id TEXT PRIMARY KEY, project TEXT, source_path TEXT, section TEXT, heading TEXT,
  line_start INTEGER, line_end INTEGER, content TEXT, content_hash TEXT, indexed_at REAL
);
CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(source_path);
CREATE INDEX IF NOT EXISTS idx_chunks_project ON chunks(project);
CREATE TABLE IF NOT EXISTS meta(key TEXT PRIMARY KEY, value TEXT);
"""


def connect(db_path: str | None = None) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path or config.DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.executescript(SCHEMA)
    return conn


def get_file_hash(conn, path: str):
    row = conn.execute("SELECT content_hash FROM files WHERE path=?", (path,)).fetchone()
    return row["content_hash"] if row else None


def upsert_file(conn, rec: dict):
    conn.execute(
        """INSERT INTO files(path,project,filename,type,modified_at,size,content_hash,indexable,seen_at)
           VALUES(:path,:project,:filename,:type,:modified_at,:size,:content_hash,:indexable,:seen_at)
           ON CONFLICT(path) DO UPDATE SET project=excluded.project,filename=excluded.filename,
           type=excluded.type,modified_at=excluded.modified_at,size=excluded.size,
           content_hash=excluded.content_hash,indexable=excluded.indexable,seen_at=excluded.seen_at""",
        {**rec, "seen_at": time.time()},
    )


def replace_chunks(conn, source_path: str, chunk_rows: list[dict]):
    conn.execute("DELETE FROM chunks WHERE source_path=?", (source_path,))
    conn.executemany(
        """INSERT OR REPLACE INTO chunks(chunk_id,project,source_path,section,heading,
             line_start,line_end,content,content_hash,indexed_at)
           VALUES(:chunk_id,:project,:source_path,:section,:heading,:line_start,:line_end,
             :content,:content_hash,:indexed_at)""",
        chunk_rows,
    )


def delete_missing(conn, seen_paths: set[str]) -> int:
    existing = [r["path"] for r in conn.execute("SELECT path FROM files").fetchall()]
    gone = [p for p in existing if p not in seen_paths]
    for p in gone:
        conn.execute("DELETE FROM files WHERE path=?", (p,))
        conn.execute("DELETE FROM chunks WHERE source_path=?", (p,))
    return len(gone)


def set_meta(conn, key: str, value: str):
    conn.execute("INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
                 (key, str(value)))


def get_meta(conn, key: str, default=None):
    row = conn.execute("SELECT value FROM meta WHERE key=?", (key,)).fetchone()
    return row["value"] if row else default


def counts(conn):
    f = conn.execute("SELECT COUNT(*) c FROM files").fetchone()["c"]
    ch = conn.execute("SELECT COUNT(*) c FROM chunks").fetchone()["c"]
    return f, ch
