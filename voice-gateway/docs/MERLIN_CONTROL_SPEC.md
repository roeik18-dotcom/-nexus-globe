# Merlin Control Spec — Source of Truth

Documents behaviour **as implemented in code today**, read directly this session unless
marked otherwise. No proposals, no roadmap, no fixes. `UNKNOWN` = information not found
in the code read. `HYPOTHESIS` = a claim not verifiable by reading code alone (needs
runtime/hardware measurement). Two runtimes exist and are documented separately where
they diverge: **Path A** = `service/merlin_service.py` (installed as the `com.merlin.voice`
LaunchAgent — confirmed via `launch/install.sh:1-16` and a live `launchctl list` this
session). **Path B** = `app/main.py` + `client/push_to_talk.py` (manual, via `start.sh`,
no daemon wiring).

---

## 1. Runtime State Machine

- **Purpose**: N/A — none exists.
- **Inputs**: N/A.
- **Outputs**: N/A.
- **Owner**: N/A — no object represents "the current turn's state."
- **Runtime Component**: N/A.
- **Dependencies**: N/A.
- **Constraints**: N/A.
- **Observable Behaviour**: Turn progression is the emergent result of sequential
  `await` calls inside `run_conversation_session()` (`service/merlin_service.py:789-852`)
  and `_run_pipeline()`/`_handle_turn()` (`app/main.py:372-515`). Neither function
  constructs, threads, or logs any named state value (`IDLE`, `LISTENING`, etc.).
  File: `service/merlin_service.py`, function: `run_conversation_session`, evidence:
  full-body read this session, no state enum/object anywhere in it.
- **Acceptance Criteria**: N/A — nothing to test; there is nothing to verify pass/fail
  against because no state machine is asserted to exist.
- **Category**: PROVEN (absence) BY CODE.

---

## 2. Turn Controller

- **Purpose**: N/A — none exists as a named component.
- **Inputs / Outputs / Owner / Runtime Component / Dependencies / Constraints**: N/A.
- **Observable Behaviour**: "End of turn" is decided implicitly by whichever coroutine
  returns last in the loop body. Path A: `service/merlin_service.py:789-852`
  (`run_conversation_session`, `while True` — record → transcribe → `stream_response` →
  loop). Path B: `app/main.py:131-343` (`vovoice_ws`'s `while True: data = await
  ws.receive()`, with `_handle_turn`/`_handle_text_turn` awaited inline at `:329,342`).
  No `asyncio.create_task` wraps either turn body — confirmed by full reads of both
  functions this session — so a new turn cannot start before the previous one's
  `await` chain returns, in either path.
- **Acceptance Criteria**: N/A.
- **Category**: PROVEN (absence) BY CODE.

---

## 3. Language Policy

- **Purpose**: Determine what language Merlin transcribes and responds in.
- **Inputs**: Raw microphone audio (both paths).
- **Outputs**: `language="he"` kwarg sent to the OpenAI transcription API.
- **Owner**: No single owner; two independent hardcoded literals.
- **Runtime Component**: `WhisperSTT.transcribe()` — `app/providers/stt/whisper.py:122-160`,
  literal at `:134`. Wake path: `KeywordBuffer._inference_loop()` —
  `service/wake_trigger.py:444-576`, literal at `:507`.
- **Dependencies**: `app/config.py:30` (`stt_model`) supplies the model name only, not
  language; no `stt_language` setting exists in `Settings` (full class read, `:15-67`).
- **Constraints**: Both literals are independent — a change to one does not affect the
  other (confirmed: two separate files, two separate dict literals, no shared constant).
- **Observable Behaviour**: Every command-path transcription request is forced to
  `language="he"` (`whisper.py:134`); every wake-path transcription request is also
  forced to `language="he"` (`wake_trigger.py:507`) with an additional keyword-bias
  `prompt="Merlin. מרלין. Hey Merlin."` (`:502`). No language-detection code exists
  anywhere in `app/` or `service/` (full-file reads of `whisper.py`, `wake_trigger.py`,
  `base.py` this session and prior — `Transcription.language` field exists at
  `app/providers/stt/base.py:18` but is never read on the live path). Output-language
  guidance exists only as a prompt instruction: `prompts/merlin.md:55` — "In Hebrew or
  English, match the language the user uses in the turn." No code enforces this; the
  Anthropic API call (`app/adapters/claude.py:305-309`) has no language parameter at
  all — response language is decided entirely by model inference, not by this codebase.
- **Acceptance Criteria**: `tests/test_stt_command_language.py::test_command_stt_forces_hebrew_language`
  (`:51-53`) and `::test_wake_path_keeps_language_and_temperature` (`:120-125`) — both
  re-run this session, **PASS** — lock the current forced-`"he"` behaviour as correct.
  No test exists asserting English support or output-language enforcement.
- **Category**: PROVEN BY CODE (forcing) + PROVEN BY TEST (locked). "English not
  reliably supported" — HYPOTHESIS (never independently observed this session; only
  sourced from a code comment, `whisper.py:20-40`).

---

## 4. Conversation Policy

- **Purpose**: Governs turn-taking tone/brevity/directness expectations for Merlin's replies.
- **Inputs**: None — static text.
- **Outputs**: A block of instructions injected into every system prompt.
- **Owner**: `prompts/merlin.md` (file), loaded by `PersonaLayer`.
- **Runtime Component**: `app/context_builder.py:39-44` (`PersonaLayer.render()`).
- **Dependencies**: `_load_prompt_layer()` (`context_builder.py:15-17`).
- **Constraints**: Persona file explicitly out of scope for modification this session
  (per user instruction); documented as-is.
- **Observable Behaviour**: `prompts/merlin.md:7-17` (Persona bullets) — answer-first,
  short-by-default, ask one question when unclear, recommend rather than list options,
  no stock phrasing (English list + Hebrew list at `:15`), no auto-agree, track session
  context without announcing it. `:48-50` — On-failure protocol: what happened → why →
  one next action. `:52-57` (Tone) — no markdown in spoken output, no greeting every
  turn. These are **prompt instructions**, not code-enforced rules — no code validates
  Merlin's actual output against them.
- **Acceptance Criteria**: `tests/test_persona_merlin.py` — 13/13 passed this session
  (and reconfirmed twice) — asserts the prompt **text** contains these instructions.
  No test asserts the **model's actual output** complies with them (would require live
  API calls).
- **Category**: PROVEN BY CODE (text exists) + PROVEN BY TEST (text-presence tests
  pass). Actual behavioural compliance — HYPOTHESIS (never measured against real model
  output this session).

---

## 5. Persona Contract

- **Purpose**: Defines Merlin's identity, separate from Jarvis/Philos.
- **Inputs**: `persona: Literal["jarvis","philos","merlin"]` (`app/config.py:47`, value
  `"merlin"` per `.env:4`).
- **Outputs**: Concatenated system-prompt text.
- **Owner**: `app/context_builder.py::PersonaLayer` + `BaseIdentityLayer`.
- **Runtime Component**: `ContextBuilder.for_session()` (`:242-267`) — assembles
  `BaseIdentityLayer(persona)` (`:31-36`, loads `prompts/base.md`, shared across all
  three personas) then `PersonaLayer(persona)` (`:39-44`, loads `prompts/{persona}.md`).
- **Dependencies**: `prompts/base.md`, `prompts/merlin.md` (both plain files, read fresh
  every call, no cache — see §Contract note below).
- **Constraints**: `base.md` is shared with jarvis/philos — a base.md edit would affect
  all three; `merlin.md` is Merlin-exclusive.
- **Observable Behaviour**: `ContextBuilder.build()` (`:225-227`) joins every layer's
  `render()` output with `\n\n---\n\n`, skipping empty ones. **No caching anywhere in
  this chain** — confirmed this session via full reads of `context_builder.py` (no
  `@lru_cache`/`@cache`/`@cached_property`) and a repo-wide grep for those decorators
  plus `singleton`/`_cache`/`preload`/`lazy` (only unrelated hit: `app/trace_bus.py:48`,
  a comment on an unrelated global). `_load_prompt_layer()` (`:15-17`) calls
  `path.read_text()` fresh on every single `render()` call — proven by full read, not
  inference.
- **Acceptance Criteria**: `tests/test_persona_merlin.py::test_three_personas_are_distinct`,
  `::test_merlin_prompt_does_not_imitate_jarvis` — passed this session.
- **Category**: PROVEN BY CODE + PROVEN BY TEST.

---

## 6. Intent Router Contract

- **Purpose**: Map a transcript to a machine-actionable intent.
- **Inputs**: Transcript string.
- **Outputs**: `(intent: str, confidence: float)`.
- **Owner**: `mos/intent_bridge.py` (built, real) — **not consumed on the live response
  path**.
- **Runtime Component**: `classify()` (`mos/intent_bridge.py:50-65`), keyword table
  `_KEYWORDS` (`:22-29`: `stop`, `ask_time`, `ask_status`, `ask_weather`, `day_opener`,
  `open_app`). Full chain if fed: `mos/alpha.py:33-105` (`AlphaRuntime` — intent →
  `CognitionEngine.orient()` → `Planner` → `Executor` → `Responder`, all read in full a
  prior round this session, synchronous, working demo included in the file).
- **Dependencies**: Reached only via `_mos_shadow()` (`service/merlin_service.py:858-878`),
  gated by `os.getenv("MERLIN_MOS_BRIDGE") != "1": return` — off by default.
- **Constraints**: The module's own docstring (`intent_bridge.py:12`): "Not wired into
  the live launchd service yet."
- **Observable Behaviour**: The **only** live-path decision point is a flat literal set
  — `_MEMORY_REVIEW_PHRASES` (`merlin_service.py:780-786`: `"what do you remember"`,
  `"show me your memory"`, `"what do you know about me"`, `"מה אתה זוכר"`, `"מה אתה
  יודע עליי"`), checked via substring match at `:833`. This is the entire live "routing"
  — no registry, no confidence score, no class.
- **Acceptance Criteria**: `tests/test_intent_bridge.py` — passed this session (combined
  90-test run) — tests `classify()` in isolation, not its effect on the live turn (there
  is none).
- **Category**: PROVEN BY CODE + PROVEN BY TEST (for the disconnected module); PROVEN BY
  CODE (for its non-connection to the live path).

---

## 7. Tool Calling Contract

- **Purpose**: N/A on the live path — no live tool calling exists.
- **Inputs / Outputs**: N/A live. (Shadow path: `mos/executor.py` — `plan.created` event
  in, `tool.executed` event out, real approval-gate for irreversible actions at `_AUTO`
  set, `:14-15`.)
- **Owner**: N/A live.
- **Runtime Component**: `app/adapters/claude.py:305-309` — the Anthropic
  `messages.stream()` call — read in full this session and prior; parameters are
  `model, max_tokens, system, messages` only. **No `tools=` parameter exists anywhere in
  this call.**
- **Dependencies**: N/A live.
- **Constraints**: `mos/tools.py`'s registry (`_REGISTRY`, `:71-77` — `read_clock,
  read_weather, read_mission_control, run_morning_brief, launch_application`) is real
  and callable, but only reachable through the same disconnected `mos/` shadow chain as
  §6.
- **Observable Behaviour**: The model can never invoke a tool mid-response; nothing in
  its output stream is ever parsed for a `tool_use` block (`claude.py:311-320` consumes
  `stream.text_stream` only).
- **Acceptance Criteria**: `tests/test_tools.py` — passed this session — tests
  `mos/tools.py`'s registry in isolation. No test exercises live tool-calling because it
  does not exist.
- **Category**: PROVEN BY CODE (absence, live) + PROVEN BY TEST (shadow module works in
  isolation).

---

## 8. Memory Contract

- **Purpose**: Persist facts about the user across sessions; inject them into future prompts.
- **Inputs**: `(user_text, merlin_text)` per completed turn.
- **Outputs**: `Memory` objects (`app/memory/schema.py:13-34`) written to
  `memory/relationship/memories.json`.
- **Owner**: `MemoryStore` (`app/memory/store.py:23-143`) — one instance per service
  process, constructed once (`service/merlin_service.py:927`,
  `store = MemoryStore(_MEMORY_FILE)`).
- **Runtime Component**: `extract_memories()` (`app/memory/extractor.py:82-180`) — uses
  `claude-haiku-4-5-20251001` (`:24`) as a background extractor, called via
  `asyncio.create_task(_extract_background(...))` (`merlin_service.py:846-848` —
  **unreferenced task**, see §13). Injection back into prompts: `RelationshipMemoryLayer`
  (`app/context_builder.py:170-218`), reads `memory/relationship/memories.json` fresh
  on every `render()` call — no cache, confirmed by direct read (`:184`,
  `_RELATIONSHIP_MEMORY_FILE.read_text()` inside `render()` itself).
- **Dependencies**: `anthropic.AsyncAnthropic` (extractor's own client, separate from
  `ClaudeAdapter`'s), `MemoryStore._save()` (`store.py:51-55`, atomic write via
  `tmp` + `os.replace`).
- **Constraints**: `confidence < 0.6` items are dropped (`extractor.py:157-159`).
  `editable=False` memories are protected from overwrite/delete (`store.py:63-64,82-83`).
  Top 20 items by importance/recency injected per turn (`store.py:135-142`,
  `RelationshipMemoryLayer._MAX_ITEMS = 20`, `context_builder.py:178`).
- **Observable Behaviour**: Extraction happens **after** the user has already heard the
  response (`extractor.py:3-5` docstring; confirmed call site is post-`stream_response`
  at `merlin_service.py:845-848`), so it never adds latency but also is never guaranteed
  to complete before process exit (no shutdown hook awaits it — see §19).
- **Acceptance Criteria**: No test file specifically named for `app/memory/` was found
  in the `tests/` listing gathered this session — **UNKNOWN whether `test_store.py`
  (present in the directory) covers `app/memory/store.py` or a different, same-named
  `mos`-side store** — not disambiguated by full-body reading this session.
- **Category**: PROVEN BY CODE. Test coverage — UNKNOWN (not resolved this session).

---

## 9. Wake Contract

- **Purpose**: Detect "wake up" without transcribing continuous speech.
- **Inputs**: Raw mic audio, one shared `sd.InputStream`.
- **Outputs**: `threading.Event` set → `WakeTrigger.wait()` returns.
- **Owner**: `WakeTrigger` (`service/wake_trigger.py:635-849`), one instance per service
  (`merlin_service.py:928`).
- **Runtime Component**: Two independent detectors racing on one stream
  (`_wait_blocking`, `:693-849`): (a) `ClapDetector` (`:176-207`) — RMS `>
  CLAP_THRESHOLD=0.10` (`:36`) bursts ≤`CLAP_MAX_S=0.25s` (`:37`), two within
  `DOUBLE_CLAP_WINDOW_S=1.0s` (`:39`) fire the event (`:204-207`); (b) `KeywordBuffer`
  (`:210-441`) — VAD-gated (`VAD_THRESHOLD` from `service/vad_config.py`), buffers
  speech, sends to Whisper on silence (`SILENCE_END_S=0.6s`, `:47`) with
  `prompt="Merlin. מרלין. Hey Merlin."` + `language="he"` (`:502,507`), matches
  `{"merlin", "מרלין"}` (`:232`) case-insensitively in the returned text (`:524`).
- **Dependencies**: `validate_openai_api_key()` (`:124-161`) gates whether the keyword
  path starts at all — rejects missing/masked/non-ASCII/wrong-prefix keys; on failure,
  **keyword wake is disabled but double-clap remains active** (`:449-456`,
  `WakeTrigger.__init__:655-671`).
- **Constraints**: `MAX_BUFFER_S=4.0` (`:48`) hard-caps one continuous utterance;
  `_MAX_CONSECUTIVE_INFERENCE_ERRORS=3` (`:64`) triggers a backoff sleep
  (`_INFERENCE_BACKOFF_S=(30,60,300)`, `:71`), then resumes and **drops** whatever
  queued during the pause (`:561-569`) rather than replaying it.
- **Observable Behaviour**: `wait()` (`:679-691`) runs the blocking listen in a
  thread-pool executor; on return, `drain_pending()` (`:261-281`) hands back any audio
  buffered during Whisper's network round-trip as `prefill` for the command capture
  (consumed at `merlin_service.py:812-816`). The `InputStream` closes between
  activations (`:801` context-manager exit) — confirmed the sole wake-side stream in
  this file.
- **Acceptance Criteria**: `tests/test_voice_activation.py` — **currently 2/~20+
  failing this session** (`test_wake_phrase_matches[...]`, `test_activation_modes`,
  etc. — `AttributeError`), attributed (not proven causally) to concurrent, in-progress
  edits to `client/push_to_talk.py`/`service/vad_config.py` visible in `git status`
  this session, pre-dating this conversation's work.
- **Category**: PROVEN BY CODE. Current test-suite health for this contract —
  PROVEN BY TEST **that it is failing**; root cause attribution — HYPOTHESIS.

---

## 10. STT Contract

- **Purpose**: Convert command audio to text.
- **Inputs**: WAV bytes (16 kHz mono int16).
- **Outputs**: `str` (or `Transcription` via `transcribe_detailed`, unused live).
- **Owner**: `WhisperSTT` (`app/providers/stt/whisper.py:114-160`).
- **Runtime Component**: `transcribe()` (`:122-160`) — `self._client.audio.transcriptions.create(
  model=settings.stt_model, file=file_like, language="he", temperature=0,
  response_format="json" if _cap else "text")` (`:128-144`). **No `prompt` on the
  command path** (module docstring `:19-40` explains why — a prior attempt echoed the
  prompt back as the transcript).
- **Dependencies**: `app/audio/utils.py::validate_audio/audio_to_file_like` (called at
  `:123,125`, not independently re-verified this session — **UNKNOWN internals**).
- **Constraints**: `response_format` must never be `"verbose_json"` — `gpt-4o-transcribe`
  returns HTTP 400 for it (`:140-142`, corroborated independently by the same
  constraint documented in `wake_trigger.py:514-517`).
- **Observable Behaviour**: `_response_text()` (`:100-111`) handles both a bare `str`
  (production shape) and an object with `.text` (capture-mode shape) — read in full.
- **Acceptance Criteria**: `tests/test_stt_command_language.py` — 10/10 passed this
  session (exact list captured in the prior round's evidence).
- **Category**: PROVEN BY CODE + PROVEN BY TEST.

---

## 11. TTS Contract

- **Purpose**: Convert response text to audio.
- **Inputs**: `text: str`.
- **Outputs**: `bytes` (format varies by provider).
- **Owner**: Provider selected by `settings.tts_provider` (default `"openai"`,
  `app/config.py:31`) via `build_tts()` (`app/router.py:121-149`, read in full this
  session).
- **Runtime Component / behaviour per provider**:
  - `openai` → `OpenAITTS` (`app/providers/tts/openai_tts.py:12-31`) — fixed
    `voice=settings.openai_tts_voice` ("onyx", `:32`), `model=tts-1-hd`,
    `response_format="pcm"`, `speed=1.15`. No language parameter of any kind.
  - `elevenlabs` → `ElevenLabsTTS` (`elevenlabs_tts.py:25-61`, read in full this round)
    — fixed `voice_id` ("George", British, `:28,4`), `model="eleven_turbo_v2_5"`
    (multilingual per its own header comment `:10`, **but no code selects a language —
    the provider's multilingual capability is a property of the model, not something
    this codebase controls**). HTTP call via `httpx.AsyncClient(timeout=15.0)` (`:51`)
    — this is the **only** explicit timeout found anywhere in the TTS/STT/LLM client
    chain this entire session.
  - `system` → `SystemTTS` (`system_tts.py:16-43`, read in full this round) — macOS
    `say` command, no voice/language parameter passed at all (`:30-31`, argument list is
    `["say", "-o", out_path, text]`) — language is whatever macOS's default `say` voice
    produces.
  - `fish_audio` → `FishAudioTTS` (`fish_tts.py`) — **UNKNOWN internals**, file not read
    in full this session (218 lines, selection condition confirmed via `router.py:140-146`
    only).
  - `mock` → `MockTTS` (`mock.py:32-35`, read in full) — returns a fixed 100ms silent
    WAV, no text processing at all.
- **Dependencies**: `settings.openai_api_key`/`elevenlabs_api_key`/`fish_audio_api_key`
  per provider (validated at `router.py:122-124,137,141-143`).
- **Constraints**: No provider examined (openai/elevenlabs/system/mock) accepts or acts
  on a language parameter — TTS always speaks whatever text it receives.
- **Acceptance Criteria**: No TTS-provider-specific test file identified in this
  session's `tests/` review beyond `MockTTS`'s use inside `test_streaming_pipeline.py`.
- **Category**: PROVEN BY CODE for openai/elevenlabs/system/mock. `fish_audio` — UNKNOWN
  (not read).

---

## 12. Barge-in Contract

- **Purpose**: Let the user interrupt Merlin mid-speech.
- **Inputs**: Mic RMS energy during playback.
- **Outputs**: `player.interrupt()` call + `barged_in` event set.
- **Owner**: `AudioPlayer` (`service/merlin_service.py:116-206`) for the stop action;
  no owner for the decision to trigger it (see prior round's §J.3 finding, re-affirmed).
- **Runtime Component**: `stream_response()` (`:666-775`) — `_barge_callback`
  (`:701-718`, RMS-only, `BARGE_IN_RMS=0.010`, `:95`), gated by `BARGE_IN_FRAMES=8`
  consecutive blocks (`:96`) after `BARGE_IN_GRACE=0.5s` (`:97`).
- **Dependencies**: `BARGE_IN_ENABLED = False` (`:103`) — **the entire mechanism is
  inactive by default**; when disabled, `stream_response` uses
  `contextlib.nullcontext()` instead of opening the barge `InputStream` (`:736-742`).
- **Constraints**: Own code comment (`:98-103`) states the reason for disabling:
  acoustic echo feedback and a CoreAudio `-10863` device-rate conflict on the RME
  Babyface when opening a second concurrent `InputStream` during playback — **PROVEN
  that the comment exists and says this; the incident's reproducibility is
  HYPOTHESIS**, not independently verified this session.
- **Observable Behaviour**: When (hypothetically) enabled, `player.interrupt()`
  (`:168-171`) is called directly from the barge callback (`:715`) — real, immediate
  `sd.stop()`. The LLM generator (`adapter.respond()`) is never explicitly closed
  (`claude.py:305-329` read in full — no `.aclose()`/`athrow()` call anywhere) — the
  consumption loop merely `break`s (`merlin_service.py:747-748`).
- **Acceptance Criteria**: No test file for barge-in behaviour was found in `tests/`.
- **Category**: PROVEN BY CODE (mechanism + disabled state). Hardware root cause —
  HYPOTHESIS.

---

## 13. Error Recovery

- **Purpose**: Define what happens when a pipeline stage fails.
- **Inputs**: An exception raised at any stage.
- **Outputs**: Varies by path and stage (below).
- **Owner**: No unified error-recovery component; each path handles failures locally
  or not at all.
- **Runtime Component / Observable Behaviour**:
  - Path A, STT failure: no `try/except` around `stt.transcribe` (`merlin_service.py:824`)
    — propagates to `main()`'s outer `except Exception` (`:959-962`) — **whole service
    restarts** after a backoff (`retry_delay` doubling, capped at 60s, `:962`); user
    hears nothing.
  - Path A, LLM/TTS failure: same — no local `try/except` around `adapter.respond`/
    `tts.synthesize`/`play` inside `stream_response` (`:744-769` read in full) —
    same whole-service restart.
  - Path B, adapter/LLM failure: caught locally in `_run_pipeline`
    (`app/main.py:451-456`) — sends `{"type":"error"}` then `{"type":"done"}`; the
    websocket connection and session survive.
  - Path B, TTS failure: caught locally in `_tts_send` (`:413-417`) — logs, `return`s,
    turn continues **without that sentence's audio** — silent partial failure, no
    client notification for that specific gap.
  - Path B, STT failure: call site not re-verified in full this round — **UNKNOWN**
    (flagged, not asserted, consistent with prior round).
  - Websocket disconnect: `finally` (`app/main.py:360-369`) runs registry
    cleanup + `_adapter.reset()`/`unregister_session()` — confirmed by full read.
  - Background tasks (`claude.py:334`, `app/main.py:472`, `merlin_service.py:846`):
    **no cancellation on any failure path** — confirmed absence of any reference held
    to the returned `Task` object in all three call sites.
- **Dependencies**: No `timeout=` set on `AsyncAnthropic()` (`claude.py:60`) or the
  OpenAI clients (`whisper.py:116`, `openai_tts.py:14`) — SDK defaults apply; exact
  values UNKNOWN (not read from the installed package this session).
- **Constraints**: N/A beyond the above.
- **Acceptance Criteria**: No test file targets timeout/error-recovery behaviour for
  any stage, in either path (confirmed by filename + targeted body search this
  session's prior round).
- **Category**: PROVEN BY CODE for the described branches. SDK timeout defaults and
  Path B STT-failure behaviour — UNKNOWN.

---

## 14. Logging & Telemetry

- **Purpose**: Record what happened per turn.
- **Inputs**: Pipeline events.
- **Outputs**: Log lines (both paths); structured `TraceStep`/`TurnTrace` (Path B only).
- **Owner**: Path B — `app/trace.py` (`TurnTrace`, `:109-131`, `TraceStep`, `:81-90`)
  + `app/trace_bus.py` (subscriber bus). Path A — none; `logging.getLogger("merlin.service")`
  plain text only (`merlin_service.py:52`).
- **Runtime Component**: `StepType` literal (`app/trace.py:19-63`, **read to end of
  file, 132 lines total, this round** — categories: routing, recall, summary,
  delegation, planning, tool, voice.stt, voice.tts, llm, error.timeout, error.exception.
  **No `language.*`, `intent.*`, or interruption-specific step type exists anywhere in
  the file** — confirmed by full read, not partial.
- **Dependencies**: Real `emit()` call sites confirmed this session:
  `claude.py:236-243,263-267,313-317,322-327`; `app/main.py:400-403,476-481`.
- **Constraints**: Path A has **zero** use of `turn_context`/`trace_bus`/`TraceStep` —
  confirmed via `grep -n "turn_context\|trace_bus\|TraceStep\|TurnTrace"
  service/merlin_service.py` returning no matches, cross-checked against the full file
  already read for other sections.
- **Observable Behaviour**: A turn is partially reconstructible from logs in Path B
  (keyed by `turn_id`+`session_id`); **not reconstructible at all** in Path A beyond
  manual timestamp correlation across unstructured `logger.info` lines.
- **Acceptance Criteria**: No test asserts trace-log completeness/correlation for
  either path.
- **Category**: PROVEN BY CODE.

---

## 15. Trigger Catalog

| Trigger | Where defined | Live? | file:line |
|---|---|---|---|
| Wake keyword "merlin"/"מרלין" | `KeywordBuffer._keywords` | **YES** (Path A only) | `wake_trigger.py:232` |
| Double clap | `ClapDetector` | **YES** (Path A only) | `wake_trigger.py:176-207` |
| Memory review phrases (5 literals, he+en) | `_MEMORY_REVIEW_PHRASES` | **YES** (Path A only) | `merlin_service.py:780-786`, checked `:833` |
| `stop` (שקט/עצור/די/stop/quiet/enough) | `mos/intent_bridge.py::_KEYWORDS` | **NO** (shadow-only) | `:23` |
| `ask_time` | same | **NO** | `:24` |
| `ask_status` | same | **NO** | `:25` |
| `ask_weather` | same | **NO** | `:26` |
| `day_opener` (בוקר טוב/morning/brief) | same | **NO** | `:27` |
| `open_app` (+ `_APPS` targets) | same | **NO** | `:28`, `:33-39` |

- **Category**: PROVEN BY CODE for every row (each literal read directly, this session
  and prior).

---

## 16. Capability Matrix

| Capability | Status | file:line | Category |
|---|---|---|---|
| Mic capture (wake) | IMPLEMENTED | `wake_trigger.py:795-801` | PROVEN BY CODE |
| Mic capture (command) | IMPLEMENTED | `merlin_service.py:525-530` | PROVEN BY CODE |
| Input during TTS | MISSING (default) | `merlin_service.py:103,737` | PROVEN BY CODE |
| TTS playback | IMPLEMENTED | `merlin_service.py:132-134` | PROVEN BY CODE |
| Stop playback (manual trigger only) | IMPLEMENTED, uncalled live | `merlin_service.py:168-171` | PROVEN BY CODE |
| LLM stream cancellation | MISSING | `claude.py:305-329` | PROVEN BY CODE |
| Tool execution (live) | MISSING | `claude.py:305-309` | PROVEN BY CODE |
| STT language selection | FORCED-HE | `whisper.py:134` | PROVEN BY CODE + TEST |
| Language detection | MISSING | full-file reads, no detector | PROVEN BY CODE |
| Intent routing (live) | ONE literal set only | `merlin_service.py:833` | PROVEN BY CODE |
| Web search | NOT_IMPLEMENTED | repo-wide search, 0 hits | PROVEN BY CODE |
| Turn/generation identity (Path A) | MISSING | absence in `merlin_service.py:929` | PROVEN BY CODE |
| Turn identity (Path B, observability-only) | PARTIAL | `app/trace.py:112` | PROVEN BY CODE |
| Structured telemetry (Path A) | MISSING | grep, 0 matches | PROVEN BY CODE |
| Memory persistence | IMPLEMENTED | `app/memory/store.py:23-143` | PROVEN BY CODE |
| Background memory extraction | IMPLEMENTED, uncancellable | `merlin_service.py:846` | PROVEN BY CODE |

---

## 17. Configuration Matrix

Source: `app/config.py:15-67` (`Settings`, `BaseSettings`, `.env`-backed), read in full.

| Key | Default | Purpose | file:line |
|---|---|---|---|
| `anthropic_api_key` | `None` | Claude auth | `:22` |
| `openai_api_key` | `None` | Whisper + OpenAI TTS auth | `:23` |
| `stt_provider` | `"whisper"` | STT provider selector | `:25` |
| `stt_model` | `"gpt-4o-transcribe"` | shared wake+command STT model | `:30` |
| `tts_provider` | `"openai"` | TTS provider selector | `:31` |
| `openai_tts_voice` | `"onyx"` | fixed voice | `:32` |
| `openai_tts_model` | `"tts-1-hd"` | — | `:33` |
| `openai_tts_speed` | `1.15` | — | `:34` |
| `adapter` | `"claude"` | **note**: `.env:3` overrides to `"merlin"` in the running config | `:35` |
| `elevenlabs_api_key` | `""` | — | `:38` |
| `elevenlabs_voice_id` | `"JBFqnCBsd6RMkjVDRZzb"` (George) | — | `:39` |
| `elevenlabs_model` | `"eleven_turbo_v2_5"` | — | `:40` |
| `fish_audio_api_key` | `""` | — | `:43` |
| `fish_audio_voice_id` | `""` | — | `:44` |
| `claude_model` | `"claude-opus-4-8"` | — | `:46` |
| `persona` | `"jarvis"` (default) / **`"merlin"` per `.env:4`** | active persona | `:47` |
| `max_session_duration_seconds` | `300` | Path B session TTL (`SessionRegistry`) | `:53` |
| `max_audio_size_bytes` | `26_214_400` (25MB) | — | `:54` |
| `host` / `port` | `"127.0.0.1"` / `8765` | Path B uvicorn bind | `:56-57` |
| `internal_essence_token` | `None` | Essence integration auth | `:63` |
| `essence_base_url` | `"http://localhost:3000"` | — | `:64` |

No `stt_language` key exists (confirmed — §3).

- **Category**: PROVEN BY CODE.

---

## 18. Startup Sequence

- **Path A** (`service/merlin_service.py::main()`, `:910-940`, read in full): (1) probe
  git SHA via subprocess (`:911-919`); (2) log identity (`:920`); (3)
  `adapter = build_orchestrator()` (`:923`); (4) `stt = build_stt()` (`:924`); (5)
  `tts = build_tts()` (`:925`); (6) `player = AudioPlayer()` (`:926`); (7)
  `store = MemoryStore(_MEMORY_FILE)` (`:927`); (8)
  `trigger = WakeTrigger(openai_api_key=settings.openai_api_key)` (`:928`); (9)
  `session_id = "merlin-bg"` constant (`:929`); (10) log ready state (`:931-940`); (11)
  enter `while True: pending = await trigger.wait(); ...` (`:944-962`).
- **Path B** (`app/main.py::lifespan()`, `:87-101`, read in full): (1)
  `_stt = build_stt()`; (2) `_tts = build_tts()`; (3) `_adapter = build_orchestrator()`;
  (4) `trace_bus.subscribe(json_log_subscriber)` (`:93`); (5) log ready state
  (`:94-100`); (6) `yield` — FastAPI/uvicorn then begins accepting connections.
- **Category**: PROVEN BY CODE.

---

## 19. Shutdown Sequence

- **Path A**: `main()`'s loop catches `KeyboardInterrupt` only (`:956-958`,
  `logger.info("Interrupted — shutting down"); break`). **No `signal.signal`/
  `loop.add_signal_handler` registration exists anywhere in the file** — confirmed by
  `grep -n "signal\."` returning no matches. A LaunchAgent-issued `SIGTERM` is therefore
  **not caught by application code** — default OS/Python termination applies. This means
  no explicit flush of pending background tasks (§8, §13) or in-flight audio occurs on
  a normal service stop.
- **Path B**: `lifespan()` has **no code after `yield`** (`app/main.py:87-101`, full
  function read this round) — confirmed empty by direct reading, not inference. Per-
  connection cleanup still happens via `voice_ws`'s own `finally` block (`:360-369`),
  but there is no *application-level* shutdown hook.
- **Category**: PROVEN BY CODE (absence, both paths).

---

## 20. Acceptance Tests

Test run results **from this session**, mapped to the sections above:

| Section | Test file(s) | Result this session |
|---|---|---|
| §3 Language Policy | `tests/test_stt_command_language.py` | 10 passed |
| §4/§5 Conversation/Persona | `tests/test_persona_merlin.py` | 13 passed |
| §6 Intent Router (module only) | `tests/test_intent_bridge.py` | passed (in 90-combined run) |
| §7 Tool Calling (module only) | `tests/test_tools.py`, `test_tool_memory.py` | passed (in 90-combined run) |
| Routing (persona-select, not live) | `tests/test_agent_router.py`, `test_router.py` | passed (in 90-combined run) |
| §9 Wake | `tests/test_voice_activation.py`, `test_false_start_guard.py`, `test_command_buffering.py`, `test_vad_thresholds.py` | **42 failed / 9 passed** — attributed (HYPOTHESIS) to concurrent uncommitted edits present in `git status` this session |
| §12 Barge-in | none found | — |
| §13 Cancellation | `tests/test_streaming_pipeline.py` (read in full a prior round) | passes, but cancels an internal timeout-timer task, **not** the LLM generator — does not cover §12/§13's cancellation gap |
| §8 Memory | `tests/store.py`? | UNKNOWN — not disambiguated this session |

- **Category**: PROVEN BY TEST for every row with a captured pass/fail count.

---

## Contract note (applies across §§4,5,8)

No file in the chain `_load_prompt_layer → PersonaLayer → ContextBuilder → 
build_system_prompt_with_task → ClaudeAdapter.respond` carries any caching decorator or
module-level cache — established by full reads of `app/context_builder.py` (267 lines,
whole file) and `app/config.py` (67 lines, whole file), plus a repo-wide grep for
`lru_cache|@cache|cached_property|singleton|_cache|CACHE|preload|lazy` returning one
unrelated hit. A file edit is therefore read fresh on the very next turn any running
process handles — no restart required. Whether the currently-running process (if any)
has actually handled a turn since a given edit is a separate, unproven claim (§13/§19 —
no shutdown/restart telemetry exists to check against).
