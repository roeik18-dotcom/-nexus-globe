# RFC-040 — Canonical Event Envelope v1

**Status:** Accepted (spec only — no system conforms yet except Personal Config).
**Decision type:** [E] engineering contract.
**Supersedes:** nothing. **Superseded by:** nothing.

> One envelope, two families. Philos records what happened in the world;
> Personal Config records how the model of a person changed. They are different
> payloads on the same wrapper, so a reader can route, audit and replay both
> without knowing either domain.

---

## 1. Why an envelope rather than a shared event type

Philos domain events and Personal Config change events answer different
questions. A domain event says *"this occurred"*; a change event says *"this
record was edited, from X to Y, because Z"*. Forcing one schema onto both would
either bloat Philos with `previous_value`/`reason` it never uses, or strip
Personal Config of the diff fields that make it auditable.

The envelope is therefore the **intersection** — the fields every event must
carry to be routable, attributable and replayable — and `payload` is the
**difference**.

## 2. The envelope

| Field | Type | Meaning |
|---|---|---|
| `event_id` | ULID string | Sortable by creation, unique without coordination |
| `event_family` | enum | `philos.domain` \| `personal_config.change` |
| `event_type` | string | Family-scoped verb, e.g. `impact.recorded`, `entry.updated` |
| `actor_id` | string | Who performed the act |
| `timestamp` | ISO 8601 + offset | When the event was **recorded** |
| `entity_type` | string | Family-scoped noun |
| `entity_id` | string | The thing the event is about |
| `visibility` | enum | `public` \| `private` |
| `audience` | object | `{ scope, entity_ids? }` — see §3 |
| `evidence` | string[] | Supporting references; `[]` is legitimate |
| `provenance` | object | `{ source, ref, method? }` — see §4 |
| `schema_version` | int | Envelope version; `1` |
| `payload` | object | Family- and type-specific; validated by a per-type guard |

A reader that does not recognise an `event_family` **must skip the event**, never
guess at its payload.

## 3. `visibility` and `audience` are different questions

Earlier drafts collapsed these into one field, which produced the value `invite`
— neither a visibility level nor a coherent audience. They separate cleanly:

- **`visibility`** — is this restricted at all? `public` | `private`
- **`audience.scope`** — if restricted, to whom? `owner` | `members` | `invitees` | `specific_entities`
- **`audience.entity_ids`** — required **iff** `scope == "specific_entities"`, omitted otherwise

**Two invariants**, without which the fields drift back into one:

1. `visibility: "public"` ⇒ `audience` MUST be omitted. Public means
   unrestricted; an audience alongside it invites two readers to disagree.
2. `visibility: "private"` ⇒ `audience` is REQUIRED. Private with no stated
   audience is undefined, not safe-by-default.

## 4. `provenance` — where the information came from

```
source ∈ { human_statement, observation, import, seed, derivation, external_system }
ref    : a locator — "profiles/seed/person.yaml@sha256:…", "conversation:2026-08-01T22:13"
method?: optional detail — "stated_directly", "site_visit"
```

Distinct from `actor_id`, which is who *performed* the act. A Merlin-recorded
event about something Roei said is `actor_id: "merlin"` with
`provenance.source: "human_statement"`.

**Naming conflict to resolve at migration:** Philos already exports a
`Provenance` interface (`source_events`, `sample_size`, `verification_status`) —
that one is *derived on a view*, this one is *asserted on an event*. When Philos
migrates, rename the derived type to `FigureProvenance`.

## 5. Family payloads

**`philos.domain`** — `payload` carries the domain specifics. On migration,
today's top-level `value_tags`, `resource_delta`, `impact_claim`, `confidence`
and `verification_status` move **into** `payload`; they are Philos-specific and
meaningless in a config change.

**`personal_config.change`**

| Field | Meaning |
|---|---|
| `operation` | `add` \| `update` \| `remove` \| `archive` \| `restore` |
| `path` | `<domain>/<entry_id>[/<field>]` |
| `previous_value` | `null` for `add` |
| `new_value` | `null` for `remove` |
| `reason` | **Required** — a change without a why is not auditable |
| `effective_from` | When this became true **in the world** |
| `effective_until` | When it stopped being true; `null` = still current |

**Bitemporality is load-bearing.** `timestamp` is when recorded;
`effective_from`/`effective_until` are when true. Recording today that a routine
ended in 2023 is `timestamp: 2026-08-01`, `effective_until: 2023-11-30`. Without
this split, a historical routine cannot be prevented from reading as current.

`archive` vs `remove`: archive means *"this was true and no longer is"* (visible
as history); remove means *"this should never have been recorded"* (not shown at
all). Collapsing them loses the difference between a life that changed and a
data-entry error. Nothing is ever deleted — the log is append-only.

## 6. Compatibility note — Philos is NOT yet conformant

**Philos currently uses a legacy envelope** (`app/lib/philos/events.ts`). It has
no `event_family`, no `schema_version`, no `provenance`, and its `visibility`
enum includes `invite`, which this spec replaces with the visibility/audience
split.

Until the migration lands:

- Philos events are **legacy-envelope**. No file may claim otherwise.
- Code reading both families goes through an explicit `adaptLegacyEvent(legacy)
  → EnvelopeV1` boundary, rather than pretending both systems already conform.
- The migration is planned but deliberately **not** bundled with Personal
  Config work: Philos is a stable system with 130 passing tests, and a
  cross-cutting refactor does not belong inside a feature unit.

Planned migration mapping:

| Legacy | v1 |
|---|---|
| — | `event_family: "philos.domain"`, `schema_version: 1` |
| — | `provenance: { source: "seed", ref: "valueGroupLog.ts" }` for seed events |
| `visibility: "public"` | `visibility: "public"`, audience omitted |
| `visibility: "private"` | `visibility: "private"`, `audience: { scope: "owner" }` |
| `visibility: "invite"` | `visibility: "private"`, `audience: { scope: "invitees" }` |
| top-level domain fields | moved into `payload` |

## 7. Conformance

`spec/events/envelope-v1.fixture.json` is the single canonical example. Every
implementation asserts against **that file**, not against a copy — a field added
to the spec without updating the fixture fails both suites, which is the only
practical defence against cross-language drift between the TypeScript and Python
implementations.

A conforming implementation must:

1. read every required field from the fixture,
2. enforce the two §3 invariants,
3. skip an unrecognised `event_family` rather than guessing.
