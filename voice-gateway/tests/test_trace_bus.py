"""Tests for TraceBus and the json_log_subscriber."""

import json
import logging
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.trace import SystemSnapshot, TraceStep, TurnTrace
from app.trace_bus import TraceBus


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _trace(user_text: str = "test") -> TurnTrace:
    return TurnTrace(session_id="s1", turn_id="t1", user_text=user_text)


# ---------------------------------------------------------------------------
# TraceBus
# ---------------------------------------------------------------------------

def test_subscriber_receives_published_trace():
    bus = TraceBus()
    received: list[TurnTrace] = []
    bus.subscribe(received.append)
    t = _trace()
    bus.publish(t)
    assert received == [t]


def test_multiple_subscribers_all_receive():
    bus = TraceBus()
    a: list[TurnTrace] = []
    b: list[TurnTrace] = []
    bus.subscribe(a.append)
    bus.subscribe(b.append)
    t = _trace()
    bus.publish(t)
    assert a == [t]
    assert b == [t]


def test_failing_subscriber_does_not_prevent_others():
    bus = TraceBus()
    received: list[TurnTrace] = []

    def bad(trace: TurnTrace) -> None:
        raise RuntimeError("boom")

    bus.subscribe(bad)
    bus.subscribe(received.append)
    t = _trace()
    bus.publish(t)           # must not raise
    assert received == [t]  # second subscriber still ran


def test_publish_with_no_subscribers_is_noop():
    bus = TraceBus()
    bus.publish(_trace())    # must not raise


def test_publish_multiple_traces_in_order():
    bus = TraceBus()
    received: list[str] = []
    bus.subscribe(lambda t: received.append(t.user_text))
    bus.publish(_trace("first"))
    bus.publish(_trace("second"))
    assert received == ["first", "second"]


# ---------------------------------------------------------------------------
# json_log_subscriber
# ---------------------------------------------------------------------------

def test_json_log_subscriber_emits_one_record(caplog):
    from app.observability.json_log import json_log_subscriber

    trace = _trace("hello world")
    with caplog.at_level(logging.INFO, logger="nexus.observability"):
        json_log_subscriber(trace)

    assert len(caplog.records) == 1


def test_json_log_subscriber_output_is_valid_json(caplog):
    from app.observability.json_log import json_log_subscriber

    trace = _trace("parse me")
    with caplog.at_level(logging.INFO, logger="nexus.observability"):
        json_log_subscriber(trace)

    data = json.loads(caplog.records[0].message)
    assert data["session_id"] == "s1"
    assert data["user_text"] == "parse me"


def test_json_log_subscriber_includes_steps(caplog):
    from app.observability.json_log import json_log_subscriber

    trace = _trace("analyze this")
    trace.add_step(TraceStep("nexus", "jarvis", "routing.start", latency_ms=5))
    trace.add_step(TraceStep("jarvis", "philos", "delegation.start", latency_ms=18))
    trace.add_step(
        TraceStep("philos", "jarvis", "delegation.complete",
                  latency_ms=900, confidence=0.85)
    )

    with caplog.at_level(logging.INFO, logger="nexus.observability"):
        json_log_subscriber(trace)

    data = json.loads(caplog.records[0].message)
    assert len(data["steps"]) == 3
    assert data["delegation"] is True
    assert data["steps"][2]["confidence"] == pytest.approx(0.85)


def test_json_log_subscriber_includes_snapshot(caplog):
    from app.observability.json_log import json_log_subscriber

    snap = SystemSnapshot(
        active_persona="jarvis",
        active_agents=["jarvis", "philos"],
        recall_items=8,
        summary_version=3,
        memory_items=241,
    )
    trace = TurnTrace(session_id="s1", turn_id="t1", user_text="hi", snapshot=snap)

    with caplog.at_level(logging.INFO, logger="nexus.observability"):
        json_log_subscriber(trace)

    data = json.loads(caplog.records[0].message)
    assert data["snapshot"]["active_persona"] == "jarvis"
    assert data["snapshot"]["memory_items"] == 241
    assert data["snapshot"]["active_agents"] == ["jarvis", "philos"]
