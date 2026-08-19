"""PATCH (reference, NOT applied) — content-hallucination rejection for the STT gate.

Root cause B4: service/turn_guard.py::evaluate_transcription_confidence rejects only
low `no_speech_prob` / high `compression_ratio`. Deterministic Whisper silence
hallucinations ("תודה רבה", "Hello, how are you", "おはようございます", …) carry a LOW
no_speech_prob when faint real audio is present, so they slip through and become a
turn — the observed "repeated command" behavior.

This adds a narrow, safe rejection: (1) the transcript, normalized, IS exactly one of
a small set of known stock silence-hallucinations; or (2) it is CJK/other clearly-
foreign script when Hebrew/English is expected. Both are conservative — a real short
command ("עצור", "כן", "בדוק רשת", "stop") never matches.

TO MERGE: call `reject_content_hallucination(text, expect_langs=("he","en"))` at the
top of evaluate_transcription_confidence (after the empty-segments fail-open), passing
the joined transcript text; if it returns a reason, return (False, reason).
"""
from __future__ import annotations
import re
import unicodedata

# Exact, whole-transcript stock hallucinations (normalized). NOT substring — so a real
# sentence that merely contains one of these words is unaffected.
_STOCK = {
    "תודה רבה", "תודה", "תודה על הצפייה", "תודה שצפיתם",
    "hello how are you", "i don't know", "thank you", "thanks for watching",
    "please subscribe", "you", "bye", "okay",
    "おはようございます", "ご視聴ありがとうございました", "字幕",
    "ありがとうございました", "뉴스", "mbc 뉴스",
}

_HEB = lambda o: 0x0590 <= o <= 0x05FF
_LAT = lambda c: "a" <= c.lower() <= "z"
_CJK_RANGES = ((0x3040, 0x30FF), (0x3400, 0x9FFF), (0xAC00, 0xD7A3))  # kana, CJK, hangul


def _norm(text: str) -> str:
    t = unicodedata.normalize("NFC", text or "").strip().lower()
    return re.sub(r"[\s\.\,\!\?。！？\"'׳״]+", " ", t).strip()


def _script_fraction(text: str):
    heb = lat = cjk = letters = 0
    for c in text or "":
        o = ord(c)
        is_cjk = any(a <= o <= b for a, b in _CJK_RANGES)
        if _HEB(o): heb += 1; letters += 1
        elif _LAT(c): lat += 1; letters += 1
        elif is_cjk: cjk += 1; letters += 1
        elif c.isalpha(): letters += 1
    if not letters:
        return 0.0, 0.0, 0.0
    return heb / letters, lat / letters, cjk / letters


def reject_content_hallucination(text: str, expect_langs=("he", "en")) -> str | None:
    """Return a rejection reason string, or None to accept."""
    norm = _norm(text)
    if not norm:
        return None  # empty is handled elsewhere (is_valid_utterance), fail-open here
    if norm in {_norm(s) for s in _STOCK}:
        return f"stock_silence_hallucination({norm!r})"
    heb_f, lat_f, cjk_f = _script_fraction(text)
    # Clearly-foreign script when we only expect Hebrew/English.
    if cjk_f >= 0.5 and "ja" not in expect_langs and "zh" not in expect_langs and "ko" not in expect_langs:
        return f"foreign_script_mismatch(cjk={cjk_f:.2f})"
    return None
