"""Unit tests for tools/stt_ab_harness.py — pure logic only, NO network, NO
runtime files touched. Proves the harness's analysis is correct so its later
real-WAV output can be trusted.
"""
import io
import wave

import numpy as np
import pytest

import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location(
    "stt_ab_harness", Path(__file__).resolve().parents[1] / "tools" / "stt_ab_harness.py"
)
h = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(h)


def test_hebrew_fraction():
    assert h.hebrew_fraction("שלום") == 1.0
    assert h.hebrew_fraction("hello") == 0.0
    assert abs(h.hebrew_fraction("שלום world") - (4 / 9)) < 1e-6
    assert h.hebrew_fraction("") == 0.0
    assert h.hebrew_fraction("...123") == 0.0  # no letters


def test_non_hebrew_mismatch():
    assert h.is_non_hebrew_mismatch("שלום עולם") is False
    assert h.is_non_hebrew_mismatch("hello there") is True
    assert h.is_non_hebrew_mismatch("はい") is True          # foreign script, no Hebrew
    assert h.is_non_hebrew_mismatch("") is False              # empty is not a mismatch
    assert h.is_non_hebrew_mismatch("...") is False           # no letters is not a mismatch
    assert h.is_non_hebrew_mismatch("שלום", expect_hebrew=False) is False


def test_max_token_run_and_hallucination():
    assert h.max_token_run("פיל פיל פיל פיל") == 4
    assert h.max_token_run("מה השעה עכשיו") == 1
    assert h.hallucination_flag("Thank you.") is True         # stock phrase
    assert h.hallucination_flag("פיל פיל פיל פיל") is True     # repetition
    assert h.hallucination_flag("מה השעה עכשיו") is False
    assert h.hallucination_flag("") is False                  # empty ≠ hallucination
    assert h.hallucination_flag("ok", compression_ratio=3.0) is True


def test_aggregate_segments():
    segs = [
        {"no_speech_prob": 0.1, "avg_logprob": -0.2, "compression_ratio": 1.5},
        {"no_speech_prob": 0.3, "avg_logprob": -0.4, "compression_ratio": 1.7},
    ]
    agg = h.aggregate_segments(segs)
    assert agg["no_speech_prob"] == 0.2
    assert agg["avg_logprob"] == -0.3
    assert agg["compression_ratio"] == 1.6
    # empty / missing → UNAVAILABLE, never fabricated
    assert h.aggregate_segments([])["no_speech_prob"] == h.UNAVAILABLE
    assert h.aggregate_segments([{"text": "x"}])["avg_logprob"] == h.UNAVAILABLE


def test_extract_metadata_paths():
    vj = {"language": "hebrew", "duration": 2.0,
          "segments": [{"no_speech_prob": 0.05, "avg_logprob": -0.1, "compression_ratio": 1.2}]}
    m = h.extract_metadata(vj, "verbose_json")
    assert m["language"] == "hebrew" and m["no_speech_prob"] == 0.05
    # json path: confidence metadata is UNAVAILABLE (gpt-4o-transcribe)
    j = {"text": "שלום"}
    mj = h.extract_metadata(j, "json")
    assert mj["no_speech_prob"] == h.UNAVAILABLE
    assert mj["avg_logprob"] == h.UNAVAILABLE
    assert mj["compression_ratio"] == h.UNAVAILABLE


def test_format_for_model():
    assert h._format_for("gpt-4o-transcribe") == "json"
    assert h._format_for("whisper-1") == "verbose_json"


def test_wav_duration(tmp_path):
    p = tmp_path / "t.wav"
    sr = 16000
    data = (np.zeros(sr, dtype=np.int16))  # 1.0 s of silence
    with wave.open(str(p), "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(data.tobytes())
    assert abs(h.wav_duration_seconds(p) - 1.0) < 1e-3


def test_build_row_missing_metadata_is_unavailable():
    row = h.build_row(
        filename="x.wav", duration=1.2, expected=None, runtime_ref=None,
        model="gpt-4o-transcribe", response_format="json", text=None,
        metadata={"language": h.UNAVAILABLE}, latency_ms=None, error="Timeout",
    )
    assert row["transcript"] == h.UNAVAILABLE
    assert row["no_speech_prob"] == h.UNAVAILABLE
    assert row["latency_ms"] == h.UNAVAILABLE
    assert row["expected_hebrew"] == h.UNAVAILABLE
    assert row["error"] == "Timeout"
    # no text → flags are False (not fabricated positives)
    assert row["hallucination_flag"] is False
    assert row["non_hebrew_mismatch_flag"] is False


def test_build_row_flags_bad_transcript():
    row = h.build_row(
        filename="y.wav", duration=2.0, expected="מה השעה", runtime_ref="はい",
        model="whisper-1", response_format="verbose_json", text="Thank you for watching",
        metadata={"language": "english", "no_speech_prob": 0.8}, latency_ms=900, error="",
    )
    assert row["hallucination_flag"] is True
    assert row["non_hebrew_mismatch_flag"] is True
    assert row["runtime_reference_transcript"] == "はい"
