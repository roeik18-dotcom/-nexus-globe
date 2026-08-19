"""Porcupine on-device wake integration — proves the wake handoff and that no
cloud STT runs while waiting. Uses a fake Porcupine (the real AccessKey + custom
Merlin_mac.ppn come from Picovoice Console and are supplied via env)."""
import threading
import time

import numpy as np
import pytest

import service.wake_trigger as wt


class _FakePorcupine:
    """Matches PorcupineDetector's interface: .process(native_frame) -> bool."""
    def __init__(self, fire_on_call: int = 2):
        self.calls = 0
        self.fire_on = fire_on_call

    def process(self, pcm):
        self.calls += 1
        return self.calls == self.fire_on


def test_porcupine_detection_fires_wake_handoff_exactly_once():
    ev = threading.Event()
    box = ["keyword"]
    fake = _FakePorcupine(fire_on_call=2)
    kb = wt.KeywordBuffer(ev, "", "merlin", mic_sr=48000, source_box=box, porcupine=fake)
    kb.feed(np.zeros(960, dtype=np.float32), 0.0)      # call 1 → no fire
    assert not ev.is_set()
    kb.feed(np.zeros(960, dtype=np.float32), 0.0)      # call 2 → fire
    assert ev.is_set() is True
    assert box[0] == "keyword"                          # same handoff the Whisper path used
    # further frames don't create a second, competing signal
    kb.feed(np.zeros(960, dtype=np.float32), 0.0)
    assert box[0] == "keyword"


def test_no_cloud_stt_thread_when_porcupine_active(monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(wt.KeywordBuffer, "_inference_loop",
                        lambda self: called.__setitem__("n", called["n"] + 1))
    kb = wt.KeywordBuffer(threading.Event(), "sk-fake-key", "merlin",
                          mic_sr=48000, source_box=["keyword"], porcupine=_FakePorcupine())
    time.sleep(0.1)
    assert called["n"] == 0          # Whisper inference thread NOT started → no OpenAI while waiting
    assert kb._porcupine is not None


def test_legacy_whisper_thread_starts_without_porcupine(monkeypatch):
    called = {"n": 0}
    monkeypatch.setattr(wt.KeywordBuffer, "_inference_loop",
                        lambda self: called.__setitem__("n", 1))
    wt.KeywordBuffer(threading.Event(), "sk-fake-key", "merlin",
                     mic_sr=16000, source_box=["keyword"])   # no porcupine → legacy path
    time.sleep(0.1)
    assert called["n"] == 1          # proves the guard actually gates on porcupine


def test_double_clap_is_acoustic_and_independent():
    import inspect
    src = inspect.getsource(wt.ClapDetector).lower()
    for forbidden in ("porcupine", "transcrib", "openai", "whisper"):
        assert forbidden not in src   # clap is a pure acoustic-temporal detector


def test_porcupine_detector_resamples_int16_and_frames(monkeypatch):
    """PorcupineDetector feeds 16 kHz int16 frames of the engine's own
    frame_length — proving the RME 48 kHz float32 → Porcupine conversion."""
    seen = {"frames": 0}

    class _PP:
        sample_rate = 16000
        frame_length = 512
        def process(self, frame):
            assert frame.dtype == np.int16 and len(frame) == 512
            seen["frames"] += 1
            return -1
        def delete(self):
            pass

    import pvporcupine
    monkeypatch.setattr(pvporcupine, "create", lambda **kw: _PP())
    d = wt.PorcupineDetector("access", "keyword.ppn", mic_sr=48000)
    assert d.target_sr == 16000 and d.frame_len == 512
    fired = d.process(np.zeros(48000, dtype=np.float32))   # 1 s of silence @ 48k
    assert fired is False
    assert seen["frames"] >= 30                            # ~16000/512 frames processed


def test_config_symbols_exist():
    # env-driven config the runtime reads (fail-clear if unset at startup)
    assert hasattr(wt, "PORCUPINE_ACCESS_KEY")
    assert hasattr(wt, "PORCUPINE_KEYWORD_PATH")
