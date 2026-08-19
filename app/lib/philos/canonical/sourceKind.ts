/**
 * PHILOS Canonical layer — SOURCE_KIND: the one provenance vocabulary every
 * runtime dataset this layer touches must expose (Phase 4 instruction §3/§9).
 *
 * `CANON` — read from a frozen `*.master.json` Source Lock
 * (`canonical/data/*.master.json`), produced by an already-completed audit;
 * never regenerated or hand-edited by runtime code.
 * `LEGACY` — the pre-existing event-sourced Philos log (`philos-event-store`,
 * canon `Observation`s) — real, persisted, but not part of this Phase 4
 * canonical corpus.
 * `DEMO` — fixtures such as `demoMusicDomain.ts` — illustrative only, never a
 * real subject's actual state.
 * `STATIC` — fixed reference data with no subject scope at all (e.g. design
 * tokens) — not a claim about anyone, not a measurement.
 *
 * Every function in `canonical/` that returns data for display tags it with
 * exactly one of these — never silently presented as CANON when it is not
 * (Phase 4 acceptance: "Never present DEMO/STATIC as canonical").
 */
export const SOURCE_KINDS = ["CANON", "LEGACY", "DEMO", "STATIC"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
