"""
Voice Gateway latency benchmark.

Sends a fixed WAV file N times over WebSocket, collects per-stage timing
from the server, and computes: avg / median / p95 / min / max.
Saves raw results to JSON for multi-adapter comparison via report.py.

Usage:
    # 1. Generate a test audio file (once):
    python bench/gen_audio.py

    # 2. Start the server with your chosen adapter:
    ADAPTER=echo  uvicorn app.main:app --host 127.0.0.1 --port 8765
    ADAPTER=claude uvicorn app.main:app --host 127.0.0.1 --port 8765

    # 3. Run the benchmark:
    python bench/run_bench.py --audio bench/test.wav --n 25 --label echo
    python bench/run_bench.py --audio bench/test.wav --n 25 --label claude

    # 4. Compare results:
    python bench/report.py bench/results/echo_*.json bench/results/claude_*.json
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
                e = "  ERR" if result["error"] else ""
                print(
                    f"  [{i+1:02d}/{n}]  "
                    f"STT {result.get('stt_ms','?'):>4}ms  "
                    f"adp {result.get('adapter_ms','?'):>4}ms  "
                    f"TTS {result.get('tts_ms','?'):>4}ms  "
                    f"total {result.get('total_ms','?'):>4}ms  "
                    f"rtt {result['rtt_ms']:>4}ms"
                    f"{e}"
                )
                if result["error"]:
                    errors += 1
            except Exception as exc:
                print(f"  [{i+1:02d}/{n}]  ERROR: {exc}")
                errors += 1

            # brief pause between turns to avoid hammering the API
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


KPI_TARGETS = {
    "echo":   {"total_ms": 800,  "stt_ms": 500,  "tts_ms": 400},
    "claude": {"total_ms": 2000, "stt_ms": 500,  "tts_ms": 400},
}


def _kpi_mark(label: str, key: str, value: float) -> str:
    target = KPI_TARGETS.get(label, {}).get(key)
    if target is None:
        return ""
    return "PASS" if value <= target else "FAIL"


def print_summary(label: str, results: list[dict]) -> None:
    ok = [r for r in results if not r.get("error")]
    if not ok:
        print("No successful results to summarize.")
        return

    stages = ["stt_ms", "adapter_ms", "tts_ms", "total_ms", "rtt_ms"]
    stats = {k: _stats([r[k] for r in ok if k in r]) for k in stages}

    print(f"\n{'─'*72}")
    print(f"  Results — {label}  ({len(ok)}/{len(results)} ok)")
    print(f"{'─'*72}")
    print(f"  {'Stage':<14} {'avg':>6} {'median':>7} {'p95':>6} {'min':>6} {'max':>6}  KPI")
    print(f"  {'─'*14} {'─'*6} {'─'*7} {'─'*6} {'─'*6} {'─'*6}  {'─'*4}")

    labels_display = {
        "stt_ms":      "STT",
        "adapter_ms":  "Adapter",
        "tts_ms":      "TTS",
        "total_ms":    "Total (server)",
        "rtt_ms":      "RTT (client)",
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
    parser.add_argument("--audio",   default="bench/test.wav", help="WAV file to send each turn")
    parser.add_argument("--n",       type=int, default=25,     help="Number of turns")
    parser.add_argument("--label",   default="run",            help="Adapter label (echo, claude, …)")
    parser.add_argument("--host",    default="127.0.0.1")
    parser.add_argument("--port",    type=int, default=8765)
    parser.add_argument("--out-dir", default="bench/results",  help="Directory for JSON results")
    args = parser.parse_args()

    audio_path = Path(args.audio)
    if not audio_path.exists():
        print(f"Audio file not found: {audio_path}")
        print("Generate one first:  python bench/gen_audio.py")
        sys.exit(1)

    results = asyncio.run(run(audio_path, args.n, args.label, args.host, args.port))
    print_summary(args.label, results)
    save_results(args.label, results, Path(args.out_dir))


if __name__ == "__main__":
    main()
