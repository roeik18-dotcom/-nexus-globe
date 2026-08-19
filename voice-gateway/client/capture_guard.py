"""
Pre-capture audio-conflict guard for Merlin — macOS-first, v1.

WHY: before recording user speech, make sure Merlin's own TTS, a post-TTS tail, or
persistent ambient sound leaking into the mic is not mistaken for the user.

HONEST SCOPE (audited against the shipped stack — sounddevice + numpy):
  • We KNOW when Merlin's own TTS plays (we control it) → block during it + a cooldown.
  • We can measure the MICROPHONE input level (RMS) → require a quiet window first.
  • We CANNOT inspect other apps' system OUTPUT audio with this stack. True output
    monitoring needs BlackHole, ScreenCaptureKit, or CoreAudio process taps — none are
    installed. So `system_audio_active` comes from a pluggable provider that DEFAULTS
    TO FALSE and never fabricates a positive. A real provider can be added later.

This module is self-contained: it changes NO existing capture flow and never pauses
apps or changes volume (v1). Integration is a single call from the capture path — see
the module-level `pre_capture_check` and the repo's integration notes.
"""
from __future__ import annotations

import logging
import math
import os
import time
from dataclasses import dataclass
from typing import Callable, Mapping, Protocol, Sequence

log = logging.getLogger("merlin.capture_guard")

MicSampler = Callable[[], Sequence[float]]  # returns per-block RMS over the quiet window
Clock = Callable[[], float]                 # monotonic seconds


@dataclass(frozen=True)
class GuardConfig:
    """Tunables. Overridable via MERLIN_GUARD_* env vars (see `from_env`)."""

    rms_threshold: float = 0.02   # linear RMS 0..1; a block below this is "quiet"
    quiet_window_ms: int = 400    # how long the mic is sampled before capture (300-500)
    min_quiet_ms: int = 300       # required contiguous quiet at the END of the window
    block_ms: int = 50            # RMS is computed per block of this size
    tts_cooldown_ms: int = 400    # keep blocking for this long after TTS ends
    sample_rate: int = 16000
    channels: int = 1

    @classmethod
    def from_env(cls, env: Mapping[str, str] | None = None) -> "GuardConfig":
        e = os.environ if env is None else env

        def _f(key: str, default: float) -> float:
            try:
                return float(e.get(key, default))
            except (TypeError, ValueError):
                return default

        def _i(key: str, default: int) -> int:
            try:
                return int(e.get(key, default))
            except (TypeError, ValueError):
                return default

        return cls(
            rms_threshold=_f("MERLIN_GUARD_RMS_THRESHOLD", cls.rms_threshold),
            quiet_window_ms=_i("MERLIN_GUARD_QUIET_WINDOW_MS", cls.quiet_window_ms),
            min_quiet_ms=_i("MERLIN_GUARD_MIN_QUIET_MS", cls.min_quiet_ms),
            block_ms=_i("MERLIN_GUARD_BLOCK_MS", cls.block_ms),
            tts_cooldown_ms=_i("MERLIN_GUARD_TTS_COOLDOWN_MS", cls.tts_cooldown_ms),
            sample_rate=_i("MERLIN_GUARD_SAMPLE_RATE", cls.sample_rate),
            channels=_i("MERLIN_GUARD_CHANNELS", cls.channels),
        )


@dataclass(frozen=True)
class GuardResult:
    allow: bool
    # allow | override | tts_active | tts_cooldown | system_audio_active | mic_not_quiet | mic_unavailable
    reason: str
    mic_rms: float            # measured tail RMS; math.nan when the mic was not sampled
    tts_active: bool
    cooldown_active: bool
    system_audio_active: bool


class SystemAudioProvider(Protocol):
    """Extension point for future OUTPUT-audio detection. `is_active()` returns True
    only when a real backend confirms audible system output."""

    def is_active(self) -> bool:
        ...


class NullSystemAudioProvider:
    """Default provider. With sounddevice+numpy we cannot observe other apps' output,
    so this honestly returns False — never a fabricated positive. Replace with one of:

      • ScreenCaptureKitProvider — macOS 13+, SCStream audio (needs a pyobjc/Swift bridge)
      • BlackHoleProvider        — capture a virtual loopback output device
      • CoreAudioProvider        — kAudioDevicePropertyDeviceIsRunningSomewhere (coarse),
                                   or process taps (macOS 14.4+); needs CoreAudio bindings

    each implementing `SystemAudioProvider.is_active()`. Until one exists, the guard
    relies only on the TTS gate and the mic quiet-window.
    """

    def is_active(self) -> bool:
        return False


class TtsState:
    """Deterministic 'is Merlin speaking' signal + post-TTS cooldown. The TTS player
    calls `mark_started()` / `mark_ended()` around playback — no audio inspection."""

    def __init__(self, clock: Clock = time.monotonic) -> None:
        self._clock = clock
        self._active = False
        self._ended_at: float | None = None

    def mark_started(self) -> None:
        self._active = True
        self._ended_at = None

    def mark_ended(self) -> None:
        if self._active:
            self._active = False
            self._ended_at = self._clock()

    def is_active(self) -> bool:
        return self._active

    def cooldown_active(self, cooldown_ms: int) -> bool:
        if self._active or self._ended_at is None:
            return False
        return (self._clock() - self._ended_at) * 1000.0 < cooldown_ms


def _default_mic_sampler(config: GuardConfig) -> Sequence[float]:
    """Record the mic for `quiet_window_ms` and return per-block RMS. Imports the audio
    stack lazily, so the module (and its tests, which inject a sampler) don't require it.
    Returns [] if the mic is unavailable — the guard treats 'no data' as NOT quiet."""
    try:
        import numpy as np
        import sounddevice as sd
    except Exception as exc:  # ImportError, or PortAudio init failure
        log.warning("capture_guard: audio stack unavailable (%s)", exc)
        return []
    try:
        frames = int(config.sample_rate * config.quiet_window_ms / 1000)
        audio = sd.rec(frames, samplerate=config.sample_rate, channels=config.channels, dtype="float32")
        sd.wait()
        flat = np.asarray(audio, dtype="float32").reshape(-1)
        block = max(1, int(config.sample_rate * config.block_ms / 1000))
        out: list[float] = []
        for i in range(0, len(flat), block):
            chunk = flat[i:i + block]
            if len(chunk):
                out.append(float(np.sqrt(np.mean(np.square(chunk)))))
        return out
    except Exception as exc:
        log.warning("capture_guard: mic sample failed (%s)", exc)
        return []


class CaptureGuard:
    """The gate. Decides whether it is safe to start recording. Everything external —
    the clock, the mic sampler, the TTS state, the system-audio provider — is injectable
    so behaviour is fully testable without a microphone."""

    def __init__(
        self,
        config: GuardConfig | None = None,
        tts: TtsState | None = None,
        mic_sampler: MicSampler | None = None,
        system_audio_provider: SystemAudioProvider | None = None,
        clock: Clock = time.monotonic,
    ) -> None:
        self.config = config or GuardConfig.from_env()
        self.tts = tts or TtsState(clock=clock)
        self._sampler = mic_sampler or (lambda: _default_mic_sampler(self.config))
        self._system_audio = system_audio_provider or NullSystemAudioProvider()

    def _evaluate_quiet(self, block_rms: Sequence[float]) -> tuple[bool, float]:
        """Only the trailing `min_quiet_ms` of the window must be quiet — so a brief
        noise at the start (e.g. the key press) doesn't block a genuinely quiet lead-in.
        Returns (is_quiet, tail_rms). `tail_rms` is the loudest block in that tail."""
        n_tail = max(1, self.config.min_quiet_ms // max(1, self.config.block_ms))
        tail = list(block_rms)[-n_tail:]
        if not tail:
            return False, math.nan
        level = max(tail)
        return all(r < self.config.rms_threshold for r in tail), level

    def pre_capture_check(self, override: bool = False) -> GuardResult:
        tts_active = self.tts.is_active()
        cooldown_active = self.tts.cooldown_active(self.config.tts_cooldown_ms)
        system_audio_active = bool(self._system_audio.is_active())

        # Cheap, certain signals short-circuit BEFORE sampling the mic — fast, and it
        # avoids sampling Merlin's own TTS bleed. mic_rms = NaN when not sampled.
        if override:
            return self._decide(True, "override", math.nan, tts_active, cooldown_active, system_audio_active, override)
        if tts_active:
            return self._decide(False, "tts_active", math.nan, tts_active, cooldown_active, system_audio_active, override)
        if cooldown_active:
            return self._decide(False, "tts_cooldown", math.nan, tts_active, cooldown_active, system_audio_active, override)
        if system_audio_active:
            return self._decide(False, "system_audio_active", math.nan, tts_active, cooldown_active, system_audio_active, override)

        block_rms = self._sampler()
        if not block_rms:
            # Cannot measure → cannot prove quiet. Block rather than fake silence.
            return self._decide(False, "mic_unavailable", math.nan, tts_active, cooldown_active, system_audio_active, override)
        quiet, mic_rms = self._evaluate_quiet(block_rms)
        reason = "allow" if quiet else "mic_not_quiet"
        return self._decide(quiet, reason, mic_rms, tts_active, cooldown_active, system_audio_active, override)

    def _decide(
        self,
        allow: bool,
        reason: str,
        mic_rms: float,
        tts_active: bool,
        cooldown_active: bool,
        system_audio_active: bool,
        override: bool,
    ) -> GuardResult:
        result = GuardResult(allow, reason, mic_rms, tts_active, cooldown_active, system_audio_active)
        log.info(
            "capture_guard allow=%s reason=%s mic_rms=%s threshold=%s window_ms=%s "
            "tts_active=%s cooldown_active=%s system_audio_active=%s override=%s",
            allow,
            reason,
            "nan" if math.isnan(mic_rms) else round(mic_rms, 5),
            self.config.rms_threshold,
            self.config.quiet_window_ms,
            tts_active,
            cooldown_active,
            system_audio_active,
            override,
        )
        return result


# ── module-level default instance + the single public API ────────────────────
_default_guard: CaptureGuard | None = None


def default_guard() -> CaptureGuard:
    """The process-wide guard. Use `.tts.mark_started()/mark_ended()` around TTS."""
    global _default_guard
    if _default_guard is None:
        _default_guard = CaptureGuard()
    return _default_guard


def set_default_guard(guard: CaptureGuard) -> None:
    global _default_guard
    _default_guard = guard


def pre_capture_check(override: bool = False) -> GuardResult:
    """The single public API. Start STT only if `result.allow`. `override=True` forces
    capture (an explicit user key) but the true state is still reported and logged."""
    return default_guard().pre_capture_check(override=override)
