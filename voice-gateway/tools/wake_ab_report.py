#!/usr/bin/env python3
"""
wake_ab_report.py — MEASUREMENT ONLY. Merlin voice-gateway wake A/B analyzer.

Read-only analyzer for the service log. Compares two time windows (e.g. BEFORE
vs AFTER a single controlled change such as a hardware gain adjustment) and prints
an Evidence Summary, a neutral Interpretation, and a Confidence note.

STRICT CONTRACT — this tool:
  • ONLY reads the log file (opened 'r'). It writes nothing to it.
  • NEVER changes code, configuration, thresholds, or any parameter.
  • NEVER performs automatic fixes.
  • Does NOT diagnose / decide root cause. It measures, compares, and describes.
    A human (or Claude, later) draws the conclusion. This keeps the tool valid for
    ANY future change (mic, RME, Whisper, VAD, or the whole LLM engine) — it never
    "knows" the cause.

Usage:
  python3 wake_ab_report.py --before 13:30:00 13:34:00 --after 13:40:00 13:45:00
  python3 wake_ab_report.py --before 13:30:00 13:34:00           # single window
  python3 wake_ab_report.py --log /path/to/service.log --before ... --after ...

Time bounds are HH:MM:SS (matched against the log's clock field). The window is
inclusive of start, exclusive of end.

Definitions (all derived from log lines, no ground-truth intent):
  Wake attempts        = count of 'WAKE_TRANSCRIPT=' lines (utterances transcribed)
  Successful wakes      = count of 'WAKE_MATCH=True'
  Wake success %        = successful / attempts * 100
  Empty transcripts     = count of WAKE_TRANSCRIPT='' (Whisper returned nothing)
  Average / Peak RMS     = from 'VAD flush' rms_before_resample / max_before
  Avg speech duration   = mean of 'speech_duration=' on transcript lines
  Too-short discards    = count of 'VAD off ... too short'
  False wakes (proxy)   = wakes ('STARTING_ASSISTANT_PIPELINE') followed by
                          'no speech'/'initial silence timeout' before the next
                          wake — a HEURISTIC proxy, not a ground-truth count.
"""

import argparse
import os
import re
import sys

LOG_DEFAULT = os.path.expanduser("~/Library/Logs/Merlin/service.log")

_TS = re.compile(r"^\d{4}-\d{2}-\d{2}\s+(\d{2}):(\d{2}):(\d{2})")
_RE_TRANSCRIPT = re.compile(r"WAKE_TRANSCRIPT=(['\"])(.*?)\1")
_RE_SPEECH_DUR = re.compile(r"speech_duration=([\d.]+)")
_RE_RMS_BEFORE = re.compile(r"rms_before_resample=([\d.]+)")
_RE_MAX_BEFORE = re.compile(r"max_before=([\d.]+)")

# (metric key in _metrics(), display label, delta kind)
#   int    → count; delta = +N
#   pctpt  → percentage; delta = percentage points
#   ratio  → 0..1 level; delta = percent change
#   dur    → seconds; delta = +Ns
METRICS = [
    ("Wake attempts",         "Wake attempts",       "int"),
    ("Successful wakes",      "Successful wakes",     "int"),
    ("Wake success %",        "Wake success",        "pctpt"),
    ("Empty WAKE_TRANSCRIPT", "Empty transcripts",   "int"),
    ("Avg RMS",               "Average RMS",         "ratio"),
    ("Peak RMS",              "Peak RMS",            "ratio"),
    ("Avg speech duration",   "Avg speech duration", "dur"),
    ("too short discards",    "Too-short discards",  "int"),
    ("False wakes (proxy)",   "False wakes",         "int"),
]


def _sec_of_day(hms: str) -> int:
    parts = hms.split(":")
    if len(parts) != 3:
        raise ValueError(f"expected HH:MM:SS, got {hms!r}")
    h, m, s = (int(p) for p in parts)
    return h * 3600 + m * 60 + s


def _line_sec(line: str):
    m = _TS.match(line)
    if not m:
        return None
    h, mm, s = (int(g) for g in m.groups())
    return h * 3600 + mm * 60 + s


def _window_lines(lines, start_sec, end_sec):
    out = []
    for ln in lines:
        t = _line_sec(ln)
        if t is not None and start_sec <= t < end_sec:
            out.append(ln)
    return out


def _metrics(lines):
    attempts = empty = successful = too_short = 0
    durations, rms_vals, peak_vals = [], [], []

    for ln in lines:
        mt = _RE_TRANSCRIPT.search(ln)
        if mt:
            attempts += 1
            if mt.group(2) == "":
                empty += 1
            md = _RE_SPEECH_DUR.search(ln)
            if md:
                durations.append(float(md.group(1)))
        if "WAKE_MATCH=True" in ln:
            successful += 1
        if "too short" in ln:
            too_short += 1
        mr = _RE_RMS_BEFORE.search(ln)
        if mr:
            rms_vals.append(float(mr.group(1)))
        mp = _RE_MAX_BEFORE.search(ln)
        if mp:
            peak_vals.append(float(mp.group(1)))

    false_wakes = 0
    pending = False
    for ln in lines:
        if "STARTING_ASSISTANT_PIPELINE" in ln:
            pending = True
        elif pending and ("no speech" in ln or "initial silence timeout" in ln):
            false_wakes += 1
            pending = False

    return {
        "Wake attempts": attempts,
        "Successful wakes": successful,
        "Wake success %": (successful / attempts * 100) if attempts else 0.0,
        "Empty WAKE_TRANSCRIPT": empty,
        "Avg RMS": (sum(rms_vals) / len(rms_vals)) if rms_vals else 0.0,
        "Peak RMS": max(peak_vals) if peak_vals else 0.0,
        "Avg speech duration": (sum(durations) / len(durations)) if durations else 0.0,
        "too short discards": too_short,
        "False wakes (proxy)": false_wakes,
    }


def _pct_change(before, after):
    return ((after - before) / before * 100) if before else 0.0


def _val(kind, v):
    if kind == "int":
        return str(int(v))
    if kind == "pctpt":
        return f"{v:.0f}%"
    if kind == "ratio":
        return f"{v:.3f}"
    if kind == "dur":
        return f"{v:.2f}s"
    return str(v)


def _delta(kind, b, a):
    if kind == "int":
        return f"{int(a) - int(b):+d}"
    if kind == "pctpt":
        return f"{a - b:+.0f}pp"
    if kind == "ratio":
        return f"{_pct_change(b, a):+.0f}%"
    if kind == "dur":
        return f"{a - b:+.2f}s"
    return ""


def _interpretation(before, after):
    """Neutral, descriptive reading — NEVER names a root cause."""
    d_success = after["Wake success %"] - before["Wake success %"]
    rms_pct = _pct_change(before["Avg RMS"], after["Avg RMS"])

    if d_success >= 15 and rms_pct >= 15:
        first = "The observed measurements are consistent with improved input signal quality."
    elif d_success <= -15:
        first = "The observed measurements are consistent with degraded input signal quality."
    elif abs(d_success) < 15:
        first = "The observed measurements show little change between the two windows."
    else:
        first = ("The observed measurements are mixed — wake success and input level "
                 "did not move together.")
    disclaimer = (
        "This report does not determine root cause.\n"
        "Additional controlled experiments may be required to distinguish between "
        "analog input effects and software behavior."
    )
    return first + "\n\n" + disclaimer


def _print_report(before, after):
    labelw = max(len(l) for _, l, _ in METRICS)
    cw = 11
    print("Evidence Summary")
    print("─" * (labelw + 2 + cw * 3 + 4))
    print(f"{'Metric'.ljust(labelw)}  {'Before'.rjust(cw)}  {'After'.rjust(cw)}  {'Δ'.rjust(cw)}")
    print("-" * (labelw + 2 + cw * 3 + 4))
    for key, label, kind in METRICS:
        b, a = before[key], after[key]
        print(f"{label.ljust(labelw)}  {_val(kind, b).rjust(cw)}  "
              f"{_val(kind, a).rjust(cw)}  {_delta(kind, b, a).rjust(cw)}")
    print()
    print("Interpretation")
    print()
    print(_interpretation(before, after))
    print()
    _print_confidence(before, after)


def _print_confidence(before, after):
    nb, na = before["Wake attempts"], after["Wake attempts"]
    n = min(nb, na)
    level = "Low" if n < 10 else "Medium" if n < 30 else "High"
    print("Confidence")
    print()
    print(f"Sample size: {nb} vs {na}")
    print(f"Confidence: {level}")
    if level != "High":
        print()
        print("Results should be confirmed with a larger sample.")


def _print_single(m):
    labelw = max(len(l) for _, l, _ in METRICS)
    print("Evidence Summary (single window)")
    print("-" * (labelw + 12))
    print(f"{'Metric'.ljust(labelw)}  Value")
    for key, label, kind in METRICS:
        print(f"{label.ljust(labelw)}  {_val(kind, m[key])}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Read-only Merlin wake A/B log report.")
    ap.add_argument("--log", default=LOG_DEFAULT, help="path to service.log")
    ap.add_argument("--before", nargs=2, metavar=("START", "END"), required=True,
                    help="BEFORE window, HH:MM:SS HH:MM:SS")
    ap.add_argument("--after", nargs=2, metavar=("START", "END"),
                    help="AFTER window, HH:MM:SS HH:MM:SS (optional)")
    args = ap.parse_args(argv)

    if not os.path.isfile(args.log):
        print(f"log not found: {args.log}", file=sys.stderr)
        return 2

    with open(args.log, "r", errors="replace") as fh:  # READ ONLY
        lines = fh.readlines()

    b0, b1 = _sec_of_day(args.before[0]), _sec_of_day(args.before[1])
    before = _metrics(_window_lines(lines, b0, b1))

    print(f"Log: {args.log}")
    print(f"BEFORE window: {args.before[0]} → {args.before[1]}")
    if args.after:
        a0, a1 = _sec_of_day(args.after[0]), _sec_of_day(args.after[1])
        after = _metrics(_window_lines(lines, a0, a1))
        print(f"AFTER  window: {args.after[0]} → {args.after[1]}")
        print()
        _print_report(before, after)
    else:
        print()
        _print_single(before)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
