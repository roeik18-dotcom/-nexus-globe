"""openWakeWord on-device wake backend (2026-08-09) — key-free, chosen over
Porcupine. Proves: the detector resamples 48 kHz float32 → 16 kHz int16 and
feeds openWakeWord's 1280-sample frames; it fires the SAME wake handoff as
Porcupine; and it real-loads a bundled ONNX model on this machine. The custom
'Merlin' model is trained offline (tools/train_merlin_wakeword.md) and supplied
via MERLIN_OWW_MODEL_PATH; these tests use a fake + a shipped model as stand-in.
"""
import os
import threading

import numpy as np
import pytest

import service.wake_trigger as wt


class _FakeModel:
    """Duck-types openwakeword.model.Model.predict(frame)->{name: score}."""
    def __init__(self, score_sequence):
        self._scores = list(score_sequence)
        self._i = 0

    def predict(self, frame):
        assert frame.dtype == np.int16 and len(frame) == 1280
        s = self._scores[min(self._i, len(self._scores) - 1)]
        self._i += 1
        return {"merlin": s}


def _patch_model(monkeypatch, score_sequence):
    import openwakeword.model as owm
    monkeypatch.setattr(owm, "Model", lambda *a, **k: _FakeModel(score_sequence))


def test_detector_resamples_and_frames_to_1280(monkeypatch):
    _patch_model(monkeypatch, [0.0])
    d = wt.OpenWakeWordDetector("merlin.onnx", mic_sr=48000, threshold=0.5)
    assert d.target_sr == 16000 and d.frame_len == 1280
    fired = d.process(np.zeros(48000, dtype=np.float32))   # 1 s silence @48k
    assert fired is False                                   # score 0.0 < 0.5


def test_detector_fires_above_threshold(monkeypatch):
    # a run of high scores → fires
    _patch_model(monkeypatch, [0.1, 0.2, 0.9, 0.9])
    d = wt.OpenWakeWordDetector("merlin.onnx", mic_sr=48000, threshold=0.5)
    assert d.process(np.zeros(48000, dtype=np.float32)) is True


def test_detector_stays_silent_below_threshold(monkeypatch):
    _patch_model(monkeypatch, [0.1, 0.2, 0.3])
    d = wt.OpenWakeWordDetector("merlin.onnx", mic_sr=48000, threshold=0.5)
    assert d.process(np.zeros(48000, dtype=np.float32)) is False


def test_detector_drives_same_keyword_handoff(monkeypatch):
    # slotting the OWW detector into KeywordBuffer's detector slot fires the
    # SAME handoff Porcupine uses (source_box='keyword' + trigger.set), no cloud
    _patch_model(monkeypatch, [0.9, 0.9, 0.9, 0.9, 0.9])
    ev = threading.Event()
    box = ["keyword"]
    det = wt.OpenWakeWordDetector("merlin.onnx", mic_sr=48000, threshold=0.5)
    kb = wt.KeywordBuffer(ev, "", "merlin", mic_sr=48000, source_box=box, porcupine=det)
    assert kb._porcupine is not None                      # no Whisper thread path
    # 4800 @48k → 1600 @16k → one full 1280-sample openWakeWord frame
    kb.feed(np.zeros(4800, dtype=np.float32), 0.0)
    assert ev.is_set() is True
    assert box[0] == "keyword"


def test_backend_config_symbols_exist():
    assert hasattr(wt, "MERLIN_OWW_MODEL_PATH")
    assert hasattr(wt, "MERLIN_OWW_THRESHOLD")
    assert hasattr(wt, "OpenWakeWordDetector")


def test_real_bundled_model_loads_and_scores_silence_zero():
    """Real openWakeWord runtime on THIS machine (py3.14): a shipped model
    loads via onnxruntime and scores silence ~0 (no false fire). Proves the
    engine is viable here; the 'Merlin' model just needs offline training."""
    import openwakeword
    base = os.path.join(openwakeword.__path__[0], "resources", "models")
    model = os.path.join(base, "hey_jarvis_v0.1.onnx")
    if not os.path.exists(model):
        pytest.skip("bundled hey_jarvis model not present")
    d = wt.OpenWakeWordDetector(model, mic_sr=48000, threshold=0.5)
    assert d.process(np.zeros(48000, dtype=np.float32)) is False   # silence never fires
