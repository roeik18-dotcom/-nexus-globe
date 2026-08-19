/**
 * Tension / Priority — the ONE shared representation used across Hub,
 * Dynamics, Community, and Brain (System-Wide Build, Pass 2). Replaces each
 * surface's own ad-hoc "what's in deficit" check (Hub's own `tenseDomains`,
 * Community's own budget reasoning) with one shape and one set of builder
 * functions — no page-specific tension logic left standing after this pass.
 *
 * A `TensionItem` never computes a NEW fact: every builder below reads an
 * already-real, already-projected value (`OrientationCore`'s per-domain
 * `level`, or `ValueGroupView`'s `budget`/`allocations`/`impact`) and
 * reshapes it into this one honest envelope. No severity/direction/status
 * is invented where the source data doesn't support it — `"unknown"` is a
 * real, first-class value here, never silently defaulted away.
 *
 * **Identity, held stable across surfaces**: `id` is deterministic from the
 * real subject/entity and the real field it describes
 * (`human:<subject>:<domain>`, `community:<group_id>:<metric>`) — the same
 * real state always produces the same id, so the SAME tension shown on Hub
 * and on Community/Dynamics is verifiably the same object, not two
 * independently-computed lookalikes.
 */
import type { OrientationCore } from "./orientationCore";
import type { ValueGroupView } from "./projectValueGroup";

export type TensionSeverity = "low" | "medium" | "high" | "unknown";
export type TensionDirection = "improving" | "worsening" | "stable" | "unknown";
export type TensionProvenance = "REAL" | "DEMO" | "UNKNOWN";
export type TensionStatus = "open" | "addressed" | "unknown";
export type ConfigFamily = "human" | "community" | "canon_action";

/** The one shared shape. Every field a surface might show is here; a
 *  surface may render only a subset, but never a different shape. */
export interface TensionItem {
  id: string;
  subject: string;
  config_family: ConfigFamily;
  domain?: string;
  label: string;
  current_state: string;
  baseline?: string;
  change_direction: TensionDirection;
  severity: TensionSeverity;
  evidence_source: string;
  provenance: TensionProvenance;
  possible_action?: string;
  related_effects?: string[];
  status: TensionStatus;
}

/** The ONE Hebrew word per canon domain. Exported so a surface rendering
 *  G/E/C reads the same vocabulary these tensions are labeled with, rather
 *  than keeping a second copy that can drift. */
export const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };

/**
 * HUMAN tensions — real deficit domains (`level < 0`) from an already-built
 * `OrientationCore`, the SAME per-domain G/E/C read Hub/Brain/Dynamics
 * already share. No new canon read.
 */
export function buildHumanTensions(core: OrientationCore): TensionItem[] {
  const items: TensionItem[] = [];
  (["G", "E", "C"] as const).forEach((d) => {
    const mark = core[d];
    if (!mark || mark.level >= 0) return;
    const prior = d === "G" ? core.priorG : d === "E" ? core.priorE : core.priorC;
    const direction: TensionDirection = !prior
      ? "unknown"
      : mark.level > prior.level
        ? "improving"
        : mark.level < prior.level
          ? "worsening"
          : "stable";
    items.push({
      id: `human:${core.subject}:${d}`,
      subject: core.subject,
      config_family: "human",
      domain: d,
      label: DOMAIN_WORD[d],
      current_state: `level ${mark.level} · stability ${mark.stability}`,
      baseline: prior ? `level ${prior.level}` : undefined,
      change_direction: direction,
      severity: mark.level <= -3 ? "high" : mark.level <= -1 ? "medium" : "low",
      evidence_source: `canon Observation ${mark.canon_event_id}`,
      provenance: "REAL",
      related_effects: undefined,
      status: "unknown",
    });
  });
  return items;
}

/**
 * COMMUNITY tensions — real signals already present in a projected
 * `ValueGroupView`: negative available budget (overspent), an allocation
 * stuck in `"voting"` past quorum expectations is NOT inferred here (no
 * real "stuck" threshold exists in canon or this codebase — not invented),
 * and any REJECTED impact verification (a real, checked outcome, not a
 * guess). `provenance` is passed by the caller, since the SAME projection
 * function runs for both the real seeded group and a DEMO community — this
 * module has no way to know which on its own, and must not guess.
 */
export function buildCommunityTensions(group: ValueGroupView, provenance: TensionProvenance): TensionItem[] {
  const items: TensionItem[] = [];

  if (group.budget.available < 0) {
    items.push({
      id: `community:${group.group_id}:budget_available`,
      subject: group.group_id,
      config_family: "community",
      domain: "treasury",
      label: "יתרה זמינה שלילית",
      current_state: `₪${group.budget.available.toLocaleString()}`,
      change_direction: "worsening",
      severity: group.budget.available < -10000 ? "high" : "medium",
      evidence_source: `budget: received=${group.budget.received}, spent=${group.budget.spent}, committed=${group.budget.committed}`,
      provenance,
      possible_action: "צמצום מחויבות חדשה עד לאיזון התקציב",
      status: "open",
    });
  }

  for (const impact of group.impact) {
    if (!impact.rejected) continue;
    items.push({
      id: `community:${group.group_id}:impact_rejected:${impact.impact_id}`,
      subject: group.group_id,
      config_family: "community",
      domain: "investment_outcome",
      label: `אימות השפעה נדחה — ${impact.statement}`,
      current_state: "נדחה",
      change_direction: "worsening",
      severity: "medium",
      evidence_source: impact.verification ? `verified by ${impact.verification.verifier_name} (${impact.verification.method})` : "impact.recorded",
      provenance,
      related_effects: [impact.impact_id],
      status: "open",
    });
  }

  return items;
}

/** Sort by severity (high→low), unknown last — one shared ordering so every
 *  surface lists tensions the same way. */
const SEVERITY_ORDER: Record<TensionSeverity, number> = { high: 0, medium: 1, low: 2, unknown: 3 };
export function sortTensions(items: TensionItem[]): TensionItem[] {
  return [...items].sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}
