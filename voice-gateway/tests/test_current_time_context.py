"""Merlin must be told the wall clock — it has no tool to ask for it.

Observed 2026-08-01 19:24: asked "מה השעה עכשיו", the model answered
"השעה עכשיו 05:49 בבוקר" while the machine clock read 19:24.  Nothing was wrong
with any clock: `app/adapters/claude.py` passes no `tools=`, the MOS `read_clock`
is behind the disabled MERLIN_MOS_BRIDGE, and no layer put a time in the prompt.
The model had no time and invented one, in a tone indistinguishable from a real
reading.

These tests pin the injection: present on every turn, timezone-aware, and
deterministic under a fixed clock so the format can be asserted exactly.
"""

from datetime import datetime, timedelta, timezone

import pytest

from app.context_builder import ContextBuilder, CurrentTimeLayer, _local_now


def _fixed(dt: datetime):
    return lambda: dt


# A deliberately non-Israel, non-UTC zone: a Tel Aviv or UTC assumption in the
# implementation would show up as a wrong offset here.
KATHMANDU = timezone(timedelta(hours=5, minutes=45), "+0545")
FIXED = datetime(2026, 8, 1, 19, 24, 15, tzinfo=KATHMANDU)


# --- the context is present -------------------------------------------------

def test_current_time_layer_is_in_the_session_prompt():
    prompt = ContextBuilder.for_session("merlin").build()
    assert "## Current time" in prompt


def test_layer_appears_in_diagnostics():
    names = [n for n, _ in ContextBuilder.for_session("merlin").layer_diagnostics()]
    assert "CurrentTimeLayer" in names


def test_all_three_required_fields_are_rendered():
    out = CurrentTimeLayer(_fixed(FIXED)).render()
    assert "ISO " in out
    assert "Timezone " in out
    assert "Saturday, 01 August 2026" in out


# --- deterministic output under a fixed clock -------------------------------

def test_fixed_clock_produces_exact_output():
    out = CurrentTimeLayer(_fixed(FIXED)).render()
    assert "ISO 2026-08-01T19:24:15+05:45" in out
    assert "(UTC+05:45)" in out
    assert "Saturday, 01 August 2026" in out
    # the answer must lead, verbatim — this is what stops the model recomputing
    assert "exactly 19:24" in out


def test_fixed_clock_is_stable_across_calls():
    layer = CurrentTimeLayer(_fixed(FIXED))
    assert layer.render() == layer.render()


def test_injected_clock_reaches_the_built_prompt():
    prompt = ContextBuilder.for_session("merlin", clock=_fixed(FIXED)).build()
    assert "2026-08-01T19:24:15+05:45" in prompt


# --- timezone-aware, not hardcoded ------------------------------------------

def test_default_clock_is_timezone_aware():
    now = _local_now()
    assert now.tzinfo is not None
    assert now.utcoffset() is not None


def test_default_clock_tracks_the_system_not_a_fixed_region():
    """Must equal the OS local zone, whatever it is — no pinned offset."""
    assert _local_now().utcoffset() == datetime.now().astimezone().utcoffset()


def test_no_hardcoded_israel_or_utc_offset():
    import inspect

    import app.context_builder as cb

    src = inspect.getsource(cb.CurrentTimeLayer) + inspect.getsource(cb._local_now)
    for banned in ("Asia/Jerusalem", "Israel", "IDT", "IST", "+03:00", "timedelta(hours=3)"):
        assert banned not in src, f"region pinned in source: {banned}"


@pytest.mark.parametrize("offset_h", [-8, 0, 3, 5.75, 13])
def test_renders_correctly_across_zones(offset_h):
    tz = timezone(timedelta(hours=offset_h))
    dt = datetime(2026, 8, 1, 12, 0, 0, tzinfo=tz)
    out = CurrentTimeLayer(_fixed(dt)).render()
    assert dt.isoformat(timespec="seconds") in out


# --- the instruction itself --------------------------------------------------

def test_layer_tells_the_model_not_to_guess():
    out = CurrentTimeLayer(_fixed(FIXED)).render().lower()
    assert "never add, subtract, round, reformat, or invent" in out
    assert "do not recompute" in out
