"use server";

/**
 * Philos Canon — read-only orientation lookup for the /hub UI.
 *
 * Zero new canon semantics. This file adds NO orchestration, NO derivation,
 * and NO validation of its own — it is a thin wrapper around the exact same
 * three canonical functions `app/api/canon/observations/[canonEventId]/
 * orientation/route.ts` already calls (`canonEventStore`,
 * `runPhilosVerticalSlice`, `toMerlinOrientationHandoff` +
 * `firstUnsupportedTransition`), read verbatim from that file this pass,
 * neither reimplemented nor modified. The `stop_point` selection logic below
 * is copied 1:1 from that route so this lookup can never silently diverge
 * from what the real HTTP endpoint would report for the same id/asOf.
 *
 * Why a Server Action instead of calling the HTTP route: this runs
 * server-side already (Next.js Server Action), so it reaches the same
 * canonical functions via a plain in-process call — no self-fetch, no
 * `CANON_READ_TOKEN` needed here, no new HTTP surface. The route itself
 * remains the one authenticated, externally-reachable path; this is an
 * additional in-process caller of the same functions, not a second one.
 *
 * Beyond what the route returns, this also surfaces the raw per-stage
 * evidentiary envelope (`Transition.persisted_or_derived`,
 * `.claimed_or_verified`, `.canon_basis`, `.provenance`, or the skip
 * `reason` for an unattempted stage) for every one of the 9 §24 stages —
 * read verbatim off `PhilosVerticalSliceResult`, nothing computed or
 * relabeled. This is `/hub`'s first canon-aware read; it does not persist
 * anything and does not import anything from the legacy Value Group event
 * system (`../lib/philos/{events,eventStore}.ts`, `../lib/philos-event-store.ts`).
 */

import type { CanonEventStore } from "@/app/lib/philos/canon/canonEventStore";
import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { CellStateDerivationReason } from "@/app/lib/philos/canon/cellStateDerivation";
import {
  firstUnsupportedTransition,
  runPhilosVerticalSlice,
  type PersistedOrDerived,
  type ClaimedOrVerified,
  type PhilosVerticalSliceResult,
  type StageName,
  type StageSkipReason,
  type UnsupportedTransition,
} from "@/app/lib/philos/canon/verticalSlice";
import {
  toMerlinOrientationHandoff,
  type MerlinOrientationHandoff,
} from "@/app/lib/philos/canon/merlinHandoff";

/** Identical to the route's own `OrientationStopPoint` — see that file's
 *  header for why `cellState`'s own reason takes priority over the
 *  generic `firstUnsupportedTransition` proxy in exactly this one case. */
export type OrientationStopPoint =
  | UnsupportedTransition
  | { stage: "cellState"; reason: CellStateDerivationReason };

/** One row of the full 9-stage evidentiary trail — every field read
 *  verbatim off `PhilosVerticalSliceResult[stage]`, nothing invented. */
export type StageTrailRow =
  | { stage: StageName; attempted: false; reason: StageSkipReason }
  | {
      stage: StageName;
      attempted: true;
      persisted_or_derived: PersistedOrDerived;
      claimed_or_verified: ClaimedOrVerified;
      canon_basis: string;
      provenance: string;
    };

export type CanonOrientationLookupResult =
  | {
      ok: true;
      /** Exactly what the real orientation endpoint returns for this id/asOf. */
      handoff: (MerlinOrientationHandoff & { stop_point: OrientationStopPoint | null }) | null;
      /** Present only when `handoff` is null but the read itself succeeded —
       *  mirrors the route's own no-`current_state` fallback body. */
      fallback: {
        orientation_id: string;
        source_observation_id: string;
        constraints: string[];
        provenance: string[];
        verification_state: "not_applicable";
        stop_point: OrientationStopPoint | null;
      } | null;
      trail: StageTrailRow[];
    }
  | { ok: false; error: "not_found" | "invalid_as_of" | "read_failed" };

const STAGE_ORDER: readonly StageName[] = [
  "observation", "cellState", "need", "target", "offer",
  "matching", "transfer", "effect", "learning",
];

function buildTrail(result: PhilosVerticalSliceResult): StageTrailRow[] {
  return STAGE_ORDER.map((stage) => {
    const s = result[stage];
    return s.attempted
      ? {
          stage,
          attempted: true as const,
          persisted_or_derived: s.persisted_or_derived,
          claimed_or_verified: s.claimed_or_verified,
          canon_basis: s.canon_basis,
          provenance: s.provenance,
        }
      : { stage, attempted: false as const, reason: s.reason };
  });
}

/**
 * Read-only. Same auth-free, in-process shape as any other Server Action in
 * this file's directory — no `canon_event_id` is minted, no `asOf` is
 * defaulted; both are caller-supplied, unchanged from the route's own
 * "explicit input only" discipline.
 */
export async function lookupCanonOrientationAction(
  canonEventId: string,
  asOf: string,
  store: CanonEventStore = canonEventStore(),
): Promise<CanonOrientationLookupResult> {
  try {
    const result = await runPhilosVerticalSlice({
      store,
      canon_event_id: canonEventId,
      asOf,
    });

    if (!result.observation.attempted || result.observation.output === null) {
      return { ok: false, error: "not_found" };
    }

    if (
      result.cellState.attempted &&
      result.cellState.output.kind === "no_derivation" &&
      result.cellState.output.reason === "as_of_unparseable"
    ) {
      return { ok: false, error: "invalid_as_of" };
    }

    const orientation_id = `hub_lookup_${Date.now().toString(36)}`;
    const handoff = toMerlinOrientationHandoff(orientation_id, result);

    const stop_point: OrientationStopPoint | null =
      !handoff && result.cellState.attempted && result.cellState.output.kind === "no_derivation"
        ? { stage: "cellState", reason: result.cellState.output.reason }
        : firstUnsupportedTransition(result);

    const trail = buildTrail(result);

    if (handoff) {
      return { ok: true, handoff: { ...handoff, stop_point }, fallback: null, trail };
    }
    return {
      ok: true,
      handoff: null,
      fallback: {
        orientation_id,
        source_observation_id: canonEventId,
        constraints: [],
        provenance: [],
        verification_state: "not_applicable",
        stop_point,
      },
      trail,
    };
  } catch {
    return { ok: false, error: "read_failed" };
  }
}
