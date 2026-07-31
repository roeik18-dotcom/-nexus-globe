"""V&V for the opt-in Learning→Cognition calibration (familiarity feedback)."""
from mos.alpha import AlphaRuntime


def _confidences(rt):
    return [e.payload["confidence"] for e in rt.bus.log if e.type == "decision.made"]


def test_off_by_default_no_behavior_change():
    rt = AlphaRuntime()                       # calibrate defaults to False
    rt.speak("מה השעה", correlation_id="x")
    assert not any(e.type == "calibration.applied" for e in rt.bus.log)


def test_familiarity_raises_confidence_over_repeats():
    rt = AlphaRuntime(calibrate=True)
    for k in range(4):
        rt.speak("מה השעה", correlation_id=f"c{k}")
    confs = _confidences(rt)
    assert confs == sorted(confs)             # non-decreasing
    assert confs[-1] > confs[0]               # actually grew with familiarity
    assert all(c <= 0.99 for c in confs)      # capped


def test_calibration_events_are_observable():
    rt = AlphaRuntime(calibrate=True)
    rt.speak("מה השעה", correlation_id="a")
    rt.speak("מה השעה", correlation_id="b")
    cals = [e.payload for e in rt.bus.log if e.type == "calibration.applied"]
    assert len(cals) == 2
    assert cals[1]["seen"] > cals[0]["seen"]  # familiarity accumulates
