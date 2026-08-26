/**
 * Philos Canon — the Observation WRITE BOUNDARIES, and the only place a
 * `record_origin` is decided.
 *
 * WHY THIS MODULE IS NOT `"use server"`, AND WHY THAT IS THE WHOLE POINT.
 * `observationIngestion.ts` carries a `"use server"` directive, so every
 * async function it exports is registered as a Next.js Server Action and is
 * addressable by a crafted client request — not merely by code that imports
 * it. That exposure is harmless for a writer that grants nothing. It would be
 * a hole for a writer that grants `REAL`.
 *
 * So the origin-granting writers live HERE, in a plain server-side module
 * with no directive. `recordAuthenticatedObservation` is reachable only by
 * server code that imports it directly; there is no action id for a client to
 * post to. Combined with the fact that no public writer takes an origin
 * argument, this closes both spoof routes at once: a client cannot ASK for
 * `REAL` (no parameter accepts it) and cannot CALL the function that confers
 * it (no client-reachable reference exists).
 *
 * ONE APPEND PATH, UNCHANGED. Nothing here appends. Every function below
 * builds an envelope and hands it to `ingestObservation`, still the single
 * place `validateCanonEvent` and `store.append()` are called for an
 * Observation. This module adds write BOUNDARIES, not a second writer.
 */
import type { CanonEvent, CanonEventError } from "./canonEvent";
import { ingestObservation } from "./observationIngestion";
import type { Observation } from "./observation";
import type { RecordOrigin } from "../recordOrigin";

export type RecordObservationResult =
  | { ok: true; canon_event_id: string }
  | { ok: false; message: string };

/**
 * A one-line, human-readable description of a `CanonEventError`, flattening
 * the nested `Observation`-level errors (present only on the `payload`/
 * `"invalid"` variant) so a caller sees which Observation field actually
 * failed, not just "payload: invalid".
 */
function describeCanonEventError(e: CanonEventError): string {
  if (e.field === "payload" && e.reason === "invalid") {
    const inner = e.errors.map((ie) => `${ie.field}: ${ie.reason}`).join(", ");
    return `payload invalid (${inner})`;
  }
  return `${e.field}: ${e.reason}`;
}

/**
 * The one place a write boundary becomes a `record_origin` — deliberately NOT
 * exported. An origin cannot be requested; it is implied by which exported
 * function the caller was able to reach.
 *
 * A public `origin: RecordOrigin` parameter was considered and rejected: it
 * would leave the strongest claim in the system one argument away from any
 * caller, including one whose arguments came out of a request body. Making
 * the claim inseparable from the call site is what makes the claim mean
 * anything at all.
 */
async function writeObservationRecord(
  canon_event_id: string,
  observation: Observation,
  recorded_at: string,
  record_origin: RecordOrigin,
): Promise<RecordObservationResult> {
  const event: CanonEvent = {
    canon_event_id,
    canon_type: "observation",
    payload: observation,
    recorded_at,
    record_origin,
  };

  const result = await ingestObservation(event);

  if (result.ok) {
    return { ok: true, canon_event_id: result.canon_event_id };
  }
  if (result.reason === "invalid") {
    return {
      ok: false,
      message: `observation rejected: ${result.errors.map(describeCanonEventError).join("; ")}`,
    };
  }
  return {
    ok: false,
    message: `observation not appended: ${result.rejections.map((r) => r.message).join("; ")}`,
  };
}

/**
 * THE ONE WRITER THAT PRODUCES `record_origin: "REAL"`.
 *
 * It takes no origin argument, so `REAL` is not something a caller passes —
 * it is what calling this function means. `FormData`, request JSON and every
 * other client-shaped value are structurally incapable of selecting it,
 * because there is no parameter to put them in.
 *
 * A caller qualifies only if all of these hold. `observationFormAction.ts`
 * is currently the only one that does:
 *   - it runs server-side only, never in the browser;
 *   - `subject` is resolved server-side from the authenticated viewer and is
 *     never accepted from the client, so a forged subject is impossible;
 *   - the content is a person's own self-report through the real product form.
 *
 * Reaching the real store is NOT one of those conditions and never will be.
 */
export async function recordAuthenticatedObservation(
  canon_event_id: string,
  observation: Observation,
  recorded_at: string,
): Promise<RecordObservationResult> {
  return writeObservationRecord(canon_event_id, observation, recorded_at, "REAL");
}

/**
 * The general, unattributed writer — the sanctioned research/library surface
 * for the full canon field set. Signature unchanged from before this field
 * existed: explicit input only, no inference, no defaulting, no generated
 * identity.
 *
 * ORIGIN IS ALWAYS `UNKNOWN` HERE, and there is no argument to change that.
 * This function knows nothing about who its caller is, so the only honest
 * origin it can write is the one that vouches for nothing. `UNKNOWN` grants
 * nothing downstream, so an unattributed write can never be mistaken for a
 * person's own record.
 */
export async function recordObservationAction(
  canon_event_id: string,
  observation: Observation,
  recorded_at: string,
): Promise<RecordObservationResult> {
  return writeObservationRecord(canon_event_id, observation, recorded_at, "UNKNOWN");
}
