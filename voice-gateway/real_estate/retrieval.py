"""REAL_ESTATE_MASTER — category classification + retrieval.

query -> category -> source lookup (manifest) -> provenance -> StructuredResult.

Deliberately standalone: no import of app.domain_router or app.master_config
(this is a NEW, isolated track, not wired into shared routing yet — see
REAL-ESTATE-MASTER-DESIGN.md Phase 6 for exactly what a routing owner adds
later). Classification style mirrors app.domain_router.classify() (substring
keyword-cue counting, highest score wins, a tie or zero match is honest
"no category", never a guess) because that pattern is already proven in this
codebase — not because this module depends on it.

Because every source in source_manifest.MANIFEST is currently `indexable=False`
(sealed pending Roei's explicit review — see the manifest's own docstring),
retrieve() can never return fabricated content today: there is none to draw
from. Every real query today truthfully resolves to SEALED or UNKNOWN, never
LOADED. That is the correct behavior for this pass, not a bug to fix later
by relaxing the seal without an explicit human decision.
"""
from __future__ import annotations

from .schema import RECategory, SourceRef, StructuredResult
from .source_manifest import entries_for

_CUES: dict[RECategory, tuple[str, ...]] = {
    RECategory.BLOCK_PARCEL: (
        "גוש חלקה", "גוש וחלקה", "גוש", "חלקה", "block and parcel", "block parcel",
        "parcel number", "parcel", "תת חלקה",
    ),
    RECategory.PLANNING: (
        "תכנון ובנייה", "תכנון", "תב\"ע", "תוכנית בניין עיר", "zoning", "planning",
        "היתר בנייה", "building permit", "מה התכנון",
    ),
    RECategory.RIGHTS_REGISTRY: (
        "זכויות בנכס", "זכויות", "טאבו", "נסח טאבו", "land registry", "rights registry",
        "ownership rights", "בעלות", "רישום מקרקעין",
    ),
    RECategory.TAXES_LEVIES: (
        "מס רכישה", "מס שבח", "היטל השבחה", "ארנונה", "purchase tax", "betterment levy",
        "מיסוי", "היטלים", "מיסוי והיטלים",
    ),
    RECategory.TRANSACTIONS_PRICES: (
        "עסקאות ומחירים", "עסקאות", "מחירי דירות", "מחיר עסקה", "transaction price",
        "property prices", "real estate transactions",
    ),
    RECategory.APPRAISAL: (
        "שמאות", "שמאי", "appraisal", "valuation", "הערכת שווי",
    ),
    RECategory.CONTRACTS_DOCUMENTS: (
        "מסמכים", "חוזה מכר", "חוזה", "contract", "documents", "הסכם מכר",
    ),
    RECategory.CLIENTS_LEADS: (
        "לקוחות", "לידים", "clients", "leads", "prospect", "ליד חדש",
    ),
    RECategory.MARKETING: (
        "שיווק נכס", "פרסום נכס", "marketing", "listing", "פרסום דירה", "סוגי פירסומים",
    ),
    RECategory.GOVERNMENT_SOURCES: (
        "מידע ממשלתי", "government information", "gov.il", "מקורות ממשלתיים",
        "אתר ממשלתי",
    ),
    RECategory.DUE_DILIGENCE: (
        # deliberately anchored on the specific professional term ("due
        # diligence" / "בדיקת נאותות") rather than generic qualifiers like
        # "לפני עסקה" ("before a deal") or "מה חסר" ("what's missing") — those
        # collided with GOVERNMENT_SOURCES / CONTRACTS_DOCUMENTS respectively
        # on real test queries and produced false ties; see
        # tests/test_real_estate_master.py for the two cases this fixed.
        "בדיקת נאותות", "תכין בדיקת נאותות", "due diligence", "בדיקה מקדימה",
    ),
    RECategory.PROFESSIONAL_KNOWLEDGE: (
        "ידע מקצועי", "בחינת מתווכים", "broker exam", "professional knowledge", "תיווך",
    ),
    RECategory.PROPERTIES: (
        "נכס", "נכסים", "property", "properties", "דירה למכירה", "דירה להשכרה",
        "apartment for sale", "apartment for rent",
    ),
}


def classify(query: str) -> tuple[RECategory | None, float]:
    """Pure function: query -> (category or None, confidence). No I/O."""
    if not query or not query.strip():
        return None, 0.0
    q = query.strip().lower()
    scores: dict[RECategory, int] = {}
    for cat, cues in _CUES.items():
        hits = sum(1 for cue in cues if cue.lower() in q)
        if hits:
            scores[cat] = hits
    if not scores:
        return None, 0.0
    best = max(scores, key=lambda c: scores[c])
    total = sum(scores.values())
    if list(scores.values()).count(scores[best]) > 1:
        return None, 0.0   # tie — honest "no confident category", not a guess
    return best, round(scores[best] / total, 3)


def retrieve(query: str) -> StructuredResult:
    """query -> category -> manifest lookup -> honest StructuredResult.

    Never returns fabricated ownership/zoning/price/tax/legal/appraisal facts:
    context_text is empty for every result today, because no source content
    has been reviewed/indexed (see module docstring)."""
    category, confidence = classify(query)
    if category is None:
        return StructuredResult(
            category=None,
            query=query, status="UNKNOWN",
            fallback_reason=(
                "no real-estate category cue matched this query — this is a "
                "category-level classifier only (query -> one of 13 real-estate "
                "categories); deciding whether a query is real-estate-related AT "
                "ALL is a job for the eventual domain-router wiring, not this "
                "module (see REAL-ESTATE-MASTER-DESIGN.md Phase 6)."
            ),
        )

    known_sources = entries_for(category)
    if not known_sources:
        return StructuredResult(
            category=category, query=query, status="UNKNOWN",
            fallback_reason=f"no catalogued source exists yet for category={category.value}",
        )

    sealed = [s for s in known_sources if not s.indexable]
    loaded = [s for s in known_sources if s.indexable]

    refs = [SourceRef(path=s.path, status="SEALED", note=s.note) for s in sealed]
    refs += [SourceRef(path=s.path, status="FOUND (not yet content-indexed)", note=s.note)
             for s in loaded]

    if sealed and not loaded:
        status = "SEALED"
        reason = (
            f"{len(sealed)} known source(s) exist for category={category.value} but are "
            "sealed pending Roei's explicit review (personal/financial records containing "
            "real property addresses and/or third-party names) — never rendered as fact."
        )
    else:
        status = "UNKNOWN"
        reason = (
            f"{len(loaded)} catalogued, non-sensitive source(s) exist for "
            f"category={category.value}, but their content has not yet been extracted/"
            "indexed into this master — pointer only, no fabricated content."
        )

    return StructuredResult(
        category=category, query=query, status=status,
        context_text="",   # never populated without real, reviewed content
        sources=refs, fallback_reason=reason,
    )
