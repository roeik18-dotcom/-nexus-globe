/**
 * WORLD DATA CONTRACT — what a Living World UI may ask for, whether or not
 * anything answers today.
 *
 * EMPTY IS VALID. DISCONNECTED IS NOT. Every array here may legitimately be
 * empty; none of them may be absent. That distinction is the whole point of
 * the pass: `SYSTEM = 0` used to mean "nobody wired the question", and the
 * contract exists so that it can only ever mean "the question was asked and
 * the answer was none".
 *
 * PROVENANCE IS NEVER AGGREGATED. `/world` reported `RELATIONS 38/38` while 25
 * of those 38 were DEMO — a single figure that read as thirty-eight real
 * relations. REAL, DERIVED and DEMO are separate counts here and there is no
 * combined total to misread.
 *
 * Nothing in this module invents a record. It reports what the stores hold.
 */
import { REJECTION_TEXT, type SystemRejectionReason } from "./systemEvidenceProjection";

export interface ProvenanceCounts {
  real: number;
  derived: number;
  demo: number;
  /** Deliberately NOT a sum. Present so a caller can show the reference tier
   *  without folding it into the real one. */
  reference: number;
}

export interface WorldDataContract {
  /* ── external world ──────────────────────────────────────────────────
     Empty today: PHILOS holds no external event, source or external
     verification. The fields exist so the absence is visible rather than
     structural. */
  external_events: readonly { event_id: string; at: string; label: string; source_id?: string }[];
  verified_sources: readonly { source_id: string; name: string; kind: string }[];
  external_evidence: readonly { evidence_id: string; target_id: string; level: string; source_id?: string }[];

  /* ── system scale ────────────────────────────────────────────────────*/
  /** Records that PASSED the unchanged SYSTEM gate. */
  system_eligible_records: readonly { record_id: string; evidence_id: string }[];
  /** Records the projection actually placed at SYSTEM scale. */
  system_observed_records: readonly { record_id: string; as: string }[];
  /** Verified, but not externally — the honest "close, not there" bucket. */
  unresolved_system_candidates: readonly { record_id: string; evidence_id: string; level: string }[];
  /** Why each candidate did not pass. Never summarised away. */
  rejection_reasons: readonly { record_id: string; reason: SystemRejectionReason; detail: string }[];
  /** Rejections rolled up by reason, for a screen that wants the shape. */
  rejection_summary: Readonly<Partial<Record<SystemRejectionReason, number>>>;

  /* ── provenance, kept apart ──────────────────────────────────────────*/
  real_count: number;
  derived_count: number;
  demo_count: number;
  provenance: ProvenanceCounts;

  /** One line a screen can print about why SYSTEM is what it is. */
  system_zero_reason: string | null;
}

export interface ContractInput {
  chronology: readonly { record_id: string; provenance: string }[];
  systemEvidence: ReadonlyMap<string, string>;
  rejections: readonly { record_id: string; reason: SystemRejectionReason; detail: string }[];
  unresolvedCandidates: readonly { record_id: string; evidence_id: string; level: string }[];
  /** Objects the projection produced, so observed ≠ eligible stays visible. */
  objects: readonly { record_id: string; scales: { SYSTEM: { present: boolean; as?: string } } }[];
  evidence: readonly { evidence_id: string; effect_id: string; level: string | null; provenance: string }[];
}

export function buildWorldDataContract(input: ContractInput): WorldDataContract {
  const prov = (p: string) => input.chronology.filter((c) => c.provenance === p).length;

  const summary: Partial<Record<SystemRejectionReason, number>> = {};
  for (const r of input.rejections) summary[r.reason] = (summary[r.reason] ?? 0) + 1;

  const eligible = [...input.systemEvidence.entries()].map(([record_id, evidence_id]) => ({ record_id, evidence_id }));
  const observed = input.objects
    .filter((o) => o.scales.SYSTEM.present)
    .map((o) => ({ record_id: o.record_id, as: o.scales.SYSTEM.as ?? "" }));

  /* The sentence the screen is allowed to print. It names the DOMINANT real
     reason rather than a generic emptiness, so "no channel" and "no external
     verification" can never read the same. */
  const system_zero_reason = observed.length > 0 ? null : (() => {
    if (input.chronology.length === 0) return "אין רשומות כלל בכרונולוגיה";
    const ranked = (Object.entries(summary) as [SystemRejectionReason, number][])
      .sort((a, b) => b[1] - a[1]);
    if (ranked.length === 0) return "אין מועמדים — הערוץ מחובר ולא הגיעו רשומות";
    const [reason, n] = ranked[0];
    const ext = input.evidence.filter((e) => e.level === "external_verified" && e.provenance !== "DEMO").length;
    return `הערוץ מחובר. ${input.evidence.length} רשומות ראיה נבדקו, מתוכן ${ext} באימות חיצוני. הסיבה השכיחה לאי-הכללה: ${REJECTION_TEXT[reason] ?? reason} (${n})`;
  })();

  return {
    // No store produces these yet. Empty arrays, present shape.
    external_events: [],
    verified_sources: [],
    external_evidence: input.evidence
      .filter((e) => e.level === "external_verified")
      .map((e) => ({ evidence_id: e.evidence_id, target_id: e.effect_id, level: e.level! })),

    system_eligible_records: eligible,
    system_observed_records: observed,
    unresolved_system_candidates: [...input.unresolvedCandidates],
    rejection_reasons: [...input.rejections],
    rejection_summary: summary,

    real_count: prov("REAL"),
    derived_count: prov("DERIVED"),
    demo_count: prov("DEMO"),
    provenance: { real: prov("REAL"), derived: prov("DERIVED"), demo: prov("DEMO"), reference: prov("REFERENCE") },

    system_zero_reason,
  };
}
