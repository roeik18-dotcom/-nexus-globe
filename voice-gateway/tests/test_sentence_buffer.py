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
