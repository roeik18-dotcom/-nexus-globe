"""avg_logprob + known-hallucination-blocklist STT gate (2026-08-09).

Fixtures are the ACTUAL transcripts from the failed live spoken run
(service.log 2026-08-09 22:56-23:00): the "תודה רבה" family and a fluent
room-tone hallucination. Proves the hardened gate rejects exactly those while
never rejecting a real Merlin command or a real sentence that merely contains
the word "תודה".
"""
from service.turn_guard import evaluate_transcription_confidence


class _FakeTranscription:
    """Duck-typed app.providers.stt.base.Transcription: .text + .segments."""
    def __init__(self, text, segments=None):
        self.text = text
        self.segments = segments


def _seg(no_speech=0.1, compression=1.0, avg_logprob=-0.3):
    return {"no_speech_prob": no_speech, "compression_ratio": compression, "avg_logprob": avg_logprob}


# ── the exact observed garbage must now be REJECTED ──────────────────────────

def test_blocklist_rejects_bare_thank_you_hallucination():
    # T0001/T0002/T0005 live: STT='תודה רבה' with deceptively real-looking metadata
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription("תודה רבה", [_seg(no_speech=0.13, avg_logprob=-0.4)]))
    assert accept is False
    assert "known_hallucination_phrase" in reason


def test_blocklist_rejects_thank_you_plural_and_punctuation_and_rtl_marks():
    # T0010 'תודה רבה לכם'; T0012-15 '‫תודה רבה.' (RTL mark + period)
    for text in ("תודה רבה לכם", "‫תודה רבה.", "תודה רבה!"):
        accept, reason = evaluate_transcription_confidence(
            _FakeTranscription(text, [_seg(no_speech=0.2)]))
        assert accept is False, text
        assert "known_hallucination_phrase" in reason


def test_blocklist_works_without_any_segment_metadata():
    # providers that return no verbose_json still get the text-level backstop
    accept, reason = evaluate_transcription_confidence(_FakeTranscription("תודה רבה", None))
    assert accept is False and "known_hallucination_phrase" in reason


def test_avg_logprob_rejects_fluent_room_tone_hallucination():
    # T0007 live: fluent, non-repeating, LOW no_speech + LOW compression — the
    # class the old gate missed. avg_logprob is the discriminator.
    txt = "שוב הגעת אל החלון והרחמה קורית"
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription(txt, [_seg(no_speech=0.37, compression=1.0, avg_logprob=-1.3)]))
    assert accept is False
    assert "low_avg_logprob" in reason


# ── real speech and near-artifact real sentences must still be ACCEPTED ──────

def test_real_command_accepted():
    # the intended HUMAN query, with healthy metadata
    txt = "מרלין מה אתה יודע עליי ועל המטרות שלי"
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription(txt, [_seg(no_speech=0.08, compression=1.05, avg_logprob=-0.35)]))
    assert accept is True, reason


def test_fluent_text_with_healthy_avg_logprob_is_not_rejected():
    # same fluent text but with real-speech avg_logprob → accepted (proves the
    # gate keys on avg_logprob, not on the words themselves — no content ban)
    txt = "שוב הגעת אל החלון והרחמה קורית"
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription(txt, [_seg(no_speech=0.2, compression=1.0, avg_logprob=-0.45)]))
    assert accept is True, reason


def test_real_sentence_containing_toda_is_not_blocklisted():
    # "תודה" appears, but the whole utterance is a real sentence → must pass
    txt = "תודה על העזרה עם הפרויקט שלי אתמול בלילה"
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription(txt, [_seg(no_speech=0.1, compression=1.1, avg_logprob=-0.3)]))
    assert accept is True, reason


def test_substring_thank_you_not_rejected_by_blocklist():
    # contains 'תודה רבה' as a substring inside a longer real command
    txt = "תודה רבה ועכשיו תספר לי על הזהות המוזיקלית שלי"
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription(txt, [_seg(no_speech=0.12, compression=1.1, avg_logprob=-0.4)]))
    assert accept is True, reason


# ── pre-existing gates preserved (regression) ───────────────────────────────

def test_high_no_speech_still_rejected():
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription("garbled", [_seg(no_speech=0.7, avg_logprob=-0.3)]))
    assert accept is False and "high_no_speech_probability" in reason


def test_compression_repetition_still_rejected():
    accept, reason = evaluate_transcription_confidence(
        _FakeTranscription("לא לא לא לא", [_seg(no_speech=0.12, compression=1.6, avg_logprob=-0.3)]))
    assert accept is False and "likely_repetition_hallucination" in reason


def test_no_segments_non_blocklisted_fails_open():
    # MockSTT / no metadata + not a blocklist phrase → accept (missing data never blocks)
    accept, reason = evaluate_transcription_confidence(_FakeTranscription("שלום מרלין", None))
    assert accept is True and reason == ""
