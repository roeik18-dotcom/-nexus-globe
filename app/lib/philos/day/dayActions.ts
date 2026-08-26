"use server";

/**
 * DAY WRITE PATH — the only two writes the operational day performs.
 *
 * WHAT THIS FILE DOES NOT DO, DELIBERATELY. It does not create Actions.
 * Canon already has one Action writer (`canon/actionFormAction.ts` →
 * `recordAction`) and it carries the real authority gate: explicit consent
 * (canon §10) plus, for a Need+Offer match, a verified `MatchPermit`. A
 * second Action writer here — even a convenient one that "just" forwarded —
 * would be a second door into the same store, and the gate would then be a
 * property of which door you used. The operational Action of the day is
 * created through the existing writer, and this file never touches it.
 *
 * AUTHORITY FOR THE TWO DAY ACTS. Opening and closing require the current
 * authenticated person and explicit per-submission consent. They do NOT
 * require a `MatchPermit`: a permit proves a specific Need↔Offer match was
 * evaluated permitted, which is a claim about a match. Opening a day makes
 * no such claim, so demanding one would be theatre rather than authority.
 *
 * IDENTITY IS SERVER-RESOLVED, NEVER CLIENT-SUPPLIED. `subject_id` and
 * `person_id` both come from `resolveViewerContext()`. A form that could
 * name its own subject would let one person open another person's day.
 *
 * MALFORMED PAYLOADS ARE REFUSED BEFORE APPEND. The log is append-only, so a
 * bad record cannot be edited out afterwards — validation has to happen on
 * the way in, and it does (`dayEvent.ts`).
 *
 * EXACTLY ONE OPENING AND ONE CLOSING PER DAY. Append-only does not mean
 * append-anything: a second opening for the same `day_id` is refused rather
 * than silently shadowing the first. This is what makes "exactly one Day
 * Opening after replay/refresh" true by construction instead of by luck.
 */
import { revalidatePath } from "next/cache";

import { loadPhilosEvents, philosEventStore } from "@/app/lib/philos-event-store";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { loadCanonEvents } from "@/app/lib/philos/canon/canonEventStoreAccessor";
import { resolveSubmittedObservationRef } from "./linkableObservations";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import type { PhilosEvent } from "@/app/lib/philos/events";
import {
  asDayOpened,
  dayClosedEventId,
  dayOpenedEventId,
  DAY_CLOSING_RECORDED,
  DAY_OPENED,
  dayId,
  describeDayPayloadErrors,
  validateDayClosingRecordedPayload,
  validateDayOpenedPayload,
  type DayClosingRecordedPayload,
  type DayOpenedPayload,
} from "./dayEvent";
import { countDayRecords } from "./daySession";

export type DayWriteResult =
  | { ok: true; day_id: string; event_id: string }
  | { ok: false; message: string };

/** The seven operational terminals plus the day surfaces they all link to. */
const TERMINALS = ["/hub", "/brain", "/hub/community", "/dynamics", "/marketplace", "/planet", "/world"] as const;

function refs(formData: FormData, field: string): string[] {
  return formData.getAll(field).map(String).map((s) => s.trim()).filter((s) => s !== "");
}

/** Testable core — no `revalidatePath`. Same split as `actionFormAction.ts`. */
export async function openDayCore(formData: FormData): Promise<DayWriteResult> {
  const viewer = await resolveViewerContext();
  const date = String(formData.get("date") ?? "").trim() || todayIn(systemClock);
  const day_id = dayId(viewer.subject_id, date);

  const candidate: Partial<DayOpenedPayload> = {
    day_id,
    subject_id: viewer.subject_id,
    intention: String(formData.get("intention") ?? "").trim(),
    context: String(formData.get("context") ?? "").trim(),
    state_t0_refs: refs(formData, "state_t0_refs"),
    /* The Event/Observation anchor. Omitted entirely when absent rather than
       stored as "", so "not anchored" stays distinguishable from "anchored to
       nothing" — and the validator's empty-if-present rule stays meaningful.
       Filled in below, from the store, never from the submitted string. */
    carry_forward_refs: refs(formData, "carry_forward_refs"),
    consent: formData.get("consent") === "on" ? true : undefined,
    sourceRefs: refs(formData, "sourceRefs"),
  };

  /* ── THE OBSERVATION LINK, PROVEN AGAINST THE STORE BEFORE ANY APPEND ──
     The person picks ONE observation. Everything about that pick is untrusted
     until this block has re-read the canon store and proven it.

     `event_ref` is DERIVED, never read from the form. An Observation has no id
     of its own — it exists only as the payload of a CanonEvent — so the event
     and the observation are necessarily the same record, and asking a client
     for both invites a mismatch that could only ever be a forgery or a
     mistake. A submitted `event_ref` is ignored outright; there is no code
     path that reads it.

     Nothing here trusts `subject_id`, `person_id` or `record_origin` from the
     form either: the subject is `viewer.subject_id`, resolved server-side
     above, and the origin is read off the STORED record, not off the request.

     No selection is a legitimate answer. The day opens PARTIAL, both refs stay
     absent, and `EventObservationLinked` remains honestly unresolved — an
     invented link would be worse than a missing one. */
  const submittedRef = String(formData.get("observation_ref") ?? "").trim();
  if (submittedRef !== "") {
    const resolved = resolveSubmittedObservationRef(
      submittedRef,
      await loadCanonEvents(),
      viewer.subject_id,
    );
    if (!resolved.ok) {
      /* Refused BEFORE the append. Nothing is written, and the reason names
         what was actually wrong rather than a generic failure. */
      return { ok: false, message: `day.opened refused: ${resolved.reason} — ${resolved.message}` };
    }
    candidate.event_ref = resolved.canon_event_id;
    candidate.observation_ref = resolved.canon_event_id;
  }

  const validation = validateDayOpenedPayload(candidate);
  if (!validation.valid || !validation.payload) {
    return { ok: false, message: `day.opened refused: ${describeDayPayloadErrors(validation.errors)}` };
  }

  const existing = await loadPhilosEvents();
  if (countDayRecords(existing, day_id).openings > 0) {
    return { ok: false, message: `יום ${date} כבר נפתח — פתיחה שנייה נדחית (append-only, לא הצללה)` };
  }

  const event: PhilosEvent = {
    event_id: dayOpenedEventId(viewer.person_id, day_id),
    actor_id: viewer.person_id,
    entity_type: "person",
    entity_id: viewer.person_id,
    event_type: DAY_OPENED,
    value_tags: [],
    timestamp: systemClock.now(),
    visibility: "private",
    payload: validation.payload as unknown as Record<string, unknown>,
    /* `caused_by` names event_ids IN THIS LOG — the store validates that and
       refuses anything else. Carry-forward refs are open-loop refs from a
       projection, not events, so they belong in the payload (where they are)
       and never here. An opening has no declared causal parent inside this
       log: `[]` states that explicitly, which is not the same as `undefined`
       (UNKNOWN — see `events.ts`'s tri-state note). */
    caused_by: [],
  };

  const [stored] = await philosEventStore().append([event]);
  return { ok: true, day_id, event_id: stored.event_id };
}

/** Testable core — no `revalidatePath`. */
export async function recordDayClosingCore(formData: FormData): Promise<DayWriteResult> {
  const viewer = await resolveViewerContext();
  const date = String(formData.get("date") ?? "").trim() || todayIn(systemClock);
  const day_id = dayId(viewer.subject_id, date);

  const candidate: Partial<DayClosingRecordedPayload> = {
    day_id,
    subject_id: viewer.subject_id,
    state_t1_refs: refs(formData, "state_t1_refs"),
    action_refs: refs(formData, "action_refs"),
    effect_refs: refs(formData, "effect_refs"),
    evidence_refs: refs(formData, "evidence_refs"),
    learning_refs: refs(formData, "learning_refs"),
    open_loop_refs: refs(formData, "open_loop_refs"),
    consent: formData.get("consent") === "on" ? true : undefined,
    sourceRefs: refs(formData, "sourceRefs"),
  };

  const validation = validateDayClosingRecordedPayload(candidate);
  if (!validation.valid || !validation.payload) {
    return { ok: false, message: `day.closing_recorded refused: ${describeDayPayloadErrors(validation.errors)}` };
  }

  const existing = await loadPhilosEvents();
  const counts = countDayRecords(existing, day_id);
  // A closing for a day nobody opened would produce a day whose own opening
  // is UNKNOWN — a record describing something that never started.
  if (counts.openings === 0) {
    return { ok: false, message: `לא ניתן לסגור יום שלא נפתח (${date})` };
  }
  if (counts.closings > 0) {
    return { ok: false, message: `יום ${date} כבר נסגר — סגירה שנייה נדחית` };
  }

  /* The closing's real causal parent is the opening — the one event in THIS
     log that actually preceded it. Action/Effect/Learning ids live in canon's
     own stores, not here, so declaring them as `caused_by` would name records
     the log cannot resolve; they travel in the payload instead. */
  const openingEventId = existing
    .filter((e) => asDayOpened(e)?.payload.day_id === day_id)
    .map((e) => e.event_id);

  const event: PhilosEvent = {
    event_id: dayClosedEventId(viewer.person_id, day_id),
    actor_id: viewer.person_id,
    entity_type: "person",
    entity_id: viewer.person_id,
    event_type: DAY_CLOSING_RECORDED,
    value_tags: [],
    timestamp: systemClock.now(),
    visibility: "private",
    payload: validation.payload as unknown as Record<string, unknown>,
    caused_by: openingEventId,
  };

  const [stored] = await philosEventStore().append([event]);
  return { ok: true, day_id, event_id: stored.event_id };
}

/** Network edge — records the opening, then revalidates every terminal that projects it. */
export async function openDay(formData: FormData): Promise<DayWriteResult> {
  const result = await openDayCore(formData);
  if (result.ok) for (const t of TERMINALS) revalidatePath(t);
  return result;
}

/** Network edge — records the closing, then revalidates every terminal that projects it. */
export async function recordDayClosing(formData: FormData): Promise<DayWriteResult> {
  const result = await recordDayClosingCore(formData);
  if (result.ok) for (const t of TERMINALS) revalidatePath(t);
  return result;
}
