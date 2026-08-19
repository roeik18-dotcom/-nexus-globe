"""PRICE_COMPARE — pure, offline normalization of offers for ONE exact variant.

Hard rules enforced here (all tested):
  - every offer must match the declared (canonical_product_id, variant_key);
    mismatches are REJECTED into `rejected`, never blended into a row;
  - conversion to the target currency requires an FX rate WITH provenance
    (rate + as_of + source); without it the row is not comparable;
  - a missing shipping/tax component leaves total_effective_price UNKNOWN
    (partial) — it is never silently treated as 0;
  - best price is chosen ONLY among fully comparable, non-stale rows;
  - stale rows are flagged.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField, SideEffect, ValidationError,
)
from app.capabilities.commerce import identity as ident

ACTION_TYPE = "PRICE_COMPARE"
DEFAULT_STALENESS_S = 86400


def compare(offers: list, *, canonical_product_id: str, variant_key: str,
            target_currency: str, fx: Mapping[str, Any],
            threshold_s: int = DEFAULT_STALENESS_S, now: Optional[datetime] = None) -> dict:
    now = now or datetime.now(timezone.utc)
    rows, rejected = [], []

    for i, raw in enumerate(offers):
        offer, err = (raw, None) if (isinstance(raw, Mapping) and "canonical_product_id" in raw
                                     and "variant_key" in raw and "price" in raw) else ident.sanitize_offer(raw)
        if offer is None:
            rejected.append({"index": i, "reason": err or "unusable offer"})
            continue
        if offer.get("canonical_product_id") != canonical_product_id or offer.get("variant_key") != variant_key:
            rejected.append({"index": i, "reason": "variant_mismatch",
                             "offer_identity": f'{offer.get("canonical_product_id")}#{offer.get("variant_key")}',
                             "expected_identity": f"{canonical_product_id}#{variant_key}",
                             "merchant": offer.get("merchant")})
            continue

        src_cur = offer.get("currency")
        base, fx_prov = ident.convert(offer["price"], src_cur, target_currency, fx)
        missing: list[str] = []
        comparable = True

        if base is None:
            comparable = False
            missing.append(f"fx_rate_{src_cur}->{target_currency}")

        def component(value):
            nonlocal comparable
            if ident.is_unknown(value):
                comparable = False
                return ident.unknown("not disclosed by merchant")
            conv, _ = ident.convert(float(value), src_cur, target_currency, fx)
            if conv is None:
                comparable = False
                return ident.unknown("no FX rate with provenance")
            return conv

        shipping = component(offer.get("shipping"))
        tax = component(offer.get("tax_customs"))
        if ident.is_unknown(shipping):
            missing.append("shipping")
        if ident.is_unknown(tax):
            missing.append("tax_customs")

        total = (round(base + shipping + tax, 2)
                 if comparable and base is not None else
                 ident.unknown("incomplete cost components: " + ", ".join(missing)))

        stale = ident.staleness(offer.get("captured_at"), now, threshold_s)
        rows.append({
            "merchant": offer.get("merchant"), "merchant_url": offer.get("merchant_url"),
            "base_price": base if base is not None else ident.unknown("no FX rate with provenance"),
            "base_price_original": {"value": offer["price"], "currency": src_cur},
            "shipping": shipping, "tax_customs": tax,
            "currency": target_currency,
            "fx_rate": (fx_prov or {}).get("rate"),
            "fx_as_of": (fx_prov or {}).get("as_of"),
            "fx_source": (fx_prov or {}).get("source"),
            "total_effective_price": total,
            "comparable": comparable,
            "missing_components": missing,
            "stock_status": offer.get("stock_status", "unknown"),
            "captured_at": offer.get("captured_at"),
            "staleness": stale,
            "source": offer.get("source") or offer.get("merchant"),
        })

    # Outlier guard: merchant prices are UNTRUSTED data. A hostile or broken
    # listing (e.g. $1 for a $1000 phone) must not silently become "best price".
    # Deterministic rule: against the median of comparable totals, anything below
    # 25% or above 400% is flagged and excluded from the best-price claim.
    comparable_totals = sorted(r["total_effective_price"] for r in rows if r["comparable"])
    median = None
    if comparable_totals:
        mid = len(comparable_totals) // 2
        median = (comparable_totals[mid] if len(comparable_totals) % 2
                  else (comparable_totals[mid - 1] + comparable_totals[mid]) / 2)
    for r in rows:
        r["outlier"] = False
        if r["comparable"] and median and median > 0:
            ratio = r["total_effective_price"] / median
            if ratio < 0.25 or ratio > 4.0:
                r["outlier"] = True
                r["outlier_reason"] = (f"total is {ratio:.2f}x the median of comparable offers "
                                       f"({median:.2f} {target_currency}) — excluded from best-price claim")

    eligible = [r for r in rows
                if r["comparable"] and r["staleness"]["state"] != "stale" and not r["outlier"]]
    best = min(eligible, key=lambda r: r["total_effective_price"]) if eligible else None
    return {
        "canonical_product_id": canonical_product_id, "variant_key": variant_key,
        "target_currency": target_currency,
        "rows": rows, "rejected": rejected,
        "best": ({"merchant": best["merchant"], "total_effective_price": best["total_effective_price"]}
                 if best else None),
        "best_price_basis": (f"lowest total among {len(eligible)} fully-comparable, non-stale, "
                             f"non-outlier row(s)" if best else
                             "no fully-comparable, non-stale, non-outlier row — no best price claimed"),
        "median_total": median,
        "coverage": {"rows": len(rows), "comparable": sum(1 for r in rows if r["comparable"]),
                     "stale": sum(1 for r in rows if r["staleness"]["state"] == "stale"),
                     "outliers": sum(1 for r in rows if r.get("outlier")),
                     "rejected": len(rejected)},
    }


def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    offers = inputs["offers"]
    if not offers:
        raise ValidationError("offers must be a non-empty list")
    target = inputs["target_currency"]
    if not isinstance(target, str) or not target.strip():
        raise ValidationError("target_currency must be a non-empty string")
    fx = inputs.get("fx_rates") or {}
    if not isinstance(fx, Mapping):
        raise ValidationError("fx_rates must be an object when provided")
    threshold = inputs.get("staleness_threshold_s", DEFAULT_STALENESS_S)
    if isinstance(threshold, bool) or not isinstance(threshold, int) or threshold < 1:
        raise ValidationError("staleness_threshold_s must be a positive int")
    return compare(list(offers), canonical_product_id=inputs["canonical_product_id"],
                   variant_key=inputs["variant_key"], target_currency=target.upper(),
                   fx=fx, threshold_s=threshold)


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    rows = result.get("rows") or []
    if not rows:
        return False, "no comparable rows for this exact variant"
    ident_str = f'{result.get("canonical_product_id")}#{result.get("variant_key")}'
    for r in rows:
        if not ident.is_unknown(r["total_effective_price"]):
            # a claimed total must have complete, FX-provenanced components
            if r["fx_rate"] is None or (r["fx_source"] is None):
                return False, "total claimed without FX provenance"
            if r["missing_components"]:
                return False, "total claimed with missing cost components"
    if result.get("best") is None:
        return True, f"{ident_str}: rows present, no best price claimed ({result['best_price_basis']})"
    return True, f"{ident_str}: {result['coverage']['comparable']}/{len(rows)} comparable"


def to_table_report_inputs(result: Mapping[str, Any], *, title: str, generated_at: str) -> dict:
    sources, seen = [], {}

    def sid(name, url=None):
        if name not in seen:
            s = f"s{len(seen) + 1}"
            seen[name] = s
            sources.append({"id": s, "name": name, "url": url})
        return seen[name]

    rows = []
    for r in result.get("rows", []):
        s = sid(r["merchant"], r.get("merchant_url"))
        def cell(v):
            return "unknown" if ident.is_unknown(v) else {"value": v, "source": s}
        rows.append([cell(r["merchant"]), cell(r["base_price"]), cell(r["shipping"]),
                     cell(r["tax_customs"]), cell(r["currency"]), cell(r["fx_rate"]),
                     cell(r["fx_as_of"]), cell(r["total_effective_price"]),
                     cell(r["stock_status"]), cell(r["captured_at"])])
    return {
        "title": title,
        "summary": (f'{result.get("canonical_product_id")} / {result.get("variant_key")} — '
                    f'{result["coverage"]["comparable"]}/{result["coverage"]["rows"]} comparable, '
                    f'{result["coverage"]["rejected"]} rejected, {result["coverage"]["stale"]} stale. '
                    f'{result.get("best_price_basis")}'),
        "columns": ["merchant", "base_price", "shipping", "tax_customs", "currency",
                    "fx_rate", "fx_as_of", "total_effective_price", "stock_status", "captured_at"],
        "rows": rows, "sources": sources, "generated_at": generated_at,
    }


SPEC = ActionSpec(
    action_type=ACTION_TYPE, capability="price_compare", executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE, timeout_s=2.0, max_retries=0,
    required_inputs=(
        InputField("offers", (list,)),
        InputField("canonical_product_id", (str,)),
        InputField("variant_key", (str,)),
        InputField("target_currency", (str,)),
        InputField("fx_rates", (dict,), required=False),
        InputField("staleness_threshold_s", (int,), required=False),
    ),
    output_fields=("rows", "rejected", "best", "coverage"),
    verification="totals_only_with_complete_fx_provenanced_components",
    provenance_requirements=("merchant", "captured_at", "fx_rate", "fx_as_of", "fx_source"),
    intent_patterns=("price compare", "compare prices", "השוואת מחירים"),
    handler=handler, verifier=verify,
)
