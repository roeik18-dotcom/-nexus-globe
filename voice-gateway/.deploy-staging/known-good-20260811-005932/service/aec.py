"""Real WebRTC acoustic echo cancellation for the full-duplex playback path
(2026-08-10). Wraps the LiveKit WebRTC APM (livekit.rtc.apm.AudioProcessingModule
— an FFI wrapper over the bundled native WebRTC lib, so it runs on macOS/Python
3.14 where cextension-ABI wheels do not).

Why this exists: correlation-only leakage rejection was proven to FAIL on live
hardware (real speaker->room->mic leakage is reverberant, max cross-correlation
~0.3, indistinguishable from independent speech). Real AEC models the room
impulse response and subtracts the echo, so BargeInWindowDetector can decide on
echo-reduced mic energy instead of raw mic energy.

Contract (verified against the installed API):
  * 48 kHz / 32 kHz / 16 kHz supported natively — the 48 kHz Babyface stream
    needs NO resampling.
  * frames are HARD 10 ms: 480 samples @48k. The duplex callback block is
    ~3072 samples (~64 ms) and is NOT a multiple of 480, so this class buffers
    render+capture and emits AEC-clean mic in 10 ms units, returning a
    same-length cleaned block (≤10 ms internal alignment lag, zero-padded only
    during the very first block).
  * call order per frame: process_reverse_stream(render) THEN
    process_stream(capture). Capture is cleaned in place.
  * APM state (the adaptive echo filter) PERSISTS across calls — one instance
    per turn, reused across every TTS chunk; never re-created per sentence.
"""
from __future__ import annotations

import numpy as np

_SUPPORTED_SR = (16_000, 32_000, 48_000)


class AecProcessor:
    def __init__(self, sample_rate: int, *, stream_delay_ms: int = 40) -> None:
        self.sr = int(sample_rate)
        self.enabled = self.sr in _SUPPORTED_SR
        self.frame = self.sr // 100                 # 10 ms
        self.stream_delay_ms = int(stream_delay_ms)
        self.init_error: str | None = None
        self._apm = None
        self._AudioFrame = None
        self._render_buf = np.zeros(0, dtype=np.int16)
        self._cap_buf = np.zeros(0, dtype=np.int16)
        self._clean_fifo = np.zeros(0, dtype=np.int16)
        # rolling ERLE estimate (echo return loss enhancement, dB) for diagnostics
        self.last_erle_db = 0.0
        if not self.enabled:
            self.init_error = f"unsupported sample_rate {self.sr} (APM needs 16k/32k/48k)"
            return
        try:
            from livekit.rtc.apm import AudioProcessingModule
            from livekit.rtc import AudioFrame
            self._AudioFrame = AudioFrame
            self._apm = AudioProcessingModule(
                echo_cancellation=True,
                noise_suppression=False,
                high_pass_filter=False,
                auto_gain_control=False,
            )
            try:
                self._apm.set_stream_delay_ms(self.stream_delay_ms)
            except Exception:
                pass
        except Exception as e:                      # binding missing/broken -> fail CLEARLY
            self.enabled = False
            self.init_error = f"{type(e).__name__}: {e}"

    @staticmethod
    def _rms(x: np.ndarray) -> float:
        return float(np.sqrt(np.mean(x.astype(np.float64) ** 2))) if x.size else 0.0

    def clean_block(self, mic_f32: np.ndarray, render_f32: np.ndarray) -> np.ndarray:
        """AEC-clean one duplex block. `mic_f32`/`render_f32` are float32 in
        [-1, 1] of the SAME length (this callback's mic ch1 and the exact PCM
        written to the speaker). Returns the echo-reduced mic as float32 of the
        same length. If AEC is unavailable, returns `mic_f32` unchanged (raw)."""
        if not self.enabled or self._apm is None:
            return mic_f32
        n = len(mic_f32)
        mic_i = (np.clip(mic_f32, -1.0, 1.0) * 32767.0).astype(np.int16)
        ren_i = (np.clip(render_f32, -1.0, 1.0) * 32767.0).astype(np.int16)
        self._cap_buf = np.concatenate([self._cap_buf, mic_i])
        self._render_buf = np.concatenate([self._render_buf, ren_i])
        F = self.frame
        AF = self._AudioFrame
        raw_acc = 0.0
        clean_acc = 0.0
        nframes = 0
        while self._cap_buf.size >= F and self._render_buf.size >= F:
            r = self._render_buf[:F]; self._render_buf = self._render_buf[F:]
            c = self._cap_buf[:F]; self._cap_buf = self._cap_buf[F:]
            self._apm.process_reverse_stream(
                AF(data=r.tobytes(), sample_rate=self.sr, num_channels=1, samples_per_channel=F))
            cf = AF(data=c.tobytes(), sample_rate=self.sr, num_channels=1, samples_per_channel=F)
            self._apm.process_stream(cf)
            cleaned = np.frombuffer(cf.data, dtype=np.int16)
            self._clean_fifo = np.concatenate([self._clean_fifo, cleaned])
            raw_acc += float(np.sum(c.astype(np.float64) ** 2))
            clean_acc += float(np.sum(cleaned.astype(np.float64) ** 2))
            nframes += 1
        if nframes and clean_acc > 0.0 and raw_acc > clean_acc:
            self.last_erle_db = 10.0 * np.log10(raw_acc / max(clean_acc, 1e-9))
        elif nframes:
            self.last_erle_db = 0.0
        take = min(n, self._clean_fifo.size)
        out = self._clean_fifo[:take]
        self._clean_fifo = self._clean_fifo[take:]
        if take < n:                                # only during the first block(s)
            out = np.concatenate([np.zeros(n - take, dtype=np.int16), out])
        return (out.astype(np.float32) / 32767.0)
