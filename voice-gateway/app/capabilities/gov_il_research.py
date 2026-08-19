"""GOV_IL_RESEARCH — the first DIRECT (non-n8n) real retrieval adapter.

Audit of the existing boundary this reuses: WEB_RESEARCH
(app/capabilities/web_research.py) already separates retrieval (n8n does
that) from reasoning (`analyze()`/`verify()`, pure, local, already proven and
tested — sanitization, corroboration, freshness/staleness, disagreement
detection, confidence). This module does NOT replace or duplicate that
reasoning layer: it is the "smallest real retrieval adapter" the task asked
for, and its only new work is producing WEB_RESEARCH's own `sources_raw`
shape (`{url, title, published_at, fetched_at, method, claims}`) from a
REAL, direct HTTP GET of a real gov.il page — then handing that straight to
`web_research.analyze()`/`web_research.verify()`, imported and called
UNCHANGED. `app/capabilities/web_research.py` is read-only imported here,
never modified. One capability, one ActionSpec — CKAN is a PROVIDER/MODE
under this same capability, not a second research framework.

Source channel selection (caller's responsibility, not auto-chained here):
  1. `dataset_query`/`dataset_id`/`resource_id` — official data.gov.il CKAN
     API. Preferred for anything that IS a published dataset: structured,
     machine-readable, carries real provenance (dataset id, resource id,
     organization, metadata_modified) directly from the source.
  2. `urls` — direct HTML/JSON fetch of a specific gov.il page. The only
     option for service/policy pages that were never published as CKAN
     datasets (most of gov.il isn't data.gov.il).
  3. Neither works => fail honestly (`real_gov_il_provider_connected: False`,
     explicit `fetch_errors`/`api_error`, never a fabricated result).
  A single call uses exactly one mode (enforced) so it's always unambiguous
  which channel answered — surfaced per-source via `method`
  (`ckan_package_search` / `ckan_package_show` / `ckan_datastore_search` /
  `direct_http_get` / `direct_http_get_json`).

Scope, enforced structurally (not just documented):
  - GET only. httpx.AsyncClient is constructed fresh per call, no cookie jar
    persisted across calls, no credentials/auth header ever sent — there is
    no field anywhere in this module's input schema through which a caller
    could supply a username/password/session token even if they wanted to.
  - Domain allowlist: only `*.gov.il` (or exactly `gov.il`) — enforced by
    `_is_gov_il_host()`, a plain hostname-suffix check, applied to every URL
    BEFORE any network call. A non-gov.il URL (including a lookalike like
    `gov.il.evil.example`, which fails the suffix check) is rejected without
    ever touching the network.
  - Path denylist (defense in depth, not the sole guarantee — see above):
    URLs whose path contains a login/personal-area/form/payment marker are
    rejected before fetch. The structural GET-only/no-credentials guarantee
    holds regardless of whether a URL slips past this heuristic.
  - Untrusted-data boundary: fetched HTML is DATA. It is only ever reduced to
    a plain-text excerpt (script/style stripped, tags stripped, whitespace
    collapsed) and handed to WEB_RESEARCH's own whitelist-extracting
    `analyze()` — the same boundary WEB_RESEARCH already enforces for its
    n8n-sourced payloads (nothing named action_type/approval/side_effecting/
    capability/tool in a fetched page can ever be read as one).
  - `real_gov_il_provider_connected` (mirrors the existing
    `real_provider_connected`/`real_commerce_provider_connected` honesty flag
    convention in market_data.py/commerce/shop_search.py): True only if at
    least one fetch actually returned HTTP 2xx with extractable content.
    Never hardcoded True.

KNOWN GAP (disclosed, not silently papered over): this capability makes a
direct external network call from a LOCAL executor, which the current
NetworkScope enum (NONE | N8N_ONLY — app/capabilities/_framework/models.py)
has no accurate member for; that file is frozen this pass (QA is verifying
EMAIL_SEND's execution-security contract there). `network_scope` below is
therefore left at its LOCAL-inferred default (NONE), which is FACTUALLY
WRONG for this capability — flagged explicitly rather than picking a
misleading existing value. Follow-up: add `NetworkScope.EXTERNAL_DIRECT`
once the freeze lifts (one enum member, non-breaking, safe).
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Any, Mapping, Optional
from urllib.parse import urlsplit

import httpx

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, DataTrust, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)
from app.capabilities.web_research import analyze as web_research_analyze
from app.capabilities.web_research import verify as web_research_verify

logger = logging.getLogger("merlin.capabilities.gov_il_research")

ACTION_TYPE = "GOV_IL_RESEARCH"
USER_AGENT = "Merlin-GovIL-Research/1.0 (+read-only public information retrieval; no login, no forms)"
_MAX_URLS = 5
_MAX_EXCERPT = 1000
_MAX_TITLE = 300
_FETCH_TIMEOUT_S = 15.0

# Defense in depth only — the structural guarantee is GET-only / no credentials
# ever sent, not this list. Hebrew + English markers for the categories the
# task explicitly excludes: login, personal government area, forms, submissions,
# payment.
_DENYLISTED_PATH_MARKERS = (
    "login", "signin", "sign-in", "logon",
    "personal-area", "personalarea", "myarea", "אזור-אישי", "אזור_אישי", "האזור-האישי",
    "wizard", "submit", "form-submit", "payment", "checkout", "תשלום", "תשלומים",
)

_TAG_RE = re.compile(r"<[^>]+>")
_SCRIPT_STYLE_RE = re.compile(r"<(script|style)\b[^>]*>.*?</\1>", re.IGNORECASE | re.DOTALL)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.IGNORECASE | re.DOTALL)
_WS_RE = re.compile(r"\s+")

# HTML date extraction: standard OpenGraph/article meta tags. Not verified
# against a live gov.il HTML page (every gov.il HTML page reachable from this
# environment is either bot-mitigation-challenged or a JS-rendered SPA shell
# with no server-rendered meta tags at all — see module docstring's
# LIVE-NETWORK section) but these are the standard, widely-used tag names for
# publish/modify timestamps, so the extraction is real and correct WHEN such
# a tag is present; it simply has not been exercised against real gov.il
# markup this pass. Matches either attribute order (property/content or
# content/property).
_META_PUBLISHED_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']article:published_time["\'][^>]*content=["\']([^"\']+)["\']'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']article:published_time["\']',
    re.IGNORECASE,
)
_META_MODIFIED_RE = re.compile(
    r'<meta[^>]+(?:property|name)=["\']article:modified_time["\'][^>]*content=["\']([^"\']+)["\']'
    r'|<meta[^>]+content=["\']([^"\']+)["\'][^>]*(?:property|name)=["\']article:modified_time["\']',
    re.IGNORECASE,
)


def _parse_iso_or_none(raw: Optional[str]) -> Optional[str]:
    """Never guesses: returns a normalized ISO string only if `raw` actually
    parses as one, else None (UNKNOWN)."""
    if not raw:
        return None
    try:
        dt = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        return None
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.isoformat().replace("+00:00", "Z")


def _extract_html_date(html: str) -> Optional[str]:
    """published_time takes priority over modified_time when both exist (this
    module's own `published_at` field is used for staleness against the
    ORIGINAL publish date, matching web_research's existing semantics)."""
    for pattern in (_META_PUBLISHED_RE, _META_MODIFIED_RE):
        m = pattern.search(html)
        if m:
            raw = m.group(1) or m.group(2)
            parsed = _parse_iso_or_none(raw)
            if parsed:
                return parsed
    return None


def _is_gov_il_host(host: str) -> bool:
    host = (host or "").lower()
    return host == "gov.il" or host.endswith(".gov.il")


def _is_denylisted_path(url: str) -> bool:
    path = urlsplit(url).path.lower()
    return any(marker in path for marker in _DENYLISTED_PATH_MARKERS)


def _validate_url(raw: Any, *, index: int) -> str:
    if not isinstance(raw, str) or not raw.strip():
        raise ValidationError(f"urls[{index}] must be a non-empty string")
    url = raw.strip()
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise ValidationError(f"urls[{index}] must be https")
    if not _is_gov_il_host(parts.hostname or ""):
        raise ValidationError(f"urls[{index}] host {parts.hostname!r} is not in the gov.il allowlist")
    if _is_denylisted_path(url):
        raise ValidationError(f"urls[{index}] path matches a login/personal-area/form/payment marker")
    return url


def extract_text(html: str) -> tuple[Optional[str], str, Optional[str]]:
    """Pure — no network. Returns (title, plain_text_excerpt, published_at).
    Crude but safe: strips script/style blocks then all remaining tags via
    regex (no HTML parser dependency added, matching the "smallest adapter"
    instruction); the result is only ever used as inert excerpt DATA
    downstream, never executed or parsed as markup again. published_at is
    None (UNKNOWN) unless a real, parseable article:published_time/
    article:modified_time meta tag is found — never guessed."""
    title_match = _TITLE_RE.search(html)
    title = _WS_RE.sub(" ", title_match.group(1)).strip()[:_MAX_TITLE] if title_match else None
    published_at = _extract_html_date(html)
    stripped = _SCRIPT_STYLE_RE.sub(" ", html)
    text = _TAG_RE.sub(" ", stripped)
    text = _WS_RE.sub(" ", text).strip()
    return title, text[:_MAX_EXCERPT], published_at


# JSON date/title/text extraction — justified by LIVE testing, not
# speculation: data.gov.il's CKAN API (a real, reachable *.gov.il host) returns
# JSON, not HTML, and its records carry real ISO-timestamp fields like
# `metadata_modified`. This is a shallow, generic walk (top-level object, plus
# one level into a CKAN-style {"result": {...}} or {"result": {"results": [...]}}
# wrapper) — not a bespoke CKAN schema parser, so it stays "smallest adapter"
# while still extracting REAL dates from REAL responses instead of leaving
# every JSON source's date permanently UNKNOWN.
_JSON_DATE_FIELDS = ("metadata_modified", "modified", "updated_at", "updated",
                    "metadata_created", "created_at", "created", "published_at", "published")
_JSON_TITLE_FIELDS = ("title", "name", "label")
_JSON_TEXT_FIELDS = ("notes", "description", "summary", "value")


def _json_candidates(data: Any) -> list[dict]:
    if not isinstance(data, dict):
        return []
    candidates = [data]
    result = data.get("result")
    if isinstance(result, dict):
        candidates.append(result)
        results = result.get("results")
        if isinstance(results, list) and results and isinstance(results[0], dict):
            candidates.append(results[0])
    results = data.get("results")
    if isinstance(results, list) and results and isinstance(results[0], dict):
        candidates.append(results[0])
    return candidates


def _first_str_field(candidates: list[dict], names: tuple[str, ...]) -> Optional[str]:
    for c in candidates:
        for name in names:
            v = c.get(name)
            if isinstance(v, str) and v.strip():
                return v.strip()
    return None


def extract_json(data: Any) -> tuple[Optional[str], str, Optional[str]]:
    """Pure — no network. Returns (title, excerpt, published_at). Falls back
    to a truncated compact JSON dump as the excerpt when no recognizable
    text field is present, so a real-but-unfamiliar-shaped response still
    produces usable (if crude) evidence rather than nothing."""
    import json as _json

    candidates = _json_candidates(data)
    title = _first_str_field(candidates, _JSON_TITLE_FIELDS)
    text = _first_str_field(candidates, _JSON_TEXT_FIELDS)
    if not text:
        text = _json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    raw_date = _first_str_field(candidates, _JSON_DATE_FIELDS)
    published_at = _parse_iso_or_none(raw_date)
    return title, text[:_MAX_EXCERPT], published_at


# ── data.gov.il CKAN API provider ───────────────────────────────────────────
# Official structured-data API for the SAME gov.il domain already allowlisted
# above — no new host, no new trust boundary. Proven live (see module-level
# LIVE_NETWORK evidence in the phase report): package_search/package_show/
# datastore_search all return real, current data from this environment, even
# when a rendered gov.il HTML page does not.
CKAN_BASE = "https://data.gov.il/api/3/action"
_MAX_DATASETS = 10
_MAX_RESOURCES = 20
_MAX_RECORDS = 20
_MAX_FIELD_LEN = 500
_MAX_QUERY_LEN = 300


def _s(v: Any, cap: int = 500) -> Optional[str]:
    if not isinstance(v, str):
        return None
    v = v.strip()
    return v[:cap] if v else None


def _positive_int(v: Any, *, name: str, default: int, cap: int) -> int:
    if v is None:
        return default
    if isinstance(v, bool) or not isinstance(v, int) or v < 1:
        raise ValidationError(f"{name} must be a positive int")
    return min(v, cap)


async def _ckan_call(client: httpx.AsyncClient, action: str, params: dict[str, Any]) -> tuple[Optional[dict], Optional[str]]:
    """GET one CKAN action endpoint. Returns (result_dict, error_reason).
    Never raises. `params` goes through httpx's own query-string encoding
    (never string-concatenated), so a caller-supplied id/query cannot inject
    extra query parameters or escape the endpoint path."""
    url = f"{CKAN_BASE}/{action}"
    try:
        resp = await client.get(url, params=params, headers={"User-Agent": USER_AGENT})
    except httpx.TimeoutException:
        return None, "timeout"
    except httpx.RequestError:
        return None, "network_error"
    if resp.status_code != 200:
        return None, f"http_{resp.status_code}"
    try:
        body = resp.json()
    except ValueError:
        return None, "invalid_json"
    if not isinstance(body, dict) or body.get("success") is not True or not isinstance(body.get("result"), dict):
        return None, "ckan_error"
    return body["result"], None


def _org_name(raw: Any) -> str:
    org = raw if isinstance(raw, dict) else {}
    return _s(org.get("title")) or _s(org.get("name")) or "unknown"


async def _search_datasets(client: httpx.AsyncClient, query: str, *, limit: int, now: datetime) -> dict[str, Any]:
    """dataset search — package_search. Returns full-provenance dataset
    summaries plus one analyze()-shaped source per dataset."""
    result, err = await _ckan_call(client, "package_search", {"q": query, "rows": limit})
    if err:
        return {"datasets": [], "sources_raw": [], "api_error": err}

    raw_results = result.get("results")
    raw_results = raw_results if isinstance(raw_results, list) else []
    fetched_at = now.isoformat().replace("+00:00", "Z")
    datasets: list[dict[str, Any]] = []
    sources_raw: list[dict[str, Any]] = []
    for d in raw_results[:limit]:
        if not isinstance(d, dict):
            continue
        name = _s(d.get("name"))
        if not name:
            continue  # no stable identifier to build a real source URL from — skip, never fabricate one
        title = _s(d.get("title")) or name
        notes = _s(d.get("notes"), cap=_MAX_EXCERPT) or ""
        updated = _parse_iso_or_none(d.get("metadata_modified"))
        source_url = f"https://data.gov.il/dataset/{name}"
        datasets.append({
            "dataset_id": _s(d.get("id")) or "unknown",
            "name": name, "title": title, "organization": _org_name(d.get("organization")),
            "source_url": source_url, "api_endpoint": f"{CKAN_BASE}/package_show?id={name}",
            "updated_at": updated, "created_at": _parse_iso_or_none(d.get("metadata_created")),
            "num_resources": d.get("num_resources") if isinstance(d.get("num_resources"), int) else None,
            "source_channel": "ckan_api",
        })
        sources_raw.append({
            "url": source_url, "title": title, "published_at": updated, "fetched_at": fetched_at,
            "method": "ckan_package_search",
            "claims": [{"key": "dataset_summary", "value": (notes[:200] or title), "excerpt": notes or title}],
        })
    return {"datasets": datasets, "sources_raw": sources_raw, "api_error": None}


async def _show_dataset(client: httpx.AsyncClient, dataset_id: str, *, now: datetime) -> dict[str, Any]:
    """package/dataset metadata + resource discovery — package_show."""
    result, err = await _ckan_call(client, "package_show", {"id": dataset_id})
    if err:
        return {"dataset": None, "resources": [], "sources_raw": [], "api_error": err}

    name = _s(result.get("name")) or dataset_id
    title = _s(result.get("title")) or name
    notes = _s(result.get("notes"), cap=_MAX_EXCERPT) or ""
    updated = _parse_iso_or_none(result.get("metadata_modified"))
    source_url = f"https://data.gov.il/dataset/{name}"

    resources: list[dict[str, Any]] = []
    raw_resources = result.get("resources")
    if isinstance(raw_resources, list):
        for r in raw_resources[:_MAX_RESOURCES]:
            if not isinstance(r, dict):
                continue
            rid = _s(r.get("id"))
            if not rid:
                continue
            resources.append({
                "resource_id": rid, "name": _s(r.get("name")) or rid,
                "format": _s(r.get("format"), cap=32) or "unknown",
                "url": _s(r.get("url"), cap=2048),
                "updated_at": _parse_iso_or_none(r.get("last_modified")) or _parse_iso_or_none(r.get("created")),
                "datastore_active": bool(r.get("datastore_active") is True),
            })

    dataset = {
        "dataset_id": _s(result.get("id")) or dataset_id, "name": name, "title": title,
        "organization": _org_name(result.get("organization")), "source_url": source_url,
        "api_endpoint": f"{CKAN_BASE}/package_show?id={dataset_id}",
        "updated_at": updated, "created_at": _parse_iso_or_none(result.get("metadata_created")),
        "resource_count": len(resources), "source_channel": "ckan_api",
    }
    sources_raw = [{
        "url": source_url, "title": title, "published_at": updated,
        "fetched_at": now.isoformat().replace("+00:00", "Z"), "method": "ckan_package_show",
        "claims": [{"key": "dataset_summary", "value": (notes[:200] or title), "excerpt": notes or title}],
    }]
    return {"dataset": dataset, "resources": resources, "sources_raw": sources_raw, "api_error": None}


async def _search_datastore(client: httpx.AsyncClient, resource_id: str, *, query: Optional[str],
                            limit: int, now: datetime) -> dict[str, Any]:
    """datastore/API resource retrieval — datastore_search, for resources
    marked datastore_active. Row VALUES are untrusted external data: every
    field is scalar-typed and length-capped before being returned; nested
    dict/list values are dropped rather than passed through unexamined."""
    params: dict[str, Any] = {"resource_id": resource_id, "limit": limit}
    if query:
        params["q"] = query
    result, err = await _ckan_call(client, "datastore_search", params)
    if err:
        return {"records": [], "fields": [], "total": None, "sources_raw": [], "api_error": err}

    raw_records = result.get("records")
    records: list[dict[str, Any]] = []
    if isinstance(raw_records, list):
        for row in raw_records[:limit]:
            if not isinstance(row, dict):
                continue
            clean: dict[str, Any] = {}
            for k, v in row.items():
                if not isinstance(k, str):
                    continue
                if isinstance(v, str):
                    clean[k[:100]] = v[:_MAX_FIELD_LEN]
                elif isinstance(v, (int, float, bool)) or v is None:
                    clean[k[:100]] = v
                # dict/list values dropped — scalar-only whitelist
            records.append(clean)

    raw_fields = result.get("fields")
    fields = ([f.get("id") for f in raw_fields if isinstance(f, dict) and isinstance(f.get("id"), str)]
             if isinstance(raw_fields, list) else [])
    total = result.get("total") if isinstance(result.get("total"), int) else None

    source_url = f"{CKAN_BASE}/datastore_search?resource_id={resource_id}"
    excerpt = f"{len(records)} record(s) retrieved" + (f" of {total} total" if total is not None else "")
    sources_raw = [{
        "url": source_url, "title": f"datastore:{resource_id}", "published_at": None,
        "fetched_at": now.isoformat().replace("+00:00", "Z"), "method": "ckan_datastore_search",
        "claims": [{"key": "record_count", "value": excerpt, "excerpt": excerpt}],
    }]
    return {"records": records, "fields": fields, "total": total, "sources_raw": sources_raw, "api_error": None}


_MAX_REDIRECTS = 3
_REDIRECT_STATUSES = (301, 302, 303, 307, 308)


async def _fetch_one(client: httpx.AsyncClient, url: str, *, now: datetime) -> dict[str, Any]:
    """Never raises — every failure becomes a source dict with claims=[]
    (which web_research.analyze() already treats as an unusable source).

    Redirects are followed MANUALLY (httpx's own follow_redirects=True is
    never used), one hop at a time, re-validating EVERY hop's host against
    the gov.il allowlist and path denylist before following it. This closes
    the allowlist-escape a naive follow_redirects=True would open: a gov.il
    URL that 302s to an arbitrary external host would otherwise be fetched
    and its content silently attributed back to the original (allowlisted)
    URL. Here, a redirect to a non-gov.il host is a hard failure — never
    followed, never fetched."""
    current = url
    resp = None
    for _hop in range(_MAX_REDIRECTS + 1):
        try:
            resp = await client.get(current, headers={"User-Agent": USER_AGENT}, follow_redirects=False)
        except httpx.TimeoutException:
            return {"url": url, "fetch_error": "timeout"}
        except httpx.RequestError:
            return {"url": url, "fetch_error": "network_error"}

        if resp.status_code not in _REDIRECT_STATUSES:
            break

        location = resp.headers.get("location")
        if not location:
            return {"url": url, "fetch_error": "redirect_missing_location"}
        next_url = str(httpx.URL(current).join(location))
        parts = urlsplit(next_url)
        if parts.scheme != "https" or not _is_gov_il_host(parts.hostname or ""):
            logger.warning("GOV_IL_RESEARCH redirect escaped allowlist url=%s target_host=%s", url, parts.hostname)
            return {"url": url, "fetch_error": "redirect_escaped_allowlist"}
        if _is_denylisted_path(next_url):
            return {"url": url, "fetch_error": "redirect_to_denylisted_path"}
        current = next_url
    else:
        return {"url": url, "fetch_error": "too_many_redirects"}

    fetched_at = now.isoformat().replace("+00:00", "Z")
    if resp.status_code != 200:
        return {"url": url, "fetch_error": f"http_{resp.status_code}", "http_status": resp.status_code}

    content_type = resp.headers.get("content-type", "").lower()
    if "json" in content_type:
        import json as _json
        try:
            data = _json.loads(resp.text)
        except (ValueError, _json.JSONDecodeError):
            return {"url": url, "fetch_error": "invalid_json"}
        title, excerpt, published_at = extract_json(data)
        method = "direct_http_get_json"
    else:
        title, excerpt, published_at = extract_text(resp.text)
        method = "direct_http_get"

    if not excerpt:
        return {"url": url, "fetch_error": "empty_content"}

    return {
        "url": url,
        "final_url": current,  # may differ from `url` only via allowlist-validated same-domain redirects
        "title": title or url,
        "published_at": published_at,  # None (UNKNOWN) unless a real date field/meta-tag was found and parsed
        "fetched_at": fetched_at,
        "method": method,
        "claims": [{"key": "content_excerpt", "value": excerpt[:200], "excerpt": excerpt}],
        "http_status": resp.status_code,
    }


_MODE_FIELDS = ("urls", "dataset_query", "dataset_id", "resource_id")


async def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    modes_present = [k for k in _MODE_FIELDS if inputs.get(k) is not None]
    if len(modes_present) != 1:
        raise ValidationError(
            f"exactly one of {_MODE_FIELDS} must be provided (got {modes_present or 'none'})"
        )
    mode = modes_present[0]

    question = inputs.get("question")
    if question is not None and (not isinstance(question, str) or not question.strip()):
        raise ValidationError("question must be a non-empty string when provided")
    recency = inputs.get("recency_window_days")
    if recency is not None and (isinstance(recency, bool) or not isinstance(recency, int) or recency < 1):
        raise ValidationError("recency_window_days must be a positive int when provided")

    now = datetime.now(timezone.utc)
    extra: dict[str, Any] = {"mode": mode}
    fetch_errors: list[dict[str, Any]] = []

    async with httpx.AsyncClient(timeout=_FETCH_TIMEOUT_S) as client:
        if mode == "urls":
            urls_raw = inputs["urls"]
            if not isinstance(urls_raw, list) or not urls_raw:
                raise ValidationError("urls must be a non-empty list")
            if len(urls_raw) > _MAX_URLS:
                raise ValidationError(f"urls exceeds max {_MAX_URLS}")
            urls = [_validate_url(u, index=i) for i, u in enumerate(urls_raw)]
            raw_sources = [await _fetch_one(client, u, now=now) for u in urls]
            fetch_errors = [{"url": s["url"], "reason": s["fetch_error"]} for s in raw_sources if "fetch_error" in s]
            sources_raw = [s for s in raw_sources if "fetch_error" not in s]
            extra["urls"] = urls
            connected = len(sources_raw) > 0

        elif mode == "dataset_query":
            query = _s(inputs["dataset_query"], cap=_MAX_QUERY_LEN)
            if not query:
                raise ValidationError("dataset_query must be a non-empty string")
            limit = _positive_int(inputs.get("limit"), name="limit", default=_MAX_DATASETS, cap=_MAX_DATASETS)
            res = await _search_datasets(client, query, limit=limit, now=now)
            sources_raw = res["sources_raw"]
            extra["datasets"] = res["datasets"]
            if res["api_error"]:
                fetch_errors = [{"url": f"{CKAN_BASE}/package_search", "reason": res["api_error"]}]
            connected = res["api_error"] is None and len(sources_raw) > 0

        elif mode == "dataset_id":
            dsid = _s(inputs["dataset_id"], cap=200)
            if not dsid:
                raise ValidationError("dataset_id must be a non-empty string")
            res = await _show_dataset(client, dsid, now=now)
            sources_raw = res["sources_raw"]
            extra["dataset"] = res["dataset"]
            extra["resources"] = res["resources"]
            if res["api_error"]:
                fetch_errors = [{"url": f"{CKAN_BASE}/package_show?id={dsid}", "reason": res["api_error"]}]
            connected = res["api_error"] is None and res["dataset"] is not None

        else:  # resource_id
            rid = _s(inputs["resource_id"], cap=200)
            if not rid:
                raise ValidationError("resource_id must be a non-empty string")
            limit = _positive_int(inputs.get("limit"), name="limit", default=_MAX_RECORDS, cap=_MAX_RECORDS)
            dq = inputs.get("datastore_query")
            if dq is not None and (not isinstance(dq, str) or not dq.strip()):
                raise ValidationError("datastore_query must be a non-empty string when provided")
            res = await _search_datastore(client, rid, query=(dq.strip() if dq else None), limit=limit, now=now)
            sources_raw = res["sources_raw"]
            extra["records"] = res["records"]
            extra["fields"] = res["fields"]
            extra["total"] = res["total"]
            if res["api_error"]:
                fetch_errors = [{"url": f"{CKAN_BASE}/datastore_search", "reason": res["api_error"]}]
            connected = res["api_error"] is None and len(res["records"]) > 0

    analysis = web_research_analyze(sources_raw, recency_window_days=recency, now=now)
    logger.info(
        "GOV_IL_RESEARCH mode=%s connected=%s sources=%d fetch_errors=%d findings=%d",
        mode, connected, len(sources_raw), len(fetch_errors), len(analysis["findings"]),
    )

    return {
        "question": question,
        "real_gov_il_provider_connected": connected,
        "fetch_errors": fetch_errors,
        **extra,
        **analysis,
    }


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if not result.get("real_gov_il_provider_connected"):
        return False, "no source was actually retrieved from gov.il — nothing to verify"
    if result.get("mode") == "resource_id":
        # datastore rows aren't run through web_research's claim/finding
        # shape the same way (no free-text claim to corroborate) — verified
        # by real record retrieval + real coverage instead.
        if not result.get("records"):
            return False, "connected but zero records returned"
        return True, f"{len(result['records'])} record(s) retrieved with real field-level provenance"
    return web_research_verify(inputs, result)


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="gov_il_research",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.SOFT_CACHE,
    timeout_s=30.0,
    max_retries=0,
    required_inputs=(
        InputField("urls", (list,), required=False),
        InputField("dataset_query", (str,), required=False),
        InputField("dataset_id", (str,), required=False),
        InputField("resource_id", (str,), required=False),
        InputField("datastore_query", (str,), required=False),
        InputField("limit", (int,), required=False),
        InputField("question", (str,), required=False),
        InputField("recency_window_days", (int,), required=False),
    ),
    output_fields=("findings", "disagreements", "stale_sources", "coverage",
                   "real_gov_il_provider_connected", "fetch_errors", "mode"),
    verification="sourced_findings_from_a_real_gov_il_retrieval",
    provenance_requirements=("source_url", "fetched_at", "method", "gov_il_domain_allowlisted",
                             "dataset_id_or_resource_id_when_applicable"),
    intent_patterns=("gov.il research", "מחקר גוב איי אל", "government research", "חפש באתר הממשלה",
                     "search data.gov.il", "חפש מאגרי מידע"),
    handler=handler,
    verifier=verify,
    data_trust=DataTrust.EXTERNAL_UNTRUSTED,  # overrides the LOCAL-inferred default; see module docstring re: network_scope
)
