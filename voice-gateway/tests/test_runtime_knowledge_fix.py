"""Runtime-knowledge fix phase: master wiring, projection-never-master, studio
pollution exclusion, and domain-aware relationship-memory gating."""
import json
import openpyxl
import pytest

from app import master_config as mc


def _human_master(tmp_path, rows):
    p = tmp_path / "קונפינג-אדם-MASTER-PRODUCTION-9.9-x.xlsx"
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "MASTER_UNITS"
    ws.append(["Canonical_ID", "Atomic_ID", "Original_Text", "Source_ID", "Heading", "Semantic_State"])
    for r in rows:
        ws.append(r)
    wb.save(p)
    return p


def test_missing_master_is_unknown(monkeypatch):
    monkeypatch.setattr(mc, "human_master_path", lambda: None)
    r = mc.retrieve_human_master("x")
    assert r["status"] == "UNKNOWN" and not r["rows"]


def test_missing_columns_is_unknown(tmp_path, monkeypatch):
    p = tmp_path / "MASTER-PRODUCTION-1.0.xlsx"
    wb = openpyxl.Workbook(); ws = wb.active; ws.title = "MASTER_UNITS"
    ws.append(["Heading", "Foo"]); ws.append(["h", "bar"]); wb.save(p)
    monkeypatch.setattr(mc, "human_master_path", lambda: p)
    assert mc.retrieve_human_master("x")["status"] == "UNKNOWN"


def test_human_master_loaded_with_provenance(tmp_path, monkeypatch):
    p = _human_master(tmp_path, [["CAN-1", "AT-1", "תודעה והכרה של האדם", "SRC-1", "תודעה", "RESOLVED"]])
    monkeypatch.setattr(mc, "human_master_path", lambda: p)
    r = mc.retrieve_human_master("תודעה")
    assert r["status"] == "LOADED"
    assert r["rows"][0]["canonical_id"] == "CAN-1" and r["rows"][0]["source_id"] == "SRC-1"


def test_domain_router_human_uses_master_not_projection(tmp_path, monkeypatch):
    from app import domain_router as dr
    p = _human_master(tmp_path, [["CAN-1", "AT-1", "ערך והתמודדות אנושית", "SRC-1", "ערכים", "RESOLVED"]])
    monkeypatch.setattr(mc, "human_master_path", lambda: p)
    rr = dr._retrieve_human_config("ערכים")
    assert "MASTER" in rr.context_text and rr.sources[0].status == "LOADED"
    assert "v1 profile" not in rr.context_text        # projection never mislabeled master
    assert "Canonical_ID=CAN-1" in rr.sources[0].note


def test_domain_router_human_missing_master_returns_unknown_not_projection(monkeypatch):
    from app import domain_router as dr
    monkeypatch.setattr(mc, "human_master_path", lambda: None)
    rr = dr._retrieve_human_config("קונפיג אדם")
    assert rr.confidence == 0.0 and rr.sources[0].status == "UNKNOWN"
    assert "not returned as authoritative" in rr.fallback_reason


def _fake_pk(monkeypatch, sources):
    import project_knowledge.api as pk
    monkeypatch.setattr(pk, "answer_context",
                        lambda q, project=None, limit=6: {"status": "OK", "sources": sources})


def test_studio_pollution_excluded(monkeypatch):
    from app import domain_router as dr
    _fake_pk(monkeypatch, [
        {"path": "/x/tests/mock.py", "score": 9, "heading": "m", "line_start": 1, "line_end": 2},
        {"path": "/x/cli.py", "score": 8, "heading": "c", "line_start": 1, "line_end": 2},
        {"path": "/x/app/ThirtySecond.tsx", "score": 7, "heading": "u", "line_start": 1, "line_end": 2},
    ])
    rr = dr._retrieve_via_project_knowledge("מה מצב האולפן", project="studio", domain=dr.Domain.STUDIO_PROJECT)
    assert rr.confidence == 0.0                        # everything was code/test -> UNKNOWN
    assert "mock.py" not in rr.context_text and "cli.py" not in rr.context_text


def test_studio_keeps_real_doc_sources(monkeypatch):
    from app import domain_router as dr
    _fake_pk(monkeypatch, [
        {"path": "/x/tests/mock.py", "score": 9, "heading": "m", "line_start": 1, "line_end": 2},
        {"path": "/x/STUDIO-LEDGER.md", "score": 8, "heading": "ledger", "line_start": 1, "line_end": 9},
    ])
    rr = dr._retrieve_via_project_knowledge("אולפן", project="studio", domain=dr.Domain.STUDIO_PROJECT)
    assert "STUDIO-LEDGER.md" in rr.context_text and "mock.py" not in rr.context_text


def test_studio_meta_inventory_excluded_when_requested(monkeypatch):
    """2026-08-13 live routing audit: an unfiltered (project=None)
    STUDIO_PROJECT search for 'Ableton' surfaced docs/knowledge-inventory/*
    (meta-documentation ABOUT the knowledge base — folder maps, harvest
    manifests) at scores 6-9, presented as if it answered the question. These
    pass the doc-extension whitelist (.md/.json) so the pre-existing pollution
    filter alone doesn't catch them; exclude_meta=True must."""
    from app import domain_router as dr
    _fake_pk(monkeypatch, [
        {"path": "/x/docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md", "score": 9,
         "heading": "Music sub-classification", "line_start": 1, "line_end": 2},
        {"path": "/x/docs/knowledge-inventory/raw/harvest-learning.json", "score": 7,
         "heading": "harvest", "line_start": 1, "line_end": 2},
        {"path": "/x/STUDIO-LEDGER.md", "score": 5, "heading": "ledger", "line_start": 1, "line_end": 9},
    ])
    rr = dr._retrieve_via_project_knowledge("Ableton", project=None, domain=dr.Domain.STUDIO_PROJECT,
                                            exclude_meta=True)
    assert "knowledge-inventory" not in rr.context_text
    assert "STUDIO-LEDGER.md" in rr.context_text


def test_studio_meta_inventory_kept_without_exclude_meta(monkeypatch):
    """exclude_meta defaults to False so the PHILOS call site (which does not
    pass it) is unaffected."""
    from app import domain_router as dr
    _fake_pk(monkeypatch, [
        {"path": "/x/docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md", "score": 9,
         "heading": "h", "line_start": 1, "line_end": 2},
    ])
    rr = dr._retrieve_via_project_knowledge("x", project=None, domain=dr.Domain.PHILOS)
    assert "knowledge-inventory" in rr.context_text


def _mem(tmp_path, monkeypatch):
    import app.context_builder as cb
    data = {"memories": [
        {"key": "project_philos", "value": "philos orientation engine", "tier": "project",
         "category": "project", "importance": "high", "tags": ["philos"]},
        {"key": "project_nexus_globe", "value": "nexus-globe repo", "tier": "project",
         "category": "project", "importance": "high", "tags": ["nexus"]},
        {"key": "studio_rme", "value": "RME Babyface routing", "tier": "project",
         "category": "studio", "importance": "high", "tags": ["studio"]},
        {"key": "owner_name", "value": "Roei", "tier": "personal", "category": "person",
         "importance": "critical", "tags": []},
    ]}
    f = tmp_path / "memories.json"; f.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    monkeypatch.setattr(cb, "_RELATIONSHIP_MEMORY_FILE", f)
    return cb


def test_philos_memory_rejected_outside_philos(tmp_path, monkeypatch):
    cb = _mem(tmp_path, monkeypatch)
    out = cb.RelationshipMemoryLayer(selected_domain="studio_project", query="מה מצב האולפן").render()
    assert "orientation engine" not in out and "nexus-globe" not in out
    assert "RME Babyface" in out and "Roei" in out    # relevant non-philos memory still works


def test_philos_memory_allowed_in_philos_turn(tmp_path, monkeypatch):
    cb = _mem(tmp_path, monkeypatch)
    assert "orientation engine" in cb.RelationshipMemoryLayer(
        selected_domain="philos", query="מה חדש בפילוס").render()


def test_general_gets_no_unsolicited_philos(tmp_path, monkeypatch):
    cb = _mem(tmp_path, monkeypatch)
    out = cb.RelationshipMemoryLayer(selected_domain="general", query="מה קורה").render()
    assert "orientation engine" not in out and "nexus-globe" not in out and "Roei" in out


def test_none_domain_no_gating_backward_compat(tmp_path, monkeypatch):
    cb = _mem(tmp_path, monkeypatch)
    out = cb.RelationshipMemoryLayer(selected_domain=None).render()
    assert "orientation engine" in out                # non-merlin personas unchanged
