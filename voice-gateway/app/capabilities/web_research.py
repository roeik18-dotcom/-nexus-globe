"""WEB_RESEARCH — the first external / UNTRUSTED-DATA capability.

Split of responsibility (unchanged project architecture):
  - n8n ("Web Research" workflow) does RETRIEVAL only: it returns source
    documents + candidate claim strings. It performs no reasoning.
  - Everything downstream — sanitization, provenance, freshness/staleness,
    corroboration, confidence, disagreement detection, verification — is
    reasoning and lives HERE, on Merlin's side.

It reuses the common framework end-to-end: validation, CapabilityRequest,
StructuredResult, idempotency, approval policy and provenance all come from
app/capabilities/_framework. This module adds only: the input model, the n8n
executor binding, the evidence model, the analysis logic, and the verifier.

UNTRUSTED-DATA BOUNDARY (enforced in `_sanitize_source`, not by convention):
fetched content is DATA. Only a fixed whitelist of scalar fields is ever read
from a source; every other key in the payload — including anything named
action_type / approval / side_effecting / capability / tool / instruction — is
DROPPED before the payload is looked at. Content is never executed, never used
to select a code path, never used to pick another capability, and can never
alter registry policy (side_effect/approval come from the ActionSpec).
Source-asserted trust signals (a page claiming its own confidence/priority) are
explicitly ignored: confidence is derived ONLY from corroboration + freshness.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

logger = logging.getLogger("merlin.capabilities.web_research")

ACTION_TYPE = "WEB_RESEARCH"
DEFAULT_URL = "http://127.0.0.1:5678/webhook/web-research"

# Field/length caps applied to every untrusted string.
_MAX_CLAIM = 512
_MAX_EXCERPT = 1000
_MAX_TITLE = 300
_MAX_URL = 2048
_MAX_SOURCES_CAP = 25

# The ONLY keys ever read out of an untrusted source document.
_SOURCE_WHITELIST = ("url", "title", "published_at", "fetched_at", "method", "claims")
_CLAIM_WHITELIST = ("key", "value", "excerpt")


def _endpoint() -> str:
    return os.environ.get("N8N_WEB_RESEARCH_URL", DEFAULT_URL)


def _token() -> Optional[str]:
    tok = os.environ.get("N8N_WEBHOOK_TOKEN")
    if tok:
        return tok
    try:  # read-only reuse of the already-configured token; config.py is NOT modified
        from app.config import settings
        return settings.n8n_webhook_token
    except Exception:  # noqa: BLE001
        return None


def _s(value: Any, cap: int) -> Optional[str]:
    if not isinstance(value, str):
        return None
    v = value.strip()
    return v[:cap] if v else None


def _parse_dt(value: Any) -> Optional[datetime]:
    if not isinstance(value, str):
        return None
    try:
        dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _sanitize_source(raw: Any) -> tuple[Optional[dict], Optional[str]]:
    """Whitelist-extract one untrusted source. Returns (clean, error_reason).

    Anything not in _SOURCE_WHITELIST is dropped without being inspected, so a
    payload carrying `action_type`, `approval`, `side_effecting`, `tool`, or
    prompt text in an unexpected field can never reach any decision point."""
    if not isinstance(raw, Mapping):
        return None, "source is not an object"
    url = _s(raw.get("url"), _MAX_URL)
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None, "missing or non-http source url"
    fetched_at = _parse_dt(raw.get("fetched_at"))
    if fetched_at is None:
        return None, "missing or invalid fetched_at"

    claims: list[dict] = []
    raw_claims = raw.get("claims")
    if isinstance(raw_claims, list):
        for rc in raw_claims:
            if not isinstance(rc, Mapping):
                continue
            key = _s(rc.get("key"), _MAX_CLAIM)
            value = _s(rc.get("value"), _MAX_CLAIM)
            if not key or value is None:
                continue
            claims.append({
                "key": key,
                "value": value,
                "excerpt": _s(rc.get("excerpt"), _MAX_EXCERPT) or "",
            })
    if not claims:
        return None, "source carried no usable claim"

    return {
        "url": url,
        "title": _s(raw.get("title"), _MAX_TITLE) or url,
        "published_at": raw.get("published_at") if isinstance(raw.get("published_at"), str) else None,
        "fetched_at": fetched_at,
        "method": _s(raw.get("method"), 64) or "unknown",
        "claims": claims,
    }, None


def _confidence(corroborating: int, freshness: str, contested: bool) -> float:
    """Derived ONLY from corroboration count + freshness (+ contest penalty).
    A source's own assertion of trust/confidence is never an input here."""
    base = 0.35 if corroborating <= 1 else (0.6 if corroborating == 2 else 0.8)
    mult = {"fresh": 1.0, "unknown": 0.85, "stale": 0.6}.get(freshness, 0.85)
    score = base * mult * (0.7 if contested else 1.0)
    return round(max(0.0, min(1.0, score)), 2)


def analyze(sources_raw: list, *, recency_window_days: Optional[int],
            now: Optional[datetime] = None) -> dict[str, Any]:
    """Pure analysis over untrusted sources — the testable core."""
    now = now or datetime.now(timezone.utc)
    cutoff = now - timedelta(days=recency_window_days) if recency_window_days else None

    used: list[dict] = []
    failed: list[dict] = []
    for raw in sources_raw[:_MAX_SOURCES_CAP]:
        clean, err = _sanitize_source(raw)
        if clean is None:
            failed.append({"reason": err,
                           "url": _s((raw or {}).get("url"), _MAX_URL) if isinstance(raw, Mapping) else None})
        else:
            used.append(clean)

    stale_sources: list[dict] = []
    for src in used:
        pub = _parse_dt(src["published_at"])
        if pub is None:
            src["freshness"] = "unknown"
        elif cutoff is not None and pub < cutoff:
            src["freshness"] = "stale"
            stale_sources.append({"source_url": src["url"], "published_at": src["published_at"],
                                  "recency_window_days": recency_window_days})
        else:
            src["freshness"] = "fresh"

    # Cluster claims by key -> normalized value -> supporting sources
    clusters: dict[str, dict[str, list[dict]]] = {}
    for src in used:
        for c in src["claims"]:
            clusters.setdefault(c["key"], {}).setdefault(c["value"].casefold(), []).append(
                {"src": src, "claim": c}
            )

    findings: list[dict] = []
    disagreements: list[dict] = []
    for key, by_value in clusters.items():
        contested = len(by_value) > 1
        if contested:
            disagreements.append({
                "claim_key": key,
                "positions": [
                    {"value": entries[0]["claim"]["value"],
                     "source_urls": [e["src"]["url"] for e in entries],
                     "support": len(entries)}
                    for entries in by_value.values()
                ],
            })
        for entries in by_value.values():
            corroborating = len(entries)
            freshness_ranks = [e["src"]["freshness"] for e in entries]
            freshness = ("fresh" if "fresh" in freshness_ranks
                         else ("unknown" if "unknown" in freshness_ranks else "stale"))
            lead = entries[0]
            findings.append({
                "claim": f'{key}: {lead["claim"]["value"]}',
                "claim_key": key,
                "claim_value": lead["claim"]["value"],
                "evidence_excerpt": lead["claim"]["excerpt"],
                "source_url": lead["src"]["url"],
                "source_title": lead["src"]["title"],
                "fetched_at": lead["src"]["fetched_at"].isoformat().replace("+00:00", "Z"),
                "published_at": lead["src"]["published_at"],
                "method": lead["src"]["method"],
                "freshness": freshness,
                "corroborating_sources": corroborating,
                "corroborating_urls": [e["src"]["url"] for e in entries],
                "contested": contested,
                "confidence": _confidence(corroborating, freshness, contested),
            })

    findings.sort(key=lambda f: (-f["confidence"], f["claim_key"]))
    return {
        "findings": findings,
        "disagreements": disagreements,
        "stale_sources": stale_sources,
        "coverage": {
            "sources_used": len(used),
            "sources_failed": len(failed),
            "failures": failed,
            "used_urls": [s["url"] for s in used],
        },
    }


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    """Dispatch retrieval to the n8n WEB_RESEARCH workflow via the GENERIC
    action_dispatch path, then reason over the untrusted payload locally."""
    from app.integrations.n8n.action_dispatch import dispatch_to_n8n

    question = inputs["question"]
    if not question.strip():
        raise ValidationError("question must be non-empty")
    max_sources = inputs["max_sources"]
    if isinstance(max_sources, bool) or not isinstance(max_sources, int) or not (1 <= max_sources <= _MAX_SOURCES_CAP):
        raise ValidationError(f"max_sources must be an int in 1..{_MAX_SOURCES_CAP}")
    recency = inputs.get("recency_window_days")
    if recency is not None and (isinstance(recency, bool) or not isinstance(recency, int) or recency < 1):
        raise ValidationError("recency_window_days must be a positive int when provided")
    for name in ("allow_domains", "deny_domains"):
        val = inputs.get(name)
        if val is not None and (not isinstance(val, list) or not all(isinstance(d, str) for d in val)):
            raise ValidationError(f"{name} must be a list of strings when provided")

    if request is None:
        raise ValidationError("web_research requires the framework request context")

    sr = await dispatch_to_n8n(request, webhook_url=_endpoint(), token=_token(),
                              timeout_seconds=inputs.get("_timeout_s", 30.0))
    # 'duplicate' is a SUCCESS shape: n8n's idempotency returned the first run's
    # payload for this action_id, so the same sources are analyzed again locally.
    if sr.status not in ("accepted", "duplicate"):
        # Controlled, typed failure — surfaced as a zero-coverage result, never a raise.
        return {
            "question": question, "findings": [], "disagreements": [], "stale_sources": [],
            "coverage": {"sources_used": 0, "sources_failed": 0, "failures": [], "used_urls": []},
            "retrieval_status": sr.status, "retrieval_code": sr.code,
            "retrieval_message": sr.message,
        }

    payload = sr.result or {}
    raw_sources = payload.get("sources")
    if not isinstance(raw_sources, list):
        raw_sources = []
    analysis = analyze(raw_sources, recency_window_days=recency)
    logger.info(
        "WEB_RESEARCH analyzed sources_used=%d sources_failed=%d findings=%d disagreements=%d",
        analysis["coverage"]["sources_used"], analysis["coverage"]["sources_failed"],
        len(analysis["findings"]), len(analysis["disagreements"]),
    )
    return {"question": question, "retrieval_status": sr.status, "retrieval_code": sr.code, **analysis}


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    """Zero sources is NEVER verified. Every finding must carry source_url +
    fetched_at. Partial coverage is allowed but must be visible."""
    coverage = result.get("coverage") or {}
    used = coverage.get("sources_used", 0)
    findings = result.get("findings") or []
    if used == 0 or not findings:
        return False, "zero usable sources — result is unverified by construction"
    for f in findings:
        if not f.get("source_url") or not f.get("fetched_at"):
            return False, "finding missing source_url/fetched_at provenance"
        if not isinstance(f.get("confidence"), (int, float)):
            return False, "finding missing derived confidence"
    if coverage.get("sources_failed", 0) > 0:
        return True, f"partial coverage: {used} used, {coverage['sources_failed']} failed"
    return True, f"{used} sources, all findings sourced"


def to_table_report_inputs(result: Mapping[str, Any], *, title: str,
                           generated_at: str) -> dict[str, Any]:
    """Adapter proving TABLE_REPORT compatibility: every cell is sourced by the
    finding's own source_url (no fabricated cells); missing values stay unknown."""
    sources, seen = [], {}
    for f in result.get("findings", []):
        url = f["source_url"]
        if url not in seen:
            sid = f"s{len(seen) + 1}"
            seen[url] = sid
            sources.append({"id": sid, "url": url, "title": f.get("source_title"),
                            "fetched_at": f.get("fetched_at")})
    rows = []
    for f in result.get("findings", []):
        sid = seen[f["source_url"]]
        excerpt = f.get("evidence_excerpt")
        rows.append([
            {"value": f["claim"], "source": sid},
            {"value": f["confidence"], "source": sid},
            {"value": f["corroborating_sources"], "source": sid},
            ({"value": excerpt, "source": sid} if excerpt else "unknown"),
        ])
    return {
        "title": title,
        "summary": (f"{len(result.get('findings', []))} findings from "
                    f"{result.get('coverage', {}).get('sources_used', 0)} sources; "
                    f"{len(result.get('disagreements', []))} disagreement(s)"),
        "columns": ["claim", "confidence", "corroborating_sources", "evidence"],
        "rows": rows,
        "sources": sources,
        "generated_at": generated_at,
    }


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="web_research",
    executor=Executor.N8N,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.SOFT_CACHE,
    timeout_s=30.0,
    max_retries=2,
    required_inputs=(
        InputField("question", (str,)),
        InputField("max_sources", (int,)),
        InputField("recency_window_days", (int,), required=False),
        InputField("allow_domains", (list,), required=False),
        InputField("deny_domains", (list,), required=False),
    ),
    output_fields=("findings", "disagreements", "stale_sources", "coverage"),
    verification="sourced_findings_and_nonzero_coverage",
    provenance_requirements=("source_url", "fetched_at", "method", "per_finding_corroboration"),
    intent_patterns=("web research", "מחקר רשת", "research online"),
    handler=handler,
    verifier=verify,
    n8n_webhook_key="N8N_WEB_RESEARCH_URL",
)
