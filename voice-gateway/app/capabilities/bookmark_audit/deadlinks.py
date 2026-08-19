"""Bounded-concurrency liveness check for bookmarked URLs.

Security: every response is treated as untrusted data. Only the HTTP status
code is ever inspected — the response body is never read, parsed, rendered,
or acted on, so no content returned by any external site (however it's
phrased) can influence this process. No redirects are followed into
executing anything; httpx just follows the Location header to get a final
status code, the same as a browser would, and that final code is all that's
recorded.

Bounded by design: `max_checks` caps how many URLs get a live network call
in one run (unbounded checking against a real ~1400-bookmark corpus would
take a long time and hit a lot of arbitrary external hosts for no added
value in a single proof run). Uncapped auditing is the same code, just
called with a higher cap.
"""

from __future__ import annotations

import asyncio
import logging

import httpx

from app.capabilities.bookmark_audit.models import DeadLinkResult

logger = logging.getLogger("merlin.bookmark_audit")

DEFAULT_MAX_CHECKS = 30
DEFAULT_CONCURRENCY = 8
DEFAULT_TIMEOUT_SECONDS = 6.0

# 401/403/429 mean the site is gating or rate-limiting an anonymous
# HEAD/GET — that's evidence the site is alive and responding, not that the
# bookmark is dead. Treating them as "dead" would recommend deleting a
# user's own live, logged-in-only pages (billing dashboards, private repos)
# just because this check has no session cookie. Only "actually gone"
# (404/410) or server failure (5xx) counts as dead.
_ACCESS_RESTRICTED_STATUSES = frozenset({401, 403, 429})


async def _check_one(client: httpx.AsyncClient, url: str, sem: asyncio.Semaphore) -> DeadLinkResult:
    async with sem:
        try:
            resp = await client.head(url)
            if resp.status_code == 405:  # method not allowed — some servers block HEAD
                resp = await client.get(url)
        except httpx.TimeoutException:
            return DeadLinkResult(checked=True, dead=True, http_status=None, reason="timeout")
        except httpx.RequestError:
            return DeadLinkResult(checked=True, dead=True, http_status=None, reason="connection_error")

    status = resp.status_code
    if status in _ACCESS_RESTRICTED_STATUSES:
        return DeadLinkResult(checked=True, dead=False, http_status=status, reason="access_restricted")
    dead = status == 404 or status == 410 or status >= 500
    return DeadLinkResult(
        checked=True, dead=dead, http_status=status,
        reason="http_error" if dead else "ok",
    )


async def check_dead_links(
    urls: list[str],
    *,
    max_checks: int = DEFAULT_MAX_CHECKS,
    concurrency: int = DEFAULT_CONCURRENCY,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> dict[str, DeadLinkResult]:
    """Returns {url: DeadLinkResult}. URLs beyond max_checks get
    checked=False, dead=False, reason='not_checked' — absence of a check is
    never reported as 'dead'."""
    to_check = urls[:max_checks]
    skipped = urls[max_checks:]

    results: dict[str, DeadLinkResult] = {}
    sem = asyncio.Semaphore(concurrency)

    async with httpx.AsyncClient(timeout=timeout_seconds, follow_redirects=True) as client:
        checked = await asyncio.gather(*(_check_one(client, u, sem) for u in to_check))

    for url, result in zip(to_check, checked):
        results[url] = result
    for url in skipped:
        results[url] = DeadLinkResult(checked=False, dead=False, http_status=None, reason="not_checked")

    dead_count = sum(1 for r in results.values() if r.dead)
    logger.info(
        "bookmark_audit: dead-link check complete — checked=%d skipped=%d dead=%d",
        len(to_check), len(skipped), dead_count,
    )
    return results
