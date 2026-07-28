"""Extract new memories from a completed conversation turn.

Uses claude-haiku-4-5-20251001 as a cheap background extractor — this call
happens after the user receives their response, so latency is invisible.
"""

from __future__ import annotations

import json
import logging
import re
import uuid
from typing import TYPE_CHECKING

import anthropic

from .schema import Memory, _now

if TYPE_CHECKING:
    from .store import MemoryStore

logger = logging.getLogger(__name__)

_MODEL = "claude-haiku-4-5-20251001"

_SYSTEM = """You are a memory extraction agent for Merlin, a personal AI assistant.

Analyze the conversation and extract significant facts about THE USER ONLY.
The goal is to build a long-term relationship model so Merlin becomes more helpful over time.

Output a JSON object: {"memories": [...], "corrections": [...]}

Each item in "memories":
{
  "key": "snake_case_identifier",     // stable, reuse existing keys when updating
  "value": "concise fact (1-2 sentences max)",
  "tier": "personal|project|relationship",
  "category": "preference|goal|event|habit|style|project|person|fact",
  "confidence": 0.0-1.0,
  "source": "explicit|inferred",      // explicit = user stated directly
  "importance": "critical|high|medium|low",
  "tags": ["tag1", "tag2"]
}

Each item in "corrections" (user correcting something they said before):
{
  "key": "key_to_update_or_delete",
  "action": "update|delete",
  "new_value": "corrected value (only for action=update)"
}

Tiers:
- personal: facts about the person (preferences, life events, health, family, values, schedule)
- project: work or creative projects (status, goals, tech stack, blockers)
- relationship: how they communicate (language, tone, pace, formality)

Importance:
- critical: health, safety, deeply held values, non-negotiables
- high: major goals, life events, strong preferences, key projects
- medium: habits, workflow preferences, recurring topics, nice-to-knows
- low: casual mentions unlikely to matter much

Rules:
- Only extract about the USER, not Merlin's responses
- "I'm tired today" → skip (temporary, not worth storing)
- "I always work late" → medium habit
- "My startup launched yesterday" → high event
- "I hate long explanations" → high preference (affects every interaction)
- Return {"memories": [], "corrections": []} if nothing significant
- Confidence < 0.6: skip it
- Never duplicate — if a key already exists in the existing list, only include it if the value meaningfully changed
"""

_DEDUP_NOTE = """
Existing memory keys (with current value summaries):
{keys}

Only re-include a key if the conversation reveals a meaningful update or correction.
"""


async def extract_memories(
    user_text: str,
    merlin_text: str,
    store: "MemoryStore",
    api_key: str,
) -> list[Memory]:
    """
    Extract and persist new memories from one completed conversation turn.

    Returns the list of Memory objects that were created or updated.
    Silent on failure — never raises to the caller.
    """
    if not user_text.strip():
        return []

    existing = store.all()
    existing_summary = [
        f"{m.key} ({m.importance}): {m.value[:70]}"
        for m in existing
        if m.importance in ("critical", "high", "medium")
    ]

    system = _SYSTEM
    if existing_summary:
        system += _DEDUP_NOTE.format(keys="\n".join(existing_summary[:40]))

    conversation = f"User: {user_text}\n\nMerlin: {merlin_text[:300]}"

    client = anthropic.AsyncAnthropic(api_key=api_key)
    try:
        resp = await client.messages.create(
            model=_MODEL,
            max_tokens=1024,
            system=system,
            messages=[{
                "role": "user",
                "content": f"<conversation>\n{conversation}\n</conversation>\n\nExtract memories.",
            }],
        )
        raw = resp.content[0].text.strip()

        # Extract JSON — model may wrap it in markdown fences
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if not m:
            return []
        data = json.loads(m.group())
    except Exception as e:
        logger.debug("Memory extraction error: %s", e)
        return []

    # ── process corrections ───────────────────────────────────────────────────
    for corr in data.get("corrections", []):
        key    = str(corr.get("key", "")).strip()
        action = str(corr.get("action", "")).strip()
        if not key:
            continue
        if action == "delete":
            if store.delete_by_key(key):
                logger.info("Memory deleted by correction: %s", key)
        elif action == "update":
            existing_mem = store.find_by_key(key)
            if existing_mem and existing_mem.editable:
                existing_mem.value      = str(corr.get("new_value", existing_mem.value))
                existing_mem.updated_at = _now()
                existing_mem.confidence = min(existing_mem.confidence + 0.1, 1.0)
                store.upsert(existing_mem)
                logger.info("Memory corrected: %s", key)

    # ── process new / updated memories ───────────────────────────────────────
    results: list[Memory] = []
    for item in data.get("memories", []):
        key   = str(item.get("key", "")).strip()
        value = str(item.get("value", "")).strip()
        if not key or not value:
            continue
        confidence = float(item.get("confidence", 0.8))
        if confidence < 0.6:
            continue

        existing_mem = store.find_by_key(key)
        mem_id       = existing_mem.id if existing_mem else f"mem_{uuid.uuid4().hex[:8]}"

        mem = Memory(
            id=mem_id,
            tier=str(item.get("tier", "personal")),
            category=str(item.get("category", "fact")),
            key=key,
            value=value,
            confidence=confidence,
            source=str(item.get("source", "inferred")),
            importance=str(item.get("importance", "medium")),
            tags=list(item.get("tags", [])),
        )
        store.upsert(mem)
        action_word = "updated" if existing_mem else "learned"
        logger.info("Memory %s [%s/%s]: %s = %s", action_word, mem.tier, mem.category, key, value[:80])
        results.append(mem)

    return results
