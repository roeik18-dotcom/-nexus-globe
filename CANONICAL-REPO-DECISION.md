# Canonical repo decision (evidence-based, 2026-08-01)

Four "nexus/philos" trees exist locally. Fresh evidence resolves which is canonical.

| Repo | Commits | Last | Remote | Branch | Contains |
|---|--:|---|---|---|---|
| **`~/-nexus-globe`** (dash) | **368** | **2026-08-01** | `github.com/roeik18-dotcom/-nexus-globe.git` | `claude/orientation-dimensions-model-ku26yg` (3 unpushed) | **voice-gateway (Merlin) · app/lib/philos · app/hub · mos** |
| `~/nexus-globe` (no dash) | 126 | 2026-06-19 | **same remote** `-nexus-globe.git` | `feat/opm-energy-flow-map` (1 unpushed) | (none of the key dirs) |
| `~/cluod code` | 23 | 2026-07-30 | **none** (local only) | main | `src/nexus/` engine · MASTER-CHECKPOINT.md · PROJECT-STATE.md |
| `~/philos-orchestrator` | — | — | no `.git` | — | early scaffold, 32 files |

## Decisions
1. **Canonical monorepo = `~/-nexus-globe` (dash).** All active work lives here: Merlin
   voice-gateway, the event-sourced Philos hub (`/hub`), the MOS personal-config
   foundation, today's commits, and the only remote-backed history. **Serve the hub from
   here** (`philos` launch config → port 3000). This is the source of truth.

2. **Retire `~/nexus-globe` (no dash).** It is **not a separate project** — it is a stale
   *second checkout of the same GitHub repo*, stuck on a June branch. It caused the
   Hub-URL confusion (its stray dev server held :3010 with no `/hub`). Action: confirm its
   1 unpushed commit is not needed, then stop its server and archive/remove the working
   copy. Keep only `~/-nexus-globe`.

3. **Keep `~/cluod code` as the Nexus engine-of-record** (`src/nexus/`). Distinct concern
   (pure engine/algorithm layer, per [[nexus-repos]]). ⚠ It has **no remote and unpushed
   local history** — give it a backup/remote so the engine of record is not a single-disk
   risk.

4. **Archive `~/philos-orchestrator`** — early scaffold, no git, negligible.

## Notes
- `~/-nexus-globe` is on branch `claude/orientation-dimensions-model-ku26yg`, not `main`;
  the staged guard/profile-scaffold changeset is here, uncommitted.
- Both nexus-globe trees share the one remote — so "which is canonical" is really "which
  working copy": the dash tree (current) over the no-dash tree (June).

*Analysis only — no repo was deleted, merged, or pushed.*
