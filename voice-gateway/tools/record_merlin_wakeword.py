#!/usr/bin/env python3
"""Record 'מרלין' wake-word clips for openWakeWord custom-model training.

Run it:
    cd /Users/roei/-nexus-globe/voice-gateway
    .venv/bin/python tools/record_merlin_wakeword.py

Say "מרלין" ONCE per prompt. Vary it deliberately across the 40 takes:
close / far, quiet / loud, fast / slow, flat / with intonation — this is what
makes the model fire on how you actually say it, not one fixed reading.

Saves 16 kHz mono WAVs to  data/wakeword/merlin_positives/.
When you're done, tell Claude "recordings done" and it trains the model.
"""
import os
import sys
import wave

import numpy as np
import sounddevice as sd

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "..", "data", "wakeword", "merlin_positives"))
SR = 16000            # openWakeWord's native rate
DUR = 1.6             # seconds captured per clip (say the word right after ENTER)
N = 40


def _save_wav(path, audio_i16, sr):
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(audio_i16.tobytes())


def main():
    os.makedirs(OUT, exist_ok=True)
    try:
        dev = sd.query_devices(kind="input")
        print(f"Input device: {dev['name']}  (override with SD_DEFAULT_DEVICE if wrong)")
    except Exception as e:
        print(f"(could not query input device: {e})")

    existing = sorted(f for f in os.listdir(OUT) if f.endswith(".wav"))
    i = len(existing)
    print(f"\nRecording {N} 'מרלין' clips → {OUT}")
    print(f"Already have {i}. Vary tone / distance / speed each time.")
    print("If a clip records silence, the peak warning will tell you — redo it.\n")

    quiet = 0
    while i < N:
        try:
            input(f"[{i + 1}/{N}] press ENTER, then say 'מרלין' once … ")
        except (EOFError, KeyboardInterrupt):
            print("\nstopped early.")
            break
        rec = sd.rec(int(DUR * SR), samplerate=SR, channels=1, dtype="int16")
        sd.wait()
        audio = rec.reshape(-1)
        peak = float(np.abs(audio).max()) / 32768.0
        path = os.path.join(OUT, f"merlin_{i:03d}.wav")
        _save_wav(path, audio, SR)
        if peak < 0.05:
            quiet += 1
            print(f"    saved {os.path.basename(path)}  peak={peak:.3f}  ⚠ very quiet — move closer / raise RME gain")
        else:
            print(f"    saved {os.path.basename(path)}  peak={peak:.3f}  ok")
        i += 1

    total = len([f for f in os.listdir(OUT) if f.endswith(".wav")])
    print(f"\nDone — {total} clips in {OUT}")
    if quiet:
        print(f"⚠ {quiet} clips were very quiet; consider re-recording those for a stronger model.")
    print("Now tell Claude: 'recordings done'")


if __name__ == "__main__":
    sys.exit(main())
