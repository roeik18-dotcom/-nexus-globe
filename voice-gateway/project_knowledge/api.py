"""API — the single facade the runtime calls.

Enforces the truth contract:
  SOURCE_FACT  — a verbatim slice of an indexed file, with provenance.
  INFERENCE    — model reasoning ABOUT sources (the caller labels these; never
                 emitted by retrieval itself).
  UNKNOWN      — no supporting source found; the model MUST say so, not invent.

`answer_context()` returns a compact, retrieval-only context block for the LLM plus
a machine-readable envelope. It never fabricates and never dumps the whole index.
"""
from __future__ import annotations
import time

from . import retrieval, observability

SOURCE_FACT = "SOURCE_FACT"
INFERENCE = "INFERENCE"
UNKNOWN = "UNKNOWN"

MIN_SCORE = 0.15  # below this, treat as "no real support"


def search(query: str, project: str | None = None, limit: int = 8):
    return retrieval.search_project_knowledge(query, project, limit)


def read_source(path: str, line_start: int | None = None, line_end: int | None = None):
    return retrieval.read_project_source(path, line_start, line_end)


def projects():
    return retrieval.list_projects()


def sources(project: str):
    return retrieval.list_project_sources(project)


def answer_context(query: str, project: str | None = None, limit: int = 8) -> dict:
    """Retrieve supporting sources for a user question.

    Returns:
      status: SOURCE_FACT | UNKNOWN
      context_block: str to inject into the LLM prompt (only relevant slices), or ""
      sources: list of {path, section, heading, line_start, line_end, score}
    """
    t0 = time.time()
    hits = [h for h in retrieval.search_project_knowledge(query, project, limit) if h["score"] >= MIN_SCORE]
    latency_ms = round((time.time() - t0) * 1000)
    top_sources = [f"{h['path']}:{h['line_start']}-{h['line_end']}" for h in hits]
    observability.log_query(query, project, len(hits), top_sources[:5], latency_ms)
    observability.record_last_query(query, top_sources[:5])

    if not hits:
        return {
            "status": UNKNOWN,
            "context_block": "",
            "sources": [],
            "instruction": (
                "No supporting source was found in the indexed projects. "
                "Tell the user you do not have enough source material to answer, "
                "and do NOT invent details."
            ),
            "latency_ms": latency_ms,
        }

    blocks = []
    for i, h in enumerate(hits, 1):
        prov = f"{h['path']} · {h['heading']} · lines {h['line_start']}-{h['line_end']}"
        blocks.append(f"[SOURCE_FACT #{i}] ({prov})\n{h['content']}")
    context_block = (
        "You may answer ONLY from the SOURCE_FACT blocks below. Cite the path and line "
        "range for each fact you use. If a fact is not present, say it is UNKNOWN — never "
        "invent. If you add reasoning of your own, label it INFERENCE.\n\n"
        + "\n\n".join(blocks)
    )
    return {
        "status": SOURCE_FACT,
        "context_block": context_block,
        "sources": [
            {"path": h["path"], "section": h["section"], "heading": h["heading"],
             "line_start": h["line_start"], "line_end": h["line_end"], "score": h["score"]}
            for h in hits
        ],
        "latency_ms": latency_ms,
    }
