#!/usr/bin/env python3
"""Live Merlin mic + runtime meter — READ-ONLY.

Polls the ALREADY-EXPOSED control-panel endpoint http://127.0.0.1:8802/api/status
once per second and renders per-channel RMS/peak, the selected mic channel,
capture/playback state, turn ownership, and the last transcript. It changes
NOTHING in the runtime — it only reads what the running service already reports.

Use it to prove the physical input path live: run it, then stay silent → speak →
clap once → clap twice, and watch which channel's RMS/PEAK moves.

  python tools/mic_meter.py            # 1 Hz, ctrl-C to stop
  python tools/mic_meter.py --url http://127.0.0.1:8802 --hz 2
"""
from __future__ import annotations

import argparse
import json
import time
import urllib.request


def bar(v: float, lo=0.0005, hi=0.5, width=24) -> str:
    import math
    if v <= 0:
        return " " * width
    frac = (math.log10(max(v, 1e-6)) - math.log10(lo)) / (math.log10(hi) - math.log10(lo))
    frac = max(0.0, min(1.0, frac))
    n = int(frac * width)
    return "█" * n + "·" * (width - n)


def fetch(url: str, timeout=3):
    with urllib.request.urlopen(url + "/api/status", timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", default="http://127.0.0.1:8802")
    ap.add_argument("--hz", type=float, default=1.0)
    a = ap.parse_args(argv)
    period = 1.0 / max(0.2, a.hz)
    print(f"Merlin live meter — {a.url}  (ctrl-C to stop)\n")
    while True:
        try:
            s = fetch(a.url)
        except Exception as e:
            print(f"\r[unreachable] {a.url} — is the service up? {type(e).__name__}: {e}", end="", flush=True)
            time.sleep(period)
            continue
        rms = s.get("per_channel_rms", {}) or {}
        peak = s.get("per_channel_peak", {}) or {}
        sel = s.get("selected_mic_channel")
        # channels sorted by rms, show top movers
        try:
            chans = sorted(rms.items(), key=lambda kv: -float(kv[1]))[:4]
        except Exception:
            chans = list(rms.items())[:4]
        print("\033[2J\033[H", end="")  # clear
        print(f"runtime={s.get('runtime_state')}  capture={s.get('capture_active')}  "
              f"playback={s.get('playback_active')}  muted={s.get('muted')}  "
              f"turn={s.get('active_turn_id')} owner={s.get('active_owner')}")
        print(f"selected_mic_channel={sel}   (speak/clap and watch a channel's bar jump)\n")
        for ch, r in chans:
            r = float(r); p = float(peak.get(ch, 0) or 0)
            mark = " <== selected" if str(ch) == str(sel) else ""
            print(f"  ch{str(ch):>2}  rms={r:8.5f} |{bar(r)}|  peak={p:7.4f}{mark}")
        tx = (s.get("current_transcript") or "").strip()
        if tx:
            print(f"\nlast_transcript: {tx[:80]}")
        err = s.get("last_error")
        if err:
            print(f"last_error: {err}")
        print("\n(RMS>~0.05 on speech/clap = healthy capture; if the SELECTED channel stays "
              "near the 0.003 noise floor while you speak → wrong channel/gain)")
        time.sleep(period)


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nstopped.")
