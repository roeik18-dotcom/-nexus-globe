> **Current implementation: Schema v1.**
> **Schema v2 is a frozen design only and is not yet implemented.**

# Personal Config — Schema v2

The loader in `voice-gateway/mos/personal_config.py` reads **v1**. Nothing in this
document is enforced, validated, or loaded by any running code.

**v1 is the entry point** — `voice-gateway/profiles/SCHEMA.md` — and remains the
authority for what is actually loaded, for as long as the loader reads v1 only.
This document describes what v1 cannot express and how to add it **without
rewriting a single existing entry**.

## Why v2

The extraction produced candidates v1 has no field for:

| Missing in v1 | Needed for |
|---|---|
| `status` / `valid_until` in use | Separating a historical identity from a current one |
| `project_context` | Loading "everything about Music" without the rest |
| `order` | Ranking within a domain |
| `current_goal` | The daily brief's priorities |
| `canonical_source` | Tracing an entry back to the document it came from |
| `supersedes` | Recording that one entry replaced another |

v1 defines `historical_pattern` and `valid_until`, but **no entry uses them** —
all 19 have `valid_until: null`. The mechanism exists and has never been exercised.

## Schema

```yaml
owner: <id>
layer: person | music | routine | daily_opening | projects
schema_version: 2
entries:
  - id: <kebab>
    # ── v1, unchanged ───────────────────────────────────────────────────
    type: fact | preference | personal_principle | historical_pattern
    statement: <plain sentence; principles as leanings, not laws>
    confidence: observed | stated | personal | inferred
    privacy: public | private | sensitive
    usage: { merlin: bool, founder_principle_candidate: bool, philos_core: false }

    # ── v2, all OPTIONAL ────────────────────────────────────────────────
    status: current | historical | deprecated        # default: current
    valid_from: <ISO date | null>
    valid_until: <ISO date | null>
    current_goal: <string | null>                    # projects / daily_opening only
    project_context: global | merlin | philos | music | multi_agent
    domain_scope: universal | domain-specific | founder-specific
    founder_specific: <bool>
    order: <int>                                     # rank within (layer, project_context)
    canonical_source: <path or locator>
    supersedes: [<entry_id>]
    related_entries: [<entry_id>]
```

### Two fields that look redundant and are not

**`status` vs `valid_until`.** A date says *when*; a status says *whether it is in
force*. They come apart in the case that matters: a practice known to have ended,
with no reliable date. `status: historical` + `valid_until: null` states exactly
that — known state, unknown date — and inventing a date to fill the gap is the
failure this pair exists to prevent.

**`founder_specific` vs `usage.founder_principle_candidate`.** The first describes
the statement's scope; the second grants permission to cross into Philos founder
principles. Collapsing them would let a scope label silently authorise a crossing.

**`type: historical_pattern` vs `status: historical`.** The type says what kind of
statement it is; the status says whether it applies now. A `preference` can become
historical without becoming a `historical_pattern`.

## Invariants

1. `usage.philos_core` **must** be `false`. Unchanged from v1; still the hard gate.
2. `valid_until` non-null ⇒ `status ∈ {historical, deprecated}`.
3. `status: current` ⇒ `valid_until` is null.
4. `valid_from ≤ valid_until` when both are present.
5. `supersedes` ids must exist in the same layer; no cycles.
6. A superseded entry must not be `status: current`.
7. `founder_specific: true` ⇒ the statement names no person and contains no
   first-person identity.
8. `order` unique within `(layer, project_context)`.
9. `current_goal` only on `layer ∈ {projects, daily_opening}`.
10. `privacy: sensitive` ⇒ `usage.merlin: false`. Sensitive content never renders.
11. **At most one entry per `(layer, id-family)` may be `status: current`.**
12. **An explicit `status` always wins.** Inference from `valid_until` applies only
    when `status` is absent. A stated status is data; a derived one is a fallback,
    and a fallback may never overwrite data.
13. **No tooling may fill a null `valid_until`.** A historical entry with no end
    date is complete and valid. Validators must not flag it, and no migration may
    infer a date from surrounding context.

Rules 12 and 13 are the general form of a specific mistake: an end date was once
inferred from an unrelated mentorship date, which is context, not evidence.

## Migration — additive, never rewriting

```
Phase 1  loader accepts schema_version ∈ {1, 2}; v1 parsed unchanged
Phase 2  absent v2 field ⇒ documented default applied AT READ TIME;
         the file on disk is not touched
Phase 3  new entries authored at v2; existing entries stay v1
Phase 4  a change event may add v2 fields to ONE entry; never a bulk rewrite
```

**Read-time defaults for a v1 entry:**

| Absent field | Default |
|---|---|
| `status` | `historical` if `valid_until` non-null, else `current` |
| `domain_scope` | `founder-specific` if `usage.founder_principle_candidate`; `domain-specific` for `layer: music`; else `universal` |
| `project_context` | `music` for `layer: music`, else `global` |
| `order` | file order index |
| `canonical_source` | `null` — **absence is recorded, never invented** |
| `founder_specific` | mirrors `usage.founder_principle_candidate` |
| `supersedes` / `related_entries` | `[]` |

Note the interaction with invariant 12: the `status` default above applies **only**
when `status` is absent. It must never recompute an explicitly stated one.

## Worked example — the music identity split

The decision this schema was needed for. Three entries: a persistent core, and two
expressions whose status is mutually exclusive by invariant 11.

```yaml
- id: artistic-core
  type: personal_principle
  statement: >
    Music is a bridge between people; arrangement is built from opposing and
    contrasting elements, and the rhythmic pulse is the piece's heartbeat.
  confidence: stated
  status: current
  valid_from: null
  valid_until: null
  project_context: music
  domain_scope: domain-specific
  order: 1
  canonical_source: "raw/synthesis.json#music_candidates[5,6]"
  privacy: public
  usage: { merlin: true, founder_principle_candidate: false, philos_core: false }

- id: expression-electronic
  type: preference
  statement: >
    Current expression: Psytrance / Progressive Melody with a Breakbeat
    sub-style (~60/40), produced in Ableton with Serum and Massive.
  confidence: stated
  status: current
  valid_from: "2023-01-01"
  valid_until: null
  supersedes: [expression-acoustic]
  related_entries: [artistic-core, expression-acoustic]
  project_context: music
  domain_scope: domain-specific
  order: 2
  canonical_source: "raw/harvest-music.json — BE-YOURSELF-ACCELERATED.docx"
  privacy: public
  usage: { merlin: true, founder_principle_candidate: false, philos_core: false }

- id: expression-acoustic
  type: preference
  statement: >
    Legacy expression: acoustic singer-songwriter — "black singing" vocal
    style, acoustic guitar as the signature instrument, slow sustained
    production with heavy reverb.
  confidence: stated
  status: historical      # asserted from the sources
  valid_from: null
  valid_until: null       # NOT current; end date genuinely unknown
  related_entries: [artistic-core, expression-electronic]
  project_context: music
  domain_scope: domain-specific
  order: 3
  canonical_source: "raw/harvest-adam.json — אדם-קונפינג פרופיל נישה.rtf"
  privacy: public
  usage: { merlin: true, founder_principle_candidate: false, philos_core: false }
```

Three independent checks stop the two expressions rendering as simultaneous active
directions: invariant 11 (one current per id-family), invariant 6 (a superseded
entry is not current), and the explicit `status` protected by invariant 12.
Nothing is deleted — the acoustic identity stays fully readable as history, and a
`restore` change event could return it if the direction changes again.
