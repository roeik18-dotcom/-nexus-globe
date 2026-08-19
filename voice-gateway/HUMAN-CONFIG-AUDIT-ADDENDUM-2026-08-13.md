# Human Config (אדם+) — Audit Addendum, 2026-08-13

Scope: **Human Config domain only.** Extends `MERLIN_KNOWLEDGE_GAP_REPORT.md`
(2026-08-09, untracked, not superseded — read that first for the full
HUMAN+MUSIC+PHILOS picture) with live re-verification done today, new
regression-test coverage, and findings on the two shared files this domain
depends on but does not own.

**UPDATE (same day, second pass — shared-wiring handoff):** an ownership audit
found `app/domain_router.py` under active edit by another session today (a
Music-track cue addition dated 2026-08-13 was already present, and its line
count had grown since this document's first pass) — **not edited**, reported
BLOCKED_BY_OWNER. `app/master_config.py` showed no same-day activity and was
judged free. Of the two findings against it below:
- **Finding #2 (dedup by Canonical_ID) — applied and verified.** Safe, isolated
  change; full regression suite (267 tests across Human/Music/Day-Opening/
  isolation-relevant files) still green.
- **Finding #1 (Hebrew prefix-stripping) — attempted, found unsound, reverted.**
  The "strip one leading ו/ה/ב/ל/כ/מ/ש letter" fix originally proposed below
  was implemented and *empirically tested before being trusted* — it corrupts
  real Hebrew root words that happen to start with one of those letters as
  their first ROOT letter, not an attached prefix: `מוזיקה` ("music") →
  `וזיקה`, `מיקס` ("mix") → `יקס`, `שיר` ("song") → `יר`, `בית` ("house") →
  `ית`. Because the same corruption applies uniformly to both the query and
  the indexed master content, exact-substring scoring still coincidentally
  "worked" in casual testing — which is exactly why this is dangerous rather
  than merely wrong: it silently degrades match distinctiveness for **both**
  masters (undermining the "a distinctive word scores >0 in the master that
  contains it and 0 in the unrelated one" guarantee `master_probe_scores()`
  is built on) without failing loudly. **Reverted in full; `_tokens()` is
  back to its original, unmodified form.** The underlying gap (finding #1,
  original text below) is real and still open — it needs a proper Hebrew
  prefix/root disambiguation (e.g. a small allow-list of words where the
  first letter is genuinely a prefix, not a naive blanket strip), which is
  more than a "minimal shared-wiring diff" and is out of scope for this pass.
  The pinned known-gap regression test was **left unchanged** (still asserts
  the query stays GENERAL) — correctly, per "flip only if the fix is actually
  proven."

## Live re-verification (2026-08-13)

Re-ran the same checks the 2026-08-09 report made, against the current state:

| Check | 2026-08-09 | 2026-08-13 | Stable? |
|---|---|---|---|
| Resolved human master | `קונפינג-אדם-MASTER-PRODUCTION-2.1-TAXONOMY-AUDITED-PROGRESS.xlsx` | same file, same version | yes |
| Rows / resolved units | 1492 / 1329 | 1492 / 1329 | yes |
| Semantic_State RESOLVED / RETAINED_OPEN / EXPLICITLY_UNMAPPED | 1395 / 70 / 27 | 1395 / 70 / 27 | yes |
| `knowledge_source_status()["human_master"]` | LOADED, PRIMARY | LOADED, PRIMARY | yes |
| person.yaml (v1 fallback) | 14 entries, not used by route() | 14 entries, still not used by route() | yes |

No drift since the 2026-08-09 report. `human_master_path()`'s version-picking
regex (`MASTER-PRODUCTION-(\d+)\.(\d+)`) correctly selects 2.1 over the two
older copies still sitting in the same Dropbox folder (`עותק של
...MASTER-PRODUCTION-1.3-...xlsx`, `עותק 2 של ...MASTER-PRODUCTION-1.6-...xlsx`)
— substring match on `"MASTER-PRODUCTION"` is insensitive to the Hebrew
"עותק [N] של" ("copy [N] of") prefix, so version comparison alone decides it.
Verified live, not assumed.

## New findings (Human Config domain only)

### 1. Confirmed-still-open: Hebrew prefix tokenization blocks some valid HUMAN_CONFIG queries
`MERLIN_KNOWLEDGE_GAP_REPORT.md` §B flagged "מה המטרות והשאיפות שלי" (goals/
aspirations) falling through to GENERAL. Reproduced live today with root-cause
isolation:

- `master_config._tokens()` does not strip Hebrew prefix letters (ה/ו/ב/ל/כ/מ/ש).
- `"מטרות"` (bare noun) → probe score `{music_config: 0, human_config: 1}` →
  clear HUMAN winner.
- `"המטרות"` / `"והשאיפות"` (same words, with ה/ו prefixes attached) → tokens
  don't match the master's bare-form content at all, and the *other* generic
  token present in the query happens to score 1-1 across both masters → tie →
  `route()`'s zero-cue probe correctly refuses to guess (`_m != _h` check) and
  stays GENERAL.

This is now a pinned regression test:
`tests/test_human_config_e2e.py::test_known_gap_goal_aspiration_query_with_definite_article_stays_general`.
It asserts the *current* (undesirable) behavior on purpose, so a silent future
fix — or a silent future regression — is visible instead of invisible.

**Proposed fix (for the owner of `app/master_config.py` — shared with Music,
not edited here):** in `_tokens()`, strip a single leading prefix letter from
`ו/ה/ב/ל/כ/מ/ש` when the remaining token is ≥ 2 chars, before the stopword
filter. This is a HUMAN+MUSIC-shared tokenizer change (both masters read
through the same function), so it is out of Human-Config-only ownership scope
and is reported here rather than applied.

### 2. Minor: cross-duplicate content can appear twice in one retrieval
Live query `"תזכיר לי מי אני"` returned `retrieved_unit_ids` containing
`CAN-XDUP-0049` **twice** (two distinct `Atomic_ID` rows sharing one
`Canonical_ID`, tracked via the master's own `Duplicate_Group`/`Duplicate_Role`
columns — not a data-integrity bug, the master's audit trail is doing its job).
`master_config._query_master()` does not deduplicate the top-`limit` results by
`Canonical_ID`, so a duplicate pair can consume two of the six returned slots
with materially the same content. Token-budget/relevance issue, not a
correctness or isolation issue — no fabricated or cross-domain content
involved. **Proposed fix (owner of `app/master_config.py`):** dedupe `scored`
by `Canonical_ID` before slicing to `limit`, keeping the higher-scored row of
each duplicate pair. Not applied here (shared file).

### 3. Missing keyword cues for goals/values (independent of the tokenizer gap)
`domain_router._CUES[Domain.HUMAN_CONFIG]` has no explicit cue family for
מטרות/שאיפות/יעדים ("goals"/"aspirations"/"targets") even in bare form — those
route today only via the zero-cue content-probe fallback (confidence 0.5,
weaker signal), never via a direct keyword match (confidence up to 1.0).
**Proposed fix (owner of `app/domain_router.py`, shared — serves Music/Philos/
Studio/Runtime/Day-Opening too):** add `"מטרות", "שאיפות", "יעדים", "goals",
"aspirations"` to the `Domain.HUMAN_CONFIG` cue tuple, following the existing
pattern/comment style already used for the 2026-08-08 cue extensions in that
file. Not applied here (shared file, currently modified by another session per
`git status`).

### 4. Source-directory hygiene (informational, not a routing bug)
The same Dropbox folder as the canonical master (`קונפינג-אדם-מאגר-אב-שלד-היררכי/`)
also holds `PHILOS-HUMAN-CONFIG-MASTER-FULL-20260805.xlsx` (3.5 MB, different
schema: `MASTER_ALL`/`RTF_RAW`/`בקרת כיסוי`, no `Canonical_ID`/`Atomic_ID`
columns) and `PHILOS_HUMAN_CONFIG_DEEP_SCAN_PROGRESS_V2_2026-08-07.xlsx` (scan-
progress tracker, no `MASTER_UNITS` sheet at all). Neither matches
`human_master_path()`'s `"MASTER-PRODUCTION"` substring + version-regex filter,
so today they are correctly never selected as the runtime master — verified
live. Flagging only because both sit in the same directory the loader scans
every call, and a future looser filter change there would need to keep
excluding them. No code change proposed; this is Dropbox-side file hygiene,
outside repo ownership entirely.

## Domain isolation — verified live, both directions
- `route()` on HUMAN_CONFIG queries never returns a `MASTER_MUSIC.xlsx` or
  `PHILOS-ORCHESTRATION-LAYER.md` source path (checked against real retrieval,
  not mocks).
- `route()` on MUSIC_CONFIG / PHILOS queries never returns the human master path.
- `app.context_builder._domain_bucket("human_config") == "human_config"`,
  confirmed to correctly gate the `_emit_domain_audit` leak-scan branch that
  strips a Philos-marked narrative-layer leak from a human_config-bucket turn
  (this is the same mechanism that caught the real 2026-08-09
  `PHILOS_CONTEXT_CHARS == PERSONA_CONTEXT_CHARS` production bug documented in
  `context_builder.py`'s `_PHILOS_MARK` comment — now directly regression-tested
  for the human_config bucket specifically, independent of whether today's
  `for_session("merlin", ...)` call site happens to include narrative layers).
- `ContextBuilder.for_session("merlin", query="קונפיג האדם")` (the actual
  production call site) assembles a prompt containing no `MASTER_MUSIC` or
  `PHILOS-ORCHESTRATION-LAYER` reference.

## UNKNOWN handling — verified live
- Human master unreachable (`human_master_path()` → `None`): `route()` returns
  `sources[0].status == "UNKNOWN"`, `context_text == ""`,
  `fallback_reason` explicitly states the v1 `person.yaml` projection "is NOT
  the master and is not returned as authoritative" — the fallback stub is
  never silently substituted as if it were live master content.
- Human master present but unreadable (corrupt file): same UNKNOWN path, same
  guarantee.
- Classification confidence is a *classification* signal (keyword-cue
  strength), independent of retrieval outcome — a clear-cue query stays
  high-confidence even when the master then turns out to be unreachable; the
  actual "did we get real data" signal is `sources[].status` /
  `fallback_reason` / `context_text`, not `confidence`. (This was a wrong
  assumption in an early draft of the new test suite, caught by the test
  itself failing against real behavior — corrected before landing.)

## New test coverage added
`tests/test_human_config_e2e.py` (19 tests, all passing; run together with the
existing Human-Config-adjacent suites — 112 passed, 0 failed, 0 skipped in
this environment since the real Dropbox master is reachable here):
- `route()` against the **real live master** for 7 representative Hebrew +
  English queries (classification, non-empty retrieval, LOADED-only sources,
  provenance-tagged unit ids).
- General chit-chat confirmed to inject nothing.
- Provenance: every retrieved unit carries real `Canonical_ID`/`Source_ID`;
  a broad/unscored query returns a `representative` sample of real rows, never
  an invented summary.
- UNKNOWN handling: unreachable master, unreadable/corrupt master.
- Isolation both directions: HUMAN_CONFIG never returns Music/Philos source
  paths; Music/Philos never return the human master path.
- `_domain_bucket` mapping and `_emit_domain_audit` leak-scan/strip contract
  for the `human_config` bucket, including a clean-turn no-false-positive case.
- Full production path smoke test via `ContextBuilder.for_session("merlin", ...)`.
- Pinned regression for the open Hebrew-prefix tokenization gap (finding #1
  above), so a future fix or regression is visible instead of silent.

Tests that depend on the real Dropbox master `skip` (not fail, not
xfail-and-hide) when that file isn't reachable, so this suite stays meaningful
in any environment without asserting on synthetic data it doesn't have.

## What was touched, and what was deliberately not (second pass, same day)
- `app/master_config.py` — **finding #2 (dedup by Canonical_ID) applied.**
  Judged free of an active writer (no same-day mtime/content activity, unlike
  its sibling file below) and the change is isolated/low-risk; verified with
  the full regression run above. Finding #1 was attempted here too, found
  unsound on empirical testing, and fully reverted — see the UPDATE note at
  the top of this document.
- `app/domain_router.py` — **finding #3 NOT applied — BLOCKED_BY_OWNER.**
  Proven under active edit by another session today: a `# 2026-08-13
  DAW/production-terminology coverage gap` comment (a Music-track cue
  addition) was already present on this pass that wasn't there on the first
  pass hours earlier, and the file had grown by 17 lines in that window. Per
  [[track-isolation-discipline]] and today's git-stash near-miss noted in
  memory, this is a live concurrent-writer signal, not a stale artifact — not
  edited.
- `app/context_builder.py` — not touched; `modified` per `git status`
  (another session's in-flight work), and none of the three findings required
  changing it.
- `profiles/person.yaml` — read and re-confirmed accurate/non-conflicting
  against the live master's content but not modified; it is explicitly the
  "used ONLY if the HUMAN master is unreachable" fallback, already correctly
  subordinate to the master, and no factual error was found in it.
