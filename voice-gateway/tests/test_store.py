"""V&V for the durable Event Store (append → load → replay)."""
from mos.events import EventBus, new_event
from mos.store import JsonlEventStore, from_dict, to_dict


def test_round_trip_preserves_event(tmp_path):
    store = JsonlEventStore(str(tmp_path / "e.jsonl"))
    e = new_event("intent.classified", "mos.intent", "intent:ask_time",
                  {"intent": "ask_time", "confidence": 0.95}, correlation_id="t1")
    store.append(e)
    loaded = store.load()
    assert len(loaded) == 1
    assert loaded[0] == from_dict(to_dict(e))
    assert loaded[0].payload["intent"] == "ask_time"


def test_survives_restart_and_state_is_folded(tmp_path):
    path = str(tmp_path / "e.jsonl")
    # session 1: publish through a store-backed bus
    bus1 = EventBus(store=JsonlEventStore(path))
    bus1.publish(new_event("decision.made", "mos.cognition", "x",
                           {"decision": "read_clock"}, correlation_id="t1"))
    bus1.publish(new_event("decision.made", "mos.cognition", "x",
                           {"decision": "run_morning_brief"}, correlation_id="t2"))
    # session 2: fresh bus rehydrates from disk (Merlin remembers)
    bus2 = EventBus()
    bus2.load_from(JsonlEventStore(path).load())
    decisions = bus2.fold(
        lambda acc, e: acc + [e.payload["decision"]] if e.type == "decision.made" else acc, [])
    assert decisions == ["read_clock", "run_morning_brief"]


def test_unknown_type_is_kept_not_dropped(tmp_path):
    # R-5: forward-compatible replay
    store = JsonlEventStore(str(tmp_path / "e.jsonl"))
    store.append(new_event("some.future.type", "x", "y", {"z": 1}))
    assert store.count() == 1
    assert store.load()[0].type == "some.future.type"
