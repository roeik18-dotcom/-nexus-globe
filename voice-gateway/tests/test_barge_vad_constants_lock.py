"""PHASE 8 — barge-in / VAD regression lock.

These four constants were tuned and PROVEN on the live runtime (barge fires and
Merlin does NOT self-interrupt from its own output at these values). This test is
a guard: it fails loudly if any future edit silently regresses them, so the
proven-good live behavior can't drift.

Source-text parse (no import) on purpose: importing service.merlin_service pulls
PortAudio and the whole audio stack, which must not load in a unit-test env.
"""
import re
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[1]
_SERVICE = (_ROOT / "service" / "merlin_service.py").read_text(encoding="utf-8")
_VAD = (_ROOT / "service" / "vad_config.py").read_text(encoding="utf-8")


def _num(src: str, name: str) -> float:
    m = re.search(rf"^{name}\s*(?::\s*float\s*)?=\s*([0-9.]+)", src, re.M)
    assert m, f"{name} not found — constant renamed or removed"
    return float(m.group(1))


def test_barge_in_rms_locked_at_proven_value():
    # 0.0040: proven live (USER_SPEECH_CONFIRMED at rms~0.0079 over output_rms~0.10).
    assert _num(_SERVICE, "BARGE_IN_RMS") == 0.0040


def test_barge_in_confirm_seconds_locked():
    # 0.20 s sustained speech confirms a real barge (rejects momentary output bleed).
    assert _num(_SERVICE, "BARGE_IN_CONFIRM_S") == 0.20


def test_barge_in_enabled():
    assert re.search(r"^BARGE_IN_ENABLED\s*=\s*True", _SERVICE, re.M), \
        "BARGE_IN_ENABLED must stay True — barge-in was proven working live"


def test_command_rms_threshold_locked():
    # 0.003: the command-capture VAD threshold the user set explicitly.
    assert _num(_VAD, "COMMAND_RMS_THRESHOLD") == 0.003
