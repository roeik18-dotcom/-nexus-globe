// PHILOS NEXUS — System Stress Layer
//
// Measures STATES, not people.
// A UserNode is already an EVENT ("מה קורה עכשיו"), so all signals are
// computed against that event's structure — direction, intensity, conflict,
// context, dominantForce, action text — and never against identity.
//
// 5 dynamic signals, 0..100 each:
//   conflict        — internal tension in the state
//   escalation      — direction of worsening
//   harmRisk        — proximity to harm (to self or others)
//   instability     — volatility / unpredictability
//   prosocialValue  — constructive / helpful signal
//
// Rule of thumb: a signal is a PROPERTY OF AN EVENT at a point in time.
// Snapshots let us show change over time. Nothing here is a verdict.

import type { UserNode, DominantForce } from "./philos";

export type StressSignals = {
  conflict:       number;
  escalation:     number;
  harmRisk:       number;
  instability:    number;
  prosocialValue: number;
};

export const STRESS_LABEL: Record<keyof StressSignals, string> = {
  conflict:       "מתח",
  escalation:     "הסלמה",
  harmRisk:       "סיכון לפגיעה",
  instability:    "אי-יציבות",
  prosocialValue: "ערך חברתי",
};

export const STRESS_COLOR: Record<keyof StressSignals, string> = {
  conflict:       "#fb923c",  // orange
  escalation:     "#ef4444",  // red
  harmRisk:       "#dc2626",  // deep red
  instability:    "#fbbf24",  // yellow
  prosocialValue: "#22c55e",  // green
};

/* ---------- derivation (pure, deterministic) ---------- */

function clamp(x: number, lo = 0, hi = 100): number {
  return Math.min(hi, Math.max(lo, x));
}

const PROSOCIAL_RX = /(צוות|שיתוף|חבר|חבר[יה]|קהיל|משפח|עזר|תרומ|להציג|לשתף|לפרסם|ללמד)/;
const DISTRESS_RX  = /(מחמיר|שוב|עוד|מתגבר|לא עוצר|פצועה?|פוחד|לחוץ|ריב|בכ[יתה])/;

export function deriveStress(n: UserNode): StressSignals {
  const I = n.intensity; // 1..10
  const text = `${n.event || ""} ${n.action || ""}`;
  const prosocialText = PROSOCIAL_RX.test(text);
  const distressText  = DISTRESS_RX.test(text);

  /* conflict — internal tension of this state */
  let conflict = 0;
  if (n.conflict)              conflict += 40;
  if (n.direction === "stuck") conflict += 20;
  conflict += I * 3;
  if (distressText)            conflict += 10;
  conflict = clamp(conflict);

  /* escalation — trending toward worse */
  let escalation = 0;
  if (n.direction === "backward")                    escalation += 45;
  if (n.direction === "stuck")                       escalation += 10;
  if (n.conflict === "regression")                   escalation += 20;
  if (n.conflict === "desire_vs_fear")               escalation += 10;
  escalation += I * 3;
  if (distressText)                                  escalation += 10;
  escalation = clamp(escalation);

  /* harmRisk — proximity to harm (self or others) */
  let harmRisk = 0;
  if (n.direction === "backward" && I >= 7)                        harmRisk += 40;
  if (n.conflict === "regression")                                 harmRisk += 20;
  if (n.context === "health" && n.direction === "backward")        harmRisk += 20;
  if (n.dominantForce === "id" && n.direction !== "forward")       harmRisk += 15;
  if (n.dominantForce === "physical" && n.direction === "backward") harmRisk += 10;
  harmRisk += I * 1.5;
  if (distressText)                                                harmRisk += 5;
  harmRisk = clamp(harmRisk);

  /* instability — volatility */
  let instability = 0;
  if (n.conflict)                                                      instability += 25;
  if (I >= 8 || I <= 2)                                                instability += 20;
  if (n.direction === "stuck")                                         instability += 10;
  if (n.dominantForce === "emotional" || n.dominantForce === "id")     instability += 10;
  instability += I * 2;
  instability = clamp(instability);

  /* prosocialValue — constructive signal */
  let prosocialValue = 0;
  if (n.direction === "forward")                                       prosocialValue += 40;
  if (n.context === "social")                                          prosocialValue += 15;
  if (n.dominantForce === "social")                                    prosocialValue += 15;
  if (prosocialText)                                                   prosocialValue += 20;
  if (n.dominantForce === "ego" && n.direction === "forward")          prosocialValue += 5;
  if (n.direction === "forward" && I >= 7 && prosocialText)            prosocialValue += 10;
  prosocialValue = clamp(prosocialValue);

  return { conflict, escalation, harmRisk, instability, prosocialValue };
}

/* ---------- per-node dominant signal / color ---------- */

export type DominantStress = keyof StressSignals | "stable";

export function dominantStress(s: StressSignals): DominantStress {
  // prosocial only "wins" if it clearly beats the summed distress
  const distress = s.conflict + s.escalation + s.harmRisk + s.instability;
  if (s.prosocialValue * 2.5 >= distress) return "prosocialValue";

  const entries = ([
    ["harmRisk",    s.harmRisk],
    ["escalation",  s.escalation],
    ["instability", s.instability],
    ["conflict",    s.conflict],
  ] as const).sort((a, b) => b[1] - a[1]);

  const [key, val] = entries[0];
  if (val < 30) return "stable";
  return key;
}

export function stressColor(s: StressSignals): string {
  const d = dominantStress(s);
  if (d === "stable") return "#38bdf8";
  return STRESS_COLOR[d];
}

/* ---------- system-wide aggregate ---------- */

export type SystemStressAggregate = {
  count:      number;
  average:    StressSignals;
  maxHarm:    number;         // highest harmRisk in set
  riskShare:  number;         // share of nodes with harmRisk > 60
  prosocialShare: number;     // share with dominant = prosocialValue
  dominantMix: Record<DominantStress, number>;
};

export function aggregateStress(nodes: UserNode[]): SystemStressAggregate {
  if (!nodes.length) {
    return {
      count: 0,
      average: { conflict: 0, escalation: 0, harmRisk: 0, instability: 0, prosocialValue: 0 },
      maxHarm: 0, riskShare: 0, prosocialShare: 0,
      dominantMix: {
        conflict: 0, escalation: 0, harmRisk: 0,
        instability: 0, prosocialValue: 0, stable: 0,
      },
    };
  }
  const sum: StressSignals = { conflict: 0, escalation: 0, harmRisk: 0, instability: 0, prosocialValue: 0 };
  let maxHarm = 0;
  let riskN = 0;
  let prosocialN = 0;
  const mix: Record<DominantStress, number> = {
    conflict: 0, escalation: 0, harmRisk: 0,
    instability: 0, prosocialValue: 0, stable: 0,
  };

  for (const n of nodes) {
    const s = deriveStress(n);
    sum.conflict       += s.conflict;
    sum.escalation     += s.escalation;
    sum.harmRisk       += s.harmRisk;
    sum.instability    += s.instability;
    sum.prosocialValue += s.prosocialValue;
    if (s.harmRisk > maxHarm) maxHarm = s.harmRisk;
    if (s.harmRisk > 60) riskN += 1;
    const d = dominantStress(s);
    if (d === "prosocialValue") prosocialN += 1;
    mix[d] += 1;
  }

  const c = nodes.length;
  const average: StressSignals = {
    conflict:       Math.round(sum.conflict       / c),
    escalation:     Math.round(sum.escalation     / c),
    harmRisk:       Math.round(sum.harmRisk       / c),
    instability:    Math.round(sum.instability    / c),
    prosocialValue: Math.round(sum.prosocialValue / c),
  };

  return {
    count:           c,
    average,
    maxHarm,
    riskShare:       riskN      / c,
    prosocialShare:  prosocialN / c,
    dominantMix:     mix,
  };
}

/* ---------- regional binning (for globe heat overlay) ---------- */

export type StressCell = {
  key:      string;     // "latBin_lngBin"
  centerLat: number;
  centerLng: number;
  nodeIds:  string[];
  signals:  StressSignals;
  dominant: DominantStress;
};

/**
 * Grid-bin by degrees. binSize in degrees of lat/lng (e.g. 10 = large region).
 * Cells with fewer than `minNodes` aren't returned.
 */
export function binStressCells(
  nodes: UserNode[],
  binSize = 10,
  minNodes = 1,
): StressCell[] {
  const buckets: Record<string, { nodes: UserNode[]; sum: StressSignals }> = {};
  for (const n of nodes) {
    const latBin = Math.round(n.lat / binSize) * binSize;
    const lngBin = Math.round(n.lng / binSize) * binSize;
    const key = `${latBin}_${lngBin}`;
    if (!buckets[key]) {
      buckets[key] = {
        nodes: [],
        sum: { conflict: 0, escalation: 0, harmRisk: 0, instability: 0, prosocialValue: 0 },
      };
    }
    const s = deriveStress(n);
    buckets[key].nodes.push(n);
    buckets[key].sum.conflict       += s.conflict;
    buckets[key].sum.escalation     += s.escalation;
    buckets[key].sum.harmRisk       += s.harmRisk;
    buckets[key].sum.instability    += s.instability;
    buckets[key].sum.prosocialValue += s.prosocialValue;
  }

  const out: StressCell[] = [];
  for (const [key, b] of Object.entries(buckets)) {
    if (b.nodes.length < minNodes) continue;
    const [lat, lng] = key.split("_").map(Number);
    const c = b.nodes.length;
    const signals: StressSignals = {
      conflict:       Math.round(b.sum.conflict       / c),
      escalation:     Math.round(b.sum.escalation     / c),
      harmRisk:       Math.round(b.sum.harmRisk       / c),
      instability:    Math.round(b.sum.instability    / c),
      prosocialValue: Math.round(b.sum.prosocialValue / c),
    };
    out.push({
      key,
      centerLat: lat,
      centerLng: lng,
      nodeIds:   b.nodes.map(n => n.id),
      signals,
      dominant:  dominantStress(signals),
    });
  }
  return out.sort((a, b) => b.nodeIds.length - a.nodeIds.length);
}

/* ---------- time-series snapshots ---------- */

export type StressSnapshot = {
  ts:   number;                  // epoch ms (bucketed)
  count: number;
  avg:   StressSignals;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Group nodes into daily buckets (by createdAt) and aggregate signals. */
export function stressOverTime(nodes: UserNode[], days = 30): StressSnapshot[] {
  const now = Date.now();
  const start = now - (days - 1) * DAY_MS;
  const buckets: Record<number, UserNode[]> = {};
  for (const n of nodes) {
    if (n.createdAt < start) continue;
    const day = Math.floor(n.createdAt / DAY_MS) * DAY_MS;
    (buckets[day] ||= []).push(n);
  }
  const out: StressSnapshot[] = [];
  const firstDay = Math.floor(start / DAY_MS) * DAY_MS;
  for (let d = firstDay; d <= now; d += DAY_MS) {
    const dayNodes = buckets[d] ?? [];
    const agg = aggregateStress(dayNodes);
    out.push({ ts: d, count: agg.count, avg: agg.average });
  }
  return out;
}

/* ---------- helpers for callers ---------- */

export function riskBand(value: number): "low" | "elevated" | "high" | "critical" {
  if (value >= 80) return "critical";
  if (value >= 60) return "high";
  if (value >= 35) return "elevated";
  return "low";
}

export const RISK_BAND_COLOR: Record<ReturnType<typeof riskBand>, string> = {
  low:       "#22c55e",
  elevated:  "#fbbf24",
  high:      "#fb923c",
  critical:  "#ef4444",
};
