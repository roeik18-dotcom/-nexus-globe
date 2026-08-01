# Personal Config — Live, Versioned System (design)

*Written before any of it was built. Part of it has since shipped, so the blanket
"nothing here is implemented" is no longer true — see the status table below, which
is the authoritative account. Read every section through it: an unmarked section is
a proposal, not a description of the system.*

## Status (authoritative — 2026-08-01)

| § | Subject | Status |
|---|---------|--------|
| 0 | event → projection → state principle | **approved architecture** |
| 1 | Six abstraction levels (L1–L6) | **not implemented** — no addressing scheme exists |
| 2 | Entry schema | **partially implemented** — see the divergence note in §2 |
| 3 | Change-event model | **superseded** — RFC-040 is the canonical envelope, not this shape |
| 4 | Versioning / fold / rollback | **not implemented** — `project()` accepts `changes` but always receives `()` |
| 5 | Statement classification | **partially implemented** — 4 of 6 kinds exist |
| 6 | `project_context` | **not implemented** — no such field in the schema or loader |
| 7 | ContextSelector | **not implemented** |
| 8 | Daily-opening flow | **not implemented** — no `daily_opening` entries exist; the projected domain is always empty |
| 9 | Worked example of a live update | **not implemented** — illustrative only |
| 10 | Merlin integration points | **1 of 5 partially** — see §10 |
| 11 | Boundaries | **implemented and enforced** — `.gitignore`, the guard, and loader validation |
| 12 | Universal Inbox / classifier | **not implemented** |
| 13 | Daily Operating Model | **not implemented** |

**What exists today** (commits `5635d4a`, `2515d3a`, `9985a9d`, `6769f4f`, `cbde475`):
`profiles/SCHEMA.md` + the two local YAML files as **seed state**; a loader that
validates and projects them into `PersonalConfigState`; a `personal_config`
collector reporting coverage into the Morning Snapshot; and the privacy layer.
Everything else below is the approved direction, not the current system.

## 0. Principle
The Personal Config is **not a description of who Roei was — it is the live model
of who Roei is now, with a history of how he changed.** It uses the **same
event → projection → state** spine as Philos, so Merlin and Philos share one
architecture:

```
Change Event  →  fold()  →  Current Profile State  →  Context Selector  →  Merlin / Daily Brief
                    (history kept separate from current state)
```

## 1. Organizing axis — abstraction levels, not topics
The config is ordered by **how deep a thing sits in the person**, not by subject.
That is what lets it grow from tens to thousands of items without collapsing: the
top changes the whole personality; the bottom is domains, knowledge, tasks, history.
**Every new item knows where it belongs** — it has an *address*, not just a folder.

The universal spine — applies to the person **and** to every domain:
```
Identity → Mechanisms → Expressions → Actions → Results → History
```

**The six levels**
```
L1  PERSON (core)     who you are — identity · values · principles · Philos ·
                       decision model · mechanisms · thinking patterns · general prefs
      ▼                (change profession tomorrow → this barely moves)
L2  LIFE DOMAINS      expressions of the person — Music · Business · Health ·
                       Learning · Relationships · Travel   (each gets its own Config)
      ▼
L3  WITHIN A DOMAIN   not "who you are" but "how you work" — e.g. Music:
   (domain Config)     Identity · Philosophy · Production · Songwriting · Mixing ·
                       Mastering · Performance · Studio · Plugins · References …
      ▼
L4  KNOWLEDGE         what you know — Harmony · Rhythm · Compression · Sound Design …
   (NOT config)        grows forever; this is Knowledge, not Config
      ▼
L5  PROJECTS          the actual work — Song A · Album · Mix for Client · Live Set
      ▼
L6  EVENTS            what happened — Today · Commits · Sessions · Ideas · Tasks · Versions
```

**Four layers that must never be conflated** (the distinction that keeps it clean):
| Layer | Question | Example (Music) |
|---|---|---|
| **Config** | who you are / how you work | Music Identity, Mixing approach |
| **Knowledge** | what you know | Compression, Harmony |
| **Projects** | what you're working on | "Song A", client mix |
| **Events** | what happened | yesterday's session, a commit |

**Universal domain template** — every domain (music, business, a future one) reuses it:
```
<Domain> → Identity · Principles · Knowledge · Skills · Projects · Resources · Timeline · History
```

**Addressing** — every entry carries `(layer, domain, section)` so new content self-files:
`(config, music, mixing)` · `(knowledge, music, compression)` · `(project, music, song-a)` ·
`(event, music, 2026-08-01-session)`. The Human Core is `domain = person`.

**Why this fits Philos** — it is the same map Philos applies to any human:
`Identity → Mechanisms → Expressions → Actions → Results → History`. Not a way to
organise files — a way to **map the person**.

**Scaling property** — a new domain in two years (entrepreneurship, painting, research)
invents no new structure: it gets a Config in this template, and the Human Core keeps
feeding every domain. Consistency holds from tens to thousands of items.

**Boundary (unchanged):** the Human Core may *inform* Philos founder principles via an
explicit distillation step (`founder_principle_candidate`), and enters Philos Core
**never** (`philos_core:false`).

## 2. Schema — one entry (current state)

> **Partially implemented — this is NOT the shipped schema.** `profiles/SCHEMA.md`
> is authoritative for what the loader accepts today. Divergences, all of them
> proposals rather than existing behaviour:
>
> | proposed here | shipped | note |
> |---|---|---|
> | `domain:` per entry | `layer:` per **file** | domain is derived by routing, not declared |
> | `kind:` | `type:` | different key name |
> | `historical_behavior` | `historical_pattern` | different value name for the same idea |
> | `current_goal`, `deprecated` | — | not accepted; the loader rejects them as unknown types |
> | `project_context:` | — | §6, not implemented |
> | `status:`, `order:` | — | not implemented |
> | `created_at`, `updated_at`, `version` | — | require the change log (§3–4), which does not exist |
> | — | `confidence:` | shipped and **required**; absent from this proposal |
> | — | `valid_from` / `valid_until` | shipped and required-present; how "historical" is expressed today |

```yaml
id: <kebab>
domain: person|music|projects|routines|preferences|principles|goals|blockers|daily_opening
kind: fact | preference | personal_principle | historical_behavior | current_goal | deprecated
statement: <plain sentence; principles phrased as leanings, not laws>
project_context: global|merlin|philos|music|multi_agent
status: active | archived | deprecated
order: <int, for priority ordering within a domain>
privacy: public | private | sensitive
usage: { merlin: bool, founder_principle_candidate: bool, philos_core: false }  # always false
created_at: <iso>   # first event
updated_at: <iso>   # latest event
version: <int>      # bumped each change to this entry
```
`projects` entry extends this with: `state (operational|optimization|blocked|…),
goal, progress_note, blockers: [entry_id], tasks: [entry_id]`.

## 3. Event model — the change event (the versioning source of truth)

> **Superseded.** This shape predates `docs/architecture/rfc-040-canonical-event-envelope-v1.md`,
> which is now the canonical envelope, and the two do not agree: RFC-040 requires
> `event_family` · `event_type` · `actor_id` · `entity_type` · `entity_id` ·
> `visibility` · `audience` · `evidence` · `provenance` · `schema_version` ·
> `payload`, where the sketch below has `actor` · `op` · `target` ·
> `previous_value` · `new_value` · `reason`.
>
> RFC-040 was written to carry these events — its own fixture uses
> `event_family: "personal_config.change"`, `event_type: "entry.updated"` — so the
> intent survives; only the field shape below is obsolete. A change event must
> conform to the envelope, with `op` / `previous_value` / `new_value` / `reason`
> living inside `payload`. Kept here for the op vocabulary, not the structure.

Mirrors the Philos canonical event. **This is the only writer of state.**
```yaml
event_id: <ulid>
timestamp: <iso>
actor: roei | merlin | system
op: add | update | remove | archive | reorder | replace | mark_deprecated
    | add_project | close_project
target: { domain: <domain>, entry_id: <id|null for domain-level ops> }
previous_value: <entry snapshot | null>
new_value: <entry snapshot | null>
reason: <why>
```
Every edit — add a paragraph, delete one, reword, reprioritise, mark stale,
replace a principle, add/close a project — is one of these ops. Nothing mutates
in place.

## 4. Versioning model
- **Current state = `fold(change_events)`** — deterministic replay, newest wins.
- **History is the event list itself**, kept strictly separate from current state.
- **A "version"** = the state after N events. Any two versions diff cleanly
  (walk the events between them). Optional periodic **snapshots** for speed.
- **Rollback** = append an inverse event (never delete history).

## 5. Statement classification (req 5)
`fact · preference · personal_principle · historical_behavior · current_goal ·
deprecated`. `historical_behavior` and `deprecated` are never read as *current*;
`current_goal` feeds the brief's priorities; `deprecated` is retained in history
but excluded from every render.

## 6. Project-specific contexts (req 6)
`project_context ∈ {merlin, philos, music, multi_agent, global}`. Lets the
selector load "everything about Music" or "Philos blockers" without the rest.

## 7. Context-selection rules (req 9 & 10 — never dump the whole profile)
A **ContextSelector(request) → entries[]** picks the minimal relevant slice:
| Request kind | Selects |
|---|---|
| `morning_brief` | change-delta since last session · `projects` state · active `blockers` · top `goals`/`current_goal` by `order` · `daily_opening` prefs |
| `music_help` | `music` domain + `project_context=music` + relevant `preferences` |
| `philos_work` | `project_context=philos` (+ founder-candidate principles, read-only) |
| `general_chat` | `person` facts + `comm-style`/`evidence-discipline` preferences |
Filters always applied: `status=active`, `privacy≠sensitive`, `usage.merlin=true`
(for Merlin renders). **Nothing with `founder_principle_candidate` crosses into
Philos without an explicit, separate distillation step; `philos_core` is always
false.**

## 8. Daily-opening flow (data-sourced, JARVIS-style — every line from a real source)
```
1. clock()                         → day / date / time            (real)
2. delta = diff(current, state@last_session)   from change events → "since last update you…"
3. per-project live collectors (real, honest — 'no data' never invented):
     merlin  → service alive? focused tests? open blockers        (launchctl / vitest / git)
     philos  → domain files, event-log slice count, tests green   (repo signals)
     music   → studio_operating: active_projects/mixes/tasks; last studio activity
     multi_agent → agents active / healthy
     system  → services & host state
4. priorities = top 3 current_goal/blockers by order
5. observations = derived trends (progress rate, risk, opportunity)
6. render: greeting → "since last update" → status board → top-3 → observations → "ready."
```
Merlin reads **only the latest current-state + the delta** — never the full
history. Fixed phrases allowed only for the frame ("Merlin כאן לרשותך"); every
*fact* is sourced or omitted.

## 9. Example — one live update, end to end
```yaml
# Roei: "raise Philos's Event-Log work above the globe."
event_id: 01J…
timestamp: 2026-08-03T08:05:00+03:00
actor: roei
op: reorder
target: { domain: projects, entry_id: philos }
previous_value: { goals_order: [globe, event_log, person_model] }
new_value:      { goals_order: [event_log, person_model, globe] }
reason: "domain-first before visualisation"
```
→ fold bumps `projects.philos.version`, updates current-state.
→ next morning brief’s delta surfaces: *"מאז העדכון האחרון שינית את סדר
העדיפויות של Philos — Event Log עלה מעל הגלובוס."* Nothing else re-read.

## 10. Exact Merlin integration points

> **1 of 5 partially built.** Status per point below.

1. **`ConfigStore`** — appends change events, folds to current-state, exposes
   `current()`, `version()`, `diff(since)`.
   → *partially implemented*: `mos/personal_config.py` reads and projects seed YAML
   and `project(files, changes)` reserves the fold seam, but nothing appends events,
   and `version()` / `diff(since)` do not exist.
2. **`ContextSelector`** — §7; the only thing that decides which entries a request sees.
   → *not implemented*.
3. **`PersonalProfileLayer`** (in `app/context_builder.py` `for_session`) — injects
   **only the selected slice**, not the whole profile.
   → *not implemented*. `for_session` has no such layer; **no profile content reaches
   any prompt today.**
4. **`MorningBrief`** — §8; called on wake / "בוקר טוב"; reads `current()` + `diff(last_session)` + live collectors.
   → *partially implemented*: `mos/morning.py` returns Snapshot + Coverage only. The
   `personal_config` collector reports counts and validation, never entry content,
   and there is no `diff(last_session)`.
5. **Change-writer** — when Roei says "add a goal / deprecate this routine / close a
   project", Merlin appends a change event (op + reason), never edits in place.
   → *not implemented*. Profiles are edited by hand.

## 11. Boundaries (unchanged, enforced)
- No Roei-specific content inside reusable domain logic (ConfigStore/Selector are generic; content lives in data).
- Never copy the whole profile into a prompt (§7 selector).
- `usage.philos_core` is always false; founder-candidates cross only via an explicit distillation step.

## 12. Intake — Universal Inbox → Semantic Classifier → multi-tag routing
New knowledge rarely belongs to one place. Intake is a **pipeline, not a folder**,
and routing is **multi-tag**: one canonical item, many links, zero duplication.
```
Sources: iPhone Reminders · Voice Notes · WhatsApp · Dropbox · Notes · Gmail · Calendar · Conversations
      ▼
Universal Inbox        (raw capture; nothing lost)
      ▼
Semantic Classifier    (assigns 1..n destinations + confidence)
      ▼
Destinations (multi):  Philos Config · Music Config · Knowledge Base · Project · Task · Archive
```
**One canonical copy, links not copies** — the same canonical-store discipline as the
event log. Routing examples:

| Captured item | Routes to |
|---|---|
| "רעיון לפזמון בקצב איטי" | Music→Songwriting ✔ · Knowledge→Creative Ideas ✔ · Philos ✗ (not identity) |
| "אני עובד טוב יותר בבוקר" | Philos→Behaviour→Productivity ✔ · Morning Planner ✔ · Music ✗ |
| "המוזיקה הכי טובה שלי מתחילה מהרגש, לא מההרמוניה" | Philos→Creative Behaviour ✔ · Music→Songwriting Philosophy ✔ |

**Personal Inbox** — a Philos-Config-local staging queue *before* classification:
iPhone Reminders · Core Notes · Collective Notes · Ongoing 2026 · Ideas · Things to
Review · Future Improvements · Unclassified. Lets Merlin report intake state, e.g.
*"12 רעיונות חדשים בתזכורות: 3 שולבו בקונפיג, 5 שויכו ל-Philos, 4 ממתינים למיון."*

**Implementation consequence:** an inbox item is just another canonical event
(`op: capture`, source, raw text); classification appends `tag` events (domain +
confidence). No content copied; projections read the tags. One spine — keystroke to value.

## 13. Daily Operating Model — the closed loop (Philos evolves from lived life)
The two configs are **not endpoints** — they are the top of a loop that turns a day
into an update of the person-model. Not two configs; **two identical systems that
connect**, feeding one operating model.
```
Human
  → Philos Personal Config (the person)  ─┐
  → Music  Personal Config (the artist)  ─┤
                                          ▼
                               Daily Operating Model
     = f(Philos Config, Music Config, Projects, Calendar, Morning Snapshot, Health, Available Time)
                                          ▼
              Morning Snapshot → Daily Brief → Daily Schedule (לו"ז) → Execution
                                          ▼
                    Events → Knowledge → Behaviour analysis → Philos Evolution
                                          └──────── feeds back into the Config ────────┘
```
Key properties:
- **The schedule is derived, not hand-written** — it is a function of current state, not a script.
- **Every executed action emits an event** (task → completion → event); events roll up
  into Knowledge and Behaviour, which update Orientation. The person-model learns from
  what actually happened — the loop closes.
- **The person shapes the artist; the artist's doing enriches the person-model over time.**
- This reuses the Philos event spine end-to-end: lived events are the same kind of
  canonical events the config already folds — one architecture, from a keystroke to a value.

*On approval I implement in order: ConfigStore + event model → ContextSelector →
PersonalProfileLayer wiring → MorningBrief collectors → change-writer. But first —
per your instruction — the read-only Knowledge Inventory below grounds the structure
in what already exists on disk.*
