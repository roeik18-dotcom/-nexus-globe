#!/usr/bin/env python3
"""Merlin voice-gateway latency & reliability baseline report.

Read-only.  Parses ~/Library/Logs/Merlin/service.log and reports, per stage,
the latency distribution (n / mean / median / p95) plus reliability counters.

PAIRING MODEL (v2 — per-turn segmentation)
------------------------------------------
The log is a flat event stream.  We segment it into TURNS so that events from
different turns can never be paired together:

  * A turn is the command cycle:  STT transcribing → STT transcript →
    LLM streaming start → anthropic 200 → playback started → openai_tts (1st)
    → playback pcm (1st) → "LLM+TTS: done".
  * "LLM+TTS: done" CLOSES the current turn (compute its latencies, reset state).
  * A new "STT: transcribing" or "LLM streaming start" seen while a turn is
    already open (no "done" yet) means the previous turn never completed:
    it is recorded as an ANOMALY and discarded, and a fresh turn begins.  This
    is what prevents a missing/duplicated marker in turn N from leaking a
    timestamp into turn N+1.
  * Within a turn each stage marker is taken FIRST-WINS (e.g. the first of
    several openai_tts lines = first-audio latency); a duplicate is ignored,
    not overwritten, and flagged.

Wake-level events (keyword STT, wake→listen gap) are paired within a bounded
window and reset if the partner marker doesn't arrive before the next wake.

By default measures only the current config generation (after the last
"Ready … TTS=<provider>" line).  --since / --all override.  --dump prints every
turn's paired raw timestamps so the pairing can be audited by hand.

Usage:
    .venv/bin/python tools/log_metrics.py
    .venv/bin/python tools/log_metrics.py --dump
    .venv/bin/python tools/log_metrics.py --since '2026-07-30 14:43:21'
    .venv/bin/python tools/log_metrics.py --all
"""
from __future__ import annotations

import argparse
import os
import re
import statistics as st
from datetime import datetime

LOG = os.path.expanduser("~/Library/Logs/Merlin/service.log")
TS = re.compile(r"^(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d,\d\d\d)")


def ts(line: str):
    m = TS.match(line)
    return datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S,%f") if m else None


def pct(xs, p):
    if not xs:
        return None
    xs = sorted(xs)
    k = (len(xs) - 1) * p
    lo = int(k)
    hi = min(lo + 1, len(xs) - 1)
    return xs[lo] + (xs[hi] - xs[lo]) * (k - lo)


def fmt(xs, unit="s"):
    if not xs:
        return "n=0"
    return (f"n={len(xs):<3d} mean={st.mean(xs):.2f}{unit} "
            f"median={st.median(xs):.2f}{unit} p95={pct(xs, 0.95):.2f}{unit} "
            f"min={min(xs):.2f} max={max(xs):.2f}")


class Turn:
    __slots__ = ("i0", "transcribing", "transcript", "llm_start", "llm_200",
                 "playback_started", "tts_audio", "first_pcm", "done",
                 "interrupted", "dups")

    def __init__(self, i0):
        self.i0 = i0
        self.transcribing = self.transcript = None
        self.llm_start = self.llm_200 = None
        self.playback_started = self.tts_audio = self.first_pcm = None
        self.done = None
        self.interrupted = None
        self.dups = []

    def d(self, a, b):
        if a and b:
            return round((b - a).total_seconds(), 3)
        return None

    def stats(self):
        return dict(
            stt=self.d(self.transcribing, self.transcript),
            llm=self.d(self.llm_start, self.llm_200),
            tts=self.d(self.playback_started, self.tts_audio),
            e2e=self.d(self.transcript, self.first_pcm),
        )


def find_start(lines, since, scan_all):
    if scan_all:
        find_start.provider = "ALL"
        return 0
    if since:
        want = datetime.strptime(since, "%Y-%m-%d %H:%M:%S")
        for i, l in enumerate(lines):
            t = ts(l)
            if t and t >= want:
                return i
        return len(lines)
    last, prov = 0, "?"
    for i, l in enumerate(lines):
        if "merlin.service — Ready." in l and "TTS=" in l:
            last = i
            m = re.search(r"TTS=(\w+)", l)
            if m:
                prov = m.group(1)
    find_start.provider = prov
    return last


find_start.provider = "?"


def parse(lines):
    turns, anomalies = [], 0
    wake_stt, wake_gap = [], []
    wakes_fired = wakes_nomatch = failed_captures = 0
    p_wake_whisper = p_wake_fired = None
    cur = None

    def close(t):
        nonlocal cur
        if cur is not None:
            cur.done = t
            turns.append(cur)
            cur = None

    for idx, l in enumerate(lines):
        t = ts(l)
        if t is None:
            continue

        # ── wake-level (independent of turns) ──────────────────────────
        if "Whisper ←" in l and "wake_trigger" in l:
            p_wake_whisper = t
        elif "WAKE_TRANSCRIPT=" in l:
            if p_wake_whisper:
                wake_stt.append((t - p_wake_whisper).total_seconds())
                p_wake_whisper = None
        elif "WAKE_MATCH=False" in l:
            wakes_nomatch += 1
        elif "wake fired" in l:
            wakes_fired += 1
            p_wake_fired = t
        elif "[rec] stream open" in l:
            if p_wake_fired:
                wake_gap.append((t - p_wake_fired).total_seconds())
                p_wake_fired = None
        elif ("returned 0 bytes" in l or "record_utterance: no speech" in l
              or "initial silence timeout" in l):
            failed_captures += 1

        # ── turn segmentation ──────────────────────────────────────────
        if "STT: transcribing" in l:
            if cur is not None and cur.done is None:
                anomalies += 1          # previous turn never finished
                cur = None
            cur = Turn(idx)
            cur.transcribing = t
        elif "STT: transcript=" in l and cur is not None:
            if cur.transcript is None:
                cur.transcript = t
            else:
                cur.dups.append("transcript")
        elif "stream_response: LLM streaming start" in l:
            if cur is None:                     # LLM turn with no STT (rare path)
                cur = Turn(idx)
            elif cur.llm_start is not None:
                anomalies += 1
                cur = Turn(idx)
            cur.llm_start = t
        elif "api.anthropic.com/v1/messages" in l and "200" in l and cur is not None:
            # Only the first Anthropic 200 AFTER llm_start is the streaming reply.
            # Calls before llm_start are the previous turn's background
            # memory-extraction calls completing; calls after the first are this
            # turn's own background calls.  Ignoring both prevents mispairing
            # (which produced negative LLM latencies in v2's first draft).
            if cur.llm_start is not None and cur.llm_200 is None:
                cur.llm_200 = t
            elif cur.llm_200 is not None:
                cur.dups.append("anthropic200")
        elif "stream_response: playback started" in l and cur is not None:
            if cur.playback_started is None:
                cur.playback_started = t
        elif "openai_tts model=" in l and cur is not None:
            if cur.tts_audio is None:
                cur.tts_audio = t
        elif "playback: pcm" in l and cur is not None:
            if cur.first_pcm is None:
                cur.first_pcm = t
        elif "LLM+TTS: done" in l and cur is not None:
            cur.interrupted = "interrupted=True" in l
            close(t)

    return dict(turns=turns, anomalies=anomalies, wake_stt=wake_stt,
                wake_gap=wake_gap, wakes_fired=wakes_fired,
                wakes_nomatch=wakes_nomatch, failed_captures=failed_captures)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--since")
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--log", default=LOG)
    ap.add_argument("--dump", action="store_true",
                    help="print each turn's paired raw timestamps for auditing")
    args = ap.parse_args()

    lines = open(args.log, encoding="utf-8", errors="replace").read().splitlines()
    start = find_start(lines, args.since, args.all)
    lines = lines[start:]
    # Derive the window span from lines that actually carry a timestamp.  Using
    # lines[0]/lines[-1] directly crashed when the last line had no timestamp
    # (e.g. a Traceback / CoreAudio tail): span[1] was None and the later
    # `span[1] - span[0]` raised TypeError.  Now both ends are valid together or
    # both None, so the existing `if span[0]:` guard is sufficient.
    stamps = [t for l in lines if (t := ts(l)) is not None]
    span = (stamps[0], stamps[-1]) if stamps else (None, None)

    r = parse(lines)
    turns = r["turns"]

    # A valid stage latency must be strictly positive.  Anything <=0 means a
    # mispaired marker slipped through; exclude it and count it so it can never
    # silently bias an aggregate.
    bad = {"stt": 0, "llm": 0, "tts": 0, "e2e": 0}

    def collect(key):
        out = []
        for x in map(Turn.stats, turns):
            v = x[key]
            if v is None:
                continue
            if v <= 0:
                bad[key] += 1
                continue
            out.append(v)
        return out

    stt, llm, tts, e2e = collect("stt"), collect("llm"), collect("tts"), collect("e2e")
    interrupted = sum(1 for t in turns if t.interrupted)

    if args.dump:
        print(f"{'#':>3} {'transcribing':>12} {'transcript':>11} {'llm_start':>10} "
              f"{'llm_200':>9} {'pb_start':>9} {'tts_aud':>8} {'1st_pcm':>8}  "
              f"| STT   LLM   TTS   E2E   flags")
        for n, t in enumerate(turns, 1):
            s = t.stats()
            g = lambda x: x.strftime("%H:%M:%S.%f")[:-3] if x else "        —   "
            flags = ("INT " if t.interrupted else "") + (" ".join(t.dups))
            print(f"{n:>3} {g(t.transcribing)} {g(t.transcript)} {g(t.llm_start)} "
                  f"{g(t.llm_200)} {g(t.playback_started)} {g(t.tts_audio)} {g(t.first_pcm)}  "
                  f"| {str(s['stt']):>5} {str(s['llm']):>5} {str(s['tts']):>5} {str(s['e2e']):>5} {flags}")
        print()

    prov = find_start.provider
    print("=" * 74)
    print(" MERLIN BASELINE REPORT  (read-only, v2 per-turn segmentation)")
    print("=" * 74)
    if span[0]:
        dur_h = (span[1] - span[0]).total_seconds() / 3600
        print(f" window : {span[0]}  →  {span[1]}   ({dur_h:.1f}h)")
    print(f" config : TTS provider = {prov}")
    print(f" sample : {len(turns)} completed turns across {r['wakes_fired']} wake events")
    print("-" * 74)
    print(" LATENCY (per stage)")
    print(f"   wake keyword STT   {fmt(r['wake_stt'])}")
    print(f"   wake→listen gap    {fmt(r['wake_gap'])}   ← measurable part of the capture gap")
    print(f"   command STT        {fmt(stt)}")
    print(f"   LLM (think)        {fmt(llm)}")
    print(f"   TTS (first audio)  {fmt(tts)}")
    print(f"   end-to-end*        {fmt(e2e)}   *transcript→first audio out")
    print("-" * 74)
    print(" RELIABILITY")
    print(f"   wake events              : {r['wakes_fired']}")
    print(f"   non-keyword VAD flushes  : {r['wakes_nomatch']}  (speech heard, not 'merlin')")
    print(f"   failed command captures  : {r['failed_captures']}")
    print(f"   completed turns          : {len(turns)}")
    print(f"   interrupted replies      : {interrupted}"
          + (f"  ({100*interrupted/len(turns):.0f}%)" if turns else ""))
    print(f"   parser anomalies         : {r['anomalies']}  (incomplete turns discarded, not mispaired)")
    print(f"   excluded non-positive lat: stt={bad['stt']} llm={bad['llm']} tts={bad['tts']} e2e={bad['e2e']}  (mispairs guarded out)")
    print("-" * 74)
    need = max(0, 20 - len(turns))
    print(f" STATUS : {'PRELIMINARY — need ~%d more turns' % need if need else 'sample >=20 turns'}")
    print("=" * 74)


if __name__ == "__main__":
    main()
