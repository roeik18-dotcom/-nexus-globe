# Barge-Correlation-P0 — Preservation & Audit Package

**Created:** 2026-08-11 (~00:40) · **Decision:** ZERO-RISK — no restart, no live-source mutation.
**Purpose:** Preserve the divergent (un-deployed) barge correlation work and a full audit of the
frozen runtime, WITHOUT touching PID 82246 or any live source file.

---

## Frozen live runtime
- **PID:** 82246 (single Merlin service process)
- **Started:** Mon Aug 10 2026 20:10:02 (launchd `com.merlin.voice`, PPID 1)
- **Port:** 127.0.0.1:8802  ·  **cwd:** /Users/roei/-nexus-globe/voice-gateway
- **Live thresholds (from the process's own trace):** `BARGE_IN_RMS = 0.00400`, `COMMAND_RMS_THRESHOLD = 0.00300`
- **Proven barge behavior (see `live-barge-fingerprint.txt`):** running vocabulary is `BARGE_CORR`
  (NOT the `BARGE_LEAK` of the divergent disk version), and the interrupt chain works end-to-end:
  `USER_SPEECH_CONFIRMED → PLAYBACK_TERMINATION_REQUESTED → PLAYBACK_TERMINATED → ASSISTANT_TURN_INTERRUPTED`
  (captured live at turn 78, 00:01:07).

## AUDIT-LANGUAGE CORRECTION (per operator directive)
An mtime **older than the process start proves only that _no post-start modification was observed_** —
it is **NOT** proof that the on-disk bytes equal what the running process loaded, unless backed by a
matching **hash or snapshot**. No such 20:10 snapshot/hash exists for `barge_detector.py` /
`merlin_service.py` (the 15:32 `.backups` snapshot predates the max-lag code; the 20:39 `.pyc` was
overwritten by a pytest import; `barge_detector.py` was never committed to git). Therefore the exact
20:10 source is **not recoverable byte-for-byte**, and any "restore" would be a **reconstruction, not a
proven restore** — which is why the restart was declined.

## What is preserved here
| File | Meaning |
|---|---|
| `barge_detector.py` | byte-identical copy of current divergent live source (mtime 20:38) |
| `merlin_service.py` | byte-identical copy of current divergent live source (mtime 20:39) |
| `barge-correlation-p0.patch` | combined unified diff (barge_detector vs 15:32 baseline; merlin_service vs git HEAD) |
| `barge_detector.since-1532-baseline.patch` | barge_detector evolution since the 15:32 snapshot |
| `merlin_service.vs-git-HEAD.patch` | merlin_service divergence from committed HEAD |
| `current-source.sha256` / `staged-copies.sha256` | identity hashes (the only real proof of source identity) |
| `git-status.txt` / `git-diff-stat.txt` | repo state |
| `mtimes.txt` | mtimes (interpret per the caveat above) |
| `live-barge-fingerprint.txt` | the frozen proven barge chain from the running log |
| `control-panel-routes.txt` | running-process route table (31 routes) |
| `not-exposed-fields.txt` | 17 served-HTML fields absent from the running backend |

## The divergent 20:38–20:39 work (DO NOT deploy without offline validation)
`barge_detector.py`: `MAX_CORR_LAG_MS 25→120`, `CORR_LAG_STEP 8→24`, history-cap formula,
`_max_lag_correlation` 2→3-tuple, +3 `__init__` attrs, `feed()` +`raw_block`/`corr_raw`,
log `BARGE_CORR`→`BARGE_LEAK`.
`merlin_service.py`: `correlation_reject_enabled = not _aec.enabled` → `= True`; `feed(... raw_block=mic_raw.copy())`;
enriched `USER_SPEECH_CONFIRMED`/`BARGE_REJECTED` logs.
Open uncertainty: whether the reverb-tail gate was in the 20:10 version (must be resolved from the
edit transcript, not from mtimes).

## NOT deployed / NOT reconstructed
Live source files were **not** modified or overwritten. No reconstruction was performed. PID 82246 left running.

## Next safe development step (OFFLINE only)
1. Build a **reproducible known-good barge baseline** from a controlled source snapshot/commit
   (tag it; hash it) — do not derive it from live mtimes.
2. Run **automated regression tests** against that baseline (barge suite + turn-taking).
3. Apply this `barge-correlation-p0` patch on top, re-run regressions, confirm green.
4. Only then schedule a **separately approved live deployment window** with an immediate
   rollback plan (revert to the tagged baseline if the live `BARGE_CORR` fingerprint changes).
