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
| SHA-256 | `e8bf3148654d3dafb2063cc5b48442302184f5fbc9a89a6c1adfa1591b00259d` |
| Size | 64,047 bytes · 1,400 lines |
| Created | 2026-08-02T14:41:13+0300 |
| Last modified | 2026-08-02T18:35:50+0300 |
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
| `core_identity` | 4 | | `self_confirmed` | 4 |
| `legacy_expression` | 2 | | `needs_review` | 19 |
| `current_expression` | 7 | | | |
| `songwriting` | 3 | | **Status** | |
| `styling` | 2 | | `active` | 20 |
| `branding` | 2 | | `historical` | 3 |
| `studio` | 3 | | | |
| **Total** | **23** | | | |

- **Canonical active projection: 4 of 23** (§9.1 allowlist). The other 19 are
  withheld in the `needs_review` bucket, retained in full.
- **Verified under I18 (second-party): 0.** `source_confirmed` is used nowhere.
  The four `self_confirmed` entries are owner re-affirmation — admitted, not verified.
- Bridge candidates: exactly two, `music-core-contrast` and `music-core-tension-release` (I14).
- `usage.philos_core`: false on every entry (I4).
- Redaction: one entry carries `never_aloud` — `music-branding-stage-names` (§16.3).
- Decisions: 4 approved · 19 pending.

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
2. **It contains unconfirmed claims about a person.** 19 of 23 entries are
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

- **`review_artifact.revision` says `2`, and is stale.** The file's header documents
  REV 2, REV 3 and REV 4, and two further corrections were applied after REV 4 (the
  rows 06/07 rationale correction, and emptying `unresolved_sources[+אדם].supports`)
  without a header block. The revision counter was never bumped. Per-entry data is
  reliable; the revision field is not. `proposed_entries: 23` **is** correct and is
  checked against the measured entry count by the validation suite.

## Verifying a recovered copy

```sh
shasum -a 256 voice-gateway/profiles/music.v2-proposal.yaml
# expect: e8bf3148654d3dafb2063cc5b48442302184f5fbc9a89a6c1adfa1591b00259d
```

A mismatch means the file changed after this manifest was written — which is expected
as review proceeds and the 19 pending decisions are made. Update the digest here when
that happens; a stale hash reported as current is worse than no hash.

## What this manifest does not do

It is **not** a backup. It records that the artifact existed, what shape it had, and
whether a given copy is the same one. If the disk is lost, the artifact is lost — the
23 entries and six revisions of review would have to be rebuilt from the two extraction
artifacts, which are themselves untracked and local-only.
