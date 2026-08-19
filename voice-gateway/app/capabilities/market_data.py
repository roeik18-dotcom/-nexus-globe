"""MARKET_DATA — READ-ONLY structured market information.

Four modes: QUOTE | HISTORICAL | FUNDAMENTALS | NEWS.

NO TRADING. This module deliberately contains no order/trade/transfer/buy/sell
path, and the registry entry is READ_ONLY with approval_policy=NONE, so there is
no code path by which MARKET_DATA can become side-effecting. It also emits no
financial recommendation: it reports data with provenance and nothing else.

Provider seam: retrieval is performed by the n8n "Market Data" workflow through
the generic action_dispatch path. No real market-data provider/API is configured,
so that workflow returns a deterministic fixture and reports
`provider="deterministic-fixture"` / REAL_PROVIDER_CONNECTED=NO. Replacing the
fixture with a real provider changes only that workflow node — this module's
parsing, staleness, ambiguity and provenance logic is provider-agnostic.

Two timestamps are always distinguished:
  as_of        — the PROVIDER's timestamp for the datum
  retrieved_at — when WE fetched it
Staleness is computed from `as_of`, never from `retrieved_at`.

UNTRUSTED-DATA BOUNDARY: provider/news text is DATA. Only whitelisted scalar
fields are read; every other key (action_type, approval, side_effecting,
capability, instruction, ...) is dropped before inspection. Content can never
select an action, alter approval, or change registry policy.
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

logger = logging.getLogger("merlin.capabilities.market_data")

ACTION_TYPE = "MARKET_DATA"
DEFAULT_URL = "http://127.0.0.1:5678/webhook/market-data"
MODES = ("QUOTE", "HISTORICAL", "FUNDAMENTALS", "NEWS")
DEFAULT_STALENESS_S = 900  # 15 minutes

_MAX_STR = 512
_MAX_ITEMS = 100
# Whitelists — the ONLY keys ever read out of an untrusted provider payload.
_QUOTE_KEYS = ("symbol", "price", "currency", "venue", "as_of", "source")
_BAR_KEYS = ("time", "open", "high", "low", "close", "volume")
_NEWS_KEYS = ("headline", "source", "url", "published_at")


def _endpoint() -> str:
    return os.environ.get("N8N_MARKET_DATA_URL", DEFAULT_URL)


def _token() -> Optional[str]:
    tok = os.environ.get("N8N_WEBHOOK_TOKEN")
    if tok:
        return tok
    try:  # read-only reuse of the configured token; config.py is NOT modified
        from app.config import settings
        return settings.n8n_webhook_token
    except Exception:  # noqa: BLE001
        return None


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


def _staleness(as_of: Optional[datetime], now: datetime, threshold_s: int) -> dict:
    """Staleness is derived from the PROVIDER timestamp (as_of), never from
    retrieved_at. An absent/invalid as_of is 'unknown' — never assumed fresh."""
    if as_of is None:
        return {"state": "unknown", "age_seconds": None, "threshold_seconds": threshold_s}
    age = (now - as_of).total_seconds()
    return {"state": "stale" if age > threshold_s else "fresh",
            "age_seconds": round(age, 1), "threshold_seconds": threshold_s}


def _unknown() -> dict:
    return {"value": None, "unknown": True}


def _ambiguity(payload: Mapping[str, Any]) -> Optional[dict]:
    """Surface symbol/venue ambiguity — never silently resolve it."""
    cands = payload.get("candidates")
    if not isinstance(cands, list) or len(cands) < 2:
        return None
    clean = []
    for c in cands[:_MAX_ITEMS]:
        if not isinstance(c, Mapping):
            continue
        sym, ven = _s(c.get("symbol")), _s(c.get("venue"))
        if sym:
            clean.append({"symbol": sym, "venue": ven, "name": _s(c.get("name"))})
    if len(clean) < 2:
        return None
    return {"requested": _s(payload.get("requested_symbol")), "candidates": clean,
            "resolution": "not_resolved_requires_disambiguation"}


def _parse_quote(payload: Mapping[str, Any], now: datetime, threshold_s: int) -> dict:
    q = payload.get("quote")
    failures: list[dict] = []
    if not isinstance(q, Mapping):
        return {"quote": None, "failures": [{"field": "quote", "reason": "missing or malformed quote object"}]}
    symbol, price = _s(q.get("symbol")), _num(q.get("price"))
    currency, venue = _s(q.get("currency")), _s(q.get("venue"))
    as_of_raw = _s(q.get("as_of"))
    as_of = _dt(as_of_raw)
    source = _s(q.get("source"))
    for name, val in (("symbol", symbol), ("price", price), ("currency", currency),
                      ("venue", venue), ("as_of", as_of), ("source", source)):
        if val is None:
            failures.append({"field": name, "reason": "missing or malformed"})
    if symbol is None or price is None:
        return {"quote": None, "failures": failures}
    return {
        "quote": {
            "symbol": symbol, "price": price,
            "currency": currency if currency else _unknown(),
            "venue": venue if venue else _unknown(),
            "as_of": as_of_raw, "source": source if source else _unknown(),
            "staleness": _staleness(as_of, now, threshold_s),
        },
        "failures": failures,
    }


def _parse_historical(payload: Mapping[str, Any], now: datetime, threshold_s: int) -> dict:
    series_raw = payload.get("series")
    interval = _s(payload.get("interval"))
    symbol = _s(payload.get("symbol"))
    as_of_raw = _s(payload.get("as_of"))
    source = _s(payload.get("source"))
    bars, failures = [], []
    if not isinstance(series_raw, list):
        failures.append({"field": "series", "reason": "missing or malformed series"})
        series_raw = []
    for i, b in enumerate(series_raw[:_MAX_ITEMS]):
        if not isinstance(b, Mapping):
            failures.append({"index": i, "reason": "bar is not an object"})
            continue
        t = _s(b.get("time"))
        o, h, low, c = _num(b.get("open")), _num(b.get("high")), _num(b.get("low")), _num(b.get("close"))
        if t is None or None in (o, h, low, c):
            failures.append({"index": i, "reason": "bar missing time/OHLC"})
            continue
        bar = {"time": t, "open": o, "high": h, "low": low, "close": c}
        vol = _num(b.get("volume"))
        bar["volume"] = vol if vol is not None else None  # optional, never fabricated
        bars.append(bar)
    return {
        "symbol": symbol, "interval": interval, "series": bars,
        "as_of": as_of_raw, "source": source,
        "staleness": _staleness(_dt(as_of_raw), now, threshold_s),
        "failures": failures,
    }


def _parse_fundamentals(payload: Mapping[str, Any], now: datetime, threshold_s: int) -> dict:
    raw = payload.get("fields")
    symbol = _s(payload.get("symbol"))
    as_of_raw = _s(payload.get("as_of"))
    fields, failures = {}, []
    requested = payload.get("requested_fields")
    requested = [f for f in requested if isinstance(f, str)] if isinstance(requested, list) else []
    if not isinstance(raw, Mapping):
        failures.append({"field": "fields", "reason": "missing or malformed fields object"})
        raw = {}
    for name, entry in list(raw.items())[:_MAX_ITEMS]:
        key = _s(name, 128)
        if not key:
            continue
        if not isinstance(entry, Mapping) or "value" not in entry:
            failures.append({"field": key, "reason": "field entry missing value/provenance"})
            fields[key] = _unknown()
            continue
        val = entry.get("value")
        src = _s(entry.get("source"))
        if val is None or src is None:
            # unknown stays unknown; a value without provenance is NOT accepted
            fields[key] = _unknown()
            if val is not None and src is None:
                failures.append({"field": key, "reason": "value dropped: no source provenance"})
            continue
        fields[key] = {"value": val, "source": src,
                       "as_of": _s(entry.get("as_of")) or as_of_raw, "unknown": False}
    for req in requested:  # explicitly requested but absent -> unknown, never defaulted
        fields.setdefault(req, _unknown())
    return {"symbol": symbol, "fields": fields, "as_of": as_of_raw,
            "staleness": _staleness(_dt(as_of_raw), now, threshold_s), "failures": failures}


def _parse_news(payload: Mapping[str, Any], now: datetime, threshold_s: int) -> dict:
    raw = payload.get("items")
    as_of_raw = _s(payload.get("as_of"))
    items, failures = [], []
    if not isinstance(raw, list):
        failures.append({"field": "items", "reason": "missing or malformed items"})
        raw = []
    for i, it in enumerate(raw[:_MAX_ITEMS]):
        if not isinstance(it, Mapping):
            failures.append({"index": i, "reason": "item is not an object"})
            continue
        headline = _s(it.get("headline"))
        url = _s(it.get("url"), 2048)
        source = _s(it.get("source"))
        published = _s(it.get("published_at"))
        if not headline or not url or not (url.startswith("http://") or url.startswith("https://")):
            failures.append({"index": i, "reason": "item missing headline or valid url"})
            continue
        items.append({"headline": headline, "url": url,
                      "source": source if source else _unknown(),
                      "published_at": published,
                      "staleness": _staleness(_dt(published), now, threshold_s)})
    return {"items": items, "as_of": as_of_raw,
            "staleness": _staleness(_dt(as_of_raw), now, threshold_s), "failures": failures}


_PARSERS = {"QUOTE": _parse_quote, "HISTORICAL": _parse_historical,
            "FUNDAMENTALS": _parse_fundamentals, "NEWS": _parse_news}


def parse_payload(mode: str, payload: Mapping[str, Any], *, threshold_s: int = DEFAULT_STALENESS_S,
                  now: Optional[datetime] = None) -> dict:
    """Pure, provider-agnostic parse of an untrusted provider payload."""
    now = now or datetime.now(timezone.utc)
    if mode not in _PARSERS:
        raise ValidationError(f"unsupported mode: {mode}")
    ambiguity = _ambiguity(payload)
    parsed = _PARSERS[mode](payload, now, threshold_s)
    failures = parsed.pop("failures", [])
    out = {
        "mode": mode,
        "provider": _s(payload.get("provider")) or "unknown",
        "real_provider_connected": bool(payload.get("real_provider_connected") is True),
        "retrieved_at": _s(payload.get("retrieved_at")),   # OUR fetch time
        "ambiguity": ambiguity,                            # never auto-resolved
        "coverage": {"failed": len(failures), "failures": failures},
        **parsed,
    }
    return out


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    from app.integrations.n8n.action_dispatch import dispatch_to_n8n

    mode = inputs["mode"]
    if mode not in MODES:
        raise ValidationError(f"mode must be one of {MODES}")
    symbol = inputs.get("symbol")
    if mode in ("QUOTE", "HISTORICAL", "FUNDAMENTALS") and not (isinstance(symbol, str) and symbol.strip()):
        raise ValidationError(f"symbol is required for mode {mode}")
    threshold = inputs.get("staleness_threshold_s", DEFAULT_STALENESS_S)
    if isinstance(threshold, bool) or not isinstance(threshold, int) or threshold < 1:
        raise ValidationError("staleness_threshold_s must be a positive int")
    if request is None:
        raise ValidationError("market_data requires the framework request context")

    sr = await dispatch_to_n8n(request, webhook_url=_endpoint(), token=_token(),
                               timeout_seconds=inputs.get("_timeout_s", 15.0))
    if sr.status not in ("accepted", "duplicate"):
        return {"mode": mode, "provider": "unavailable", "real_provider_connected": False,
                "retrieved_at": None, "ambiguity": None,
                "coverage": {"failed": 0, "failures": []},
                "retrieval_status": sr.status, "retrieval_code": sr.code,
                "retrieval_message": sr.message}

    payload = sr.result if isinstance(sr.result, Mapping) else {}
    out = parse_payload(mode, payload, threshold_s=threshold)
    out["retrieval_status"] = sr.status
    out["retrieval_code"] = sr.code
    logger.info("MARKET_DATA mode=%s provider=%s failed=%d ambiguous=%s",
                mode, out["provider"], out["coverage"]["failed"], bool(out["ambiguity"]))
    return out


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    """Data must be present AND provenance-bearing. Ambiguity is a valid, visible
    outcome but is never 'verified data'. Partial failure stays visible."""
    mode = result.get("mode")
    if result.get("retrieval_status") not in ("accepted", "duplicate"):
        return False, f"retrieval failed: {result.get('retrieval_code')}"
    if result.get("ambiguity"):
        return False, "symbol/venue ambiguous — not resolved, requires disambiguation"
    failed = (result.get("coverage") or {}).get("failed", 0)
    if mode == "QUOTE":
        q = result.get("quote")
        if not q or q.get("price") is None:
            return False, "no usable quote"
        if not q.get("as_of"):
            return False, "quote missing provider as_of"
    elif mode == "HISTORICAL":
        if not result.get("series"):
            return False, "no usable bars"
    elif mode == "FUNDAMENTALS":
        fields = result.get("fields") or {}
        if not fields or all(f.get("unknown") for f in fields.values()):
            return False, "no known fundamentals fields"
    elif mode == "NEWS":
        if not result.get("items"):
            return False, "no usable news items"
    else:
        return False, f"unknown mode {mode}"
    if failed:
        return True, f"partial: {failed} provider field(s)/item(s) rejected"
    return True, f"{mode} data present with provenance"


def to_table_report_inputs(result: Mapping[str, Any], *, title: str, generated_at: str) -> dict:
    """TABLE_REPORT adapter — provenance preserved: every cell is sourced to the
    provider/source that supplied it; unknown values stay unknown."""
    mode = result.get("mode")
    sources, seen = [], {}

    def sid_for(name: Optional[str]) -> Optional[str]:
        key = name or result.get("provider") or "provider"
        if key not in seen:
            sid = f"s{len(seen) + 1}"
            seen[key] = sid
            sources.append({"id": sid, "name": key, "as_of": result.get("as_of"),
                            "retrieved_at": result.get("retrieved_at")})
        return seen[key]

    def cell(value, src):
        if value is None or (isinstance(value, Mapping) and value.get("unknown")):
            return "unknown"
        return {"value": value, "source": src}

    columns: list[str] = []
    rows: list[list] = []
    if mode == "QUOTE":
        q = result.get("quote") or {}
        columns = ["symbol", "price", "currency", "venue", "as_of", "staleness"]
        if q:
            s = sid_for(q.get("source") if isinstance(q.get("source"), str) else None)
            rows = [[cell(q.get("symbol"), s), cell(q.get("price"), s), cell(q.get("currency"), s),
                     cell(q.get("venue"), s), cell(q.get("as_of"), s),
                     cell((q.get("staleness") or {}).get("state"), s)]]
    elif mode == "HISTORICAL":
        columns = ["time", "open", "high", "low", "close", "volume"]
        s = sid_for(result.get("source"))
        rows = [[cell(b["time"], s), cell(b["open"], s), cell(b["high"], s),
                 cell(b["low"], s), cell(b["close"], s), cell(b.get("volume"), s)]
                for b in result.get("series", [])]
    elif mode == "FUNDAMENTALS":
        columns = ["field", "value", "as_of"]
        for name, f in (result.get("fields") or {}).items():
            if f.get("unknown"):
                s = sid_for(None)
                rows.append([cell(name, s), "unknown", "unknown"])
            else:
                s = sid_for(f.get("source"))
                rows.append([cell(name, s), cell(f.get("value"), s), cell(f.get("as_of"), s)])
    elif mode == "NEWS":
        columns = ["headline", "source", "url", "published_at"]
        for it in result.get("items", []):
            src_name = it.get("source") if isinstance(it.get("source"), str) else None
            s = sid_for(src_name)
            rows.append([cell(it.get("headline"), s), cell(src_name, s),
                         cell(it.get("url"), s), cell(it.get("published_at"), s)])
    if not sources:  # empty result still needs a valid (empty) report
        sources = []
    return {
        "title": title,
        "summary": (f"MARKET_DATA {mode} from {result.get('provider')} "
                    f"(real_provider_connected={result.get('real_provider_connected')}); "
                    f"{len(rows)} row(s), {(result.get('coverage') or {}).get('failed', 0)} rejected"),
        "columns": columns, "rows": rows, "sources": sources, "generated_at": generated_at,
    }


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="market_data",
    executor=Executor.N8N,
    side_effect=SideEffect.READ_ONLY,      # no trading path exists anywhere
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.SOFT_CACHE,
    timeout_s=15.0,
    max_retries=2,
    required_inputs=(
        InputField("mode", (str,)),
        InputField("symbol", (str,), required=False),
        InputField("interval", (str,), required=False),
        InputField("venue", (str,), required=False),
        InputField("fields", (list,), required=False),
        InputField("max_items", (int,), required=False),
        InputField("staleness_threshold_s", (int,), required=False),
    ),
    output_fields=("mode", "provider", "retrieved_at", "ambiguity", "coverage"),
    verification="data_present_with_provenance_and_unambiguous",
    provenance_requirements=("provider", "as_of", "retrieved_at", "per_field_source"),
    intent_patterns=("market data", "stock quote", "נתוני שוק", "share price"),
    handler=handler,
    verifier=verify,
    n8n_webhook_key="N8N_MARKET_DATA_URL",
)
