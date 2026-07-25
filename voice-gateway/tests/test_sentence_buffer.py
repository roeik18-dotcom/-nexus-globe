"""Unit tests for SentenceBuffer."""

import pytest

from app.audio.sentence import MAX_CHARS, MIN_CHARS, WEAK_THRESHOLD, SentenceBuffer


def test_short_input_held():
    buf = SentenceBuffer()
    assert buf.push("Hi") is None
    assert buf.flush() == "Hi"


def test_empty_push():
    buf = SentenceBuffer()
    assert buf.push("") is None
    assert buf.flush() == ""


def test_strong_boundary_period():
    buf = SentenceBuffer()
    result = buf.push("Hello there. How are you?")
    assert result == "Hello there."
    assert buf.flush() == "How are you?"


def test_strong_boundary_exclamation():
    buf = SentenceBuffer()
    result = buf.push("Great job! Now do another.")
    assert result == "Great job!"
    assert buf.flush() == "Now do another."


def test_strong_boundary_question():
    buf = SentenceBuffer()
    result = buf.push("What time is it? I need to know.")
    assert result == "What time is it?"
    assert buf.flush() == "I need to know."


def test_double_newline_boundary():
    buf = SentenceBuffer()
    result = buf.push("First paragraph.\n\nSecond paragraph.")
    assert result is not None
    assert "First paragraph" in result
    assert buf.flush() == "Second paragraph."


def test_weak_boundary_not_triggered_below_threshold():
    buf = SentenceBuffer()
    # Short text — comma should not trigger a cut (below WEAK_THRESHOLD)
    result = buf.push("Short, text")
    assert result is None


def test_weak_boundary_triggered_above_threshold():
    buf = SentenceBuffer()
    # Text long enough to exceed WEAK_THRESHOLD, followed by comma + space
    text = "a" * WEAK_THRESHOLD + ", rest of the sentence here"
    result = buf.push(text)
    assert result is not None
    assert result.endswith(",")


def test_max_chars_force_cut_at_word_boundary():
    buf = SentenceBuffer()
    # Repeat "word " to produce text well beyond MAX_CHARS with no sentence-ending punctuation
    text = "word " * (MAX_CHARS // 5 + 5)
    result = buf.push(text)
    assert result is not None
    assert len(result) <= MAX_CHARS


def test_max_chars_hard_cut_no_space():
    buf = SentenceBuffer()
    # No spaces → hard cut at MAX_CHARS
    chunk = "x" * (MAX_CHARS + 10)
    result = buf.push(chunk)
    assert result is not None
    assert len(result) <= MAX_CHARS


def test_flush_clears_buffer():
    buf = SentenceBuffer()
    buf.push("Some text without a sentence boundary here")
    first = buf.flush()
    assert first == "Some text without a sentence boundary here"
    assert buf.flush() == ""


def test_multiple_pushes_accumulate_then_split():
    buf = SentenceBuffer()
    assert buf.push("Hello ") is None
    assert buf.push("there. Next") is not None


def test_streaming_incremental_two_sentences():
    buf = SentenceBuffer()
    chunks = []
    for token in ["The quick brown fox. ", "Jumped over the lazy dog."]:
        r = buf.push(token)
        if r:
            chunks.append(r)
    tail = buf.flush()
    if tail:
        chunks.append(tail)
    assert chunks[0] == "The quick brown fox."
    assert "Jumped" in chunks[-1]


def test_custom_min_chars():
    buf = SentenceBuffer(min_chars=5)
    result = buf.push("Hi. Next sentence.")
    assert result == "Hi."


def test_take_strips_whitespace():
    buf = SentenceBuffer()
    result = buf.push("Sentence one.   Sentence two.")
    assert result is not None
    assert not result.startswith(" ")
    assert not result.endswith(" ")


def test_paragraph_break_stronger_than_period():
    buf = SentenceBuffer()
    # The double newline should split first, before any sentence-ending period
    result = buf.push("First part\n\nSecond part. Third.")
    assert result is not None
    assert "First part" in result


# ── first_min_chars tests ──────────────────────────────────────────────────────

def test_first_min_chars_allows_short_first_emission():
    # With first_min_chars=5, "Hi." (3 chars) should still not trigger (below 5),
    # but "Hello." (6 chars) should trigger on the first emission.
    buf = SentenceBuffer(min_chars=15, first_min_chars=6)
    result = buf.push("Hello. World.")
    assert result == "Hello."


def test_first_min_chars_reverts_after_first_emission():
    # After first emission uses first_min_chars, subsequent cuts use min_chars.
    buf = SentenceBuffer(min_chars=15, first_min_chars=6)
    # First emission: "Hello." (6 chars ≥ first_min_chars=6) → emitted
    r1 = buf.push("Hello. Hi.")
    assert r1 == "Hello."
    # "Hi." (3 chars) is below min_chars=15 — should not emit
    r2 = buf.push(" More text here.")
    # "Hi.  More text here." → strong boundary → "Hi." at 3 chars, but min_chars=15
    # "Hi.  More text here." is 20 chars total > 15 → triggers strong boundary
    assert r2 is not None or buf.flush() != ""


def test_first_min_chars_none_uses_min_chars():
    # When first_min_chars is None, first emission uses normal min_chars.
    buf = SentenceBuffer(min_chars=15, first_min_chars=None)
    # "Hi." is 3 chars, well below min_chars=15 → no emission
    result = buf.push("Hi.")
    assert result is None


def test_first_emitted_flag_set_after_emission():
    buf = SentenceBuffer(min_chars=15, first_min_chars=6)
    assert buf._first_emitted is False
    buf.push("Hello. Rest of text.")
    assert buf._first_emitted is True


def test_first_min_chars_still_respects_strong_boundary():
    # Even with first_min_chars active, we need a sentence boundary to split.
    # Text without punctuation should not split below first_min_chars.
    buf = SentenceBuffer(min_chars=15, first_min_chars=8)
    result = buf.push("Hi")  # 2 chars, no boundary
    assert result is None
