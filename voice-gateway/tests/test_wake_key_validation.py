"""Tests for OpenAI API-key startup validation in service.wake_trigger.

These guard the regression where a *masked* value (full of • / … / *) was
written into .env, producing a per-frame UnicodeEncodeError flood in the
keyword-wake path.  Validation must reject such values up front with a clear,
key-safe message and never echo the key itself.
"""

import sys
from pathlib import Path

# Make the voice-gateway root importable so `service` resolves regardless of the
# directory pytest is invoked from.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from service.wake_trigger import validate_openai_api_key  # noqa: E402


# A realistic-looking but fake ASCII key (not a real secret).
VALID_KEY = "sk-proj-" + "A1b2C3d4" * 6


def test_valid_ascii_key_passes():
    ok, reason = validate_openai_api_key(VALID_KEY)
    assert ok is True
    assert reason == ""


def test_missing_key_none_fails():
    ok, reason = validate_openai_api_key(None)
    assert ok is False
    assert "missing or empty" in reason


def test_missing_key_empty_and_whitespace_fails():
    for value in ("", "   ", "\t\n"):
        ok, reason = validate_openai_api_key(value)
        assert ok is False, f"expected empty/whitespace {value!r} to fail"
        assert "missing or empty" in reason


def test_bullet_mangled_key_fails():
    # Mirrors the exact corruption seen in production: sk-proj- followed by
    # bullet (U+2022) masking glyphs.
    mangled = "sk-proj-" + "•" * 40
    ok, reason = validate_openai_api_key(mangled)
    assert ok is False
    assert "masking placeholder" in reason
    assert "bullet" in reason


def test_ellipsis_masked_key_fails():
    masked = "sk-proj-abc123" + "…"
    ok, reason = validate_openai_api_key(masked)
    assert ok is False
    assert "masking placeholder" in reason
    assert "ellipsis" in reason


def test_asterisk_masked_key_fails():
    masked = "sk-" + "*" * 40
    ok, reason = validate_openai_api_key(masked)
    assert ok is False
    assert "masking placeholder" in reason
    assert "asterisk" in reason


def test_generic_non_ascii_key_fails():
    # Non-ASCII that is not one of the explicit masking glyphs still fails.
    ok, reason = validate_openai_api_key("sk-proj-abc�médef123456")
    assert ok is False
    assert "non-ASCII" in reason


def test_wrong_prefix_key_fails():
    ok, reason = validate_openai_api_key("api-proj-abcdefghijklmnop")
    assert ok is False
    assert "prefix" in reason


def test_error_message_never_exposes_the_key():
    # Use a distinctive ASCII marker plus masking so the branch triggers while
    # the marker would be visible if the key were ever echoed.
    secret_marker = "SUPERSECRETMARKER1234567890"
    mangled = "sk-proj-" + secret_marker + "•" * 10
    ok, reason = validate_openai_api_key(mangled)
    assert ok is False
    assert secret_marker not in reason
    assert "•" not in reason  # the bullet glyph itself is not echoed back
