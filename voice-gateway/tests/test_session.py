"""Unit tests for session registry — no API keys required."""

import time
import pytest
from unittest.mock import patch


def test_create_and_get():
    from app.session import SessionRegistry
    reg = SessionRegistry()
    s = reg.create("abc")
    assert reg.get("abc") is s


def test_remove():
    from app.session import SessionRegistry
    reg = SessionRegistry()
    reg.create("abc")
    reg.remove("abc")
    assert reg.get("abc") is None


def test_not_expired_immediately():
    from app.session import SessionRegistry
    reg = SessionRegistry()
    reg.create("abc")
    assert not reg.check_expiry("abc")


def test_expired_after_limit(monkeypatch):
    from app.session import SessionRegistry, Session
    reg = SessionRegistry()
    # Create a session with started_at far in the past
    s = Session(session_id="abc", started_at=time.monotonic() - 9999)
    reg._sessions["abc"] = s
    assert reg.check_expiry("abc")


def test_missing_session_not_expired():
    from app.session import SessionRegistry
    reg = SessionRegistry()
    assert not reg.check_expiry("nonexistent")
