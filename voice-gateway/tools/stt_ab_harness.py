#!/usr/bin/env python3
"""Offline A/B STT evaluation harness — EVALUATION ONLY.

Compares the SAME captured WAV corpus against two OpenAI transcription paths:
  A) gpt-4o-transcribe  (current production path)
  B) whisper-1          (exposes verbose_json confidence metadata)

This is a measurement tool. It NEVER changes production configuration, never
edits runtime files, and never picks a production model. It only reads WAVs,
calls the transcription API for each model, and writes a report.

Missing metadata is reported as the literal string "UNAVAILABLE" — never faked.

Corpus: a directory of .wav files (e.g. the capture probe's output at
~/Library/Logs/Merlin/capture). Optional ground truth per WAV:
  - a sibling  <name>.expected.txt   (one line of expected Hebrew), OR
  - a manifest.json  { "<name>.wav": "expected hebrew text", ... }
If a sibling <name>.json exists (capture-probe metadata) its "transcript" is
shown as a REFERENCE ("what the runtime got") — NOT treated as ground truth.

Usage:
  python tools/stt_ab_harness.py --corpus ~/Library/Logs/Merlin/capture \
      --language he --out stt_ab_report
  # writes stt_ab_report.json and stt_ab_report.md
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import wave
from pathlib import Path

UNAVAILABLE = "UNAVAILABLE"

# Common Whisper/low-SNR stock hallucinations (multilingual). Substring match,
# case-insensitive, on the stripped transcript.
STOCK_HALLUCINATIONS = [
    "thank you", "thanks for watching", "please subscribe", "amara.org",
    "字幕", "ご視聴", "视频", "뉴스", "mbc", "nhk", "はい。", "you",
    "תודה על הצפייה", "תודה שצפיתם",
]

HEB_LO, HEB_HI = 0x0590, 0x05FF


# ── pure analysis helpers (unit-tested, no network) ───────────────────────────

def hebrew_fraction(text: str) -> float:
    """Fraction of alphabetic characters that are Hebrew. 0.0 if no letters."""
    heb = latin = 0
    for c in text or "":
        o = ord(c)
        if HEB_LO <= o <= HEB_HI:
            heb += 1
        elif ("a" <= c.lower() <= "z"):
            latin += 1
    total = heb + latin
    return (heb / total) if total else 0.0


def is_non_hebrew_mismatch(text: str, expect_hebrew: bool = True, threshold: float = 0.30) -> bool:
    """True when Hebrew was expected but the transcript is mostly non-Hebrew.

    A transcript with no letters at all (pure punctuation/empty) is NOT a
    language mismatch — it is handled by the empty/hallucination checks.
    """
    if not expect_hebrew:
        return False
    if not (text or "").strip():
        return False
    if not any(c.isalpha() for c in text):
        return False
    return hebrew_fraction(text) < threshold


def max_token_run(text: str) -> int:
    """Longest run of one identical whitespace-token (repetition hallucination)."""
    toks = (text or "").split()
    if not toks:
        return 0
    best = run = 1
    for i in range(1, len(toks)):
        run = run + 1 if toks[i] == toks[i - 1] else 1
        best = max(best, run)
    return best


def hallucination_flag(text: str, compression_ratio=None) -> bool:
    """Heuristic 'obvious hallucination'. Never authoritative — a flag for review."""
    t = (text or "").strip().lower()
    if not t:
        return False  # empty is 'no speech', flagged separately, not a hallucination
    if any(s in t for s in STOCK_HALLUCINATIONS):
        return True
    if max_token_run(text) >= 4:
        return True
    if isinstance(compression_ratio, (int, float)) and compression_ratio > 2.4:
        return True
    return False


def aggregate_segments(segments) -> dict:
    """Mean no_speech_prob / avg_logprob / compression_ratio across verbose_json
    segments. Returns UNAVAILABLE for any field no segment provides."""
    def field(name):
        vals = []
        for s in segments or []:
            v = s.get(name) if isinstance(s, dict) else getattr(s, name, None)
            if isinstance(v, (int, float)):
                vals.append(float(v))
        return round(sum(vals) / len(vals), 5) if vals else UNAVAILABLE
    return {
        "no_speech_prob": field("no_speech_prob"),
        "avg_logprob": field("avg_logprob"),
        "compression_ratio": field("compression_ratio"),
    }


def _as_dict(obj):
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj
    for m in ("model_dump", "to_dict", "dict"):
        f = getattr(obj, m, None)
        if callable(f):
            try:
                return f()
            except Exception:
                pass
    return None


def extract_metadata(response, response_format: str) -> dict:
    """Normalize metadata from a transcription response.

    verbose_json (whisper-1) → language/duration + aggregated segment stats.
    json/text (gpt-4o-transcribe) → confidence stats are UNAVAILABLE.
    """
    d = _as_dict(response) or {}
    language = d.get("language", UNAVAILABLE) or UNAVAILABLE
    duration = d.get("duration", UNAVAILABLE)
    if response_format == "verbose_json":
        stats = aggregate_segments(d.get("segments"))
    else:
        stats = {"no_speech_prob": UNAVAILABLE, "avg_logprob": UNAVAILABLE, "compression_ratio": UNAVAILABLE}
    return {"language": language, "duration": duration, **stats}


def wav_duration_seconds(path) -> float:
    with wave.open(str(path), "rb") as w:
        fr = w.getframerate()
        return round(w.getnframes() / fr, 3) if fr else 0.0


def build_row(*, filename, duration, expected, runtime_ref, model, response_format,
              text, metadata, latency_ms, error, expect_hebrew=True) -> dict:
    """Assemble one (wav, model) result row. Pure — unit-tested."""
    return {
        "filename": filename,
        "duration_s": duration,
        "expected_hebrew": expected if expected else UNAVAILABLE,
        "runtime_reference_transcript": runtime_ref if runtime_ref else UNAVAILABLE,
        "model": model,
        "response_format": response_format,
        "transcript": text if text is not None else UNAVAILABLE,
        "language": metadata.get("language", UNAVAILABLE),
        "no_speech_prob": metadata.get("no_speech_prob", UNAVAILABLE),
        "avg_logprob": metadata.get("avg_logprob", UNAVAILABLE),
        "compression_ratio": metadata.get("compression_ratio", UNAVAILABLE),
        "latency_ms": latency_ms if latency_ms is not None else UNAVAILABLE,
        "error": error or "",
        "hallucination_flag": bool(text) and hallucination_flag(text, metadata.get("compression_ratio")),
        "non_hebrew_mismatch_flag": bool(text) and is_non_hebrew_mismatch(text, expect_hebrew),
    }


# ── API layer (network; not exercised by unit tests) ──────────────────────────

def _load_env_key(root: Path) -> str:
    envp = root / ".env"
    if envp.exists():
        for line in envp.read_text(encoding="utf-8", errors="replace").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and line.startswith("OPENAI_API_KEY="):
                return line.split("=", 1)[1].strip()
    return os.environ.get("OPENAI_API_KEY", "")


def _format_for(model: str) -> str:
    # gpt-4o-transcribe rejects verbose_json (HTTP 400); whisper-1 supports it.
    return "json" if model.startswith("gpt-4o") else "verbose_json"


def transcribe(client, model: str, wav_path: Path, language: str) -> dict:
    """One API call. Returns {text, metadata, latency_ms, error, response_format}."""
    fmt = _format_for(model)
    t0 = time.perf_counter()
    try:
        with open(wav_path, "rb") as fh:
            resp = client.audio.transcriptions.create(
                model=model, file=fh, language=language, response_format=fmt,
            )
        latency = round((time.perf_counter() - t0) * 1000)
        text = (getattr(resp, "text", None) or (resp.get("text") if isinstance(resp, dict) else None) or "").strip()
        return {"text": text, "metadata": extract_metadata(resp, fmt),
                "latency_ms": latency, "error": "", "response_format": fmt}
    except Exception as e:
        latency = round((time.perf_counter() - t0) * 1000)
        return {"text": None,
                "metadata": {"language": UNAVAILABLE, "duration": UNAVAILABLE,
                             "no_speech_prob": UNAVAILABLE, "avg_logprob": UNAVAILABLE,
                             "compression_ratio": UNAVAILABLE},
                "latency_ms": latency, "error": f"{type(e).__name__}: {e}", "response_format": fmt}


def load_expected(corpus: Path) -> dict:
    manifest = corpus / "manifest.json"
    m = {}
    if manifest.exists():
        try:
            m = json.loads(manifest.read_text(encoding="utf-8"))
        except Exception:
            m = {}
    return m


def runtime_reference(wav: Path) -> str | None:
    sidecar = wav.with_suffix(".json")
    if sidecar.exists():
        try:
            return json.loads(sidecar.read_text(encoding="utf-8")).get("transcript")
        except Exception:
            return None
    return None


def run_corpus(corpus: Path, models, language: str, limit: int | None) -> list[dict]:
    from openai import OpenAI
    key = _load_env_key(Path(__file__).resolve().parents[1])
    if not key:
        raise SystemExit("OPENAI_API_KEY not found in .env or environment")
    client = OpenAI(api_key=key)
    manifest = load_expected(corpus)
    wavs = sorted(corpus.glob("*.wav"))
    if limit:
        wavs = wavs[:limit]
    rows = []
    for wav in wavs:
        try:
            dur = wav_duration_seconds(wav)
        except Exception:
            dur = UNAVAILABLE
        exp = manifest.get(wav.name)
        exp_txt = wav.with_suffix(".expected.txt")
        if not exp and exp_txt.exists():
            exp = exp_txt.read_text(encoding="utf-8").strip()
        ref = runtime_reference(wav)
        for model in models:
            r = transcribe(client, model, wav, language)
            rows.append(build_row(
                filename=wav.name, duration=dur, expected=exp, runtime_ref=ref,
                model=model, response_format=r["response_format"], text=r["text"],
                metadata=r["metadata"], latency_ms=r["latency_ms"], error=r["error"],
            ))
            print(f"  {wav.name:32s} {model:20s} "
                  f"{'ERR' if r['error'] else 'ok '} lat={r['latency_ms']}ms "
                  f"halluc={rows[-1]['hallucination_flag']} "
                  f"non_he={rows[-1]['non_hebrew_mismatch_flag']}", flush=True)
    return rows


def write_report(rows: list[dict], out: str):
    Path(out + ".json").write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")
    cols = ["filename", "model", "transcript", "language", "no_speech_prob",
            "avg_logprob", "compression_ratio", "latency_ms", "hallucination_flag",
            "non_hebrew_mismatch_flag", "error"]
    lines = ["# STT A/B evaluation report", "", "| " + " | ".join(cols) + " |",
             "|" + "|".join("---" for _ in cols) + "|"]
    for r in rows:
        lines.append("| " + " | ".join(str(r.get(c, "")).replace("\n", " ")[:60] for c in cols) + " |")
    Path(out + ".md").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"\nwrote {out}.json and {out}.md  ({len(rows)} rows)")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Offline A/B STT evaluation (no production changes)")
    ap.add_argument("--corpus", required=True, help="directory of .wav files")
    ap.add_argument("--models", nargs="+", default=["gpt-4o-transcribe", "whisper-1"])
    ap.add_argument("--language", default="he")
    ap.add_argument("--out", default="stt_ab_report")
    ap.add_argument("--limit", type=int, default=None)
    a = ap.parse_args(argv)
    corpus = Path(a.corpus).expanduser()
    if not corpus.is_dir():
        raise SystemExit(f"corpus dir not found: {corpus}")
    print(f"A/B: models={a.models} language={a.language} corpus={corpus}")
    rows = run_corpus(corpus, a.models, a.language, a.limit)
    write_report(rows, a.out)


if __name__ == "__main__":
    main()
