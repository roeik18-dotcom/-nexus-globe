"""Tests for RecallPolicy and RecallResult."""

import pytest

from app.recall import GLOBAL_KEYS, RecallItem, RecallPolicy, RecallResult, _words


# --- _words ---

def test_words_extracts_lowercase_tokens():
    assert _words("Hello World") == frozenset({"hello", "world"})


def test_words_filters_short_tokens():
    assert _words("I am at") == frozenset()


def test_words_keeps_3plus_chars():
    assert "the" in _words("the quick fox")
    assert "it" not in _words("it is")


def test_words_handles_underscores_as_separators():
    result = _words("voice_gateway")
    assert "voice" in result
    assert "gateway" in result


def test_words_empty_string():
    assert _words("") == frozenset()


def test_words_numbers_ignored():
    assert _words("123 abc") == frozenset({"abc"})


# --- RecallResult structure ---

def test_empty_memory_returns_result_with_empty_items():
    policy = RecallPolicy()
    result = policy.select({}, "jarvis")
    assert isinstance(result, RecallResult)
    assert result.items == []
    assert result.truncated is False
    assert result.total_candidates == 0


def test_result_not_truncated_within_budget():
    policy = RecallPolicy(max_items=10)
    memory = {f"jarvis_k{i}": i for i in range(5)}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert result.truncated is False
    assert result.total_candidates == 5
    assert len(result.items) == 5


def test_result_truncated_when_over_budget():
    policy = RecallPolicy(max_items=3)
    memory = {f"jarvis_k{i}": i for i in range(8)}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert result.truncated is True
    assert result.total_candidates == 8
    assert len(result.items) == 3


def test_total_candidates_counts_before_truncation():
    policy = RecallPolicy(max_items=2)
    memory = {k: "x" for k in GLOBAL_KEYS}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert result.total_candidates == len(GLOBAL_KEYS)
    assert len(result.items) == 2
    assert result.truncated is True


def test_empty_memory_with_context_returns_empty_result():
    policy = RecallPolicy()
    result = policy.select({}, "jarvis", user_message="hello")
    assert result.items == []
    assert result.total_candidates == 0


# --- no-context pass-through ---

def test_no_context_returns_all_items():
    policy = RecallPolicy()
    memory = {"name": "Alice", "lang": "en", "hobby": "chess"}
    result = policy.select(memory, "jarvis", current_task=None, user_message="")
    assert len(result.items) == 3
    assert all(r.reason == "all" for r in result.items)


def test_no_context_whitespace_message_is_no_context():
    policy = RecallPolicy()
    memory = {"name": "Alice"}
    result = policy.select(memory, "jarvis", current_task=None, user_message="   ")
    assert len(result.items) == 1
    assert result.items[0].reason == "all"


def test_no_context_respects_max_items():
    policy = RecallPolicy(max_items=2)
    memory = {"a": 1, "b": 2, "c": 3}
    result = policy.select(memory, "jarvis", current_task=None, user_message="")
    assert len(result.items) == 2
    assert result.truncated is True
    assert result.total_candidates == 3
    assert all(r.reason == "all" for r in result.items)


# --- rule 1: global keys ---

def test_global_keys_always_included():
    policy = RecallPolicy()
    memory = {"owner": "Alice", "unrelated_key": "value"}
    result = policy.select(memory, "jarvis", user_message="hello world")
    keys = {r.key for r in result.items}
    assert "owner" in keys


def test_global_key_has_reason_global():
    policy = RecallPolicy()
    memory = {"lang": "en"}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert result.items[0].reason == "global"


def test_all_standard_global_keys_are_included():
    policy = RecallPolicy()
    memory = {k: "x" for k in GLOBAL_KEYS}
    memory["non_global"] = "y"
    result = policy.select(memory, "jarvis", user_message="hi")
    global_results = {r.key for r in result.items if r.reason == "global"}
    assert global_results == GLOBAL_KEYS


def test_custom_global_keys():
    policy = RecallPolicy(global_keys=frozenset({"preferred_model"}))
    memory = {"preferred_model": "opus", "other": "val"}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert result.items[0].key == "preferred_model"
    assert result.items[0].reason == "global"


# --- rule 2: persona-prefixed keys ---

def test_persona_prefixed_key_included():
    policy = RecallPolicy()
    memory = {"jarvis_greeting": "Hey there!"}
    result = policy.select(memory, "jarvis", user_message="hi")
    assert any(r.key == "jarvis_greeting" for r in result.items)


def test_persona_prefixed_key_has_reason_persona():
    policy = RecallPolicy()
    memory = {"jarvis_tone": "casual"}
    result = policy.select(memory, "jarvis", user_message="hi")
    item = next(r for r in result.items if r.key == "jarvis_tone")
    assert item.reason == "persona"


def test_wrong_persona_prefix_not_included():
    policy = RecallPolicy()
    memory = {"philos_style": "formal"}
    result = policy.select(memory, "jarvis", user_message="hi")
    keys = {r.key for r in result.items}
    assert "philos_style" not in keys


def test_global_key_wins_over_persona_prefix():
    policy = RecallPolicy(global_keys=frozenset({"jarvis_lang"}))
    memory = {"jarvis_lang": "en"}
    result = policy.select(memory, "jarvis", user_message="hi")
    item = next(r for r in result.items if r.key == "jarvis_lang")
    assert item.reason == "global"


# --- rule 3: task-matched keys ---

class _Task:
    def __init__(self, title: str = "", description: str = "") -> None:
        self.title = title
        self.description = description


def test_task_title_matches_key():
    policy = RecallPolicy()
    memory = {"calendar_app": "Google Calendar"}
    task = _Task(title="calendar sync")
    result = policy.select(memory, "jarvis", current_task=task)
    assert any(r.key == "calendar_app" for r in result.items)


def test_task_matched_key_has_reason_task():
    policy = RecallPolicy()
    memory = {"reminder_interval": "daily"}
    task = _Task(title="set reminder")
    result = policy.select(memory, "jarvis", current_task=task, user_message="")
    item = next(r for r in result.items if r.key == "reminder_interval")
    assert item.reason == "task"


def test_task_description_contributes_to_matching():
    policy = RecallPolicy()
    memory = {"meeting_room": "Zoom"}
    task = _Task(title="schedule", description="meeting with team")
    result = policy.select(memory, "jarvis", current_task=task)
    assert any(r.key == "meeting_room" for r in result.items)


def test_task_matches_value_not_just_key():
    policy = RecallPolicy()
    memory = {"pref": "schedule meetings on Tuesdays"}
    task = _Task(title="meetings planning")
    result = policy.select(memory, "jarvis", current_task=task)
    assert any(r.key == "pref" for r in result.items)


def test_no_task_skips_rule3():
    policy = RecallPolicy()
    memory = {"reminder_interval": "daily"}
    result = policy.select(memory, "jarvis", current_task=None, user_message="hi")
    keys = {r.key for r in result.items}
    assert "reminder_interval" not in keys


# --- rule 4: keyword-matched from user message ---

def test_keyword_match_from_user_message():
    policy = RecallPolicy()
    memory = {"weather_city": "London"}
    result = policy.select(memory, "jarvis", user_message="What is the weather today?")
    assert any(r.key == "weather_city" for r in result.items)


def test_keyword_matched_has_reason_keyword():
    policy = RecallPolicy()
    memory = {"music_service": "Spotify"}
    result = policy.select(memory, "jarvis", user_message="play some music please")
    item = next(r for r in result.items if r.key == "music_service")
    assert item.reason == "keyword"


def test_keyword_matches_value():
    policy = RecallPolicy()
    memory = {"pref": "wake me up at sunrise"}
    result = policy.select(memory, "jarvis", user_message="tell me about sunrise times")
    assert any(r.key == "pref" for r in result.items)


def test_empty_user_message_skips_rule4():
    policy = RecallPolicy()
    memory = {"music_service": "Spotify"}
    task = _Task(title="unrelated")
    result = policy.select(memory, "jarvis", current_task=task, user_message="")
    keys = {r.key for r in result.items}
    assert "music_service" not in keys


# --- priority: global > persona > task > keyword ---

def test_global_beats_persona_for_same_key():
    policy = RecallPolicy(global_keys=frozenset({"lang"}))
    memory = {"lang": "en"}
    result = policy.select(memory, "lang", user_message="lang is important")
    item = next(r for r in result.items if r.key == "lang")
    assert item.reason == "global"


def test_persona_beats_task_for_same_key():
    policy = RecallPolicy()
    memory = {"jarvis_reminder": "morning"}
    task = _Task(title="reminder setup")
    result = policy.select(memory, "jarvis", current_task=task, user_message="")
    item = next(r for r in result.items if r.key == "jarvis_reminder")
    assert item.reason == "persona"


def test_task_beats_keyword_for_same_key():
    policy = RecallPolicy()
    memory = {"meeting_notes": "discussed budget"}
    task = _Task(title="meeting recap")
    result = policy.select(memory, "jarvis", current_task=task, user_message="meeting with Alice")
    item = next(r for r in result.items if r.key == "meeting_notes")
    assert item.reason == "task"


# --- max_items ---

def test_max_items_limits_results_with_context():
    policy = RecallPolicy(max_items=3)
    memory = {f"jarvis_key_{i}": i for i in range(10)}
    result = policy.select(memory, "jarvis", user_message="jarvis key data")
    assert len(result.items) <= 3


def test_max_items_default_is_20():
    policy = RecallPolicy()
    assert policy._max_items == 20


# --- RecallItem properties ---

def test_recall_item_is_frozen():
    item = RecallItem(key="k", value="v", reason="global")
    with pytest.raises(Exception):
        item.key = "new"  # type: ignore[misc]


def test_recall_item_stores_value_type():
    item = RecallItem(key="data", value={"nested": True}, reason="task")
    assert item.value == {"nested": True}


def test_recall_item_equality():
    a = RecallItem(key="k", value="v", reason="global")
    b = RecallItem(key="k", value="v", reason="global")
    assert a == b


# --- two-phase: _collect_candidates and _apply_budget ---

def test_collect_candidates_returns_list_of_recall_items():
    policy = RecallPolicy()
    memory = {"lang": "en", "jarvis_tone": "casual"}
    candidates = policy._collect_candidates(memory, "jarvis", user_message="hi")
    assert all(isinstance(c, RecallItem) for c in candidates)


def test_apply_budget_returns_recall_result():
    policy = RecallPolicy(max_items=2)
    candidates = [RecallItem(key=str(i), value=i, reason="global") for i in range(5)]
    result = policy._apply_budget(candidates)
    assert isinstance(result, RecallResult)
    assert len(result.items) == 2
    assert result.truncated is True
    assert result.total_candidates == 5


def test_apply_budget_not_truncated_within_limit():
    policy = RecallPolicy(max_items=10)
    candidates = [RecallItem(key=str(i), value=i, reason="global") for i in range(3)]
    result = policy._apply_budget(candidates)
    assert result.truncated is False
    assert result.total_candidates == 3


# --- combined scenario ---

def test_combined_all_rules():
    policy = RecallPolicy()
    memory = {
        "owner": "Alice",           # global
        "jarvis_tone": "casual",    # persona
        "calendar_app": "GCal",     # task-matched
        "music_service": "Spotify", # keyword-matched
        "unrelated": "noise",       # none
    }
    task = _Task(title="calendar sync")
    result = policy.select(
        memory, "jarvis",
        current_task=task,
        user_message="play some music",
    )
    reason_map = {r.key: r.reason for r in result.items}
    assert reason_map["owner"] == "global"
    assert reason_map["jarvis_tone"] == "persona"
    assert reason_map["calendar_app"] == "task"
    assert reason_map["music_service"] == "keyword"
    assert "unrelated" not in reason_map
    assert result.total_candidates == 4
    assert result.truncated is False
