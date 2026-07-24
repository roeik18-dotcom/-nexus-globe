"""Unit tests for benchmark statistics computation."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))
from bench.report import stats, kpi, contributions, spikes


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
    assert kpi("claude", "total_ms", 3600) == "!!"  # exceeds 3500


def test_kpi_unknown_label():
    # Unknown label has no target — should not crash
    assert kpi("jarvis_future", "total_ms", 99999) == "  "


def test_kpi_unknown_stage():
    # Known label, unknown stage key
    assert kpi("echo", "unknown_stage", 500) == "  "


def test_stats_p99():
    values = list(range(1, 101))  # 1..100
    s = stats(values)
    # p99_idx = int(100 * 0.99) - 1 = 98 → value 99
    assert s["p99"] == 99


def test_stats_stddev_nonzero():
    s = stats([100, 200, 300])
    # pstdev([100,200,300]) = sqrt(20000/3) ≈ 81.65 → 82
    assert s["stddev"] == 82


def test_stats_stddev_single():
    s = stats([500])
    assert s["stddev"] == 0


def test_contributions_basic():
    stage_stats = {
        "stt_ms":     {"avg": 300},
        "adapter_ms": {"avg": 600},
        "tts_ms":     {"avg": 100},
        "total_ms":   {"avg": 1000},
    }
    c = contributions(stage_stats)
    assert c["stt_ms"] == 30
    assert c["adapter_ms"] == 60
    assert c["tts_ms"] == 10


def test_contributions_empty():
    assert contributions({"total_ms": {"avg": 0}}) == {}


def test_spikes_detects_outlier():
    # median = 706, threshold 1.5 → cutoff 1059; 1400 is a spike
    values = [700, 705, 1400, 710, 706]
    s = spikes(values)
    assert 1400 in s
    assert 700 not in s


def test_spikes_stable():
    assert spikes([700, 705, 710, 706, 708]) == []


def test_spikes_too_few():
    assert spikes([100, 200]) == []
