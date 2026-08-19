"""Continuous-speech-window confirmation for barge-in (PHASE 3 / PHASE 4).

Split out of the PortAudio callback so the "is this really the user
interrupting, or a click/cough/speaker-leakage transient" decision is
testable without an audio device — mirrors the existing pattern in
service/merlin_service.py::_CommandCapture, which does the same split for
the record_utterance VAD gate.

Confirmation rule: sustained above-threshold energy across `confirm_frames`
consecutive blocks, with linear decay (not a hard reset) on a below-threshold
block. Decay — not reset — is deliberate: real speech has micro-pauses
between syllables/words that a hard reset would treat as noise and never
accumulate to confirmation. A single-block transient (click, cough) decays
back to 0 in one step and can never reach confirm_frames; only sustained
energy can. This mirrors the tuning already proven in the pre-fix
BARGE_IN_FRAMES/`barge_count = max(0, barge_count - 1)` logic in
stream_response — extracted here unchanged, not reinvented.

Retains a bounded pre-roll ring (same shape as
COMMAND_PREROLL_S/_CommandCapture._push_preroll and
wake_trigger.KeywordBuffer's post-keyword buffer) so that once a barge-in is
confirmed, `.chunks` includes the audio from BEFORE the gate crossed
threshold — the onset of the interrupting utterance is not lost.

Self-playback / echo discrimination (NOT acoustic echo cancellation):
2026-08-08 — the original rule required mic RMS to exceed the concurrent
output RMS by ECHO_MARGIN ("the user must be louder than the speakers").
Live hardware evidence (BARGE_SELECTED_RMS legitimately above threshold —
0.011, 0.017, 0.028 — with echo_margin_ok=False on every one of them) showed
this rejects real speech any time Merlin's TTS is playing at a comparable or
louder level than the user, which is the common case, not the edge case.
Requiring "louder than the speakers" is the wrong test — a person doesn't
have to out-shout playback to be heard by a near-field mic.

Replaced with two independent, complementary signals, both computed from
data already available in the duplex callback (no real AEC/adaptive filter
needed):

1. Dynamic noise floor: an exponential moving average of RMS observed on
   blocks that were NOT part of a confirmed-or-building speech run (i.e.
   genuine ambient/room noise, updated continuously). Mic energy must clear
   `floor + floor_margin` as well as the absolute `threshold` — this is a
   *relative* bar against the room, not against the speaker output.
2. Correlation with the output reference: the caller passes the exact
   output block it just wrote to the speaker this same callback (available
   for free in a full-duplex stream — a non-duplex design would not have
   this). Acoustic leakage from speaker to mic is a scaled/filtered but
   time-aligned copy of that block, so it correlates strongly with it;
   independent human speech does not. A block whose (zero-lag, mean-removed)
   correlation with the output reference is at/above `correlation_threshold`
   is rejected as leakage regardless of its RMS; a block with low
   correlation is accepted even if comparable in level to the output.

This is still a heuristic, not AEC — it does not adapt to room impulse
response and a pathological echo path could defeat it. Live testing on the
actual Babyface/speaker placement is what proves whether it's sufficient.
"""

from __future__ import annotations

import logging
from collections import deque

import numpy as np

_log = logging.getLogger("merlin.barge_detector")


# Additional margin (linear RMS) required above the dynamic ambient floor.
# Matches the documented ambient noise floor (~0.002-0.003, see
# service/merlin_service.py BARGE_IN_RMS comment) — small on purpose since the
# absolute `threshold` already does most of the floor work in a quiet room;
# this only starts to bind when the room itself is noisy.
FLOOR_MARGIN = 0.003

# EMA smoothing factor for the dynamic floor tracker (higher = adapts faster).
FLOOR_EMA_ALPHA = 0.05

# Pearson correlation (mean-removed, normalized) between a mic block and the
# concurrently-written output block, at/above which the mic block is treated as
# speaker leakage rather than independent speech. 1.0 = identical waveform
# shape; independent speech over unrelated playback is close to 0.
CORRELATION_THRESHOLD = 0.6

# BOUNDED ACOUSTIC-LAG SEARCH (2026-08-10). Speaker->room->mic propagation
# delays the leakage waveform relative to the output block by a few ms, so the
# ZERO-LAG correlation used before this reads near-zero on genuine leakage
# (live self-barge measured 0.132) and fails to reject it -> false self-barge
# during Day Opening. Searching a small lag window (mic delayed 0..MAX_CORR_LAG_MS
# relative to output) recovers the aligned correlation. Proven on real Merlin
# TTS: leakage at 6-15 ms acoustic delay reads zero-lag ~-0.1..-0.3 (missed) but
# max-lag ~0.79-0.99 (rejected); an INDEPENDENT utterance over the same output
# reads max-lag ~0.26 (kept) — the window is too short to manufacture a spurious
# match, so real barge-in is preserved. Still a heuristic, not AEC.
# WIDENED 2026-08-10 (barge P0): 25 ms was SHORTER than the real Babyface ->
# speaker -> room -> mic delay. The AEC stream-delay alone is 40 ms, so the
# aligned residual echo sits BEYOND a 25 ms search and the max-lag correlation
# read ~0 on genuine leakage (live: false self-barge with correlation ~0 while
# output_rms 0.02-0.12). The window must reach the physical delay. 120 ms covers
# device buffering + a large room; the search is bounded (never unbounded) and
# stays real-time via a coarse step and running only on barge CANDIDATE blocks.
MAX_CORR_LAG_MS = 120.0
CORR_LAG_STEP = 24     # 0.5 ms @48k — coarse enough to stay real-time in the callback

# REVERB-TAIL GATE (2026-08-10). The residual self-barge that survived AEC is
# Merlin's own room reverb decaying AFTER an output chunk/word ends: the current
# render is already silent so the AEC has nothing to subtract, and the tail is
# too decorrelated for the lag search. Live-proven: every false confirm had
# output_rms ~0.0005 (silent) moments after a loud chunk, mic ~0.006. If the
# RECENT output was active but the CURRENT frame's output is quiet, we are inside
# the bounded reverb-decay window and mic energy is the tail, not the user. This
# never touches the active-playback path (output loud -> AEC cleans echo -> real
# user speech survives), so real barge-in is preserved.
REVERB_TAIL_MS = 300.0        # bounded reverb-decay window after output goes quiet
REVERB_ACTIVE_RMS = 0.005     # output RMS above which Merlin is "producing sound"


class BargeInWindowDetector:
    def __init__(
        self,
        *,
        threshold: float,
        confirm_frames: int,
        confirm_seconds: float = 0.20,
        preroll_s: float = 0.30,
        sample_rate: int = 48_000,
        floor_margin: float = FLOOR_MARGIN,
        floor_ema_alpha: float = FLOOR_EMA_ALPHA,
        correlation_threshold: float = CORRELATION_THRESHOLD,
        echo_margin: float | None = None,
    ) -> None:
        self.threshold = threshold
        self.confirm_frames = confirm_frames
        # Confirmation is TIME-based (elapsed voiced audio), NOT a fixed callback
        # count. The duplex callback block is ~69.66 ms (3072 frames @ 44.1 kHz),
        # so the old `confirm_frames=8 ≈ 160 ms (8×20 ms)` assumption actually
        # required ~557 ms and never fired on real ~350 ms utterances (turn_id=22
        # hardware evidence, 2026-08-08). We accumulate real seconds instead so the
        # trigger is independent of block size.
        self.confirm_seconds = confirm_seconds
        self.preroll_s = preroll_s
        self.sample_rate = sample_rate
        self.floor_margin = floor_margin
        self.floor_ema_alpha = floor_ema_alpha
        self.correlation_threshold = correlation_threshold
        # Accepted-but-unused: kept so any remaining caller passing the old
        # `echo_margin=` kwarg does not crash. The "must be louder than the
        # speakers" rule it implemented is gone — see module docstring
        # (2026-08-08 rewrite). Exposed as an attribute (not just discarded)
        # because service/merlin_service.py's diagnostic logging still reads
        # `detector.echo_margin` in one legacy log line during the rollout.
        self.echo_margin = echo_margin

        # USER-ELIGIBLE preroll ring only. Blocks rejected as
        # `correlated_with_output` (Merlin's own playback leaking into the mic)
        # are NEVER admitted here, so they can never be prepended to the prefill
        # that seeds the next record_utterance — that reintroduction was the
        # echo -> phantom-STT vector. Below-floor/ambient blocks ARE kept: they
        # carry the onset of the interrupting utterance just before it crosses
        # threshold, which we must preserve.
        self._user_preroll: deque[np.ndarray] = deque()
        self._user_preroll_samples = 0
        # Audit counters (in samples/"frames") — emitted once at confirmation.
        self._preroll_total_samples = 0             # every rejected block considered
        self._preroll_user_samples = 0              # cumulative user-eligible kept
        self._preroll_dropped_correlated_samples = 0  # cumulative Merlin-leak dropped
        self._correlated_appended = 0               # invariant tripwire: must stay 0
        self._run_count = 0
        self._run_seconds = 0.0          # accumulated voiced duration of the current run
        self._floor_rms = 0.0
        # Bounded ring of recently-written output (mono float64) so the leakage
        # lag search can reference output from PREVIOUS callbacks — the acoustic
        # speaker->mic delay may cross a block boundary.
        self._output_history: np.ndarray = np.zeros(0, dtype=np.float64)

        self.chunks: list[np.ndarray] = []
        self.confirmed = False
        # Set by the most recent feed() call — for callers that want to log
        # *why* a block was accepted/rejected (BARGE trace lines).
        # When the mic feed is AEC-cleaned (real echo cancellation upstream),
        # correlation is NO LONGER the primary leakage-rejection decision — the
        # echo is already removed, so the energy/floor gate on the clean signal
        # decides. Correlation is still COMPUTED and logged (BARGE_CORR) but must
        # not reject. Set False by the AEC playback path; True preserves the
        # pre-AEC behavior for callers that still pass raw mic.
        self.correlation_reject_enabled: bool = True
        self.last_reject_reason: str | None = None
        self.last_correlation: float = 0.0          # the DECISION correlation (max-lag, clean mic)
        self.last_correlation_zero: float = 0.0     # zero-lag, kept for diagnostics/compare
        self.last_correlation_raw: float = 0.0      # max-lag on the RAW (pre-AEC) mic — diagnostic
        self.last_correlation_lag_ms: float = 0.0   # acoustic lag (ms) at max correlation
        self.last_selected_lag_samples: int = 0     # acoustic lag (samples) at max correlation
        self.last_history_samples: int = 0          # output-history depth available to the search

    def _push_preroll(self, block: np.ndarray, *, correlated: bool) -> None:
        """Bounded ring of the pre-onset audio, USER-ELIGIBLE ONLY.

        A block rejected because it correlates with the concurrent output
        (speaker->mic leakage of Merlin's own voice) is counted and DROPPED —
        it must never reach the prefill. Everything else (genuine ambient /
        onset ramp) is kept, ring-bounded to `preroll_s`.
        """
        self._preroll_total_samples += len(block)
        if correlated:
            self._preroll_dropped_correlated_samples += len(block)
            return
        cap = int(self.preroll_s * (self.sample_rate or 48_000))
        self._user_preroll.append(block)
        self._user_preroll_samples += len(block)
        self._preroll_user_samples += len(block)
        while self._user_preroll and self._user_preroll_samples - len(self._user_preroll[0]) >= cap:
            self._user_preroll_samples -= len(self._user_preroll.popleft())

    @staticmethod
    def _correlation(mic_block: np.ndarray, output_block: np.ndarray) -> float:
        """Zero-lag Pearson correlation between two same-callback blocks.

        Returns 0.0 (== "not correlated") whenever there isn't enough signal
        to judge — silence on either side, mismatched/degenerate blocks —
        rather than raising or guessing. A short lag is not searched: within
        one duplex callback (tens of ms), direct speaker->mic acoustic
        propagation delay is a small fraction of the block and zero-lag
        already tracks it well enough for a heuristic (not real AEC).
        """
        n = min(mic_block.size, output_block.size)
        if n < 8:
            return 0.0
        m = mic_block[:n].astype(np.float64)
        o = output_block[:n].astype(np.float64)
        m = m - m.mean()
        o = o - o.mean()
        denom = float(np.sqrt(np.sum(m * m) * np.sum(o * o)))
        if denom <= 1e-12:
            return 0.0
        return float(np.sum(m * o) / denom)

    def _update_output_history(self, output_block: np.ndarray) -> None:
        """Append the just-written output block to a bounded history so the lag
        search can reference output played in PREVIOUS callbacks (the acoustic
        speaker->mic delay can push leakage across a block boundary)."""
        self._output_history = np.concatenate(
            [self._output_history, output_block.astype(np.float64)]
        )
        # Must hold at least one full mic block PLUS the widest lag we search, so
        # every candidate lag correlates a FULL-length window (no partial-window
        # shrinkage — the regression guarded by requirement #3) even at max lag.
        max_lag_samp = int(MAX_CORR_LAG_MS / 1000.0 * (self.sample_rate or 48_000))
        cap = 2 * max(1, output_block.size) + max_lag_samp
        if self._output_history.size > cap:
            self._output_history = self._output_history[-cap:]

    def _max_lag_correlation(self, mic_block: np.ndarray) -> tuple[float, float, int]:
        """Max |Pearson correlation| of the FULL mic block against the output
        history delayed by 0..MAX_CORR_LAG_MS. Using the history means every lag
        compares FULL-length windows (no partial-window shrinkage that inflates
        narrowband correlation) and the delay may span callback boundaries.
        Returns (signed_max_corr, lag_ms, lag_samples); (0.0, 0.0, 0) when there
        isn't enough signal/history to judge. Runs only on barge CANDIDATE blocks."""
        N = mic_block.size
        hist = self._output_history
        if N < 16 or hist.size < N + 8:
            return 0.0, 0.0, 0
        m = mic_block.astype(np.float64); m = m - m.mean()
        mnorm = float(np.sqrt(np.sum(m * m)))
        if mnorm <= 1e-9:
            return 0.0, 0.0, 0
        max_lag = min(int(MAX_CORR_LAG_MS / 1000.0 * (self.sample_rate or 48_000)), hist.size - N)
        end = hist.size
        best = 0.0
        best_lag = 0
        for lag in range(0, max_lag + 1, CORR_LAG_STEP):
            ref = hist[end - N - lag: end - lag]        # N samples of output, delayed by `lag`
            if ref.size != N:
                continue
            r = ref - ref.mean()
            denom = mnorm * float(np.sqrt(np.sum(r * r)))
            if denom <= 1e-12:
                continue
            c = float(np.sum(m * r) / denom)
            if abs(c) > abs(best):
                best = c
                best_lag = lag
        return best, best_lag / max(1, (self.sample_rate or 48_000)) * 1000.0, best_lag

    def _recent_output_rms(self, window_ms: float = REVERB_TAIL_MS) -> float:
        """RMS of the output written over the last `window_ms` — used to detect
        the reverb-decay window (Merlin was just producing sound)."""
        h = self._output_history
        if h.size == 0:
            return 0.0
        n = int(window_ms / 1000.0 * (self.sample_rate or 48_000))
        seg = h[-n:] if n and h.size > n else h
        return float(np.sqrt(np.mean(seg * seg))) if seg.size else 0.0

    def feed(
        self,
        block: np.ndarray,
        rms: float,
        *,
        output_rms: float = 0.0,
        output_block: np.ndarray | None = None,
        raw_block: np.ndarray | None = None,
    ) -> bool:
        """Consume one block. Returns True the instant continuous speech is confirmed.

        `output_rms` / `output_block`: level and exact waveform of the audio
        simultaneously being written to the speaker this same block (0.0 /
        None if not known or not playing). `block`/`rms` are the mic the ENERGY
        gate judges (AEC-cleaned when AEC is upstream). `raw_block` is the
        OPTIONAL pre-AEC mic — correlated too, for live diagnostics only (never
        the decision), so the raw-vs-clean leakage separation is visible in the
        BARGE_LEAK trace on real hardware.

        Leakage discrimination is the BOUNDED-LAG correlation of the DECISION mic
        (`block`) against the output HISTORY: after AEC the residual echo is a
        delayed, attenuated — but still output-correlated — copy, aligned only at
        the real device/acoustic lag, so the lag search across callback
        boundaries recovers it while independent user speech reads ~0 at every
        lag. This is a heuristic, not AEC.

        Once confirmed, `.chunks` holds pre-roll + every above-threshold-run
        block collected so far — the candidate first fragment of the user's
        interrupting utterance.
        """
        if self.confirmed:
            return True

        # Keep the output history continuous across EVERY playing block (not just
        # candidates) so the lag search can reach back across callback boundaries.
        if output_block is not None:
            self._update_output_history(output_block)

        above_floor = rms >= self.threshold and rms >= (self._floor_rms + self.floor_margin)
        correlated = False
        corr = 0.0
        corr_zero = 0.0
        corr_raw = 0.0
        lag_ms = 0.0
        lag_samples = 0
        hist_samples = int(self._output_history.size)
        if above_floor and output_rms > 0.0 and self._output_history.size > 0:
            # BOUNDED-LAG max correlation against the output HISTORY (not zero-lag:
            # the real speaker->mic delay shifts leakage out of zero-lag alignment).
            corr_zero = self._correlation(block, output_block) if output_block is not None else 0.0
            corr, lag_ms, lag_samples = self._max_lag_correlation(block)
            if raw_block is not None:                       # diagnostic-only compare
                corr_raw, _, _ = self._max_lag_correlation(raw_block)
            # ALWAYS ON. The prior `correlation_reject_enabled = not aec.enabled`
            # gate DISABLED this whenever AEC ran, so nothing rejected the loud-
            # output residual echo -> false self-barge. AEC lowers the echo LEVEL;
            # this lag correlation rejects whatever residual still correlates.
            correlated = self.correlation_reject_enabled and abs(corr) >= self.correlation_threshold
            _log.info(
                "BARGE_LEAK mic_rms=%.5f output_rms=%.5f floor_rms=%.5f "
                "max_abs_correlation=%.3f selected_lag_samples=%d selected_lag_ms=%.1f "
                "zero_lag_corr=%.3f raw_corr=%.3f history_samples_available=%d run_s=%.2f correlated=%s",
                rms, output_rms, self._floor_rms, abs(corr), lag_samples, lag_ms,
                corr_zero, corr_raw, hist_samples, self._run_seconds, correlated,
            )
        self.last_correlation = corr
        self.last_correlation_zero = corr_zero
        self.last_correlation_raw = corr_raw
        self.last_correlation_lag_ms = lag_ms
        self.last_selected_lag_samples = lag_samples
        self.last_history_samples = hist_samples

        # REVERB-TAIL GATE: current render quiet + recent output active => the mic
        # energy is Merlin's own decaying tail, not the user. Bounded window; the
        # active-playback path is unaffected (output loud => this is False).
        in_reverb_tail = False
        if above_floor and output_rms < REVERB_ACTIVE_RMS:
            recent_out = self._recent_output_rms()
            in_reverb_tail = recent_out >= REVERB_ACTIVE_RMS
            if in_reverb_tail:
                _log.info(
                    "BARGE_REVERB_TAIL rms=%.5f output_rms=%.5f recent_output_rms=%.5f "
                    "-> rejected (Merlin's own reverb tail, not user)",
                    rms, output_rms, recent_out,
                )

        block_s = block.shape[0] / max(1, self.sample_rate)
        is_speech = above_floor and not correlated and not in_reverb_tail
        if is_speech:
            self.last_reject_reason = None
            self._run_count += 1
            self._run_seconds += block_s
            self.chunks.append(block)          # confirmed-run block — clean near-end
        else:
            self.last_reject_reason = (
                "reverb_tail" if in_reverb_tail else
                "correlated_with_output" if correlated else "below_floor_or_threshold"
            )
            self._run_count = max(0, self._run_count - 1)
            self._run_seconds = max(0.0, self._run_seconds - block_s)
            if self._run_count == 0:
                self.chunks.clear()
                self._run_seconds = 0.0
            # reverb-tail blocks must not seed the user prefill either
            self._push_preroll(block, correlated=(correlated or in_reverb_tail))
            # Ambient-floor tracking: only adapt toward blocks that are not
            # currently building/holding a speech run, so real speech cannot
            # raise its own floor and start suppressing itself.
            if self._run_count == 0:
                self._floor_rms = (
                    (1.0 - self.floor_ema_alpha) * self._floor_rms + self.floor_ema_alpha * rms
                )

        if self._run_seconds >= self.confirm_seconds:
            self.confirmed = True
            # Final prefill = USER-ELIGIBLE preroll (onset) + confirmed run.
            # Both sources exclude output-correlated blocks by construction:
            # run blocks require `not correlated` (is_speech), and _user_preroll
            # drops correlated blocks at push time. `_correlated_appended` is a
            # tripwire that must remain 0; if a future change ever violates it,
            # we drop the preroll entirely rather than forward Merlin's echo.
            run_frames = int(sum(len(c) for c in self.chunks))
            if self._correlated_appended == 0:
                self.chunks = list(self._user_preroll) + self.chunks
            else:
                _log.error(
                    "BARGE_PREFILL_CONTAMINATION_VIOLATION output_correlated_frames_in_final_prefill=%d "
                    "— dropping preroll, forwarding confirmed run only",
                    self._correlated_appended,
                )
                # self.chunks already holds only the confirmed run (clean).
            final_frames = int(sum(len(c) for c in self.chunks))
            dur_ms = final_frames / max(1, self.sample_rate) * 1000.0
            _log.info("BARGE_PREROLL_TOTAL_FRAMES frames=%d", self._preroll_total_samples)
            _log.info("BARGE_PREROLL_USER_ELIGIBLE_FRAMES frames=%d", self._preroll_user_samples)
            _log.info("BARGE_PREROLL_OUTPUT_CORRELATED_DROPPED frames=%d", self._preroll_dropped_correlated_samples)
            _log.info("BARGE_CONFIRMED_RUN_FRAMES frames=%d", run_frames)
            _log.info("BARGE_PREFILL_FINAL_FRAMES frames=%d", final_frames)
            _log.info("BARGE_PREFILL_FINAL_DURATION_MS ms=%.1f", dur_ms)
            _log.info(
                "BARGE_PREFILL_CONTAMINATION_CHECK output_correlated_frames_in_final_prefill=%d",
                self._correlated_appended,
            )
            self._user_preroll.clear()
            self._user_preroll_samples = 0
            return True
        return False
