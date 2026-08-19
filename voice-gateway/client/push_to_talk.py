"""
Push-to-talk CLI client for Voice Gateway.

Hold SPACE to record. Release to send. Press Ctrl+C to quit.

Usage:
    cd voice-gateway
    python client/push_to_talk.py [--host 127.0.0.1] [--port 8765]

Requirements: sounddevice, numpy, pynput, scipy, websockets
"""

import argparse
import asyncio
import io
import json
import logging
import queue
import sys
import tempfile
import threading
from pathlib import Path

try:
    import numpy as np
    import sounddevice as sd
    import websockets
    from pynput import keyboard as pynput_kb
    from scipy.io import wavfile
except ImportError as exc:
    print(f"Missing dependency: {exc}")
    print("Run: pip install sounddevice numpy pynput scipy websockets")
    sys.exit(1)

# Optional: play mp3 audio via pydub+simpleaudio, or fall back to `afplay`
try:
    import subprocess
    _HAS_AFPLAY = True
except ImportError:
    _HAS_AFPLAY = False

# Pre-capture audio-conflict guard (self-contained; see client/capture_guard.py).
# Package import first (tests, where voice-gateway is on the path), then the flat
# script import (running `python client/push_to_talk.py`, where client/ is on the path).
try:
    from client.capture_guard import default_guard, pre_capture_check
except ImportError:  # pragma: no cover - script-context fallback
    from capture_guard import default_guard, pre_capture_check

logging.basicConfig(level=logging.WARNING)

SAMPLE_RATE = 16_000
CHANNELS = 1
DTYPE = np.int16


def record_until_release(stop_event: threading.Event) -> bytes:
    """Record audio into a WAV buffer until stop_event is set."""
    chunks: list[np.ndarray] = []
    overflow = threading.Event()

    def callback(indata, frames, time_info, status):
        if status and status.input_overflow:
            overflow.set()
        chunks.append(indata.copy())

    with sd.InputStream(
        samplerate=SAMPLE_RATE,
        channels=CHANNELS,
        dtype=DTYPE,
        callback=callback,
    ):
        stop_event.wait()

    if overflow.is_set():
        print("[warn] input overflow — some audio may have been dropped")

    audio = np.concatenate(chunks, axis=0) if chunks else np.zeros((0, CHANNELS), dtype=DTYPE)
    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio)
    return buf.getvalue()


# ── interruptible TTS playback (barge-in) ────────────────────────────────────
# afplay runs as a tracked child process so it can be killed mid-sentence. Guarded
# by a lock because playback runs on an executor thread while the stop key fires on
# the keyboard-listener thread.
_playback_lock = threading.Lock()
_playback_proc: "subprocess.Popen | None" = None


def stop_playback() -> bool:
    """Barge-in: interrupt Merlin's current TTS playback. Returns True if something was
    playing and was stopped, False if nothing was playing. Safe to call any time — the
    play_audio `finally` still clears the TTS mark so the capture guard stays consistent."""
    with _playback_lock:
        proc = _playback_proc
    if proc is None or proc.poll() is not None:
        return False
    try:
        proc.terminate()
    except Exception:
        return False
    return True


def play_audio(data: bytes) -> None:
    """Play Merlin's TTS audio, marking TTS active for the capture guard so playback
    (and a short cooldown after it) is never mistaken for the user. The mark always
    clears in ``finally`` — even if afplay is missing or fails — so the post-TTS
    cooldown is preserved."""
    default_guard().tts.mark_started()
    try:
        _play_audio_impl(data)
    finally:
        default_guard().tts.mark_ended()


def _play_audio_impl(data: bytes) -> None:
    """Play AIFF/MP3/WAV or raw 24 kHz PCM16 mono via afplay."""
    if data[:4] in {b"FORM", b"RIFF"} or data[:3] == b"ID3" or data[:2] == b"\\xff\\xfb":
        suffix = ".aiff" if data[:4] == b"FORM" else ".wav" if data[:4] == b"RIFF" else ".mp3"
        payload = data
    else:
        pcm = np.frombuffer(data, dtype="<i2")
        buf = io.BytesIO()
        wavfile.write(buf, 24_000, pcm)
        suffix = ".wav"
        payload = buf.getvalue()

    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(payload)
        tmp = Path(f.name)

    global _playback_proc
    try:
        proc = subprocess.Popen(["afplay", str(tmp)])
    except FileNotFoundError as exc:
        print("[audio] cannot play — saved to", tmp, exc)
        return
    with _playback_lock:
        _playback_proc = proc
    try:
        proc.wait()  # blocks until playback ends OR stop_playback() terminates it
    finally:
        with _playback_lock:
            if _playback_proc is proc:
                _playback_proc = None
    tmp.unlink(missing_ok=True)


# ── capture-guard integration ────────────────────────────────────────────────
# Honest, user-facing block reasons. `mic_not_quiet` is described as POSSIBLE
# speaker/room contamination — never as proven system audio. `system_audio_active`
# stays false unless a real output-detection provider (ScreenCaptureKit / BlackHole /
# CoreAudio) is configured; see client/capture_guard.py.
_BLOCK_MESSAGES = {
    "system_audio_active": "System audio detected — pause music/video before speaking.",
    "mic_not_quiet": "Background or speaker sound detected — wait for quiet or use override.",
    "tts_active": "Merlin is still speaking — one moment.",
    "tts_cooldown": "Merlin is still speaking — one moment.",
    "mic_unavailable": "Microphone unavailable — check the input device.",
}


def block_message(reason: str) -> str:
    return _BLOCK_MESSAGES.get(reason, f"Capture blocked ({reason}).")


def try_start_recording(override: bool, start_fn, notify=print) -> bool:
    """Run the pre-capture guard, then decide. On allow, call ``start_fn`` (which opens
    the mic and records) and return True. On block, ``notify`` the mapped reason and
    return False WITHOUT calling ``start_fn`` — the mic is never opened and nothing is
    enqueued or sent to STT. ``override=True`` (an explicit key) bypasses the block."""
    result = pre_capture_check(override=override)
    if not result.allow:
        notify(block_message(result.reason))
        return False
    start_fn()
    return True


async def run(host: str, port: int) -> None:
    uri = f"ws://{host}:{port}/ws/voice"
    print(f"Connecting to {uri} …")

    async with websockets.connect(uri) as ws:
        # Receive session_start
        raw = await ws.recv()
        msg = json.loads(raw)
        if msg.get("type") == "session_start":
            print(f"Session: {msg['session_id']}")

        print("\nHold SPACE to speak. Release to send. ESC stops Merlin. Ctrl+C quits.\n")

        loop = asyncio.get_running_loop()
        stop_recording = threading.Event()
        recording = False
        override_held = False
        audio_queue: asyncio.Queue = asyncio.Queue()

        def _begin_recording() -> None:
            nonlocal recording
            recording = True
            stop_recording.clear()
            print("● Recording…", end="\r", flush=True)

            def _record():
                wav = record_until_release(stop_recording)
                loop.call_soon_threadsafe(audio_queue.put_nowait, wav)

            threading.Thread(target=_record, daemon=True).start()

        def on_press(key):
            nonlocal override_held
            if key == pynput_kb.Key.esc:
                # Barge-in: stop Merlin mid-sentence.
                if stop_playback():
                    print("⏹  Stopped Merlin.        ", end="\r", flush=True)
                return
            if key in (pynput_kb.Key.shift, pynput_kb.Key.shift_r):
                override_held = True
                return
            if key == pynput_kb.Key.space and not recording:
                # Pre-capture guard. Hold SHIFT while pressing SPACE to override.
                # A blocked check prints its reason and never opens the mic.
                try_start_recording(override_held, _begin_recording)

        def on_release(key):
            nonlocal recording, override_held
            if key in (pynput_kb.Key.shift, pynput_kb.Key.shift_r):
                override_held = False
                return
            if key == pynput_kb.Key.space and recording:
                recording = False
                stop_recording.set()
                print("  Sending…  ", end="\r", flush=True)

        kb_listener = pynput_kb.Listener(on_press=on_press, on_release=on_release)
        kb_listener.start()

        quit_event = asyncio.Event()

        async def sender():
            while not quit_event.is_set():
                try:
                    wav = await asyncio.wait_for(audio_queue.get(), timeout=0.1)
                except asyncio.TimeoutError:
                    continue
                await ws.send(wav)
                await ws.send(json.dumps({"type": "end_of_speech"}))

        async def receiver():
            audio_chunks: list[bytes] = []
            while not quit_event.is_set():
                try:
                    raw = await asyncio.wait_for(ws.recv(), timeout=0.1)
                except asyncio.TimeoutError:
                    continue
                except websockets.ConnectionClosed:
                    print("\nConnection closed.")
                    quit_event.set()
                    break

                if isinstance(raw, bytes):
                    audio_chunks.append(raw)
                    continue

                msg = json.loads(raw)
                t = msg.get("type")

                if t == "transcript":
                    print(f"\nYou: {msg['text']}")
                elif t == "response_text":
                    print(f"AI:  {msg['text']}")
                elif t == "timing":
                    s = msg["stages"]
                    print(
                        f"     ⏱  STT {s['stt_ms']}ms · "
                        f"adapter {s['adapter_ms']}ms · "
                        f"TTS {s['tts_ms']}ms · "
                        f"total {s['total_ms']}ms"
                    )
                elif t == "done":
                    if audio_chunks:
                        audio = b"".join(audio_chunks)
                        audio_chunks.clear()
                        loop.run_in_executor(None, play_audio, audio)
                    print()
                elif t == "error":
                    print(f"\n[error] {msg.get('message')}")
                elif t == "expired":
                    print("\nSession expired.")
                    quit_event.set()

        try:
            await asyncio.gather(sender(), receiver())
        except (asyncio.CancelledError, KeyboardInterrupt):
            pass
        finally:
            kb_listener.stop()
            print("\nGoodbye.")


def main() -> None:
    parser = argparse.ArgumentParser(description="Voice Gateway push-to-talk client")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()

    try:
        asyncio.run(run(args.host, args.port))
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
