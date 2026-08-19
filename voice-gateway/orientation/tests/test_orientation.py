"""Phase-1 orientation-core tests (14 required cases). No audio, no network."""
import sys
import importlib

import pytest

from orientation import (
    DomainPolicy, Proactivity, DomainItem, DomainState, KnowledgeStatus,
    TopicSelector, DAY_OPENING, CONVERSATION, build_speech_plan, as_fact_statement,
    UnknownAsFactError, default_policies, domain_ids, day_opening_to_states,
)

SEL = TopicSelector()
NOW = 1_000_000.0


def pol(**kw):
    return DomainPolicy(**kw)


def st(domain_id, **kw):
    return DomainState(domain_id=domain_id, **kw)


def sel(states, policies, **kw):
    kw.setdefault("now", NOW)
    return SEL.select(states, policies, **kw)


# 1
def test_disabled_domain_never_selected():
    policies = {"a": pol(enabled=False, priority=10, proactivity=Proactivity.HIGH)}
    states = {"a": st("a", status=KnowledgeStatus.FACT)}
    assert sel(states, policies, explicit_request="a") == []


# 2
def test_higher_priority_wins_when_otherwise_equal():
    policies = {"a": pol(priority=5), "b": pol(priority=8)}
    states = {"a": st("a", status=KnowledgeStatus.FACT, confidence=0.5),
              "b": st("b", status=KnowledgeStatus.FACT, confidence=0.5)}
    r = sel(states, policies)
    assert r[0].domain_id == "b" and r[1].domain_id == "a"


# 3
def test_explicit_request_overrides_priority():
    policies = {"hi": pol(priority=9, proactivity=Proactivity.HIGH),
                "lo": pol(priority=1, proactivity=Proactivity.LOW)}
    states = {"hi": st("hi", status=KnowledgeStatus.FACT), "lo": st("lo", status=KnowledgeStatus.FACT)}
    r = sel(states, policies, explicit_request="lo")
    assert r[0].domain_id == "lo" and r[0].explicit_user_request is True


# 4
def test_stale_data_rejected_by_freshness():
    policies = {"a": pol(freshness_requirement=60.0, proactivity=Proactivity.HIGH)}
    fresh = {"a": st("a", status=KnowledgeStatus.FACT, last_updated=NOW - 10)}
    stale = {"a": st("a", status=KnowledgeStatus.FACT, last_updated=NOW - 600)}
    assert len(sel(fresh, policies)) == 1
    assert sel(stale, policies) == []                       # proactively rejected
    assert len(sel(stale, policies, explicit_request="a")) == 1  # explicit still allowed


# 5
def test_unknown_preserved_as_unknown():
    policies = {"a": pol(proactivity=Proactivity.HIGH)}
    states = {"a": st("a", status=KnowledgeStatus.UNKNOWN, unknown_reason="no source",
                      items=[DomainItem("no data", KnowledgeStatus.UNKNOWN)])}
    plan = build_speech_plan(sel(states, policies), context=CONVERSATION)
    assert plan.unknown and not plan.facts
    assert states["a"].status is KnowledgeStatus.UNKNOWN     # unchanged


# 6
def test_unknown_cannot_become_fact():
    it = DomainItem("mystery", KnowledgeStatus.UNKNOWN)
    with pytest.raises(UnknownAsFactError):
        as_fact_statement(it)
    with pytest.raises(UnknownAsFactError):
        as_fact_statement(DomainItem("guess", KnowledgeStatus.DERIVED))
    assert as_fact_statement(DomainItem("real", KnowledgeStatus.FACT)) == "real"


# 7
def test_completed_vs_open_items_distinguished():
    s = st("a", status=KnowledgeStatus.FACT, items=[
        DomainItem("done", KnowledgeStatus.FACT, open=False),
        DomainItem("todo", KnowledgeStatus.FACT, open=True),
    ])
    assert [i.text for i in s.open_items] == ["todo"]
    assert [i.text for i in s.completed_items] == ["done"]
    assert s.has_open_loop is True


# 8
def test_blocked_open_loop_outranks_low_priority_informational():
    policies = {"blocked": pol(priority=5, proactivity=Proactivity.MEDIUM),
                "info": pol(priority=6, proactivity=Proactivity.MEDIUM)}
    states = {
        "blocked": st("blocked", status=KnowledgeStatus.FACT,
                      items=[DomainItem("stuck", KnowledgeStatus.FACT, open=True, is_blocker=True)]),
        "info": st("info", status=KnowledgeStatus.FACT,
                   items=[DomainItem("fyi", KnowledgeStatus.FACT, open=False)]),
    }
    r = sel(states, policies)
    assert r[0].domain_id == "blocked"                      # blocker+open beats higher base priority


# 9
def test_cooldown_prevents_repetitive_proactive():
    policies = {"a": pol(proactivity=Proactivity.HIGH, cooldown_seconds=60.0)}
    states = {"a": st("a", status=KnowledgeStatus.FACT)}
    assert sel(states, policies, last_spoken={"a": NOW - 10}) == []       # inside cooldown
    assert len(sel(states, policies, last_spoken={"a": NOW - 120})) == 1  # after cooldown
    # explicit request bypasses cooldown
    assert len(sel(states, policies, last_spoken={"a": NOW - 10}, explicit_request="a")) == 1


# 10
def test_day_opening_inclusion_independent_from_conversation():
    policies = {"a": pol(day_opening_inclusion=True, conversation_inclusion=False,
                         proactivity=Proactivity.HIGH)}
    states = {"a": st("a", status=KnowledgeStatus.FACT)}
    assert len(sel(states, policies, context=DAY_OPENING)) == 1
    assert sel(states, policies, context=CONVERSATION) == []


# 11
def test_selection_explains_itself():
    policies = {"a": pol(priority=7, proactivity=Proactivity.HIGH)}
    states = {"a": st("a", status=KnowledgeStatus.FACT,
                      items=[DomainItem("x", KnowledgeStatus.FACT, open=True, is_blocker=True)])}
    r = sel(states, policies)
    reason = r[0].selection_reason
    assert reason and "priority=7" in reason and "blockers=1" in reason and "score=" in reason


# 12
def test_deterministic_same_input_same_output():
    policies = default_policies()
    states = {d: st(d, status=KnowledgeStatus.FACT, confidence=0.6) for d in domain_ids()}
    a = sel(states, policies)
    b = sel(states, policies)
    assert [(t.domain_id, round(t.score, 4)) for t in a] == [(t.domain_id, round(t.score, 4)) for t in b]


# (13 is run as a separate suite: existing day_opening tests)
# 14
def test_orientation_core_pulls_no_audio_modules():
    for m in ("orientation", "orientation.selector", "orientation.day_opening_bridge"):
        importlib.import_module(m)
    banned = ("sounddevice", "service.merlin_service", "service.barge_detector", "service.wake_trigger")
    leaked = [m for m in banned if m in sys.modules]
    assert leaked == [], f"orientation core must not import audio modules, leaked: {leaked}"


# bonus: the day_opening bridge represents a DomainStatus-like object without audio imports
def test_day_opening_bridge_maps_status_to_state():
    class FakeProv:
        name = "FACT"
    class FakeStatus:
        domain = "philos"; provenance = FakeProv(); summary_he = "התקדמות"; source = "philos-events.jsonl"
        timestamp = NOW; confidence = 0.9; blocker_he = "חסם"; next_action_he = "צעד"; unfinished_he = ""
        open_loop = None; error = ""
    states = day_opening_to_states([FakeStatus()])
    assert "philos" in states
    s = states["philos"]
    assert s.status is KnowledgeStatus.FACT and s.blockers and s.next_actions
