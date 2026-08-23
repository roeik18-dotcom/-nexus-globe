/**
 * SYSTEM EVIDENCE — the channel that was never connected.
 *
 * `socialSystemProjection.ts` gates SYSTEM scale on a `systemEvidence` map and
 * excludes anything absent from it with `NO_SYSTEM_EVIDENCE`. The gate is
 * written correctly and refuses to compromise. Its only caller —
 * `loadSocialSystem.ts:200` — never passed the map, so it was ALWAYS empty and
 * every record was rejected unconditionally. `SYSTEM = 0` was therefore not a
 * measurement: it was a disconnected pipeline reporting a number.
 *
 * This module supplies that input. It LOWERS NOTHING: the gate is untouched,
 * and a record still needs its own recorded verification to pass. What changes
 * is that the question is finally asked of real records.
 *
 * WHAT COUNTS AS SYSTEM-SCALE EVIDENCE, and why that is not a new gate.
 * PHILOS already draws three scales — GROUP, NETWORK, SYSTEM — and already
 * distinguishes two verification statuses in `events.ts`:
 *
 *     community_verified   a group checked its own claim      → GROUP scale
 *     external_verified    someone outside the group did      → SYSTEM scale
 *
 * SYSTEM is the scale of the wider world, so its evidence is the kind that
 * came from outside. Requiring `external_verified` names a distinction the
 * canon already makes; it does not invent a threshold. A `community_verified`
 * record is genuinely verified and genuinely not system-scale, and it is
 * excluded with that reason stated rather than silently dropped.
 *
 * DEMO CAN NEVER SATISFY REAL ELIGIBILITY. A DEMO record is excluded before
 * verification is even consulted, so no amount of declared verification inside
 * a demonstration bundle can reach SYSTEM.
 */
import type { ChronoEntry } from "../social/socialChronology";

/** Every reason a record can fail to reach SYSTEM. Exhaustive and stated —
 *  an excluded record always says which of these applies to it. */
export type SystemRejectionReason =
  | "DEMO_NOT_ELIGIBLE"
  | "REFERENCE_NOT_ELIGIBLE"
  | "NO_EVIDENCE_RECORD"
  | "NOT_VERIFIED"
  | "VERIFIED_BUT_NOT_EXTERNAL"
  | "NO_SYSTEM_SCOPE";

export const REJECTION_TEXT: Record<SystemRejectionReason, string> = {
  DEMO_NOT_ELIGIBLE: "רשומת DEMO — הדגמה לעולם אינה ראיה מערכתית",
  REFERENCE_NOT_ELIGIBLE: "חומר ייחוס — מתאר את העולם, אינו תצפית בו",
  NO_EVIDENCE_RECORD: "אין רשומת ראיה שמצביעה על הרשומה הזאת",
  NOT_VERIFIED: "ראיה קיימת ולא אומתה",
  VERIFIED_BUT_NOT_EXTERNAL: "אומת בתוך הקבוצה — אימות קהילתי הוא קנה-מידה GROUP, לא SYSTEM",
  NO_SYSTEM_SCOPE: "הרשומה אינה מגיעה לקנה-מידה מערכתי",
};

/** An evidence record as the canon stores carry it, narrowed to what the gate
 *  needs. `level` is verbatim from the record — never normalised upward. */
export interface EvidenceRecord {
  evidence_id: string;
  /** The record this evidence is about. */
  effect_id: string;
  /** Verbatim: "verified" | "community_verified" | "external_verified" | null. */
  level: string | null;
  provenance: string;
  source: string;
  verified_by?: string | null;
}

export interface SystemEvidenceResult {
  /** The map `projectSocialSystem` consumes. `record_id -> evidence_id`. */
  systemEvidence: Map<string, string>;
  /** Why each candidate did NOT make it. Survives into the World loader. */
  rejections: { record_id: string; reason: SystemRejectionReason; detail: string }[];
  /** Candidates that carry real verification but not external verification —
   *  the honest "close, and not there" bucket. */
  unresolvedCandidates: { record_id: string; evidence_id: string; level: string }[];
  counts: {
    evidence_records: number;
    real: number;
    derived: number;
    demo: number;
    external_verified: number;
    system_eligible: number;
  };
}

/** The one status that carries system scale. Read from the canon vocabulary,
 *  not redefined here. */
const EXTERNAL = "external_verified";
const COMMUNITY = "community_verified";

/**
 * Build the map. Pure and total: same records in, same map out, no clock and
 * no I/O. An empty input yields an empty map and an empty rejection list —
 * which is a different, and truthful, state from "channel absent".
 */
export function projectSystemEvidence(
  chronology: readonly ChronoEntry[],
  evidence: readonly EvidenceRecord[],
): SystemEvidenceResult {
  const byTarget = new Map<string, EvidenceRecord>();
  for (const e of evidence) if (e.effect_id) byTarget.set(e.effect_id, e);

  const systemEvidence = new Map<string, string>();
  const rejections: SystemEvidenceResult["rejections"] = [];
  const unresolvedCandidates: SystemEvidenceResult["unresolvedCandidates"] = [];

  for (const entry of chronology) {
    // DEMO and REFERENCE are excluded FIRST, before verification is consulted.
    // A demonstration bundle may declare whatever it likes internally; it can
    // never reach REAL eligibility through this path.
    if (entry.provenance === "DEMO") {
      rejections.push({ record_id: entry.record_id, reason: "DEMO_NOT_ELIGIBLE", detail: REJECTION_TEXT.DEMO_NOT_ELIGIBLE });
      continue;
    }
    if (entry.provenance === "REFERENCE") {
      rejections.push({ record_id: entry.record_id, reason: "REFERENCE_NOT_ELIGIBLE", detail: REJECTION_TEXT.REFERENCE_NOT_ELIGIBLE });
      continue;
    }

    const ev = byTarget.get(entry.record_id);
    if (!ev) {
      rejections.push({ record_id: entry.record_id, reason: "NO_EVIDENCE_RECORD", detail: REJECTION_TEXT.NO_EVIDENCE_RECORD });
      continue;
    }
    if (ev.provenance === "DEMO") {
      rejections.push({ record_id: entry.record_id, reason: "DEMO_NOT_ELIGIBLE", detail: `${REJECTION_TEXT.DEMO_NOT_ELIGIBLE} (${ev.evidence_id})` });
      continue;
    }
    if (!ev.level) {
      rejections.push({ record_id: entry.record_id, reason: "NOT_VERIFIED", detail: REJECTION_TEXT.NOT_VERIFIED });
      continue;
    }
    if (ev.level !== EXTERNAL) {
      const detail = ev.level === COMMUNITY
        ? REJECTION_TEXT.VERIFIED_BUT_NOT_EXTERNAL
        : `${REJECTION_TEXT.VERIFIED_BUT_NOT_EXTERNAL} (רמה מתועדת: "${ev.level}")`;
      rejections.push({ record_id: entry.record_id, reason: "VERIFIED_BUT_NOT_EXTERNAL", detail });
      unresolvedCandidates.push({ record_id: entry.record_id, evidence_id: ev.evidence_id, level: ev.level });
      continue;
    }

    // External verification present. The downstream gate still checks the
    // record's OWN verification independently — this map only answers
    // "is there system-scale evidence pointing at it".
    systemEvidence.set(entry.record_id, ev.evidence_id);
  }

  const count = (p: string) => evidence.filter((e) => e.provenance === p).length;
  return {
    systemEvidence,
    rejections,
    unresolvedCandidates,
    counts: {
      evidence_records: evidence.length,
      real: count("REAL"),
      derived: count("DERIVED"),
      demo: count("DEMO"),
      external_verified: evidence.filter((e) => e.level === EXTERNAL && e.provenance !== "DEMO").length,
      system_eligible: systemEvidence.size,
    },
  };
}
