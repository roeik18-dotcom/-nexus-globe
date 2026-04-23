// PHILOS NEXUS — Need Engine
//
// Each node carries derived NEEDS (what it lacks) and OFFERS (what it can give).
// When A.needs ∩ B.offers AND B.needs ∩ A.offers, the pair completes each other.
// This turns "link exists" into "link has human meaning".
//
// Deterministic mapping — no ML, no guessing.
//   direction=forward  → node OFFERS its force's natural strengths
//   direction≠forward  → node NEEDS that force's shadow (what it's missing)
//   conflict           → adds a specific need on top
//   intensity/backward → can push recovery into the need set
//
// Pair score:
//   score = (aGetsFromB.count*0.5 + bGetsFromA.count*0.5 + bidirectionalBonus) / 3
//   bidirectional (both sides complete each other) = strongest match.

import type { UserNode, DominantForce } from "./philos";

export type NeedTag =
  | "momentum"     // תנועה
  | "grounding"    // עיגון
  | "expression"   // ביטוי
  | "structure"    // מבנה
  | "connection"   // חיבור
  | "validation"   // הכרה
  | "recovery"     // התאוששות
  | "depth"        // עומק
  | "vision"       // חזון
  | "patience";    // סבלנות

export const NEED_LABEL: Record<NeedTag, string> = {
  momentum:   "תנועה",
  grounding:  "עיגון",
  expression: "ביטוי",
  structure:  "מבנה",
  connection: "חיבור",
  validation: "הכרה",
  recovery:   "התאוששות",
  depth:      "עומק",
  vision:     "חזון",
  patience:   "סבלנות",
};

export const NEED_COLOR: Record<NeedTag, string> = {
  momentum:   "#00f5d4",
  grounding:  "#22c55e",
  expression: "#38bdf8",
  structure:  "#a78bfa",
  connection: "#fb923c",
  validation: "#f472b6",
  recovery:   "#fbbf24",
  depth:      "#818cf8",
  vision:     "#ef4444",
  patience:   "#94a3b8",
};

/** What each force OFFERS naturally when it's in motion. */
const FORCE_OFFERS: Record<DominantForce, NeedTag[]> = {
  rational:  ["depth", "structure"],
  emotional: ["expression", "connection"],
  physical:  ["grounding", "recovery"],
  ego:       ["vision", "validation"],
  social:    ["connection", "validation"],
  id:        ["momentum", "vision"],
};

/** What each force lacks (= needs) when stuck or regressing. */
const FORCE_NEEDS_STUCK: Record<DominantForce, NeedTag[]> = {
  rational:  ["momentum", "expression"],  // analysis → needs act + feel
  emotional: ["grounding", "structure"],  // flood → needs logic + form
  physical:  ["recovery", "patience"],    // body strain → needs rest
  ego:       ["grounding", "connection"], // inflation → needs humility + others
  social:    ["structure", "validation"], // people-pleasing → needs self-boundary
  id:        ["structure", "patience"],   // impulsive → needs form + waiting
};

/** Conflict tag → extra need. */
const CONFLICT_NEEDS: Record<string, NeedTag[]> = {
  analysis_paralysis: ["momentum"],
  blocked_feeling:    ["expression"],
  regression:         ["patience", "recovery"],
  image_gap:          ["grounding"],
  desire_vs_fear:     ["structure", "momentum"],
};

export type NodeNeeds = {
  needs:  NeedTag[];
  offers: NeedTag[];
};

export function deriveNeeds(n: UserNode): NodeNeeds {
  const offers = new Set<NeedTag>();
  const needs  = new Set<NeedTag>();

  if (n.direction === "forward") {
    FORCE_OFFERS[n.dominantForce].forEach(t => offers.add(t));
  } else {
    FORCE_NEEDS_STUCK[n.dominantForce].forEach(t => needs.add(t));
  }

  if (n.conflict && CONFLICT_NEEDS[n.conflict]) {
    CONFLICT_NEEDS[n.conflict].forEach(t => needs.add(t));
  }

  // deep regression + high intensity = recovery is non-negotiable
  if (n.direction === "backward" && n.intensity >= 7) {
    needs.add("recovery");
  }

  // very high forward intensity can also offer "momentum"
  if (n.direction === "forward" && n.intensity >= 8) {
    offers.add("momentum");
  }

  return {
    needs:  Array.from(needs).slice(0, 3),
    offers: Array.from(offers).slice(0, 3),
  };
}

export type NeedFit = {
  a: UserNode;
  b: UserNode;
  aNeeds: NeedTag[];
  aOffers: NeedTag[];
  bNeeds: NeedTag[];
  bOffers: NeedTag[];
  matched: {
    aGetsFromB: NeedTag[];
    bGetsFromA: NeedTag[];
  };
  score: number;          // 0..1
  bidirectional: boolean; // both sides receive
  reason: string;
  suggestion: string;
};

function suggestion(fit: {
  a: UserNode; b: UserNode;
  aGetsFromB: NeedTag[]; bGetsFromA: NeedTag[];
  bidirectional: boolean;
}): string {
  if (fit.bidirectional) {
    return `שיחה קצרה של 15 דקות ביום — כל אחד מביא את ההשלמה של השני.`;
  }
  if (fit.aGetsFromB.length) {
    return `${fit.a.name} פותח בשאלה ספציפית ל-${fit.b.name} על ${NEED_LABEL[fit.aGetsFromB[0]]}.`;
  }
  if (fit.bGetsFromA.length) {
    return `${fit.b.name} פותח בשאלה ספציפית ל-${fit.a.name} על ${NEED_LABEL[fit.bGetsFromA[0]]}.`;
  }
  return "אין צעד משותף ברור — השאר אותם מקבילים.";
}

export function needFit(a: UserNode, b: UserNode): NeedFit {
  const A = deriveNeeds(a);
  const B = deriveNeeds(b);

  const aGetsFromB = A.needs.filter(n => B.offers.includes(n));
  const bGetsFromA = B.needs.filter(n => A.offers.includes(n));

  const bidirectional = aGetsFromB.length > 0 && bGetsFromA.length > 0;

  const raw =
    aGetsFromB.length * 0.5 +
    bGetsFromA.length * 0.5 +
    (bidirectional ? 1 : 0);
  const score = Math.min(1, raw / 3);

  let reason: string;
  if (bidirectional) {
    reason =
      `השלמה הדדית — ${a.name} מקבל ` +
      `${aGetsFromB.map(t => NEED_LABEL[t]).join(" + ")} מ-${b.name}, ` +
      `ו-${b.name} מקבל ${bGetsFromA.map(t => NEED_LABEL[t]).join(" + ")} ממנו.`;
  } else if (aGetsFromB.length > 0) {
    reason = `${b.name} ממלא אצל ${a.name}: ${aGetsFromB.map(t => NEED_LABEL[t]).join(", ")}.`;
  } else if (bGetsFromA.length > 0) {
    reason = `${a.name} ממלא אצל ${b.name}: ${bGetsFromA.map(t => NEED_LABEL[t]).join(", ")}.`;
  } else {
    reason = "אין חפיפה של חוסר↔השלמה.";
  }

  return {
    a, b,
    aNeeds:  A.needs,
    aOffers: A.offers,
    bNeeds:  B.needs,
    bOffers: B.offers,
    matched: { aGetsFromB, bGetsFromA },
    score,
    bidirectional,
    reason,
    suggestion: suggestion({ a, b, aGetsFromB, bGetsFromA, bidirectional }),
  };
}

export function computeNeedFits(nodes: UserNode[]): NeedFit[] {
  const out: NeedFit[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const fit = needFit(nodes[i], nodes[j]);
      if (fit.score > 0) out.push(fit);
    }
  }
  return out.sort((x, y) => y.score - x.score);
}

/** Per-node summary for display in the pentagon panel. */
export function needSummary(n: UserNode): NodeNeeds {
  return deriveNeeds(n);
}
