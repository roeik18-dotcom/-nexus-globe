"""REAL_ESTATE_MASTER — Phase 4: gov.il / public-source research contract.

SPECIFICATION ONLY. No network call is made from this module, and it does
NOT import app.capabilities.gov_il_research or app.capabilities.web_research
— those are the existing, tested retrieval/reasoning capabilities this domain
is meant to CONSUME once a routing owner wires it in (see
REAL-ESTATE-MASTER-DESIGN.md Phase 6), not duplicate. This file only defines,
per category, WHAT research intent + WHICH real-world gov.il domains a future
call into `gov_il_research.handler({"urls": [...], "question": ...})` should
target — the same input shape that capability already accepts.

PUBLIC READ ONLY, matching gov_il_research.py's own structural guarantees
(GET-only, gov.il-suffix allowlist, login/personal-area/form/payment path
denylist, no credentials field anywhere): every intent below is a read of a
public information page or public open-dataset API. None of them log in,
access a personal government area, submit a form, pay, file anything, or
constitute legal representation.

CONFIRMED vs UNCONFIRMED: each domain below was live-checked this pass (via
WebFetch, not gov_il_research.py itself) where possible. gov.il's own
documented behavior (see gov_il_research.py's "LIVE-NETWORK" note) is that
many gov.il pages are bot-mitigation-challenged or JS-rendered SPA shells from
this kind of environment — so UNCONFIRMED means "not verified reachable here
today", not "known wrong". Nothing below is asserted as fact beyond what was
actually observed.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .schema import RECategory


@dataclass(frozen=True)
class ResearchIntent:
    category: RECategory
    intent_id: str
    description: str
    candidate_domains: tuple[str, ...]     # gov.il-suffix hosts only
    confirmation: str                       # "CONFIRMED_REACHABLE" | "UNCONFIRMED" | "PARTIAL"
    confirmation_note: str
    example_question: str                   # -> gov_il_research's `question` input


RESEARCH_INTENTS: tuple[ResearchIntent, ...] = (
    ResearchIntent(
        category=RECategory.BLOCK_PARCEL,
        intent_id="block_parcel_lookup",
        description="Look up public information for a given block/parcel (גוש/חלקה).",
        candidate_domains=("data.gov.il",),
        confirmation="PARTIAL",
        confirmation_note=(
            "data.gov.il's CKAN API is CONFIRMED_REACHABLE (this pass: a real "
            "package_search JSON response was returned). A specific dataset "
            "covering block/parcel records was NOT confirmed — the sample "
            "search query returned zero results; finding the right dataset "
            "slug is future work, not assumed here."
        ),
        example_question="מה המידע הציבורי הזמין על גוש 1234 חלקה 56?",
    ),
    ResearchIntent(
        category=RECategory.RIGHTS_REGISTRY,
        intent_id="land_registry_topic_page",
        description="General public information about the Israel Land Registry (טאבו) process.",
        candidate_domains=("www.gov.il",),
        confirmation="UNCONFIRMED",
        confirmation_note=(
            "gov.il/he/departments/topics/israel_land_registry returned HTTP 403 "
            "(bot-mitigation) this pass — matches gov_il_research.py's own "
            "documented finding that gov.il HTML pages are frequently "
            "challenge-gated from an automated fetch. NOT confirmed reachable; "
            "flagged, not silently assumed working."
        ),
        example_question="מה התהליך הציבורי לבדיקת נסח טאבו?",
    ),
    ResearchIntent(
        category=RECategory.PLANNING,
        intent_id="planning_portal_lookup",
        description="Public zoning/planning information for an area (תב\"ע, היתרי בנייה).",
        candidate_domains=("mavat.iplan.gov.il",),
        confirmation="UNCONFIRMED",
        confirmation_note="Connection reset this pass; not confirmed reachable from this environment.",
        example_question="מה התכנון התקף (תב\"ע) באזור המבוקש?",
    ),
    ResearchIntent(
        category=RECategory.TRANSACTIONS_PRICES,
        intent_id="real_estate_transactions_public_data",
        description="Public real-estate transaction/price data.",
        candidate_domains=("nadlan.gov.il", "www.nadlan.gov.il"),
        confirmation="PARTIAL",
        confirmation_note=(
            "A fetch of nadlan.gov.il returned a page fragment whose <title> "
            "reads 'אתר הנדל\"ן הממשלתי' (Government Real Estate Website) — "
            "on-topic and plausibly real, but full content/functionality was "
            "NOT verified from the fragment alone."
        ),
        example_question="מה מחירי העסקאות שנרשמו לאחרונה באזור?",
    ),
    ResearchIntent(
        category=RECategory.TAXES_LEVIES,
        intent_id="tax_authority_public_info",
        description="Public information on purchase tax / betterment levy rates and rules.",
        candidate_domains=("www.gov.il", "data.gov.il"),
        confirmation="UNCONFIRMED",
        confirmation_note="Not fetched this pass; data.gov.il's API is confirmed reachable in general (see block_parcel_lookup) but no tax-specific dataset/page was checked.",
        example_question="מהו שיעור מס הרכישה הרלוונטי לעסקה כזו?",
    ),
    ResearchIntent(
        category=RECategory.GOVERNMENT_SOURCES,
        intent_id="general_gov_il_open_data",
        description="General open-data lookup on data.gov.il for any real-estate-adjacent public dataset.",
        candidate_domains=("data.gov.il",),
        confirmation="CONFIRMED_REACHABLE",
        confirmation_note="Live-checked this pass: a well-formed CKAN package_search JSON response was returned.",
        example_question="אילו מאגרי מידע ציבוריים רלוונטיים לנדל\"ן קיימים ב-data.gov.il?",
    ),
    ResearchIntent(
        category=RECategory.APPRAISAL,
        intent_id="appraisal_public_reference",
        description="Public reference material on the appraisal (שמאות) process/standards.",
        candidate_domains=("www.gov.il",),
        confirmation="UNCONFIRMED",
        confirmation_note="Not fetched this pass; grouped with the same bot-mitigation caveat as the other www.gov.il topic pages.",
        example_question="מהו התהליך הציבורי הרשמי להזמנת שמאות מקרקעין?",
    ),
)


def intents_for(category: RECategory) -> tuple[ResearchIntent, ...]:
    return tuple(i for i in RESEARCH_INTENTS if i.category is category)


# Categories with NO defined research intent yet — explicit, not silent. These
# are the categories where "public gov.il read" isn't the right source type at
# all (they are personal/business records, not government data): CONTRACTS_
# DOCUMENTS, CLIENTS_LEADS, MARKETING, DUE_DILIGENCE (a PROCESS that consumes
# several other categories' findings, not a source of its own), PROPERTIES
# (individual listings are not a gov.il concern), PROFESSIONAL_KNOWLEDGE
# (licensing/education material, not a live public-data lookup).
_NO_GOV_IL_INTENT = (
    RECategory.CONTRACTS_DOCUMENTS, RECategory.CLIENTS_LEADS, RECategory.MARKETING,
    RECategory.DUE_DILIGENCE, RECategory.PROPERTIES, RECategory.PROFESSIONAL_KNOWLEDGE,
)
