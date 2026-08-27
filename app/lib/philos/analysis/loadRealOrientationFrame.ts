/**
 * THE ONE SERVER READ that produces the orientation frame. Loads the three
 * stores, hands them to the pure builder, and returns what it returns —
 * including its refusals. No terminal resolves an anchor of its own.
 */
import { canonEventStore } from "../canon/canonEventStoreAccessor";
import { loadDomainStates } from "../canon/domainStateStoreAccessor";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { DAY_OPENED, dayId } from "../day/dayEvent";
import { buildRealOrientationFrame, type OrientationFrameResult } from "./realOrientationFrame";

export async function loadRealOrientationFrame(
  subject_id: string, date: string,
): Promise<OrientationFrameResult> {
  const [events, states, philos] = await Promise.all([
    canonEventStore().load().catch(() => []),
    loadDomainStates().catch(() => []),
    loadPhilosEvents().catch(() => []),
  ]);

  /* THE OPENING FOR THIS EXACT DAY. Not the most recent opening — a person
     looking at an earlier date must see that day's own anchor. */
  const wanted = dayId(subject_id, date);
  const opened = philos.filter((e) => e.event_type === DAY_OPENED
    && (e.payload as { day_id?: string })?.day_id === wanted);
  /* Append-only: if a day were somehow opened twice the FIRST is the opening,
     because that is the one the day's meaning was fixed by. */
  const p = opened[0]?.payload as {
    day_id: string; event_ref?: string; observation_ref?: string; state_t0_refs?: string[];
  } | undefined;

  return buildRealOrientationFrame({
    opening: p ? { day_id: p.day_id, event_ref: p.event_ref,
      observation_ref: p.observation_ref, state_t0_refs: p.state_t0_refs } : null,
    events, domainStates: states, subject_id,
  });
}
