"""REAL_ESTATE_MASTER — category taxonomy + result/provenance shapes.

Mirrors the existing domain-retrieval contract (app.domain_router.RouteResult /
SourceRef, app.master_config's provenance dict) closely enough that a future
wiring pass is a thin adapter, not a redesign — without importing anything
from app.* (this package is intentionally standalone until a routing owner
wires it in; see REAL-ESTATE-MASTER-DESIGN.md Phase 6).
"""
from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum


class RECategory(str, Enum):
    PROPERTIES = "properties"                    # 01 — נכסים
    BLOCK_PARCEL = "block_parcel"                 # 02 — גוש חלקה
    PLANNING = "planning"                         # 03 — תכנון ובנייה
    RIGHTS_REGISTRY = "rights_registry"           # 04 — טאבו / זכויות
    TAXES_LEVIES = "taxes_levies"                 # 05 — מיסוי והיטלים
    TRANSACTIONS_PRICES = "transactions_prices"   # 06 — עסקאות ומחירים
    APPRAISAL = "appraisal"                       # 07 — שמאות
    CONTRACTS_DOCUMENTS = "contracts_documents"   # 08 — חוזים ומסמכים
    CLIENTS_LEADS = "clients_leads"               # 09 — לקוחות ולידים
    MARKETING = "marketing"                       # 10 — שיווק נכסים
    GOVERNMENT_SOURCES = "government_sources"     # 11 — מקורות ממשלתיים
    DUE_DILIGENCE = "due_diligence"                # 12 — בדיקת נאותות
    PROFESSIONAL_KNOWLEDGE = "professional_knowledge"  # 13 — ידע מקצועי


class Authority(str, Enum):
    """Where a fact would ultimately come from, if/when this category is
    populated — never a claim that it currently IS populated."""
    GOVERNMENT_PUBLIC = "government_public"   # gov.il / data.gov.il, read-only
    PERSONAL_RECORD = "personal_record"        # Roei's own notes/docs/contracts
    THIRD_PARTY_PUBLIC = "third_party_public"  # listing sites, bookmarks
    UNKNOWN = "unknown"


@dataclass
class SourceEntry:
    """One catalogued source location — PATH/METADATA ONLY. Never carries
    extracted file content; that is a deliberate boundary, not an oversight
    (see REAL-ESTATE-MASTER-DESIGN.md 'Sensitivity decision')."""
    path: str
    category: RECategory
    source_type: str            # e.g. "folder", "docx", "txt", "bookmarks_json"
    authority: Authority
    personal_data: bool
    public_data: bool
    indexable: bool             # True only once content has been reviewed/approved
    duplicate_risk: str         # "none" | "low" | description
    freshness: str              # last-known mtime or "unknown"
    note: str = ""


@dataclass
class SourceRef:
    """Provenance for one retrieved unit — same shape as
    app.domain_router.SourceRef by convention, kept separate to avoid an
    app.* import from this standalone package."""
    path: str
    status: str          # FOUND | MISSING | SEALED | UNKNOWN
    note: str = ""


@dataclass
class StructuredResult:
    category: RECategory | None   # None = no category cue matched at all
    query: str
    status: str                     # LOADED | UNKNOWN | SEALED
    context_text: str = ""
    sources: list[SourceRef] = field(default_factory=list)
    fallback_reason: str = ""
