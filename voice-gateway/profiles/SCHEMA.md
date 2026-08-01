# Personal Config Schema v1

A **structured** personal configuration — not free-text pasted into code. Three
separate profiles (Person, Music, Routine), each a list of typed entries. Merlin
consumes the entries it is permitted to; Philos **Core never does**.

> Built to the rule Roei set: separate **fact / preference / belief / historical
> pattern**, tag **validity & privacy**, and make every crossing into a shared
> system **explicit** — never a direct copy.

## The four projects this belongs to
This is project **4 — Personal Config**. It connects to **Merlin** (project 2) as
context, and *may later* inform **Philos** (project 3) **founder principles** — but
only through the explicit transition below.

## Transition architecture (each arrow is a deliberate, human step — never automatic)
```
Roei Personal Config
      │  (distil, reframe as universal — never copy verbatim)
      ▼
Founder Principles           ← only entries flagged founder_principle_candidate
      │  (generalise; strip identity)
      ▼
Universal Philos Rules       ← the domain model; no person-specific content
      │
      ▼
User-specific Profiles       ← each user's own instance, like Roei's
```
**No entry ever sets `usage.philos_core: true`.** The loader enforces this
(`assert_philos_core_clean`). Personal beliefs, habits, musical identity, old
routines, and character traits **may not** become universal Philos rules.

## Profile file shape (YAML)
```yaml
owner: roei
layer: person | music | routine
schema_version: 1
note: <what this profile is and how to read it>
entries:
  - id: <kebab-case>
    type: fact | preference | personal_principle | historical_pattern
    statement: <plain sentence; principles/beliefs phrased NON-absolutely>
    confidence: observed | stated | personal | inferred
    valid_from: <year/date or null>
    valid_until: <null = current | "historical" | date>
    privacy: public | private | sensitive
    usage:
      merlin: <bool>                         # Merlin may use it as context
      founder_principle_candidate: <bool>    # MAY inform Philos founder principles (explicit step)
      philos_core: false                     # ALWAYS false — never a universal rule directly
```

## Type meanings (the separation Roei asked for)
- **fact** — verifiable about the world/Roei ("Main DAW: Ableton Live").
- **preference** — a taste or chosen way of working ("prefers heavy reverb").
- **personal_principle** — a belief/value; **stated as a leaning, not a law of nature**.
- **historical_pattern** — how Roei *used to* operate; `valid_until: historical` so it
  is never treated as the current routine.

## The three-way permission split (Roei's own rule)
- **Roei-only** (`founder_principle_candidate: false`): communication style, music,
  habits, schedule, personal preferences, persona.
- **Founder-principle candidate** (`founder_principle_candidate: true`): giving
  completes lack · tension between values · freedom as right-and-duty · truth
  measured against action · the value-forge (כור היתוך) · balance of emotional /
  mental / physical · id-ego-superego as an *interpretive model*.
- **Never Core**: any belief as universal truth, habits as everyone's default,
  musical identity, old life patterns, character traits as a moral standard.

## Deliberately excluded
Sensitive personal data (contact details, financial, medical) and political /
social opinions are **not** in these profiles: they are neither useful Merlin
context nor legitimate founder principles. `privacy: sensitive` entries, if ever
added, are withheld from the Merlin render.
