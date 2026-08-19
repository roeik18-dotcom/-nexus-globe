# PHILOS/HUMAN Source Corpus

The real PHILOS/HUMAN theory corpus was found this pass: a Dropbox folder
(`+אדם/`, reached via a real macOS alias on the Desktop) that was never
inside this repository. It is **not a substitute** for anything already
built here (canon, the Nexus/Force ontology) — it is the original material
those systems were built from or alongside.

```
source-corpus/
├── README.md          ← you are here (tracked)
├── MANIFEST.json       full inventory: path, sha256, size, category,
│                        domain_candidate, duplicate_of — LOCAL ONLY, git-ignored
├── philos/              (empty this pass — see below)
├── human/                (empty this pass — see below)
└── archive/               (empty this pass — see below)
```

## What's real and what's pending

**Real, done this pass:**
- The corpus was located and its full extent inventoried: **2372 real files**
  (2385 seen, 13 `.git`/build-artifact files excluded), each with a real
  SHA-256 hash computed from actual file bytes.
- 208 exact-duplicate groups (598 files) identified by content hash, not
  filename — `duplicate_of` in the manifest points a duplicate at its
  canonical copy rather than creating a redundant registry entry for
  identical bytes.
- A small, genuinely-read sample (7 files — `L1`–`L5`, the weights model,
  the sub-components model, one contradiction-table fragment) was extracted
  with real quoted content — see `PHILOS-CORPUS-EXTRACTION-SAMPLE.md` (repo
  root). This is a **sample**, not full corpus coverage — stated exactly,
  not rounded up.

**Explicitly NOT done this pass, and why:**
- **No file content has been copied into `philos/`/`human/`/`archive/` yet.**
  The corpus contains deeply personal material (a private theoretical/
  psychological framework, personal notes) — the same category of
  sensitivity `docs/knowledge-inventory/README.md` already documents for a
  different personal archive in this repo ("political statements, family
  and loyalty framing... biographical detail"). Bulk-copying ~900 real
  philos-domain files (many of them large `.docx`/`.xlsx`/`.pdf`) into a
  git-tracked directory is a one-way action once committed and pushed — it
  deserves an explicit go-ahead on scope (which files, what stays local vs
  tracked) rather than a default "copy everything" from an automated pass.
- The 12 dedicated extraction passes requested (Reality/Space/Matter, Human,
  Self/World/Situation, Forces, L1–L6, Contradictions, Need/Capacity/
  Resource, Values, Individual↔Collective, Action/Effect, Color
  architecture) require reading hundreds of real documents in Hebrew — only
  the 7-file sample above has actually been read. Every other category is
  `NOT_YET_EXTRACTED` — real files exist, unread — not fabricated to look
  complete.

## Why the manifest is git-ignored, not tracked

Same reasoning as `docs/knowledge-inventory/raw/`: the manifest lists ~2372
real absolute local paths, many of them personal Hebrew filenames. A local
copy is what protects the material from loss (the source has no git remote
of its own for most of it); git history is permanent in a way `.gitignore`
is not, so the full manifest stays local-only. This README and the
extraction-sample document carry only what's safe to track.
