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


def play_audio(data: bytes) -> None:
    """Play audio bytes via afplay (macOS). Detects AIFF vs MP3 by magic bytes."""
    suffix = ".aiff" if data[:4] == b"FORM" else ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    try:
        subprocess.run(["afplay", str(tmp)], check=True, capture_output=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        print("[audio] cannot play — saved to", tmp)
        return
    tmp.unlink(missing_ok=True)


async def run(host: str, port: int) -> None:
    uri = f"ws://{host}:{port}/ws/voice"
    print(f"Connecting to {uri} …")

    async with websockets.connect(uri) as ws:
        # Receive session_start
        raw = await ws.recv()
        msg = json.loads(raw)
        if msg.get("type") == "session_start":
            print(f"Session: {msg['session_id']}")

        print("\nHold SPACE to speak. Release to send. Press Ctrl+C to quit.\n")

        loop = asyncio.get_running_loop()
        stop_recording = threading.Event()
        recording = False
        audio_queue: asyncio.Queue = asyncio.Queue()

        def on_press(key):
            nonlocal recording
            if key == pynput_kb.Key.space and not recording:
                recording = True
                stop_recording.clear()
                print("● Recording…", end="\r", flush=True)

                def _record():
                    wav = record_until_release(stop_recording)
                    loop.call_soon_threadsafe(audio_queue.put_nowait, wav)

                threading.Thread(target=_record, daemon=True).start()

        def on_release(key):
            nonlocal recording
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
