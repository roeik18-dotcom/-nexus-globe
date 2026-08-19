# Merlin Runtime Capability Audit — Voice Turn-Taking, Barge-in & Cancellation

**Status:** Research audit (no code changed). Date: 2026-08-01.
**Scope:** Compare Merlin's *current* voice runtime to modern voice-agent architectures
and decide EXTEND vs MIGRATE on evidence, not preference.

### Evidence legend (used on every claim)
- **[C] Code-fact** — verified by reading the current code (file:line).
- **[I] Inferred** — a consequence deduced from the code, not directly stated.
- **[X] External** — how other systems do it, with an official source URL.
- **[R] Recommendation** — proposed for Merlin (opinion, marked as such).

Sources for all [X] claims are official docs, gathered 2026-08. OpenAI docs now serve
from `developers.openai.com` (301 from `platform.openai.com`).

---

## 1. Current architecture (Merlin, as coded)

Merlin's voice service is a **single-threaded, half-duplex, sequential loop** in
`voice-gateway/service/merlin_service.py`:

```
wake (wake_trigger.py: Whisper keyword + double-clap, language=he)
  → chime (fire-and-forget)
  → record_utterance()               # opens mic InputStream, RMS-VAD, returns WAV
  → stt.transcribe(audio)            # Whisper, language=he, no prompt (command path)
  → [substring checks: memory-review phrases]
  → stream_response(): LLM stream → SentenceBuffer → TTS → AudioPlayer
  → loop
```

- **[C]** The loop is strictly sequential (`service/merlin_service.py:608-649`): it
  either *listens* (`record_utterance`) or *speaks* (`stream_response`), never both.
- **[C]** Barge-in is **disabled**: `BARGE_IN_ENABLED = False`
  (`merlin_service.py:103`), and when disabled `stream_response` opens **no** mic
  stream during playback (`:736-742`, `contextlib.nullcontext()`), explicitly to
  avoid full-duplex CoreAudio `-10863` on the Babyface and speaker→mic echo.
- **[C]** TTS is per-sentence: `SentenceBuffer` chunks the LLM stream; each sentence is
  synthesized then played (`:746-769`). Playback is blocking `sd.play()+sd.wait()`
  (`AudioPlayer._play_sync`, `:122-134`) or a streamed `OutputStream`
  (`play_stream`, `:173-205`).
- **[C]** Cross-thread signalling is `threading.Event` + `asyncio.Event`
  (`barged_flag`, `barged_in`, `player._interrupted`), checked at loop boundaries.

---

## 2. Verified capabilities [C]

- **Wake:** keyword + double-clap, forced `language=he`, prompt on the wake path
  (`wake_trigger.py`). Verified working in prior sessions.
- **STT:** Whisper, command path `language="he"`, **no prompt** (a prompt was echoed
  into the transcript, so it was removed — `app/providers/stt/whisper.py:19-45`).
- **LLM:** Claude streaming via `ClaudeAdapter.respond()` (`app/adapters/claude.py:144`).
- **TTS + playback:** OpenAI TTS (onyx) → `AudioPlayer`. Playback stop primitive
  exists: `AudioPlayer.interrupt()` sets an Event and calls `sd.stop()` (`:168-171`),
  and `play_stream` checks `_interrupted` before every write (`:185,195`).
- **Half-duplex reliability:** by not opening the mic during playback, Merlin finishes
  replies uninterrupted and avoids the device rate conflict (`:737-742`).
- **Barge-in *primitive* (disabled):** `_barge_callback` detects sustained mic energy
  (`BARGE_IN_RMS=0.010`, `BARGE_IN_FRAMES=8` ≈160 ms, `BARGE_IN_GRACE=0.5 s`) and, if
  armed, calls `player.interrupt()` + sets `barged_in` (`:701-716`). Arms only *after*
  first audio reaches the player (`_arm_barge`, `:692-699`).

---

## 3. Missing capabilities (measured against §7 external systems)

| # | Capability | Merlin now | Industry baseline [X] |
|---|---|---|---|
| 1 | **True barge-in** (user speech stops the bot) | **No** — disabled; even enabled it only stopped *playback* | Auto-stop playback + cancel response (OpenAI, LiveKit, Pipecat) |
| 2 | **Cancel in-flight LLM stream** on interrupt | **No** — consumer stops reading; the API stream is not cancelled | Server cancels response (OpenAI `response.cancelled`); frames discarded (Pipecat) |
| 3 | **Cancel in-flight TTS generation** | N/A — synth is per-sentence and blocking | TTS reset/clear on interrupt (Pipecat output transport) |
| 4 | **Cancel a running tool/long task** on interrupt | **No** — no tool-cancellation path exists | Frame/task cancellation (`PipelineTask`) |
| 5 | **Generation IDs / cancellation tokens / turn ownership** | **No** — only boolean Events at boundaries | `item_id`+`response.cancel` (OpenAI); `commit/clear_user_turn` (LiveKit) |
| 6 | **Atomic buffer/queue flush on interrupt** | **No** — playback stop only; no queue model | Server buffer auto-clear; `discard_audio_if_uninterruptible`; SystemFrame bypass |
| 7 | **History = only audio the user heard** | **No** — full response stored (see §7) | `conversation.item.truncate` (OpenAI); "portion the user heard" (LiveKit) |
| 8 | **Backchannel / false-interrupt filtering** | **No** (only an RMS+frame-count threshold) | `min_words`, adaptive mode, semantic VAD, `MinWordsInterruptionStrategy` |
| 9 | **Semantic endpointing** | **No** — silence/RMS only | `semantic_vad` (OpenAI), turn-detector model (LiveKit) |
| 10 | **Incremental intent** | **No** — final transcript substring match only | interim results + `speech_final`/`UtteranceEnd` (Deepgram) |
| 11 | **Acoustic echo cancellation (AEC)** | **No** — the *root cause* barge-in was disabled | WebRTC transports ship AEC (LiveKit/OpenAI WebRTC/Pipecat-WebRTC) |

---

## 4. Race-condition analysis

- **[C] Boundary-only cancellation.** `barged_in` is checked between sentences
  (`:747,751,757,760,768`). A barge that lands *inside* `tts.synthesize()` or the
  `run_in_executor(out.write,…)` is not observed until the next boundary → a full
  sentence can still play after the user started talking.
- **[I] Stale-response resumption.** With no generation IDs, if barge-in were enabled
  and re-armed, nothing prevents a late audio chunk or a resumed generator from
  continuing to write after interruption — the only guard is the shared `_interrupted`
  Event, which is per-`AudioPlayer`, not per-turn.
- **[I] History/actual-audio desync (the important one).** `ClaudeAdapter.respond()`
  appends the **full** assistant text at the *end* of the generator
  (`app/adapters/claude.py:329`). If `stream_response` breaks the `async for` on
  barge-in (`:748`), the generator is abandoned; `aclose()` throws `GeneratorExit` at
  the last `yield` (`:320`) so line 329 **never runs** → the assistant turn is
  **dropped entirely** from history (neither full nor heard-portion). Currently masked
  because barge-in is off (the loop always completes → full text stored, which matches
  what the user heard *only because nothing is ever cut*).
- **[C] Full-duplex device conflict.** Opening a second `InputStream` during playback
  produced CoreAudio `-10863` on the Babyface (`:737-739`) — a hardware/driver race
  that half-duplex sidesteps.
- **[I] Echo self-trigger.** With shared speaker+mic, Merlin's own output re-enters the
  mic and trips the RMS barge detector (`:98-102`) — a feedback race, not a logic race.

**Conclusion [I]:** Merlin's concurrency model (sequential loop + boundary-checked
Events, no per-turn ownership, no queue model, no cancellation tokens) cannot provide
race-safe interruption without substantial re-architecture.

---

## 5. Turn-state machine

**Current [C/I]** (implicit; not encoded as a state machine):
```
STANDBY ──wake──▶ LISTENING ──speech+silence(SILENCE_S)──▶ TRANSCRIBING
   ▲                                                            │
   │                                                     (empty? → LISTENING)
   └────────────────── SPEAKING ◀── RESPONDING(LLM→TTS) ◀───────┘
            (post-response silence CONVERSATION_TIMEOUT=8s → STANDBY)
```
No `INTERRUPTED` state exists; SPEAKING has no legal transition back to LISTENING
mid-utterance (barge-in disabled).

**[R] Target machine:** add `USER_SPEAKING_OVER_BOT` and `INTERRUPTED` states with
explicit entry actions (stop playback, cancel LLM, cancel TTS, truncate history) and a
single `turn_id` owning every artifact of the turn. This mirrors LiveKit's
`clear/commit_user_turn` lifecycle [X: docs.livekit.io/agents/build/turns/].

---

## 6. Cancellation propagation map

**Current [C]:** `_barge_callback` → `player.interrupt()` (`sd.stop()` + Event) and
`barged_in.set()`. That is the *entire* propagation. LLM stream: not cancelled (only
un-read). TTS: nothing to cancel (blocking per-sentence). Tools: none.

**[R] Target (one signal fans out to all owners of `turn_id`):**
```
user_speech_detected(turn_id)
      ├─▶ playback.stop()            (exists: AudioPlayer.interrupt)
      ├─▶ llm_stream.cancel()        (MISSING — close/abort the API stream)
      ├─▶ tts.cancel()              (MISSING — abort in-flight synth)
      ├─▶ tools.cancel(turn_id)      (MISSING)
      ├─▶ queues.flush(turn_id)      (MISSING — no queue model)
      └─▶ history.truncate(played_ms)(MISSING — store only heard audio)
```
OpenAI does this server-side (`response.cancel` / auto `response.cancelled`,
`conversation.item.truncate`) [X: developers.openai.com/api/docs/guides/realtime-conversations];
Pipecat via SystemFrame bypass + DataFrame discard
[X: docs.pipecat.ai/guides/learn/pipeline].

---

## 7. Audio and transcript ownership

- **[C] Audio in:** `record_utterance` owns the mic during LISTENING; `_CommandCapture`
  owns the speech-state buffer (`merlin_service.py:210+`). During SPEAKING the mic is
  **not** owned by anyone (not opened).
- **[C] Audio out:** `AudioPlayer` owns playback; `_interrupted` is player-scoped, not
  turn-scoped.
- **[C] Transcript/history:** `ClaudeAdapter._history[session_id]` (`claude.py:64`);
  user appended at `:146`, assistant (full) at `:329`. No notion of "played position."
- **[X] Contrast:** OpenAI/LiveKit truncate history to the audio actually heard
  (`conversation.item.truncate` removes unplayed audio *and* its transcript
  [developers.openai.com/api/docs/guides/realtime-conversations]; LiveKit keeps "only
  the portion of the speech that the user heard" [docs.livekit.io/agents/build/turns/]).
  Pipecat does **not** document this guarantee (unconfirmed; only GitHub issues) —
  flagged.

---

## 8. Language policy

- **[C]** Command STT forced `language="he"`, no prompt (`whisper.py:34-36`). Wake path
  forces `he` with a bilingual prompt "Merlin. מרלין. Hey Merlin." (`whisper.py:38-39`).
- **[I]** So the runtime is **Hebrew-locked on the command path**; English words are
  transcribed under the he model. There is no auto-switch logic — good (no drift), but
  also no explicit mixed he/en handling beyond what Whisper-he does natively.
- **[X] Industry guidance matches "lock the language":** OpenAI explicitly says do not
  infer language from accent, ignore backchannels/isolated foreign words for language
  detection, switch only on a substantive other-language utterance
  [developers.openai.com/api/docs/guides/realtime-models-prompting]. LiveKit applies
  per-language thresholds from the STT-reported language, no manual mid-call switch
  [docs.livekit.io/agents/build/turns/turn-detector/].
- **[R]** Keep he-locked; add an explicit policy: switch to en only on a *substantive*
  en utterance, never on isolated tokens — matching OpenAI's rule.

---

## 9. Intent and trigger architecture

- **[C]** Triggers are matched on the **final** transcript only: wake keyword
  (`wake_trigger.py`) and `_MEMORY_REVIEW_PHRASES` substring test
  (`merlin_service.py:780+, 630`). Everything else goes to the LLM as free text. No
  incremental/partial-intent path.
- **[C]** A separate, richer intent classifier exists in the **mos platform**
  (`voice-gateway/mos/intent_bridge.py`) but is **not wired** into the live service
  (only a shadow hook mirrors transcripts).
- **[X]** Deepgram enables incremental intent via `interim_results` + commit points
  (`speech_final`/`UtteranceEnd`) [developers.deepgram.com/docs/utterance-end].
- **[R]** For control words ("stop", "wait"), act on **interim** results; for
  substantive requests, act on the **final** transcript. Do not put control words
  through the LLM round-trip.

---

## 10. Latency measurement plan [R]

Instrument per-stage spans with a shared `turn_id`, emit to the mos event log (already
event-sourced) so replay works:
```
wake→listen gap · listen(record) · STT · LLM first-token · LLM done ·
TTS first-audio · TTS done · playback start · (barge→stop) · total
```
Report medians + p95 over ≥20 trials; a single variable changed per experiment
(existing tools: `voice-gateway/tools/log_metrics.py`, `wake_ab_report.py`). Baseline
already measured historically (e2e ≈5.5 s, TTS-first ≈2.8 s, LLM ≈1.6 s) — re-baseline
after any change. Target from [X] barge latency: user-speech→playback-stop < ~200 ms.

---

## 11. EXTEND vs MIGRATE decision matrix

| Criterion | EXTEND current loop | MIGRATE to a WebRTC agent framework |
|---|---|---|
| True barge-in + cancel LLM/TTS | Build bespoke (hard, race-prone) | **Built-in & verified** [X] |
| History truncation to heard audio | Build bespoke | **Built-in** (OpenAI/LiveKit) [X] |
| Backchannel / false-interrupt | Build bespoke (min-words, semantic) | **Built-in** (`min_words`, adaptive, semantic_vad) [X] |
| Semantic endpointing | Build/host a model | **Built-in** (semantic_vad / turn-detector) [X] |
| **AEC / echo (the ROOT blocker)** | Add WebRTC-APM/Speex yourself | **WebRTC transport ships AEC** [X] |
| Race-safe turn ownership | Re-architect (turn_id, queues, tokens) | Framework owns it [X] |
| Keep Merlin's brain (Claude+context+Philos+memory+wake+he) | Trivial (it's already here) | Plug LLM/STT/TTS/context as framework nodes |
| Effort / risk | **High** (rebuild a frame/event pipeline correctly) | Medium (integration + re-plug), lower correctness risk |
| Control / self-host | Full | LiveKit/Pipecat = self-host & full control; OpenAI Realtime = managed, least code |

**Provisional verdict: MIGRATE the *voice-runtime layer*, EXTEND the *brain*.**
Adopt a WebRTC-based agent framework for transport + turn-taking + interruption +
truncation (recommend **Pipecat** or **LiveKit Agents** for self-host/control;
**OpenAI Realtime** for the fastest managed path), and plug in Merlin's existing Claude
adapter, context/Philos, memory, wake, and Hebrew policy. Rationale is evidence, not
preference: the four hardest missing capabilities (true barge-in with cancellation,
history-truncation, backchannel filtering, semantic endpointing) are exactly what these
frameworks provide and are documented; **and** the concrete reason barge-in is disabled
today is **echo**, which a WebRTC transport solves via built-in AEC — no bespoke DSP.
Building this correctly in the current hand-rolled loop is high-risk concurrency work
that reinvents solved problems.

*Caveat:* migration must preserve the mos platform coupling and the Hebrew-locked STT;
a spike is required before committing (see §12).

---

## 12. Minimal implementation sequence [R]

1. **De-risk spike (no commitment):** stand up a Pipecat (or LiveKit Agents) pipeline
   with a WebRTC transport, wired to Claude + OpenAI TTS + Whisper(he), on a **headset
   or WebRTC AEC** — measure: does barge-in stop the bot < 200 ms, and does history
   truncate to heard audio? (Both are the acceptance bar.)
2. **Port the brain:** wrap `ClaudeAdapter`/context/Philos as the LLM node; keep
   `_history` semantics but drive truncation from the framework's played-position.
3. **Turn ownership:** adopt the framework's turn lifecycle; delete the bespoke
   `barged_flag`/`grace_until` machinery.
4. **Backchannel policy:** enable `min_words`/adaptive (or `semantic_vad`) so "כן/מm"
   don't interrupt.
5. **Language policy:** he-locked; en only on substantive en utterance.
6. **Control words on interim; requests on final.** Wire mos `intent_bridge` at the
   interim layer for control verbs.
7. **Latency harness** (§10) on the new pipeline; re-baseline.

If the spike fails the acceptance bar, fall back to EXTEND with the §6 target map +
a WebRTC-APM AEC module — but only then, and on measured grounds.

---

## 13. Acceptance tests

- **A1 Barge-in latency:** user speaks over the bot → playback stops < 200 ms
  (measured), LLM stream cancelled, no further audio for that turn.
- **A2 History correctness:** after an interruption, history contains **only** the text
  whose audio actually played (assert transcript == heard-portion, not full, not empty).
- **A3 Backchannel immunity:** "כן"/"mm-hmm"/"okay" (< min_words, brief) do **not**
  interrupt; a substantive sentence does.
- **A4 Noise immunity:** room noise / echo does not trigger a false interruption
  (AEC on; measured over N trials).
- **A5 No stale resumption:** after interrupt, no chunk/tool from the old turn_id ever
  writes again (assert by turn_id ownership).
- **A6 Endpointing:** end-of-turn fires on natural pause AND is not cut mid-thought on
  a short pause (semantic or tuned silence).
- **A7 Language:** he stays he; a full en sentence switches; isolated en tokens do not.
- **A8 Replay:** the whole turn is reconstructable from the event log (mos), byte-stable.

---

## Sources (all [X] claims)
- OpenAI Realtime: `developers.openai.com/api/docs/guides/realtime-vad`,
  `/guides/realtime-conversations`, `/guides/realtime-models-prompting`.
- LiveKit Agents: `docs.livekit.io/agents/build/turns/`, `/turns/turn-detector/`,
  `docs.livekit.io/reference/agents/turn-handling-options/`.
- Pipecat: `docs.pipecat.ai/guides/learn/pipeline`,
  `/server/utilities/turn-management/interruption-strategies`,
  `/server/pipeline/pipeline-task`, `/server/utilities/filters/stt-mute`.
- Deepgram: `developers.deepgram.com/docs/endpointing`, `/docs/utterance-end`,
  `/docs/understanding-end-of-speech-detection`, `/docs/speech-started`.

### Not verified (do not treat as fact)
- Pipecat **history-truncation-to-played-position**: not in official docs (only GitHub
  issues) — unconfirmed.
- Pipecat **generation-ID / turn-ownership token**: not documented as a guarantee.
- Pipecat `STTMuteFilter` exact enum names: page 404'd during fetch; verify live.
- OpenAI `semantic_vad` internal backchannel scoring: not published beyond `eagerness`.
- All Merlin **[I]** items are inferences from code, not runtime-measured; the barge-in
  behaviours are analysed with `BARGE_IN_ENABLED=False` (never exercised live recently).
</content>
