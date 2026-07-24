"""
Multi-adapter comparison report.

Loads JSON result files produced by run_bench.py and prints a side-by-side
table so you can see exactly where each adapter adds latency.

Usage:
    python3 bench/report.py bench/results/echo_*.json bench/results/claude_*.json

    # Or compare a specific pair:
    python3 bench/report.py bench/results/echo_20240101_120000.json \\
                            bench/results/claude_20240101_120100.json
"""

import json
import statistics
import sys
from pathlib import Path


STAGES = ["stt_ms", "adapter_ms", "tts_ms", "total_ms", "rtt_ms"]
STAGE_LABELS = {
    "stt_ms":      "STT",
    "adapter_ms":  "Adapter",
    "tts_ms":      "TTS",
    "total_ms":    "Total (server)",
    "rtt_ms":      "RTT (client)",
}

# Empirical baselines (Mac Studio, 2026-07-22, MockSTT+MockTTS):
#   echo  — infrastructure floor:  avg 0ms,    median 0ms,    p95 1ms,    rtt 3ms
#   claude — LLM-only latency:     avg 2691ms, median 2002ms, p95 4854ms
# Jarvis targets real-time feel; Philos tolerates deeper latency.
# STT/TTS targets apply when real providers are enabled.
KPI_TARGETS = {
    "echo":   {"total_ms": 800,   "stt_ms": 500, "tts_ms": 400},
    "claude": {"total_ms": 3500,  "stt_ms": 500, "tts_ms": 400},
    "jarvis": {"total_ms": 3500,  "stt_ms": 500, "tts_ms": 400},
    "philos": {"total_ms": 5000,  "stt_ms": 500, "tts_ms": 400},
}


def load(path: Path) -> tuple[str, list[dict]]:
    data = json.loads(path.read_text())
    return data["label"], [r for r in data["results"] if not r.get("error")]


def stats(values: list[float]) -> dict:
    if not values:
        return {}
    s = sorted(values)
    n = len(s)
    p95_idx = max(0, int(n * 0.95) - 1)
    p99_idx = max(0, int(n * 0.99) - 1)
    return {
        "avg":    round(statistics.mean(s)),
        "median": round(statistics.median(s)),
        "p95":    s[p95_idx],
        "p99":    s[p99_idx],
        "min":    s[0],
        "max":    s[-1],
        "stddev": round(statistics.pstdev(s)) if n > 1 else 0,
        "n":      n,
    }


def contributions(stage_stats: dict) -> dict[str, int]:
    """% share of STT / Adapter / TTS in total_ms (avg-based)."""
    total = (stage_stats.get("total_ms") or {}).get("avg", 0)
    if not total:
        return {}
    return {
        k: round(100 * (stage_stats[k].get("avg", 0) / total))
        for k in ("stt_ms", "adapter_ms", "tts_ms")
        if stage_stats.get(k)
    }


def spikes(values: list[float], threshold: float = 1.5) -> list[float]:
    """Returns values that are probable outliers (> median × threshold)."""
    if len(values) < 3:
        return []
    med = statistics.median(values)
    return sorted(v for v in values if v > med * threshold)


def kpi(label: str, key: str, avg: float) -> str:
    target = KPI_TARGETS.get(label, {}).get(key)
    if target is None:
        return "  "
    return "OK" if avg <= target else "!!"


_CLAUDE_LATENCY_BUDGET = 3000
_RECALL_LATENCY_BUDGET = 1500


def main():
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        print("Usage: python3 bench/report.py bench/results/echo_*.json bench/results/claude_*.json")
        sys.exit(1)

    datasets: list[tuple[str, dict[str, dict], list[dict]]] = []
    for path in paths:
        label, results = load(path)
        stage_stats = {k: stats([r[k] for r in results if k in r]) for k in STAGES}
        datasets.append((label, stage_stats, results))

    # Header
    col_w = 28
    adapter_names = [
        f"{label} (n={len(json.loads(p.read_text())['results'])})"
        for (label, _, _), p in zip(datasets, paths)
    ]

    print(f"\n{'Voice Gateway — Latency Comparison':^{10 + col_w * len(datasets)}}")
    print("═" * (10 + col_w * len(datasets)))
    print(f"  {'Stage':<12}", end="")
    for name in adapter_names:
        print(f"  {name:<{col_w - 2}}", end="")
    print()

    subheader = "  avg   med   p95   p99"
    print(f"  {'':12}", end="")
    for _ in datasets:
        print(f"  {subheader:<{col_w - 2}}", end="")
    print()
    print("─" * (12 + col_w * len(datasets)))

    for stage in STAGES:
        print(f"  {STAGE_LABELS[stage]:<12}", end="")
        for label, stage_stats, _ in datasets:
            s = stage_stats.get(stage, {})
            if not s:
                print(f"  {'n/a':<{col_w - 2}}", end="")
                continue
            kpi_mark = kpi(label, stage, s["avg"])
            cell = f"{s['avg']:>4}ms {s['median']:>4}ms {s['p95']:>4}ms {s['p99']:>4}ms  {kpi_mark}"
            print(f"  {cell:<{col_w - 2}}", end="")
        print()

    print("─" * (12 + col_w * len(datasets)))

    # Delta row
    if len(datasets) >= 2:
        totals = []
        for _, stage_stats, _ in datasets:
            s = stage_stats.get("total_ms", {})
            totals.append(s.get("avg") if s else None)

        baseline = totals[0]
        print(f"\n  Delta vs baseline:")
        for i, (label, _, _) in enumerate(datasets[1:], 1):
            if baseline is not None and totals[i] is not None:
                delta = totals[i] - baseline
                print(f"    {label}: +{delta:.0f}ms over {datasets[0][0]}")

    # Contribution %
    print(f"\n  Stage contributions (% of avg total):")
    for label, stage_stats, _ in datasets:
        c = contributions(stage_stats)
        if c:
            parts = "  ".join(
                f"{STAGE_LABELS.get(k, k)} {v}%"
                for k, v in c.items()
            )
            print(f"    {label}: {parts}")

    # Spike detection
    print(f"\n  Spike detection (> median × 1.5):")
    for label, _, results in datasets:
        spike_parts = []
        for stage in ("stt_ms", "adapter_ms", "tts_ms", "total_ms"):
            vals = [r[stage] for r in results if stage in r]
            s = spikes(vals)
            if s:
                spike_parts.append(f"{STAGE_LABELS.get(stage, stage)} {len(s)}×")
        line = ", ".join(spike_parts) if spike_parts else "none"
        print(f"    {label}: {line}")

    # STT accuracy
    print(f"\n  STT accuracy (non-empty transcripts):")
    for path, (label, _, _) in zip(paths, datasets):
        all_results = json.loads(path.read_text())["results"]
        ok = [r for r in all_results if not r.get("error")]
        with_text = [r for r in ok if r.get("transcript")]
        pct = 100 * len(with_text) // len(ok) if ok else 0
        print(f"    {label}: {len(with_text)}/{len(ok)} ({pct}%)")

    # KPI legend
    print(f"\n  KPI: OK = within target, !! = exceeds target")
    for label, targets in KPI_TARGETS.items():
        if any(d[0] == label for d in datasets):
            t_str = "  ".join(f"{k} ≤ {v}ms" for k, v in targets.items())
            print(f"    {label}: {t_str}")

    # Baseline-derived targets when echo run is present
    echo_total = None
    for label, stage_stats, _ in datasets:
        if label == "echo":
            echo_total = (stage_stats.get("total_ms") or {}).get("avg")
            break

    if echo_total is not None:
        derived_jarvis = echo_total + _CLAUDE_LATENCY_BUDGET
        derived_philos = derived_jarvis + _RECALL_LATENCY_BUDGET
        print(f"\n  Baseline-derived targets (echo floor = {echo_total}ms avg):")
        print(f"    jarvis ≤ {derived_jarvis}ms  (floor + {_CLAUDE_LATENCY_BUDGET}ms model budget)")
        print(f"    philos ≤ {derived_philos}ms  (jarvis + {_RECALL_LATENCY_BUDGET}ms recall budget)")

    print()


if __name__ == "__main__":
    main()
