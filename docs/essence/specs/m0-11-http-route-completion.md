# M0-11 — HTTP Route Completion

**Status:** Draft spec — pending owner review.  
**Scope:** Wire M0-10A write path into production HTTP; profile bootstrap API; HTTP-layer integration tests.  
**Invariants inherited from:** M0-8C (write-before-inference), M0-10A (per-exchange Philos trigger, Q2), M0-10B (audit integrity).  
**Depends on:** M0-10A locked (Philos review loop), M0-10B locked (B5 acceptance test passed).

---

## 1. Purpose

M0-10A delivered a complete, auditable write path for orientation interpretations — but only in unit tests. The production HTTP route (`observe/route.ts`) constructs `OrientationInferenceOrchestrator` with `philos: null` (the constructor default), so `PhilosReviewConsumer.consume()` is never called in a live request. Proposals accumulate in `pending_review` and never reach a terminal state.

M0-11 has one primary goal: **make M0-10A visible in the production HTTP path**. Everything else in scope is a prerequisite for that goal or a gap that would otherwise block verifying it.

---

## 2. Current State (as-built after M0-10B)

### 2.1 observe route — construction path

```typescript
// observe/route.ts (current, line ~160)
const orchestrator = getOrCreate(sessionId, () =>
  new OrientationInferenceOrchestrator(
    new CompositeOrientationProvider(providers),
    new EssenceProposalService(getRepository(), new PipelineRunner()),
    OBSERVE_ACTOR,
    // philos: null ← default; PhilosReviewConsumer never wired
  ),
);
```

`OrientationInferenceOrchestrator.runPhilosReview()` short-circuits immediately when `this.philos === null`. The orientation write path exists in code but produces no interpretations in any live HTTP call.

### 2.2 Profile bootstrap

Both routes share a 404 contract when the profile does not exist:

```
observe/route.ts  — profileExists() check before inference
summary/route.ts  — getEssenceSummary() throws "Profile not found"
```

`InMemoryEssenceRepository.createProfile()` is a direct method — no HTTP surface. There is no way to create a profile via HTTP. A caller that has never previously created a profile via direct repository access cannot use either route.

### 2.3 HTTP test coverage

`observe/__tests__/route.test.ts` covers:
- Token auth (403 paths)
- Actor header validation (400 paths)
- Body validation (400 paths)
- 200 response contract (observation appended, report returned)
- 500 on inference failure

It does NOT cover:
- Philos invocation (not wired, so untestable at HTTP layer)
- Interpretation written to profile after a valid orientation signal
- Profile creation via HTTP before observe is called

---

## 3. Gap Inventory

| ID  | Description | Severity |
|-----|-------------|----------|
| G1  | `PhilosReviewConsumer` not wired into `observe/route.ts` — no Interpretation ever written from a live HTTP request | P0 |
| G2  | No HTTP endpoint to create a profile — routes always 404 for new profiles | P0 |
| G3  | No HTTP integration test for the full write path (observe → signal → proposal → Philos → Interpretation) | P1 |
| G4  | `EssenceProposalService` constructed per-call outside `getOrCreate` factory in the wired version — wastes allocations | P2 |
| G5  | Session registry has no TTL eviction (noted in `orientation-session-registry.ts` TODO) | P2 (deferred M0-10C) |

P0 = blocks end-to-end HTTP write path. P1 = blocks HTTP-layer acceptance. P2 = quality/lifecycle concern.

---

## 4. M0-11A — Philos Wiring in observe/route.ts

### 4.1 Construction order (locked)

```
EssenceProposalService(repo, runner)
  → PhilosReviewConsumer(svc)
    → OrientationInferenceOrchestrator(provider, svc, actor, clock, philos)
```

The three objects must be co-constructed inside the `getOrCreate` factory so they share the same `proposalRecords` Map and the factory is called exactly once per session.

**Target construction in `observe/route.ts`:**

```typescript
const orchestrator = getOrCreate(sessionId, () => {
  const svc = new EssenceProposalService(getRepository(), new PipelineRunner());
  const philos = new PhilosReviewConsumer(svc);
  return new OrientationInferenceOrchestrator(
    new CompositeOrientationProvider(providers),
    svc,
    OBSERVE_ACTOR,
    systemClock,
    philos,
  );
});
```

### 4.2 Failure invariant (inherited from M0-10A Q2)

Philos failure after `pending_review` is persisted MUST NOT convert a 200 response to 500. The `OrientationInferenceOrchestrator.runPhilosReview()` already catches all errors and emits `console.warn`. The route's `try/catch` around `processExchange()` does not need to change.

### 4.3 What changes

| File | Change |
|------|--------|
| `app/api/internal/essence/profiles/[profileId]/observe/route.ts` | Wrap `svc` + `philos` construction inside `getOrCreate` factory; import `PhilosReviewConsumer` and `systemClock` |

### 4.4 What does NOT change

- The HTTP contract (200/400/403/404/500) — unchanged
- The `OrientationInferenceOrchestrator` constructor signature — already supports `philos` parameter
- The `PhilosReviewConsumer` class — already implemented in M0-10A
- The security model — no new headers, no new token surface

---

## 5. M0-11B — Profile Bootstrap Endpoint

### 5.1 Route

```
POST /api/internal/essence/profiles
```

Authorization: same `INTERNAL_ESSENCE_TOKEN` bearer token.  
Actor header: same `X-Essence-Actor` requirement.

### 5.2 Request body

```typescript
{ profileId: string }
```

`profileId` must be a non-empty string. Additional constraints (max length, character set) are not gated for M0.

### 5.3 Response contract

| Condition | Status | Body |
|-----------|--------|------|
| Invalid token | 403 | `{ error: 'Forbidden' }` |
| Missing/invalid actor header | 400 | `{ error: 'Bad Request', detail: '...' }` |
| Missing or non-string `profileId` | 400 | `{ error: 'Bad Request', detail: '...' }` |
| Profile already exists | 200 | `{ profileId, created: false }` |
| Profile created | 201 | `{ profileId, created: true }` |

**Idempotency:** creating a profile that already exists is not an error. The caller does not need to know whether the profile was pre-existing. This matches the `getOrCreate` pattern used across the session registry.

### 5.4 Actor authorization

Any valid actor may create a profile. Restricting creation to specific agents is a policy question deferred to M0 post-launch review.

### 5.5 What does NOT change

- `InMemoryEssenceRepository.createProfile()` — already implemented, not modified
- The existing `observe` and `summary` routes — no change to their 404 behavior

---

## 6. M0-11C — HTTP Integration Tests

### 6.1 Full write path test (P1)

Test: `observe route — orientation signal produces Interpretation in profile`

Steps:
1. Create profile via `POST /api/internal/essence/profiles` (or via `repo.createProfile()` as setup)
2. Send enough `POST /observe` calls with a deterministic orientation signal (rule-based provider, no LLM needed) to exceed `MINIMUM_CONTRIBUTING_OBSERVATIONS`
3. Assert: `repo.getProfile(profileId)` contains a non-archived `Interpretation` for the triggered dimension
4. Assert: `profile.evolution` has at least one entry with non-null `newInterpretationId`

**This test must NOT require `ANTHROPIC_API_KEY`** — the rule-based provider alone must be sufficient to reach a proposal.

### 6.2 Profile creation tests

Tests for `POST /api/internal/essence/profiles`:
- 403 when token missing or invalid
- 400 when `X-Essence-Actor` missing or unknown
- 400 when `profileId` missing or empty
- 201 on first creation; body contains `{ profileId, created: true }`
- 200 on repeat creation; body contains `{ profileId, created: false }`

### 6.3 What is NOT tested in M0-11C

- Philos expiry path under real wall-clock time (24h window — not testable synchronously)
- `require_user_confirmation` path via HTTP (no user-action endpoint in scope)
- LLM-provider signals (blocked on `ANTHROPIC_API_KEY` — same as M0-9C5C)

---

## 7. Invariants

These invariants are inherited or extended from previous milestones. All are binding for M0-11.

| ID  | Statement |
|-----|-----------|
| I1  | Every `observe` call that produces a `pending_review` proposal MUST trigger `PhilosReviewConsumer.consume()` in the same request cycle (M0-10A Q2). |
| I2  | Philos failure MUST NOT cause a 500 if the observation and proposal are already committed. The route returns 200 even if Philos errors. |
| I3  | Profile creation is idempotent. `POST /profiles` with an existing `profileId` returns 200, not 409 or 500. |
| I4  | `EssenceProposalService` and `PhilosReviewConsumer` co-constructed in the same `getOrCreate` factory share the same `proposalRecords` Map. No cross-session `proposalRecords` sharing (each session is isolated). |
| I5  | The security contract inherited from `observe/route.ts` and `summary/route.ts` applies unchanged to the new profiles endpoint: token only from `Authorization` header, constant-time comparison, fail closed when `INTERNAL_ESSENCE_TOKEN` not set. |
| I6  | Write-before-inference (M0-8C): the `Observation` is appended before `processExchange()` is called. The Philos wiring does not change this ordering. |

---

## 8. Acceptance Criteria

M0-11 is complete when all of the following hold:

| # | Criterion |
|---|-----------|
| A1 | `observe/route.ts` imports and constructs `PhilosReviewConsumer`; `philos` parameter is non-null in the `getOrCreate` factory. |
| A2 | `POST /api/internal/essence/profiles` exists, passes all B-route tests (§6.2), and satisfies I3 and I5. |
| A3 | HTTP integration test (§6.1) is green: orientation signal via observe route produces a committed `Interpretation` in the profile without LLM. |
| A4 | TypeScript compiles clean (`npx tsc --noEmit`) — no new type errors. |
| A5 | Full test suite (`npx vitest run`) remains green. |
| A6 | No security regression: `INTERNAL_ESSENCE_TOKEN` required for the new profiles endpoint; query-string token explicitly rejected. |

---

## 9. Out of Scope (explicitly deferred)

| Item | Deferred to |
|------|-------------|
| Session registry TTL eviction (G5) | M0-10C |
| Repository durability (persistent store) | Post-M0 |
| `require_user_confirmation` → user action HTTP flow | M0-12 or later |
| LLM/Composite provider HTTP integration tests | M0-9C5C (unblocked when ANTHROPIC_API_KEY available) |
| Profile list / delete / update endpoints | Post-M0 |
| M0-10C lifecycle (decay, expiry enforcement, recency weighting) | M0-10C |

---

## 10. Open Questions

None currently blocking. All design decisions above are derivable from M0-10A/B locked invariants.

---

*M0-11 draft | 2026-07-27*
