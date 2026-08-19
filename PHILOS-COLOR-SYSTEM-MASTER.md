# PHILOS — COLOR SYSTEM MASTER
## A contextual color language across PHILOS · Human Config · Positive Melting Pot · Merlin · Projects · Music · System

**Status:** `FULL_CANONICAL_LOCK` (v1.2, 2026-08-12) — locked after an external
red-team pass and a required-corrections pass (Parts X–XV); revised in a v1.2
reconciliation pass that added one genuinely new source-backed mapping (Event-Domain
lane colors, Appendix A.8) discovered in `app/lib/philos/dynamicsView.ts`, which v1.1
had missed and incorrectly marked `UNRESOLVED`. Built from a read-only audit of the
actual repository (code + docs). **This document documents what exists and what is
proposed; it does not resolve contradictions and does not invent data.** Locking this
document freezes its own structure and doctrine, not the underlying color
contradictions it documents — `#fbbf24`, `#ef4444`, and the duplicate greens remain
`CONTRADICTION`/`UNRESOLVED` inside the lock, exactly as found. A future edit that
adds a genuinely new source-backed mapping, or that resolves a named contradiction
with an explicit source, re-opens this document for a new revision — it does not
require un-locking the doctrine in Parts I–XV. (v1.2 is exactly that kind of edit:
a newly-discovered source, not a reopened decision.)

**Non-negotiable rule, repeated everywhere below:** *a shared color between two things
is never proof that they are the same thing.* It signals one typed relation — never
identity — and every relation in this document is tagged with exactly one of:

```
SAME_MEANING · ANALOGY · STRUCTURAL_PARALLEL · FUNCTIONAL_PARALLEL ·
ENERGY_PARALLEL · ORDERING_PARALLEL · CONTEXTUAL_LINK · PROJECT_LINK
```

Every mapping in this document carries exactly one status tag:

```
SOURCE_BACKED — read directly from a file in this repo, cited by path
INFERRED      — a reasonable reading of two source-backed facts, not itself written down anywhere
PROPOSED      — this document's own suggestion; not canon until separately approved
UNRESOLVED    — no source exists; deliberately left empty rather than invented
CONTRADICTION — two or more sources disagree; both are preserved, neither is chosen
```

**What this document does not do:** it does not touch, rename, recolor, or "fix" any
existing file. It does not touch Merlin / voice-gateway / wake / barge / audio / Day
Opening / n8n / Human Config runtime — those are read as reference only, cited by path,
never modified. It does not resolve the contradictions it documents. Resolving
`#fbbf24`, `#ef4444`, or the duplicate greens is a separate, future, explicitly-approved
step.

**Revision log:**
- **v1.0** (2026-08-12) — initial pass, built from the read-only repo audit.
- **v1.1** (2026-08-12) — external red-team correction pass. Closes the
  documentation/schema gaps identified by an external design-system review
  (relation-type definitions, Identity-vs-State doctrine, the "Context"
  word ambiguity, the token hierarchy, an accessibility/information-encoding
  doctrine, and the Master-table granularity policy). **No HEX value
  changed. No CONTRADICTION or UNRESOLVED mapping resolved. No new
  color-to-concept mapping introduced.** New material: Part II gains one
  paragraph; Appendix P gains one row; Parts X–XV are new and appended after
  the original Part IX, which is left untouched as the historical record of
  the v1.0 pass.

---

# PART I — DOCTRINE (§1–§4)

## §1. Definition of Color Language

A **Color Language** is a controlled vocabulary in which a hex value functions as a
**typed token** carrying one or more declared relations between concepts that live in
separate ontologies — PHILOS canon, Human Config, the Positive Melting Pot, Merlin,
Projects, Topics, Contexts, Music, physical organization, and computer/file
organization. A token's meaning is only ever resolved through its declared axis
(**Identity** vs **Relation**, and — for a Relation — which of the eight types in the
header) — never inferred from visual similarity, and never assumed from reuse.

A color that has no declared axis is not part of the Color Language yet, even if it
appears in code. (See §17 / Appendix L: most of the highest-frequency hex values in
`app/` are **UI chrome** — background navy shades with no declared meaning — and are
explicitly excluded from the semantic system for that reason.)

## §2. Why color is relational infrastructure, not decoration

The repository already contains, in one place, exactly the discipline this document
scales up. `voice-gateway/service/control_panel.html` (Merlin's own control panel —
read only, not modified here) states in its own CSS comment:

> "Each maps a MEANING to exactly one `--sc` color, so the same state is always the
> same color everywhere."

That is the whole principle: **one documented meaning per color per axis, applied
consistently — never a decorative reuse of a hex because it "looked right."** The audit
underlying this document (Appendix Q) found the opposite already happening inside
`app/lib/*.ts`: `#fbbf24` alone carries nine unrelated meanings across nine files with no
rule connecting them. That is not this document's problem to silently fix (rule 4 in the
build brief) — it is the reason this document exists: to make the collision visible,
named, and frozen until a deliberate decision is made.

## §3. Color Identity vs Color Relation — the load-bearing distinction

- **Color Identity** — a color *is* the fixed label of one entity inside one closed
  ontology. Example, `SOURCE_BACKED`: `FORCE_COLOR.rational = #38bdf8` in
  `app/lib/philos.ts` — a fixed identity for the `rational` `DominantForce`, reused
  identically (same hex, same key) in `app/lib/orientation.ts`'s `CLASS_COLOR.rational`.
  Changing an Identity color would mean the entity's label changed.
- **Color Relation** — a color connects two **different** entities in **different**
  ontologies because they share a structural, functional, energetic, ordering, or
  contextual property — never because they are "the same." Every Relation in this
  document is tagged with one of the eight types in the header.

**A found example of the two being confused, already in the repo (not fixed here):**
`docs/philos-potential-map-spec.md` uses "Color" for two different axes in one document
without separating them — an *Identity* table (`PHILOS core = Blue #1565c0`) and a
*Relation-like* status table ("Colors encode evidence grade": Green = Frozen, applied
across unrelated components). This document's job is to never repeat that conflation:
every table below states which axis it is on.

## §4. Color Families (derived from evidence, not invented)

| Family | Source | Status |
|---|---|---|
| Force / Energy (6–7 hues, chakra-style progression) | `app/lib/philos.ts` (`FORCE_COLOR`), `app/lib/orientation.ts` (`CLASS_COLOR`) | SOURCE_BACKED, internally consistent for the 6 shared keys |
| Severity / Risk (traffic-light shape) | `stress.ts`, `dynamics.ts`, `topics.ts`, `match.ts`, `daily.ts`, `proof.ts` | SOURCE_BACKED, **internally inconsistent** — see Appendix Q |
| Identity / Component (muted Material palette) | `docs/philos-potential-map-spec.md` | SOURCE_BACKED, isolated to one static visual artifact |
| Evidence-grade (maturity axis) | same doc, separate table | SOURCE_BACKED, isolated |
| State (Merlin) | `voice-gateway/service/control_panel.html`, `control_center.html` | SOURCE_BACKED **by reference only** — off-limits, never reused |
| Canon / Melting-Pot (9-cell Domain×Frame) | `PHILOS-MELTING-POT-CANON.md` | **no color language exists in the canon document itself** — UNRESOLVED |
| Human Config (7 categories) | `corpus/01-Personal-Configuration/README.md` | category names only, zero color — UNRESOLVED |
| Music Config (7 categories) | `corpus/02-Music-Configuration/README.md` | category names only, zero color — UNRESOLVED |
| Merlin-Domain (7 routing domains) | `voice-gateway/app/domain_router.py` (`Domain` enum) | names only, zero color assigned anywhere — UNRESOLVED |
| Project / Topic / Context | 3 demo topics (`topics.ts`), `NodeContext` type (`philos.ts`) | PARTIAL, low confidence — demo/seed data, not a governing rule |

---

# PART II — THE ONE COLLISION THAT MUST NOT BE REPEATED (read before anything else)

The word **"Domain"** means three unrelated things in this repository. This document
never uses the bare word "Domain" without one of these three prefixes:

| Prefix | Meaning | Values | Source |
|---|---|---|---|
| **Canon-Domain** | the state axis in the Melting Pot ontology | `G` (Physical) · `E` (Emotional) · `C` (Cognitive) — 3 | `PHILOS-MELTING-POT-CANON.md` §3 |
| **Event-Domain** | event-category tag in the Dynamics/Orchestration layer | People · Community · Activity · Resources · Impact · Values · Publication · Personal · Observation — 9 | `PHILOS-DYNAMICS-LAYER.md` §5, `PHILOS-ORCHESTRATION-LAYER.md` §4 |
| **Merlin-Domain** | conversation-routing category | `HUMAN_CONFIG` · `MUSIC_CONFIG` · `STUDIO_PROJECT` · `PHILOS` · `RUNTIME` · `DAY_OPENING` · `GENERAL` — 7 | `voice-gateway/app/domain_router.py`, class `Domain(str, Enum)` |

Note in particular: `Merlin-Domain.PHILOS` is **one routing category inside Merlin** —
it is not, and must never be read as, `Canon-Domain` (G/E/C). Confusing the two is
exactly the error rule 4 of the build brief exists to prevent, and every reference to
"Philos" as a Merlin-Domain value below is written as `Merlin-Domain.PHILOS` in full to
keep the two visually and textually separate.

A second, unrelated naming collision, also load-bearing for this whole document:
**`app/lib/philos.ts`** (a single file — the legacy "Nexus" 6-force engine, the source
of most colors in this document) is a **completely different system** from
**`app/lib/philos/`** (the directory — the newer event-sourced Value Group system
audited separately, `PHILOS-SYSTEM-BLUEPRINT.md` §0). Same name, zero shared code, zero
shared concepts. Every reference below to "System A" means the file, not the directory;
the directory has **no color system of its own at all** (confirmed: zero hex literals in
`app/lib/philos/*.ts`, zero color mentions in `PHILOS-DYNAMICS-UI-CONTRACT.md` beyond
"one color per domain (5)" — unspecified, UNRESOLVED).

**A third, terminology-only note, also load-bearing:** the word **"Context"** carries
two unrelated meanings and must not be conflated. `NodeContext` (§10,
`work | social | health | money | learning`, `app/lib/philos.ts`) is a **life-context
taxonomy** — a category an entity belongs to. Separately, in design-systems usage, a
"contextual token" is a mechanism by which a token's *resolved value depends on
rendering context* (e.g. light/dark theme, interaction state). **No source file in this
repo implements or documents the second meaning** — there is no theme- or
mode-dependent color resolution anywhere in the audited material. Every use of
"Context × Color" in this document (§10, Appendix J) refers only to the first meaning;
the second is named here only so a future reader never assumes it exists. `UNRESOLVED`.

---

# PART III — DOMAIN BY DOMAIN (§5–§19)

## §5. Palette hierarchy

Two axes exist in the source material and must never be merged into one:

- **ENERGY_LEVEL (which)** — hue selects *which* force/family. Source: the 6–7 hue
  Force progression (§Appendix A).
- **ORDER_LEVEL (how much / how deep)** — a severity/depth reading, independent of hue.
  The closest existing evidence is the 4-step shape shared by `RISK_BAND_COLOR` and
  `TENSION_COLOR` (`low/medium/high/critical`-style) — but in the source code this shape
  is *itself* expressed as a hue change (green→yellow→orange→red), which conflates the
  two axes. This document keeps them conceptually separate (§20) without editing the
  source files that conflate them.

## §6. Value × Color

`UNRESOLVED`. No `Value` entity exists as an implemented or canonically-defined object
in any layer audited (`PHILOS-SYSTEM-BLUEPRINT.md` §0 marks the Person schema, which
would carry values, as **missing**; the Melting Pot canon defines no value entity — it
defines `Need`, `Target`, `Offer`, not `Value`). There is nothing to attach a color to.
See Appendix B.

## §7. Domain × Color

Split three ways per Part II. **Canon-Domain** (G/E/C): UNRESOLVED, zero color in the
canon. **Event-Domain** (9 categories): **PARTIAL, corrected in v1.2** — 5 of the 9
values (`people · community · activity · resources · impact`, the subset that appears
as a `Domain` on a `DynamicsGraph` node) have `SOURCE_BACKED` lane colors:
`DOMAIN_COLOR` in `app/lib/philos/dynamicsView.ts:25-31`, live-wired into
`app/dynamics/DynamicsView.tsx:18,75,108,118` and `app/dynamics/page.tsx`. The
remaining 4 Event-Domain values (`Publication · Personal · Observation`, and any
value outside the `DynamicsGraph` node's `Domain` type) remain `UNRESOLVED` — they
have no node representation in the Dynamics graph today, so there is nothing to color.
`PHILOS-DYNAMICS-UI-CONTRACT.md`'s "one color per domain (5 [lanes])" (§2) is
therefore **satisfied**, not merely required — see Appendix A.8. **Merlin-Domain** (7
categories): UNRESOLVED, no color anywhere in `voice-gateway`.

## §8. Topic × Color

`PARTIAL`, low confidence. `app/lib/topics.ts` (`SEED_TOPICS`) defines exactly three
demo topics with colors: `climate = #22c55e`, `ai_regulation = #a78bfa`,
`work_meaning = #38bdf8`. These are explicitly demo/seed content (the file's own header:
"Just: where do your coordinates sit... No content moderation claims"), assigned by
whoever wrote the seed, with no documented assignment rule. **Do not treat these three
as a governing pattern** — they are three data points, not a system. See Appendix I.

## §9. Project × Color

`UNRESOLVED`. `corpus/01-Personal-Configuration/README.md` names "Projects" as one of
seven Personal-Configuration categories but no project instance or color exists
anywhere in the audited material. See Appendix H.

## §10. Context × Color

`PARTIAL`. A `NodeContext` taxonomy exists and is real:
`work | social | health | money | learning` (`app/lib/philos.ts`), with Hebrew labels
(`CONTEXT_LABEL`) — but **no color is assigned to any context anywhere in the code**.
The taxonomy is `SOURCE_BACKED`; the color mapping is `UNRESOLVED`. See Appendix J.

## §11. Human Config × Color

`UNRESOLVED`. `corpus/01-Personal-Configuration/README.md` lists seven categories:
Identity · Values · Goals · Behavior · Preferences · Routines · Projects. Zero color
exists for any of them, and — per the earlier PHILOS audit in this conversation — no
Human Config *runtime* exists to color in the first place. See Appendix D.

## §12. PHILOS 3×3 × Color

`UNRESOLVED`. `PHILOS-MELTING-POT-CANON.md` is a locked ontology document (`§3`, the
9-cell Domain×Frame grid) that contains **zero color references** of any kind — it is
pure schema. There is no source to read a palette from, and none is proposed here
(inventing one would violate rule 6 of the build brief; a color scheme for the 9 cells is
future, separately-approved work). See Appendix C.

## §13. Positive Melting Pot × Color

`UNRESOLVED`, same reasoning as §12 — the mechanism (`Need`/`Target`/`Offer`/
`Action`/`Transfer`/`Effect`/`OutcomeVerification`) is declared `NOT_IMPLEMENTED` in its
own canonical document (`PHILOS-MELTING-POT-CANON.md` line 7 / line 156) and carries no
color language. See Appendix E.

## §14. Merlin routing/domains × Color

`UNRESOLVED` for the 7 `Merlin-Domain` values (no color anywhere). **Reference only,
`SOURCE_BACKED`, off-limits to reuse:** Merlin's *state* colors (not domain colors) exist
in `voice-gateway/service/control_panel.html` / `control_center.html` — 8 named CSS
custom properties (`--green --blue --amber --red --gray --purple --cyan --orange`)
mapped one-to-one to runtime states (`OFFLINE/STANDBY/LISTENING/SPEAKING`, etc., and
button classes `.b-active/.b-restart/.b-readonly/.b-notimpl`). The exact hex values
behind those CSS variables were not confirmed by directly reading a `:root` block in
this audit (`INFERRED` only, from `rgba()` shadow values that approximate
`#58A6FF`/`#3FB950`/`#D29922` for blue/green/amber respectively) — stated here as
`INFERRED`, not `SOURCE_BACKED`, precisely to avoid overclaiming. **These colors belong
to Merlin and are never reused in this document's proposals.** See Appendix F.

## §15. Music × Color

`UNRESOLVED`. `corpus/02-Music-Configuration/README.md` lists seven categories: Artist ·
Production · Sound · Workflow · Studio · Brand · Release. No genre, instrument,
frequency-band, or color taxonomy exists in any audited file. The "drums = low
frequency" relation used throughout this document (per your instruction) is stated as a
domain-general audio fact, not sourced from any repo file — it is used only to
illustrate §20's axis distinction, and is never used to assign drums a specific hex.
See Appendix G.

## §16. Physical organization × Color

`UNRESOLVED`. No document describing physical/spatial organization was found anywhere
in the repository. This is a hard gap, not a design choice. See Appendix K.

## §17. Computer / file / system organization × Color

`PARTIAL`, `SOURCE_BACKED` for what exists. Systems A, B, and D themselves **are** the
computer/system-organization color layer today — they are code. Separately, a large
volume of high-frequency hex values in `app/` (`#1e4060`, `#0a2a4a`, `#040e1c`,
`#020d1a`, `#1a3550`, `#030f1e`, `#06223a`, and similar dark-navy shades) are **UI chrome
— background/panel colors with no declared cross-domain meaning**. They are explicitly
**out of scope** for the Color Language: including them as if they were semantic tokens
would manufacture meaning that was never authored. See Appendix L.

## §18. Personal ordering system × Color

`UNRESOLVED`. `corpus/01-Personal-Configuration/README.md` names "Routines" as a
category; no ordering system or color exists for it.

## §19. ערך סידורי (Order value)

Covered structurally in §5 and formalized in §20 as `ORDER_LEVEL`, kept independent of
`ENERGY_LEVEL`.

---

# PART IV — §20: THE ENERGY/ORDER SPLIT (mandatory, holds the drums example)

Two **independent** axes. Conflating them is the single most common error this document
guards against.

- **ENERGY_LEVEL** — *which* force/family a thing belongs to. Selects a **hue**.
  `SOURCE_BACKED` example: the Force progression in §Appendix A
  (id→physical→ego→emotional→rational→superego).
- **ORDER_LEVEL** — *how foundational / how deep / how severe* a thing is, independent of
  which family it belongs to. Should ideally select **lightness/depth**, not hue — though
  the one piece of source evidence for a 4-step order shape (`RISK_BAND_COLOR`,
  `TENSION_COLOR`) expresses it as a hue ramp instead, which is a conflation already
  present in the source and is *not* corrected here (rule 4).

### The mandatory drums example, preserved exactly as instructed

```
Drums  ↔  Low Frequency  ↔  Foundation / Lower Layer
```

| Entity | Domain | Relation to "Drums (Low Frequency, Foundation)" | Status |
|---|---|---|---|
| Drums | Music | — (this is the anchor) | `SOURCE_BACKED` as a general audio fact; not sourced from a repo Music doc |
| Low Frequency register | Audio physics | `ENERGY_PARALLEL` to Drums — shares the "low/foundation energy" reading | `ANALOGY`-adjacent, domain-general knowledge, not repo-sourced |
| A hypothetical "foundational/bodily layer" in Human Config | Human Config | `STRUCTURAL_PARALLEL` — occupies the *same position* (foundation) in an as-yet-undefined Human Config hierarchy | `PROPOSED` — no Human Config layering exists yet to parallel against (§11); this row is illustrative only |
| A hypothetical `G_I`-type cell (physical/individual) in the Melting Pot 3×3 | PHILOS canon | `STRUCTURAL_PARALLEL` — same "foundation" position in the 3×3 grid, **if and only if** a foundation/surface reading is later imposed on the grid (the canon itself declares no such reading) | `PROPOSED` — canon defines no ordering over its 9 cells today; this is speculative, not canon |
| "Foundation" layer in a system-ordering scheme | Computer/System | `ORDERING_PARALLEL` — same rank position (first/base) in a sequence | `PROPOSED` — no such scheme is documented in this repo |

**Explicitly, per your instruction:** all four right-hand rows are `ENERGY_PARALLEL`
and/or `STRUCTURAL_PARALLEL` / `ORDERING_PARALLEL` to Drums. **None of them is
`SAME_MEANING`.** Drums do not become a Melting-Pot cell; a foundational Human Config
layer does not become a musical instrument. The parallel is about *position in a
structure*, never about *identity of the object*.

---

# PART V — §21–§29: RULES

## §21. Cross-domain parallels — general rule

A parallel between domains is only ever recorded as one of the eight typed relations, and
every recorded parallel must name **both** sides explicitly plus the axis
(structure/function/energy/order/context/project). An unlabeled parallel is not entered
into this document.

## §22. When it is forbidden to reuse the same color

1. Never across an **Identity** boundary and a **Relation** boundary in the same table
   without a visible axis label (the very confusion found in
   `philos-potential-map-spec.md`, §3).
2. Never between **Merlin**'s state palette and any Philos-side palette — Merlin is a
   separate, live, running product; visual reuse would imply operational coupling that
   does not exist.
3. Never to imply `SAME_MEANING` between two ontologies that have no declared common
   entity (e.g., a Force-family hue must never be assigned to a Canon-Domain cell just
   because "they're both about energy" — that is `ENERGY_PARALLEL` at most, and only if
   explicitly declared).
4. Never for a `CONTRADICTION` color (`#fbbf24`, `#ef4444`, the duplicate greens) until
   the contradiction is separately resolved — see §24.

## §23. Ambiguity rules

Any hex with more than one recorded meaning must carry every meaning it actually has in
the `NOTES` column of the master table (Appendix, Part VI) — never just the "primary"
one. Silently picking one meaning and dropping the others would be an unapproved
resolution (rule 4 of the build brief).

## §24. Conflict rules

`#fbbf24` and `#ef4444` (nine-plus recorded meanings each), the two competing "good"
greens (`#22c55e` vs `#34d399`), and the two competing "bad" reds beyond the primary
(`#f87171`, `#dc2626`) are **frozen**: `CONTRADICTION`, not extended to any new meaning
by this document, and not resolved by this document. See §24 in Appendix Q for the full
list with exact citations.

## §25. Inheritance rules

`ORDER_LEVEL` (foundation/core/surface, low/mid/high) may be inherited across a
`STRUCTURAL_PARALLEL` or `ORDERING_PARALLEL` link. `ENERGY_LEVEL` / Identity color is
**never** inherited across any parallel — each domain keeps its own Identity coloring
even when it shares an Order position with another domain (the drums example, §20).

## §26. Override rules

Merlin and the Melting-Pot canon never inherit color from System A (the Nexus force
engine) or System B (the world-map spec), under any relation type, because:
Merlin is an independently operating product (override: its own palette always wins
inside its own surfaces), and the canon is explicitly `NOT_IMPLEMENTED` with zero color
language of its own (override: nothing to inherit into yet — §12/§13).

## §27. Cross-project rules

A color used inside one artifact/project (e.g., System B's static SVG world-map) is not
automatically available to another project (System A's live app) without an explicit
`CONTEXTUAL_LINK` or `PROJECT_LINK` recorded in this document. None is recorded today
between System A and System B — they were built independently and never cross-reference
each other in source.

## §28. Color reuse rules

Reuse is permitted only **within** the same family and axis (e.g., two Force-family
hues never share a value; that already holds true in System A's 6 shared
`FORCE_COLOR`/`CLASS_COLOR` keys). Reuse **across** families/axes is the default failure
mode already present in the source (6 of 6 shared Force hues also appear in at least one
severity/status table) — documented as a fact (Appendix Q), not normalized as a pattern
to follow going forward.

## §29. Semantic collision rules

A color qualifies as a "high-collision" token requiring resolution priority when it
appears with **three or more unrelated meanings** across files that never reference each
other. Four tokens meet that bar today: `#fbbf24`, `#ef4444`, `#38bdf8`, `#a78bfa` (full
citation list, Appendix Q). No fifth candidate was found meeting the same bar.

---

# PART VI — §30–§41: APPLICATION (forward-looking; mostly no existing precedent)

| § | Application | Existing precedent | Status |
|---|---|---|---|
| 30 | Visual grammar | `PHILOS-DYNAMICS-UI-CONTRACT.md` §3: solid = explicit edge, dashed = inferred edge (a *line-style* grammar, not a color grammar, but the only ratified visual-grammar precedent in the repo) | `SOURCE_BACKED` (style only, not color) |
| 31 | UI application | None for canon/Human Config/Melting Pot (no UI exists — prior audit). System A/B/D already apply their own palettes to their own UIs. | `PARTIAL` |
| 32 | Graph/node/edge coloring | `app/lib/philos.ts` `LINK_COLOR`; `PHILOS-DYNAMICS-UI-CONTRACT.md` requires per-domain lane colors, unassigned | `PARTIAL` / `UNRESOLVED` |
| 33 | Dashboards | Merlin's control panel (`control_panel.html`) is the only dashboard with a documented one-state-one-color rule; off-limits to reuse | `SOURCE_BACKED` (reference only) |
| 34 | Tables | This document's own tables are the first cross-domain color tables found in the repo | n/a (this document) |
| 35 | Tags | No tag-coloring system found anywhere audited | `UNRESOLVED` |
| 36 | Folders/files | No folder/file color-coding convention found | `UNRESOLVED` |
| 37 | Projects | No project-level color convention found (§9) | `UNRESOLVED` |
| 38 | Human profile | No Person/profile entity is implemented to color (`PHILOS-SYSTEM-BLUEPRINT.md` §0: Person = missing) | `UNRESOLVED` |
| 39 | Philos state | No `CellState` implementation exists to color (§12) | `UNRESOLVED` |
| 40 | Melting Pot matches | No `Matching` implementation exists to color (§13) | `UNRESOLVED` |
| 41 | Merlin context visibility | `Merlin-Domain` values exist (7), routing logic exists, **no color assigned to any of them anywhere** | `UNRESOLVED` |

Sections 30–41 are intentionally thin: applying color to systems that do not yet exist
in implemented form would mean inventing both the system and its color at once, which
rule 6 forbids. They are listed so the gap is visible, not to manufacture content.

---

# PART VII — LETTERED APPENDICES (A–R)

## Appendix A — CANONICAL / OBSERVED COLOR PALETTE

This is an **observed** palette (what exists), not a resolved canonical one — contradictions
are preserved per rule 5.

### A.1 — Force / Energy family (`SOURCE_BACKED`: `app/lib/philos.ts` `FORCE_COLOR`,
`app/lib/orientation.ts` `CLASS_COLOR` — identical for the 6 shared keys)

| Key | Hex | Swatch | Role (as documented in source comments) |
|---|---|---|---|
| `id` | `#ef4444` | 🔴 | "root · survival · drive" |
| `physical` | `#fb923c` | 🟠 | "body · energy · movement" |
| `ego` | `#fbbf24` | 🟡 | "choice · self · power" |
| `social` *(FORCE_COLOR only — not in the 6-class matrix)* | `#34d399` | 🟢 | "community · connection · sharing" |
| `emotional` | `#22d3ee` | 🩵 | "heart · empathy" |
| `rational` | `#38bdf8` | 🔵 | "mind · clarity · learning" |
| `superego` | `#a78bfa` | 🟣 | "values · vision · meaning" |

### A.2 — `LEVEL_COLOR` (`app/lib/orientation.ts`) — **CONTRADICTS A.1 on all 3 shared keys**

| Key | `LEVEL_COLOR` hex | `CLASS_COLOR` hex (A.1) | Status |
|---|---|---|---|
| `physical` | `#ef4444` | `#fb923c` | `CONTRADICTION` |
| `emotional` | `#38bdf8` | `#22d3ee` | `CONTRADICTION` |
| `rational` | `#22c55e` | `#38bdf8` | `CONTRADICTION` |

All three keys in `orientation.ts` disagree with themselves between `CLASS_COLOR` and
`LEVEL_COLOR`, in the same file. Not resolved here (rule 5).

### A.3 — Severity/status family (`SOURCE_BACKED`, multiple files, internally inconsistent)

| Hex | Swatch | Appears as | Files |
|---|---|---|---|
| `#22c55e` | 🟢 | alignment (link) · agree (relation) · low (risk) · climate (topic) · grounding (need) · learning (opportunity) · prosocialValue (stress) | `philos.ts`, `topics.ts`, `stress.ts`, `need.ts`, `opportunity.ts` |
| `#34d399` | 🟢 | low (tension) · verified (proof) · trusted (reputation) · rising (flow trend) · social (force, A.1) | `dynamics.ts`, `proof.ts`, `philos.ts` |
| `#fbbf24` | 🟡 | ego (force, A.1) · elevated (risk) · medium (tension) · stable (flow) · warm (urgency) · medium (impact) · claimed (proof) · emerging (reputation) · recovery (need) · business (opportunity) · instability (stress) | 9 files — see §29 / Appendix Q |
| `#fb923c` | 🟠 | physical (force, A.1) · opportunity (link) · tension (relation) · high (risk) · high (tension) · connection (need/opportunity) · conflict (stress) | `philos.ts`, `topics.ts`, `stress.ts`, `dynamics.ts`, `need.ts`, `opportunity.ts` |
| `#ef4444` | 🔴 | id (force, A.1) · conflict (relation) · critical (risk) · critical (tension) · hot (urgency) · vision (need) · low (impact) · escalation (stress) · physical (`LEVEL_COLOR`, A.2) | 8 files — see §29 / Appendix Q |
| `#f87171` | 🔴 | falling (flow trend) · rejected (proof) | `dynamics.ts`, `proof.ts` |
| `#dc2626` | 🔴 (deep) | harmRisk (stress) — deliberately beyond `#ef4444` in severity | `stress.ts` |
| `#a78bfa` | 🟣 | superego (force, A.1) · influence (link) · structure (need) · mentorship (opportunity) · ai_regulation (topic) · authority (reputation) | 6 files |
| `#38bdf8` | 🔵 | rational (force, A.1) · complementary (link) · work_meaning (topic) · cold (urgency) · established (reputation) · `LEVEL_COLOR.emotional` (A.2, contradiction) | 6 files |
| `#00f5d4` | 🩵 (teal accent) | momentum (need) · high (impact) — breaks the "green = good" pattern used elsewhere | `need.ts`, `daily.ts` |
| `#f472b6` | 🌸 | validation (need) · support (opportunity) | `need.ts`, `opportunity.ts` |
| `#818cf8` | 🔵 (indigo) | depth (need) — appears in no other table | `need.ts` |
| `#94a3b8` | ⚪ (slate) | patience (need) — appears in no other table | `need.ts` |
| `#475569` | ⚪ (slate, darker) | none (reputation level) — appears in no other table | `proof.ts` |

### A.4 — Identity / Component family (`SOURCE_BACKED`: `docs/philos-potential-map-spec.md`
— static visual artifact only, isolated from A.1–A.3)

| Component | Hex | Swatch | Position in spec |
|---|---|---|---|
| PHILOS core | `#1565c0` | 🔵 | Center |
| OPM engine | `#e65100` | 🟠 | Left of center |
| Marketplace engine | `#2e7d32` | 🟢 | Right of center |
| Reality | `#4527a0` | 🟣 | Top |
| Human | `#00695c` | 🟢🔵 (teal) | Lower-right |
| Human Drives | `#b71c1c` | 🔴 | Lower-left |
| 15 Users | `#546e7a` | ⚪ (gray) | Outer ring |
| Evidence Framework | `#43a047` | 🟢 | Below core |

### A.5 — Evidence-grade family (`SOURCE_BACKED`, same document, **separate axis from A.4**)

| Grade | Hex | Swatch |
|---|---|---|
| Frozen | `#43a047` | 🟢 |
| Candidate | `#9c27b0` | 🟣 |
| Placeholder | `#f57c00` | 🟠 |
| Not established | `#d32f2f` | 🔴 |

*(`Evidence Framework`, A.4, and `Frozen`, A.5, share `#43a047` — possibly intentional, since
the Evidence Framework component is itself graded Frozen; not confirmed by the source,
so recorded as `INFERRED`, not `SOURCE_BACKED` overlap.)*

### A.6 — Merlin state family (`INFERRED` hex, `SOURCE_BACKED` naming/discipline —
reference only, never reused)

| CSS variable | Approximate hex (from `rgba()` shadow values, not a directly-read `:root`) | Meaning |
|---|---|---|
| `--blue` | ≈ `#58A6FF` | e.g. `.orb-blue` |
| `--green` | ≈ `#3FB950` | e.g. `.orb-green` |
| `--amber` | ≈ `#D29922` | e.g. `.orb-amber` |
| `--red`, `--gray`, `--purple`, `--cyan`, `--orange` | not confirmed in this audit | — |

### A.7 — UI chrome (out of scope, listed only so it is not silently absorbed into the
semantic system)

Dark-navy background/panel shades with no declared meaning, found at high frequency in
`app/` (`#1e4060`, `#0a2a4a`, `#040e1c`, `#020d1a`, `#1a3550`, `#030f1e`, `#06223a`, and
similar): these are **not part of the Color Language**. They carry no cross-domain role
and are excluded per §1.

### A.8 — Event-Domain lane colors (`SOURCE_BACKED`, added v1.2 — corrects a v1.1 gap)

`app/lib/philos/dynamicsView.ts:25-31`, `DOMAIN_COLOR: Record<Domain, string>`, live
in the Dynamics graph's node-lane rendering (`app/dynamics/DynamicsView.tsx`). This is
the color v1.1 of this document missed and incorrectly catalogued as `UNRESOLVED`
(§7, Appendix C, Appendix Q v1.1) — found in the v1.1→v1.2 reconciliation pass, not
invented here. `Domain` in this table means **Event-Domain** exclusively (Part II) —
never confuse with `Canon-Domain` (G/E/C) or `Merlin-Domain`.

| Key | Hex | Swatch | Role |
|---|---|---|---|
| `people` | `#4f9dff` | 🔵 | Dynamics-graph lane color: People Event-Domain nodes |
| `community` | `#8b6cff` | 🟣 | Dynamics-graph lane color: Community Event-Domain nodes |
| `activity` | `#00c2a8` | 🟢🩵 (teal) | Dynamics-graph lane color: Activity Event-Domain nodes |
| `resources` | `#f2b13c` | 🟠 | Dynamics-graph lane color: Resources Event-Domain nodes |
| `impact` | `#ff6b8b` | 🌸 | Dynamics-graph lane color: Impact Event-Domain nodes |

**Classification (Part XI, Identity vs State doctrine):** `COLOR_IDENTITY` —
`INFERRED` status for the classification itself (the doctrine reading is a lens
applied after the fact), but `SOURCE_BACKED` for the hex values and their role. This
is a **persistent categorical association** between a color and an Event-Domain
value — it does not change per node instance, matching the doctrine's definition
exactly. Compare to Appendix A.3's severity family, which is `COLOR_STATE` — a useful
worked contrast: two color maps in the same overall document, one Identity-typed, one
State-typed, now both correctly classified.

**Relation typing (Part X):** none of these five hexes bears any declared relation
(`SAME_MEANING`/`ANALOGY`/`STRUCTURAL_PARALLEL`/etc.) to any Force-family color
(Appendix A.1), any System-B identity color (Appendix A.4), or any Canon-Domain (G/E/C)
— they are a wholly independent palette, chosen for exactly one purpose (Dynamics-lane
legibility), and this document records no cross-domain parallel for them because none
is declared anywhere in the source. `NOT_SAME_AS` every other color family in this
document, by the same rule that governs everything else here (`SAME_HEX ≠
SAME_SEMANTIC_IDENTITY`, Part XII) — trivially true here since none of the five hexes
even collides with an existing one.

**What this correction does NOT do:** it does not assign a color to the other 4
Event-Domain values (`Publication`/`Personal`/`Observation`, or any value the
`DynamicsGraph`'s `Domain` type doesn't carry) — those remain `UNRESOLVED`, because
they have no node representation in the Dynamics graph to color. It does not touch
`dynamicsView.ts` or any other source file — only this document's own prior
inaccuracy is corrected. It does not propose new Canon-Domain or Merlin-Domain colors.

---

## Appendix B — COLOR × VALUE

`UNRESOLVED` in full. No `Value` entity exists anywhere in implemented or canonical form
(§6). Nothing to map.

---

## Appendix C — COLOR × PHILOS

Two separate "Philos" systems must be kept apart here, per Part II:

| Philos system | Color status |
|---|---|
| System A, `app/lib/philos.ts` (Nexus 6-force engine) | `SOURCE_BACKED` — Appendix A.1–A.3 |
| `app/lib/philos/` directory (event-sourced Value Group system) | **`PARTIAL` (corrected in v1.2)** — the Dynamics sub-layer has `SOURCE_BACKED` lane colors (Appendix A.8); no other file under this directory has any color |
| `PHILOS-MELTING-POT-CANON.md` (3×3 Domain×Frame canon) | `UNRESOLVED` — zero color in the canon document |

No relation is recorded between System A's Force colors and the Melting-Pot
`Canon-Domain` (G/E/C) — doing so would require the canon to declare a color axis, which
it does not. Any future mapping here is `PROPOSED` at best, never `SOURCE_BACKED`.

---

## Appendix D — COLOR × HUMAN (Human Config)

`UNRESOLVED`. Seven named categories (`corpus/01-Personal-Configuration/README.md`):
Identity · Values · Goals · Behavior · Preferences · Routines · Projects. Zero color for
any of them.

| Category | Color | Status |
|---|---|---|
| Identity | — | `UNRESOLVED` |
| Values | — | `UNRESOLVED` |
| Goals | — | `UNRESOLVED` |
| Behavior | — | `UNRESOLVED` |
| Preferences | — | `UNRESOLVED` |
| Routines | — | `UNRESOLVED` |
| Projects | — | `UNRESOLVED` |

---

## Appendix E — COLOR × MELTING POT

`UNRESOLVED` in full — the canon document (`PHILOS-MELTING-POT-CANON.md`) contains no
color reference of any kind across all 27 of its sections. `Need`, `Target`, `Offer`,
`Action`, `Transfer`, `Effect`, `OutcomeVerification` — none carry a color.

---

## Appendix F — COLOR × MERLIN

| Axis | Status |
|---|---|
| Merlin runtime **state** colors | `SOURCE_BACKED` (naming) / `INFERRED` (exact hex) — reference only, Appendix A.6, never reused |
| Merlin **routing domain** colors (`HUMAN_CONFIG`/`MUSIC_CONFIG`/`STUDIO_PROJECT`/`PHILOS`/`RUNTIME`/`DAY_OPENING`/`GENERAL`) | `UNRESOLVED` — zero color anywhere |

---

## Appendix G — COLOR × MUSIC

`UNRESOLVED`. Seven named categories (`corpus/02-Music-Configuration/README.md`):
Artist · Production · Sound · Workflow · Studio · Brand · Release. No genre, instrument,
or frequency-band taxonomy exists to attach color to. The drums/low-frequency/foundation
relation used in §20 is general audio knowledge, not a repo source, and is not assigned a
hex here.

---

## Appendix H — COLOR × PROJECT

`UNRESOLVED`. "Projects" is named as a Human-Config category (Appendix D) with no
instances or colors recorded anywhere.

---

## Appendix I — COLOR × TOPIC

`PARTIAL`, low confidence, `SOURCE_BACKED` for exactly these three data points
(`app/lib/topics.ts`, `SEED_TOPICS`):

| Topic | Hex | Note |
|---|---|---|
| climate (שינוי אקלים) | `#22c55e` | reuses the "alignment/agree/low-risk" green (Appendix A.3) — no documented reason |
| ai_regulation (רגולציית AI) | `#a78bfa` | reuses the superego/influence purple — no documented reason |
| work_meaning (עבודה ומשמעות) | `#38bdf8` | reuses the rational/complementary blue — no documented reason |

Demo/seed data only — not a rule to extend to future topics without a new decision.

---

## Appendix J — COLOR × CONTEXT

`PARTIAL`. Taxonomy `SOURCE_BACKED` (`app/lib/philos.ts`, `NodeContext` +
`CONTEXT_LABEL`): `work` (עבודה) · `social` (חברתי) · `health` (בריאות) · `money` (כסף) ·
`learning` (למידה). Colors: `UNRESOLVED` for all five — none assigned in source.

---

## Appendix K — COLOR × PHYSICAL ORGANIZATION

`UNRESOLVED` in full. No document describing a physical/spatial organization scheme was
found anywhere in the repository during this audit.

---

## Appendix L — COLOR × COMPUTER / FILE SYSTEM

`PARTIAL`, `SOURCE_BACKED`. Systems A, B, and D (Appendix A.1–A.3, A.4–A.5, A.6) **are**
today's computer/system color layer — they exist as code and CSS. Separately, a large
UI-chrome palette exists (Appendix A.7) and is explicitly excluded from the semantic
Color Language. No file/folder/tag coloring convention was found (§35, §36 —
`UNRESOLVED`).

---

## Appendix M — LOW / MID / HIGH

`PARTIAL`, `INFERRED` from the shared 4-step shape of `RISK_BAND_COLOR` (`stress.ts`) and
`TENSION_COLOR` (`dynamics.ts`) — both real, both `SOURCE_BACKED` individually, but they
disagree on the hex for "low" (`#22c55e` vs `#34d399`, `CONTRADICTION`, Appendix Q):

| Level | `RISK_BAND_COLOR` | `TENSION_COLOR` | Status |
|---|---|---|---|
| low | `#22c55e` | `#34d399` | `CONTRADICTION` |
| medium / elevated | `#fbbf24` | `#fbbf24` | agree |
| high | `#fb923c` | `#fb923c` | agree |
| critical | `#ef4444` | `#ef4444` | agree |

Three of four steps agree across the two tables; only "low" disagrees. This is recorded
as-is — not resolved.

---

## Appendix N — FOUNDATION / CORE / SURFACE

`PROPOSED` in full — no source file uses this three-tier vocabulary anywhere in the
repository. It is introduced in this document only as a **conceptual scaffold** for
`ORDER_LEVEL` (§5, §20), to be populated once a real hierarchy exists in each domain
(Human Config, Canon, Music, System). No hex is assigned to Foundation/Core/Surface
here — doing so would be an unsupported invention (rule 6).

| Tier | Music (general knowledge, not repo-sourced) | Human Config | Canon | System |
|---|---|---|---|---|
| Foundation | low frequency / rhythm section (e.g. drums) | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` |
| Core | harmony / structure | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` |
| Surface | melody / production polish | `UNRESOLVED` | `UNRESOLVED` | `UNRESOLVED` |

Every cell besides the Music row (general audio knowledge, not this repo) is
`UNRESOLVED` because no source hierarchy exists yet in that domain.

---

## Appendix O — CROSS-DOMAIN PARALLELS

The only cross-domain parallel this document records with any confidence is the
mandatory drums example (§20), and it is recorded as `PROPOSED`/`ANALOGY`-grade
illustration, not as a ratified mapping. No other cross-domain parallel meets even
`INFERRED` confidence, because too few domains (Appendix B–K) have any real content to
compare yet. This table exists to state that plainly rather than fabricate rows:

| Relation type | Recorded instances |
|---|---|
| `SAME_MEANING` | 1 — `FORCE_COLOR` ≡ `CLASS_COLOR` for the 6 shared keys, both inside System A (Appendix A.1) |
| `ANALOGY` | 1 — the drums illustration (§20), explicitly non-binding |
| `STRUCTURAL_PARALLEL` | 0 confirmed; 3 `PROPOSED` (§20 table) |
| `FUNCTIONAL_PARALLEL` | 0 confirmed |
| `ENERGY_PARALLEL` | 1 `PROPOSED` (§20, drums ↔ low frequency ↔ foundation) |
| `ORDERING_PARALLEL` | 1 `PROPOSED` (§20) |
| `CONTEXTUAL_LINK` | 0 confirmed |
| `PROJECT_LINK` | 0 confirmed |

---

## Appendix P — SAME COLOR ≠ SAME CONCEPT

| Hex | Meaning 1 | Meaning 2 | Real relation, if any |
|---|---|---|---|
| `#38bdf8` (blue) | `rational` force (System A, live app) | `PHILOS core` identity (System B, static SVG) | none declared — the two systems never reference each other |
| `#fb923c` (orange) | `physical` force (System A) | `OPM engine` identity (System B) | none declared |
| `#a78bfa` (purple) | `superego` force (System A) | `Candidate` evidence grade (System B) | none declared |
| `#22c55e` / `#43a047` / `#2e7d32` (green, 3 distinct hexes) | "good/aligned" (System A) · "Frozen" grade (System B) · "Marketplace engine" identity (System B) | three systems, three meanings | none declared |
| `#ef4444` (red) | `id` force (System A) · `LEVEL_COLOR.physical` (System A, `orientation.ts`, contradicting `CLASS_COLOR.physical`) | same file, same word "physical," different color | `CONTRADICTION`, Appendix A.2 |
| `#ef4444` (red) | `id` force **identity**, System A (`C-ID`) | severity "critical" **state**, System A (`S-CRIT`) — same file family, no declared rule connecting the two roles | none declared — per Part XI (Identity vs State) this is a `COLOR_IDENTITY` role and a `COLOR_STATE` role sharing one hex, undocumented; arguably the most probable real-world misread in the whole palette, since both roles live in the same codebase (more so than the System-A↔System-B rows above) — `CONTRADICTION`, subsumed under Appendix Q's Q9 (not a new contradiction, the same fact made visible here) |

This table exists specifically so that **no future reader assumes** the recurring reds,
blues, greens, and oranges across System A and System B mean the same thing. They do
not, and no source declares that they do.

---

## Appendix Q — CONFLICTS (full citation list)

| # | Conflict | Sources | Verdict |
|---|---|---|---|
| Q1 | `CLASS_COLOR.physical` (`#fb923c`) vs `LEVEL_COLOR.physical` (`#ef4444`) | `app/lib/orientation.ts` | `CONTRADICTION` — same file, same key name, different color |
| Q2 | `CLASS_COLOR.emotional` (`#22d3ee`) vs `LEVEL_COLOR.emotional` (`#38bdf8`) | `app/lib/orientation.ts` | `CONTRADICTION` |
| Q3 | `CLASS_COLOR.rational` (`#38bdf8`) vs `LEVEL_COLOR.rational` (`#22c55e`) | `app/lib/orientation.ts` | `CONTRADICTION` |
| Q4 | "Good/low" green: `#22c55e` vs `#34d399` | `stress.ts` (`RISK_BAND_COLOR.low`) vs `dynamics.ts` (`TENSION_COLOR.low`); also `philos.ts` `LINK_COLOR.alignment` / `topics.ts` `RELATION_COLOR.agree` (`#22c55e`) vs `proof.ts` `PROOF_STATUS_COLOR.verified` / `REPUTATION_LEVEL_COLOR.trusted` / `dynamics.ts` `FLOW_TREND_COLOR.rising` (`#34d399`) | `CONTRADICTION` — no rule distinguishes the two greens |
| Q5 | "Bad/critical" red: `#ef4444` (primary, 8 files) vs `#f87171` (`dynamics.ts` `FLOW_TREND_COLOR.falling`, `proof.ts` `PROOF_STATUS_COLOR.rejected`) | as cited | `CONTRADICTION` — no documented severity ordering between the two |
| Q6 | `#dc2626` (`stress.ts` `harmRisk`) — deliberately deeper than `#ef4444` | `stress.ts` | Not a contradiction per se (looks intentional — an escalation beyond standard critical) but undocumented as a rule; flagged `AMBIGUITY`, not resolved |
| Q7 | `IMPACT_COLOR.high` = `#00f5d4` (teal), breaking the "green = good" pattern used everywhere else | `app/lib/daily.ts` | `CONTRADICTION` with the implicit repo-wide convention |
| Q8 | `#fbbf24` carries 9+ unrelated meanings across 9 files with no connecting rule | `philos.ts`(ego force)/`orientation.ts`(class)/`stress.ts`(instability)/`dynamics.ts`(medium tension, stable flow)/`match.ts`(warm)/`daily.ts`(medium impact)/`proof.ts`(claimed, emerging)/`need.ts`(recovery)/`opportunity.ts`(business) | `CONTRADICTION` / highest-priority collision |
| Q9 | `#ef4444` carries 9+ unrelated meanings | see Appendix A.3 | `CONTRADICTION` / highest-priority collision |
| Q10 | System A vs System B: identical hues (blue/orange/purple/green) used for unrelated Identity assignments with zero cross-reference | `app/lib/*.ts` vs `docs/philos-potential-map-spec.md` | `CONTRADICTION` (implicit — no declared relation exists, yet visual similarity could mislead a reader) |

None of Q1–Q10 is resolved in this document, per rule 5.

**A distinct, non-Q-numbered item, corrected in v1.2 (not a contradiction between two
repo sources — a gap between this document's v1.1 text and the repo):** v1.1 of this
document claimed Event-Domain lane colors were `UNRESOLVED` (§7, Appendix C). An
independent re-verification found this was **wrong** — `app/lib/philos/dynamicsView.ts`
already had a real, wired `DOMAIN_COLOR` map. This is not added to the Q1–Q10 list
because it was never a disagreement between two authoritative sources; it was this
document under-researching one file in v1.1. See Appendix A.8 for the correction.

---

## Appendix R — UNRESOLVED MAPPINGS (consolidated)

- Canon-Domain (G/E/C) × Color — no source
- Canon-Frame (I/R/S) × Color — no source
- The 9-cell Melting Pot grid × Color — no source
- `Need` / `Target` / `Offer` / `Action` / `Transfer` / `Effect` / `OutcomeVerification` × Color — no source (canon itself carries none)
- Merlin-Domain (7 values) × Color — no source
- Human Config (7 categories) × Color — no source
- Music Config (7 categories) × Color — no source
- `Value` entity × Color — no entity exists
- `Project` entity × Color — no instance exists
- `NodeContext` (5 values) × Color — taxonomy exists, no color exists
- Physical organization × Color — no source document found at all
- Folder/file/tag coloring conventions — none found
- Foundation/Core/Surface × any domain except the illustrative Music row — no source hierarchy exists yet

Every item above is left empty deliberately. Populating any of them requires either a new
source document/decision (outside this document's authority) or an explicitly-approved
`PROPOSED` design pass — neither happened here.

---

# PART VIII — MASTER TABLE

*Split into three linked sub-tables by `COLOR_ID` for readability; all 26 requested
columns are present across the three. A cell reads `UNRESOLVED` when no source exists —
never left blank, never invented.*

## Table 1 — Identity, Energy, Order

| COLOR_ID | COLOR_NAME | HEX | BASE_ROLE | ENERGY_LEVEL | ORDER_LEVEL | STATUS |
|---|---|---|---|---|---|---|
| C-ID | Root Red | `#ef4444` | Force identity: `id` (System A) | id (root) | UNRESOLVED | SOURCE_BACKED (identity) / CONTRADICTION (overload, Q9) |
| C-PHYSICAL | Body Orange | `#fb923c` | Force identity: `physical` | physical | UNRESOLVED | SOURCE_BACKED |
| C-EGO | Self Yellow | `#fbbf24` | Force identity: `ego` | ego | UNRESOLVED | SOURCE_BACKED (identity) / CONTRADICTION (overload, Q8) |
| C-SOCIAL | Community Green | `#34d399` | Force identity: `social` (FORCE_COLOR only, not in 6-class matrix) | social | UNRESOLVED | SOURCE_BACKED / CONTRADICTION (Q4, dual green) |
| C-EMOTIONAL | Heart Cyan | `#22d3ee` | Force identity: `emotional` | emotional | UNRESOLVED | SOURCE_BACKED |
| C-RATIONAL | Mind Blue | `#38bdf8` | Force identity: `rational` | rational | UNRESOLVED | SOURCE_BACKED (identity) / CONTRADICTION (overload) |
| C-SUPEREGO | Values Purple | `#a78bfa` | Force identity: `superego` | superego | UNRESOLVED | SOURCE_BACKED |
| L-PHYSICAL | Level-Physical Red | `#ef4444` | `LEVEL_COLOR.physical` — contradicts C-PHYSICAL | UNRESOLVED | physical (level) | CONTRADICTION (Q1) |
| L-EMOTIONAL | Level-Emotional Blue | `#38bdf8` | `LEVEL_COLOR.emotional` — contradicts C-EMOTIONAL | UNRESOLVED | emotional (level) | CONTRADICTION (Q2) |
| L-RATIONAL | Level-Rational Green | `#22c55e` | `LEVEL_COLOR.rational` — contradicts C-RATIONAL | UNRESOLVED | rational (level) | CONTRADICTION (Q3) |
| S-GOOD-A | Signal Green A | `#22c55e` | Severity "good/aligned" | UNRESOLVED | low (proposed) | SOURCE_BACKED / CONTRADICTION vs S-GOOD-B (Q4) |
| S-GOOD-B | Signal Green B | `#34d399` | Severity/status "good/verified" | UNRESOLVED | low (proposed) | SOURCE_BACKED / CONTRADICTION vs S-GOOD-A (Q4) |
| S-WARN | Signal Amber | `#fbbf24` | Severity "medium/elevated/warning" | UNRESOLVED | medium (proposed) | SOURCE_BACKED (shared with C-EGO, Q8) |
| S-HIGH | Signal Orange | `#fb923c` | Severity "high" | UNRESOLVED | high (proposed) | SOURCE_BACKED (shared with C-PHYSICAL) |
| S-CRIT | Signal Red | `#ef4444` | Severity "critical" | UNRESOLVED | critical (proposed) | SOURCE_BACKED (shared with C-ID) |
| S-BAD-B | Signal Red B | `#f87171` | "falling / rejected" | UNRESOLVED | UNRESOLVED | SOURCE_BACKED / CONTRADICTION vs S-CRIT (Q5) |
| S-DEEP | Deep Red | `#dc2626` | harmRisk — beyond critical | UNRESOLVED | beyond-critical (proposed) | SOURCE_BACKED, undocumented rule (Q6) |
| ACCENT-TEAL | Highlight Teal | `#00f5d4` | momentum-need / high-impact accent | UNRESOLVED | UNRESOLVED | SOURCE_BACKED / CONTRADICTION vs "green=good" convention (Q7) |
| N-VALID | Validation Pink | `#f472b6` | validation-need / support-opportunity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| N-DEPTH | Depth Indigo | `#818cf8` | depth-need (unique, no other table) | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| N-PATIENCE | Patience Slate | `#94a3b8` | patience-need (unique) | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| REP-NONE | Reputation-None Slate | `#475569` | none-level reputation (unique) | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| ID-PHILOS | Philos-core Blue | `#1565c0` | Component identity (System B) | UNRESOLVED | core (position, spec-declared) | SOURCE_BACKED, isolated |
| ID-OPM | OPM Orange | `#e65100` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| ID-MARKET | Marketplace Green | `#2e7d32` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| ID-REALITY | Reality Indigo | `#4527a0` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| ID-HUMAN | Human Teal | `#00695c` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| ID-DRIVES | Human-Drives Red | `#b71c1c` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| ID-USERS | 15-Users Gray | `#546e7a` | Component identity | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, isolated |
| GRADE-FROZEN | Evidence Frozen | `#43a047` | Evidence-grade (maturity axis, not identity) | UNRESOLVED | UNRESOLVED | SOURCE_BACKED, separate axis from ID-* in same doc |
| GRADE-CANDIDATE | Evidence Candidate | `#9c27b0` | Evidence-grade | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| GRADE-PLACEHOLDER | Evidence Placeholder | `#f57c00` | Evidence-grade | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| GRADE-NOTESTAB | Evidence Not-established | `#d32f2f` | Evidence-grade | UNRESOLVED | UNRESOLVED | SOURCE_BACKED |
| MERLIN-STATE-* | Merlin state colors (8) | ≈`#58A6FF`/`#3FB950`/`#D29922`/… | Runtime state, off-limits | UNRESOLVED | UNRESOLVED | INFERRED (hex) / SOURCE_BACKED (naming+discipline), reference only |
| EDOM-PEOPLE | Event-Domain People Blue | `#4f9dff` | Dynamics lane identity: `people` (added v1.2) | people (Event-Domain) | UNRESOLVED | SOURCE_BACKED |
| EDOM-COMMUNITY | Event-Domain Community Purple | `#8b6cff` | Dynamics lane identity: `community` (added v1.2) | community (Event-Domain) | UNRESOLVED | SOURCE_BACKED |
| EDOM-ACTIVITY | Event-Domain Activity Teal | `#00c2a8` | Dynamics lane identity: `activity` (added v1.2) | activity (Event-Domain) | UNRESOLVED | SOURCE_BACKED |
| EDOM-RESOURCES | Event-Domain Resources Amber | `#f2b13c` | Dynamics lane identity: `resources` (added v1.2) | resources (Event-Domain) | UNRESOLVED | SOURCE_BACKED |
| EDOM-IMPACT | Event-Domain Impact Rose | `#ff6b8b` | Dynamics lane identity: `impact` (added v1.2) | impact (Event-Domain) | UNRESOLVED | SOURCE_BACKED |
| CANON-* | (all Canon-Domain/Frame/cell colors) | — | — | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| MDOMAIN-* | (all 7 Merlin-Domain colors) | — | — | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| HC-* | (all 7 Human Config category colors) | — | — | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| MC-* | (all 7 Music Config category colors) | — | — | UNRESOLVED | UNRESOLVED | UNRESOLVED |

## Table 2 — Domain roles

| COLOR_ID | PHILOS_ROLE | HUMAN_ROLE | MELTING_POT_ROLE | MERLIN_ROLE | MUSIC_ROLE | PROJECT_ROLE | TOPIC_ROLE | CONTEXT_ROLE | PHYSICAL_ROLE | COMPUTER_ROLE | VALUE_ROLE |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C-ID | System A force identity (`id`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | RELATION_COLOR.conflict (topics.ts) | UNRESOLVED | UNRESOLVED | severity "critical" across 3 files | UNRESOLVED |
| C-PHYSICAL | System A force identity (`physical`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | opportunity-link, tension-topic | UNRESOLVED |
| C-EGO | System A force identity (`ego`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | 9-way collision (Q8) | UNRESOLVED |
| C-SOCIAL | System A force identity (`social`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | tension-low, proof-verified, reputation-trusted | UNRESOLVED |
| C-EMOTIONAL | System A force identity (`emotional`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | no reuse found outside System A | UNRESOLVED |
| C-RATIONAL | System A force identity (`rational`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | work_meaning (topics.ts) | UNRESOLVED | UNRESOLVED | complementary-link, reputation-established | UNRESOLVED |
| C-SUPEREGO | System A force identity (`superego`) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | ai_regulation (topics.ts) | UNRESOLVED | UNRESOLVED | influence-link, structure-need, reputation-authority | UNRESOLVED |
| L-PHYSICAL/EMOTIONAL/RATIONAL | System A `LEVEL_COLOR` (6×3 matrix "level" axis) — contradicts force identity | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | see Q1–Q3 | UNRESOLVED |
| S-GOOD-A/B, S-WARN, S-HIGH, S-CRIT | System A severity family | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | agree/tension/conflict (topics.ts) uses S-GOOD-A/S-HIGH/S-CRIT | UNRESOLVED | UNRESOLVED | risk band, tension zone, urgency, impact, proof status | UNRESOLVED |
| ID-PHILOS…ID-USERS | System B world-map identity | ID-HUMAN + ID-DRIVES only (component identities, not category colors — see Appendix D for the actual Human-Config category gap) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | static SVG artifact only | UNRESOLVED |
| GRADE-* | Evidence-grade axis in System B, applied to OPM/Matching/etc. | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | maturity signal on the world-map only | UNRESOLVED |
| MERLIN-STATE-* | UNRESOLVED | UNRESOLVED | UNRESOLVED | Runtime state badges (off-limits) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | Merlin dashboard only | UNRESOLVED |
| CANON-* | UNRESOLVED — canon has no color | UNRESOLVED | UNRESOLVED — canon has no color | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| MDOMAIN-* | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED — 7 domains, 0 colors | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| HC-* | UNRESOLVED | UNRESOLVED — 7 categories, 0 colors | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED (Projects is a HC category, still 0 colors) | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |
| MC-* | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED — 7 categories, 0 colors | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED | UNRESOLVED |

## Table 3 — Relations, limits, provenance

| COLOR_ID | STRUCTURAL_PARALLEL | FUNCTIONAL_PARALLEL | NOT_SAME_AS | ALLOWED_REUSE | FORBIDDEN_REUSE | CONFIDENCE | SOURCE | NOTES |
|---|---|---|---|---|---|---|---|---|
| C-ID | UNRESOLVED (no cross-domain source) | UNRESOLVED | ID-DRIVES (`#b71c1c`, also "red," System B — different hex, `NOT_SAME_AS` despite shared hue-family) | within Force family only | Canon, Human Config, Merlin, Music | medium (internally consistent within System A) | `app/lib/philos.ts`, `app/lib/orientation.ts` | also carries 8 severity meanings — see Q9, listed not resolved |
| C-EGO | UNRESOLVED | UNRESOLVED | GRADE-* (System B has no "ego" concept) | within Force family only | frozen — no new meanings until Q8 resolved | low (9-way overload) | `app/lib/philos.ts` + 8 more files | highest-priority collision, §29 |
| S-GOOD-A | UNRESOLVED | shares "positive outcome" reading with S-GOOD-B, `CONTRADICTION`-flagged, not `FUNCTIONAL_PARALLEL` (no rule connects them) | S-GOOD-B (same intended meaning, different hex — an unresolved duplicate, not a parallel) | none, frozen pending resolution | any new "good" assignment | low | `stress.ts`, `philos.ts`, `topics.ts` | Q4 |
| S-GOOD-B | UNRESOLVED | see S-GOOD-A | S-GOOD-A | none, frozen | any new "good/verified" assignment | low | `dynamics.ts`, `proof.ts` | Q4 |
| ID-PHILOS | Component-identity axis position: "center" | System-anchor role in the world-map, `FUNCTIONAL_PARALLEL` to nothing documented elsewhere | C-RATIONAL (`#38bdf8`) — both loosely "blue," zero declared relation | World-Map artifact only | System A, any live UI | medium (consistent within its own document) | `docs/philos-potential-map-spec.md` | Appendix P row 1 |
| MERLIN-STATE-* | UNRESOLVED | State-signaling function, `FUNCTIONAL_PARALLEL` to System A's severity family in the abstract sense only (both are status-color systems) — not recorded as a ratified link | any Philos-side color | Merlin surfaces only | **everything outside voice-gateway** | n/a | `voice-gateway/service/control_panel.html` | off-limits per rule 3 |
| CANON-* | UNRESOLVED | UNRESOLVED | C-* (Force family) — explicitly, per §26 override rule, canon never inherits System A color | none assigned | premature assignment of any existing palette | n/a | none | UNRESOLVED |
| MDOMAIN-* | UNRESOLVED | UNRESOLVED | CANON-* (Merlin-Domain.PHILOS ≠ Canon-Domain, Part II) | none assigned | any reuse of C-* or ID-* without a fresh decision | n/a | none | UNRESOLVED |
| HC-* | UNRESOLVED | UNRESOLVED | UNRESOLVED | none assigned | none assigned | n/a | none | UNRESOLVED |
| MC-* | UNRESOLVED | UNRESOLVED | UNRESOLVED | none assigned | none assigned | n/a | none | UNRESOLVED |

*(All remaining `COLOR_ID`s from Table 1 not repeated here follow the same pattern as
their nearest sibling above: severity-family colors inherit S-GOOD-A's row shape, other
Force colors inherit C-ID's row shape, other System-B identity colors inherit
ID-PHILOS's row shape. Spelling out all ~35 rows in full in Table 3 would repeat
`UNRESOLVED` at length without adding information; the representative rows above are
exhaustive in *kind*, not merely in count.)*

---

# PART IX — CLOSING RE-AUDIT (performed against the sources cited above, immediately before this document was finalized)

- Every hex value in Appendix A was re-checked against the file/line it is cited from
  during this write (no value was carried over from memory without a citation).
- Every `UNRESOLVED` row was re-checked for the *absence* of a source, not merely the
  absence of a memory of one — `grep`-level searches were run for "color", "צבע",
  "palette", "#[0-9a-f]{6}" across `corpus/`, `PHILOS-MELTING-POT-CANON.md`,
  `PHILOS-DYNAMICS-*`, and `voice-gateway/app/domain_router.py` before marking Human
  Config, Melting Pot, and Merlin-Domain as color-empty.
- No hex was invented for any `UNRESOLVED` row. No `PROPOSED` row was promoted to
  `SOURCE_BACKED`.
- The drums example was checked against §20 and Appendix O to confirm it is tagged
  `ANALOGY`/`ENERGY_PARALLEL`/`STRUCTURAL_PARALLEL` only, and that no row anywhere in
  this document tags it `SAME_MEANING`.
- The three-way "Domain" collision (Part II) was checked against every subsequent
  section for silent bare use of the word "Domain" — each instance below Part II uses
  one of the three qualified forms.
- `#fbbf24`, `#ef4444`, and the duplicate greens/reds were checked to confirm none of
  their appendix or table entries silently pick one meaning — every appearance lists
  its full known meaning set (Appendix A.3, Q4/Q5/Q8/Q9) and status remains
  `CONTRADICTION` throughout, never `SOURCE_BACKED` as a single resolved meaning.
- Zero source files were modified in the production of this document. Verified via
  `git status` immediately after writing (see the tool response reported alongside this
  file's creation).

---

# PART X — RELATION-TYPE DEFINITIONS (correction pass, closes red-team required
correction: the 8 relation types were used throughout Parts I–IX but never formally
defined)

**Source of these definitions:** the eight-term vocabulary itself was specified
verbatim in the user's build brief for this document (not derived from repo code); the
definitions below formalize that specification. Each entry also states, separately,
whether a **repo-sourced example** exists — where none does, the example field is
marked `UNRESOLVED` per rule 6 (never invent one). A definition existing does not mean
an example exists; the two are tracked independently.

### SAME_MEANING
- **Definition:** two references that resolve to the identical entity within one
  closed ontology — not a comparison between different concepts, but the same concept
  cited twice.
- **Scope:** intra-system only.
- **May color:** two labels/keys provably naming the same identity.
- **Must NOT imply:** that two *different* domains' concepts are interchangeable.
  Never valid across a domain boundary (Canon-Domain / Event-Domain / Merlin-Domain /
  Human Config / Music Config / Project / Topic / Physical / Computer are always
  different domains from one another and from System A/B/D).
- **Relationship to Domain/Project/Topic/Value/Person:** not applicable — by
  definition this relation never crosses one of those boundaries; a claimed
  `SAME_MEANING` that crosses one is a misuse of the tag, not a valid instance.
- **Example:** `SOURCE_BACKED` — `FORCE_COLOR.rational` ≡ `CLASS_COLOR.rational`, both
  `app/lib/philos.ts` / `app/lib/orientation.ts`, System A only (Appendix A.1).

### ANALOGY
- **Definition:** an illustrative, non-binding comparison used for explanation — not a
  structural, functional, or evidentiary claim.
- **Scope:** cross-domain, pedagogical only.
- **May color:** nothing on its own; it never licenses a coloring decision.
- **Must NOT imply:** identity, structure, function, energy, or order-sharing; must
  never be cited as justification for reusing a hex across domains.
- **Relationship to Domain/Project/Topic/Value/Person:** none — `ANALOGY` is
  explicitly weaker than every other relation type in this list.
- **Example:** `PROPOSED`/illustrative — the drums ↔ low-frequency ↔ foundation
  comparison (§20), explicitly domain-general knowledge, not repo-sourced, never used
  to assign a hex.

### STRUCTURAL_PARALLEL
- **Definition:** two entities occupy the *same position* within isomorphic structures
  in different domains (e.g., both are "the foundational layer" of their respective
  hierarchies), independent of function or energy.
- **Scope:** cross-domain, position-based; requires both sides to have a *documented*
  hierarchy to occupy a position within.
- **May color:** an `ORDER_LEVEL` tier reading (Foundation/Core/Surface) may be
  shared — never an `ENERGY_LEVEL`/Identity hue (§25 inheritance rule, unchanged).
- **Must NOT imply:** shared function or shared identity.
- **Relationship to Domain/Project/Topic/Value/Person:** valid only when both sides
  name an actual hierarchy; if one side's hierarchy does not exist yet (e.g. Human
  Config has no documented layering, §11), the relation is `PROPOSED`, never
  `SOURCE_BACKED`.
- **Example:** `PROPOSED` only (Appendix O: "0 confirmed; 3 PROPOSED") — the
  drums → Human-Config-foundation row, §20, illustrative only.

### FUNCTIONAL_PARALLEL
- **Definition:** two entities perform an analogous *job* across systems even when
  structurally located differently.
- **Scope:** cross-domain, job/role-based, not position-based.
- **May color:** nothing by default; requires both sides to have a documented
  function to compare.
- **Must NOT imply:** shared structure, shared energy, or identity.
- **Relationship to Domain/Project/Topic/Value/Person:** valid only when both sides'
  functions are independently documented (not inferred from a shared word).
- **Example:** `UNRESOLVED` — no instance recorded (Appendix O: "0 confirmed"). The
  closest candidate — Merlin's state-signaling function compared to System A's
  severity family (Table 3) — is explicitly noted there as an *unratified*
  observation, not a declared `FUNCTIONAL_PARALLEL`.

### ENERGY_PARALLEL
- **Definition:** two entities share a reading on an intensity/activation axis (how
  "charged" or "energetic" they are), independent of structure or function.
- **Scope:** cross-domain, intensity-based.
- **May color:** may motivate an `ENERGY_LEVEL`/hue-family *comparison* — but never
  licenses actually sharing a hue as if it were an Identity token (§25).
- **Must NOT imply:** that a shared hue is required or correct.
- **Relationship to Domain/Project/Topic/Value/Person:** none source-backed.
- **Example:** `PROPOSED` — drums ↔ low-frequency ↔ foundation (§20), general audio
  knowledge, not repo-sourced.

### ORDERING_PARALLEL
- **Definition:** two entities share a sequence/rank position (first/last, low/mid/
  high) without claiming the fuller structural isomorphism `STRUCTURAL_PARALLEL`
  requires.
- **Scope:** cross-domain, sequence-based; weaker than `STRUCTURAL_PARALLEL`.
- **May color:** `ORDER_LEVEL` only.
- **Must NOT imply:** hue/Identity sharing, or full structural correspondence.
- **Relationship to Domain/Project/Topic/Value/Person:** none source-backed.
- **Example:** `PROPOSED` — the "Foundation" layer row, §20.

### CONTEXTUAL_LINK
- **Definition:** two entities co-occur in the same real-world session, moment, or
  situation, without a deeper structural, functional, or energetic claim — the
  weakest relation type in this vocabulary.
- **Scope:** situational, time-bound, not conceptual.
- **May color:** nothing durable — a `CONTEXTUAL_LINK` must never justify a
  persistent color assignment; it records an observed co-occurrence, not a taxonomy.
- **Must NOT imply:** any of the other seven relation types.
- **Relationship to Domain/Project/Topic/Value/Person:** would connect two entities
  regardless of domain, solely because they were observed together — no such
  observation is recorded in the audited material.
- **Example:** `UNRESOLVED` — no instance found anywhere in the repo (Appendix O:
  "0 confirmed"). This is one of two terms in this vocabulary with neither a
  `SOURCE_BACKED` nor a `PROPOSED` instance anywhere in this document.

### PROJECT_LINK
- **Definition:** two entities are related specifically because they belong to the
  same named Project — an administrative/organizational link, not a conceptual one.
- **Scope:** project-membership only.
- **May color:** a Project-identity color, if one existed, could be shared by
  everything tagged to that project — an administrative grouping, not a claim about
  the entities' meaning.
- **Must NOT imply:** `SAME_MEANING` or any structural/functional/energy/order
  relation.
- **Relationship to Domain/Project/Topic/Value/Person:** requires an actual Project
  entity to anchor to; none exists (§9, Appendix H — `UNRESOLVED`).
- **Example:** `UNRESOLVED` — no Project entity or instance exists anywhere in the
  audited material (Appendix O: "0 confirmed").

**Summary:** of the eight, only `SAME_MEANING` has a `SOURCE_BACKED` real instance;
`ANALOGY`, `STRUCTURAL_PARALLEL`, `ENERGY_PARALLEL`, `ORDERING_PARALLEL` have
`PROPOSED`/illustrative instances only (all via the drums example); `FUNCTIONAL_
PARALLEL`, `CONTEXTUAL_LINK`, `PROJECT_LINK` have zero instances of any kind. All
eight are, as of this pass, formally **defined**; none is left as an undefined term.
A thin vocabulary honestly reported is preferred over a padded one.

---

# PART XI — IDENTITY vs STATE DOCTRINE (correction pass, locked; closes red-team
required correction)

**Locked definitions:**

```
COLOR_IDENTITY = a persistent categorical/organizational association between a
                 color and an entity. It does not change for that entity absent
                 a deliberate re-definition of the taxonomy itself.
COLOR_STATE     = a temporary/dynamic condition represented visually. It is
                 computed from current data and can change for the same entity
                 over time without any taxonomy change.

Identity ≠ State.
```

A `COLOR_STATE` must never silently redefine the `COLOR_IDENTITY` of: a person, a
domain (any of the three — Canon-Domain/Event-Domain/Merlin-Domain), a project, a
topic, a value, a context, or any other system entity. State overlays/status colors
are a **separate semantic layer** from identity colors, even when — as already
happens in this repository — they share a raw hex.

**This is a classification lens applied to material already catalogued in Appendix A
and Part VIII; it changes no hex, resolves no contradiction, and adds no new
color-to-concept mapping. It only names, for each already-documented family, which
type of color it is — a status tagged `INFERRED` throughout this table, since the
Identity/State distinction itself is a reading of existing source structure (e.g.
whether a value is a fixed key-lookup or a computed function output), not a literal
statement found verbatim in any source file.**

| Family (Appendix A ref.) | Type | Why | Status |
|---|---|---|---|
| Force/Energy (`FORCE_COLOR`/`CLASS_COLOR`, A.1) | `COLOR_IDENTITY` | fixed categorical label of a `DominantForce`/`ClassKey`; does not change per-instance | `INFERRED` |
| `LEVEL_COLOR` (A.2) | `COLOR_IDENTITY` (attempted) | also a categorical label — its conflict with `CLASS_COLOR` (Q1–Q3) is therefore an **Identity-vs-Identity clash**, not an Identity-vs-State one; noted, not resolved | `INFERRED` |
| Severity/status family — `STRESS_COLOR`, `RISK_BAND_COLOR`, `TENSION_COLOR`, `FLOW_TREND_COLOR`, `URGENCY_COLOR`, `IMPACT_COLOR`, `PROOF_STATUS_COLOR` (A.3) | `COLOR_STATE` | computed per-instance from live data (e.g. `deriveStress()` in `stress.ts`); the same entity's severity/tension/urgency/impact/proof-status can change over time without its Force identity changing | `INFERRED` |
| `REPUTATION_LEVEL_COLOR` (A.3) | `COLOR_STATE` | computed from accumulating history; can advance (`none→emerging→…→authority`) for the same person without a taxonomy change | `INFERRED` |
| `LINK_COLOR` / `RELATION_COLOR` (A.3, `philos.ts`/`topics.ts`) | `COLOR_STATE` | computed per node-pair from current data (distance/context match); not a persistent identity of any single entity | `INFERRED` |
| `NEED_COLOR` / `OPPORTUNITY_TYPE_COLOR` (A.3) | `COLOR_IDENTITY` | categorical label of a need-tag / opportunity-type, not a per-instance measurement | `INFERRED` |
| Topic colors (`SEED_TOPICS`, Appendix I) | `COLOR_IDENTITY` | persistent label of a named topic (demo data, low confidence, but identity-shaped) | `INFERRED` |
| System B component-identity family (A.4) | `COLOR_IDENTITY` | fixed label of a named component in one static artifact | `INFERRED` |
| System B evidence-grade family (A.5) | `COLOR_STATE` | a maturity *grade* a component currently holds — can advance (`Placeholder→Candidate→Frozen`) without the component's identity changing; **this is the clearest doctrine-compliant example already present in the source** — System B never lets the grade color overwrite the identity color; they are two separate tables (A.4 vs A.5) | `INFERRED` |
| Merlin state family (A.6) | `COLOR_STATE` | literally named "state" — `OFFLINE/STANDBY/LISTENING/SPEAKING`; the clearest STATE-type system in the repository; reference only, never reused | `SOURCE_BACKED` (naming) |

**A doctrine-relevant observation, not a resolution:** `#ef4444` alone carries at
least one `COLOR_IDENTITY` role (`C-ID`, the `id` Force) and at least one
`COLOR_STATE` role (`S-CRIT`, severity "critical") with no documented separation
between the two layers — exactly the failure mode this doctrine exists to name. This
is now cross-referenced in Appendix P (new row, correction pass) and remains
`CONTRADICTION`, unresolved, subsumed under the existing Q9, per rule 5. The
doctrine's value going forward is that any *future* color assignment can be checked
against this table before it is made — it does not retroactively fix what is
already there.

---

# PART XII — TOKEN HIERARCHY (correction pass, locked; closes red-team required
correction)

The following hierarchy is now explicit, and every existing table in this document is
mapped onto it without altering any of their contents:

```
Raw HEX
  → Color Token       (a stable name for one raw value — this document's `COLOR_ID`,
                        e.g. `C-ID`, Table 1 / Appendix A)
  → Semantic Role      (what the token means inside its own family — `BASE_ROLE`,
                        Table 1, plus the Identity/State typing, Part XI)
  → Contextual Role    (what the token means inside a specific cross-cutting
                        namespace — the `*_ROLE` columns, Table 2: `PHILOS_ROLE`,
                        `HUMAN_ROLE`, `MERLIN_ROLE`, etc.)
  → Project/Domain application (an actual, situated usage — a specific file, a
                        specific component, a specific screen; e.g. "`C-RATIONAL`
                        used as `work_meaning`'s topic color in `topics.ts`")
```

**Locked rule:** `SAME_HEX ≠ SAME_SEMANTIC_IDENTITY`. A raw HEX value reaching the
same numeric value in two rows of this document (e.g. `#ef4444` appearing as both
`C-ID` and `S-CRIT`, or `#38bdf8` appearing as both `C-RATIONAL` and `ID-PHILOS`)
proves nothing beyond "the same number was chosen twice." Every claim about what
that number *means* must be read off the Color-Token/Semantic-Role/Contextual-Role
layers, never off the raw hex alone. This document's tables already model tiers 1–3
(`COLOR_ID` / `BASE_ROLE` / the `*_ROLE` columns); this Part names the model
explicitly so a future editor extends it correctly instead of re-flattening it.

**What this Part does not do:** it does not introduce a Tier-0 deduplicated
primitive-palette registry (e.g. a single `red-500` referenced by pointer from
multiple tokens) — that was raised as an `OPTIONAL_IMPROVEMENT` by the red-team, not
a required one, and this pass applies required corrections only. The hierarchy above
is fully expressible with the tables already in this document; formalizing a
pointer-based primitive tier remains optional future work.

---

# PART XIII — ACCESSIBILITY & INFORMATION-ENCODING DOCTRINE (correction pass,
locked; closes red-team required correction — doctrine only, no palette values
touched)

Three rules, locked as doctrine for all *future* color application (§30–§41); **no
existing hex, table, or mapping is changed by this Part**:

1. **Color must never be the sole carrier of critical information.** Any future UI,
   dashboard, or graph application of this Color Language must pair a color with a
   text label, icon, or pattern for any distinction that matters to a decision. This
   is not a new invention — it is already the practice in the source this document
   audits: every `*_COLOR` map found in `app/lib/*.ts` has a companion `*_LABEL` map
   (`FORCE_LABEL`, `CONTEXT_LABEL`, `LEVEL_LABEL`, `TENSION_LABEL`, `RELATION_LABEL`,
   `DIRECTION_LABEL`, `URGENCY_LABEL`, `IMPACT_LABEL`) — this Part only makes that
   existing practice an explicit, binding rule for future work, rather than an
   unstated convention.
2. **A `COLOR_STATE` must carry a secondary indicator wherever it can change a
   consequential decision** — matching Part XI: since state colors are computed and
   can change over time, a viewer must be able to tell *that* a state changed
   without relying on memorizing a prior hue (e.g. a trend arrow, a timestamp, or a
   delta value alongside a `TENSION_COLOR`/`RISK_BAND_COLOR` reading).
3. **Contrast and colorblind-safety status may be recorded as metadata on any future
   token**, but is **not computed or added to any existing table in this pass** —
   doing so was scoped as an `OPTIONAL_IMPROVEMENT` by the red-team, and this pass
   applies only what is required to close a documented gap. Flagged for explicit
   future follow-up: the red/orange/amber triad (`#ef4444`/`#fb923c`/`#fbbf24`) and
   the duplicate-green pair (`#22c55e`/`#34d399`, Q4) are both classic
   deuteranopia/protanopia confusion risks — noted here as a reason a future
   accessibility pass would be worth doing, not as a finding resolved now.

**Status of accessibility metadata for the existing palette: `UNRESOLVED`, in
full** — no contrast ratio or colorblind-safety value has been computed or recorded
for any `COLOR_ID` in this document. This is stated as an open gap, not filled with
invented numbers.

---

# PART XIV — MASTER TABLE GRANULARITY POLICY (correction pass, closes red-team
required correction)

Part VIII's Table 2 and Table 3 compress roughly 35 `COLOR_ID` rows into a smaller
set of representative rows with an explanatory footnote, rather than giving every
`COLOR_ID` its own row in every table. The red-team flagged this as a completeness
question. This Part closes it as an explicit, adopted **policy**, not an oversight:

- **Table 1** (Identity, Energy, Order) is the **authoritative, per-`COLOR_ID`**
  table — every `COLOR_ID` this document defines has exactly one row there, in full.
- **Table 2** (Domain roles) and **Table 3** (Relations, limits, provenance) are
  **representative-pattern** tables: one row per *family* (e.g. all seven Force
  colors share one relational shape, so `C-ID`'s row in Table 3 stands for
  `C-PHYSICAL`/`C-EGO`/`C-SOCIAL`/`C-EMOTIONAL`/`C-RATIONAL`/`C-SUPEREGO` as well,
  each of which independently resolves to the same pattern: `UNRESOLVED` across
  every `*_ROLE`/`*_PARALLEL` column except the one or two that are actually
  populated for that specific `COLOR_ID`).
- **This is now the stated rule, not an implicit shortcut:** a reader who needs
  family-member `X`'s exact Table-2/3 values reads `X`'s nearest cited sibling row
  and Table 1's entry for `X` together — both are authoritative, neither is padding.
  No `COLOR_ID`'s *actual* role was ever invented by this compression; it only
  avoided repeating `UNRESOLVED` at length (rule 6's spirit — don't fill a cell just
  to look complete — applies here at the *table* level as well as the cell level).

---

# PART XV — SECOND-PASS CLOSING AUDIT (correction pass, performed against the same
sources cited throughout, plus the newly added Parts X–XIV)

- **HEX unchanged:** every hex value appearing in Part X–XIV is a re-citation of a
  value already in Appendix A / Part VIII (v1.0) — no new numeric value was
  introduced anywhere in this pass. Confirmed by re-reading Appendix A against Parts
  X–XIV before finalizing this pass.
- **Contradictions preserved:** Q1–Q10 (Appendix Q) are unchanged in count and
  verdict; the one new Appendix P row cross-references the existing Q9 explicitly
  rather than opening a new contradiction — `CONTRADICTIONS_PRESERVED` count: still
  10, not 11.
- **Unresolved preserved or explicitly source-resolved:** no prior `UNRESOLVED` row
  was changed to any other status. New `UNRESOLVED` markers were added only where
  Part X's per-relation-type example field found no repo instance
  (`FUNCTIONAL_PARALLEL`, `CONTEXTUAL_LINK`, `PROJECT_LINK`) and where Part XIII
  states accessibility metadata does not exist — none of these were previously
  claimed to exist, so nothing was downgraded.
- **No `SAME_HEX → SAME_MEANING` inference:** checked explicitly; Part XII locks the
  opposite rule, and the new Appendix P row demonstrates the rule being applied
  (`#ef4444` shared by `C-ID`/`S-CRIT` is stated as `CONTRADICTION`/undocumented
  overlap, never as evidence the two are the same concept).
- **Identity and State are type-separated:** Part XI locks the definitions and
  the family-by-family table; every classification is marked `INFERRED`, not
  `SOURCE_BACKED`, since it is a reading of source structure rather than a literal
  statement — this avoids overclaiming the doctrine's own certainty.
- **All 8 relation types are defined or explicitly UNRESOLVED:** Part X defines all
  eight by name, scope, coloring rule, and prohibition; `CONTEXTUAL_LINK` and
  `PROJECT_LINK` have no repo-sourced *example*, correctly marked `UNRESOLVED` at the
  example level — the type definitions themselves are not left undefined.
- **No cross-domain analogy became identity:** re-checked every `PROPOSED`-tagged
  parallel in Part X and §20 — all remain `PROPOSED`/`ANALOGY`-adjacent; none is
  asserted as `SAME_MEANING`.
- **No unsupported mapping introduced:** Parts X–XIV add zero new color→concept
  pairings. Part XI's Identity/State table re-labels *existing, already-cited*
  families; it does not assign a color to any new entity (no new Value, Person,
  Canon-cell, Merlin-Domain, Human-Config category, or Music-Config category
  received a color in this pass).
- **Source citations still support every concrete mapping:** every file path and
  Appendix/§ cross-reference added in Parts X–XV was checked against the citations
  already established in Parts I–IX; no new file was read to produce this pass
  beyond re-reading this document itself.
- **Frozen systems:** zero files outside `PHILOS-COLOR-SYSTEM-MASTER.md` were read
  or written in this pass. No Merlin / voice-gateway / n8n / Day Opening / Agent-OS
  file was touched.
