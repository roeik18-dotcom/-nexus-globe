"""Semantic domain routing gate — production repair section 5 (2026-08-08).

Before this module existed there was NO relevance gate anywhere in the live
context-assembly chain (verified by direct trace of
service/merlin_service.py -> app/adapters/claude.py -> app/context_builder.py):
zero domain classification, zero per-domain retrieval, a blind top-20
relationship-memory dump on every turn, and a Philos/Project "domain" that
could not be answered at all because nothing ever fetched it.

This module is the single gate, inserted in app/adapters/claude.py just
before build_system_prompt_with_task(), i.e. before ContextBuilder assembles
the system prompt. It:

  1. classifies the current user utterance into exactly one domain
  2. retrieves ONLY that domain's source material (or none, for GENERAL)
  3. logs one ROUTE_DECISION line per turn (route/query/retrieved_unit_ids/
     retrieved_sources/context_chars — the trace contract already documented
     in docs/MERLIN_LIVE_ACCEPTANCE_PROTOCOL.md)
  4. returns a RouteResult the caller can also hand to control_state, so the
     Control Panel can show live route truth instead of nothing

HONESTY RULE (do not violate): retrieval must say MISSING/DRAFT/UNKNOWN when
that is the truth. profiles/person.yaml (14 entries) and profiles/music.yaml
are the only runtime-loadable personal/music sources that exist today — they
are NOT the "Master" the production-repair spec describes (no Source_ID/
Atomic_ID/Canonical_ID/relations/coverage schema exists yet; see
docs/knowledge-inventory/ for the real unbuilt source material). This module
must never present that small file as more than it is.

Rule-based classification, not LLM-based: this runs on every turn before the
real LLM call, so it must add no latency, no extra API cost, and no new
failure mode. It is fully unit-testable without a live model or network call.
"""

from __future__ import annotations

import logging
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any

logger = logging.getLogger("merlin.domain_router")

_ROOT = Path(__file__).resolve().parent.parent
_PROFILES_DIR = _ROOT / "profiles"


class Domain(str, Enum):
    HUMAN_CONFIG = "human_config"
    MUSIC_CONFIG = "music_config"
    STUDIO_PROJECT = "studio_project"
    PHILOS = "philos"
    RUNTIME = "runtime"
    DAY_OPENING = "day_opening"
    GENERAL = "general"


# Keyword cues per domain (Hebrew + English). Classification is by count of
# matched cues in the lowercased query; the domain with the most matches
# wins. A tie, or zero matches anywhere, resolves to GENERAL — "no giant
# config injection" is the correct default per spec section 5, not a guess.
#
# Order here is scan order only; scoring (not order) breaks ties, except
# GENERAL never wins a tie against a real match.
_CUES: dict[Domain, tuple[str, ...]] = {
    Domain.DAY_OPENING: (
        "בוקר טוב", "day opening", "פתיחת יום", "תקציר בוקר", "morning snapshot",
        # 2026-08-09 live evidence: "פתיח יום" (bare noun form) is not a
        # substring of "פתיחת יום" (construct state) — same mismatch class as
        # the human_config "קונפיג האדם" fix. Real query 'פתיח יום'
        # (confidence=0.94 STT) fell through to GENERAL.
        "פתיח יום", "איפה פתיח יום",
    ),
    Domain.MUSIC_CONFIG: (
        "קונפיג מוזיקה", "קונפיג המוזיקה", "music config", "music configuration",
        "מוזיקלי", "מוזיקלית", "הזהות המוזיקלית", "musical identity",
        # 2026-08-08 explicit music-production vocabulary (spec PHASE 2). Unambiguous
        # terms only — bare "מאסטר" is intentionally NOT here because it collides with
        # the Human-config "מאסטר אדם" phrasing; "מאסטרינג"/"mastering" are safe.
        "מיקס", "mixing", "מאסטרינג", "mastering", "master_music",
        "הפקה מוזיקלית", "הפקה", "production", "מפיק",
        "וולוקו", "voloco", "סאונד", "sound design", "סאונד דיזיין",
        "הוק", "hook", "גרוב", "groove", "סינתזה", "synth", "סינת",
        "קומפרסור", "compressor", "פלאגין", "plugin", "פלאגינים",
        "אייבלטון", "לחן", "מלודיה", "מלודי", "אקורד", "הרמוניה", "קליפ",
        "ז'אנר", "genre", "ווקאל", "vocal", "אימיקס",
        # 2026-08-13 DAW/production-terminology coverage gap (live routing audit):
        # these unambiguous production terms had no cue anywhere and fell to
        # GENERAL (no master-probe rescue either — zero token overlap in the
        # master for the bare English terms). "ableton" (English) moved here
        # from STUDIO_PROJECT — bare "Ableton" is a production/workflow
        # question the MUSIC master actually answers, not a live-project-state
        # question; the Hebrew form "אייבלטון" already lived here.
        "ableton", "pro tools", "midi", "audio routing", "arrangement",
        "studio workflow",
    ),
    Domain.HUMAN_CONFIG: (
        "קונפיג אדם", "קונפינג אדם", "קונפיג אישי", "קונפינג אישי",
        # 2026-08-08 live test: the definite-article form ("קונפיג האדם" — "THE
        # human config") is more natural Hebrew than the indefinite cues above
        # and was falling through to GENERAL because "קונפיג אדם" is not a
        # substring of "קונפיג האדם" (extra ה). MUSIC_CONFIG already covers
        # both forms ("קונפיג מוזיקה" / "קונפיג המוזיקה"); this brings
        # HUMAN_CONFIG to parity rather than adding a new keyword family.
        "קונפיג האדם", "קונפינג האדם", "קונפיג האישי", "קונפינג האישי",
        "human config", "human configuration", "personal config",
        "מי אני", "הערכים שלי", "העקרונות שלי",
        # 2026-08-08: added after live testing exposed a real gap — natural
        # paraphrase ("מה אתה יודע על הדרך שאני מעדיף לעבוד?") has no exact
        # keyword above and fell through to GENERAL. person.yaml itself
        # groups this under "preferences (working & communication style)",
        # so these are a real extension of the domain, not overfit to one
        # test phrase.
        "מעדיף לעבוד", "סגנון עבודה", "איך אני עובד", "דרך העבודה שלי",
        "working style", "prefer to work", "how i work", "way i work",
        "my preferences", "my working style",
        # 2026-08-08 explicit human-master phrasings (spec PHASE 2). Whole phrases so
        # they never collide with the music "מאסטרינג" cue.
        "פרופיל אדם", "פרופיל האדם", "מאסטר אדם", "אדם מאסטר", "מאסטר האדם",
        "הפרופיל שלי", "הקונפיג שלי", "קונפיג האדם מאסטר", "human master", "human profile",
        # 2026-08-13 (HUMAN-CONFIG-AUDIT-ADDENDUM-2026-08-13.md finding #3): bare
        # goals/aspirations vocabulary had no direct cue and reached HUMAN_CONFIG
        # only via the weaker zero-cue content-probe (confidence 0.5, and only for
        # forms with no Hebrew prefix letter — "מטרות" probed correctly, but
        # "המטרות"/"והשאיפות" still don't share a token with the master's bare-form
        # content; that prefix-tokenization gap is separate and NOT fixed by this
        # cue addition — see the same doc for why a tokenizer fix was tried and
        # reverted as unsafe). Unambiguous nouns only, no collision with any other
        # domain's cues above.
        "מטרות", "שאיפות", "יעדים", "goals", "aspirations",
    ),
    Domain.PHILOS: (
        "פילוס", "philos", "value hub", "ערכים", "orientation", "פרויקט ערכים",
        "nexus", "נקסוס",
        # 2026-08-11: canonical Philos concept "Positive Melting Pot" (כור ההיתוך
        # החיובי) was unreachable — the phrase carried no PHILOS cue and fell to
        # GENERAL. These are PHILOS-specific, unambiguous concept phrases; generic
        # English "melting pot" is intentionally NOT added to avoid unrelated hits.
        "כור היתוך", "כור ההיתוך", "כור ההיתוך החיובי", "כור היתוך חיובי",
        "positive melting pot",
        # Merlin Product Recovery (2026-08-17): the operator's state questions
        # ("מה המשימות הפתוחות?", "מה הפעולה הבאה?", "מה השתנה היום?") are
        # PHILOS-state questions in this product — PHILOS is the system of
        # record for open loops/priorities/next action, and the PHILOS branch
        # now carries the LIVE shared state that actually answers them. They
        # previously fell to GENERAL, which honestly answered "אין לי גישה
        # למאגר משימות" — correct fallback, wrong routing. Unambiguous state
        # phrases only; single generic words ("משימות" alone) are NOT added.
        "משימות פתוחות", "המשימות הפתוחות", "לולאות פתוחות", "לופים פתוחים",
        "מה פתוח", "הפעולה הבאה", "מה השתנה היום", "מה השתנה השבוע",
        "מצב הפרויקטים", "הפרויקטים שלי", "open loops", "next action",
        # 2026-08-17 spoken-orientation coverage (product recovery §6):
        "קבוצות הערך", "קבוצת ערך", "קבוצות ערך", "value group", "value groups",
        "הניגודים", "ניגודים פעילים", "ניגוד פעיל", "contradictions", "tensions",
        "מה השתנה", "הצעד הבא", "מה התקדם", "על מה עבדתי",
        "הפרויקטים והמשימות", "מה חסום", "blockers",
    ),
    Domain.STUDIO_PROJECT: (
        "מצב הפרויקט", "מצב פרויקט", "project status", "project state",
        "מצב האולפן", "האולפן", "studio status", "sketch", "mixdown", "bounce",
    ),
    Domain.RUNTIME: (
        "מצב מרלין", "merlin status", "runtime status", "מצב המערכת",
        "system status", "מצב הריצה", "בדוק רשת", "בדוק את הרשת", "network",
        "רשת",
    ),
    # Broader, lower-precedence music/studio cues checked only after the
    # config/status phrases above, so "מה מצב קונפיג מוזיקה" (config STATUS)
    # cannot be shadowed by the bare word "מוזיקה" scoring for MUSIC_CONFIG
    # via a different path — handled by scoring order below, not here.
}
_MUSIC_GENERIC_CUES = ("מוזיקה", "שיר", "שירים", "music", "song")

# Minimum master content-token overlap for the zero-cue retrieval probe to
# claim a domain. 1 = a single distinctive content word that appears in a master
# (stopwords already excluded by master_config._tokens); a clear winner is also
# required (strictly greater than the other master), so ambiguous ties stay
# GENERAL rather than guessing.
_PROBE_MIN_OVERLAP = 1


@dataclass
class SourceRef:
    path: str
    status: str          # FOUND | MISSING | DRAFT | LOADED | ERROR | UNKNOWN
    item_count: int | None = None
    note: str = ""


@dataclass
class RouteResult:
    domain: Domain
    query: str
    confidence: float                 # 0..1, matched_cues / max(1, total_cues_hit)
    context_text: str = ""
    sources: list[SourceRef] = field(default_factory=list)
    retrieved_unit_ids: list[str] = field(default_factory=list)
    fallback_reason: str = ""
    latency_ms: float = 0.0


def classify(query: str) -> tuple[Domain, float]:
    """Pure function: query -> (domain, confidence). No I/O, fully testable."""
    if not query or not query.strip():
        return Domain.GENERAL, 0.0
    from app.master_config import normalize_query   # single canonical alias layer
    q = normalize_query(query).lower()

    scores: dict[Domain, int] = {}
    for domain, cues in _CUES.items():
        hits = sum(1 for cue in cues if cue.lower() in q)
        if hits:
            scores[domain] = hits

    # Generic music words only count if no higher-precedence domain matched
    # at all — otherwise "מה מצב קונפיג מוזיקה" (config STATUS question) would
    # tie MUSIC_CONFIG against itself for the wrong reason instead of just
    # winning outright on the specific cue it already matched.
    if not scores:
        generic_music_hits = sum(1 for cue in _MUSIC_GENERIC_CUES if cue in q)
        if generic_music_hits:
            scores[Domain.MUSIC_CONFIG] = generic_music_hits

    if not scores:
        return Domain.GENERAL, 0.0

    best_domain = max(scores, key=lambda d: scores[d])
    best_score = scores[best_domain]
    total = sum(scores.values())
    confidence = best_score / total if total else 0.0
    return best_domain, round(confidence, 3)


def _read_yaml_entries(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        import yaml
        data = yaml.safe_load(path.read_text(encoding="utf-8"))
        return list((data or {}).get("entries", []) or [])
    except Exception as exc:
        logger.warning("domain_router: failed to read %s (%s)", path, exc)
        return []


def _master_route(query: str, domain: "Domain", res: dict, master_label: str, projection: Path) -> RouteResult:
    """Shared: turn a master_config retrieval dict into a RouteResult.
    Master LOADED -> master-backed slice; otherwise UNKNOWN (projection is NEVER
    returned as authoritative when the master is unavailable)."""
    if res.get("status") != "LOADED":
        n = len(_read_yaml_entries(projection))
        return RouteResult(
            domain=domain, query=query, confidence=0.0,
            sources=[SourceRef(path=res.get("path") or master_label, status="UNKNOWN",
                               note=res.get("reason", ""))],
            fallback_reason=(f"{master_label} MASTER unavailable ({res.get('reason','')}). "
                             f"A {n}-entry {projection.name} projection exists but is NOT the master "
                             f"and is not returned as authoritative."),
        )
    from pathlib import Path as _P
    rep = " · representative sample" if res.get("representative") else ""
    lines = [f"## {master_label} MASTER ({_P(res['path']).name}{rep} — {res['total']} resolved units)"]
    ids, srcs = [], []
    for r in res["rows"]:
        cid = r.get("canonical_id") or r.get("atomic_id") or "?"
        ids.append(cid)
        head = (r.get("heading") or "")[:40]
        lines.append(f"- [{cid}] ({head}) {r.get('text','')}")
        srcs.append(SourceRef(path=res["path"], status="LOADED",
                              note=f"Canonical_ID={cid} Source_ID={r.get('source_id','')}"))
    return RouteResult(domain=domain, query=query, confidence=1.0,
                       context_text="\n".join(lines), sources=srcs, retrieved_unit_ids=ids)


def _retrieve_human_config(query: str) -> RouteResult:
    from app.master_config import retrieve_human_master
    return _master_route(query, Domain.HUMAN_CONFIG, retrieve_human_master(query, limit=6),
                         "Human Config", _PROFILES_DIR / "person.yaml")


def _retrieve_music_config(query: str) -> RouteResult:
    from app.master_config import retrieve_music_master
    return _master_route(query, Domain.MUSIC_CONFIG, retrieve_music_master(query, limit=6),
                         "Music Config", _PROFILES_DIR / "music.yaml")


def _retrieve_studio_project(query: str) -> RouteResult:
    """2026-08-13: real, provenance-backed Studio project-state retrieval —
    app.studio_index reads the actual ~/Dropbox/-STUDIO-SYSTEM ledger
    (scanner output over 157 real Ableton projects), read-only. Replaces the
    prior project_knowledge-based STUDIO_PROJECT path, which had no real
    indexed source for studio content (see _retrieve_via_project_knowledge,
    still used by PHILOS — untouched)."""
    from app.studio_index import retrieve_studio_project
    res = retrieve_studio_project(query, limit=6)
    if res.get("status") != "LOADED":
        return RouteResult(
            domain=Domain.STUDIO_PROJECT, query=query, confidence=0.0,
            sources=[SourceRef(path=res.get("path") or "studio ledger", status="UNKNOWN",
                               note=res.get("reason", ""))],
            fallback_reason=res.get("reason", "studio ledger unavailable"),
        )
    rep = " · representative sample" if res.get("representative") else ""
    amb = " · AMBIGUOUS (multiple projects share this name)" if res.get("ambiguous") else ""
    lines = [f"## Studio Project ledger{rep}{amb} ({res.get('match_count', 0)} match(es))"]
    active = res.get("active_project") or {}
    if active.get("status") == "LOADED":
        lines.append(f"- ACTIVE: {active.get('name')} (stage={active.get('stage')}, "
                     f"started={active.get('started')})")
    ids, srcs = [], []
    for m in res.get("matches", []):
        pid = m["project_identity"]
        stage = m["status_stage"]
        lines.append(
            f"- [{pid['id']}] {pid['name']} — stage={stage['value']} ({stage['source']}); "
            f"arrangement={m['arrangement_state']['status']} mix={m['mix_state']['status']} "
            f"master={m['master_state']['status']} recording={m['recording_state']['status']}"
        )
        ids.append(pid["id"])
        srcs.append(SourceRef(path=m["provenance"]["source_file"], status="LOADED",
                              note=f"record_id={pid['id']}"))
    ledger_meta = res.get("ledger") or {}
    if ledger_meta.get("stale"):
        lines.append(f"- NOTE: ledger snapshot is {ledger_meta.get('age_days')} days old (stale) "
                     f"— scanned_at={ledger_meta.get('scanned_at')}")
    return RouteResult(domain=Domain.STUDIO_PROJECT, query=query, confidence=1.0,
                       context_text="\n".join(lines), sources=srcs, retrieved_unit_ids=ids)


def _retrieve_via_project_knowledge(query: str, *, project: str | None, domain: Domain,
                                     exclude_meta: bool = False) -> RouteResult:
    try:
        from project_knowledge import api as pk_api
    except Exception as exc:
        return RouteResult(
            domain=domain, query=query, confidence=0.0,
            sources=[SourceRef(path="project_knowledge", status="ERROR", note=str(exc))],
            fallback_reason=f"project_knowledge unavailable: {exc}",
        )
    try:
        env = pk_api.answer_context(query, project=project, limit=6)
    except Exception as exc:
        return RouteResult(
            domain=domain, query=query, confidence=0.0,
            sources=[SourceRef(path="project_knowledge", status="ERROR", note=str(exc))],
            fallback_reason=f"project_knowledge query failed: {exc}",
        )
    sources_out = env.get("sources") or []
    # Exclude code/test/mocks/CLI/UI pollution — these are never studio/music KNOWLEDGE.
    # Keep docs/config/ledger/knowledge files only (unless the user asked about code).
    _POLLUTION = re.compile(
        r"(/tests?/|/__tests__/|test_|_test\.|\.spec\.|/mock|mock\.py|/cli\.py|conftest|"
        r"/bench/|/scripts/|/node_modules/|/project_knowledge/|\.tsx?$|\.py$)", re.I)
    _KNOWLEDGE_EXT = (".md", ".txt", ".yaml", ".yml", ".json", ".jsonl")
    def _is_knowledge(p: str) -> bool:
        pl = p.lower()
        if _POLLUTION.search(pl):
            return False
        return pl.endswith(_KNOWLEDGE_EXT) or "ledger" in pl or "studio" in pl or "config" in pl
    asked_about_code = any(k in query.lower() for k in ("code", "קוד", ".py", ".ts", "test", "mock"))
    if not asked_about_code:
        sources_out = [s for s in sources_out if _is_knowledge(s.get("path", ""))]
    if exclude_meta:
        # docs/knowledge-inventory/* is meta-documentation ABOUT the knowledge
        # base (folder maps, harvest-candidate manifests with "why": "..."
        # annotations) — it passes the doc-extension whitelist above but is
        # never real studio/project content. Live audit: an unfiltered
        # (project=None) STUDIO_PROJECT search for "Ableton" surfaced
        # KNOWLEDGE-INVENTORY.md and raw/harvest-learning.json as if they were
        # answers, at scores 6-9, instead of the honest "not indexed" fallback.
        sources_out = [s for s in sources_out if "knowledge-inventory" not in s.get("path", "")]
    if env.get("status") == "UNKNOWN" or not sources_out:
        return RouteResult(
            domain=domain, query=query, confidence=0.0,
            sources=[SourceRef(path=f"project_knowledge(project={project!r})", status="UNKNOWN")],
            fallback_reason=(env.get("instruction") or
                             "no valid studio/knowledge source found (code/test files excluded)"),
        )
    lines = [f"## {domain.value} (project_knowledge retrieval, project={project!r})"]
    ids = []
    src_refs = []
    for s in sources_out:
        unit_id = f"{s['path']}:{s['line_start']}-{s['line_end']}"
        ids.append(unit_id)
        lines.append(f"- ({s['score']}) {unit_id} — {s['heading'][:80]}")
        src_refs.append(SourceRef(path=s["path"], status="LOADED"))
    return RouteResult(
        domain=domain, query=query, confidence=1.0,
        context_text="\n".join(lines),
        sources=src_refs,
        retrieved_unit_ids=ids,
    )


def _retrieve_runtime(query: str, *, control_state: Any = None) -> RouteResult:
    if control_state is None:
        return RouteResult(
            domain=Domain.RUNTIME, query=query, confidence=0.0,
            fallback_reason="no control_state available",
        )
    try:
        summary = control_state.runtime_summary() if hasattr(control_state, "runtime_summary") else str(control_state.state)
    except Exception as exc:
        summary = f"ERROR: {exc}"
    return RouteResult(
        domain=Domain.RUNTIME, query=query, confidence=1.0,
        context_text=f"## Runtime status\n{summary}",
        sources=[SourceRef(path="service.control_state", status="LOADED")],
    )


def _retrieve_day_opening(query: str, *, control_state: Any = None) -> RouteResult:
    if control_state is None:
        return RouteResult(
            domain=Domain.DAY_OPENING, query=query, confidence=0.0,
            fallback_reason="no control_state available",
        )
    state = getattr(control_state, "day_opening_state", "UNKNOWN")
    last_ts = getattr(control_state, "day_opening_last_ts", None)
    last_err = getattr(control_state, "day_opening_last_error", None)
    text = f"## Day Opening status\nstate={state} last_ts={last_ts} last_error={last_err}"
    return RouteResult(
        domain=Domain.DAY_OPENING, query=query, confidence=1.0,
        context_text=text,
        sources=[SourceRef(path="service.control_state.day_opening_*", status="LOADED")],
    )


def _resolve_control_state(control_state: Any) -> Any:
    """Falls back to the process-wide singleton (service.control_state) so
    callers in app/ (which does not otherwise import service/) can still
    reach live runtime/day-opening truth without threading a new parameter
    through every intermediate layer. Defensive: works fine (returns None)
    if service/ isn't importable, e.g. in an app/-only test context."""
    if control_state is not None:
        return control_state
    try:
        from service.control_state import get_global_control_state
        return get_global_control_state()
    except Exception:
        return None


def knowledge_source_status() -> dict:
    """Observability for the Control Panel (/api/knowledge_sources).

    Reports the REAL runtime masters actually used by route()/master_config as
    PRIMARY — absolute path, resolved-unit count, live reachability — and
    demotes profiles/*.yaml to FALLBACK ONLY. This reads the SAME
    source-of-truth the runtime uses (app.master_config): the master paths and
    the resolved()-unit rule live in master_config, not here, so there is no
    duplicated path/count logic in the panel. Reachability is a real load
    probe: status LOADED means master_config just read the workbook; UNKNOWN
    means it is offline/evicted/missing, exactly as master_config determined.
    Observability only — not part of classify()/route()/retrieval."""
    from app.master_config import (
        retrieve_human_master, retrieve_music_master,
        human_master_path, music_master_path,
    )
    person = _PROFILES_DIR / "person.yaml"
    music = _PROFILES_DIR / "music.yaml"
    music_draft = _PROFILES_DIR / "music.v2-proposal.yaml"
    pk_db = _ROOT / "project_knowledge" / "index.db"

    def _yaml_count(p: Path) -> int | None:
        entries = _read_yaml_entries(p)
        return len(entries) if entries else None

    # PRIMARY masters. An empty query returns the FULL resolved pool as `total`
    # with status LOADED/UNKNOWN, computed by master_config's own resolved()
    # rule — so the count here is the runtime's count, never re-derived.
    hm = retrieve_human_master("")
    mm = retrieve_music_master("")

    def _master_entry(res: dict, fallback_path, domain_label: str) -> dict:
        reachable = res.get("status") == "LOADED"
        return {
            "role": "PRIMARY (runtime)",
            "domain": domain_label,
            "status": res.get("status"),                     # LOADED | UNKNOWN
            "reachable": reachable,
            "loaded": reachable,
            "path": res.get("path") or (str(fallback_path) if fallback_path else None),
            "item_count": res.get("total"),                  # resolved-unit count
            "note": ("Verified Master (Source_ID/Atomic_ID/Canonical schema); "
                     "this is what domain_router actually retrieves from.")
                    if reachable else
                    (res.get("reason") or "master offline/evicted — not reachable this poll"),
        }

    return {
        "human_master": _master_entry(hm, human_master_path(), "human_config"),
        "music_master": _master_entry(mm, music_master_path(), "music_config"),
        "human_fallback": {
            "role": "FALLBACK ONLY",
            "domain": "human_config",
            "status": "FOUND" if person.exists() else "MISSING",
            "reachable": person.exists(),
            "loaded": False,
            "path": str(person),
            "item_count": _yaml_count(person),
            "note": "v1 profile stub — used ONLY if the HUMAN master is "
                    "unreachable; NOT the primary source.",
        },
        "music_fallback": {
            "role": "FALLBACK ONLY",
            "domain": "music_config",
            "status": "FOUND" if music.exists() else "MISSING",
            "reachable": music.exists(),
            "loaded": False,
            "path": str(music),
            "item_count": _yaml_count(music),
            "note": "v1 profile stub — fallback only. DRAFT v2 proposal "
                    f"{'present (NOT loaded)' if music_draft.exists() else 'absent'}; "
                    "a DRAFT is never served as MASTER FINAL.",
        },
        "project_knowledge": {
            "role": "PRIMARY (runtime)",
            "domain": "philos / projects",
            "status": "FOUND" if pk_db.exists() else "MISSING",
            "reachable": pk_db.exists(),
            "loaded": False,
            "path": str(pk_db),
            "item_count": None,
            "note": "project_knowledge index — routed for Philos/project questions "
                    "(studio ledger at ~/Dropbox/-STUDIO-SYSTEM is not indexed).",
        },
    }


def _append_config_status(result: "RouteResult", _tag: str) -> None:
    """CONFIG COMPLETENESS SEMANTICS (2026-08-17): Human/Music-config turns
    carry the three-layer status (MASTER STATUS / ACTIVE CONFIG / LIVE
    STATE) from live PHILOS, so a spoken "מה מצב קונפיג האדם?" answers with
    '189 available · 19 active refs · live state UNKNOWN' instead of
    translating row-review states into "the config is incomplete"."""
    try:
        from app.philos_shared_state import render_shared_state_context
        live = render_shared_state_context()
        result.context_text = f"{result.context_text or ''}\n\n{live}".strip()
        result.sources.append(SourceRef(
            path="/api/canon/shared-state",
            status="LOADED" if "NOT CONNECTED" not in live else "ERROR",
            note="PHILOS live config status (read-only)",
        ))
    except Exception as exc:
        logger.warning("config-status append failed: %s", exc)


def route(query: str, *, control_state: Any = None) -> RouteResult:
    """The single entry point. Classifies, retrieves, logs ROUTE_DECISION."""
    t0 = time.monotonic()
    control_state = _resolve_control_state(control_state)
    domain, confidence = classify(query)

    # ZERO-CUE FALLBACK (2026-08-09): a content word with no keyword cue (e.g.
    # 'דיסונאנס') used to fall silently to GENERAL. Instead, probe the MUSIC and
    # HUMAN masters by CONTENT-token overlap and route to the master that
    # actually contains the term — a clear winner (strictly greater, non-zero)
    # only. No keyword-list growth; ties / no-overlap stay GENERAL honestly.
    _probe = None
    # CONVERSATION CONTINUITY (product recovery, 2026-08-17 — precedence
    # fix after live smoke): an anaphoric zero-cue follow-up ("ומה הכי
    # חשוב מתוך זה?", "למה?", "ומה עם SIA?") inherits the PREVIOUS turn's
    # domain BEFORE the content-token probe gets a chance. Live failure
    # this session: the probe matched the bare token "חשוב" inside the
    # HUMAN master and yanked a philos follow-up into human_config,
    # answering from unrelated config — exactly the domain-mixing the
    # product complaint describes. A real cue on the new turn still wins
    # (this only fires on the zero-cue path).
    _continuity_applied = False
    if domain == Domain.GENERAL and query and query.strip():
        prev = None
        try:
            _lrd = getattr(control_state, "last_route_decision", None) if control_state is not None else None
            prev = (_lrd or {}).get("domain") if isinstance(_lrd, dict) else None
        except Exception:
            prev = None
        toks = query.strip().split()
        anaphoric = len(toks) <= 7 or (toks and toks[0][:1] in ("ו", "אז")) or query.strip().startswith(("למה", "מה עם", "ומה"))
        if prev and prev != "general" and anaphoric:
            try:
                domain = Domain(prev)
                confidence = 0.4
                _continuity_applied = True
                logger.info("ROUTE_CONTINUITY query=%r inherited_domain=%s (zero-cue anaphoric follow-up, pre-probe)", query, prev)
            except ValueError:
                pass

    if domain == Domain.GENERAL and query and query.strip():
        try:
            from app.master_config import master_probe_scores
            sc = master_probe_scores(query)
            _m, _h = sc.get("music_config", 0), sc.get("human_config", 0)
            _probe = (_m, _h)
            if max(_m, _h) >= _PROBE_MIN_OVERLAP and _m != _h:
                domain = Domain.MUSIC_CONFIG if _m > _h else Domain.HUMAN_CONFIG
                confidence = 0.5   # retrieval-probe route: real but weaker than a cue hit
                logger.info("ROUTE_PROBE query=%r music_overlap=%d human_overlap=%d -> %s",
                            query, _m, _h, domain.value)
        except Exception as exc:
            logger.warning("ROUTE_PROBE failed (%s) — staying GENERAL", exc)

    if domain == Domain.GENERAL:
        result = RouteResult(domain=domain, query=query, confidence=confidence)
    elif domain == Domain.HUMAN_CONFIG:
        result = _retrieve_human_config(query)
        _append_config_status(result, "קונפיג")
    elif domain == Domain.MUSIC_CONFIG:
        result = _retrieve_music_config(query)
        _append_config_status(result, "קונפיג")
    elif domain == Domain.PHILOS:
        result = _retrieve_via_project_knowledge(query, project="Philos Orientation", domain=domain)
        # Merlin Product Recovery (2026-08-17): PHILOS-domain turns get the
        # LIVE shared state appended — before this, "מה מצב פילוס?" was
        # answered from the static project_knowledge index only. Merlin is a
        # CONSUMER: the block is rendered from `GET /api/canon/shared-state`
        # verbatim, PROJECTS is an explicit UNKNOWN (no project record type
        # exists in PHILOS), and a fetch failure renders as an explicit
        # not-connected block — never fabricated state.
        try:
            from app.philos_shared_state import render_shared_state_context
            _live = render_shared_state_context()
            result.context_text = f"{result.context_text or ''}\n\n{_live}".strip()
            result.sources.append(SourceRef(
                path="/api/canon/shared-state",
                status="LOADED" if "NOT CONNECTED" not in _live else "ERROR",
                note="PHILOS live shared state (read-only)",
            ))
        except Exception as exc:
            logger.warning("PHILOS live-state append failed: %s", exc)
            result.sources.append(SourceRef(path="/api/canon/shared-state", status="ERROR", note=str(exc)))
        # TEMPORAL ORIENTATION (2026-08-17): today/yesterday/recent-days
        # buckets from record-carried timestamps, computed at turn time.
        try:
            from app.temporal_orientation import render_temporal_orientation
            result.context_text = f"{result.context_text}\n\n{render_temporal_orientation()}".strip()
        except Exception as exc:
            logger.warning("temporal orientation append failed: %s", exc)
        # PROJECT ORIENTATION (2026-08-17): real project state exists in the
        # studio ledger + PHILOS itself — projected read-only, never invented.
        try:
            from app.project_orientation import render_project_orientation
            result.context_text = f"{result.context_text}\n\n{render_project_orientation()}".strip()
            result.sources.append(SourceRef(path="project_orientation", status="LOADED", note="studio ledger + PHILOS shared state (read-only)"))
        except Exception as exc:
            logger.warning("project orientation append failed: %s", exc)
    elif domain == Domain.STUDIO_PROJECT:
        result = _retrieve_studio_project(query)
    elif domain == Domain.RUNTIME:
        result = _retrieve_runtime(query, control_state=control_state)
    elif domain == Domain.DAY_OPENING:
        result = _retrieve_day_opening(query, control_state=control_state)
    else:
        result = RouteResult(domain=Domain.GENERAL, query=query, confidence=0.0)

    result.confidence = confidence if domain != Domain.GENERAL else result.confidence
    result.latency_ms = round((time.monotonic() - t0) * 1000, 2)

    try:
        from app.trace_context import get_trace_id as _get_tid, set_route_domain as _set_rd
        _tid = _get_tid()
        _set_rd(result.domain.value)   # publish the selected domain for history scoping
    except Exception:
        _tid = ""
    logger.info(
        "ROUTE_DECISION trace_id=%s route=%s query=%r retrieved_unit_ids=%s retrieved_sources=%s "
        "context_chars=%d confidence=%.3f fallback_reason=%r latency_ms=%.2f",
        _tid, result.domain.value, query, result.retrieved_unit_ids,
        [s.path for s in result.sources], len(result.context_text or ""),
        result.confidence, result.fallback_reason, result.latency_ms,
    )
    if control_state is not None and hasattr(control_state, "set_route_decision"):
        try:
            _read = [result.domain.value]
            if result.domain == Domain.PHILOS:
                _read += ["human_state(dependency)", "music_state(dependency)", "projects(adapter)", "temporal"]
            elif result.domain in (Domain.HUMAN_CONFIG, Domain.MUSIC_CONFIG):
                _read += ["philos_live_status(dependency)"]
            _all = {"general", "human_config", "music_config", "philos", "studio_project", "runtime", "day_opening"}
            _rejected = sorted(_all - {result.domain.value})
            control_state.set_route_decision({
                "domain": result.domain.value,
                "context_domains_read": _read,
                "context_domains_rejected": _rejected,
                "query": query,
                "confidence": result.confidence,
                "sources": [
                    {"path": s.path, "status": s.status, "item_count": s.item_count, "note": s.note}
                    for s in result.sources
                ],
                "retrieved_unit_ids": result.retrieved_unit_ids,
                "fallback_reason": result.fallback_reason,
                "context_chars": len(result.context_text or ""),
                "latency_ms": result.latency_ms,
            })
        except Exception:
            logger.warning("domain_router: failed to record route decision into control_state", exc_info=True)
    return result
