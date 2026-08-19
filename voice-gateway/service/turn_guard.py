"""PHASE 7 — smallest defensible validity gate for a raw STT transcript.

Not a language blacklist: a transcript is rejected only if, after
whitespace-normalization, it is empty OR consists ENTIRELY of one or more
tokens drawn from a small set of non-lexical interjections (throat-clearing,
hesitation sounds) with no other content. Any transcript that contains a
real word — including a single meaningful short word like "stop"/"עצור"/
"כן"/"לא" — passes. This is deliberately narrow: the failure this fixes
(service/merlin_service.py — STT transcript='Ahem' reaching the LLM as a
request) is a transcript that is PURELY filler, not a short transcript.
"""

from __future__ import annotations

import re

# Non-lexical interjections only — not a language/vocabulary blacklist.
# Hebrew and English forms of the same handful of sounds (throat clear,
# hesitation, generic acknowledgement-of-nothing).
_FILLER_TOKENS = frozenset({
    "ahem", "hm", "hmm", "hmmm", "uh", "um", "umm", "erm", "uhh",
    "אה", "אהם", "המ", "אמم",  # transliteration variants Whisper has produced
    "אמ", "אה אה",
})

_WORD_RE = re.compile(r"[^\W\d_]+", re.UNICODE)


def is_valid_utterance(transcript: str) -> bool:
    """False for empty/whitespace-only transcripts and pure-filler transcripts."""
    text = (transcript or "").strip()
    if not text:
        return False

    words = _WORD_RE.findall(text.lower())
    if not words:
        return False  # punctuation/noise only, no actual words

    return any(w not in _FILLER_TOKENS for w in words)


# ── bare wake-word guard (2026-08-10) ───────────────────────────────────────
# The wake word's own tail/echo can be captured as the "command" right after it
# fires, so the command STT returns just "מרלין" / "היי מרלין" and it becomes a
# phantom GENERAL turn. A bare wake word is NOT a user command: reject it so the
# turn is never minted (no LLM/TTS/memory/routing) and the runtime returns to
# standby. A REAL command that merely CONTAINS the wake word ("מרלין מה השעה")
# has >1 content word and passes untouched.
_WAKE_WORDS = frozenset({"מרלין", "מרלן", "מארלין", "merlin"})
_WAKE_PREFIXES = frozenset({"היי", "הי", "hey", "hi", "או", "אוקיי", "אוקי", "ok", "okay", "מרלין"})


def is_bare_wake_word(transcript: str) -> bool:
    """True iff the transcript is ESSENTIALLY only the wake word — optionally a
    leading greeting/address ('היי'/'hey') — i.e. the wake-word echo captured as
    a command. Multi-content-word commands containing the wake word return
    False. Normalizes with the same niqqud/punctuation/RTL-mark stripping as the
    hallucination blocklist."""
    t = _normalize_for_blocklist(transcript)
    if not t:
        return False
    words = t.split()
    while words and words[0] in _WAKE_PREFIXES and len(words) > 1:
        words = words[1:]
    return len(words) == 1 and words[0] in _WAKE_WORDS


# ── STT confidence gate (2026-08-07; avg_logprob + blocklist added 2026-08-09) ─
#
# no_speech_prob / compression_ratio thresholds are derived from a controlled
# real-hardware comparison — NOT invented — 6 samples captured through the real
# Babyface mic (4 known Hebrew sentences via TTS-through-speaker-through-mic, 1
# ambient/"silence", 1 attenuated-x20 low-signal), whisper-1/verbose_json:
#
#   sample        no_speech_prob   compression_ratio   verdict (by ear)
#   s1_short      0.837            0.90                garbled — WRONG content
#   s2_medium     0.121            1.31 (2 segs)        correct + trailing repetition ("לא לא לא לא")
#   s3_command    0.154            0.96                garbled — WRONG content
#   s4_long       0.111            1.60 (2 segs)        correct + injected repetition ("כן, אמרתי פרויקטים")
#   s5_silence    0.699            0.86                hallucinated Hebrew sentence from ambient noise
#   s6_low_signal 0.900            0.96                garbled — WRONG content
#
# no_speech_prob cleanly separated the 3 unusable samples (0.70-0.90) from
# the 3 with real captured speech (0.11-0.15) — REJECT_NO_SPEECH_PROB=0.6
# sits in the gap. compression_ratio flagged both repetition-hallucination
# cases (1.31, 1.60) while every non-repeating sample stayed under 1.0 —
# REJECT_COMPRESSION_RATIO=1.4 sits just above the highest clean sample.
#
# 2026-08-09 — FLUENT SILENCE-HALLUCINATIONS. A live spoken test produced
# grammatical, non-repeating Hebrew sentences fabricated from room tone
# (e.g. "שוב הגעת אל החלון...", and the "thank-you" family "תודה רבה"/
# "תודה רבה לכם"). These have LOW no_speech_prob (0.37-0.58, model is
# "confident" it is speech) and LOW compression_ratio (no repetition), so
# BOTH gates above miss them by construction. Two additional signals, each a
# DOCUMENTED value from proven Whisper stacks (NOT tuned here):
#   • avg_logprob floor -1.0 — the reject threshold used by OpenAI Whisper's
#     own fallback loop, whisper.cpp (--logprob-thold) and faster-whisper
#     (log_prob_threshold). A backstop: fluent hallucinations often but not
#     always fall below it, so it is necessary-not-sufficient.
#   • known-hallucination blocklist — the Home-Assistant / sachaarbonel
#     "whisper-hallucinations" backstop: a WHOLE short transcript that exactly
#     matches a curated Whisper silence artifact is dropped. Whole-utterance,
#     length-bounded, normalized match — a real sentence that merely CONTAINS
#     "תודה" is never rejected.
REJECT_NO_SPEECH_PROB = 0.6
REJECT_COMPRESSION_RATIO = 1.4
REJECT_AVG_LOGPROB = -1.0            # documented Whisper/whisper.cpp/faster-whisper floor

# ── Post-TTS echo gate (Merlin Product Recovery, 2026-08-17) ─────────────────
# Live incident, this session: right after a long TTS answer, the FIRST mic
# capture picked Merlin's own playback bleed (pre_norm_rms 0.0020-0.0033 —
# inside the 0.002-0.005 range real quiet speech also occupies on this rig,
# so the VAD floor CANNOT separate them; see vad_config.py's 2026-08-08 note
# reverting exactly that attempt). ×20 normalization turned the bleed into
# Hebrew garble ("כבר שבלעדו כמוהו שמבקש מבאדי") at whisper confidence 0.552,
# which passed every existing gate and minted a phantom turn.
#
# Measured confidence distribution on this rig (full service.log history):
# garble/echo cluster 0.34-0.60, real-speech cluster 0.66-0.99. The floor
# below applies ONLY to the one capture immediately following Merlin's own
# playback (the echo-risk window) — real quiet speech outside that window is
# untouched, and inside it a sub-0.62 decode right after Merlin spoke is far
# more likely playback bleed than the user.
POST_TTS_ECHO_MIN_CONFIDENCE = 0.62
_BLOCKLIST_MAX_LEN = 40             # only whole SHORT transcripts can be blocklist artifacts

# Curated Whisper silence/noise hallucinations (Hebrew + English), stored in
# normalized form (see _normalize_for_blocklist). The Hebrew "thank you for
# watching" family is Whisper's single most common Hebrew silence artifact and
# is never a real Merlin command; keep this list to high-confidence artifacts
# only — a false entry would silently swallow a real short command.
_HALLUCINATION_PHRASES = frozenset({
    "תודה רבה", "תודה רבה לכם", "תודה רבה על הצפייה", "תודה על הצפייה",
    "תודה שצפיתם", "תודה שצפיתם בסרטון", "תודה", "בבקשה", "להתראות",
    "הכתוביות נעשו על ידי", "הכתוביות נעשו על ידי אשר להב",
    "כתוביות: אלעד שם טוב", "עברית", "שלום לכולם",
    "thank you", "thanks for watching", "thank you for watching",
    "please subscribe", "subtitles by", "you",
})


def _normalize_for_blocklist(text: str) -> str:
    """NFC, strip niqqud + Unicode bidi/format marks + punctuation, collapse
    whitespace, lowercase (Latin). Turns 'תודה רבה.' / RTL-marked variants /
    'Thank you!' into the canonical blocklist key."""
    import unicodedata
    s = unicodedata.normalize("NFC", text or "")
    out = []
    for ch in s:
        o = ord(ch)
        if 0x0591 <= o <= 0x05C7:            # Hebrew niqqud/cantillation
            continue
        cat = unicodedata.category(ch)
        if cat[0] in ("P", "C"):             # punctuation + control/format (incl. RTL marks)
            out.append(" ")
            continue
        out.append(ch)
    s = "".join(out)
    s = re.sub(r"\s+", " ", s).strip().lower()
    return s


def evaluate_transcription_confidence(transcription, *, post_tts_echo_risk: bool = False) -> tuple[bool, str]:
    """Returns (accept, reason). `transcription` is an
    app.providers.stt.base.Transcription (duck-typed here to avoid an
    app-layer import from service/). Fails OPEN (accept) on the METADATA gates
    when no segment data is available at all — e.g. MockSTT, or a provider that
    doesn't expose verbose_json — consistent with this codebase's "missing data
    never blocks" convention. The text-level blocklist still applies, since it
    needs only .text.
    """
    # (0) whole-utterance known-hallucination blocklist — works on .text alone,
    #     so it catches the "תודה רבה"/"תודה רבה לכם" family even from providers
    #     that expose no segment metadata.
    text_norm = _normalize_for_blocklist(getattr(transcription, "text", "") or "")
    if text_norm and len(text_norm) <= _BLOCKLIST_MAX_LEN and text_norm in _HALLUCINATION_PHRASES:
        return False, f"known_hallucination_phrase({text_norm!r})"

    segments = getattr(transcription, "segments", None)
    if not segments:
        return True, ""

    no_speech = [s.get("no_speech_prob") for s in segments if s.get("no_speech_prob") is not None]
    if no_speech:
        mean_no_speech = sum(no_speech) / len(no_speech)
        if mean_no_speech >= REJECT_NO_SPEECH_PROB:
            return False, f"high_no_speech_probability({mean_no_speech:.2f})"

    compression = [s.get("compression_ratio") for s in segments if s.get("compression_ratio") is not None]
    if compression and max(compression) >= REJECT_COMPRESSION_RATIO:
        return False, f"likely_repetition_hallucination(compression_ratio={max(compression):.2f})"

    # (3) avg_logprob floor — low-confidence fluent decode (garble/hallucination
    #     the two gates above miss). Necessary-not-sufficient backstop.
    avg_lp = [s.get("avg_logprob") for s in segments if s.get("avg_logprob") is not None]
    if avg_lp:
        mean_lp = sum(avg_lp) / len(avg_lp)
        if mean_lp < REJECT_AVG_LOGPROB:
            return False, f"low_avg_logprob({mean_lp:.2f})"

    # (4) post-TTS echo window — see POST_TTS_ECHO_MIN_CONFIDENCE above.
    #     One-shot: the caller sets this ONLY for the first capture after
    #     Merlin's own playback. Missing confidence fails OPEN, same
    #     "missing data never blocks" convention as the metadata gates.
    if post_tts_echo_risk:
        conf = getattr(transcription, "confidence", None)
        # 2026-08-17 20:57 LIVE FALSE-POSITIVE: the user's real one-word
        # answer ("לפרויקטים.") right after Merlin's question scored 0.47
        # and was rejected as echo. Echo bleed of a long TTS answer decodes
        # as MULTI-WORD garble (the original phantom was 5 words); a short
        # 1–3-token reply after a question is the expected conversational
        # case and is almost never playback bleed. The floor now applies
        # only to ≥4-token decodes — the measured garble class — while the
        # filler/wake-word blocklists keep guarding short hallucinations.
        token_count = len((text_norm or "").split())
        if conf is not None and conf < POST_TTS_ECHO_MIN_CONFIDENCE and token_count >= 4:
            return False, f"post_tts_echo_suspect(confidence={conf:.2f}<{POST_TTS_ECHO_MIN_CONFIDENCE},tokens={token_count})"

    return True, ""
