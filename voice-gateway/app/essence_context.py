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


def _build_context_block(summary: dict[str, Any]) -> str:
    """Convert an EssenceSummary JSON dict into a plain-text context block."""
    nodes: dict[str, Any] = summary.get("nodes", {})
    retrieved_at: str = summary.get("retrievedAt", "")

    lines: list[str] = []
    for node_id, node in nodes.items():
        # Defense-in-depth layer filter
        if node.get("layer") not in _MERLIN_LAYERS:
            continue
        # Defense-in-depth sensitivity filter
        if node.get("sensitivity") not in _ALLOWED_SENSITIVITY:
            continue
        content = node.get("content", "")
        if content:
            lines.append(f"{node_id}: {content}")

    if not lines:
        return ""

    provenance = (
        f"Essence context retrieved at {retrieved_at}. "
        "This is a snapshot and may be outdated."
    )
    body = "\n".join(lines)
    combined = f"{provenance}\n\n{body}"

    if len(combined) > _MAX_CHARS:
        combined = combined[:_MAX_CHARS]

    return combined


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
