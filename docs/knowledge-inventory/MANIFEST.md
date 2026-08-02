# MANIFEST — knowledge extraction `wf_eb14b648-55d`

Provenance for the raw backup under `raw/` (local-only, git-ignored). Absolute
local paths are reduced to `$WORKFLOW_ROOT`; the full paths exist only in
`raw/manifest.json`, which is not tracked.

| | |
|---|---|
| Workflow run id | `wf_eb14b648-55d` |
| Synthesis agent id | `a39e8b0d1e34de31f` |
| Source project | `$WORKFLOW_ROOT` = `~/.claude/projects/-Users-roei-cluod-code/81ccc8fc-…` |
| Backed up at | 2026-08-02T09:54:45+03:00 |
| Method | copy (shutil.copy2 / extracted from journal) — no source file moved or altered |

`$WORKFLOW_ROOT` has **no git remote** — that single-disk risk is why the backup exists.

## Harvest agents

| Agent | Folder | Entries | OCR flagged |
|---|---|--:|--:|
| `ae88e3e14696b30eb` | learning (Rimon · Pluto · Keshet · Omri Cohen) | 23 | 18 |
| `a21fa39ee63d43668` | `+אדם` | 27 | 9 |
| `a2022499b7668213f` | `—קונפינג אישי—` | 33 | 9 |
| `a6c7270f4e9b58b1a` | `+מוזיקה` | 26 | 3 |
| `a39e8b0d1e34de31f` | **synthesis** | — | 15 ranked |
| | | **109** | **39** |

## Files

| File | Bytes | SHA-256 | Modified | Origin |
|---|--:|---|---|---|
| `journal.jsonl` | 158,865 | `7e04da75adaf7f44…` | 2026-08-02T00:06:15 | workflow journal — all agent results |
| `workflow-script.js` | 8,063 | `89c0dd2ae7c527dd…` | 2026-08-01T22:47:56 | workflow script — reproducibility record |
| `harvest-learning.json` | 26,058 | `1f00779300d94cb7…` | 2026-08-02T09:54:45 | harvest: learning folders (23 entries, 18 OCR) |
| `harvest-adam.json` | 37,313 | `ccbeef8dff6b5a3d…` | 2026-08-02T09:54:45 | harvest: +אדם (27 entries, 9 OCR) |
| `harvest-other.json` | 43,259 | `48cbb79f2bb917cd…` | 2026-08-02T09:54:45 | harvest: —קונפינג אישי— (33 entries, 9 OCR) |
| `harvest-music.json` | 31,636 | `2d503f56221ad966…` | 2026-08-02T09:54:45 | harvest: +מוזיקה (26 entries, 3 OCR) |
| `synthesis.json` | 41,971 | `b90d6597ccc80666…` | 2026-08-02T09:54:45 | synthesis result |
| `KNOWLEDGE-EXTRACTION-REPORT.md` | 3,317 | `d5c5d3db5a97e891…` | 2026-08-02T09:55:09 | human-readable summary of the run |

Full 64-char digests are in `raw/manifest.json`.

## Known errors in the synthesis `stats` block

Recorded because the block reads as data but is not:

- `needs_ocr_flagged_in_harvests: 29` — the true sum is **39** (18+9+9+3). Under-counts by 10.
- `raw_entries_in: 108` — the harvests contain **109**.

Per-harvest figures are reliable; the synthesizer's own totals are not.

## Exclusions

Never copied and never tracked: `person.yaml`, `music.yaml`, any private profile data.
The raw harvests and journal quote source material verbatim and are git-ignored;
see `raw/BACKUP-README.md`.
