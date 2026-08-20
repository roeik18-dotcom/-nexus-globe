/**
 * GROUP CONTEXT — which value group this viewer is looking at, and why.
 *
 * `GROUP_ID` (`vg_ahrayut_kehilatit`) was the answer everywhere: eight
 * surfaces called `projectValueGroup(events, GROUP_ID, today)` and the
 * community page fell back to it whenever no `?community=` was given. With one
 * group and one human that is invisible. With a second human it means a viewer
 * who belongs to no group at all is shown Roei's group as though it were
 * theirs, and the identity-link write path binds them to it.
 *
 * The rule, from the ruling: group context comes from ACTUAL MEMBERSHIP or an
 * EXPLICIT SELECTION. Never a constant, and an unresolved group is an answer —
 * not an inherited one.
 *
 * WHAT THIS DOES NOT DO. It does not authorise reading a group's PUBLIC facts.
 * A value group's existence, name, central value and member count are group
 * facts, not personal records, and both users may legitimately see them —
 * that distinction is the whole reason `SHARED_SCOPED_STORE` is viable. This
 * resolver answers the narrower question: which group is THIS VIEWER'S context,
 * the one whose member-owned records may be read as theirs and whose identity
 * link may be written.
 */
import type { PhilosEvent } from "../events";
import type { ViewerContext } from "../identity/viewerContext";

export type GroupContext =
  /** An explicit selection, or the single group this viewer actually belongs to. */
  | { status: "resolved"; group_id: string; because: "EXPLICIT_SELECTION" | "RECORDED_MEMBERSHIP" }
  /** The viewer belongs to no group and selected none. An answer, not a gap. */
  | { status: "none"; because: string }
  /** A selection this viewer has no recorded relation to. Never narrowed to
   *  "their" group instead — that would answer a different question silently. */
  | { status: "forbidden"; requested: string; because: string };

/** Group ids this viewer has a RECORDED membership event for. Membership is
 *  read from the log; it is never inferred from value similarity, from a
 *  shared central_value, or from having the group on screen. */
export function recordedMembershipsOf(viewer: ViewerContext, events: readonly PhilosEvent[]): string[] {
  const ids = new Set<string>();
  for (const e of events) {
    if (e.event_type !== "member.joined") continue;
    const actor = (e as { actor_id?: string }).actor_id;
    if (actor === viewer.person_id || actor === viewer.subject_id) {
      const gid = (e as { entity_id?: string }).entity_id;
      if (gid) ids.add(gid);
    }
  }
  return [...ids];
}

export function resolveGroupContext(
  viewer: ViewerContext,
  events: readonly PhilosEvent[],
  requested?: unknown,
): GroupContext {
  const memberships = recordedMembershipsOf(viewer, events);

  if (typeof requested === "string" && requested !== "") {
    // An explicit selection is honoured only where the viewer has a recorded
    // relation to it. Anything else is refused OUT LOUD.
    if (memberships.includes(requested)) {
      return { status: "resolved", group_id: requested, because: "EXPLICIT_SELECTION" };
    }
    return {
      status: "forbidden",
      requested,
      because: "אין חברות מתועדת של הצופה בקבוצה הזאת — בחירה מפורשת אינה יוצרת שיוך",
    };
  }

  if (memberships.length === 1) {
    return { status: "resolved", group_id: memberships[0], because: "RECORDED_MEMBERSHIP" };
  }
  if (memberships.length > 1) {
    // Picking one would be inventing a preference the log does not record.
    return { status: "none", because: `הצופה חבר ב-${memberships.length} קבוצות — נדרשת בחירה מפורשת` };
  }
  return { status: "none", because: "אין חברות מתועדת לצופה הזה — אין קבוצה להציג כשלו" };
}
