# Extraction Schema — knowledge-inventory artifacts

> **This is not a profile schema.**
> Personal Config schemas live under [`voice-gateway/profiles/`](../../voice-gateway/profiles/SCHEMA.md):
> `SCHEMA-V1.md` is the implemented one, `SCHEMA-V2.md` is the sole canonical v2
> design. Nothing in this document defines `person.yaml` or `music.yaml`.

This describes the shape of the **extraction artifacts** in this directory — what a
harvest agent returns, what the synthesis returns, and what the manifest records.
It exists so the files under `raw/` can be read months from now without the
workflow that produced them.

## Harvest result

One per folder agent. Four exist: `+אדם`, `+מוזיקה`, learning, `—קונפינג אישי—`.

```yaml
root: <absolute folder path>        # local; the reason raw/ is git-ignored
entries:
  - source_file: <absolute path>
    layer: <knowledge | config-music | bridge-shared | …>
    candidate_type: <knowledge | preference | personal_principle | fact>
    statement: <what the agent read out of the file>
    confidence: <high | medium | low>
    tags: [<free-form>]
needs_ocr:                          # top-level, NOT per entry
  - path: <absolute path>
    why: <why it is worth OCR>
```

**`needs_ocr` is a sibling of `entries`, not a field on them.** Counting OCR
candidates by scanning entries returns zero and looks like a clean result; the
real totals are 18 / 9 / 9 / 3 = **39**. See MANIFEST.md.

## Synthesis result

One object, produced by the synthesis agent from all four harvests.

```yaml
person_candidates:   [{statement, type, confidence, tags, sources[]}]
music_candidates:    [{statement, type, confidence, tags, sources[]}]
knowledge_index:     [{topic, summary, sources[]}]
bridge_concepts:     [{concept, why_shared}]
needs_ocr_priority:  [{path, why}]          # ranked subset of the harvests' 39
notes:               <str — method, dedup decisions, caveats>
stats:               {folders_processed, raw_entries_in, …}
```

**`stats` is narrative, not data.** In this run it reported
`needs_ocr_flagged_in_harvests: 29` against a true 39, and `raw_entries_in: 108`
against a true 109. Read the harvest files; treat `stats` as commentary.

`sources[]` entries are elided display strings (`…/folder/file.docx`), not
resolvable paths — they identify a document to a human, they do not locate it.

## Manifest

`raw/manifest.json` — machine-written during the backup:

```yaml
workflow_run_id: <wf_…>
synthesis_agent_id: <agent id>
source_project: <absolute path>     # local
backed_up_at: <ISO 8601 + offset>
method: <how the copy was made>
totals: {harvest_entries, ocr_flagged, ocr_ranked, ocr_processed}
excluded: [<what was deliberately not copied>]
files:
  - original_path / copied_path / size_bytes / modified / sha256 / note
```

[`MANIFEST.md`](MANIFEST.md) is the tracked, sanitized rendering: absolute paths
reduced to `$WORKFLOW_ROOT`, digests truncated. The JSON keeps the full values and
stays git-ignored.

## Why the raw layer is not tracked

A harvest `statement` **quotes its source**. The synthesis rewrites those quotes
into neutral leanings; the harvests do not. Together with ~284 absolute local
paths, that is why `raw/` is ignored and only the documents in this directory are
committed. See [README.md](README.md).

## Relationship to the profile schemas

Extraction output is **input to a human decision**, never a profile. A candidate
becomes a profile entry only by an explicit authoring step against
[`SCHEMA-V2.md`](../../voice-gateway/profiles/SCHEMA-V2.md) — and v2 has no loader
yet, so no candidate here can be loaded by anything today.

| | Extraction (here) | Personal Config (`profiles/`) |
|---|---|---|
| Produced by | a workflow agent | a human authoring decision |
| Field for the text | `statement` | `value` |
| Confidence | one `confidence` | `source_confidence` + `interpretation_confidence` |
| Source | elided display string | portable `sources` registry, no absolute paths |
| Lifecycle | none — a snapshot | `status`, `valid_*`, `verification_status` |
| Authority | none | the loader contract |
