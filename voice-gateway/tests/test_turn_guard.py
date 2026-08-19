"""Unit tests for service.turn_guard.is_valid_utterance (PHASE 7)."""

from service.turn_guard import is_valid_utterance


def test_empty_transcript_rejected():
    assert is_valid_utterance("") is False


def test_whitespace_only_transcript_rejected():
    assert is_valid_utterance("   \n\t  ") is False


def test_ahem_rejected():
    assert is_valid_utterance("Ahem") is False
    assert is_valid_utterance("ahem") is False
    assert is_valid_utterance("Ahem.") is False


def test_pure_hesitation_rejected():
    assert is_valid_utterance("um") is False
    assert is_valid_utterance("uh, hmm") is False
    assert is_valid_utterance("אה") is False


def test_short_meaningful_word_accepted():
    """A short but real, meaningful word must NOT be treated as filler."""
    assert is_valid_utterance("עצור") is True   # "stop"
    assert is_valid_utterance("כן") is True     # "yes"
    assert is_valid_utterance("לא") is True     # "no"
    assert is_valid_utterance("stop") is True


def test_normal_sentence_accepted():
    assert is_valid_utterance("ספר לי על מערכת השמש") is True
    assert is_valid_utterance("tell me about the solar system") is True


def test_filler_followed_by_real_content_accepted():
    """"Ahem, tell me about Mars" is a real request that happens to start with
    a filler word — must not be discarded wholesale."""
    assert is_valid_utterance("Ahem, tell me about Mars") is True
