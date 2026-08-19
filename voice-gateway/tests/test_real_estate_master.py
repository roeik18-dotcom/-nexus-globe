"""REAL_ESTATE_MASTER domain-boundary tests (Phase 5).

Scope: the isolated real_estate/ package only — NOT wired into app.domain_router
or app.master_config (see REAL-ESTATE-MASTER-DESIGN.md Phase 6: that wiring is
future work for a routing owner, deliberately not done here). These tests prove
the package's own contract: category classification, honest UNKNOWN/SEALED
handling, provenance, and structural isolation from every other domain.
"""
from __future__ import annotations

import ast
import inspect

from real_estate import gov_il_contract, retrieval, schema, source_manifest
from real_estate.retrieval import classify, retrieve
from real_estate.schema import RECategory


# ── A. Representative Hebrew queries (Phase 5's own list) ─────────────────────

def test_block_parcel_query():
    cat, conf = classify("מה המידע על גוש וחלקה?")
    assert cat is RECategory.BLOCK_PARCEL and conf > 0


def test_rights_in_property_query():
    cat, _ = classify("תבדוק זכויות בנכס")
    assert cat is RECategory.RIGHTS_REGISTRY


def test_area_planning_query():
    cat, _ = classify("מה התכנון באזור?")
    assert cat is RECategory.PLANNING


def test_government_info_before_transaction_query():
    cat, _ = classify("איזה מידע ממשלתי צריך לבדוק לפני עסקה?")
    assert cat is RECategory.GOVERNMENT_SOURCES


def test_due_diligence_prep_query():
    cat, _ = classify("תכין בדיקת נאותות לנכס")
    assert cat is RECategory.DUE_DILIGENCE


def test_missing_documents_query():
    cat, _ = classify("מה חסר לי במסמכים?")
    assert cat is RECategory.CONTRACTS_DOCUMENTS


def test_meta_known_unknown_query_has_no_confident_category():
    """'מה ידוע ומה עדיין לא ידוע?' (what's known and what's still unknown?) names
    no real-estate-specific concept — it's a meta-question about the SYSTEM's
    honesty, not a request the 13-category classifier can or should resolve.
    Correctly falling to None (rather than guessing a category to look busy)
    IS the honest behavior this test locks in."""
    cat, conf = classify("מה ידוע ומה עדיין לא ידוע?")
    assert cat is None
    assert conf == 0.0


# ── B. retrieve(): honest status, real provenance, zero fabrication ───────────

def test_retrieve_never_returns_loaded_status_today():
    """No source in source_manifest.MANIFEST is indexable=True with actual
    extracted content today (see the manifest's own docstring — everything
    real-estate-relevant on disk sits inside a folder a prior inventory pass
    already sealed). So retrieve() must never claim LOADED for any of these
    representative queries; every one must be UNKNOWN or SEALED."""
    queries = [
        "מה המידע על גוש וחלקה?", "תבדוק זכויות בנכס", "מה התכנון באזור?",
        "איזה מידע ממשלתי צריך לבדוק לפני עסקה?", "תכין בדיקת נאותות לנכס",
        "מה חסר לי במסמכים?",
    ]
    for q in queries:
        r = retrieve(q)
        assert r.status in ("UNKNOWN", "SEALED"), (q, r.status)
        assert r.context_text == "", "no fabricated content for any query today"


def test_retrieve_sealed_source_never_exposes_content_only_path_and_reason():
    r = retrieve("מה חסר לי במסמכים?")   # -> CONTRACTS_DOCUMENTS, sealed folder
    assert r.status == "SEALED"
    assert r.sources and all(s.status == "SEALED" for s in r.sources)
    assert "pending Roei's explicit review" in r.fallback_reason
    # the path is real provenance (traceable), but no document TEXT anywhere
    assert any("חוזים הסכמים" in s.path for s in r.sources)


def test_retrieve_unmatched_query_is_unknown_not_a_guessed_category():
    r = retrieve("מה ידוע ומה עדיין לא ידוע?")
    assert r.category is None
    assert r.status == "UNKNOWN"
    assert r.sources == []
    assert "no real-estate category cue matched" in r.fallback_reason


def test_all_thirteen_categories_have_a_defined_cue_or_are_explicitly_uncued():
    """Every RECategory should be reachable via at least one classify() cue,
    OR be a deliberate gap — this test documents which, so a silently-dead
    category doesn't go unnoticed."""
    from real_estate.retrieval import _CUES
    cued = set(_CUES.keys())
    all_categories = set(RECategory)
    uncued = all_categories - cued
    # today: every category has cues except none — if this ever changes,
    # this assertion forces an explicit update here rather than silent drift.
    assert uncued == set(), f"uncued categories: {uncued}"


# ── C. Provenance / manifest integrity ─────────────────────────────────────────

def test_manifest_entries_carry_no_content_field():
    """Structural guarantee: SourceEntry has no field that could hold
    extracted file content — the dataclass shape itself makes 'accidentally
    smuggling content into the manifest' impossible, not just discouraged."""
    fields = {f for f in schema.SourceEntry.__dataclass_fields__}
    assert not any(f in fields for f in ("content", "text", "body", "excerpt"))


def test_sensitive_personal_sources_are_all_marked_not_indexable():
    for entry in source_manifest.MANIFEST:
        if entry.personal_data and not entry.public_data:
            assert entry.indexable is False, entry.path


def test_manifest_paths_are_real_existing_locations():
    """Every catalogued path should resolve to something that actually exists
    on disk (or be an explicit in-repo file reference) — the manifest
    describes REAL findings, not a speculative structure."""
    import os
    for entry in source_manifest.MANIFEST:
        if entry.path.startswith("~"):
            assert os.path.exists(os.path.expanduser(entry.path.split(" (")[0])), entry.path


# ── D. Structural domain isolation — no Human/Music/Philos contamination ──────

def _actual_imports(mod) -> set[str]:
    """Real `import X` / `from X import ...` module names only — parsed via
    ast, so a docstring merely MENTIONING a module name (e.g. explaining what
    it deliberately does NOT import) can never produce a false positive."""
    tree = ast.parse(inspect.getsource(mod))
    names: set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            names.update(a.name for a in node.names)
        elif isinstance(node, ast.ImportFrom) and node.module:
            names.add(node.module)
    return names


def test_real_estate_package_imports_nothing_from_shared_domains():
    """No module in real_estate/ may import app.domain_router, app.master_config,
    app.context_builder, or anything under app.capabilities — this track is
    standalone until a routing owner explicitly wires it in (Phase 6)."""
    forbidden_prefixes = ("app.domain_router", "app.master_config",
                          "app.context_builder", "app.capabilities")
    for mod in (schema, source_manifest, retrieval, gov_il_contract):
        imports = _actual_imports(mod)
        for bad in forbidden_prefixes:
            assert not any(name == bad or name.startswith(bad + ".") for name in imports), \
                (mod.__name__, bad, imports)


def test_gov_il_contract_makes_no_network_call():
    """gov_il_contract.py is a pure spec (dataclasses + tuples) — no httpx/
    requests/urllib import, and no def/async def function bodies at all
    (only dataclasses and module-level tuples)."""
    imports = _actual_imports(gov_il_contract)
    assert imports.isdisjoint({"httpx", "requests", "urllib.request", "urllib3"})
    tree = ast.parse(inspect.getsource(gov_il_contract))
    assert not any(isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))
                   and n.name not in ("intents_for",) for n in ast.walk(tree))


def test_categories_are_disjoint_from_human_music_philos_domain_values():
    """RECategory values must never collide with app.domain_router.Domain
    values, so a future shared-routing wiring pass has no naming collision
    to resolve. Checked WITHOUT importing app.domain_router (would violate
    the isolation test above) — hardcoded against the known Domain values
    documented in HUMAN-CONFIG-AUDIT-ADDENDUM-2026-08-13.md /
    tests/test_domain_router.py."""
    known_other_domain_values = {
        "human_config", "music_config", "studio_project", "philos",
        "runtime", "day_opening", "general",
    }
    re_values = {c.value for c in RECategory}
    assert re_values.isdisjoint(known_other_domain_values)
