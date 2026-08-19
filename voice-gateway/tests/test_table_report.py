"""TABLE_REPORT — pure transform, sourcing, no fabricated cells."""

import asyncio

from app.capabilities._framework import pipeline
from app.capabilities.registry import REGISTRY

run = asyncio.run
SOURCES = [{"id": "s1", "url": "https://ex.test/1"}, {"id": "s2", "url": "https://ex.test/2"}]
BASE = {
    "title": "T", "summary": "S", "columns": ["a", "b"], "sources": SOURCES,
    "generated_at": "2026-08-12T00:00:00Z",
    "rows": [[{"value": 1, "source": "s1"}, {"value": 2, "source": "s2"}]],
}


def _run(overrides=None):
    inp = dict(BASE)
    if overrides:
        inp.update(overrides)
    return run(pipeline.execute(REGISTRY, "TABLE_REPORT", inp))


def test_valid_all_sourced_is_verified():
    sr = _run()
    assert sr.status == "accepted"
    assert sr.result["verification_status"] == "verified"
    assert sr.result["unknown_cells"] == 0
    assert sr.result["rows"][0][0] == {"value": 1, "source": "s1", "unknown": False}


def test_unknown_cell_preserved_and_partial():
    sr = _run({"rows": [[{"value": 1, "source": "s1"}, {"unknown": True}]]})
    assert sr.status == "accepted"
    assert sr.result["verification_status"] == "partial"
    assert sr.result["unknown_cells"] == 1
    assert sr.result["rows"][0][1] == {"value": None, "unknown": True}


def test_unsourced_cell_rejected_no_fabrication():
    sr = _run({"rows": [[{"value": 1, "source": "s1"}, {"value": 99}]]})  # no source
    assert sr.status == "rejected" and sr.code == "malformed_request"


def test_source_not_in_sources_rejected():
    sr = _run({"rows": [[{"value": 1, "source": "s1"}, {"value": 2, "source": "ghost"}]]})
    assert sr.status == "rejected"


def test_non_rectangular_rejected():
    sr = _run({"rows": [[{"value": 1, "source": "s1"}]]})  # 1 cell, 2 columns
    assert sr.status == "rejected"


def test_missing_generated_at_rejected():
    inp = dict(BASE)
    del inp["generated_at"]
    sr = run(pipeline.execute(REGISTRY, "TABLE_REPORT", inp))
    assert sr.status == "rejected" and sr.code == "missing_input"


def test_string_unknown_marker_accepted():
    sr = _run({"rows": [[{"value": 1, "source": "s1"}, "unknown"]]})
    assert sr.status == "accepted"
    assert sr.result["rows"][0][1]["unknown"] is True
