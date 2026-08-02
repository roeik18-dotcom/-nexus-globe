# Personal Config — Schema v2 (FROZEN)

*The **sole canonical Personal Config v2 specification.** Merged from
`MUSIC-SCHEMA-v2.md`, which is deleted in the same change; every section of it is
preserved below. Index: [`SCHEMA.md`](./SCHEMA.md). Implemented v1 spec:
[`SCHEMA-V1.md`](./SCHEMA-V1.md).*

*Scope: the field dictionary, enums, invariants, evidence model, privacy model and
loader contract apply to **every** Personal Config layer. The **three-tier identity
model (§10), its order bands (§11) and the `section` enum are a MUSIC
specialization** — music is where v2 is proven first, and §15 states that
`person.yaml` v2 does not begin until this model works end to end. A future layer
adds its own `section` values and bands; it does not fork this document.*

> **version: 2.0 · frozen date: 2026-08-02**
> Field meanings, enums, and invariants below are stable. **Semantic changes require a
> version bump to v2.1+** (a new dated freeze block). This document is the single
> canonical source for the Music profile schema; if code and this document disagree,
> this document is authoritative until a new freeze supersedes it.
>
> **Status: documentation only.** No loader implements v2 yet; no v2 profile has been
> written. See §14 (loader contract) and §15 (implementation sequence).

---

## 1. Frozen declaration
- **Name:** Personal Config — Music Schema v2
- **version:** 2.0
- **frozen date:** 2026-08-02
- **Change policy:** any change to a field meaning, enum value, or invariant → **v2.1+**.
  Additive-only clarifications that do not change behaviour may be noted without a bump.

## 2. Final file-level fields
```yaml
owner: roei                 # whose profile this is (ownership — see I1)
layer: music
schema_version: 2
note: <what this profile is and how to read it>
sources:                    # portable source registry — see §6 and I8
  <source_id>:
    storage_root: <logical key, e.g. dropbox>   # resolved EXTERNALLY, not here
    relative_path: <path under that root>
    source_kind: <rtf|docx|txt|md|textClipping|pdf|png|…>
    content_sha256: <hex|null>
entries: [ … ]              # list of per-entry records (§3)
```
`storage_roots` (the machine-specific absolute base paths) **live OUTSIDE profile data**,
in Merlin-local config — e.g. `{ dropbox: "/path/to/your/Dropbox" }`.
Moving machines changes only that external map, never the profile.

## 3. Final per-entry field dictionary
| Field | Kind | Meaning |
|---|---|---|
| `id` | str (kebab, unique) | stable entry id |
| `section` | enum | sub-structure (§10 tiers + branding/songwriting/styling/studio) |
| `type` | enum | kind of statement (§4) |
| `status` | enum | active · historical · archived (§9) |
| `value` | str | the statement (renamed from v1 `statement`) |
| `canonical_sources` | list | `[{source_id, evidence_ref, evidence_precision}]` (§7) |
| `source_confidence` | enum | reliability of the source (high/med/low) |
| `interpretation_confidence` | enum | certainty of our reading (high/med/low) |
| `privacy` | enum | handling class: private · sensitive (§8) — **not** a usage gate |
| `shareability` | enum | public_candidate · private_only |
| `redaction` | list | subset of `none · paraphrase · never_verbatim · never_aloud · external_models_blocked` (§8) |
| `valid_from` / `valid_until` | date\|null | identity/expression validity window (null by default) |
| `date_confidence` | enum | do we TRUST the date: unknown · dated (§9) |
| `date_precision` | enum | how EXACT the date is: exact · month · year · approximate · unknown (§9) |
| `domain_scope` | enum | life-domain (`music`) — replaces v1 `project_context` |
| `project_refs` | list | future project ids (`[]` for now) |
| `universality` | enum | claim scope: personal · domain · shared · universal |
| `philos_relevance` | enum | none · related · bridge_candidate · founder_candidate · accepted_core (§12) |
| `usage` | map | `{merlin_context, morning_brief, music_assistant, philos_core, public_profile}` (bool) — **the authorization mechanism** |
| `relations` | list | `[{type, target}]` typed within-domain links (§4 enum) |
| `cross_links` | list | `[{to, entry, relation}]` cross-domain forward refs |
| `order` | int | presentation / Context-Selector order (§11) — **not importance** |
| `created_at` / `updated_at` / `last_verified_at` | ts\|null | lifecycle; `last_verified_at` = re-check time, not identity start |
| `verification_status` | enum | unverified · self_confirmed · human_confirmed · source_confirmed · inferred · disputed · needs_review (§9) |

> **Removed from v1/earlier drafts:** per-entry `owner_scope` (I1), `project_context`
> (→ `domain_scope` + `project_refs`), the flat `confidence` (→ split), `usage.merlin` /
> `usage.founder_principle_candidate` (→ `usage{5}` + `universality`/`philos_relevance`).

## 4. Final enums
```text
section:          core_identity · legacy_expression · current_expression ·
                  branding · songwriting · styling · studio
type:             personal_principle · preference · creative_constraint ·
                  identity_trait · historical_pattern · fact
status:           active · historical · archived
privacy:          private · sensitive
shareability:     public_candidate · private_only
redaction:        none · paraphrase · never_verbatim · never_aloud · external_models_blocked   (list)
date_confidence:  unknown · dated
date_precision:   exact · month · year · approximate · unknown
domain_scope:     music
universality:     personal · domain · shared · universal
philos_relevance: none · related · bridge_candidate · founder_candidate · accepted_core
verification_status: unverified · self_confirmed · human_confirmed · source_confirmed · inferred · disputed · needs_review
evidence_precision:  document · section · paragraph · page · timestamp · ocr_pending
relations.type:   succeeds_as_primary_expression · derived_from · related_to · supersedes
*_confidence:     high · medium · low
source_kind:      rtf · docx · txt · md · textClipping · pdf · png · pptx · doc · …
```

## 5. Final invariants (I1–I18)
- **I1 — Ownership vs scope.** Ownership is file-level `owner`; claim scope is `universality`. No per-entry `owner_scope`.
- **I2 — Surface access.** A surface `S` may read an entry **iff `usage.S == true`.** `privacy` never gates local use.
- **I3 — Privacy → handling.** `privacy == sensitive` ⇒ `redaction` includes `external_models_blocked` (and logs are redacted). `public_profile` additionally requires `shareability == public_candidate` **and** `privacy != sensitive`.
- **I4 — Philos gate.** `usage.philos_core == true` ⇒ `philos_relevance == accepted_core`, reachable **only** by explicit human promotion.
- **I5 — Status routing.** `status: historical` ⇒ excluded from the *current* projection, **retained**; `archived` ⇒ excluded from both current and historical.
- **I6 — Dates conservative.** `valid_from`/`valid_until` are null by default; a non-null value requires `date_confidence: dated` **and** a supporting source.
- **I7 — Supersession honesty.** `relations.type == supersedes` only if the target's `status` becomes `archived` (true invalidation); a change of active expression uses `succeeds_as_primary_expression`.
- **I8 — Portable sources.** Every `canonical_sources[].source_id` resolves in file-level `sources`; every `sources[].storage_root` resolves in the **external** `storage_roots` map; **no absolute path appears in profile data.**
- **I9 — Identity & lifecycle.** `id` unique; `order` within its section band (§11); `last_verified_at`/`verification_status` are independent of `valid_*`.
- **I10 — Evidence nullability.** `evidence_ref == null` is allowed **only** when `evidence_precision ∈ {document, ocr_pending}`.
- **I11 — OCR pending.** `evidence_precision == ocr_pending` ⇒ `verification_status == needs_review`.
- **I12 — No precision inflation.** An entry that is `source_confirmed` at `evidence_precision: document` must **not** be presented/treated as paragraph-level evidence.
- **I13 — Hash integrity.** `content_sha256 != null` ⇒ the loader recomputes it and, on mismatch, **reports explicitly** (never silently proceeds).
- **I14 — Bridge default.** `philos_relevance` defaults to `none`/`related`; `bridge_candidate` and above require explicit human designation. **At freeze, the only bridge candidates are `music-core-tension-release` and `music-core-contrast`.**
- **I15 — Review exclusion.** `verification_status == needs_review` ⇒ the entry is a **candidate**: surfaced for review but **excluded from the canonical active/confirmed projection.**
- **I17 — Date precision is not evidence precision.** `date_precision` describes how
  exactly a date is known (`year` vs `exact`); `evidence_precision` describes how exactly a
  *source* was located (`document` vs `paragraph`). They are independent: a paragraph-level
  citation can still yield only a year. `date_precision != unknown` ⇒ `date_confidence:
  dated`; `date_confidence: unknown` ⇒ `date_precision: unknown` and both `valid_*` null.
  A date is never widened beyond its stated precision — an `approximate` date stays
  approximate; a `year` stays a year, never a fabricated exact day (§16.4).
- **I16 — Empty is an answer.** A profile that parses and validates but declares nothing
  is a real statement about the subject, not a failed read. Only a missing, unparsable or
  invalid file is an absence of information. (The `personal_config` collector already
  draws this line: it claims meaningful silence *only* when AVAILABLE and empty.)
- **I18 — Verification is second-party.** Only `human_confirmed` (another authorized human)
  and `source_confirmed` (traceable evidence) count as verified. `self_confirmed` records the
  owner re-affirming his own statement — **not** independent verification. An entry never
  verifies itself; `disputed` (checked and contested) is distinct from `unverified` (never
  checked), and a surface must never present `inferred`/`self_confirmed` as second-party-confirmed.

## 6. Portable source model
An entry never stores an absolute path. It references a `source_id` in the file-level
`sources` registry, where each source is `{storage_root, relative_path, source_kind,
content_sha256}`. `storage_root` is a **logical key** (e.g. `dropbox`) resolved by an
**external** `storage_roots` map held in Merlin-local config. Consequence: relocating the
archive or switching machines changes one external mapping, not the profile (I8). Absolute
path = `storage_roots[storage_root] + "/" + relative_path`.

## 7. Evidence model
Each `canonical_sources[]` item carries:
- `source_id` — which registry source.
- `evidence_ref` — pointer within it (e.g. `"artistic vision section"`), or `null`.
- `evidence_precision` — one of `document · section · paragraph · page · timestamp · ocr_pending`.

**Precision-honesty rules:** `evidence_ref` may be null only at `document`/`ocr_pending`
precision (I10); `ocr_pending` forces `verification_status: needs_review` (I11); a
`document`-precision `source_confirmed` claim must not be shown as paragraph-level (I12). This
keeps "we have the doc" distinct from "we located the exact paragraph."

## 8. Privacy, usage and redaction model
- **`usage` is authorization.** A surface reads iff its `usage` flag is true (I2). Surfaces:
  `merlin_context` (local reasoning), `morning_brief`, `music_assistant`, `philos_core`,
  `public_profile`.
- **`privacy` is a handling class**, not a usage gate: `private` (local only), `sensitive`
  (special handling). A `sensitive` item **may** still be `merlin_context: true` locally.
- **`redaction` is a policy LIST** that controls presentation and transmission — a subset of
  `none · paraphrase · never_verbatim · never_aloud · external_models_blocked`. Usage
  authorizes access; redaction constrains *how* an authorized surface may present or transmit
  the entry. Multiple policies may coexist. Meanings:
    - `none` — no restriction; **must not coexist with any other policy.**
    - `paraphrase` — may be conveyed only in paraphrase, never verbatim.
    - `never_verbatim` — verbatim output prohibited; paraphrase permitted.
    - `never_aloud` — TTS / spoken output prohibited (text only).
    - `external_models_blocked` — must not be sent to any external model.
  Default when absent: `[none]` (stated, so it is a decision, not an accident). `privacy:
  sensitive` ⇒ `redaction` includes `external_models_blocked` (and logs are redacted, I3);
  `public_profile` also needs `shareability: public_candidate` and `privacy != sensitive`.
  Example: a stage name may be `shareability: public_candidate` and still
  `redaction: [never_verbatim]` — known, but not announced until confirmed (§12, I14).

## 9. Lifecycle and verification model
- **`status`:** `active` (current), `historical` (retained for reference — the acoustic era),
  `archived` (removed from active *and* historical use). Historical ≠ archived (I5).
- **`verification_status`** — who (or what) has confirmed the claim:
    - `unverified` — not yet confirmed or evidenced (the honest default).
    - `self_confirmed` — confirmed by the profile owner (Roei). **Not** independent verification (I18).
    - `human_confirmed` — confirmed by another authorized human.
    - `source_confirmed` — directly supported by traceable evidence in the `sources` registry.
    - `inferred` — a derived interpretation, not directly confirmed.
    - `disputed` — conflicting evidence or explicit disagreement (first-class: checked-and-contested ≠ never-checked).
    - `needs_review` — a candidate awaiting a human; excluded from the canonical active projection (I15).
  Only `human_confirmed` and `source_confirmed` count as verified (I18). A surface must never
  present `inferred` or `self_confirmed` as though a second party had confirmed it.
- **Two independent date axes.** `date_confidence` answers *do we trust this date*;
  `date_precision` answers *how exactly it is known* (I17):
    - `exact` — a full date/time, or an exact date, as supported by the source.
    - `month` — month-level precision.
    - `year` — year-level precision.
    - `approximate` — an explicitly approximate date or range.
    - `unknown` — no reliable date precision (⇒ both `valid_*` null, `date_confidence: unknown`).
  "Known to be the acoustic era, year unknown" is `date_confidence: unknown`,
  `date_precision: unknown`, both `valid_*` null — the case the schema exists to express.
- **Timestamps:** `created_at`, `updated_at`, `last_verified_at` (re-check time; not the
  start of an identity).

## 10. Three-tier identity model
- **`core_identity`** — the invariant artistic essence (barely changes across eras):
  emotional depth, vocal truth ("black singing"), contrast, tension→release, listener-as-protagonist.
- **`legacy_expression`** — the acoustic era, `status: historical`, retained (acoustic guitar,
  slow tempo, long reverb, singer-songwriter form).
- **`current_expression`** — the active electronic era (Psytrance/Progressive+Breakbeat, BPM
  bands, electronic production, toolchain, tonal preference, energy/aesthetic, kick-centered,
  stage-name direction as a review candidate).
The Core survives genre change; only `*_expression` gains a new dated record when the mode shifts.

## 11. Locked order bands
`order` is presentation / Context-Selector order **only — not importance**:
- **core_identity:** 10–50
- **legacy_expression:** 60–90
- **current_expression:** 100–190
- **branding / songwriting / styling / studio:** 200+

## 12. Philos relevance rules
- Default `none`/`related`. `bridge_candidate`+ requires explicit human designation (I14).
- **At freeze, bridge candidates = `music-core-tension-release`, `music-core-contrast` only.**
  `music-core-emotional-depth` and `music-core-listener-protagonist` are at most `related`
  until a separate promotion decision.
- **No `accepted_core`** (and therefore no `usage.philos_core: true`) without explicit human
  promotion through the transition step (I4). Music identity never becomes a universal rule.

## 13. v1 → v2 migration mapping
| v1 | v2 |
|---|---|
| `statement` | `value` |
| `confidence` (observed/stated/personal/inferred) | `source_confidence` + `interpretation_confidence` (high/med/low) |
| `usage.merlin` | `usage.merlin_context` (+ `music_assistant`, `morning_brief`, `public_profile`) |
| `usage.founder_principle_candidate` | `philos_relevance` (none/related/bridge_candidate/…) |
| `usage.philos_core: false` | `usage.philos_core: false` (kept) + `philos_relevance != accepted_core` |
| — (explicit defaults, never inferred) | `section`, `status: active`, `universality`, `domain_scope`, `project_refs: []`, `redaction: [none]`, `date_confidence: unknown`, `date_precision: unknown`, `order`, `created_at`, `updated_at`, `last_verified_at`, `verification_status: unverified`, `relations: []`, `cross_links: []`, `evidence_precision` |
| absolute source strings | `sources` registry (`storage_root`+`relative_path`+`source_kind`+`content_sha256`) |
| `valid_until: "historical"` | `status: historical`, `valid_until: null` |
| **6 live v1 entries** | `artistic-identity` & `production-signature` split-retired; `vocal-and-writing`→songwriting, `show-and-styling`→styling, `brand`→branding, `studio-operating`→studio (all field-migrated) |

## 14. Loader compatibility contract
- **Dual-read v1 + v2.** The loader must accept both `schema_version: 1` and `2`.
- **v1 behavior unchanged.** Existing v1 profiles load exactly as today; no field renames applied to them.
- **v2 validated** against §3–§5 (dictionary, enums, invariants I1–I18).
- **v2-only fields are ABSENT on v1 entries, not defaulted.** A v1 entry's
  `verification_status` is `None`, never `unverified` — defaulting would make a v1 file
  look as though it answered a question it was never asked, which is the same class of
  error as inventing a date.
- **A v2 file today is refused, and says so.** Until dual-read ships, `SCHEMA_VERSION = 1`
  and a v2 file produces an explicit `unsupported version 2` error rather than a partial
  read. Refusing an unknown shape beats guessing at it.
- **Hash mismatch explicit** (I13): if `content_sha256` is present and disagrees, the loader
  reports the mismatch — it does not silently proceed and does not auto-correct.
- **No automatic profile rewrite.** The loader reads; it never writes, migrates-in-place, or
  edits profile files. Migration to v2 is a separate, reviewed, explicit write.

## 15. Exact implementation sequence
1. **Loader v2 dual-read** — extend the loader to read v1 + v2 per §14. Code only; no profile change.
2. **Migration / invariant tests** — red-first tests for I1–I18, the §13 mapping, the 6-entry disposition, evidence-precision rules, hash-mismatch reporting, `needs_review` projection-exclusion, and `order`-band enforcement.
3. **Full `music.yaml` review artifact** — the complete v2 file produced as a proposal (not written to the live path).
4. **User approval** — Roei approves/edits (esp. stage names, `ocr_pending` items, `identity_trait` scope).
5. **Local-only write** — write the approved `music.yaml` locally; the pre-commit guard keeps it local (never staged/committed).
6. **Projection verification** — loader → `personal_config` collector → Morning Snapshot: confirm current-vs-historical routing, `needs_review` exclusion, and that Merlin render obeys `usage`.

*`person.yaml` v2 is not begun until this model is proven end-to-end on music.*


---

## 16. Non-goals — explicit

Deliberately out of scope for v2. Each is a decision, not an omission.

1. **No automatic profile rewrite.** Nothing writes `person.yaml` or `music.yaml`.
   Migration emits a proposal for human review (§15.3–15.5); the loader reads only.
2. **No `person.yaml` migration yet.** v2 is proven on music first; the person profile
   stays on v1 until dual-read ships and the model is verified end to end (§15).
3. **No stage-name confirmation.** The stage name is not asserted, defaulted or inferred
   anywhere in v2. It is a `needs_review` candidate (I15) and requires explicit human
   confirmation before any surface states it — and `redaction: [never_aloud]` before Merlin
   says it aloud (§8).
4. **No invented dates.** `valid_from`/`valid_until` are null by default; a non-null value
   requires `date_confidence: dated` **and** a supporting source (I6). Nothing is widened
   to a full ISO date to satisfy a type.
5. **No Philos core promotion without human approval.** `usage.philos_core` stays `false`;
   `accepted_core` is reachable only by explicit human promotion (I4, §12). At freeze the
   only bridge candidates are `music-core-tension-release` and `music-core-contrast`.
6. **No loader v2 in this change.** This document is frozen design. Implementation is §15,
   and none of it has begun.
