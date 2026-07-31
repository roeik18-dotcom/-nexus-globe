"""V&V for the voice→platform intent bridge (v0 keyword classifier)."""
from mos.events import EventBus
from mos.intent_bridge import classify, to_bus


def test_classifies_hebrew_and_english():
    assert classify("מרלין מה השעה עכשיו")[0] == "ask_time"
    assert classify("שקט")[0] == "stop"
    assert classify("בוקר טוב מרלין תעשה תדרוך")[0] == "day_opener"
    assert classify("open ableton")[0] == "open_app"


def test_empty_and_gibberish_are_unknown_not_fabricated():
    # I-4: no fabricated intent for empty/unclear input
    assert classify("") == ("unknown", 0.0)
    intent, conf = classify("בלה בלה משהו לא ברור")
    assert intent == "unknown"
    assert conf <= 0.3


def test_confidence_is_bounded():
    for text in ["מה השעה", "stop", "weather please", ""]:
        _, c = classify(text)
        assert 0.0 <= c <= 1.0


def test_to_bus_emits_intent_classified():
    bus = EventBus()
    ev = to_bus(bus, "מה השעה")
    assert ev.type == "intent.classified"
    assert ev.payload["intent"] == "ask_time"
    assert "transcript" in ev.payload
    assert 0.0 <= ev.payload["confidence"] <= 1.0
