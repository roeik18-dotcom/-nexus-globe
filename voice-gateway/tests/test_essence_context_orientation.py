"""Tests for orientation-dimension rendering in _build_context_block."""

import pytest

from app.essence_context import _build_context_block, _build_orientation_block


# ── Helpers ───────────────────────────────────────────────────────────────────

def _orientation_node(value: str, temporal_kind: str = "trait") -> dict:
    return {
        "layer": "expression",
        "sensitivity": "personal",
        "temporalKind": temporal_kind,
        "content": value,
    }


def _summary_with_orientation(**kwargs: str) -> dict:
    """Build a minimal summary containing only orientation nodes."""
    nodes = {}
    for node_id, value in kwargs.items():
        nodes[node_id] = _orientation_node(value)
    return {"retrievedAt": "2026-07-26T12:00:00.000Z", "nodes": nodes}


# ── _build_orientation_block unit tests ───────────────────────────────────────

def test_known_value_produces_fixed_sentence():
    block = _build_orientation_block({
        "OrientationResponseDepth": _orientation_node("brief"),
    })
    assert "Omit explanatory context unless asked." in block
    assert "brief" not in block  # raw value must not appear


def test_unknown_value_skips_dimension():
    block = _build_orientation_block({
        "OrientationResponseDepth": _orientation_node("verbose"),
        "OrientationTaskFraming": _orientation_node("action_first"),
    })
    assert "verbose" not in block
    assert "Open with the next concrete action." in block


def test_non_trait_temporal_kind_skips_dimension():
    block = _build_orientation_block({
        "OrientationResponseDepth": _orientation_node("brief", temporal_kind="state"),
        "OrientationTaskFraming": _orientation_node("action_first"),
    })
    assert "Omit explanatory context unless asked." not in block
    assert "Open with the next concrete action." in block


def test_empty_nodes_returns_empty_string():
    assert _build_orientation_block({}) == ""


def test_precedence_notice_present_with_at_least_one_dimension():
    block = _build_orientation_block({
        "OrientationResponseDepth": _orientation_node("brief"),
    })
    assert "Preferences are advisory; current requests and safety take priority." in block


def test_precedence_notice_absent_when_no_dimensions():
    block = _build_orientation_block({})
    assert "Preferences are advisory" not in block


def test_all_five_dimensions_rendered_when_all_valid():
    nodes = {
        "OrientationCommunicationStyle": _orientation_node("direct"),
        "OrientationResponseDepth": _orientation_node("brief"),
        "OrientationTaskFraming": _orientation_node("action_first"),
        "OrientationDecisionStyle": _orientation_node("decisive"),
        "OrientationTaskCadence": _orientation_node("single_step"),
    }
    block = _build_orientation_block(nodes)
    assert "Communicate directly — lead with the answer." in block
    assert "Omit explanatory context unless asked." in block
    assert "Open with the next concrete action." in block
    assert "Recommend one option directly." in block
    assert "Present only the immediate next step." in block
    assert "Preferences are advisory; current requests and safety take priority." in block


def test_orientation_block_within_max_budget():
    nodes = {
        "OrientationCommunicationStyle": _orientation_node("collaborative"),
        "OrientationResponseDepth": _orientation_node("explanatory"),
        "OrientationTaskFraming": _orientation_node("options_first"),
        "OrientationDecisionStyle": _orientation_node("deliberative"),
        "OrientationTaskCadence": _orientation_node("continuous"),
    }
    block = _build_orientation_block(nodes)
    assert len(block) <= 300


# ── _build_context_block orientation integration tests ────────────────────────

def test_orientation_block_appears_in_context():
    summary = _summary_with_orientation(OrientationResponseDepth="brief")
    block = _build_context_block(summary)
    assert "Omit explanatory context unless asked." in block


def test_orientation_nodes_excluded_from_generic_output():
    """Orientation nodes must not appear as 'NodeId: value' lines."""
    summary = _summary_with_orientation(OrientationResponseDepth="brief")
    block = _build_context_block(summary)
    assert "OrientationResponseDepth: brief" not in block
    assert "OrientationResponseDepth:" not in block


def test_raw_categorical_value_not_in_prompt_as_key_value():
    summary = _summary_with_orientation(
        OrientationResponseDepth="brief",
        OrientationCommunicationStyle="direct",
    )
    block = _build_context_block(summary)
    # Fixed sentences may contain the word 'direct', but not as a key: value pair
    assert "OrientationCommunicationStyle: direct" not in block
    assert "OrientationResponseDepth: brief" not in block


def test_provenance_present_even_when_orientation_absent():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Preferences": {
                "layer": "expression",
                "sensitivity": "personal",
                "content": "dark mode",
            }
        },
    }
    block = _build_context_block(summary)
    assert "Essence context retrieved at 2026-07-26T12:00:00.000Z" in block
    assert "OrientationResponseDepth" not in block


def test_generic_and_orientation_both_appear():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Preferences": {
                "layer": "expression",
                "sensitivity": "personal",
                "content": "dark mode",
            },
            "OrientationResponseDepth": {
                "layer": "expression",
                "sensitivity": "personal",
                "temporalKind": "trait",
                "content": "brief",
            },
        },
    }
    block = _build_context_block(summary)
    assert "Preferences: dark mode" in block
    assert "Omit explanatory context unless asked." in block


def test_defense_in_depth_filters_orientation_node_with_wrong_layer():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "OrientationResponseDepth": {
                "layer": "aspirations",  # wrong layer — filtered before orientation rendering
                "sensitivity": "personal",
                "temporalKind": "trait",
                "content": "brief",
            },
        },
    }
    block = _build_context_block(summary)
    assert "Omit explanatory context unless asked." not in block


def test_defense_in_depth_filters_orientation_node_with_high_sensitivity():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "OrientationResponseDepth": {
                "layer": "expression",
                "sensitivity": "private",  # exceeds maxSensitivity — filtered
                "temporalKind": "trait",
                "content": "brief",
            },
        },
    }
    block = _build_context_block(summary)
    assert "Omit explanatory context unless asked." not in block


def test_total_output_respects_char_limit():
    long_content = "x" * 2000
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "Preferences": {
                "layer": "expression",
                "sensitivity": "personal",
                "content": long_content,
            },
            "OrientationResponseDepth": {
                "layer": "expression",
                "sensitivity": "personal",
                "temporalKind": "trait",
                "content": "brief",
            },
        },
    }
    block = _build_context_block(summary)
    assert len(block) <= 800


def test_empty_when_all_nodes_filtered():
    summary = {
        "retrievedAt": "2026-07-26T12:00:00.000Z",
        "nodes": {
            "OrientationResponseDepth": {
                "layer": "aspirations",  # filtered
                "sensitivity": "personal",
                "temporalKind": "trait",
                "content": "brief",
            },
        },
    }
    assert _build_context_block(summary) == ""
