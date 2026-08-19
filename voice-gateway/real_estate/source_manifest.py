"""REAL_ESTATE_MASTER — Phase 1 source manifest.

PATH/METADATA ONLY. No file in this manifest has had its content read, OCR'd,
or copied here — every real-estate-tagged source found on disk today sits
inside the SAME Dropbox tree (`—קונפינג אישי—.../{חוזים הסכמים, חשבוניות,
תיווך}`) that a prior, independent inventory pass
(docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md, and its raw harvest note in
docs/knowledge-inventory/raw/harvest-other.json) explicitly excluded and
sealed: "Sensitive subfolders (חוזים הסכמים, חשבוניות, תיווך, בשמים, תמונות*,
Camera) were excluded from the find and never opened." This manifest respects
and continues that same boundary rather than re-deciding it — see
REAL-ESTATE-MASTER-DESIGN.md, "Sensitivity decision".

Every entry below therefore has `indexable=False`: this manifest catalogues
WHERE real-estate-relevant material exists, not WHAT it says. Turning any
entry to `indexable=True` is a decision for Roei to make explicitly, per
source, not something this pass does unilaterally.
"""
from __future__ import annotations

from .schema import Authority, RECategory, SourceEntry

_DROPBOX_TIVUCH = ("~/Library/CloudStorage/Dropbox/----text----/"
                   "—קונפינג אישי—ניהול אישי קולקטיבי  שוטף/תיווך")
_DROPBOX_CONTRACTS = ("~/Library/CloudStorage/Dropbox/----text----/"
                      "—קונפינג אישי—ניהול אישי קולקטיבי  שוטף/חוזים הסכמים")
_DROPBOX_INVOICES = ("~/Library/CloudStorage/Dropbox/----text----/"
                     "—קונפינג אישי—ניהול אישי קולקטיבי  שוטף/חשבוניות")

MANIFEST: tuple[SourceEntry, ...] = (
    # ── 13_PROFESSIONAL_KNOWLEDGE ──────────────────────────────────────────
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/הכנה לבחינת מתווכים.docx",
        category=RECategory.PROFESSIONAL_KNOWLEDGE,
        source_type="docx", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="none", freshness="2020-04-17",
        note="Filename only: 'broker licensing exam preparation'. Strong signal "
             "Roei studied for the Israeli real-estate broker's exam (רישיון תיווך) "
             "— this is the strongest evidence this is a real professional track, "
             "not casual browsing.",
    ),
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/מדריך קנית דירה.rtf",
        category=RECategory.PROFESSIONAL_KNOWLEDGE,
        source_type="rtf", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="duplicate copies also exist under "
                       "'1.rtfd/מדריך קנית דירה.pdf' and 'תזכוות אייפון.../מדריך קנית דירה.pdf' "
                       "(same title, different folders/formats — not de-duplicated).",
        freshness="2022-01-28",
        note="'Apartment-buying guide'. Could be a personal reference doc or "
             "professional study material — filename alone doesn't disambiguate.",
    ),
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/תיווך סוגי פירסומים.txt",
        category=RECategory.MARKETING,
        source_type="txt", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="none", freshness="2022-02-02",
        note="'Brokerage — types of listings/publications' — likely marketing-channel notes.",
    ),
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/תיווך ומשימות להיום.txt",
        category=RECategory.CLIENTS_LEADS,
        source_type="txt", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="none", freshness="2021-11-16",
        note="'Brokerage and today's tasks' — likely operational/lead-follow-up notes; "
             "may name real clients/prospects, so treated as personal data by default.",
    ),
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/כניסה לקבוצות רכישה.webloc",
        category=RECategory.CLIENTS_LEADS,
        source_type="webloc (bookmark pointer, no content)", authority=Authority.THIRD_PARTY_PUBLIC,
        personal_data=False, public_data=True, indexable=False,
        duplicate_risk="none", freshness="2022-03-16",
        note="Bookmark to a 'buyer purchase groups' (קבוצות רכישה) resource — a real "
             "Israeli real-estate concept (off-plan group buying). Pointer only, no "
             "content extracted; not indexable=True until the target URL is confirmed live.",
    ),
    # ── 01_PROPERTIES ───────────────────────────────────────────────────────
    SourceEntry(
        path=f"{_DROPBOX_TIVUCH}/תיווך תמונות/",
        category=RECategory.PROPERTIES,
        source_type="folder of photos, 5 address-named subfolders", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="none", freshness="2024-06-12",
        note="Subfolders named by street address (אברבנאל 66, השוק 40, פלורנטין 26, "
             "פלורנטין 38, קורדבור 1 אירית) — almost certainly real listing photo sets "
             "for specific properties. Real addresses = real PII-adjacent data; not "
             "opened, not enumerated further than the folder names already visible "
             "in a directory listing.",
    ),
    # ── 08_CONTRACTS_DOCUMENTS ──────────────────────────────────────────────
    SourceEntry(
        path=_DROPBOX_CONTRACTS,
        category=RECategory.CONTRACTS_DOCUMENTS,
        source_type="folder: 5 docx/pdf/rtf files", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="2 exact near-duplicate pairs by filename+size ('הסכם - אוסי.docx' "
                       "vs '(1)' copy; the event-venue rental PDF vs its 'עותק של' copy).",
        freshness="2021-12-19 to 2022-06-28",
        note="Filenames suggest a personal-name agreement and an event-venue rental "
             "agreement (חוות אירועים אירוס הגליל) — NOT confirmed to be real-estate-"
             "brokerage transaction contracts specifically; catalogued here on the "
             "conservative assumption they might be, pending actual review.",
    ),
    # ── uncertain-category / cross-domain: catalogued, not force-fit ───────
    SourceEntry(
        path=_DROPBOX_INVOICES,
        category=RECategory.TAXES_LEVIES,   # best-fit bucket, not a confirmed classification
        source_type="folder: ~40 pdf/jpg/png files + 1 dated subfolder", authority=Authority.PERSONAL_RECORD,
        personal_data=True, public_data=False, indexable=False,
        duplicate_risk="unknown — not reviewed", freshness="2021-08-03 to 2023-04-19",
        note="General personal invoices/receipts folder. Filenames give no signal that "
             "this is real-estate-specific (vs. general personal/freelance bookkeeping) "
             "— flagged as UNCERTAIN RELEVANCE rather than assumed in-scope.",
    ),
    # ── 06_TRANSACTIONS_PRICES / 10_MARKETING (aggregate reference, no copy) ─
    SourceEntry(
        path="voice-gateway/state/bookmark_audit_snapshot.json (folder_path == "
             "['סימניות אחרות'|'BookmarksBar', 'תיווך'])",
        category=RECategory.MARKETING,
        source_type="json (already in-repo, machine-readable)", authority=Authority.THIRD_PARTY_PUBLIC,
        personal_data=True, public_data=True, indexable=True,
        duplicate_risk="low — bookmark records, not property records; a URL may be "
                       "bookmarked more than once",
        freshness="see file's own generated_at field",
        note="31 browser bookmarks tagged 'תיווך': public listing/portal URLs (Yad2, "
             "independent brokerage sites, a Facebook rental-listings group, an "
             "off-plan 'apartment fundraising' tracking sheet). This is the ONE source "
             "in this manifest already indexable=True in principle — it's Roei's saved "
             "links to PUBLIC pages, not third-party client records — but this pass "
             "references the existing file rather than copying its 31 URLs into a new "
             "committed file (see design doc: 'reference, don't copy').",
    ),
    # ── meta / cross-reference ──────────────────────────────────────────────
    SourceEntry(
        path="docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md",
        category=RECategory.DUE_DILIGENCE,
        source_type="md (already in-repo)", authority=Authority.PERSONAL_RECORD,
        personal_data=False, public_data=False, indexable=True,
        duplicate_risk="none", freshness="prior session, undated in-file",
        note="The prior inventory pass that first classified-by-path (never opened) "
             "the חוזים הסכמים/חשבוניות/תיווך folders as sensitive Finance/Legal, "
             "sealed from Merlin. This manifest is a continuation of that decision, "
             "not a re-derivation of it.",
    ),
)


def entries_for(category: RECategory) -> tuple[SourceEntry, ...]:
    return tuple(e for e in MANIFEST if e.category is category)


def indexable_entries() -> tuple[SourceEntry, ...]:
    return tuple(e for e in MANIFEST if e.indexable)
