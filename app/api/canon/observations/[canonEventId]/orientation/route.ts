/**
 * Philos Canon — the ONE authenticated, read-only Merlin-orientation HTTP
 * endpoint (Merlin × Philos vertical slice #1, Phase 4).
 *
 * `authenticated request → load persisted Observation → runPhilosVerticalSlice
 * → toMerlinOrientationHandoff → typed JSON response`. This file adds NO
 * second orchestration path: it is a thin HTTP wrapper around the ONE
 * canonical orchestrator (`verticalSlice.ts::runPhilosVerticalSlice`) and the
 * ONE canonical adapter (`merlinHandoff.ts::toMerlinOrientationHandoff`,
 * `firstUnsupportedTransition`) — both read verbatim, neither reimplemented,
 * neither modified by this pass.
 *
 * **Input is deliberately minimal — `canon_event_id` (path) + `asOf` (query),
 * nothing else.** Per this pass's own instruction ("prefer canon_event_id /
 * orientation input identifiers over accepting full synthetic state from the
 * caller"): `Observation` is the ONLY canon primitive this repository
 * persists (`PERSISTENCE_POLICY.md`) — there is no store to look up an
 * existing `Need`/`Target`/`Offer`/`Transfer`/`Effect` by id from, so this
 * endpoint has nothing to accept for those stages even if it wanted to. It
 * therefore calls `runPhilosVerticalSlice` with `need`/`target`/`offer`/
 * `matchAttempt`/`transfer`/`effect`/`learning` all omitted — those stages
 * come back `attempted: false` by the orchestrator's own existing logic
 * (unchanged), and `firstUnsupportedTransition` reports exactly where that
 * happens as `stop_point` in the response. This is not this endpoint being
 * incomplete; it is the honest, current shape of "the maximum canon-supported
 * orientation reachable from an id alone."
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset (fail closed)
 *   400  `asOf` query param missing or unparseable/no explicit offset
 *   404  no canon event with this `canon_event_id` exists
 *   200  body is `OrientationEndpointResponse` (below) — includes a
 *        successful `current_state`-bearing orientation OR a controlled,
 *        `current_state`-absent response with `stop_point` explaining why
 *        (e.g. the Observation expired as of `asOf`); both are 200, since
 *        the READ itself succeeded either way — never conflated with a 4xx.
 *   500  unexpected store failure (e.g. corrupt log)
 *
 * **Same separate read credential as the sibling routes**
 * (`../route.ts`, `../cell-state/route.ts`): `CANON_READ_TOKEN`, checked
 * independently, fail-closed, same constant-time-comparison shape —
 * duplicated inline rather than shared, matching this directory's existing
 * per-route auth convention. This endpoint accepts no other credential, tool
 * name, or approval flag of any kind from the caller (`NO_TOOL_OR_APPROVAL_
 * FIELDS`) — there is nothing in the request body to accept, because this is
 * a `GET` with no body at all.
 *
 * **Response shape, exactly `MerlinOrientationHandoff` plus one field.**
 * `stop_point` is the only addition this endpoint makes beyond what
 * `merlinHandoff.ts` already produces — computed by `firstUnsupportedTransition`
 * (`verticalSlice.ts`), itself pure introspection over the orchestrator's own
 * result, not a new derivation. When `toMerlinOrientationHandoff` returns
 * `null` (no `CellState` derivable — e.g. expired/zero-confidence Observation),
 * this route does NOT fabricate the missing fields: the response falls back to
 * `{ orientation_id, source_observation_id, constraints: [], provenance: [],
 * verification_state: "not_applicable", stop_point }` — omitting
 * `current_state`/`open_need`/`target`/`candidate_action` entirely, exactly as
 * `merlinHandoff.ts`'s own "never fabricate a handoff Philos never actually
 * derived" discipline requires.
 *
 * **Zero writes, by construction.** This file's only I/O is the one read
 * inside `runPhilosVerticalSlice` (`store.load()`, unchanged, already proven
 * side-effect-free by `verticalSlice.test.ts`'s own `NO_EXECUTION` suite).
 * Nothing here calls `.append()` on any store, mutates the legacy Philos
 * event log, calls n8n, calls a Merlin tool, or creates an approval — none of
 * those concepts are imported, referenced, or reachable from this file.
 *
 * **Scope boundaries, held exactly:** no CellState/Need/Target/Offer/Action/
 * Transfer/Effect/Learning persistence added (still none — Observation
 * remains the only persisted primitive). No Tension/Deficit inference, no
 * ranking/scoring/optimization. No legacy event store import. No Merlin
 * Action Registry reference — see `verticalSlice.ts`'s own header for that
 * boundary statement, inherited here unchanged.
 */

import { randomUUID, timingSafeEqual } from "node:crypto";

import { canonEventStore } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import type { CellStateDerivationReason } from "@/app/lib/philos/canon/cellStateDerivation";
import {
  firstUnsupportedTransition,
  runPhilosVerticalSlice,
  type UnsupportedTransition,
} from "@/app/lib/philos/canon/verticalSlice";
import {
  toMerlinOrientationHandoff,
  type MerlinOrientationHandoff,
} from "@/app/lib/philos/canon/merlinHandoff";

/**
 * `firstUnsupportedTransition` reports the first stage in the whole 9-stage
 * chain that was never ATTEMPTED (by design — see `verticalSlice.ts`'s own
 * docstring: an attempted-but-gated-closed stage, like an expired
 * Observation's CellState, is deliberately not reported there, since that
 * fact already lives on the stage's own `output`). For THIS endpoint,
 * `need` is always `not_supplied` (no Need can be looked up by id — canon
 * persists only Observation), so `firstUnsupportedTransition` alone would
 * report `{stage:"need", reason:"not_supplied"}` even when the REAL reason
 * `current_state` is missing is that CellState derivation itself failed
 * (e.g. the Observation expired) — a misleading proxy for what the caller
 * actually needs to know. When that's the case, this route reports the
 * CellState stage's own real reason instead — reading it verbatim off the
 * already-computed result, adding no new derivation.
 */
export type OrientationStopPoint =
  | UnsupportedTransition
  | { stage: "cellState"; reason: CellStateDerivationReason };

/** `MerlinOrientationHandoff` plus this endpoint's one addition. See module header. */
export type OrientationEndpointResponse = MerlinOrientationHandoff & {
  stop_point: OrientationStopPoint | null;
};

/** Constant-time bearer check. Fails closed when the secret is not configured. */
function authorized(request: Request): boolean {
  const expected = process.env.CANON_READ_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = Buffer.from(header.slice(prefix.length));
  const secret = Buffer.from(expected);
  if (presented.length !== secret.length) return false;
  return timingSafeEqual(presented, secret);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export async function GET(
  request: Request,
  ctx: { params: Promise<{ canonEventId: string }> },
): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const { canonEventId } = await ctx.params;
  const asOf = new URL(request.url).searchParams.get("asOf");

  try {
    const result = await runPhilosVerticalSlice({
      store: canonEventStore(),
      canon_event_id: canonEventId,
      asOf: asOf ?? "",
    });

    if (!result.observation.attempted || result.observation.output === null) {
      return json({ error: "not_found" }, 404);
    }

    if (
      result.cellState.attempted &&
      result.cellState.output.kind === "no_derivation" &&
      result.cellState.output.reason === "as_of_unparseable"
    ) {
      return json(
        { error: "invalid_as_of", detail: "asOf must be an ISO 8601 instant with an explicit offset" },
        400,
      );
    }

    const orientation_id = randomUUID();
    const handoff = toMerlinOrientationHandoff(orientation_id, result);

    const stop_point: OrientationStopPoint | null =
      !handoff && result.cellState.attempted && result.cellState.output.kind === "no_derivation"
        ? { stage: "cellState", reason: result.cellState.output.reason }
        : firstUnsupportedTransition(result);

    const body: OrientationEndpointResponse = handoff
      ? { ...handoff, stop_point }
      : {
          orientation_id,
          source_observation_id: canonEventId,
          constraints: [],
          provenance: [],
          verification_state: "not_applicable",
          stop_point,
        };

    return json(body, 200);
  } catch {
    // Never leak internals (e.g. filesystem paths) to the caller.
    return json({ error: "read_failed" }, 500);
  }
}
