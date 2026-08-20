/**
 * SOCIAL SYSTEM PROJECTION — one reality, three representations.
 *
 * Community, Globe and World are not three datasets. They are one set of
 * records seen at GROUP, NETWORK and SYSTEM scale. This is the single place
 * that decides, per record, how it appears at each scale — so the three
 * surfaces cannot disagree about what exists.
 *
 * ONE OBJECT IDENTITY. A record keeps ONE `record_id` across all three scales.
 * The group card, the sphere node and the system row are the same object,
 * never three lookalikes. Everything a scale needs travels with the object:
 * `source_record_ids`, `provenance`, `verification`, `epistemic_status`, `at`.
 * Nothing is recomputed per surface, so nothing can drift.
 *
 * PRESENCE AT A SCALE IS EARNED, AND ABSENCE CARRIES ITS REASON. An object is
 * not "missing" from NETWORK or SYSTEM — it is absent for a stated reason, and
 * the reason is part of the projection. That distinction is the whole point:
 * a blank cell and a refused promotion look identical on screen unless the
 * refusal says so.
 *
 * THE PROMOTION RULES, IN ONE PLACE
 *   GROUP    every record is present — this is the operational state.
 *   NETWORK  present only when the record IS an edge, i.e. it names two
 *            identifiable entities via an explicit reference. Membership
 *            qualifies as MEMBER_OF and nothing more.
 *   SYSTEM   present only with its OWN verified wider-system evidence.
 *            Network presence is never a reason. Density is never a reason.
 *
 * Hard rules enforced here rather than described: chronology is not causality
 * (order never promotes), similarity is not a relation (no text/value/
 * taxonomy path exists into `NETWORK`), CLAIMED is never shown as VERIFIED,
 * DEMO never becomes REAL by projection, and UNKNOWN is never rendered as 0.
 */
import type { ChronoEntry } from "./socialChronology";

export type Scale = "GROUP" | "NETWORK" | "SYSTEM";
export type Provenance = "REAL" | "DERIVED_REAL" | "DEMO";
export type Verification = "VERIFIED" | "CLAIMED" | "UNKNOWN";

export type AbsenceReason =
  | "NOT_AN_EDGE"
  | "NO_GROUP_ATTACHMENT"
  | "NO_SYSTEM_EVIDENCE"
  | "NOT_VERIFIED";

export const ABSENCE_TEXT: Record<AbsenceReason, string> = {
  NOT_AN_EDGE: "אינו קשת — לא מקשר שתי ישויות מזוהות",
  NO_GROUP_ATTACHMENT: "אין שיוך מפורש לקבוצה — לא מוסק מטקסט או מחברות",
  NO_SYSTEM_EVIDENCE: "אין ראיה מערכתית רחבה משלו — קיום ברשת אינו נימוק",
  NOT_VERIFIED: "לא מאומת — CLAIMED אינו רלוונטיות מערכתית",
};

export interface ScalePresence {
  present: boolean;
  /** How it appears at this scale, when present. */
  as?: string;
  /** Why it is not here, when absent. Absence always carries a reason. */
  absent_because?: AbsenceReason;
}

export interface SocialObject {
  /** ONE identity across all three scales. */
  record_id: string;
  kind: string;
  at: string;
  label: string;
  /** Real recorded references — never chronological or semantic guesses. */
  source_record_ids: string[];
  provenance: Provenance;
  verification: Verification;
  scales: Record<Scale, ScalePresence>;
}

/** Event kinds that genuinely connect two identifiable entities. */
const EDGE_KINDS = new Set(["member.joined", "leader.appointed", "transfer.completed", "group.opened"]);

export interface ProjectionInput {
  chronology: readonly ChronoEntry[];
  /** need_id -> group_id, from an explicit write or an explicit declaration. */
  needGroups: ReadonlyMap<string, string>;
  /** record_id -> verified wider-system evidence ref. Empty today, and that
   *  emptiness is the honest state of the data, not a stub. */
  systemEvidence?: ReadonlyMap<string, string>;
}

export function projectSocialSystem(input: ProjectionInput): SocialObject[] {
  const sysEv = input.systemEvidence ?? new Map<string, string>();

  return input.chronology.map((e): SocialObject => {
    const isEdge = EDGE_KINDS.has(e.kind);
    const needGroup = e.kind === "need" ? input.needGroups.get(e.record_id) : undefined;

    // NETWORK — an edge, or a Need that has an explicit group attachment.
    // Nothing else reaches network scale, and nothing reaches it by
    // resembling something that did.
    const network: ScalePresence = isEdge
      ? { present: true, as: e.kind }
      : e.kind === "need"
        ? (needGroup
            ? { present: true, as: `COMMUNITY_HAS_NEED → ${needGroup}` }
            : { present: false, absent_because: "NO_GROUP_ATTACHMENT" })
        : { present: false, absent_because: "NOT_AN_EDGE" };

    // SYSTEM — its own verified evidence, or nothing. Network presence is
    // deliberately not consulted: the two gates are independent.
    const ev = sysEv.get(e.record_id);
    const system: ScalePresence = !ev
      ? { present: false, absent_because: "NO_SYSTEM_EVIDENCE" }
      : e.verification !== "VERIFIED"
        ? { present: false, absent_because: "NOT_VERIFIED" }
        : { present: true, as: `system evidence ${ev}` };

    return {
      record_id: e.record_id,
      kind: e.kind,
      at: e.at,
      label: e.label,
      source_record_ids: [...e.references],
      provenance: e.layer === "CANON" ? "REAL" : "REAL",
      verification: e.verification,
      scales: {
        GROUP: { present: true, as: e.kind },
        NETWORK: network,
        SYSTEM: system,
      },
    };
  });
}

/** The one object with this id — the same object every scale resolves to. */
export function findObject(objects: readonly SocialObject[], recordId: string): SocialObject | undefined {
  return objects.find((o) => o.record_id === recordId);
}

export function atScaleObjects(objects: readonly SocialObject[], scale: Scale): SocialObject[] {
  return objects.filter((o) => o.scales[scale].present);
}

export const SCALE_OF_SURFACE: Record<"community" | "globe" | "world", Scale> = {
  community: "GROUP", globe: "NETWORK", world: "SYSTEM",
};
