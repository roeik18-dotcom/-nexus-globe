# MANIFEST — Music Config v2 review artifact

Provenance for `music.v2-proposal.yaml`, which is **git-ignored and exists only on
this machine**. This document is tracked so that the artifact's existence, digest
and shape survive the loss of the disk — the content deliberately does not.

Same split as [`docs/knowledge-inventory/MANIFEST.md`](../../docs/knowledge-inventory/MANIFEST.md):
a tracked manifest describing an untracked artifact.

| | |
|---|---|
| Artifact | Music Config v2 review artifact (SCHEMA-V2 §15.4) |
| Local path | `voice-gateway/profiles/music.v2-proposal.yaml` |
| Profile schema version | **2** (`owner: roei`, `layer: music`) |
| Manifest schema | Personal Config — Schema v2, frozen v2.1 ([`SCHEMA-V2.md`](SCHEMA-V2.md)) |
| SHA-256 | `19009107de5ee704f66fc470b74d460cab6ebd4a15e10cfdde3ab6f51ad1b60a` |
| Size | 75,349 bytes · 1,575 lines |
| Artifact revision | **8** |
| Created | 2026-08-02T14:41:13+0300 |
| Last modified | 2026-08-02T20:30:59+0300 |
| Git status | **ignored** — `.gitignore:57` `voice-gateway/profiles/*.yaml` |
| Generator | Claude Code (Opus 5), interactive session, 2026-08-02 |
| Verification state | **review-only — nothing written to any live profile** |

## Structure

Two YAML documents in one file:

1. **The proposed `music.yaml`** — copy it out as-is and it is the file.
2. **The review ledger** — one decision row per entry, plus dispositions.

**23 entries · 6 sources in the registry**

| Section | Entries | | Verification | Entries |
|---|--:|---|---|--:|
| `core_identity` | 4 | | `self_confirmed` | 14 |
| `legacy_expression` | 2 | | `needs_review` | 9 |
| `current_expression` | 7 | | `source_confirmed` | 0 |
| `songwriting` | 2 | | | |
| `styling` | 2 | | **Status** | |
| `branding` | 2 | | `active` | 20 |
| `studio` | 4 | | `historical` | 3 |
| **Total** | **23** | | | |

Projection counts below are measured from the artifact, not counted by hand — but
**not** through `mos/personal_config.py`, which cannot read this file (see "Known
discrepancy"). They are computed by parsing it with `yaml.safe_load_all` and
applying the §9.1 allowlist and §5 status routing directly:

- **Canonical active projection: 13 of 23** (§9.1 allowlist).
- **Historical projection: 1** — `music-legacy-acoustic-production`.
- **Withheld: 9**, all `needs_review`; nothing archived, inferred or disputed.
- `self_confirmed` is 14 while canonical active is 13. The gap is the one
  historical entry: clearing §9.1 admits it to the HISTORICAL projection, never
  the current one. An entry must clear **both** axes to be projected as current.
- **Verified under I18 (second-party): 0.** `source_confirmed` is used nowhere —
  it needs an anchored `evidence_ref` plus `content_sha256`, which is the
  hash-anchoring milestone. All 14 are owner re-affirmation: admitted, not verified.
- Bridge candidates: exactly two, `music-core-contrast` and `music-core-tension-release` (I14).
- `usage.philos_core`: false on every entry (I4).
- Redaction: one entry carries `never_aloud` — `music-branding-stage-names` (§16.3).
- Decisions: 14 approved · 9 pending.

**How the 14 were approved.** Five carry an individually recorded owner act: the
four invariant-core entries named in `blocking_decision.resolution`, and
`music-legacy-acoustic-production`, whose basis separates the source (which
confirms the production characteristics) from the owner (who confirms the
historical framing the source never states). The other nine were authorized as a
block — `phase_1_block_approval` in the ledger, on the explicit instruction
"Approve the 9, then merge Batch E." That block records two acts deliberately
kept apart: an evidence review established readiness, and the user's instruction
supplied the authority. Checking a document is not owner re-affirmation (I18),
and an earlier wording that gave the review itself as the approval basis has been
replaced. No `verification_status` changed in that correction.

## Source inventory

**Inputs** — what the artifact was merged from. All three are themselves untracked.

| Input | SHA-256 | Bytes | Role |
|---|---|--:|---|
| `docs/knowledge-inventory/raw/harvest-music.json` | `2d503f56221ad966ec238573be922653442c1dd9836a7ce3171f0f399043f031` | 31,636 | 26 entries, `+מוזיקה` folder, agent `a6c7270f4e9b58b1a` |
| `docs/knowledge-inventory/raw/synthesis.json` | `b90d6597ccc80666d693198ec7c1d0b84629422ff255075ae78ec769e2f819c7` | 41,971 | 10 deduped music candidates, agent `a39e8b0d1e34de31f` |
| `voice-gateway/profiles/music.yaml` | `a3a17e7e853dc531f310d35f72c0a4ffca12db4b5328d1f67de62807714d4a21` | 2,744 | live v1 profile, 6 entries — **read only, not modified** |

**Source registry inside the artifact** — 6 portable sources, all `storage_root: dropbox`,
no absolute paths (I8). One carries a verified digest:

- `s_music_config_rtf` — `content_sha256: 51cfa2128678454b2e943b411c330ec893fd7896939d28bcdba75a09401832d4`
  (265,096 bytes; verified present and readable 2026-08-02). The `+אדם/אדם-קונפינג…rtf`
  is **byte-identical** to it — one document filed under two paths, not two sources.
- The remaining 5 have `content_sha256: null`. Hash anchoring is the Knowledge
  Extraction milestone, and I13 only applies once a hash exists.

**Still unresolved: 1 source.** `Dropbox/עמרי כהן…/שיעורי בית עמרי-2023-09-21 פרמידה
רפרנסים.txt`, supporting `music-studio-reference-practice` and `music-current-genre`.
No path was invented for it — an invented `relative_path` would break I8 by producing
a `source_id` that resolves to nothing.

## Disposition coverage

All 26 harvest entries are accounted for; none silently dropped.

| Bucket | Harvest entries |
|---|---|
| Proposed into this profile | H1 H2 H3 H4 H5 H8 H26 |
| Music knowledge, not personal config | H9 H10 H11 H12 H13 H14 |
| Bridge / shared with Philos | H15 H16 H19 |
| Person config, not music | H17 H20 H21 |
| Lyric intake & projects | H18 H22 H23 H24 H25 |
| Deferred to shared intake (Geyser) | H7 |
| Merged duplicate | H6 → `music-current-genre` |

All 6 live v1 entries dispositioned per SCHEMA-V2 §13. OCR queue: 3 items, deferred.

## Provenance

- Implements SCHEMA-V2 **§15.4** — "the complete v2 file produced as a proposal
  (not written to the live path)".
- Merged 2026-08-02 from the two extraction artifacts above plus the live v1 profile.
- Blocking decision (`two-identity-generations`) **resolved by explicit user decision**:
  the acoustic era is historical; the invariant core is emotional depth, vocal truth,
  contrast, tension→release. No transition date was invented — every `valid_from` /
  `valid_until` is null.
- One recorded divergence from the frozen schema: `music-core-listener-protagonist`
  was moved out of `core_identity` by user decision, while §10 names it as core. The
  divergence is written into the artifact rather than silently applied.

## Why the content is not in git

`music.v2-proposal.yaml` is a **proposed personal profile**. It carries the same class
of material `.gitignore` already keeps local for `person.yaml` and `music.yaml`:
biographical and identity detail, stage-name candidates, and evidence pointers into a
private archive. A later `.gitignore` change cannot remove what a commit has already
recorded, so the content stays out of history permanently.

The reasons are specific, not habitual:

1. **It is profile data, not code.** `.gitignore:57` excludes
   `voice-gateway/profiles/*.yaml` precisely so real profile data never enters
   history. This file is that data in proposal form; exempting it would defeat the
   rule at the exact moment the rule matters.
2. **It contains unconfirmed claims about a person.** 9 of 23 entries are
   `needs_review`. Committing them would publish, permanently, statements that have
   not been confirmed and some of which may be wrong.
3. **One entry is marked `never_aloud`.** The stage-name candidates are withheld from
   every surface until a name is confirmed (§16.3). Committing them would put in
   history what the schema forbids a surface from even speaking.
4. **A manifest is sufficient for the risk it addresses.** The danger is silent loss —
   not knowing the artifact existed or whether a recovered copy is intact. A tracked
   digest solves both without publishing a byte of the content.

## Known discrepancy in the artifact

Recorded because it reads as data but is not, in the same spirit as
`docs/knowledge-inventory/MANIFEST.md`'s "Known errors" section:

- **`review_artifact.revision` was `2` while the file had reached `8`. Corrected.**
  The counter was not bumped as work landed. It now reads 8, the highest revision
  the file actually references, and every count beside it is measured from the
  artifact rather than maintained by hand — see the loader note below for how.
- **Revisions 5 and 6 are undocumented.** REV headers exist for 2, 3 and 4; ledger
  rows reference rev 7 and rev 8. Nothing in the file records what 5 and 6 changed.
  Left as a gap rather than reconstructed after the fact — inventing a history is
  the error this document exists to prevent.
- **No validation suite exists.** An earlier version of this manifest said
  `proposed_entries` was "checked against the measured entry count by the
  validation suite". There is no such suite in `voice-gateway/tests/` or
  `voice-gateway/tools/`. Nothing re-checks these counts automatically, so they go
  stale silently the moment the artifact changes.
- **The real loader cannot read this artifact.** Verified 2026-08-02:
  `personal_config.load_file()` on `music.v2-proposal.yaml` returns
  `schema_version: None`, **0 entries**, and one error —
  `malformed YAML: ComposerError`. The cause is structural: this file is a TWO-document
  YAML (the proposed profile, then the review ledger), and the loader calls
  single-document `yaml.safe_load`, which raises *"expected a single document in the
  stream"*. An earlier version of this manifest claimed the counts were "measured by
  loading the artifact through the real loader" and that projection counts were
  "measured through `mos/personal_config.py`". That was not what happened and is not
  reproducible — following it yields zero entries. The figures are correct; they were
  obtained with `yaml.safe_load_all` plus the §9.1 and §5 rules applied directly, and
  the claim has been corrected to say so.
  Consequence worth naming: **§15.7 cannot be run against this file as it stands.**
  Proving the model end to end needs the single-document profile extracted first, which
  is exactly what §15.6 does — write the approved doc-1 to the live path.

## Verifying a recovered copy

```sh
shasum -a 256 voice-gateway/profiles/music.v2-proposal.yaml
# expect: 19009107de5ee704f66fc470b74d460cab6ebd4a15e10cfdde3ab6f51ad1b60a
```

A mismatch means the file changed after this manifest was written — which is expected
as review proceeds and the 9 remaining pending decisions are made. Update the digest
here when that happens; a stale hash reported as current is worse than no hash. This
manifest has already gone stale once — it recorded 4 approved / 19 pending and a digest
two revisions behind, while the artifact had moved to 14 / 9.

## What this manifest does not do

It is **not** a backup. It records that the artifact existed, what shape it had, and
whether a given copy is the same one. If the disk is lost, the artifact is lost — the
23 entries and eight revisions of review would have to be rebuilt from the two extraction
artifacts, which are themselves untracked and local-only.
