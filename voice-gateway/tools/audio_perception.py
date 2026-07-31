#!/usr/bin/env python3
"""
audio_perception.py — OFFLINE perception characterizer for Merlin captures.

READ-ONLY observability tool. It reads the captured WAVs themselves (not just the
JSON sidecars) and characterizes each into a coarse acoustic class, so we can see
WHAT is actually in the failing Command-STT captures (the sidecars only know
"empty transcript + low RMS", not silence-vs-voice-vs-noise).

This is the seed of the Router's Perception layer, run offline first
(observability before capability). It MEASURES; it does not diagnose or fix.

Coarse classes (heuristic, UNCALIBRATED — labels are proxies, not ground truth):
  near_silent   — almost no active energy
  speech_like   — voiced structure: low spectral flatness, moderate centroid
  tonal_like    — sustained low-flatness energy (music/tone candidate; needs a
                  trained model to separate from speech — flagged, not claimed)
  broadband     — high spectral flatness (noise / fricative-dominant / broadband)

Deps: numpy, scipy (present). WAVs read via stdlib `wave` (16 kHz mono PCM16).

Usage:
    python3 tools/audio_perception.py                 # all cmd_*.wav
    python3 tools/audio_perception.py --glob 'wake_*' # wake captures
    python3 tools/audio_perception.py --dump          # per-file table
"""
from __future__ import annotations
import argparse, glob, json, os, wave
import numpy as np
from scipy.fft import rfft

CAP = os.path.expanduser("~/Library/Logs/Merlin/capture")

# --- frame params (25 ms window / 10 ms hop at 16 kHz) ---
WIN = 400
HOP = 160
# heuristic thresholds (UNCALIBRATED — marked as such on output)
ACTIVE_RMS = 0.01      # a frame counts as "active" above this (post read, pre-norm)
FLAT_TONAL = 0.20      # median flatness below this on active frames -> tonal/voiced
FLAT_BROAD = 0.45      # above this -> broadband/noise
MIN_ACTIVE_RATIO = 0.10  # below this -> near_silent


def read_wav(path):
    with wave.open(path, "rb") as w:
        sr = w.getframerate()
        n = w.getnframes()
        ch = w.getnchannels()
        raw = w.readframes(n)
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def frames(x):
    if len(x) < WIN:
        return np.empty((0, WIN), dtype=np.float32)
    idx = np.arange(0, len(x) - WIN + 1, HOP)
    return np.stack([x[i:i + WIN] for i in idx])


def spectral_flatness(frame):
    # Wiener entropy: geomean(power)/mean(power). 1.0 = white/broadband, ->0 = tonal.
    win = frame * np.hanning(len(frame))
    p = np.abs(rfft(win)) ** 2
    p = p[1:]  # drop DC
    p = p + 1e-12
    gm = np.exp(np.mean(np.log(p)))
    am = np.mean(p)
    return float(gm / am)


def spectral_centroid(frame, sr):
    win = frame * np.hanning(len(frame))
    mag = np.abs(rfft(win))
    freqs = np.fft.rfftfreq(len(frame), 1.0 / sr)
    s = mag.sum()
    return float((freqs * mag).sum() / s) if s > 0 else 0.0


def characterize(path):
    x, sr = read_wav(path)
    dur = len(x) / sr if sr else 0.0
    rms = float(np.sqrt(np.mean(x ** 2))) if len(x) else 0.0
    peak = float(np.max(np.abs(x))) if len(x) else 0.0
    F = frames(x)
    if len(F) == 0:
        return dict(dur=dur, rms=rms, peak=peak, active_ratio=0.0,
                    flat=None, centroid=None, cls="near_silent")
    frms = np.sqrt(np.mean(F ** 2, axis=1))
    active = F[frms >= ACTIVE_RMS]
    active_ratio = len(active) / len(F)
    if active_ratio < MIN_ACTIVE_RATIO or len(active) == 0:
        return dict(dur=dur, rms=rms, peak=peak, active_ratio=active_ratio,
                    flat=None, centroid=None, cls="near_silent")
    flats = np.array([spectral_flatness(f) for f in active])
    cents = np.array([spectral_centroid(f, sr) for f in active])
    mflat = float(np.median(flats))
    mcent = float(np.median(cents))
    flat_var = float(np.var(flats))
    if mflat >= FLAT_BROAD:
        cls = "broadband"
    elif mflat <= FLAT_TONAL and flat_var < 0.01:
        cls = "tonal_like"      # music/tone candidate — needs trained model to confirm
    else:
        cls = "speech_like"
    return dict(dur=dur, rms=rms, peak=peak, active_ratio=active_ratio,
                flat=mflat, centroid=mcent, cls=cls)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glob", default="cmd_*", help="filename glob (no .wav)")
    ap.add_argument("--dir", default=CAP)
    ap.add_argument("--dump", action="store_true", help="per-file table")
    a = ap.parse_args()

    paths = sorted(glob.glob(os.path.join(a.dir, a.glob + ".wav")))
    if not paths:
        print(f"no WAVs matching {a.glob}.wav in {a.dir}")
        return

    rows = []
    for p in paths:
        try:
            r = characterize(p)
            r["file"] = os.path.basename(p)
            rows.append(r)
        except Exception as e:
            print(f"  skip {os.path.basename(p)}: {e}")

    if a.dump:
        print(f"{'file':38} {'dur':>5} {'rms':>7} {'act%':>5} {'flat':>5} {'cent':>6} cls")
        for r in rows:
            fl = f"{r['flat']:.2f}" if r['flat'] is not None else "  - "
            ce = f"{r['centroid']:.0f}" if r['centroid'] is not None else "   - "
            print(f"{r['file']:38} {r['dur']:5.2f} {r['rms']:7.4f} "
                  f"{r['active_ratio']*100:4.0f}% {fl:>5} {ce:>6} {r['cls']}")
        print()

    n = len(rows)
    from collections import Counter
    cc = Counter(r["cls"] for r in rows)
    rmss = sorted(r["rms"] for r in rows)
    print("=" * 60)
    print(f"EVIDENCE SUMMARY  ({n} files, glob={a.glob})   [heuristic, UNCALIBRATED]")
    print("=" * 60)
    print("Class distribution (proxy labels, not ground truth):")
    for cls in ("near_silent", "speech_like", "tonal_like", "broadband"):
        c = cc.get(cls, 0)
        print(f"  {cls:13} {c:4d}  {c/n*100:4.0f}%")
    if rmss:
        print(f"whole-file rms   min={rmss[0]:.4f}  median={rmss[n//2]:.4f}  max={rmss[-1]:.4f}")
    print()
    print("Interpretation is DEFERRED to the reader. This tool measures acoustic")
    print("class proxies; it does not conclude a root cause. 'tonal_like' is a")
    print("music/tone CANDIDATE only — separating music from speech reliably needs")
    print("a trained model (Router 🟡/🔴 tier), not spectral flatness alone.")


if __name__ == "__main__":
    main()
