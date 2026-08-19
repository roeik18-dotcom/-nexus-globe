# Contradiction Source Expansion — sanitized manifest (2026-08-19)

Two new `.textClipping` files were parsed as SOURCE MATERIAL. **Nothing here
was promoted to canon or to runtime detection.** The existing Source-24
taxonomy is untouched.

Raw extractions and the full item-level inventory live in
`docs/knowledge-inventory/raw/` and are **git-ignored** — they are personal
drafting notes, and the same discipline already applied to the rest of the
raw layer applies here. This file is the sanitized manifest: counts,
structure and findings, no verbatim personal content.

## Sources

| # | file | bytes | extracted chars | lines |
|---|---|---:|---:|---:|
| 1 | `ניגודים-לאסוף עוד מאיזור תעשיה ושיבוץ-------.textClipping` | 89,506 | 22,101 | 1,072 |
| 2 | `‏טבלת ניגודים אדם.textClipping` | 6,869 | 1,476 | 36 |

Extracted with `plistlib` — the same direct-read method the existing
"Pass 5" provenance already uses.

## Finding 1 — the separator is ambiguous, and that governs everything

| separator | occurrences | reliability |
|---|---:|---|
| `½` (mojibake of `↔`) | 13 | **reliable** — the source's real opposition marker |
| `=` | 561 | **AMBIGUOUS** |
| `↔` | 0 | — |

`=` marks *opposite of* in some lines and *associated with / equals* in
others. The source itself disambiguates only occasionally — e.g. it writes
"ההפך של אהבה זה שליטה" on one line and `אהבה=שליטה` on the next.

**Consequence:** every `=` candidate is `confidence: low` and
`review_required: true`. None may become a runtime detector on its own.

## Finding 2 — the source carries its OWN 5-class taxonomy

Stated explicitly (and duplicated) in file 1. This is standard linguistic
antonymy theory, and it is **the source's own structure, not one imposed**:

1. **ניגודי רצף / ניגודים יחסיים (אנטונימים)** — gradable antonyms, adjectives denoting a measurable property
2. **ניגודי כיוון** — directional, verbs of motion
3. **היפוך תפקידים** — role reversal / converses
4. **משלימים, הפכים מוחלטים** — complementaries, absolute opposites (binary partition)
5. **ניגוד עצמי** — auto-antonym, opposite meanings in one root

The worked examples the source gives for these classes are **unusable as
data**: the intra-pair separator was lost in extraction, so pairs arrive
concatenated (`גבוהנמוך` = גבוה + נמוך). Recorded, not guessed apart.

## Finding 3 — inventory

830 items, full provenance retained per item (`source_file`,
`source_excerpt_id`, `raw_wording`, poles, chain nodes, relation type,
status, confidence, review flag, duplicate-of, notes). **Raw wording is
never discarded.**

| relation_type | count |
|---|---:|
| NOTE_OR_PROSE | 344 |
| DUPLICATE | 232 |
| EQUALS_TWO_TERM_AMBIGUOUS | 199 |
| MULTI_POLE_CHAIN | 46 |
| PROSE_CONTAINING_SEPARATOR | 16 |
| EXPLICIT_BINARY_PAIR | 9 |

12 items carry replacement characters (corrupted extraction) and are flagged
`review_required`.

## Finding 4 — reconciliation against the existing Source-24

Deduped, pole-plausibility filtered (a "pole" longer than 28 chars is prose
containing a separator, not a pole):

| verdict | count |
|---|---:|
| NEW_SOURCE_CANDIDATE | 187 |
| MULTI_POLE_NOT_BINARY | 42 |
| PROSE_CONTAINING_SEPARATOR | 16 |
| EXPANSION_OF_EXISTING | 7 |
| EXACT_EXISTING | 2 |

Only **6** new candidates come from the reliable `½` separator, and one of
those six is corrupted. The other 182 rest on the ambiguous `=`.

`EXACT_EXISTING`: `ודאות↔ספק`, `יכולת איפוק אישית↔יכולת איפוק קבוצתית`.

**The existing 24 were not overwritten, extended, or re-graded.**

## Finding 5 — VALUE COMPOSITION: still UNRESOLVED

The question re-run against the new material: does any source state that a
Value is *composed of* multiple contradictions — poles, balance,
trade-offs, reinforcement?

**Zero supporting lines**, across both files, searching several phrasings
(ערך near מורכב/בנוי/נוצר/מכיל/צירוף/שילוב, and ניגוד near ערך).

`VALUE_COMPOSITION_STATUS = UNRESOLVED`. No weights invented, no
composition model built.

## Finding 6 — Person ↔ Group material

38 lines carry social vocabulary (קבוצה, קולקטיב, זולת, משא ומתן, לחץ
קבוצתי, תפקיד, השוואה). As *contradictions* the yield is small:

- `אישי = חברתי` — appears twice, on the ambiguous separator
- `יכולת איפוק אישית ↔ יכולת איפוק קבוצתית` — already in the 24 (`cn_restraint_scope`)
- `נתינה קוגנטיב למען קולקטיב ↔ לזהות ערך`
- `היפוך תפקידים` — one of the source's own 5 classes

The remainder is prose about limited resources, negotiation, group
pressure, role contribution and inter-group comparison.

Relevance to the L-spine: material bears on **L3** (close relations) and
**L4** (social structure). **L5** gains nothing here.

**It creates no membership and no group fact.** All of it is source-level
conceptual material.

## Finding 7 — colour relations

`COLOR_RELATION_STATUS = UNKNOWN`. No line in either file connects a
contradiction to a canonical colour role. Nothing assigned.

## Addendum (same day) — contextual triage of `=`

`=` stays **AMBIGUOUS_RELATION by default**. It was NOT read globally as
contradiction. Triage used only localized source evidence, never semantic
intuition.

| triage class | rows |
|---|---:|
| J. UNRESOLVED | 177 |
| C. ASSOCIATION_CHAIN | 41 |
| H. PROSE / NOTE | 10 |
| J. UNRESOLVED (SOURCE_CONFLICT) | 7 |
| A. CONTRADICTION_SUPPORTED_BY_CONTEXT | 4 |
| I. CORRUPTED | 2 |
| B. EQUIVALENCE_SUPPORTED_BY_CONTEXT | 2 |

**A self-correction worth recording.** A first triage pass put 181 rows in
class A on the grounds that they sat "inside a contradiction-titled source
block". That was an artifact, not evidence: the two contradiction headings
in file 1 span the entire document, so block membership discriminated
nothing. Re-run with a 25-line proximity window to a heading, class A drops
to **4**. Weak evidence that flatters the result is worse than none.

`ההפך של X הוא Y` followed by `X=Y` is recorded as **SOURCE_CONFLICT**, not
resolved: if `=` meant opposition the prose would be redundant, and if it
meant equality it contradicts the prose. 7 such rows.

### Review set: 187 rows -> 23 decisions

Rows are not the unit of review. The `=` lines fall into 23 contiguous
drafting regions, and `=` plausibly carries one meaning within a region.
One decision therefore resolves many rows — the largest region covers 109.

- 10 decisions cover 170 rows
- 12 are singletons
- sorted by information value: source conflicts first, then region size

The queue lives in `raw/review-queue-2026-08-19.json` (git-ignored) and
carries only: decision id, source location, rows covered, conflict count,
up to 3 sample relations, proposed classification, why unresolved.

### Promotion

Every item stays at **LEVEL 0 / LEVEL 1**. The 4 class-A rows reached
`LEVEL_1_SOURCE_CANDIDATE`; **nothing** reached
`SOURCE_REVIEWED_CONTRADICTION` or `RUNTIME_DETECTABLE_CONTRADICTION`.
`LINGUISTIC_CLASS = UNRESOLVED` on every row — the source's 5 classes are
preserved but unassigned, because its own worked examples lost their
intra-pair separators in extraction.

### MISSING_VALUE_COMPOSITION_RELATION

`VALUE_COMPOSITION_STATUS` remains **UNRESOLVED**, and the expanded
inventory was NOT used to fabricate it. To support `Contradiction(s) ->
Value` the source would have to state at least one of:

1. a named Value together with the specific contradictions it is composed of;
2. a rule of the form "a Value arises when poles A and B are held in
   tension / balanced / traded off";
3. a worked example naming a Value and >=2 contradictions with their roles
   (reinforcing, opposing, constraining);
4. a direction rule saying which pole a Value orients toward.

None of the four appears in either file. Until one does, any
contradiction->Value edge would be invented.

## What was NOT done

No chain collapsed into a pair · no 5↔24 mapping · no runtime detector
added from this material · no weights · no composition model · no L6 · no S
· no colour flow · no membership inferred.
