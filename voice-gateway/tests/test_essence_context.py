"""Tests for essence_context — defense-in-depth filtering, provenance, degradation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.essence_context import _build_context_block, fetch_essence_context
from app.config import settings

# ── _build_context_block unit tests ──────────────────────────────────────────

SAMPLE_SUMMARY = {
    "profileId": "u1",
    "retrievedAt": "2026-07-26T12:00:00.000Z",
    "retrievalMode": "task_relevant",
    "nodes": {
        "Preferences": {
            "nodeId": "Preferences",
            "layer": "expression",
            "content": "dark mode, minimal UI",
            "confidence": "medium",
            "sensitivity": "personal",
            "temporalKind": "trait",
            "evidenceStatus": "referenced",
        },
        "Values": {
            "nodeId": "Values",
            "layer": "core",
            "content": "autonomy, quality, depth",
            "confidence": "high",
            "sensitivity": "public",
            "temporalKind": "trait",
            "evidenceStatus": "referenced",
        },
    },
    "activeState": [],
    "unresolvedConflictCount": 0,
}


def test_provenance_line_is_present():
    block = _build_context_block(SAMPLE_SUMMARY)
    assert "Essence context retrieved at 2026-07-26T12:00:00.000Z" in block
    assert "This is a snapshot and may be outdated." in block


def test_provenance_has_no_markdown_heading():
    block = _build_context_block(SAMPLE_SUMMARY)
    assert not block.startswith("#")


def test_allowed_nodes_appear_in_output():
    block = _build_context_block(SAMPLE_SUMMARY)
    assert "Preferences: dark mode, minimal UI" in block
    assert "Values: autonomy, quality, depth" in block


def test_defense_in_depth_filters_disallowed_layer():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Aspirations_Becoming": {
                "nodeId": "Aspirations_Becoming",
                "layer": "aspirations",  # NOT in Merlin's layers
                "content": "become a master",
                "sensitivity": "personal",
            }
        },
    }
    block = _build_context_block(summary)
    assert "Aspirations_Becoming" not in block
    assert "become a master" not in block


def test_defense_in_depth_filters_high_sensitivity():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "SomeNode": {
                "nodeId": "SomeNode",
                "layer": "core",
                "content": "sensitive data",
                "sensitivity": "private",  # exceeds Merlin's maxSensitivity
            }
        },
    }
    block = _build_context_block(summary)
    assert "sensitive data" not in block


def test_defense_in_depth_filters_highly_sensitive():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "SomeNode": {
                "nodeId": "SomeNode",
                "layer": "identity",
                "content": "top secret",
                "sensitivity": "highly_sensitive",
            }
        },
    }
    block = _build_context_block(summary)
    assert "top secret" not in block


def test_output_respects_char_limit():
    long_content = "x" * 2000
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Preferences": {
                "nodeId": "Preferences",
                "layer": "expression",
                "content": long_content,
                "sensitivity": "personal",
            }
        },
    }
    block = _build_context_block(summary)
    assert len(block) <= 800


def test_empty_nodes_returns_empty_string():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {},
    }
    assert _build_context_block(summary) == ""


def test_all_nodes_filtered_returns_empty_string():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Bad": {
                "nodeId": "Bad",
                "layer": "aspirations",  # filtered
                "content": "something",
                "sensitivity": "personal",
            }
        },
    }
    assert _build_context_block(summary) == ""


# ── fetch_essence_context integration tests ───────────────────────────────────

def _make_mock_client(status: int = 200, json_data: dict | None = None):
    mock_resp = MagicMock()
    mock_resp.status_code = status
    mock_resp.json.return_value = json_data or SAMPLE_SUMMARY

    mock_client = AsyncMock()
    mock_client.get = AsyncMock(return_value=mock_resp)
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    return mock_client


@pytest.mark.asyncio
async def test_returns_context_block_on_success():
    with patch.object(settings, "internal_essence_token", "test-token"), \
         patch.object(settings, "essence_base_url", "http://localhost:3000"), \
         patch("httpx.AsyncClient", return_value=_make_mock_client()):
        result = await fetch_essence_context("u1")

    assert "Essence context retrieved at" in result
    assert len(result) > 0


@pytest.mark.asyncio
async def test_graceful_degradation_on_http_error():
    with patch.object(settings, "internal_essence_token", "test-token"), \
         patch.object(settings, "essence_base_url", "http://localhost:3000"), \
         patch("httpx.AsyncClient", return_value=_make_mock_client(status=403)):
        result = await fetch_essence_context("u1")

    assert result == ""


@pytest.mark.asyncio
async def test_graceful_degradation_on_network_error():
    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=None)
    mock_client.get = AsyncMock(side_effect=ConnectionError("refused"))

    with patch.object(settings, "internal_essence_token", "test-token"), \
         patch.object(settings, "essence_base_url", "http://localhost:3000"), \
         patch("httpx.AsyncClient", return_value=mock_client):
        result = await fetch_essence_context("u1")

    assert result == ""


@pytest.mark.asyncio
async def test_returns_empty_when_token_not_configured():
    with patch.object(settings, "internal_essence_token", None):
        result = await fetch_essence_context("u1")
    assert result == ""


@pytest.mark.asyncio
async def test_request_includes_bearer_token_and_actor_header():
    mock_client = _make_mock_client()

    with patch.object(settings, "internal_essence_token", "secret-abc"), \
         patch.object(settings, "essence_base_url", "http://localhost:3000"), \
         patch("httpx.AsyncClient", return_value=mock_client):
        await fetch_essence_context("u1")

    call_kwargs = mock_client.get.call_args
    headers = call_kwargs[1]["headers"] if call_kwargs[1] else call_kwargs.kwargs["headers"]
    assert headers["Authorization"] == "Bearer secret-abc"
    assert headers["X-Essence-Actor"] == "merlin"
