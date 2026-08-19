# Agent-OS P0 — Substrate Comparison (evidence-based, no canonical decision)

**Status: comparison memo only.** Per explicit instruction, this document does **not**
declare any substrate canonical. `agent_os/` (P0) imports none of the three substrates
below (proven by `agent_os/tests/test_no_service_import.py`, run in a clean subprocess).
Substrate selection is a separate, future, explicitly-approved decision.

Three substrates exist in the repository today:

| | `kernel/` | `voice-gateway/mos/` | `voice-gateway/app/agents` + `app/delegation` |
|---|---|---|---|
| Location | top-level, own package | voice-gateway, own package | voice-gateway/app, inside the live FastAPI package |
| Git status | committed (2 commits) | committed | committed |
| Size | ~422 lines (11 files) | ~15 files, incl. `personal_config.py` (54KB), `collectors.py` (17KB) | ~110 lines across `agents/` + `delegation/` |

## 1. Runtime completeness
- **kernel/**: `Event → Bus → EventStore → Reducer → State` (+ Living World Graph
  projection) + `Health`. No planner, no executor, no agent concept. `ENFORCED_WHEN_BUILT`
  in `kernel/invariants.py` explicitly lists Planner/Executor as not-yet-built.
- **mos/**: a full, wired `Perception→Intent→Cognition→Action` loop (`mos/runtime.py:Runtime`),
  with irreversible-action gating pending approval (`INV-6`), a real (v0.2) linear
  `Planner` (`mos/planner.py`), an `ActionStub` executor, and a pluggable orientation
  algorithm seam (`philos_seam.py`). The most functionally complete decision loop of
  the three.
- **app/agents + app/delegation**: a working multi-agent `VoiceAdapter` orchestrator —
  `AgentRegistry` + LLM-based `AgentRouter` (single-hop text→agent-name classification)
  + `AgentOrchestrator` that resolves and streams from the chosen adapter, plus a
  synchronous `DelegationBus` for in-turn sub-agent calls. Routes between existing
  `ClaudeAdapter`-family personas; not a general event-sourced runtime.

## 2. Event model
- **kernel/** (`kernel/event.py`): `Event(type, subject, payload, actor, seq)`, frozen
  dataclass, monotonic `seq`, in-memory only.
- **mos/** (`mos/events.py`): richer `Event(id, seq, type, timestamp ISO-8601, actor,
  subject, payload, correlation_id, causation_id, version)` — same ADR-003 lineage as
  kernel's, independently implemented, with causation/correlation chains kernel's lacks.
- **app/agents**: no event model. `app/delegation/bus.py` is a direct
  request→adapter→result call, not an event log.

**Duplicate functionality note**: `kernel/event.py` and `mos/events.py` are two
independent implementations of the same ADR-003 event shape. This duplication
pre-dates and is unrelated to the P0 work in this turn — flagged as existing
architectural debt, not something P0 introduced or should resolve implicitly.

## 3. Persistence
- **kernel/**: none — `EventStore` is an in-memory Python list, lost on process exit.
- **mos/**: real durable persistence — `JsonlEventStore` appends newline-delimited JSON
  to `~/Library/Logs/Merlin/mos_events.jsonl` (per its own docstring, "read by Mission
  Control's Trace panel"), with `replay()`/`load_from()` proven by its own `_demo()`
  (publish → simulate restart → rehydrate → refold, same conclusions).
- **app/agents**: none. Conversation state lives elsewhere in `app/session.py`, outside
  this stack entirely.

## 4. Reducer / state model
- **kernel/**: single canonical `build_state(events) -> State` reducer, plus
  `kernel/invariants.py::verify()` that mechanically checks `state == fold(events)` —
  the most formally rigorous of the three, but exercised only by its own tests/demo,
  nothing consumes it yet.
- **mos/**: `EventBus.fold(reduce_fn, seed)` exists as a primitive, but state is
  derived ad hoc per consumer (`ActionStub` keeps its own `executed`/`gated`/`pending`
  dicts) rather than one canonical `State` object — less unified than kernel's, but
  actually exercised in a live decision loop today.
- **app/agents**: no reducer/state model.

## 5. Registry compatibility (vs. `agent_os.AgentRegistry`)
- **kernel/registry.py**: an event-type → handler-list registry (`register(event_type,
  handler)`) — a different concept from an agent registry; no overlap.
- **mos/**: no agent registry (single `CognitionEngine`, not multi-agent).
- **app/agents/registry.py**: structurally the closest sibling — `dict[str,
  AgentDefinition]` + insertion-order list, same shape as `agent_os.AgentRegistry`.
  Its `AgentDefinition` (`name, persona, description, capabilities: list[str]`) has
  **no validation, no closed vocabulary, no default-deny, no domain/authority
  model** — `capabilities` is a free-text hint "shown to the router", never enforced.
  `agent_os.AgentManifest`/`AgentRegistry` is a strict superset in rigor and could
  supersede this one if the orchestrator path is ever revived.

## 6. Permission / capability enforcement
- **kernel/ + top-level `capabilities/`**: real but coarse — `capabilities/permissions.py`
  is a single **global** intent→`{allowed, needs_approval, denied}` table (hardcoded
  set membership), not per-agent, not domain-scoped, no schema.
- **mos/**: `INV-6` gating — irreversible/outward decisions are gated pending an
  `approval.granted` event (`mos/runtime.py:ActionStub`), real and tested, but again
  driven by one **global** `_REVERSIBLE` set, not per-agent/per-domain.
- **app/agents**: `capabilities: list[str]` on `AgentDefinition` is decorative only —
  never validated, never enforced.
- **agent_os (P0, new)**: the only one of the four with a **closed-vocabulary,
  per-agent, default-deny, domain-aware** model — `Authority` tiers, `Capability`
  enum, `PROTECTED_DOMAINS` (SYSTEM), `MemoryScope`, tool allow/deny — all validated
  at construction (`AgentManifest.validate()`), fail-closed on any unknown value.
  This is **net-new** capability; none of the three substrates has this shape today.

## 7. Planner / conductor suitability
- **kernel/**: none built; explicitly deferred (`ENFORCED_WHEN_BUILT`).
- **mos/**: closest to a real conductor today — `CognitionEngine.orient()` → gate →
  `Planner._expand()` → `ActionStub` is a real (if simple) decide→plan→gate→execute
  chain, already wired end-to-end and demoed.
- **app/agents**: `AgentRouter` is a single-hop LLM classifier (route text → one agent
  name), not a multi-step planner.
- **None of the three is a ready-made Conductor for *manifest-driven* multi-agent
  orchestration** — whichever substrate is eventually chosen, a new Conductor layer
  consuming `agent_os.AgentManifest`/`AgentRegistry` still needs to be built (P1, not
  started).

## 8. Observability
- **kernel/**: `Health.observe()` — small self-report dict (event_count, last_event,
  node/edge counts, errors).
- **mos/**: `correlation_id`/`causation_id` chains on every event + `mos/trace.py` —
  richer, request-scoped traceability, and it's the substrate already wired into a
  human-facing "Mission Control Trace panel" per its own docstring.
- **app/agents**: `turn_context.emit(TraceStep(...))` for `routing.start`/
  `routing.complete` — already integrated with `app/trace.py`, the live FastAPI
  gateway's own tracing system (most "already visible in current production tracing"
  of the three, when that path is active).

## 9. Test coverage (measured this session, all green)
| substrate | test files | tests run this session | result |
|---|---|---|---|
| `kernel/` | 2 (`test_kernel.py`, `test_invariants.py`) | not executed this pass (read/inspected only) | — |
| `mos/` (subset) | 14 files under `voice-gateway/tests/` | 6 files sampled (`test_runtime`, `test_cognition`, `test_store`, `test_intent_bridge`, `test_orientation`, `test_trace`) | 23 passed |
| `app/agents` + `delegation` | 4 files | all 4 | 73 passed |
| `agent_os` (P0, new) | 5 files | all 5 | 30 passed |

`agent_os` is the only suite with explicit fail-closed security tests
(`test_default_deny.py`, `test_no_service_import.py`) — a test *category* none of the
three existing substrates has, because none of them has a permission model to test.

## 10. Coupling to Merlin (the live voice runtime, PID 82246 as of this audit)
- **kernel/**: **zero** — not imported anywhere in `voice-gateway/`; only consumed by
  the top-level `capabilities/` package. Fully decoupled from the live voice process.
- **mos/**: **real but gated** — `service/merlin_service.py` calls
  `_mos_shadow(transcript)` on every turn (`merlin_service.py:1585`), wrapped in a
  try/except that "never raises", active only when `MERLIN_MOS_BRIDGE=1` — **confirmed
  unset in the live `.env`**, i.e. currently inert on the live path, but the import
  and call site already exist inside the live turn loop.
- **app/agents**: **compiled in, inactive** — lives in the same `app/` package as the
  live `MerlinAdapter`, but `app/router.py::build_orchestrator()` only reaches
  `AgentOrchestrator` when `settings.adapter == "claude"`; the live `.env` has
  `ADAPTER=merlin`, which returns `MerlinAdapter` directly, bypassing this stack
  entirely today.
- **agent_os (P0)**: **zero**, proven mechanically in a clean subprocess
  (`test_no_service_import.py`), not just by inspection.

## 11. Migration cost (making `agent_os` the live control plane, illustrative only)
- **onto kernel/**: low event-model cost (already clean/minimal) but needs three new
  layers built from a small base: an agent-keyed registry (kernel's is event-type-keyed),
  a per-agent/domain permission layer (`capabilities/` is global-policy today), and
  durable persistence (kernel's store is in-memory only — mos's JSONL pattern would
  need porting in).
- **onto mos/**: medium — already has durable persistence, `INV-6` gating, and a live
  (if gated) voice bridge; needs a new multi-agent registry/routing layer (mos is
  single-`CognitionEngine`-shaped, not multi-agent) and reconciliation with the large
  existing `personal_config.py` (54KB) domain logic to avoid duplicating
  manifest-declared `knowledge_sources`.
- **onto app/agents**: medium-low for the multi-agent *shape* (registry/router/
  orchestrator pattern already structurally close to `agent_os`) but needs real
  validation/enforcement retrofitted into `AgentDefinition` (today decorative), and
  reactivating this path in production is itself a live-runtime change (flipping
  `ADAPTER`) requiring the same acceptance rigor as any other Merlin change.
- Regardless of substrate: wiring `agent_os` manifests into **any** of the three
  requires a new Gateway/Conductor layer that does not exist in P0 by design
  (explicitly P1, not started) — this cost is substrate-independent.

## 12. Duplicate functionality
- `app/agents/registry.py` and `agent_os/registry.py` are structurally near-duplicate
  (dict + insertion-order list) — the entire difference is what surrounds them
  (validation, default-deny, domain/authority/capability enforcement), which
  `app/agents` lacks entirely. Not wasted effort: `agent_os`'s registry is a stricter,
  closed-vocabulary superset built for a different (offline, security-first) purpose.
- `kernel/event.py` vs `mos/events.py`: genuine pre-existing duplication of the same
  ADR-003 event shape (see §2) — independent of and predating this P0 work.
- `agent_os` itself duplicates no runtime logic: it has no event model, no bus, no
  store — it is purely identity + authority + capability declaration, a layer none
  of the three substrates currently has.

## 13. Production risks
- **kernel/**: lowest risk to build on (zero live coupling) but least mature — reaching
  parity means building persistence + agent registry + permissions from the smallest
  base, likely the longest path.
- **mos/**: touching it touches code already on Merlin's live transcript path (even if
  currently gated off) — a bug introduced while extending `mos/` risks the same class
  of incident this whole engagement has been guarding against, especially if the
  `_mos_shadow` try/except guard itself ever needs to change.
- **app/agents**: ships in the same `app/` package as the live `MerlinAdapter` but is
  not on Merlin's call path today — safer to modify freely than `mos/`, but
  reactivating it for real use (`ADAPTER=claude`) is itself a live-behavior change
  needing the same acceptance rigor as any other Merlin change.
- **agent_os (P0)**: zero production risk by construction, proven by the
  import-isolation test — this is *why* P0 was scoped as a fully standalone package.

## Explicit non-conclusion

This memo does **not** recommend a canonical runtime. The evidence above shows three
substrates with genuinely different maturity profiles along different axes (mos/ is
most functionally complete and most production-relevant but carries the highest
coupling risk; kernel/ is the cleanest formal base but agent-less; app/agents is
structurally closest to `agent_os`'s registry shape but has the weakest enforcement
and is inactive on the live path). Selecting one — or building the Conductor to
straddle more than one — is a separate decision requiring its own explicit approval,
per instruction.
