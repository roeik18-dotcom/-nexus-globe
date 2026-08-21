/**
 * VIEWER GROUP OVERLAY — this viewer's relationship to groups, and nothing else.
 *
 * Strictly separate from `ValueGroupUniverse`, which is global. The universe
 * says a group exists; the overlay says what this person is to it. Fusing them
 * is the bug the ruling forbids in both directions: filtering the universe down
 * to the viewer hides the landscape, and treating a global group as a personal
 * membership is the leak that showed Roei's group to User B as though it were
 * theirs.
 *
 * MEMBERSHIP IS AN EVENT, NEVER A SIMILARITY. Sharing a value with a group,
 * having it on screen, or selecting it for inspection creates no relationship
 * here. Every relationship below is emitted only from a recorded event or a
 * recorded link, and `NONE` — the honest majority answer — is emitted for
 * everything else rather than left blank.
 */
import type { PhilosEvent } from "../events";
import type { ViewerContext } from "../identity/viewerContext";
import type { ValueGroupRegistry } from "./valueGroupRegistry";

export type ViewerGroupRelation =
  | "FOUNDER"
  | "LEADING_MEMBER"
  | "MEMBER"
  | "CONTRIBUTOR"
  | "FOLLOWING"
  | "CANDIDATE"
  | "RELATED"
  | "NONE";

export interface OverlayEntry {
  group_id: string;
  relation: ViewerGroupRelation;
  /** The event or link that produced it, in words. `NONE` carries one too. */
  because: string;
  /** Strongest evidence level behind the relation. */
  evidence: "RECORDED_EVENT" | "RECORDED_LINK" | "NO_RECORD";
}

export interface ViewerGroupOverlay {
  viewer_id: string;
  entries: readonly OverlayEntry[];
  /** Groups with a relation other than NONE. The "MY GROUPS" count. */
  membership_count: number;
  memberGroupIds: readonly string[];
  relationOf(group_id: string): ViewerGroupRelation;
}

const ACTOR_MATCHES = (e: PhilosEvent, viewer: ViewerContext): boolean => {
  const a = (e as { actor_id?: string }).actor_id;
  return a === viewer.person_id || a === viewer.subject_id;
};

/**
 * Build the overlay. Reads only the viewer's OWN events — a group's roster is
 * a group fact, but "am I on it" is a viewer fact, and this function answers
 * only the second.
 */
export function buildViewerGroupOverlay(
  viewer: ViewerContext,
  registry: ValueGroupRegistry,
  events: readonly PhilosEvent[],
): ViewerGroupOverlay {
  const rel = new Map<string, OverlayEntry>();
  const put = (gid: string, relation: ViewerGroupRelation, because: string, evidence: OverlayEntry["evidence"]) => {
    const RANK: ViewerGroupRelation[] = ["NONE", "RELATED", "CANDIDATE", "FOLLOWING", "CONTRIBUTOR", "MEMBER", "LEADING_MEMBER", "FOUNDER"];
    const prior = rel.get(gid);
    if (prior && RANK.indexOf(prior.relation) >= RANK.indexOf(relation)) return;
    rel.set(gid, { group_id: gid, relation, because, evidence });
  };

  for (const e of events) {
    const gid = (e as { entity_id?: string }).entity_id;
    if (!gid || !registry.byId(gid)) continue;
    if (!ACTOR_MATCHES(e, viewer)) continue;
    switch (e.event_type) {
      case "group.opened":
        put(gid, "FOUNDER", "אירוע group.opened שהצופה הוא ה-actor שלו", "RECORDED_EVENT");
        break;
      case "member.joined":
        put(gid, "MEMBER", "אירוע member.joined מתועד", "RECORDED_EVENT");
        break;
      case "allocation.voted":
      case "allocation.proposed":
      case "update.posted":
      case "impact.recorded":
        put(gid, "CONTRIBUTOR", `פעולה מתועדת בקבוצה (${e.event_type})`, "RECORDED_EVENT");
        break;
      default:
        break;
    }
  }

  // `leader.appointed` names its subject in the payload rather than the actor.
  for (const e of events) {
    if (e.event_type !== "leader.appointed") continue;
    const gid = (e as { entity_id?: string }).entity_id;
    if (!gid || !registry.byId(gid)) continue;
    const p = (e as { payload?: { person_id?: string } }).payload;
    if (p?.person_id && (p.person_id === viewer.person_id || p.person_id === viewer.subject_id)) {
      put(gid, "LEADING_MEMBER", "אירוע leader.appointed שמינה את הצופה", "RECORDED_EVENT");
    }
  }

  // Everything else in the registry is explicitly NONE — stated, not blank.
  const entries: OverlayEntry[] = registry.entries.map(
    (e) =>
      rel.get(e.group.group_id) ?? {
        group_id: e.group.group_id,
        relation: "NONE" as const,
        because: "אין אירוע או קישור מתועד בין הצופה לקבוצה הזאת",
        evidence: "NO_RECORD" as const,
      },
  );

  const mine = entries.filter((e) => e.relation !== "NONE");
  return {
    viewer_id: viewer.person_id ?? viewer.subject_id ?? "unknown",
    entries,
    membership_count: mine.length,
    memberGroupIds: mine.map((e) => e.group_id),
    relationOf: (gid) => entries.find((e) => e.group_id === gid)?.relation ?? "NONE",
  };
}
