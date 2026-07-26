"""Fetches and formats Essence context for Merlin's system prompt.

This module is defense-in-depth only. Primary authorization is enforced
by the Next.js internal route via EssenceReadAPI and Merlin's access policy.
The filters here are a second layer of protection — they must never be
treated as the authoritative access boundary.

Failure behavior: any error (network, auth, parsing) returns an empty string
so the voice session degrades gracefully rather than blocking.
"""

import logging
from typing import Any

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Defense-in-depth: Merlin's readable layers per access.ts
_MERLIN_LAYERS = frozenset({"core", "expression", "identity"})

# Defense-in-depth: Merlin's maxSensitivity is 'personal'.
# Allowed sensitivities: public, personal. Excluded: private, highly_sensitive.
_ALLOWED_SENSITIVITY = frozenset({"public", "personal"})

_MAX_CHARS = 800

# ── Orientation dimensions ─────────────────────────────────────────────────────
# Mirror of ORIENTATION_NODE_IDS in app/lib/essence/orientation.ts.
# TypeScript is the canonical source — update both files together.

_ORIENTATION_NODE_IDS: frozenset[str] = frozenset({
    "OrientationCommunicationStyle",
    "OrientationResponseDepth",
    "OrientationTaskFraming",
    "OrientationDecisionStyle",
    "OrientationTaskCadence",
})

# Priority order for rendering — most impactful dimensions first so budget
# truncation drops the least-impactful ones.
_ORIENTATION_PRIORITY: tuple[str, ...] = (
    "OrientationResponseDepth",
    "OrientationTaskFraming",
    "OrientationTaskCadence",
    "OrientationCommunicationStyle",
    "OrientationDecisionStyle",
)

# Fixed trusted sentences per dimension value. Raw content from Essence is never
# interpolated into the prompt — only the matching sentence is used.
_ORIENTATION_SENTENCES: dict[str, dict[str, str]] = {
    "OrientationCommunicationStyle": {
        "direct":        "Communicate directly — lead with the answer.",
        "exploratory":   "Present reasoning and invite exploration.",
        "collaborative": "Offer a first step, then invite input.",
    },
    "OrientationResponseDepth": {
        "brief":       "Omit explanatory context unless asked.",
        "balanced":    "Include brief rationale with each response.",
        "explanatory": "Expand reasoning by default.",
    },
    "OrientationTaskFraming": {
        "action_first":  "Open with the next concrete action.",
        "context_first": "Provide brief context before the action.",
        "options_first": "Present two or three paths before recommending.",
    },
    "OrientationDecisionStyle": {
        "decisive":     "Recommend one option directly.",
        "comparative":  "Show two options with a short comparison.",
        "deliberative": "Outline trade-offs before recommending.",
    },
    "OrientationTaskCadence": {
        "single_step": "Present only the immediate next step.",
        "phased":      "Show the current step and a brief overall plan.",
        "continuous":  "Present the full flow at once.",
    },
}

_PRECEDENCE_NOTICE = (
    "Preferences are advisory; current requests and safety take priority."
)

# Budget for the orientation block (sentences + precedence notice), atomic.
_ORIENTATION_MAX = 300


def _build_orientation_block(nodes: dict[str, Any]) -> str:
    """Build orientation block from pre-filtered orientation nodes.

    Emits only fixed trusted sentences — never raw Essence content.
    Drops dimensions whose value is unrecognised or whose temporalKind != 'trait'.
    The block is atomic: either all accepted sentences fit or we trim from the
    lowest-priority end until they do.
    """
    sentences: list[str] = []
    for node_id in _ORIENTATION_PRIORITY:
        node = nodes.get(node_id)
        if node is None:
            continue
        if node.get("temporalKind") != "trait":
            continue
        content = node.get("content", "")
        sentence = _ORIENTATION_SENTENCES.get(node_id, {}).get(content)
        if sentence is None:
            continue
        candidate = sentences + [sentence]
        candidate_block = "\n".join(candidate) + "\n" + _PRECEDENCE_NOTICE
        if len(candidate_block) > _ORIENTATION_MAX:
            break
        sentences = candidate

    if not sentences:
        return ""

    return "\n".join(sentences) + "\n" + _PRECEDENCE_NOTICE


def _build_context_block(summary: dict[str, Any]) -> str:
    """Convert an EssenceSummary JSON dict into a plain-text context block."""
    nodes: dict[str, Any] = summary.get("nodes", {})
    retrieved_at: str = summary.get("retrievedAt", "")

    # Defense-in-depth: apply layer and sensitivity filters to all nodes first.
    filtered = {
        node_id: node
        for node_id, node in nodes.items()
        if node.get("layer") in _MERLIN_LAYERS
        and node.get("sensitivity") in _ALLOWED_SENSITIVITY
    }

    orientation_nodes = {k: v for k, v in filtered.items() if k in _ORIENTATION_NODE_IDS}
    generic_nodes = {k: v for k, v in filtered.items() if k not in _ORIENTATION_NODE_IDS}

    generic_lines: list[str] = []
    for node_id, node in generic_nodes.items():
        content = node.get("content", "")
        if content:
            generic_lines.append(f"{node_id}: {content}")

    orientation_block = _build_orientation_block(orientation_nodes)

    if not generic_lines and not orientation_block:
        return ""

    provenance = (
        f"Essence context retrieved at {retrieved_at}. "
        "This is a snapshot and may be outdated."
    )

    # Compute generic budget dynamically. Orientation block is atomic — its length
    # is known before generic trimming begins.
    orientation_len = len(orientation_block) + 2 if orientation_block else 0
    generic_budget = _MAX_CHARS - len(provenance) - 2 - orientation_len

    # Trim generic lines from the end (whole lines only — no mid-sentence cuts).
    while generic_lines and len("\n".join(generic_lines)) > generic_budget:
        generic_lines.pop()

    parts: list[str] = [provenance]
    if generic_lines:
        parts.append("\n".join(generic_lines))
    if orientation_block:
        parts.append(orientation_block)

    return "\n\n".join(parts)


async def fetch_essence_context(profile_id: str) -> str:
    """Return a formatted Essence context block for Merlin's system prompt.

    Returns an empty string on any error — the session degrades gracefully.
    Never logs tokens, profile content, or any sensitive data.
    """
    token = settings.internal_essence_token
    base_url = settings.essence_base_url

    if not token:
        logger.warning("essence_context: INTERNAL_ESSENCE_TOKEN not configured; skipping")
        return ""

    url = f"{base_url}/api/internal/essence/profiles/{profile_id}/summary"

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(
                url,
                headers={
                    "Authorization": f"Bearer {token}",
                    "X-Essence-Actor": "merlin",
                },
            )

        if resp.status_code != 200:
            logger.warning(
                "essence_context: HTTP %d fetching profile context",
                resp.status_code,
            )
            return ""

        return _build_context_block(resp.json())

    except Exception:
        logger.warning("essence_context: fetch failed; continuing without Essence context")
        return ""
