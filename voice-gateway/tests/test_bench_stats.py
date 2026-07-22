"""Unit tests for benchmark statistics computation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from bench.report import stats, kpi


def test_stats_basic():
    s = stats([100, 200, 300, 400, 500])
    assert s["min"] == 100
    assert s["max"] == 500
    assert s["avg"] == 300
    assert s["median"] == 300


def test_stats_p95():
    values = list(range(1, 101))  # 1..100
    s = stats(values)
    # p95 index = int(100 * 0.95) - 1 = 94 → value 95
    assert s["p95"] == 95


def test_stats_single():
    s = stats([500])
    assert s["avg"] == 500
    assert s["min"] == 500
    assert s["max"] == 500


def test_stats_empty():
    assert stats([]) == {}


def test_kpi_pass():
    assert kpi("echo", "total_ms", 700) == "OK"   # target 800
    assert kpi("claude", "total_ms", 1999) == "OK"


def test_kpi_fail():
    assert kpi("echo", "total_ms", 900) == "!!"   # exceeds 800
    assert kpi("claude", "total_ms", 2100) == "!!"


def test_kpi_unknown_label():
    # Unknown label has no target — should not crash
    assert kpi("jarvis_future", "total_ms", 99999) == "  "


def test_kpi_unknown_stage():
    # Known label, unknown stage key
    assert kpi("echo", "unknown_stage", 500) == "  "
