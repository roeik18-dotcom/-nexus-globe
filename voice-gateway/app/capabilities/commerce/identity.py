"""Product identity, offer sanitization, and money/FX helpers.

The single hard rule of this family: two things may only be compared when their
(canonical_product_id, variant_key) match exactly. Variant-defining attributes
(size, color, capacity, edition, model_year, config) are part of the key when
present, so a 256GB and a 128GB unit can never collapse into one row.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

_MAX_STR = 300
_MAX_URL = 2048

# Attributes that DEFINE a variant. Present -> part of variant_key.
VARIANT_ATTRS = ("size", "color", "capacity", "edition", "model_year", "config")

# The ONLY keys ever read from an untrusted merchant/provider offer.
_OFFER_WHITELIST = (
    "canonical_product_id", "brand", "model", "title", "merchant", "merchant_url",
    "price", "currency", "shipping", "tax_customs", "stock_status", "captured_at",
    "source", *VARIANT_ATTRS,
)
_STOCK_VALUES = ("in_stock", "out_of_stock", "preorder", "backorder", "unknown")


def unknown(reason: Optional[str] = None) -> dict:
    """A value that is NOT known. Never 0, never a default."""
    d = {"value": None, "unknown": True}
    if reason:
        d["reason"] = reason
    return d


def is_unknown(v: Any) -> bool:
    return v is None or (isinstance(v, Mapping) and v.get("unknown") is True)


def _s(v: Any, cap: int = _MAX_STR) -> Optional[str]:
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v[:cap] if v else None


def _num(v: Any) -> Optional[float]:
    if isinstance(v, bool) or not isinstance(v, (int, float)):
        return None
    return float(v)


def _dt(v: Any) -> Optional[datetime]:
    if not isinstance(v, str):
        return None
    try:
        d = datetime.fromisoformat(v.replace("Z", "+00:00"))
    except ValueError:
        return None
    return d if d.tzinfo else d.replace(tzinfo=timezone.utc)


def slug(value: Optional[str]) -> str:
    if not value:
        return ""
    s = re.sub(r"[^\w\s-]", "", value.strip().lower(), flags=re.UNICODE)
    return re.sub(r"[\s_-]+", "-", s).strip("-")


def canonical_product_id(brand: Optional[str], model: Optional[str]) -> Optional[str]:
    """brand+model identity, independent of merchant wording. None when the
    provider did not supply enough to identify the product (never guessed)."""
    b, m = slug(brand), slug(model)
    if not b or not m:
        return None
    return f"{b}:{m}"


def variant_key(attrs: Mapping[str, Any]) -> str:
    """Deterministic key over the variant-defining attributes that are PRESENT.
    Absent attributes are simply not in the key — but `identity_confidence`
    records that the key is under-specified, so callers can see the risk."""
    parts = []
    for name in VARIANT_ATTRS:
        val = _s(attrs.get(name), 64)
        if val:
            parts.append(f"{name}={slug(val)}")
    # Sorted so the key is canonical regardless of attribute declaration/insertion
    # order — the same variant from two merchants must produce the same key.
    return "|".join(sorted(parts)) if parts else "base"


def identity_confidence(offer: Mapping[str, Any]) -> str:
    """high  — explicit canonical id from provider, or brand+model+>=1 variant attr
       medium— brand+model but no variant attribute (variant may be ambiguous)
       low   — missing brand or model"""
    # variant attributes may sit top-level (raw) or under "attributes" (sanitized)
    nested = offer.get("attributes") if isinstance(offer.get("attributes"), Mapping) else {}
    has_variant = any(_s(offer.get(a), 64) or _s(nested.get(a), 64) for a in VARIANT_ATTRS)
    if not offer.get("canonical_product_id"):
        return "low"
    if offer.get("provider_supplied_id") or has_variant:
        return "high"
    return "medium"


def sanitize_offer(raw: Any) -> tuple[Optional[dict], Optional[str]]:
    """Whitelist-extract one untrusted offer. Returns (offer, error_reason).

    Everything outside _OFFER_WHITELIST is dropped WITHOUT being inspected, so a
    merchant payload carrying action_type / approval / side_effecting /
    capability / instruction can never reach a decision point."""
    if not isinstance(raw, Mapping):
        return None, "offer is not an object"

    brand, model = _s(raw.get("brand")), _s(raw.get("model"))
    merchant = _s(raw.get("merchant"))
    url = _s(raw.get("merchant_url"), _MAX_URL)
    price = _num(raw.get("price"))
    currency = _s(raw.get("currency"), 8)
    captured = _dt(raw.get("captured_at"))

    if price is None:
        return None, "missing or non-numeric price"
    if not currency:
        return None, "missing currency"
    if not merchant:
        return None, "missing merchant"
    if not url or not (url.startswith("http://") or url.startswith("https://")):
        return None, "missing or non-http merchant_url"
    if captured is None:
        return None, "missing or invalid captured_at"

    provider_id = _s(raw.get("canonical_product_id"), 128)
    attrs = {a: _s(raw.get(a), 64) for a in VARIANT_ATTRS}
    cpid = provider_id or canonical_product_id(brand, model)

    stock = _s(raw.get("stock_status"), 32)
    stock = stock if stock in _STOCK_VALUES else "unknown"

    offer = {
        "canonical_product_id": cpid,
        "variant_key": variant_key(attrs),
        "brand": brand, "model": model,
        "title": _s(raw.get("title")),
        "attributes": {k: v for k, v in attrs.items() if v},
        "merchant": merchant, "merchant_url": url,
        "price": price, "currency": currency.upper(),
        # missing cost components stay UNKNOWN — never coerced to 0
        "shipping": (_num(raw.get("shipping")) if _num(raw.get("shipping")) is not None
                     else unknown("merchant did not disclose shipping")),
        "tax_customs": (_num(raw.get("tax_customs")) if _num(raw.get("tax_customs")) is not None
                        else unknown("merchant did not disclose tax/customs")),
        "stock_status": stock,
        "captured_at": raw.get("captured_at"),
        "source": _s(raw.get("source")) or merchant,
        "provider_supplied_id": bool(provider_id),
    }
    offer["identity_confidence"] = identity_confidence(offer)
    if offer["canonical_product_id"] is None:
        return None, "cannot establish canonical_product_id (missing brand/model)"
    return offer, None


def staleness(captured_at: Any, now: datetime, threshold_s: int) -> dict:
    d = _dt(captured_at)
    if d is None:
        return {"state": "unknown", "age_seconds": None, "threshold_seconds": threshold_s}
    age = (now - d).total_seconds()
    return {"state": "stale" if age > threshold_s else "fresh",
            "age_seconds": round(age, 1), "threshold_seconds": threshold_s}


def convert(amount: float, frm: str, to: str, fx: Mapping[str, Any]) -> tuple[Optional[float], Optional[dict]]:
    """Currency conversion. Returns (value, fx_provenance) or (None, None) when no
    rate with provenance is available — conversion is NEVER assumed."""
    if frm == to:
        return amount, {"rate": 1.0, "as_of": None, "source": "identity", "pair": f"{frm}->{to}"}
    entry = fx.get(f"{frm}->{to}") if isinstance(fx, Mapping) else None
    if not isinstance(entry, Mapping):
        return None, None
    rate = _num(entry.get("rate"))
    as_of = _s(entry.get("as_of"), 64)
    source = _s(entry.get("source"))
    if rate is None or not as_of or not source:  # FX provenance is MANDATORY
        return None, None
    return amount * rate, {"rate": rate, "as_of": as_of, "source": source, "pair": f"{frm}->{to}"}
