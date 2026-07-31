"""V&V for the tool registry + real tool output through the Alpha chain."""
import re

from mos.alpha import AlphaRuntime
from mos.tools import has_tool, run_tool


def test_read_clock_returns_real_time():
    ok, result = run_tool("read_clock")
    assert ok and re.match(r"^\d{2}:\d{2}$", result["time"])


def test_weather_is_honest_placeholder_not_fabricated():
    ok, result = run_tool("read_weather")
    assert ok and "note" in result            # no fabricated forecast


def test_unregistered_tool_is_simulated_not_crash():
    ok, result = run_tool("launch_application")
    assert ok and result.get("simulated") is True
    assert not has_tool("launch_application")


def test_real_time_flows_through_the_whole_chain():
    rt = AlphaRuntime()
    rt.speak("מה השעה", correlation_id="c")
    resp = rt.response_for("c")
    assert resp and re.search(r"\d{2}:\d{2}", resp)   # actual clock value reached response
