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

KPI_TARGETS = {
    "echo":   {"total_ms": 800,  "stt_ms": 500,  "tts_ms": 400},
    "claude": {"total_ms": 2000, "stt_ms": 500,  "tts_ms": 400},
    "jarvis": {"total_ms": 1500, "stt_ms": 500,  "tts_ms": 400},
    "philos": {"total_ms": 2000, "stt_ms": 500,  "tts_ms": 400},
}


def load(path: Path) -> tuple[str, list[dict]]:
    data = json.loads(path.read_text())
    return data["label"], [r for r in data["results"] if not r.get("error")]


def stats(values: list[float]) -> dict:
    if not values:
        return {}
    s = sorted(values)
    p95_idx = max(0, int(len(s) * 0.95) - 1)
    return {
        "avg":    round(statistics.mean(s)),
        "median": round(statistics.median(s)),
        "p95":    s[p95_idx],
        "min":    s[0],
        "max":    s[-1],
    }


def kpi(label: str, key: str, avg: float) -> str:
    target = KPI_TARGETS.get(label, {}).get(key)
    if target is None:
        return "  "
    return "OK" if avg <= target else "!!"


def main():
    paths = [Path(p) for p in sys.argv[1:]]
    if not paths:
        print("Usage: python3 bench/report.py bench/results/echo_*.json bench/results/claude_*.json")
        sys.exit(1)

    datasets: list[tuple[str, dict[str, dict]]] = []
    for path in paths:
        label, results = load(path)
        stage_stats = {k: stats([r[k] for r in results if k in r]) for k in STAGES}
        datasets.append((label, stage_stats))

    # Header
    col_w = 22
    adapter_names = [f"{label} (n={len(json.loads(p.read_text())['results'])})"
                     for label, p in zip([d[0] for d in datasets], paths)]

    print(f"\n{'Voice Gateway — Latency Comparison':^{10 + col_w * len(datasets)}}")
    print("═" * (10 + col_w * len(datasets)))
    print(f"  {'Stage':<12}", end="")
    for name in adapter_names:
        print(f"  {name:<{col_w - 2}}", end="")
    print()

    subheader = "  avg   med   p95"
    print(f"  {'':12}", end="")
    for _ in datasets:
        print(f"  {subheader:<{col_w - 2}}", end="")
    print()
    print("─" * (12 + col_w * len(datasets)))

    for stage in STAGES:
        print(f"  {STAGE_LABELS[stage]:<12}", end="")
        for label, stage_stats in datasets:
            s = stage_stats.get(stage, {})
            if not s:
                print(f"  {'n/a':<{col_w - 2}}", end="")
                continue
            kpi_mark = kpi(label, stage, s["avg"])
            cell = f"{s['avg']:>4}ms {s['median']:>4}ms {s['p95']:>4}ms  {kpi_mark}"
            print(f"  {cell:<{col_w - 2}}", end="")
        print()

    print("─" * (12 + col_w * len(datasets)))

    # Delta row: adapter cost = total(claude) - total(echo)
    if len(datasets) >= 2:
        totals = []
        for _, stage_stats in datasets:
            s = stage_stats.get("total_ms", {})
            totals.append(s.get("avg") if s else None)

        baseline = totals[0]
        print(f"\n  {'Delta vs baseline':}")
        for i, (label, _) in enumerate(datasets[1:], 1):
            if baseline is not None and totals[i] is not None:
                delta = totals[i] - baseline
                print(f"    {label}: +{delta:.0f}ms over {datasets[0][0]}")

    # STT accuracy row
    print(f"\n  STT accuracy (non-empty transcripts):")
    for path, (label, _) in zip(paths, datasets):
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

    print()


if __name__ == "__main__":
    main()
