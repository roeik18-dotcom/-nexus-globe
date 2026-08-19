"""RETRIEVAL — BM25 search over indexed chunks + source reading + listing.

Dependency-free (pure-Python Okapi BM25). Every hit carries full provenance:
source_path, section, heading, line range, relevance score. No source content is
rewritten — search returns verbatim chunk slices.
"""
from __future__ import annotations
import math
import re
import unicodedata

from . import config, store

_TOKEN = re.compile(r"[A-Za-z0-9֐-׿]+")
_NIKUD = lambda ch: 0x0591 <= ord(ch) <= 0x05C7


def tokenize(text: str) -> list[str]:
    text = "".join(ch for ch in unicodedata.normalize("NFC", text or "") if not _NIKUD(ch))
    return [t.lower() for t in _TOKEN.findall(text)]


class _BM25:
    def __init__(self, docs_tokens, k1=1.5, b=0.75):
        self.k1, self.b = k1, b
        self.N = len(docs_tokens)
        self.dl = [len(d) for d in docs_tokens]
        self.avgdl = (sum(self.dl) / self.N) if self.N else 0.0
        self.tf = []
        df = {}
        for toks in docs_tokens:
            counts = {}
            for t in toks:
                counts[t] = counts.get(t, 0) + 1
            self.tf.append(counts)
            for t in counts:
                df[t] = df.get(t, 0) + 1
        self.idf = {t: math.log(1 + (self.N - n + 0.5) / (n + 0.5)) for t, n in df.items()}

    def score(self, q_tokens, i):
        s = 0.0
        tf = self.tf[i]
        dl = self.dl[i] or 1
        for t in q_tokens:
            if t not in tf:
                continue
            idf = self.idf.get(t, 0.0)
            f = tf[t]
            s += idf * (f * (self.k1 + 1)) / (f + self.k1 * (1 - self.b + self.b * dl / self.avgdl))
        return s


# ---- cached index (rebuilt when the DB changes) -------------------------------
_CACHE = {"key": None, "rows": None, "bm25": None}


def _load(db_path=None):
    conn = store.connect(db_path)
    files_n, chunks_n = store.counts(conn)
    key = (db_path or config.DB_PATH, chunks_n, store.get_meta(conn, "last_indexing_time"))
    if _CACHE["key"] == key:
        conn.close()
        return _CACHE["rows"], _CACHE["bm25"]
    rows = [dict(r) for r in conn.execute(
        "SELECT chunk_id,project,source_path,section,heading,line_start,line_end,content FROM chunks").fetchall()]
    conn.close()
    bm25 = _BM25([tokenize(r["heading"] + "\n" + r["content"]) for r in rows])
    _CACHE.update(key=key, rows=rows, bm25=bm25)
    return rows, bm25


def search_project_knowledge(query: str, project: str | None = None, limit: int = 8, db_path=None):
    """Return up to `limit` scored source chunks. Empty list => no supporting source."""
    rows, bm25 = _load(db_path)
    q = tokenize(query)
    if not q or not rows:
        return []
    scored = []
    for i, r in enumerate(rows):
        if project and r["project"] != project:
            continue
        sc = bm25.score(q, i)
        if sc > 0:
            scored.append((sc, r))
    scored.sort(key=lambda x: -x[0])
    out = []
    for sc, r in scored[:limit]:
        out.append({
            "content": r["content"], "path": r["source_path"], "project": r["project"],
            "section": r["section"], "heading": r["heading"],
            "line_start": r["line_start"], "line_end": r["line_end"],
            "score": round(sc, 4),
        })
    return out


def read_project_source(path: str, line_start: int | None = None, line_end: int | None = None):
    """Read verbatim source (optionally a line range, 1-indexed inclusive)."""
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as fh:
            lines = fh.read().split("\n")
    except OSError as e:
        return {"error": f"{type(e).__name__}: {e}", "path": path}
    n = len(lines)
    a = 1 if line_start is None else max(1, line_start)
    b = n if line_end is None else min(n, line_end)
    return {"path": path, "line_start": a, "line_end": b, "content": "\n".join(lines[a - 1:b])}


def list_projects(db_path=None):
    conn = store.connect(db_path)
    rows = conn.execute(
        "SELECT project, COUNT(DISTINCT source_path) files, COUNT(*) chunks FROM chunks GROUP BY project ORDER BY chunks DESC"
    ).fetchall()
    conn.close()
    return [{"project": r["project"], "files": r["files"], "chunks": r["chunks"]} for r in rows]


def list_project_sources(project: str, db_path=None):
    conn = store.connect(db_path)
    rows = conn.execute(
        "SELECT path, filename, type, size, modified_at FROM files WHERE project=? ORDER BY path", (project,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]
