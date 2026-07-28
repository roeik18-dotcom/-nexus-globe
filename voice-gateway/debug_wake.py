#!/usr/bin/env python3
"""
Merlin wake-trigger diagnostic script.

Tests each layer in isolation and prints a pass/fail report.
Run from the voice-gateway directory:
    python debug_wake.py

Use Ctrl+C to stop the live mic monitor section.
"""

import io
import os
import sys
import time
import threading
from pathlib import Path

# ── Add voice-gateway root to path ────────────────────────────────────────────
_ROOT = Path(__file__).parent
sys.path.insert(0, str(_ROOT))

PASS = "\033[32mPASS\033[0m"
FAIL = "\033[31mFAIL\033[0m"
INFO = "\033[33mINFO\033[0m"

SAMPLE_RATE      = 16_000
VAD_THRESHOLD    = 0.015
CLAP_THRESHOLD   = 0.10
MONITOR_SECS     = 10


def section(title: str) -> None:
    print(f"\n{'─' * 60}")
    print(f"  {title}")
    print(f"{'─' * 60}")


# ── Layer 1: Python imports ───────────────────────────────────────────────────

section("Layer 1 — Python imports")

try:
    import numpy as np
    print(f"  {PASS}  numpy {np.__version__}")
except ImportError as e:
    print(f"  {FAIL}  numpy: {e}")

try:
    import sounddevice as sd
    print(f"  {PASS}  sounddevice {sd.__version__}")
except ImportError as e:
    print(f"  {FAIL}  sounddevice: {e}")

try:
    from scipy.io import wavfile
    print(f"  {PASS}  scipy.io.wavfile")
except ImportError as e:
    print(f"  {FAIL}  scipy: {e}")

try:
    import openai
    print(f"  {PASS}  openai {openai.__version__}")
    _have_openai = True
except ImportError as e:
    print(f"  {FAIL}  openai: {e}")
    _have_openai = False

try:
    from dotenv import load_dotenv
    load_dotenv(_ROOT / ".env")
    print(f"  {PASS}  dotenv + .env loaded")
except Exception as e:
    print(f"  {INFO}  dotenv not available: {e}")

try:
    from app.config import settings
    print(f"  {PASS}  app.config loaded")
except Exception as e:
    print(f"  {FAIL}  app.config: {e}")
    settings = None  # type: ignore

try:
    from app.memory import MemoryStore, extract_memories
    print(f"  {PASS}  app.memory")
except Exception as e:
    print(f"  {FAIL}  app.memory: {e}")

try:
    from service.wake_trigger import WakeTrigger, ClapDetector, KeywordBuffer
    print(f"  {PASS}  service.wake_trigger")
except Exception as e:
    print(f"  {FAIL}  service.wake_trigger: {e}")


# ── Layer 2: Environment / API key ────────────────────────────────────────────

section("Layer 2 — Environment & API keys")

openai_key = os.environ.get("OPENAI_API_KEY", "")
if settings:
    openai_key = openai_key or settings.openai_api_key or ""

if openai_key:
    print(f"  {PASS}  OPENAI_API_KEY set ({openai_key[:8]}…)")
else:
    print(f"  {FAIL}  OPENAI_API_KEY not set — keyword detection will be disabled")

anthropic_key = os.environ.get("ANTHROPIC_API_KEY", "")
if settings:
    anthropic_key = anthropic_key or settings.anthropic_api_key or ""

if anthropic_key:
    print(f"  {PASS}  ANTHROPIC_API_KEY set ({anthropic_key[:8]}…)")
else:
    print(f"  {INFO}  ANTHROPIC_API_KEY not set (memory extraction will be skipped)")


# ── Layer 3: Microphone device ────────────────────────────────────────────────

section("Layer 3 — Microphone devices")

try:
    import sounddevice as sd
    devices = sd.query_devices()
    default_in = sd.default.device[0]
    print(f"  {INFO}  Default input device: {default_in}")
    for i, d in enumerate(devices):
        if d["max_input_channels"] > 0:
            marker = " ← default" if i == default_in else ""
            print(f"        [{i}] {d['name']}{marker}")
except Exception as e:
    print(f"  {FAIL}  Cannot query devices: {e}")
    sys.exit(1)


# ── Layer 4: Live mic RMS + VAD + clap monitor ────────────────────────────────

section(f"Layer 4 — Live mic monitor ({MONITOR_SECS}s) — speak and clap now")

try:
    import numpy as np
    import sounddevice as sd

    samples_seen = [0]
    max_rms      = [0.0]
    vad_count    = [0]
    clap_count   = [0]
    stream_ok    = [False]

    def _cb(indata, frames, t, status):
        if status:
            print(f"  [stream status] {status}")
        stream_ok[0] = True
        pcm = indata[:, 0].astype(np.float32)
        rms = float(np.sqrt(np.mean(pcm ** 2)))
        samples_seen[0] += frames
        if rms > max_rms[0]:
            max_rms[0] = rms
        if rms >= VAD_THRESHOLD:
            vad_count[0] += 1
        if rms >= CLAP_THRESHOLD:
            clap_count[0] += 1
        bar_len = int(min(rms / 0.30 * 40, 40))
        bar     = "█" * bar_len + "░" * (40 - bar_len)
        vad_mark  = " VAD"  if rms >= VAD_THRESHOLD  else "    "
        clap_mark = " CLAP" if rms >= CLAP_THRESHOLD else "     "
        print(f"\r  [{bar}] {rms:.4f}{vad_mark}{clap_mark}  ", end="", flush=True)

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=1,
        dtype=np.float32,
        blocksize=320,
        callback=_cb,
    ):
        time.sleep(MONITOR_SECS)

    print()  # newline after bar

    if stream_ok[0]:
        print(f"  {PASS}  Microphone stream opened and received audio")
        print(f"  {INFO}  Total samples: {samples_seen[0]:,}  (~{samples_seen[0]/SAMPLE_RATE:.1f}s)")
        print(f"  {INFO}  Peak RMS: {max_rms[0]:.4f}")
        print(f"  {INFO}  VAD-active frames: {vad_count[0]}  (threshold={VAD_THRESHOLD})")
        print(f"  {INFO}  Clap-level frames: {clap_count[0]}  (threshold={CLAP_THRESHOLD})")
        if max_rms[0] < 0.001:
            print(f"  {FAIL}  Peak RMS too low — mic may be muted or wrong device")
    else:
        print(f"  {FAIL}  Microphone stream opened but received no frames")

except Exception as e:
    print(f"\n  {FAIL}  Microphone stream failed: {e}")


# ── Layer 5: Whisper connectivity ─────────────────────────────────────────────

section("Layer 5 — Whisper / OpenAI connectivity")

if not openai_key:
    print(f"  {INFO}  Skipped — no OPENAI_API_KEY")
elif not _have_openai:
    print(f"  {FAIL}  Skipped — openai package not installed")
else:
    print("  Sending 0.5 s of silence to Whisper…")
    try:
        import openai as _oai
        import numpy as np
        from scipy.io import wavfile

        silent = np.zeros(SAMPLE_RATE // 2, dtype=np.int16)
        buf    = io.BytesIO()
        wavfile.write(buf, SAMPLE_RATE, silent)
        buf.seek(0)
        buf.name = "audio.wav"

        client = _oai.OpenAI(api_key=openai_key)
        result = client.audio.transcriptions.create(model="whisper-1", file=buf)
        print(f"  {PASS}  Whisper responded: {result.text!r} (empty = silence, that's fine)")
    except Exception as e:
        print(f"  {FAIL}  Whisper call failed: {e}")


# ── Layer 6: Double-clap detector unit test ───────────────────────────────────

section("Layer 6 — ClapDetector unit test")

try:
    from service.wake_trigger import ClapDetector
    import threading

    evt = threading.Event()
    det = ClapDetector(on_double_clap=evt)
    now = 0.0
    # Simulate two short bursts
    for _ in range(5):
        det.feed(0.2, now)
        now += 0.01
    det.feed(0.0, now); now += 0.1  # gap between claps
    for _ in range(5):
        det.feed(0.2, now)
        now += 0.01
    det.feed(0.0, now)

    if evt.is_set():
        print(f"  {PASS}  ClapDetector fired on simulated double-clap")
    else:
        print(f"  {FAIL}  ClapDetector did NOT fire — check CLAP_GAP_MIN_S / CLAP_MAX_S")
except Exception as e:
    print(f"  {FAIL}  ClapDetector test: {e}")


# ── Layer 7: WakeTrigger startup smoke test ───────────────────────────────────

section("Layer 7 — WakeTrigger startup (3 s listen, then abort)")

try:
    import asyncio
    from service.wake_trigger import WakeTrigger

    _triggered = False

    async def _smoke():
        trigger = WakeTrigger(openai_api_key=openai_key)
        try:
            await asyncio.wait_for(trigger.wait(), timeout=3.0)
            return True
        except asyncio.TimeoutError:
            return False  # expected — no real wake event in 3 s

    result = asyncio.run(_smoke())
    if result:
        print(f"  {PASS}  WakeTrigger fired within 3 s (you triggered it!)")
    else:
        print(f"  {PASS}  WakeTrigger started cleanly, no event in 3 s (expected)")

except Exception as e:
    print(f"  {FAIL}  WakeTrigger failed to start: {e}")


# ── Summary ───────────────────────────────────────────────────────────────────

section("Summary")
print("""
  Check each FAIL above in order — each one is a blocking layer.

  Most likely causes of 'Hi Merlin' not working:
    1. OPENAI_API_KEY missing or wrong  →  keyword detection disabled (layer 2)
    2. openai import fails              →  inference thread exits silently (layer 1)
    3. Whisper call fails               →  keyword never recognized (layer 5)
    4. Mic RMS is near 0               →  no audio reaching detectors (layer 4)
    5. LaunchAgent not loaded           →  service not running at all

  To check the LaunchAgent:
    launchctl list | grep merlin
    tail -50 ~/Library/Logs/Merlin/service.log

  To restart the service:
    launchctl kickstart -k gui/$(id -u)/com.merlin.voice
""")
