"""
Voice Gateway latency benchmark.

Sends a fixed WAV file N times over WebSocket, collects per-stage timing
from the server, and computes: avg / median / p95 / min / max.
Saves raw results to JSON for multi-adapter comparison via report.py.

Usage:
    # 1. Generate a test audio file (once):
    python3 bench/gen_audio.py

    # 2. Start the server with your chosen adapter:
    ADAPTER=echo  uvicorn app.main:app --host 127.0.0.1 --port 8765
    ADAPTER=claude uvicorn app.main:app --host 127.0.0.1 --port 8765

    # 3. Run the benchmark:
    python3 bench/run_bench.py --audio bench/test.wav --n 25 --label echo
    python3 bench/run_bench.py --audio bench/test.wav --n 25 --label claude

    # 4. Compare results:
    python3 bench/report.py bench/results/echo_*.json bench/results/claude_*.json
"""

import argparse
import asyncio
import json
import statistics
import sys
import time
from datetime import datetime
from pathlib import Path

try:
    import websockets
except ImportError:
    print("pip install websockets")
    sys.exit(1)


async def _one_turn(ws, audio_bytes: bytes) -> dict:
    """
    Send one audio clip, return timing dict with:
      stt_ms, adapter_ms, tts_ms, total_ms   (server-side, from timing frame)
      rtt_ms                                  (client-side: end_of_speech → done)
    """
    audio_chunks: list[bytes] = []
    timing: dict = {}
    transcript: str = ""
    error: str | None = None

    t_send = time.perf_counter()
    await ws.send(audio_bytes)
    await ws.send(json.dumps({"type": "end_of_speech"}))

    while True:
        raw = await asyncio.wait_for(ws.recv(), timeout=30)

        if isinstance(raw, bytes):
            audio_chunks.append(raw)
            continue

        msg = json.loads(raw)
        t = msg.get("type")

        if t == "transcript":
            transcript = msg.get("text", "")
        elif t == "timing":
            timing = msg["stages"]
        elif t == "error":
            error = msg.get("message")
        elif t == "done":
            break
        elif t == "expired":
            raise RuntimeError("session expired during benchmark")

    rtt_ms = round((time.perf_counter() - t_send) * 1000)
    return {
        **timing,
        "rtt_ms": rtt_ms,
        "transcript": transcript,
        "audio_out_bytes": sum(len(c) for c in audio_chunks),
        "error": error,
    }


def _fmt_turn(i: int, n: int, result: dict) -> str:
    e = "  ERR" if result.get("error") else ""
    pre = result.get('pre_llm_ms', '—')
    llm = result.get('llm_first_token_ms', '—')
    ttft = result.get('adapter_first_token_ms', '—')
    ttfa = result.get('time_to_first_audio_ms', '—')
    total = result.get('total_ms', '—')
    rtt = result.get('rtt_ms', '—')
    return (
        f"  [{i+1:02d}/{n}]  "
        f"pre {pre:>5}ms  "
        f"LLM-TTFT {llm:>5}ms  "
        f"TTFT {ttft:>5}ms  "
        f"TTFA {ttfa:>5}ms  "
        f"total {total:>5}ms  "
        f"rtt {rtt:>5}ms"
        f"{e}"
    )


async def run(audio_path: Path, n: int, label: str, host: str, port: int) -> list[dict]:
    audio_bytes = audio_path.read_bytes()
    uri = f"ws://{host}:{port}/ws/voice"

    results: list[dict] = []
    errors = 0

    print(f"\nBenchmark: {label}  |  {n} turns  |  {len(audio_bytes):,} bytes/turn")
    print(f"Server:    {uri}")
    print(f"Audio:     {audio_path}\n")

    async with websockets.connect(uri) as ws:
        # consume session_start
        raw = await ws.recv()
        session = json.loads(raw)
        print(f"Session:   {session.get('session_id', '?')}\n")

        for i in range(n):
            try:
                result = await _one_turn(ws, audio_bytes)
                results.append(result)
                print(_fmt_turn(i, n, result))
                if result["error"]:
                    errors += 1
            except Exception as exc:
                print(f"  [{i+1:02d}/{n}]  ERROR: {exc}")
                errors += 1

            # brief pause between turns to avoid hammering the API
            await asyncio.sleep(0.3)

    print(f"\n{n - errors}/{n} turns succeeded  ({errors} errors)")
    return results


async def run_fresh(audio_path: Path, n: int, label: str, host: str, port: int) -> list[dict]:
    """Fresh-session mode: each turn uses an independent WebSocket session.

    Eliminates context-growth effects (summary overhead, history length) so each
    turn is measured in identical conditions — useful for isolating cold-start latency.
    """
    audio_bytes = audio_path.read_bytes()
    uri = f"ws://{host}:{port}/ws/voice"
    results: list[dict] = []
    errors = 0

    print(f"\nBenchmark (fresh-session): {label}  |  {n} turns  |  {len(audio_bytes):,} bytes/turn")
    print(f"Server:    {uri}")
    print(f"Audio:     {audio_path}\n")

    for i in range(n):
        try:
            async with websockets.connect(uri) as ws:
                raw = await ws.recv()
                session = json.loads(raw)
                if i == 0:
                    print(f"First session: {session.get('session_id', '?')}\n")
                result = await _one_turn(ws, audio_bytes)
                results.append(result)
                print(_fmt_turn(i, n, result))
                if result["error"]:
                    errors += 1
        except Exception as exc:
            print(f"  [{i+1:02d}/{n}]  ERROR: {exc}")
            errors += 1

        await asyncio.sleep(0.3)

    print(f"\n{n - errors}/{n} turns succeeded  ({errors} errors)")
    return results


def _stats(values: list[float]) -> dict:
    if not values:
        return {}
    s = sorted(values)
    p95_idx = int(len(s) * 0.95)
    return {
        "avg":    round(statistics.mean(s)),
        "median": round(statistics.median(s)),
        "p95":    round(s[min(p95_idx, len(s) - 1)]),
        "min":    round(s[0]),
        "max":    round(s[-1]),
        "n":      len(s),
    }


# Empirical baselines (Mac Studio, MockSTT+MockTTS):
#   2026-07-22 — echo: avg 0ms, p95 1ms, rtt 3ms
#                claude: avg 2691ms, median 2002ms, p95 4854ms (single-session, 5 turns)
#   2026-07-24 — echo: avg 0ms, p95 1ms
#                claude: avg 5478ms, median 5826ms, p95 8237ms (10 turns, history growth)
#
# With streaming pipeline, the key metric shifts to TTFT / TTFA rather than total.
# STT/TTS targets apply only when real providers are enabled.
KPI_TARGETS = {
    "echo": {
        "total_ms":              10,
        "time_to_first_audio_ms": 10,
    },
    "claude": {
        "adapter_first_token_ms":  1200,
        "time_to_first_audio_ms":  1800,
        "total_ms":                9000,
    },
    "jarvis": {
        "adapter_first_token_ms":  1200,
        "time_to_first_audio_ms":  1800,
        "total_ms":                9000,
    },
    "philos": {
        "adapter_first_token_ms":  1500,
        "time_to_first_audio_ms":  2500,
        "total_ms":               12000,
    },
}


def _kpi_targets_for(label: str) -> dict:
    """Return KPI targets for label, falling back to base name before first '-' or '_'."""
    if label in KPI_TARGETS:
        return KPI_TARGETS[label]
    base = label.replace("_", "-").split("-")[0]
    return KPI_TARGETS.get(base, {})


def _kpi_mark(label: str, key: str, value: float) -> str:
    target = _kpi_targets_for(label).get(key)
    if target is None:
        return ""
    return "PASS" if value <= target else "FAIL"


def print_summary(label: str, results: list[dict]) -> None:
    ok = [r for r in results if not r.get("error")]
    if not ok:
        print("No successful results to summarize.")
        return

    stages = [
        "stt_ms",
        "pre_llm_ms",
        "llm_first_token_ms",
        "adapter_first_token_ms",
        "first_sentence_ready_ms",
        "time_to_first_audio_ms",
        "adapter_ms",
        "tts_ms",
        "total_ms",
        "summary_ms",
        "rtt_ms",
    ]
    stats = {k: _stats([r[k] for r in ok if k in r]) for k in stages}

    print(f"\n{'─'*78}")
    print(f"  Results — {label}  ({len(ok)}/{len(results)} ok)")
    print(f"{'─'*78}")
    print(f"  {'Stage':<22} {'avg':>6} {'median':>7} {'p95':>6} {'min':>6} {'max':>6}  KPI")
    print(f"  {'─'*22} {'─'*6} {'─'*7} {'─'*6} {'─'*6} {'─'*6}  {'─'*4}")

    labels_display = {
        "stt_ms":                   "STT",
        "pre_llm_ms":               "Pre-LLM overhead",
        "llm_first_token_ms":       "LLM TTFT (network)",
        "adapter_first_token_ms":   "TTFT (combined)",
        "first_sentence_ready_ms":  "1st sentence ready",
        "time_to_first_audio_ms":   "TTFA (first audio)",
        "adapter_ms":               "Adapter (full)",
        "tts_ms":                   "TTS (cumulative)",
        "total_ms":                 "Total (server)",
        "summary_ms":               "BG summary (prev)",
        "rtt_ms":                   "RTT (client)",
    }
    for k in stages:
        s = stats.get(k, {})
        if not s:
            continue
        mark = _kpi_mark(label, k, s["avg"])
        mark_str = f"{'✓' if mark == 'PASS' else '✗' if mark == 'FAIL' else ' ':>4}" if mark else ""
        print(
            f"  {labels_display[k]:<14} "
            f"{s['avg']:>5}ms "
            f"{s['median']:>6}ms "
            f"{s['p95']:>5}ms "
            f"{s['min']:>5}ms "
            f"{s['max']:>5}ms"
            f"  {mark_str}"
        )

    # STT accuracy (non-empty transcripts)
    transcripts = [r["transcript"] for r in ok if r.get("transcript")]
    print(f"\n  STT non-empty: {len(transcripts)}/{len(ok)} ({100*len(transcripts)//len(ok) if ok else 0}%)")
    if transcripts:
        print(f"  Sample:  {transcripts[0][:80]!r}")
    print(f"{'─'*72}\n")


def save_results(label: str, results: list[dict], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = out_dir / f"{label}_{stamp}.json"
    path.write_text(json.dumps({"label": label, "results": results}, indent=2))
    print(f"Saved: {path}")
    return path


def main():
    parser = argparse.ArgumentParser(description="Voice Gateway latency benchmark")
    parser.add_argument("--audio",         default="bench/test.wav", help="WAV file to send each turn")
    parser.add_argument("--n",             type=int, default=25,     help="Number of turns")
    parser.add_argument("--label",         default="run",            help="Adapter label (echo, claude, …)")
    parser.add_argument("--host",          default="127.0.0.1")
    parser.add_argument("--port",          type=int, default=8765)
    parser.add_argument("--out-dir",       default="bench/results",  help="Directory for JSON results")
    parser.add_argument("--fresh-session", action="store_true",
                        help="Each turn uses an independent WebSocket session (no history growth)")
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}")
        print("Generate one first:  python3 bench/gen_audio.py")
        sys.exit(1)

    runner = run_fresh if args.fresh_session else run
    results = asyncio.run(runner(audio_path, args.n, args.label, args.host, args.port))
    print_summary(args.label, results)
    save_results(args.label, results, Path(args.out_dir))


if __name__ == "__main__":
    main()
