# MERLIN — Descriptive Baseline v1

> **Type: DESCRIPTIVE** — organic real-world usage under *variable* conditions.
> **NOT** an experimental baseline: it CANNOT attribute a metric change to a single
> variable (e.g. Gain). See **Scope & limits**.
> Source: `tools/log_metrics.py` (read-only, v2 per-turn segmentation), current config generation.
> Frozen: 2026-07-30.

## Capture context
| | |
|---|---|
| Window | 2026-07-30 14:43:21 → 17:34:06 (2.8 h) |
| Config generation | TTS provider = OpenAITTS (after last `Ready…TTS=`) |
| Mic mapping | RME Babyface, `channel_index=1` (verified) |
| VAD | `VAD_THRESHOLD = 0.004` (operational) |
| Sample | 94 completed turns across 78 wake events |
| Reproduce | `.venv/bin/python tools/log_metrics.py` |

## Latency (per stage, seconds)
| Stage | n | mean | median | p95 | min | max |
|---|--:|--:|--:|--:|--:|--:|
| wake keyword STT | 348 | 1.67 | 1.52 | 3.11 | 0.56 | 10.82 |
| wake→listen gap | 78 | 1.86 | 1.59 | 2.40 | 1.02 | 2.44 |
| command STT | 94 | 1.89 | 1.65 | 3.32 | 0.53 | 5.90 |
| LLM (think) | 94 | 2.09 | 1.70 | 5.30 | 0.15 | 12.17 |
| TTS (first audio) | 94 | 2.83 | 2.74 | 3.92 | 1.60 | 6.89 |
| **end-to-end**\* | 94 | 5.95 | **5.42** | 10.24 | 3.55 | 16.00 |

\* transcript → first audio out (excludes wake STT + wake→listen gap; user-perceived wake→audio is ~3 s higher).

## Reliability
| Counter | Value |
|---|--:|
| wake events | 78 |
| non-keyword VAD flushes (speech ≠ 'merlin') | 280 |
| **failed command captures** (0 bytes / no speech / silence timeout) | **72** |
| completed turns | 94 |
| interrupted replies | 0 (0 %) |
| parser anomalies (incomplete turns discarded) | 62 |
| excluded non-positive latencies | 0 |

## Reading (interpretation — not a locked conclusion)
- **Latency is acceptable**, not the bottleneck: e2e median ~5.4 s, 0 interruptions.
- **Dominant issue = capture reliability**: 72 failed captures + 280 non-keyword flushes + 62 anomalies against only 78 wakes. Aligns with Issue #2 (post-wake command capture).
- Gain optimization is therefore judged **primarily on reliability**; latency is a **secondary regression guard**.

## Scope & limits
- Organic usage → **mixed conditions** (mic distance, room noise, command types). Valid for characterizing real behavior; **invalid** for single-variable attribution.
- Any Gain A/B must be compared against an **Experimental Baseline** (fixed gain / distance / phrase / room, 20 identical completed turns), isolated with `log_metrics.py --since '<start>'`.

## Next
1. ✅ Descriptive Baseline v1 — frozen (this document).
2. ⏳ Experimental Baseline — 20 identical turns, fixed conditions, no restart.
3. ⏳ Gain A/B — reliability-first (failed captures · non-keyword flushes · WAKE_MATCH · empty transcripts · speech duration); latency secondary.
