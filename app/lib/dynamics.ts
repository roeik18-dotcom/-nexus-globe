// NEXUS DYNAMICS ENGINE
// State → Movement → Evolution → Consequences
//
// 10 layers: Orientation · Evolution · Timelines · Flows ·
//            Tensions · Pulse · Events · Alternatives · LongTerm · Ecosystem

import type { UserNode, DominantForce } from "./philos";
import { FORCE_LABEL, FORCE_COLOR } from "./philos";

// ─── Types ────────────────────────────────────────────────────────────

export interface EvolutionPath {
  current:   DominantForce;
  balance:   DominantForce | "id";
  next:      DominantForce | null;
  longTerm:  string;             // descriptive role
  currentDesc: string;
  balanceDesc: string;
  nextDesc:    string;
}

export interface ParallelTimeline {
  label:       string;           // "Path A"
  force:       DominantForce;
  action:      string;
  trustDelta:  number;
  connections: number;
  risk:        string;
  opportunity: string;
}

export interface AlternativeFuture {
  label:         string;
  force:         DominantForce;
  week1Trust:    number;
  week1Conns:    number;
  month1Trust:   number;
  month1Opps:    number;
  description:   string;
}

export interface FutureComparison {
  current:     AlternativeFuture;
  alternative: AlternativeFuture;
  insight:     string;
}

export interface TimeProjection {
  period:      "1d" | "1w" | "1m" | "1y";
  label:       string;
  trustDelta:  number;
  opportunities: number;
  connections: number;
  state:       string;
}

export interface LongTermImpact {
  node:        UserNode;
  trustBase:   number;
  projections: TimeProjection[];
  altProjections: TimeProjection[]; // if they switched path
  altForce:    DominantForce;
}

export interface TensionZone {
  forceA:   DominantForce;
  forceB:   DominantForce;
  level:    "low" | "medium" | "high" | "critical";
  count:    number;          // nodes in tension
  risk:     string;
  growth:   string;
}

export interface SystemFlow {
  label:     string;
  fromForce: DominantForce;
  toForce:   DominantForce;
  magnitude: number;         // 0-100
  trend:     "rising" | "stable" | "falling";
  pct:       number;
  userCount: number;
}

// ─── Evolution map ────────────────────────────────────────────────────

const EVO: Record<string, {
  balance: DominantForce | "id";
  next: DominantForce | null;
  longTerm: string;
  currentDesc: string;
  balanceDesc: string;
  nextDesc: string;
}> = {
  id:        { balance: "superego", next: "physical",  longTerm: "יזם אנרגטי",     currentDesc: "אנרגיה גולמית מחפשת כיוון",            balanceDesc: "ערכים מכוונים את הדחף",        nextDesc: "הגוף לוקח את הראשות" },
  physical:  { balance: "emotional", next: "emotional", longTerm: "מובל עצמי",       currentDesc: "כוח פיזי מחפש ביטוי",                  balanceDesc: "הרגש מלמד את הגוף לשמוע",      nextDesc: "הרגש מקבל צורה" },
  emotional: { balance: "rational",  next: "rational",  longTerm: "מנהיג אמפתי",     currentDesc: "רגש מעמיק, אנרגיה רגשית גבוהה",        balanceDesc: "שכל מנחה את הלב",              nextDesc: "מחשבה עמוקה צומחת" },
  rational:  { balance: "emotional", next: "social",    longTerm: "חוקר-בונה",        currentDesc: "חשיבה ברורה, ניתוח עמוק",              balanceDesc: "רגש ממלא את הניתוח בחיים",     nextDesc: "ידע זורם לקהילה" },
  social:    { balance: "ego",       next: "ego",       longTerm: "בונה קהילות",      currentDesc: "אנרגיה חברתית, חיבורים נוצרים",        balanceDesc: "פרטיות בריאה שומרת על העצמי",  nextDesc: "כוח עצמי מתחזק" },
  ego:       { balance: "social",    next: "superego",  longTerm: "מנהיג ערכי",       currentDesc: "זהות חזקה, שאיפות גבוהות",              balanceDesc: "קהילה מגרדת את האינפלציה",     nextDesc: "ערכים לוקחים את ההובלה" },
  superego:  { balance: "id",        next: null,        longTerm: "חזון עולמי",       currentDesc: "ערכים עמוקים, אחריות גבוהה",            balanceDesc: "איד מחזיר ספונטניות ורענון",   nextDesc: "אינטגרציה מלאה" },
};

// ─── Layer 2: Evolution Path ──────────────────────────────────────────

export function getEvolutionPath(force: DominantForce): EvolutionPath {
  const e = EVO[force] ?? EVO.rational;
  return { current: force, ...e };
}

// ─── Layer 3: Parallel Timelines ─────────────────────────────────────

const TIMELINE_DEFS: Array<{
  label: string; force: DominantForce;
  trustDelta: number; connections: number; risk: string; opportunity: string;
  action: string;
}> = [
  { label: "A — גופני",   force: "physical",  trustDelta: 2,  connections: 1, risk: "שחיקה",          opportunity: "עיגון ונוכחות",           action: "פעל ישירות — פגישה, מייל, יצירת דבר" },
  { label: "B — רגשי",    force: "emotional", trustDelta: 3,  connections: 3, risk: "ריחוף",          opportunity: "חיבור עמוק",               action: "עבד את הרגש לפני שאתה פועל" },
  { label: "C — רציונלי", force: "rational",  trustDelta: 4,  connections: 2, risk: "ניתוח-שיתוק",   opportunity: "בהירות ותכנון",             action: "מפה אפשרויות ובחר אחת" },
  { label: "D — חברתי",   force: "social",    trustDelta: 5,  connections: 5, risk: "אובדן עצמי",    opportunity: "רשת ועזרה הדדית",           action: "פנה לאחר — שתף, שאל, תרום" },
];

export function getParallelTimelines(_force: DominantForce, _state: string): ParallelTimeline[] {
  return TIMELINE_DEFS;
}

// ─── Layer 8: Alternative Futures ────────────────────────────────────

function projectFuture(force: DominantForce, trustBase: number): AlternativeFuture {
  const multipliers: Record<string, { trust: number; conns: number; opps: number }> = {
    id:        { trust: 1.0, conns: 0.5, opps: 0.4 },
    physical:  { trust: 1.2, conns: 0.8, opps: 0.6 },
    emotional: { trust: 1.5, conns: 2.0, opps: 0.8 },
    rational:  { trust: 1.8, conns: 1.2, opps: 1.2 },
    social:    { trust: 2.0, conns: 3.0, opps: 1.5 },
    ego:       { trust: 1.3, conns: 0.6, opps: 1.0 },
    superego:  { trust: 1.6, conns: 0.9, opps: 0.7 },
  };
  const m = multipliers[force] ?? multipliers.rational;
  const base = Math.max(trustBase, 5);
  return {
    label:       FORCE_LABEL[force],
    force,
    week1Trust:  Math.round(base * m.trust * 0.1),
    week1Conns:  Math.round(m.conns * 1.5),
    month1Trust: Math.round(base * m.trust * 0.4),
    month1Opps:  Math.round(m.opps * 3),
    description: EVO[force]?.longTerm ?? force,
  };
}

export function getFutureComparison(node: UserNode, trustBase: number): FutureComparison {
  const current = projectFuture(node.dominantForce, trustBase);
  const altForce = (EVO[node.dominantForce]?.next ?? "social") as DominantForce;
  const alternative = projectFuture(altForce, trustBase);
  const trustGain = alternative.month1Trust - current.month1Trust;
  const insight = trustGain > 5
    ? `מעבר ל${FORCE_LABEL[altForce]} צפוי להוסיף ${trustGain} אמון ו-${alternative.month1Opps - current.month1Opps} הזדמנויות תוך חודש`
    : `שני הנתיבים דומים — המשך הנוכחי עם תוצאות יציבות`;
  return { current, alternative, insight };
}

// ─── Layer 9: Long Term Impact ────────────────────────────────────────

function makeProjection(period: TimeProjection["period"], label: string, mult: number, trust: number, force: DominantForce): TimeProjection {
  const m = { id: 0.6, physical: 0.9, emotional: 1.3, rational: 1.5, social: 1.8, ego: 1.0, superego: 1.2 }[force] ?? 1;
  return {
    period, label,
    trustDelta:    Math.round(trust * m * mult),
    opportunities: Math.round(m * mult * 2),
    connections:   Math.round(m * mult * 1.5),
    state: mult < 0.2
      ? "שינוי קטן"
      : mult < 0.6
        ? "צמיחה מורגשת"
        : mult < 1.5
          ? "השפעה משמעותית"
          : "שינוי מערכתי",
  };
}

export function getLongTermImpact(node: UserNode, trustBase: number): LongTermImpact {
  const f = node.dominantForce;
  const alt = (EVO[f]?.next ?? "social") as DominantForce;
  return {
    node,
    trustBase,
    projections: [
      makeProjection("1d", "יום 1",   0.05, trustBase, f),
      makeProjection("1w", "שבוע 1",  0.2,  trustBase, f),
      makeProjection("1m", "חודש 1",  0.7,  trustBase, f),
      makeProjection("1y", "שנה 1",   3.0,  trustBase, f),
    ],
    altProjections: [
      makeProjection("1d", "יום 1",   0.05, trustBase, alt),
      makeProjection("1w", "שבוע 1",  0.2,  trustBase, alt),
      makeProjection("1m", "חודש 1",  0.7,  trustBase, alt),
      makeProjection("1y", "שנה 1",   3.0,  trustBase, alt),
    ],
    altForce: alt,
  };
}

// ─── Layer 5: Tension Zones ───────────────────────────────────────────

const TENSION_PAIRS: Array<{
  a: DominantForce; b: DominantForce; risk: string; growth: string;
}> = [
  { a: "id",       b: "superego", risk: "דחף עיוור נגד ביקורת כרונית",   growth: "ספונטניות עם כיוון" },
  { a: "ego",      b: "social",   risk: "אינפלציה אגואיסטית",            growth: "מנהיגות שירותית" },
  { a: "emotional",b: "rational", risk: "הצפה רגשית מול ניתוק מחשבתי",  growth: "חכמת לב+שכל" },
  { a: "physical", b: "superego", risk: "גוף מול מצפון",                  growth: "מוסר מגולם בפעולה" },
];

export function detectTensionZones(nodes: UserNode[]): TensionZone[] {
  if (!nodes.length) return [];
  const fd: Record<string, number> = {};
  nodes.forEach(n => { fd[n.dominantForce] = (fd[n.dominantForce] || 0) + 1; });
  const total = nodes.length;

  return TENSION_PAIRS.map(pair => {
    const cA = fd[pair.a] ?? 0;
    const cB = fd[pair.b] ?? 0;
    const ratio = (cA + cB) / total;
    const diff  = Math.abs(cA - cB) / Math.max(cA + cB, 1);
    const level: TensionZone["level"] =
      ratio > 0.5 && diff < 0.3  ? "critical" :
      ratio > 0.35               ? "high"     :
      ratio > 0.2                ? "medium"   : "low";
    return { forceA: pair.a, forceB: pair.b, level, count: cA + cB, risk: pair.risk, growth: pair.growth };
  }).filter(t => t.count > 0).sort((a, b) => {
    const order = { critical: 3, high: 2, medium: 1, low: 0 };
    return order[b.level] - order[a.level];
  });
}

// ─── Layer 4: System Flows ────────────────────────────────────────────

const FLOW_DEFS: Array<{ label: string; fromForce: DominantForce; toForce: DominantForce }> = [
  { label: "Trust Flow",       fromForce: "emotional", toForce: "social"    },
  { label: "Value Flow",       fromForce: "rational",  toForce: "superego"  },
  { label: "Opportunity Flow", fromForce: "ego",       toForce: "social"    },
  { label: "Knowledge Flow",   fromForce: "rational",  toForce: "physical"  },
  { label: "Support Flow",     fromForce: "social",    toForce: "emotional" },
];

export function getSystemFlows(nodes: UserNode[]): SystemFlow[] {
  if (!nodes.length) return [];
  const fd: Record<string, number> = {};
  nodes.forEach(n => { fd[n.dominantForce] = (fd[n.dominantForce] || 0) + 1; });
  const total = nodes.length;
  const fwdRatio = nodes.filter(n => n.direction === "forward").length / total;

  return FLOW_DEFS.map(def => {
    const cFrom = fd[def.fromForce] ?? 0;
    const cTo   = fd[def.toForce]   ?? 0;
    const magnitude = Math.round(((cFrom + cTo) / total) * 100);
    const trend: SystemFlow["trend"] = fwdRatio > 0.6 ? "rising" : fwdRatio > 0.35 ? "stable" : "falling";
    return {
      ...def,
      magnitude,
      trend,
      pct: Math.round(((cFrom + cTo) / total) * 100),
      userCount: cFrom + cTo,
    };
  }).filter(f => f.userCount > 0).sort((a, b) => b.magnitude - a.magnitude);
}

// ─── Layer: Executable Transition ────────────────────────────────────

export interface DynamicsEvent {
  id:         string;
  type:       "DYNAMICS_TRANSITION";
  nodeId:     string;
  nodeName:   string;
  message:    string;
  ts:         number;
  trustDelta: number;
  fromForce:  DominantForce;
  toForce:    DominantForce | null;
}

export interface DynamicsTransition {
  updatedNode:      UserNode;
  trustDelta:       number;
  reputationDelta:  number;
  opportunityDelta: number;
  stressDelta:      number;
  forceShift:       { from: DominantForce; to: DominantForce } | null;
  event:            DynamicsEvent;
}

const EVENTS_KEY = "nexus:events";

export function loadDynamicsEvents(): DynamicsEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function _saveEvent(ev: DynamicsEvent): void {
  if (typeof window === "undefined") return;
  try {
    const all = loadDynamicsEvents();
    all.unshift(ev);
    if (all.length > 50) all.splice(50);
    localStorage.setItem(EVENTS_KEY, JSON.stringify(all));
  } catch {}
}

/**
 * Apply a parallel-timeline choice to a node.
 * Deterministic rules — no AI, no backend.
 *
 * Flow: STATE → PATH → ACTION → TRANSITION → NEW STATE → LIVE EVENT
 */
export function applyDynamicsAction(
  node:     UserNode,
  timeline: ParallelTimeline,
): DynamicsTransition {
  // Force shift if timeline uses a different force
  const forceShift = timeline.force !== node.dominantForce
    ? { from: node.dominantForce, to: timeline.force }
    : null;

  // Deltas
  const trustDelta  = timeline.trustDelta;
  const repDelta    = Math.round(timeline.trustDelta * 0.6);
  const oppDelta    = timeline.connections > 2 ? 1 : 0;
  const stressDelta = ["social","emotional"].includes(timeline.force) ? -5 : 3;

  // Updated node
  const updatedNode: UserNode = {
    ...node,
    trustScore:    Math.min(node.trustScore + trustDelta, 100),
    dominantForce: forceShift ? forceShift.to : node.dominantForce,
    direction:     trustDelta >= 4 ? "forward" : node.direction,
    event:         `[Dynamics] ${FORCE_LABEL[timeline.force]} — ${timeline.action}`,
    action:        timeline.action,
    createdAt:     Date.now(),
  };

  // Event message
  const shiftMsg = forceShift
    ? `${FORCE_LABEL[forceShift.from]} → ${FORCE_LABEL[forceShift.to]}`
    : FORCE_LABEL[timeline.force];
  const message = `${node.name}: ${shiftMsg} יצר +${trustDelta} אמון${timeline.connections > 0 ? ` ו-${timeline.connections} קשרים` : ""}`;

  const event: DynamicsEvent = {
    id:         `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    type:       "DYNAMICS_TRANSITION",
    nodeId:     node.id,
    nodeName:   node.name,
    message,
    ts:         Date.now(),
    trustDelta,
    fromForce:  node.dominantForce,
    toForce:    forceShift?.to ?? null,
  };

  _saveEvent(event);

  return { updatedNode, trustDelta, reputationDelta: repDelta, opportunityDelta: oppDelta, stressDelta, forceShift, event };
}

// ─── Helpers ──────────────────────────────────────────────────────────

export const TENSION_COLOR: Record<TensionZone["level"], string> = {
  low:      "#34d399",
  medium:   "#fbbf24",
  high:     "#fb923c",
  critical: "#ef4444",
};

export const TENSION_LABEL: Record<TensionZone["level"], string> = {
  low: "נמוך", medium: "בינוני", high: "גבוה", critical: "קריטי",
};

export const FLOW_TREND_ICON: Record<SystemFlow["trend"], string> = {
  rising: "↑", stable: "→", falling: "↓",
};

export const FLOW_TREND_COLOR: Record<SystemFlow["trend"], string> = {
  rising: "#34d399", stable: "#fbbf24", falling: "#f87171",
};
