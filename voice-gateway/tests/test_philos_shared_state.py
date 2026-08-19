"""Tests for app.philos_shared_state — the Merlin-side HTTP client for
`GET /api/canon/shared-state`. No live server required: `_not_configured`
is exercised via monkeypatched env; network failure/success are exercised
via monkeypatched httpx.Client (same isolation discipline
`test_philos_orientation.py`-style modules in this repo already use).
"""
from __future__ import annotations

import httpx
import pytest

from app.philos_shared_state import fetch_shared_state


def test_returns_not_configured_when_token_missing(monkeypatch):
    monkeypatch.delenv("PHILOS_CANON_READ_TOKEN", raising=False)
    result = fetch_shared_state("person_roei")
    assert result.connected is False
    assert result.error == "not_configured"
    assert result.data is None


def test_returns_unauthorized_on_401(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_READ_TOKEN", "wrong-token")

    class _FakeResponse:
        status_code = 401

    class _FakeClient:
        def __init__(self, *a, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **kw): return _FakeResponse()

    monkeypatch.setattr(httpx, "Client", _FakeClient)
    result = fetch_shared_state("person_roei")
    assert result.connected is False
    assert result.http_status == 401
    assert result.error == "unauthorized"


def test_returns_connected_with_data_on_200(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_READ_TOKEN", "right-token")

    class _FakeResponse:
        status_code = 200
        def json(self): return {"subject_id": "person_roei", "human": {}}

    class _FakeClient:
        def __init__(self, *a, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **kw): return _FakeResponse()

    monkeypatch.setattr(httpx, "Client", _FakeClient)
    result = fetch_shared_state("person_roei")
    assert result.connected is True
    assert result.data["subject_id"] == "person_roei"


def test_never_raises_on_network_error(monkeypatch):
    monkeypatch.setenv("PHILOS_CANON_READ_TOKEN", "right-token")

    class _FakeClient:
        def __init__(self, *a, **kw): pass
        def __enter__(self): return self
        def __exit__(self, *a): return False
        def get(self, *a, **kw): raise httpx.ConnectError("boom")

    monkeypatch.setattr(httpx, "Client", _FakeClient)
    result = fetch_shared_state("person_roei")
    assert result.connected is False
    assert result.error == "network_error"


def test_never_writes_to_philos_never_imports_app_lib_philos_source():
    """Structural check, same discipline `philos_orientation.py` documents
    for itself: this module must never import PHILOS's own TS-adjacent
    source or call anything but a plain HTTP GET."""
    import inspect
    import app.philos_shared_state as mod
    source = inspect.getsource(mod)
    code_only = "\n".join(
        line for line in source.split("\n")
        if not line.strip().startswith("#")
    )
    # strip the module's own triple-quoted docstring (prose, not code)
    code_only = code_only.split('"""', 2)[-1] if code_only.count('"""') >= 2 else code_only
    assert "import app" not in code_only
    assert "from app.lib" not in code_only
    assert ".post(" not in code_only
    assert ".put(" not in code_only
    assert ".delete(" not in code_only
