/**
 * DAY EVENTS — the two human acts of an operational day, typed and validated.
 *
 * ONLY TWO ACTS ARE RECORDED. A person opens a day; a person records its
 * closing. Everything else about a day is DERIVED: OPEN/PARTIAL/CLOSED, the
 * carry-forward, State(t1) — all computed at read time by `daySession.ts`
 * from records that already exist. There is deliberately no `day.expired`,
 * no midnight job and no stored status, for the same reason the invitation
 * path has no EXPIRED event: the passage of time is not an act anyone
 * performs, so recording it would be inventing a fact.
 *
 * WHY `PhilosEvent` AND NOT `GroupEvent`. A day belongs to a person.
 * `GroupEvent` requires a `group_id`, and minting one for a personal day
 * would assert that a group is the subject of the record — a false claim
 * about who it concerns. `PhilosEvent` carries `entity_type: "person"` with
 * no group at all, so the day is recorded as what it is.
 *
 * WHY THESE PAYLOADS ARE TYPED. `PhilosEvent.payload` is
 * `Record<string, unknown>` — deliberately free-form for the sixteen older
 * event types. A day event whose payload were unchecked could be appended
 * with a missing `subject_id`, an empty intention, or `consent: false`, and
 * nothing downstream would notice until a projection silently rendered a
 * day that no one actually opened. `validateDayOpenedPayload` and
 * `validateDayClosingRecordedPayload` run BEFORE append and refuse
 * malformed input, so a malformed day event cannot enter the log at all.
 *
 * THE CANON-DOMAIN SENSE OF THESE EVENTS IS `C` (COGNITIVE) in the
 * Observation model's own `G`/`E`/`C` vocabulary (`canon/observation.ts`).
 * That is recorded here, in prose, on purpose: the five-value routing
 * `Domain` in `projectDynamics.ts` has no cognitive member, and this phase
 * does not widen it. The two `Domain` types are a real, pre-existing
 * collision documented at `canon/canonEvent.ts:14-22`. Routing metadata is
 * not classification: neither of these events classifies the person, the
 * day, or any part of the 10-unit analysis model.
 */
import { createHash } from "node:crypto";

import type { PhilosEvent } from "../events";

export const DAY_OPENED = "day.opened" as const;
export const DAY_CLOSING_RECORDED = "day.closing_recorded" as const;

/**
 * Stable, derivable day key: one person, one calendar day.
 *
 * Derivable rather than random so that "did this person already open today?"
 * is answerable by folding the log, with no index and no second store.
 */
export function dayId(subject_id: string, date: string): string {
  return `day_${date}_${subject_id}`;
}

/**
 * DETERMINISTIC, PER-PERSON DAY EVENT IDS.
 *
 * The id must be stable (so a replay of the same act is refused by the log's
 * own duplicate-id check rather than appended twice) and unique per person
 * (so two people opening the same calendar day do not collide).
 *
 * `day_id` alone is not enough. It is keyed by the CANON SUBJECT, while the
 * event it identifies is a `PhilosEvent` keyed by `person_id` — two different
 * identity spaces, joined only by the bridge. Binding the id to the event
 * type, the person AND the day makes it unique across every combination that
 * can actually differ.
 *
 * THE PARTS ARE HASHED, NOT CONCATENATED. `person_id` and `day_id` carry
 * caller-influenced text; splicing them straight into an identifier would let
 * a crafted value impersonate another id by forging a separator. The parts are
 * joined with NUL — a byte no legitimate id contains — and digested, so the
 * boundary cannot be forged and the id is a fixed-width, charset-safe token.
 * The kind stays in the clear because it is a closed literal, and a readable
 * prefix is worth more than the last eight bytes of digest.
 */
function dayEventId(kind: "opened" | "closed", person_id: string, day_id: string): string {
  const digest = createHash("sha256")
    .update([kind, person_id, day_id].join("\u0000"), "utf8")
    .digest("hex")
    .slice(0, 32);
  return `dayev_${kind}_${digest}`;
}

/** The id a day-opening for this person and day will always have. */
export const dayOpenedEventId = (person_id: string, day_id: string) =>
  dayEventId("opened", person_id, day_id);

/** The id a day-closing for this person and day will always have. */
export const dayClosedEventId = (person_id: string, day_id: string) =>
  dayEventId("closed", person_id, day_id);

/** `YYYY-MM-DD` — the calendar-day half of a `day_id`. */
export function dayDateOf(day_id: string): string | null {
  const m = /^day_(\d{4}-\d{2}-\d{2})_/.exec(day_id);
  return m ? m[1] : null;
}

export interface DayOpenedPayload {
  day_id: string;
  subject_id: string;
  intention: string;
  context: string;
  /** Refs to the records standing for State(t0). May be empty — empty is UNKNOWN, not zero. */
  state_t0_refs: string[];
  /**
   * The Event and Observation this day is anchored to.
   *
   * Both optional for backward compatibility with openings recorded before
   * these existed; absent means the day is not anchored, never that it is.
   * They are checked by RESOLUTION, not presence (`dayRefs.ts`): an
   * Observation has no id of its own, so both must name the same stored
   * `CanonEvent`, and its subject must be this day's subject.
   */
  event_ref?: string;
  observation_ref?: string;
  /** Open loops inherited from the previous day's closing. */
  carry_forward_refs: string[];
  /** Explicit, per-submission. Never defaulted true. */
  consent: true;
  sourceRefs: string[];
}

export interface DayClosingRecordedPayload {
  day_id: string;
  subject_id: string;
  state_t1_refs: string[];
  action_refs: string[];
  effect_refs: string[];
  evidence_refs: string[];
  learning_refs: string[];
  open_loop_refs: string[];
  consent: true;
  sourceRefs: string[];
}

export type DayPayloadError =
  | { field: string; reason: "empty" }
  | { field: string; reason: "not_a_string_array" }
  | { field: string; reason: "consent_not_granted" }
  | { field: string; reason: "day_id_malformed" }
  | { field: string; reason: "subject_mismatch" }
  | { field: "payload"; reason: "not_an_object" };

export interface DayPayloadValidation<T> {
  valid: boolean;
  errors: DayPayloadError[];
  /** Present only when `valid` — never a partially-repaired object. */
  payload?: T;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim() !== "";
}

function stringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

/**
 * Shared checks. Every applicable check runs — the caller gets the full list
 * of what is wrong, not just the first failure.
 */
function checkCommon(p: Record<string, unknown>, errors: DayPayloadError[]): void {
  if (!nonEmptyString(p.day_id)) {
    errors.push({ field: "day_id", reason: "empty" });
  } else if (dayDateOf(p.day_id) === null) {
    errors.push({ field: "day_id", reason: "day_id_malformed" });
  }

  if (!nonEmptyString(p.subject_id)) {
    errors.push({ field: "subject_id", reason: "empty" });
  } else if (
    nonEmptyString(p.day_id) &&
    dayDateOf(p.day_id) !== null &&
    p.day_id !== `day_${dayDateOf(p.day_id)}_${p.subject_id}`
  ) {
    // A day_id that names a different subject than the payload does is a
    // contradiction, not a typo — refuse rather than pick a winner.
    errors.push({ field: "subject_id", reason: "subject_mismatch" });
  }

  if (p.consent !== true) errors.push({ field: "consent", reason: "consent_not_granted" });
  for (const f of ["event_ref", "observation_ref"]) {
    if (p[f] !== undefined && !nonEmptyString(p[f])) {
      errors.push({ field: f, reason: "empty" });
    }
  }
  if (!stringArray(p.sourceRefs)) errors.push({ field: "sourceRefs", reason: "not_a_string_array" });
}

function checkRefFields(
  p: Record<string, unknown>,
  fields: readonly string[],
  errors: DayPayloadError[],
): void {
  for (const f of fields) {
    if (!stringArray(p[f])) errors.push({ field: f, reason: "not_a_string_array" });
  }
}

export const DAY_OPENED_REF_FIELDS = ["state_t0_refs", "carry_forward_refs"] as const;

export const DAY_CLOSING_REF_FIELDS = [
  "state_t1_refs", "action_refs", "effect_refs",
  "evidence_refs", "learning_refs", "open_loop_refs",
] as const;

export function validateDayOpenedPayload(raw: unknown): DayPayloadValidation<DayOpenedPayload> {
  if (!isObject(raw)) return { valid: false, errors: [{ field: "payload", reason: "not_an_object" }] };

  const errors: DayPayloadError[] = [];
  checkCommon(raw, errors);
  checkRefFields(raw, DAY_OPENED_REF_FIELDS, errors);

  // Intention and context are what make an opening an opening rather than a
  // timestamp. An empty intention is refused, not stored as "".
  if (!nonEmptyString(raw.intention)) errors.push({ field: "intention", reason: "empty" });
  if (!nonEmptyString(raw.context)) errors.push({ field: "context", reason: "empty" });

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], payload: raw as unknown as DayOpenedPayload };
}

export function validateDayClosingRecordedPayload(
  raw: unknown,
): DayPayloadValidation<DayClosingRecordedPayload> {
  if (!isObject(raw)) return { valid: false, errors: [{ field: "payload", reason: "not_an_object" }] };

  const errors: DayPayloadError[] = [];
  checkCommon(raw, errors);
  checkRefFields(raw, DAY_CLOSING_REF_FIELDS, errors);

  if (errors.length > 0) return { valid: false, errors };
  return { valid: true, errors: [], payload: raw as unknown as DayClosingRecordedPayload };
}

/** Narrow a log entry to a validated day-opening. Malformed rows read as absent. */
export function asDayOpened(
  e: PhilosEvent,
): { event: PhilosEvent; payload: DayOpenedPayload } | null {
  if (e.event_type !== DAY_OPENED) return null;
  const v = validateDayOpenedPayload(e.payload);
  return v.valid && v.payload ? { event: e, payload: v.payload } : null;
}

/** Narrow a log entry to a validated day-closing. Malformed rows read as absent. */
export function asDayClosingRecorded(
  e: PhilosEvent,
): { event: PhilosEvent; payload: DayClosingRecordedPayload } | null {
  if (e.event_type !== DAY_CLOSING_RECORDED) return null;
  const v = validateDayClosingRecordedPayload(e.payload);
  return v.valid && v.payload ? { event: e, payload: v.payload } : null;
}

export function describeDayPayloadErrors(errors: readonly DayPayloadError[]): string {
  return errors.map((e) => `${e.field}: ${e.reason}`).join("; ");
}
