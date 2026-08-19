"""RUNTIME INTEGRATION — importable hook for the live Merlin service.

This module is standalone and does NOT edit any runtime file. The service adopts it
with a two-line hook (see README). It decides whether a turn is knowledge-seeking,
runs retrieval, and returns ONLY the relevant source slices to inject — never the
whole index, never fabricated content.
"""
from __future__ import annotations
import re

from . import api

# Cheap gate so we don't retrieve on greetings / control phrases. Hebrew + English.
_TRIGGERS = [
    r"מה\s+מצב", r"מה\s+בנ", r"איזה\s+פרויקט", r"מה\s+כתוב", r"מה\s+עוד\s+לא", r"לא\s+גמור",
    r"ארכיטקטור", r"סקיצ", r"תעד|תיעוד|מסמך", r"קונפינג", r"נקסוס|globe", r"פילוס|philos",
    r"סטטוס", r"מה\s+יש\s+לנו", r"סכם\s+לי\s+את\s+הפרויקט",
    r"\bstatus\b", r"what\s+did\s+we\s+build", r"architecture", r"unfinished", r"which\s+projects",
    r"what'?s\s+in\b", r"spec\b", r"audit\b",
]
_TRIG_RE = re.compile("|".join(_TRIGGERS), re.IGNORECASE)


def should_retrieve(user_text: str) -> bool:
    t = (user_text or "").strip()
    if len(t) < 3:
        return False
    if _TRIG_RE.search(t):
        return True
    # question-shaped inputs about the projects are worth a (cheap) retrieval attempt
    return t.endswith("?") or "?" in t or "מה " in t or "איך " in t or "כמה " in t


def build_turn_context(user_text: str, project: str | None = None, limit: int = 8) -> dict:
    """Called by the runtime BEFORE the LLM call. Returns:
        {retrieved: bool, status, context_block, sources, instruction?}
    Inject `context_block` into the system/context portion of the LLM request only
    when retrieved is True. When status == UNKNOWN, pass `instruction` so the model
    tells the user there is no source instead of inventing.
    """
    if not should_retrieve(user_text):
        return {"retrieved": False, "status": None, "context_block": "", "sources": []}
    ctx = api.answer_context(user_text, project=project, limit=limit)
    return {"retrieved": True, **ctx}


# ---------------------------------------------------------------------------
# Runtime hook (for the window that owns service/merlin_service.py) — NOT applied here.
#
#   from project_knowledge import integration as pk
#   kctx = pk.build_turn_context(user_text)
#   if kctx["retrieved"] and kctx["context_block"]:
#       llm_messages.insert(0, {"role": "system", "content": kctx["context_block"]})
#   # if kctx["status"] == "UNKNOWN": also surface kctx["instruction"] to the model
#
# Control Panel stats:  from project_knowledge import observability; observability.stats()
# ---------------------------------------------------------------------------
