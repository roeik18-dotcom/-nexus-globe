"""
Voice client — no special permissions needed.

  ENTER → start recording
  ENTER → stop and send
  Ctrl+C → quit

Usage:
    cd voice-gateway
    python3 client/voice.py
"""

import asyncio
import io
import json
import subprocess
import sys
import tempfile
import threading
from pathlib import Path

try:
    import numpy as np
    import sounddevice as sd
    import websockets
    from scipy.io import wavfile
except ImportError as e:
    print(f"Missing: {e}")
    print("Run: .venv/bin/pip install sounddevice numpy scipy websockets")
    sys.exit(1)

SAMPLE_RATE = 16_000


def record(stop_event: threading.Event) -> bytes:
    chunks: list[np.ndarray] = []

    def cb(indata, frames, t, status):
        chunks.append(indata.copy())

    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, dtype=np.int16, callback=cb):
        stop_event.wait()

    audio = np.concatenate(chunks) if chunks else np.zeros((0, 1), dtype=np.int16)
    buf = io.BytesIO()
    wavfile.write(buf, SAMPLE_RATE, audio)
    return buf.getvalue()


def play(data: bytes) -> None:
    suffix = ".aiff" if data[:4] == b"FORM" else ".mp3"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as f:
        f.write(data)
        tmp = Path(f.name)
    subprocess.run(["afplay", str(tmp)], capture_output=True)
    tmp.unlink(missing_ok=True)


async def run(host: str = "127.0.0.1", port: int = 8765) -> None:
    uri = f"ws://{host}:{port}/ws/voice"
    print(f"Connecting to {uri}…")

    async with websockets.connect(uri) as ws:
        init = json.loads(await ws.recv())
        print(f"Session: {init.get('session_id', '?')}\n")
        print("Press ENTER to start recording, ENTER again to send. Ctrl+C to quit.\n")

        loop = asyncio.get_running_loop()

        while True:
            await loop.run_in_executor(None, input, "[ ENTER to record ]  ")
            print("● Recording…  (press ENTER to send)")

            stop = threading.Event()
            rec_task = loop.run_in_executor(None, record, stop)

            await loop.run_in_executor(None, input, "")
            stop.set()
            wav = await rec_task

            print("  Sending…")
            await ws.send(wav)
            await ws.send(json.dumps({"type": "end_of_speech"}))

            audio_chunks: list[bytes] = []
            while True:
                raw = await asyncio.wait_for(ws.recv(), timeout=30)
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
                        f"     ⏱  {s['total_ms']}ms total"
                        f"  (STT {s['stt_ms']} · adapter {s['adapter_ms']} · TTS {s['tts_ms']})"
                    )
                elif t == "done":
                    if audio_chunks:
                        threading.Thread(
                            target=play, args=(b"".join(audio_chunks),), daemon=True
                        ).start()
                    print()
                    break
                elif t == "error":
                    print(f"\n[error] {msg.get('message')}")
                    break
                elif t == "expired":
                    print("\nSession expired.")
                    return


def main() -> None:
    import argparse
    p = argparse.ArgumentParser()
    p.add_argument("--host", default="127.0.0.1")
    p.add_argument("--port", type=int, default=8765)
    args = p.parse_args()
    try:
        asyncio.run(run(args.host, args.port))
    except KeyboardInterrupt:
        print("\nGoodbye.")


if __name__ == "__main__":
    main()
