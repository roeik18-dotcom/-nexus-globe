"""V&V for the Voice→Event bridge + latency + Pro Tools recognition."""
import re

from mos.intent_bridge import detect_app
from mos.latency import stage_latencies
from mos.voice_bridge import VoiceBridge


def test_transcript_drives_full_chain_and_emits_user_spoke():
    vb = VoiceBridge()
    corr = vb.on_transcript("מרלין מה השעה")
    types = [e.type for e in vb.rt.bus.log if e.correlation_id == corr]
    assert types[0] == "user.spoke"
    assert "response.generated" in types
    assert re.search(r"\d{2}:\d{2}", vb.response_for(corr))     # real clock reached response


def test_pro_tools_is_recognized_and_gated():
    assert detect_app("פתח Pro Tools") == "pro_tools"
    assert detect_app("open ableton") == "ableton"
    vb = VoiceBridge()
    corr = vb.on_transcript("פתח Pro Tools")
    ic = [e for e in vb.rt.bus.log
          if e.type == "intent.classified" and e.correlation_id == corr][0]
    assert ic.payload["intent"] == "open_app"
    assert ic.payload["target"] == "pro_tools"
    # opening an app is irreversible → gated until approval (INV-6)
    assert any(e.type == "permission.required" for e in vb.rt.bus.log
               if e.correlation_id == corr)


def test_bad_transcript_does_not_fabricate_command():
    vb = VoiceBridge()
    corr = vb.on_transcript("בלה בלה לא ברור")
    ic = [e for e in vb.rt.bus.log
          if e.type == "intent.classified" and e.correlation_id == corr][0]
    assert ic.payload["intent"] == "unknown"


def test_latency_projection_measures_stages():
    vb = VoiceBridge()
    corr = vb.on_transcript("מה השעה")
    lat = stage_latencies(vb.rt.bus.log, corr)
    assert lat["n_stages"] >= 5
    assert lat["total_ms"] >= 0.0
    assert any("→" in k for k in lat["stages"])
