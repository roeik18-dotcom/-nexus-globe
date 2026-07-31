#!/usr/bin/env python3
"""
silero_probe.py — run the REAL Silero VAD (industry-standard neural VAD) over the
already-captured Merlin WAVs, OFFLINE. Read-only: no live mic, no service change.

Purpose: split Issue #2 (Command-STT unreliable) into two DIFFERENT worlds, using
the model the world actually uses instead of our hand-rolled RMS threshold:

  (A) Silero SEES speech but the transcript is empty  -> capture is fine; the drop
      is downstream (STT params / pipeline)  -> a different fix.
  (B) Silero sees NO speech                            -> nothing usable was
      captured (mic level / distance / timing)         -> front-end fix.

The RMS-threshold column shows what our current crude gate decided, so we can see
how often Silero and the RMS hack disagree.

Usage:
    .venv/bin/python tools/silero_probe.py            # cmd_*.wav
    .venv/bin/python tools/silero_probe.py --glob wake_*
    .venv/bin/python tools/silero_probe.py --dump     # per-file rows
"""
from __future__ import annotations
import argparse, glob, json, os, wave
import numpy as np
import torch
from silero_vad import load_silero_vad, get_speech_timestamps

CAP = os.path.expanduser("~/Library/Logs/Merlin/capture")
RMS_VAD = 0.004  # the current hand-rolled threshold, for comparison


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr, n, ch = w.getframerate(), w.getnframes(), w.getnchannels()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def sidecar_transcript(wav_path):
    j = wav_path[:-4] + ".json"
    if not os.path.exists(j):
        return None, False
    try:
        d = json.load(open(j))
    except Exception:
        return None, False
    t = d.get("stt", {}).get("transcript", d.get("transcript"))
    return t, bool(t and str(t).strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glob", default="cmd_*")
    ap.add_argument("--dir", default=CAP)
    ap.add_argument("--dump", action="store_true")
    a = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(a.dir, a.glob + ".wav")))
    if not paths:
        print(f"no WAVs matching {a.glob}.wav in {a.dir}")
        return

    model = load_silero_vad()  # torch backend (torch present)
    rows = []
    for p in paths:
        try:
            x, sr = read_wav(p)
        except Exception as e:
            print(f"  skip {os.path.basename(p)}: {e}")
            continue
        rms = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0
        ts = get_speech_timestamps(torch.from_numpy(x), model,
                                   sampling_rate=sr, return_seconds=True)
        speech_s = sum(t["end"] - t["start"] for t in ts)
        _, has_txt = sidecar_transcript(p)
        rows.append(dict(file=os.path.basename(p), dur=len(x) / sr if sr else 0,
                         rms=rms, silero_speech_s=speech_s, silero_has=bool(ts),
                         rms_pass=rms >= RMS_VAD, has_txt=has_txt))

    n = len(rows)
    if a.dump:
        print(f"{'file':34} {'dur':>5} {'rms':>7} {'rmsVAD':>6} {'silero_s':>8} {'txt':>4}")
        for r in rows:
            print(f"{r['file']:34} {r['dur']:5.2f} {r['rms']:7.4f} "
                  f"{'pass' if r['rms_pass'] else 'FAIL':>6} "
                  f"{r['silero_speech_s']:8.2f} {'yes' if r['has_txt'] else '-':>4}")
        print()

    sil = sum(1 for r in rows if r["silero_has"])
    both_no = sum(1 for r in rows if not r["silero_has"] and not r["has_txt"])
    sil_yes_txt_no = sum(1 for r in rows if r["silero_has"] and not r["has_txt"])
    disagree = sum(1 for r in rows if r["silero_has"] != r["rms_pass"])
    speech_durs = sorted(r["silero_speech_s"] for r in rows if r["silero_has"])

    print("=" * 64)
    print(f"SILERO VAD EVIDENCE  ({n} files, glob={a.glob})")
    print("=" * 64)
    print(f"Silero detects speech:        {sil:4d}/{n}  ({sil/n*100:.0f}%)")
    print(f"Silero: NO speech:            {n-sil:4d}/{n}  ({(n-sil)/n*100:.0f}%)")
    if speech_durs:
        print(f"  speech duration (of those)  min={speech_durs[0]:.2f}s "
              f"median={speech_durs[len(speech_durs)//2]:.2f}s max={speech_durs[-1]:.2f}s")
    print()
    print("Split of Issue #2:")
    print(f"  (A) Silero=speech BUT transcript empty : {sil_yes_txt_no:4d}  "
          f"-> capture OK, DOWNSTREAM drop")
    print(f"  (B) Silero=no-speech (+ empty text)    : {both_no:4d}  "
          f"-> nothing usable captured, FRONT-END")
    print()
    print(f"Silero vs hand-rolled RMS gate DISAGREE on {disagree}/{n} files "
          f"({disagree/n*100:.0f}%)")
    print("  (each disagreement = a file our RMS threshold judged wrong)")


if __name__ == "__main__":
    main()
