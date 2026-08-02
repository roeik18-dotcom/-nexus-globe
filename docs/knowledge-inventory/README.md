# Knowledge Inventory

What exists in Roei's knowledge archive, what a workflow extracted from it, and
the schema those extractions are destined for.

```
docs/knowledge-inventory/
├── README.md                        ← you are here
├── KNOWLEDGE-INVENTORY.md           what exists · where · how much
├── KNOWLEDGE-EXTRACTION-REPORT.md   what the synthesis produced
├── MANIFEST.md                      provenance · hashes · agent ids
├── SCHEMA.md                        Personal Config v2
└── raw/                             LOCAL ONLY — git-ignored
    ├── .gitkeep
    └── BACKUP-README.md
```

| Document | Answers |
|---|---|
| [Inventory](KNOWLEDGE-INVENTORY.md) | What files exist, where, how much, and the domain map |
| [Extraction Report](KNOWLEDGE-EXTRACTION-REPORT.md) | Person / Music / Bridge candidates, OCR queue, decisions |
| [Manifest](MANIFEST.md) | Workflow and agent ids, SHA-256 digests, timestamps |
| [Schema](SCHEMA.md) | Personal Config v2 — fields, invariants, migration |
| `raw/` | The workflow's own output — **not in git** |

## Why `raw/` is local-only

The harvests and the journal **quote source material verbatim** — political
statements, family and loyalty framing, dating tactics, biographical detail —
across roughly 284 absolute local paths. The synthesis neutralises that content
into leanings; the raw layer does not.

A local backup and a git history are different needs, and only one of them is
permanent: a later `.gitignore` cannot remove what a commit already recorded. So
`raw/` is ignored at the directory level (`raw/*`, fail-closed — any future
harvest dropped there is ignored without a new rule) and the documents above
carry the parts that are safe to track.

The backup still does its job: it survives loss of the source project, which has
no git remote.

## Status

The extraction is **complete and unwritten**. Nothing here has been applied to
`person.yaml` or `music.yaml`.

Three things remain open, and all three are listed in the Extraction Report:

1. **39 OCR items, none processed.** The highest-value target is the full
   Morning-Trigger protocol — it specifies the `daily_opening` domain that
   Merlin's Morning Snapshot currently reports as `not_configured`.
2. **Schema v1 cannot express the candidates.** They need `status`,
   `valid_until`, `project_context` and `order` — hence [SCHEMA.md](SCHEMA.md).
3. **One resolved decision awaiting implementation:** the music identity split
   (current electronic expression, historical acoustic expression, shared
   artistic core). See SCHEMA.md §"Worked example".
