"""SHOP_SEARCH — READ-ONLY offer discovery. No cart, no checkout, no purchase.

Retrieval runs through the n8n "Shop Search" workflow via the generic
action_dispatch path; all identity/variant/sanitization reasoning is here.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField, SideEffect, ValidationError,
)
from app.capabilities.commerce import identity as ident

logger = logging.getLogger("merlin.capabilities.shop_search")

ACTION_TYPE = "SHOP_SEARCH"
DEFAULT_URL = "http://127.0.0.1:5678/webhook/shop-search"
DEFAULT_STALENESS_S = 86400  # 24h


def _endpoint() -> str:
    return os.environ.get("N8N_SHOP_SEARCH_URL", DEFAULT_URL)


def _token() -> Optional[str]:
    tok = os.environ.get("N8N_WEBHOOK_TOKEN")
    if tok:
        return tok
    try:  # read-only reuse; config.py is NOT modified
        from app.config import settings
        return settings.n8n_webhook_token
    except Exception:  # noqa: BLE001
        return None


def parse_offers(payload: Mapping[str, Any], *, threshold_s: int = DEFAULT_STALENESS_S,
                 now: Optional[datetime] = None) -> dict:
    """Pure: sanitize an untrusted provider payload into Offer[] + coverage."""
    now = now or datetime.now(timezone.utc)
    raw_offers = payload.get("offers")
    if not isinstance(raw_offers, list):
        raw_offers = []
    offers, failures = [], []
    for i, raw in enumerate(raw_offers[:100]):
        offer, err = ident.sanitize_offer(raw)
        if offer is None:
            failures.append({"index": i, "reason": err})
            continue
        offer["staleness"] = ident.staleness(offer["captured_at"], now, threshold_s)
        offers.append(offer)

    # Group by exact identity so callers can never accidentally mix variants.
    groups: dict[str, int] = {}
    for o in offers:
        groups[f'{o["canonical_product_id"]}#{o["variant_key"]}'] = \
            groups.get(f'{o["canonical_product_id"]}#{o["variant_key"]}', 0) + 1

    return {
        "offers": offers,
        "variant_groups": [{"identity": k, "offer_count": v} for k, v in sorted(groups.items())],
        "coverage": {"offers_used": len(offers), "offers_failed": len(failures), "failures": failures},
        "provider": ident._s(payload.get("provider")) or "unknown",
        "real_commerce_provider_connected": bool(payload.get("real_commerce_provider_connected") is True),
        "retrieved_at": ident._s(payload.get("retrieved_at")),
    }


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.integrations.n8n.action_dispatch import dispatch_to_n8n

    query = inputs["query"]
    if not query.strip():
        raise ValidationError("query must be non-empty")
    if not inputs["region"].strip():
        raise ValidationError("region must be non-empty")
    max_results = inputs["max_results"]
    if isinstance(max_results, bool) or not isinstance(max_results, int) or not (1 <= max_results <= 100):
        raise ValidationError("max_results must be an int in 1..100")
    threshold = inputs.get("staleness_threshold_s", DEFAULT_STALENESS_S)
    if isinstance(threshold, bool) or not isinstance(threshold, int) or threshold < 1:
        raise ValidationError("staleness_threshold_s must be a positive int")
    if request is None:
        raise ValidationError("shop_search requires the framework request context")

    sr = await dispatch_to_n8n(request, webhook_url=_endpoint(), token=_token(),
                               timeout_seconds=inputs.get("_timeout_s", 20.0))
    if sr.status not in ("accepted", "duplicate"):
        return {"query": query, "offers": [], "variant_groups": [],
                "coverage": {"offers_used": 0, "offers_failed": 0, "failures": []},
                "provider": "unavailable", "real_commerce_provider_connected": False,
                "retrieved_at": None, "retrieval_status": sr.status, "retrieval_code": sr.code}

    payload = sr.result if isinstance(sr.result, Mapping) else {}
    out = parse_offers(payload, threshold_s=threshold)
    out["query"] = query
    out["retrieval_status"] = sr.status
    out["retrieval_code"] = sr.code
    logger.info("SHOP_SEARCH offers_used=%d offers_failed=%d groups=%d",
                out["coverage"]["offers_used"], out["coverage"]["offers_failed"],
                len(out["variant_groups"]))
    return out


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if result.get("retrieval_status") not in ("accepted", "duplicate"):
        return False, f"retrieval failed: {result.get('retrieval_code')}"
    offers = result.get("offers") or []
    if not offers:
        return False, "no usable offers"
    for o in offers:
        if not o.get("canonical_product_id") or not o.get("variant_key"):
            return False, "offer missing product identity"
        if not o.get("merchant_url") or not o.get("captured_at"):
            return False, "offer missing provenance"
    failed = (result.get("coverage") or {}).get("offers_failed", 0)
    if failed:
        return True, f"partial: {len(offers)} offers, {failed} rejected"
    return True, f"{len(offers)} offers with identity + provenance"


def to_table_report_inputs(result: Mapping[str, Any], *, title: str, generated_at: str) -> dict:
    sources, seen = [], {}

    def sid(merchant: str, url: str) -> str:
        if merchant not in seen:
            s = f"s{len(seen) + 1}"
            seen[merchant] = s
            sources.append({"id": s, "name": merchant, "url": url})
        return seen[merchant]

    rows = []
    for o in result.get("offers", []):
        s = sid(o["merchant"], o["merchant_url"])
        def cell(v):
            return "unknown" if ident.is_unknown(v) else {"value": v, "source": s}
        rows.append([cell(o["canonical_product_id"]), cell(o["variant_key"]), cell(o["merchant"]),
                     cell(o["price"]), cell(o["currency"]), cell(o["shipping"]),
                     cell(o["tax_customs"]), cell(o["stock_status"]), cell(o["captured_at"])])
    return {
        "title": title,
        "summary": (f"{len(rows)} offer(s) across {len(result.get('variant_groups', []))} variant group(s); "
                    f"real_commerce_provider_connected={result.get('real_commerce_provider_connected')}"),
        "columns": ["canonical_product_id", "variant_key", "merchant", "price", "currency",
                    "shipping", "tax_customs", "stock_status", "captured_at"],
        "rows": rows, "sources": sources, "generated_at": generated_at,
    }


SPEC = ActionSpec(
    action_type=ACTION_TYPE, capability="shop_search", executor=Executor.N8N,
    side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.SOFT_CACHE, timeout_s=20.0, max_retries=2,
    required_inputs=(
        InputField("query", (str,)),
        InputField("region", (str,)),
        InputField("max_results", (int,)),
        InputField("currency", (str,), required=False),
        InputField("filters", (dict,), required=False),
        InputField("staleness_threshold_s", (int,), required=False),
    ),
    output_fields=("offers", "variant_groups", "coverage", "provider"),
    verification="offers_have_identity_and_provenance",
    provenance_requirements=("merchant", "merchant_url", "captured_at", "source"),
    intent_patterns=("shop search", "find offers", "חיפוש חנויות"),
    handler=handler, verifier=verify, n8n_webhook_key="N8N_SHOP_SEARCH_URL",
)
