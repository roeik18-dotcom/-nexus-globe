"""
In-process pipeline benchmark — no WebSocket server required.

Measures STT → adapter → TTS latency in-process, bypassing the WebSocket layer.
Results are saved in the same JSON format as run_bench.py for use with report.py.

Usage (from voice-gateway/):
    # Generate audio files first (macOS):
    python bench/gen_audio.py --all

    # Benchmark one mode:
    python bench/direct_bench.py --mode echo
    python bench/direct_bench.py --mode jarvis
    python bench/direct_bench.py --mode philos

    # All three in sequence:
    python bench/direct_bench.py --mode all

    # Compare:
    python bench/report.py bench/results/echo_*.json \\
                           bench/results/jarvis_*.json \\
                           bench/results/philos_*.json

Environment (same vars as the server):
    STT_PROVIDER=whisper        (default) or mock
    TTS_PROVIDER=system         (macOS say, default) or openai or mock
    OPENAI_API_KEY=sk-...       required for whisper STT / openai TTS
    ANTHROPIC_API_KEY=sk-ant-...  required for jarvis / philos modes
"""

import argparse
import asyncio
import io
import json
import math
import struct
import sys
import time
import uuid
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.router import build_stt, build_tts
from bench.report import kpi, stats

_MODES = ["echo", "jarvis", "philos"]


def _build_adapter(mode: str):
    if mode == "echo":
        from app.adapters.echo import EchoAdapter
        return EchoAdapter()
    if mode in ("jarvis", "philos"):
        from app.router import _valid_anthropic_key
        from app.config import settings
        if not _valid_anthropic_key(settings.anthropic_api_key):
            raise ValueError(
                f"ANTHROPIC_API_KEY is missing or invalid — required for --mode {mode}"
            )
        from app.adapters.claude import ClaudeAdapter
        return ClaudeAdapter(persona=mode)
    raise ValueError(f"Unknown mode {mode!r}. Choose: {', '.join(_MODES)}")


def _sine_wav(duration: float = 2.0, sample_rate: int = 16_000) -> bytes:
    """440 Hz tone fallback WAV — latency testable, not STT-accurate."""
    n = int(sample_rate * duration)
    data_size = n * 2
    buf = io.BytesIO()
    buf.write(b"RIFF"); buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE"); buf.write(b"fmt "); buf.write(struct.pack("<I", 16))
    buf.write(struct.pack("<H", 1)); buf.write(struct.pack("<H", 1))
    buf.write(struct.pack("<I", sample_rate)); buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2)); buf.write(struct.pack("<H", 16))
    buf.write(b"data"); buf.write(struct.pack("<I", data_size))
    for i in range(n):
        buf.write(struct.pack("<h", int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate))))
    return buf.getvalue()


def _load_audio_files(audio_dir: Path) -> list[Path]:
    if not audio_dir.exists():
        return []
    return sorted(audio_dir.glob("*.wav")) + sorted(audio_dir.glob("*.mp3"))


async def _run_turn(stt, adapter, tts, audio_bytes: bytes, session_id: str) -> dict:
    t0 = time.perf_counter()

    try:
        transcript = await stt.transcribe(audio_bytes)
    except Exception as exc:
        return {
            "error": f"STT: {exc}", "stt_ms": 0, "adapter_ms": 0,
            "tts_ms": 0, "total_ms": 0, "rtt_ms": 0,
            "transcript": "", "audio_out_bytes": 0,
        }
    t_stt = time.perf_counter()

    parts: list[str] = []
    try:
        async for chunk in adapter.respond(transcript or "(silence)", session_id):
            parts.append(chunk)
    except Exception as exc:
        stt_ms = round((t_stt - t0) * 1000)
        return {
            "error": f"adapter: {exc}", "stt_ms": stt_ms, "adapter_ms": 0,
            "tts_ms": 0, "total_ms": stt_ms, "rtt_ms": stt_ms,
            "transcript": transcript, "audio_out_bytes": 0,
        }
    t_adapter = time.perf_counter()

    try:
        audio_out = await tts.synthesize("".join(parts))
    except Exception as exc:
        stt_ms = round((t_stt - t0) * 1000)
        adp_ms = round((t_adapter - t_stt) * 1000)
        return {
            "error": f"TTS: {exc}", "stt_ms": stt_ms, "adapter_ms": adp_ms,
            "tts_ms": 0, "total_ms": stt_ms + adp_ms, "rtt_ms": stt_ms + adp_ms,
            "transcript": transcript, "audio_out_bytes": 0,
        }
    t_tts = time.perf_counter()

    stt_ms     = round((t_stt - t0) * 1000)
    adapter_ms = round((t_adapter - t_stt) * 1000)
    tts_ms     = round((t_tts - t_adapter) * 1000)
    total_ms   = round((t_tts - t0) * 1000)
    return {
        "stt_ms":         stt_ms,
        "adapter_ms":     adapter_ms,
        "tts_ms":         tts_ms,
        "total_ms":       total_ms,
        "rtt_ms":         total_ms,
        "transcript":     transcript,
        "audio_out_bytes": len(audio_out) if audio_out else 0,
        "error":          None,
    }


async def _run_mode(mode: str, audio_files: list[Path], n: int, fallback: bytes) -> list[dict]:
    stt = build_stt()
    tts = build_tts()
    try:
        adapter = _build_adapter(mode)
    except ValueError as exc:
        print(f"\n  SKIP {mode}: {exc}")
        return []

    print(f"\nBenchmark: {mode}  |  {n} turns  |  stt={stt.name}  tts={tts.name}")
    if audio_files:
        print(f"Audio:     {len(audio_files)} file(s) in rotation")
    else:
        print("Audio:     sine-wave fallback (latency only — STT accuracy unreliable)")

    results: list[dict] = []
    errors = 0

    for i in range(n):
        audio = audio_files[i % len(audio_files)].read_bytes() if audio_files else fallback
        session_id = f"bench_{mode}_{uuid.uuid4().hex[:8]}"
        r = await _run_turn(stt, adapter, tts, audio, session_id)
        results.append(r)

        if r.get("error"):
            errors += 1
            print(f"  [{i+1:02d}/{n}]  ERR  {r['error']}")
        else:
            print(
                f"  [{i+1:02d}/{n}]  "
                f"STT {r['stt_ms']:>4}ms  "
                f"adp {r['adapter_ms']:>4}ms  "
                f"TTS {r['tts_ms']:>4}ms  "
                f"total {r['total_ms']:>4}ms  "
                f"| {r['transcript'][:40]!r}"
            )

    print(f"\n{n - errors}/{n} turns ok  ({errors} errors)")
    return results


def _print_summary(label: str, results: list[dict]) -> None:
    ok = [r for r in results if not r.get("error")]
    if not ok:
        return

    stage_keys = ["stt_ms", "adapter_ms", "tts_ms", "total_ms"]
    stage_stats = {k: stats([r[k] for r in ok if k in r]) for k in stage_keys}
    labels_display = {"stt_ms": "STT", "adapter_ms": "Adapter", "tts_ms": "TTS", "total_ms": "Total"}

    print(f"\n{'─'*70}")
    print(f"  Results — {label}  ({len(ok)}/{len(results)} ok)")
    print(f"{'─'*70}")
    print(f"  {'Stage':<14} {'avg':>5} {'median':>7} {'p95':>6} {'min':>5} {'max':>5}  KPI")
    print(f"  {'─'*14} {'─'*5} {'─'*7} {'─'*6} {'─'*5} {'─'*5}  {'─'*3}")
    for k in stage_keys:
        s = stage_stats.get(k)
        if not s:
            continue
        mark = kpi(label, k, s["avg"])
        sym = "✓" if mark == "OK" else "✗" if mark == "!!" else ""
        print(
            f"  {labels_display[k]:<14} "
            f"{s['avg']:>4}ms "
            f"{s['median']:>6}ms "
            f"{s['p95']:>5}ms "
            f"{s['min']:>4}ms "
            f"{s['max']:>4}ms"
            f"  {sym}"
        )

    transcripts = [r["transcript"] for r in ok if r.get("transcript")]
    print(f"\n  STT non-empty: {len(transcripts)}/{len(ok)}")
    if transcripts:
        print(f"  Sample:  {transcripts[0][:80]!r}")
    print(f"{'─'*70}\n")


def _save(label: str, results: list[dict], out_dir: Path) -> Path:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    path = out_dir / f"{label}_{stamp}.json"
    path.write_text(json.dumps({"label": label, "results": results}, indent=2))
    print(f"Saved: {path}")
    return path


async def _main_async(args) -> None:
    audio_dir = Path(args.audio_dir)
    audio_files = _load_audio_files(audio_dir)
    fallback = _sine_wav()
    out_dir = Path(args.out_dir)

    modes = _MODES if args.mode == "all" else [args.mode]
    saved: list[Path] = []

    for mode in modes:
        results = await _run_mode(mode, audio_files, args.n, fallback)
        if results:
            _print_summary(mode, results)
            saved.append(_save(mode, results, out_dir))

    if len(saved) > 1:
        print(f"Compare:\n  python bench/report.py {' '.join(str(p) for p in saved)}\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="In-process Voice Gateway benchmark")
    parser.add_argument("--mode", default="echo", choices=[*_MODES, "all"],
                        help="Mode to benchmark (default: echo)")
    parser.add_argument("--n", type=int, default=10,
                        help="Turns per mode (default: 10)")
    parser.add_argument("--audio-dir", default="bench/audio",
                        help="Directory of WAV files (default: bench/audio)")
    parser.add_argument("--out-dir", default="bench/results",
                        help="Results output directory (default: bench/results)")
    args = parser.parse_args()
    asyncio.run(_main_async(args))


if __name__ == "__main__":
    main()
