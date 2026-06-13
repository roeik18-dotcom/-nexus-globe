// PHILOS NEXUS · Noa OPM — Operational Process Map (renderer).
//
// A VISUAL EXPLANATION LAYER over existing chain outputs — not a new engine.
// buildOpm(chain) verbalizes how energy/burden moves across the Philos
// departments: created → concentrates → leaks → capacity drops → orientation
// destabilizes → redistributes → stabilizes.
//
// Per-department signals are all real chain outputs:
//   load            ← collapseMap.negativeDominance  (= harmonicFlow dominanceBefore)
//   capacity applied← harmonicFlow.departments.recovery
//   missing capacity← harmonicFlow.departments.dominanceAfter
//   tension         ← baseTensionField.intensity
//   leaking flag    ← energyLeakage.strongestLeakingDepartment
//   action target   ← actionImpact.targetDepartment
// Communal (קהילתי) = the value-network carrying layer (loadModel community).
//
// Rules: capacity language (not people-count), no graphic detail, no blame, no
// therapy advice — operational/redistribution framing only.

import { computeNoaChain, type NoaChain } from "./noa";
import { buildBurdenNarrative, type EventDescriptor } from "./burdenNarrative";

// Canon department labels (internal keys stay Freudian; visible labels are canon).
const DEPT_CANON: { key: string; en: string; he: string }[] = [
  { key: "Physical",  en: "Physical",      he: "גופני" },
  { key: "Emotional", en: "Emotional",     he: "רגשי" },
  { key: "Rational",  en: "Rational",      he: "רציונלי" },
  { key: "ID",        en: "Drive",         he: "דחף" },
  { key: "EGO",       en: "Informational", he: "מיידעי" },
  { key: "SUPEREGO",  en: "Social",        he: "חברתי" },
];

// Canonical energy-flow topology (a fixed Philos model, NOT chain data): energy
// flows UP from the body to the communal layer. Each edge = "A feeds into B".
//   גופני → דחף → (רגשי | רציונלי) → (חברתי | מיידעי) → קהילתי
export const OPM_FLOW: { from: string; to: string }[] = [
  { from: "Physical",  to: "ID" },         // גופני → דחף
  { from: "ID",        to: "Emotional" },  // דחף → רגשי
  { from: "ID",        to: "Rational" },   // דחף → רציונלי
  { from: "Emotional", to: "SUPEREGO" },   // רגשי → חברתי (Social)
  { from: "Rational",  to: "EGO" },        // רציונלי → מיידעי (Informational)
  { from: "SUPEREGO",  to: "Communal" },   // חברתי → קהילתי
  { from: "EGO",       to: "Communal" },   // מיידעי → קהילתי
];

export interface DeptExplain {
  meaning: string;  // what this department is
  raises: string;   // what raises the load on it
  lowers: string;   // what lowers the load on it
  affects: string;  // how it affects other departments
  action: string;   // operational move to reduce the concentrated load
}

// Operational explanations (redistribution framing — never therapy advice).
const DEPT_EXPLAIN: Record<string, DeptExplain> = {
  Physical: {
    meaning: "The body's baseline — energy, safety, rest. Everything else runs on it.",
    raises: "acute threat, depletion, no rest",
    lowers: "a restored baseline: safety, rest, basic needs met",
    affects: "when it is low, it drains capacity from every other department",
    action: "restore one baseline anchor before more load is added",
  },
  Emotional: {
    meaning: "Connection and trust — being believed and not alone with it.",
    raises: "isolation, carrying it without a connected point of support",
    lowers: "a connected, value-aligned point that shares the load",
    affects: "low emotional capacity weakens decisions and social reach",
    action: "route emotional load to connected, value-aligned support",
  },
  Rational: {
    meaning: "Clarity, planning, decisions — turning pressure into next steps.",
    raises: "overload, uncertainty, too many open decisions at once",
    lowers: "one decision at a time and external structure",
    affects: "lost clarity multiplies every other load in the case",
    action: "reduce open decisions to one next step",
  },
  ID: {
    meaning: "Drive — raw energy and motion, what moves the case forward.",
    raises: "survival mode, panic, energy scattering",
    lowers: "recovered energy and a sense of safety",
    affects: "too little stalls everything; too much scatters it",
    action: "channel available energy into one concrete move",
  },
  EGO: {
    meaning: "Orientation — knowing where the case stands and who holds what.",
    raises: "confusion, conflicting information, no single owner",
    lowers: "consolidated facts and one coordinating point",
    affects: "without orientation, action and social steps stall",
    action: "consolidate the case into one coordinating point",
  },
  SUPEREGO: {
    meaning: "Values, responsibility, meaning — what should be shared, not carried alone.",
    raises: "carrying all of the responsibility on one person",
    lowers: "responsibility shared by people who hold the same value",
    affects: "over-responsibility drains carrying capacity everywhere",
    action: "distribute responsibility across those who share the value",
  },
};

export interface OpmDepartment {
  key: string;
  en: string;
  he: string;
  load: number;            // current load on the department
  capacityApplied: number; // capacity the network has routed in
  missingCapacity: number; // remaining concentrated load (the gap)
  tension: number;
  supported: boolean;      // some capacity reached this department
  leaking: boolean;        // strongest energy leak
  actionTarget: boolean;   // the recommended action targets this department
  explain: DeptExplain;
}

export interface OpmCommunal {
  en: string;            // "Communal"
  he: string;            // "קהילתי"
  communityPct: number;  // share the community now carries
  carryingCapacity: number; // total load the value-network absorbs
  gap: number;           // load still concentrated on the individual
}

export type FlowTone = "neutral" | "bad" | "good";
export interface OpmFlowStep { key: string; label: string; value: string; tone: FlowTone; }

// ── CAUSALITY MAP ────────────────────────────────────────────────────────────
// A rigid, event-type-agnostic spine that reframes the OPM from numbers →
// interpretation into a causal chain: event → values harmed → impact →
// community response → recovery. The structure is FIXED so different event types
// (harassment, violence, fraud, abandonment, discrimination …) are read in the
// same frame and stay comparable. Stage 1 is the consent-gated classification;
// stages 2-5 are a canonical taxonomy (categories, not scores — the numeric
// metrics stay in the energy-flow map, unchanged).
export interface OpmCausalityItem { he: string; en: string; badge?: boolean; }
export interface OpmCausalityStage {
  key: string;
  titleEn: string;   // section header, e.g. "Values Harmed"
  tone: FlowTone;    // accent (harm = bad, restoration = good)
  items: OpmCausalityItem[];
}

const CAUSALITY_VALUES_HARMED: OpmCausalityItem[] = [
  { he: "כבוד",        en: "Dignity" },
  { he: "אוטונומיה",   en: "Autonomy" },
  { he: "ביטחון אישי", en: "Personal Security" },
  { he: "אמון",        en: "Trust" },
];
const CAUSALITY_IMPACT: OpmCausalityItem[] = [
  { he: "נטל נזק",       en: "Harm Burden" },
  { he: "דליפת אנרגיה",  en: "Energy Leakage" },
  { he: "פגיעה תפקודית", en: "Functional Impairment" },
  { he: "אובדן אמון",    en: "Trust Loss" },
];
const CAUSALITY_COMMUNITY: OpmCausalityItem[] = [
  { he: "תמיכה", en: "Support" },
  { he: "אימות", en: "Validation" },
  { he: "חשיפה", en: "Exposure" },
  { he: "מימון", en: "Funding" },
];
const CAUSALITY_RECOVERY: OpmCausalityItem[] = [
  { he: "שיקום",          en: "Rehabilitation" },
  { he: "השבת אמון",      en: "Trust Restoration" },
  { he: "חזרה לתפקוד",    en: "Return to Function" },
  { he: "הזדמנויות חדשות", en: "New Opportunities" },
];

export interface OpmAction {
  label: string;
  targetEn: string;
  targetHe: string;
  energyGain: number;
  loadReduction: number;
  orientationGain: number;
}

export interface Opm {
  event: string;                    // PRIMARY descriptor (classified type when approved)
  classification: EventDescriptor;  // classified event type + consent status
  causality: OpmCausalityStage[];   // fixed causal spine: event → values → impact → community → recovery
  flow: OpmFlowStep[];
  departments: OpmDepartment[];
  communal: OpmCommunal;
  action: OpmAction;
}

function cap(s: string): string { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }
const heDept = (key: string | null | undefined) => DEPT_CANON.find(d => d.key === key)?.he ?? "—";
const enDept = (key: string | null | undefined) => DEPT_CANON.find(d => d.key === key)?.en ?? (key ?? "—");

/** Build the Operational Process Map from a chain. Pure; existing outputs only. */
export function buildOpm(chain: NoaChain = computeNoaChain(0)): Opm {
  const collapse = chain.collapse;
  const flow = chain.flow;
  const tension = chain.tension;
  const leak = chain.leakage;
  const load = chain.load;
  const orient = chain.orientation;
  const action = chain.action;

  const narrative = buildBurdenNarrative(chain);

  const departments: OpmDepartment[] = DEPT_CANON.map(d => {
    const cd = collapse?.departments.find(x => x.name === d.key);
    const fd = flow?.departments.find(x => x.department === d.key);
    const tf = tension?.fields.find(x => x.department === d.key);
    const load0 = cd?.negativeDominance ?? fd?.dominanceBefore ?? 0;
    const capacityApplied = fd?.recovery ?? 0;
    const missingCapacity = fd?.dominanceAfter ?? Math.max(0, load0 - capacityApplied);
    return {
      key: d.key, en: d.en, he: d.he,
      load: load0,
      capacityApplied,
      missingCapacity,
      tension: tf?.intensity ?? 0,
      supported: capacityApplied > 0,
      leaking: leak?.strongestLeakingDepartment === d.key,
      actionTarget: action?.targetDepartment === d.key,
      explain: DEPT_EXPLAIN[d.key],
    };
  });

  const communal: OpmCommunal = {
    en: "Communal", he: "קהילתי",
    communityPct: load?.communityPct ?? 0,
    carryingCapacity: load?.distributedLoad ?? 0,
    gap: load?.afterIndividualLoad ?? 0,
  };

  const flowSteps: OpmFlowStep[] = [
    { key: "event",        label: "Event",                  value: narrative.classification.labelEn, tone: "neutral" },
    { key: "created",      label: "Burden created",         value: `${load?.beforeIndividualLoad ?? 100}`, tone: "bad" },
    { key: "concentrates", label: "Burden concentrates",    value: `${load?.beforePct ?? 100}% on Noa`, tone: "bad" },
    { key: "leaks",        label: "Energy leaks",           value: `${leak?.totalLeakage ?? 0} / 100`, tone: "bad" },
    { key: "capacity",     label: "Capacity drops",         value: `${communal.gap} uncovered`, tone: "bad" },
    { key: "destabilizes", label: "Orientation destabilizes", value: `${orient?.score ?? 0} / 100 · ${orient?.level ?? "low"}`, tone: "bad" },
    { key: "redistributes",label: "Burden redistributes",   value: `${load?.afterPct ?? 100}% on Noa · ${communal.communityPct}% shared`, tone: "good" },
    { key: "stabilizes",   label: "Orientation stabilizes", value: `+${load?.energyRecovered ?? 0} energy`, tone: "good" },
  ];

  const opmAction: OpmAction = {
    label: cap(action?.recommendedAction ?? "stabilize"),
    targetEn: enDept(action?.targetDepartment),
    targetHe: heDept(action?.targetDepartment),
    energyGain: action?.expectedEnergyGain ?? 0,
    loadReduction: action?.expectedLoadReduction ?? 0,
    orientationGain: action?.expectedOrientationGain ?? 0,
  };

  // Causal spine — stage 1 is the consent-gated classification; the rest is the
  // fixed taxonomy. Privacy is preserved: when consent is absent the event stage
  // shows the privacy-safe label and no approval badge.
  const cls = narrative.classification;
  const eventItems: OpmCausalityItem[] = [{ he: cls.labelHe, en: cls.labelEn }];
  if (cls.classified && cls.statusHe) {
    eventItems.push({ he: cls.statusHe, en: cls.statusEn ?? "", badge: true });
  }
  const causality: OpmCausalityStage[] = [
    { key: "event",     titleEn: "Event Classification", tone: "neutral", items: eventItems },
    { key: "values",    titleEn: "Values Harmed",        tone: "bad",     items: CAUSALITY_VALUES_HARMED },
    { key: "impact",    titleEn: "Impact",               tone: "bad",     items: CAUSALITY_IMPACT },
    { key: "community", titleEn: "Community Response",    tone: "good",    items: CAUSALITY_COMMUNITY },
    { key: "recovery",  titleEn: "Recovery",             tone: "good",    items: CAUSALITY_RECOVERY },
  ];

  return {
    event: narrative.classification.labelEn,
    classification: narrative.classification,
    causality,
    flow: flowSteps,
    departments,
    communal,
    action: opmAction,
  };
}
