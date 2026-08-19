"""Integration tests for the turn-taking / real-barge-in fix (PHASE 9 / PHASE 10).

Exercises the REAL service.merlin_service.stream_response() and
run_conversation_session() against:
  - the REAL app.adapters.claude.ClaudeAdapter, with only the underlying
    Anthropic client mocked (same pattern as tests/test_language_gate.py),
  - a FakeDuplexStream standing in for sd.Stream, driven with a
    test-controlled per-block RMS sequence so barge-in confirmation is
    deterministic without real audio hardware,
  - a TTS double constrained to the real OpenAITTS public surface
    (spec=['synthesize']), so a MagicMock cannot silently satisfy a
    hasattr(tts, 'stream_synthesize') check the real provider would fail.

No real audio device, network call, or API key is used anywhere in this file.
"""

from __future__ import annotations

import threading
from unittest.mock import AsyncMock, MagicMock

import numpy as np
import pytest

import service.merlin_service as svc
from service.turn_state import TurnController, TurnState

SESSION = "test-turn-taking-session"


# ── shared fakes ──────────────────────────────────────────────────────────

class FakeDuplexStream:
    """Stands in for sd.Stream. Drives `callback` on a background thread with
    a test-supplied per-block RMS sequence (constant-valued blocks, so RMS ==
    the configured value exactly), mimicking PortAudio's own driving of a
    duplex callback until the callback raises sd.CallbackStop.
    """

    rms_sequence: list[float] = []
    # 720 frames @ 24 kHz = 30 ms/block. Confirmation is now TIME-based
    # (BARGE_IN_CONFIRM_S = 0.20 s), NOT the old fixed BARGE_IN_FRAMES count, so a
    # block must be long enough that the ~10-12-block "sustained speech" sequences
    # these tests supply cross 0.20 s (10×30 ms = 300 ms -> confirms) while the
    # 2-block transient (60 ms) stays safely under it. The old 240-frame (10 ms)
    # block predated the count->time change and left every confirm test 80 ms short.
    block_frames: int = 720
    max_calls: int = 20_000

    def __init__(self, *, samplerate, channels, dtype, callback, finished_callback=None):
        self.samplerate = samplerate
        self.channels = channels
        self.callback = callback
        self.finished_callback = finished_callback
        self.calls = 0
        self._thread: threading.Thread | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, daemon=True)
        self._thread.start()

    def _run(self) -> None:
        in_ch = self.channels[0] if isinstance(self.channels, tuple) else 1
        frames = self.block_frames
        try:
            while self.calls < self.max_calls:
                rms = self.rms_sequence[self.calls] if self.calls < len(self.rms_sequence) else 0.0
                indata = np.full((frames, in_ch), rms, dtype=np.float32)
                outdata = np.zeros((frames, 1), dtype=np.float32)
                self.calls += 1
                self.callback(indata, outdata, frames, None, None)
        except svc.sd.CallbackStop:
            pass
        finally:
            if self.finished_callback:
                self.finished_callback()

    def stop(self) -> None:
        pass

    def close(self) -> None:
        pass


def _pcm_bytes(seconds: float = 2.0) -> bytes:
    n = int(seconds * svc._TTS_SR)
    return np.zeros(n, dtype=np.int16).tobytes()


@pytest.fixture(autouse=True)
def _no_grace_and_fake_stream(monkeypatch):
    """Every test in this file: zero the barge-in grace window (tests run in
    microseconds, not the real 0.5s wall-clock grace) and replace sd.Stream /
    sd.query_devices so play_with_barge_in never touches real audio hardware."""
    FakeDuplexStream.rms_sequence = []
    FakeDuplexStream.max_calls = 20_000
    monkeypatch.setattr(svc, "BARGE_IN_GRACE", 0.0)
    monkeypatch.setattr(svc.sd, "Stream", FakeDuplexStream)
    monkeypatch.setattr(
        svc.sd, "query_devices",
        lambda kind=None: {"max_input_channels": 2, "default_samplerate": svc._TTS_SR},
    )
    yield


def _make_adapter_with_draft(draft_text: str):
    """A real ClaudeAdapter(persona='merlin') with a Hebrew-only control policy
    (gate_active=True — the actual live config) and a mocked underlying
    streaming call that yields `draft_text`."""
    from app.adapters.claude import ClaudeAdapter

    adapter = ClaudeAdapter(persona="merlin")

    async def _fake_text_stream():
        yield draft_text

    fake_stream_cm = MagicMock()
    fake_stream_cm.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream()))
    fake_stream_cm.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm)
    adapter._client.messages.create = AsyncMock(
        side_effect=AssertionError("retry must not fire for an already-Hebrew draft")
    )
    return adapter


@pytest.fixture(autouse=True)
def _hebrew_only_control_config(tmp_path, monkeypatch):
    from config.merlin_control_schema import default_config, save
    cfg_path = tmp_path / "merlin_control.json"
    monkeypatch.setattr("config.merlin_control_schema.DEFAULT_CONFIG_PATH", cfg_path)
    monkeypatch.setattr("config.merlin_control_schema.LAST_KNOWN_GOOD_PATH", tmp_path / "lkg.json")
    ok, errors = save(default_config().to_dict(), path=cfg_path)
    assert ok, errors
    yield


def _tts_double() -> MagicMock:
    tts = MagicMock(spec=["synthesize"])
    tts.synthesize = AsyncMock(return_value=_pcm_bytes())
    return tts


def _player() -> svc.AudioPlayer:
    return svc.AudioPlayer()


# ── 1/9. sustained speech during playback interrupts, stops playback ───────

@pytest.mark.asyncio
async def test_sustained_speech_during_playback_stops_it_and_cancels_turn():
    FakeDuplexStream.rms_sequence = [0.05] * 12   # well over BARGE_IN_RMS, well over BARGE_IN_FRAMES
    adapter = _make_adapter_with_draft("זו תשובה ארוכה למדי בעברית שממשיכה עוד ועוד ועוד.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, _tts_double(), _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is True
    assert turn_ctrl.is_current(turn_id) is False
    assert turn_ctrl.is_cancelled(turn_id) is True


# ── 2/9 + 4/9. interrupted turn's queued/later TTS+audio is cleared ────────

@pytest.mark.asyncio
async def test_interrupted_turn_never_calls_tts_again_after_confirmation():
    FakeDuplexStream.rms_sequence = [0.05] * 12
    tts = _tts_double()
    adapter = _make_adapter_with_draft("משפט ראשון קצר. משפט שני שלא אמור להישמע לעולם בגלל הפרעה.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is True
    # Exactly one sentence was ever handed to TTS — the interrupted one. The
    # second sentence must never reach synthesize() at all.
    assert tts.synthesize.await_count == 1


# ── 3/9 + 15/9. interrupted turn's LLM result cannot overwrite history ─────

@pytest.mark.asyncio
async def test_interrupted_turn_history_reflects_only_spoken_text():
    FakeDuplexStream.rms_sequence = [0.05] * 12
    full_draft = "משפט ראשון קצר. משפט שני שלא אמור להיכנס להיסטוריה במלואו."
    adapter = _make_adapter_with_draft(full_draft)
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, _tts_double(), _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is True
    history = adapter._history[SESSION]
    assert history[-1]["role"] == "assistant"
    # The full LLM draft (what was generated) must differ from what's stored —
    # the story was interrupted mid-first-sentence, so nothing was fully spoken.
    assert history[-1]["content"] != full_draft


# ── 5/9. no old audio resumes after interruption (player stays interrupted) ─

@pytest.mark.asyncio
async def test_player_interrupted_flag_set_after_confirmed_barge_in():
    FakeDuplexStream.rms_sequence = [0.05] * 12
    adapter = _make_adapter_with_draft("תשובה שתיקטע.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()
    player = _player()

    interrupted, _, _ = await svc.stream_response(
        adapter, _tts_double(), player, "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )
    assert interrupted is True
    assert player._interrupted.is_set() is True


# ── 6/9. no wake word required — proven at the run_conversation_session level

@pytest.mark.asyncio
async def test_run_conversation_session_continues_without_wake_after_interrupt(monkeypatch):
    from service.turn_state import TurnController as TC

    calls = {"record_utterance": [], "stream_response": 0}

    async def fake_record_utterance(max_initial_silence=None, prefill=None, turn_ctrl=None, control_state=None, barge_prefill=None):
        # After a barge interrupt the continuation prefill now arrives via
        # barge_prefill (record_utterance requires fresh post-playback speech
        # before honoring it), not the plain wake `prefill`. Capture whichever
        # is set so the "2nd call carries the barge prefill" assertion still holds.
        calls["record_utterance"].append(barge_prefill if barge_prefill is not None else prefill)
        if len(calls["record_utterance"]) == 1:
            return b"turn-1-audio"
        if len(calls["record_utterance"]) == 2:
            return b"turn-2-audio"
        return b""   # end the session loop

    sentinel_prefill = [np.zeros(4, dtype=np.float32)]

    async def fake_stream_response(adapter, tts, player, transcript, session_id, turn_ctrl, turn_id, control_state=None):
        calls["stream_response"] += 1
        if calls["stream_response"] == 1:
            return True, "partial answer", sentinel_prefill   # interrupted
        return False, "final answer", []

    from app.providers.stt.base import Transcription

    async def fake_transcribe_detailed(audio):
        text = {
            b"turn-1-audio": "ספר לי על מערכת השמש",
            b"turn-2-audio": "עצור, ספר לי רק על מאדים",
        }[audio]
        return Transcription(text=text, provider="fake")   # segments=None -> confidence gate no-ops

    monkeypatch.setattr(svc, "record_utterance", fake_record_utterance)
    monkeypatch.setattr(svc, "stream_response", fake_stream_response)

    stt = MagicMock(spec=["transcribe_detailed"])
    stt.transcribe_detailed = AsyncMock(side_effect=fake_transcribe_detailed)
    tts = _tts_double()
    player = _player()
    adapter = MagicMock()
    store = MagicMock()
    store.for_context = MagicMock(return_value=[])

    turn_ctrl = TC()
    await svc.run_conversation_session(adapter, stt, tts, player, store, SESSION, turn_ctrl)

    # 3 record_utterance calls: turn 1, turn 2 (after interrupt), then empty-audio exit.
    assert len(calls["record_utterance"]) == 3
    # No wake word required after interrupt: the SECOND record_utterance call
    # received the barge-in detector's captured chunks as prefill.
    assert calls["record_utterance"][1] is sentinel_prefill
    assert calls["stream_response"] == 2


# ── 7/9. first words of the interruption are preserved (pre-roll retained) ─

@pytest.mark.asyncio
async def test_interruption_preroll_retained_in_returned_prefill():
    # A few silent blocks (pre-roll ring fills), THEN sustained speech.
    FakeDuplexStream.rms_sequence = [0.0] * 4 + [0.05] * 12
    adapter = _make_adapter_with_draft("תשובה ארוכה שתיקטע על ידי המשתמש.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, _, prefill = await svc.stream_response(
        adapter, _tts_double(), _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )
    assert interrupted is True
    # More chunks than just the confirm-window run: pre-roll silence was
    # retained ahead of the confirmed speech, not discarded.
    assert len(prefill) > svc.BARGE_IN_FRAMES


# ── 8/9. short transient (click/cough) does not interrupt ──────────────────

@pytest.mark.asyncio
async def test_short_transient_does_not_interrupt_playback():
    # 2 loud blocks (a click), then silence for the rest of playback.
    FakeDuplexStream.rms_sequence = [0.05, 0.05] + [0.0] * 200
    adapter = _make_adapter_with_draft("תשובה קצרה.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, full_text, _ = await svc.stream_response(
        adapter, _tts_double(), _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )
    assert interrupted is False
    assert turn_ctrl.is_current(turn_id) is True


# ── 9/9. sustained speech DOES interrupt (positive control for test 8) ─────

@pytest.mark.asyncio
async def test_sustained_speech_does_interrupt_positive_control():
    FakeDuplexStream.rms_sequence = [0.05] * (svc.BARGE_IN_FRAMES + 2)
    adapter = _make_adapter_with_draft("תשובה ארוכה שתיקטע הפעם בוודאות.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, _, _ = await svc.stream_response(
        adapter, _tts_double(), _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )
    assert interrupted is True


# ── 10/9. normal uninterrupted playback still completes ────────────────────

@pytest.mark.asyncio
async def test_normal_uninterrupted_conversation_still_completes():
    FakeDuplexStream.rms_sequence = []  # pure silence throughout
    tts = _tts_double()
    adapter = _make_adapter_with_draft("זו תשובה תקנית בעברית שתישמע במלואה.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, _player(), "ספר לי משהו", SESSION, turn_ctrl, turn_id,
    )

    assert interrupted is False
    assert full_text == "זו תשובה תקנית בעברית שתישמע במלואה."
    assert prefill == []
    assert turn_ctrl.is_current(turn_id) is True
    history = adapter._history[SESSION]
    assert history[-1]["content"] == full_text


# ── 11. exact STT transcript reaches the LLM unchanged (transcript integrity)

@pytest.mark.asyncio
async def test_transcript_reaches_llm_history_unchanged():
    FakeDuplexStream.rms_sequence = []
    transcript = "ספר לי על מאדים בבקשה"
    adapter = _make_adapter_with_draft("מאדים הוא הכוכב הרביעי במערכת השמש.")
    turn_ctrl = TurnController()
    turn_id = turn_ctrl.new_turn()

    await svc.stream_response(adapter, _tts_double(), _player(), transcript, SESSION, turn_ctrl, turn_id)

    history = adapter._history[SESSION]
    user_entries = [m for m in history if m["role"] == "user"]
    assert user_entries[-1]["content"] == transcript


# ── 12 + 13. "Ahem" / empty transcript never reach the LLM ─────────────────

@pytest.mark.asyncio
async def test_filler_and_empty_transcripts_never_reach_stream_response(monkeypatch):
    from service.turn_state import TurnController as TC

    audios = iter([b"a1", b"a2", b"a3", b""])
    transcripts = iter(["Ahem", "   ", "ספר לי על מאדים"])

    async def fake_record_utterance(max_initial_silence=None, prefill=None, turn_ctrl=None, control_state=None, barge_prefill=None):
        return next(audios)

    stream_response_calls = []

    async def fake_stream_response(adapter, tts, player, transcript, session_id, turn_ctrl, turn_id, control_state=None):
        stream_response_calls.append(transcript)
        return False, "ok", []

    monkeypatch.setattr(svc, "record_utterance", fake_record_utterance)
    monkeypatch.setattr(svc, "stream_response", fake_stream_response)

    from app.providers.stt.base import Transcription

    stt = MagicMock(spec=["transcribe_detailed"])
    stt.transcribe_detailed = AsyncMock(
        side_effect=lambda audio: Transcription(text=next(transcripts), provider="fake")
    )
    tts = _tts_double()
    player = _player()
    adapter = MagicMock()
    store = MagicMock()

    turn_ctrl = TC()
    await svc.run_conversation_session(adapter, stt, tts, player, store, SESSION, turn_ctrl)

    # Only the real request ("ספר לי על מאדים") ever reached stream_response.
    assert stream_response_calls == ["ספר לי על מאדים"]


# ── real incident, 2026-08-07: unbounded STT-rejection retry trapped the
#    session forever, so main()'s wake loop (and ClapDetector) never got
#    control back — a physical clap during that window was silently lost.
#    run_conversation_session() must give up and return to standby after
#    MAX_CONSECUTIVE_STT_REJECTIONS, not retry indefinitely.

@pytest.mark.asyncio
async def test_session_returns_to_standby_after_max_consecutive_rejections(monkeypatch):
    from app.providers.stt.base import Transcription
    from service.control_state import RuntimeControlState
    from service.turn_state import TurnController as TC

    _cap = {"i": 0}

    async def fake_record_utterance(max_initial_silence=None, prefill=None, turn_ctrl=None, control_state=None, barge_prefill=None):
        # DISTINCT bytes per capture — real mic buffers differ sample-to-sample.
        # Identical bytes would trip the INPUT-ID de-dup (merlin_service.py ~1748),
        # whose `continue` bypasses the rejection counter; this test's intent is
        # that 3 DISTINCT *rejected* utterances trip MAX_CONSECUTIVE_STT_REJECTIONS.
        _cap["i"] += 1
        return b"noise-%d" % _cap["i"]   # never empty — a "true silence" timeout never fires

    call_count = {"n": 0}

    async def fake_transcribe_detailed(audio):
        call_count["n"] += 1
        # Real shape of the 2026-08-06 hallucination: high no_speech_prob
        # segments, rejected by evaluate_transcription_confidence.
        return Transcription(
            text="כתוביוטרו על ידי", provider="fake",
            segments=[{"text": "כתוביוטרו על ידי", "start_s": 0.0, "end_s": 1.0, "no_speech_prob": 0.9}],
        )

    monkeypatch.setattr(svc, "record_utterance", fake_record_utterance)
    stt = MagicMock(spec=["transcribe_detailed"])
    stt.transcribe_detailed = AsyncMock(side_effect=fake_transcribe_detailed)
    tts = _tts_double()
    player = _player()
    adapter = MagicMock()
    adapter.respond = MagicMock(side_effect=AssertionError("a rejected transcript must never reach the LLM"))
    store = MagicMock()
    turn_ctrl = TC()
    control_state = RuntimeControlState()

    # Must actually return (not hang) — pytest-asyncio's own timeout would
    # otherwise be the only thing stopping an infinite loop here.
    await svc.run_conversation_session(
        adapter, stt, tts, player, store, SESSION, turn_ctrl, control_state=control_state,
    )

    assert call_count["n"] == svc.MAX_CONSECUTIVE_STT_REJECTIONS
    assert control_state.runtime_state == "IDLE"
    assert turn_ctrl.get_state() == TurnState.STANDBY


# ── 14. turn N cannot output after turn N+1 owns the session ───────────────

@pytest.mark.asyncio
async def test_superseded_turn_produces_zero_output():
    tts = _tts_double()
    adapter = _make_adapter_with_draft("תשובה שלא אמורה להישמע כי התור הוחלף.")
    turn_ctrl = TurnController()
    turn_id_1 = turn_ctrl.new_turn()
    turn_ctrl.new_turn()  # turn 2 minted — turn 1 is now stale before it even runs

    interrupted, full_text, prefill = await svc.stream_response(
        adapter, tts, _player(), "טקסט כלשהו", SESSION, turn_ctrl, turn_id_1,
    )

    assert interrupted is True
    tts.synthesize.assert_not_awaited()   # turn 1 was already stale — TTS must never be called for it
    history = adapter._history[SESSION]
    assert history[0]["role"] == "user" and history[0]["content"] == "טקסט כלשהו"
    # An assistant placeholder is appended (not the generated draft text) so the
    # next real turn keeps strict user/assistant alternation — but the actual
    # generated draft ("תשובה שלא אמורה להישמע...") must never appear anywhere.
    assert all("תשובה שלא אמורה להישמע" not in m["content"] for m in history)


# ── 16. internal pause in user speech does not prematurely submit the turn ──

def test_internal_pause_does_not_confirm_barge_in_prematurely():
    """This is the SAME guarantee as test_barge_detector's decay test, proven
    again here via the actual constants stream_response uses live
    (BARGE_IN_RMS / BARGE_IN_FRAMES), not test-local values."""
    from service.barge_detector import BargeInWindowDetector

    det = BargeInWindowDetector(threshold=svc.BARGE_IN_RMS, confirm_frames=svc.BARGE_IN_FRAMES)
    block = np.full(240, svc.BARGE_IN_RMS * 2, dtype=np.float32)
    silent = np.zeros(240, dtype=np.float32)
    for _ in range(2):
        assert det.feed(block, float(svc.BARGE_IN_RMS * 2)) is False
    assert det.feed(silent, 0.0) is False   # one pause — must not submit/confirm yet
    assert det.confirmed is False


# ── PHASE 10 — required end-to-end acceptance ───────────────────────────────

@pytest.mark.asyncio
async def test_end_to_end_solar_system_interrupted_by_mars_request():
    """
    USER: "ספר לי על מערכת השמש"
    [Merlin starts answering; WHILE audibly speaking:]
    USER: "עצור, אני רוצה לדעת רק על מאדים"

    PASS requires: turn 1 stops mid-playback, is marked stale, its remaining
    text never reaches TTS, turn 2 is created without a wake word, the EXACT
    Mars transcript reaches the LLM, turn 2's answer is about Mars, and zero
    turn-1 audio plays after turn 2 begins.
    """
    turn_ctrl = TurnController()

    # ---- turn 1: solar system, interrupted mid-first-sentence ----
    FakeDuplexStream.rms_sequence = [0.05] * (svc.BARGE_IN_FRAMES + 4)
    solar_draft = (
        "מערכת השמש כוללת שמונה כוכבי לכת סביב השמש. "
        "כדור הארץ הוא הכוכב השלישי מהשמש ובו יש חיים. "
        "מאדים הוא הכוכב הרביעי ונקרא הכוכב האדום."
    )
    adapter = _make_adapter_with_draft(solar_draft)
    tts_1 = _tts_double()
    turn1_id = turn_ctrl.new_turn()

    interrupted_1, full_1, prefill = await svc.stream_response(
        adapter, tts_1, _player(), "ספר לי על מערכת השמש", SESSION, turn_ctrl, turn1_id,
    )

    assert interrupted_1 is True, "turn 1 must be interrupted"
    assert turn_ctrl.is_current(turn1_id) is False, "turn 1 must be marked stale"
    # Only the first sentence was ever handed to TTS — "כדור הארץ..." and
    # "מאדים..." (the rest of the solar-system answer) never reached TTS.
    assert tts_1.synthesize.await_count == 1
    assert prefill, "the interrupting speech's onset must be captured, not lost"

    # ---- turn 2: exact Mars transcript, uninterrupted ----
    FakeDuplexStream.rms_sequence = []  # no further interruption during turn 2
    mars_transcript = "עצור, אני רוצה לדעת רק על מאדים"
    mars_answer = "מאדים הוא הכוכב הרביעי במערכת השמש, ידוע ככוכב האדום."
    # Fresh adapter mock call for turn 2's draft (same adapter instance —
    # respond() is called again, the mock's .stream is re-armed):
    async def _fake_text_stream_2():
        yield mars_answer
    fake_stream_cm_2 = MagicMock()
    fake_stream_cm_2.__aenter__ = AsyncMock(return_value=MagicMock(text_stream=_fake_text_stream_2()))
    fake_stream_cm_2.__aexit__ = AsyncMock(return_value=False)
    adapter._client.messages.stream = MagicMock(return_value=fake_stream_cm_2)

    tts_2 = _tts_double()
    turn2_id = turn_ctrl.new_turn()   # no wake word — minted directly, like run_conversation_session does

    interrupted_2, full_2, prefill_2 = await svc.stream_response(
        adapter, tts_2, _player(), mars_transcript, SESSION, turn_ctrl, turn2_id,
    )

    assert interrupted_2 is False, "turn 2 must complete uninterrupted"
    assert full_2 == mars_answer
    assert "מאדים" in full_2

    # ---- zero turn-1 audio plays after turn 2 begins ----
    assert tts_1.synthesize.await_count == 1   # unchanged since turn 1 ended
    assert turn_ctrl.is_current(turn2_id) is True
    assert turn_ctrl.is_current(turn1_id) is False

    # ---- exact transcript integrity for turn 2 ----
    history = adapter._history[SESSION]
    user_entries = [m for m in history if m["role"] == "user"]
    assert user_entries[-1]["content"] == mars_transcript
