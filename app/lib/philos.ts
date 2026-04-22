// PHILOS NEXUS — core schema, store, helpers

export type DominantForce =
  | "emotional"
  | "rational"
  | "physical"
  | "ego"
  | "social"
  | "id";

export type NodeContext =
  | "work"
  | "social"
  | "health"
  | "money"
  | "learning";

export type Direction = "forward" | "stuck" | "backward";
export type Impact = "yes" | "partial" | "no";

export type UserNode = {
  id: string;
  name: string;

  lat: number;
  lng: number;

  // philos core
  event: string;
  intensity: number;             // 1..10
  context: NodeContext;
  dominantForce: DominantForce;
  conflict: string | null;
  action: string;
  direction: Direction;

  // derived
  value: number;                 // = intensity
  impact: Impact;
  trustScore: number;            // 0..100
  createdAt: number;
};

export const FORCE_COLOR: Record<DominantForce, string> = {
  emotional: "#38bdf8", // blue
  rational:  "#22c55e", // green
  physical:  "#ef4444", // red
  ego:       "#a78bfa", // purple
  social:    "#fb923c", // orange
  id:        "#fbbf24", // yellow
};

export const FORCE_LABEL: Record<DominantForce, string> = {
  emotional: "רגשי",
  rational:  "רציונלי",
  physical:  "גופני",
  ego:       "אגו",
  social:    "חברתי",
  id:        "דחף",
};

export const CONTEXT_LABEL: Record<NodeContext, string> = {
  work:     "עבודה",
  social:   "חברתי",
  health:   "בריאות",
  money:    "כסף",
  learning: "למידה",
};

export const DIRECTION_LABEL: Record<Direction, string> = {
  forward:  "קדימה",
  stuck:    "תקוע",
  backward: "אחורה",
};

/* ---------- store ---------- */

const STORE_KEY = "philos.nodes";

export function loadNodes(): UserNode[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveNode(n: UserNode): UserNode[] {
  const nodes = loadNodes();
  nodes.push(n);
  localStorage.setItem(STORE_KEY, JSON.stringify(nodes));
  return nodes;
}

export function clearNodes() {
  localStorage.removeItem(STORE_KEY);
}

/* ---------- derivations ---------- */

export function directionToImpact(d: Direction): Impact {
  if (d === "forward")  return "yes";
  if (d === "stuck")    return "partial";
  return "no";
}

/**
 * trustScore:
 *  base 50
 *  + intensity*2 (higher intensity = stronger signal)
 *  + direction bonus (+25/0/-20)
 *  + consistency: same dominantForce as prior nodes → +4 per match (cap 20)
 *  + event text substance (>= 20 chars → +5)
 *  clamp 0..100
 */
export function computeTrust(
  intensity: number,
  direction: Direction,
  dominantForce: DominantForce,
  event: string,
  prior: UserNode[],
): number {
  let s = 50;
  s += intensity * 2;
  s += direction === "forward" ? 25 : direction === "stuck" ? 0 : -20;
  const matches = prior.filter(p => p.dominantForce === dominantForce).length;
  s += Math.min(20, matches * 4);
  if ((event || "").trim().length >= 20) s += 5;
  return Math.max(0, Math.min(100, Math.round(s)));
}

/* ---------- geo ---------- */

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ---------- links ---------- */

export type LinkType =
  | "alignment"      // same context or same force — shared ground
  | "complementary"  // opposite forces that complete each other
  | "influence"      // directional: one forward drives the other
  | "opportunity";   // match in context + different force + both active

export type Link = {
  source: string;
  target: string;
  strength: number; // 0..1
  type: LinkType;
  reason: string;
  directional: boolean;
};

export const LINK_COLOR: Record<LinkType, string> = {
  alignment:     "#22c55e",
  complementary: "#38bdf8",
  influence:     "#a78bfa",
  opportunity:   "#fb923c",
};

export const LINK_LABEL: Record<LinkType, string> = {
  alignment:     "התאמה",
  complementary: "השלמה",
  influence:     "השפעה",
  opportunity:   "הזדמנות",
};

/** forces that "complete" each other (symmetric pairs) */
const COMPLEMENT: Record<DominantForce, DominantForce> = {
  emotional: "rational",
  rational:  "emotional",
  ego:       "social",
  social:    "ego",
  id:        "rational",
  physical:  "emotional",
};

function classifyLink(a: UserNode, b: UserNode): Link | null {
  const sameCtx   = a.context === b.context;
  const sameForce = a.dominantForce === b.dominantForce;
  const complement = COMPLEMENT[a.dominantForce] === b.dominantForce;

  const distanceKm = haversineKm(a, b);
  const distanceFactor = Math.max(0, 1 - distanceKm / 10000); // closer = higher

  const valueMatch =
    sameForce  ? 1   :
    complement ? 0.8 :
    sameCtx    ? 0.4 : 0;

  const contextMatch = sameCtx ? 1 : 0;
  const forceMatch   = sameForce ? 1 : complement ? 0.6 : 0;

  // strength = valueMatch*0.4 + contextMatch*0.2 + forceMatch*0.2 + distanceFactor*0.2
  const strength =
    valueMatch     * 0.4 +
    contextMatch   * 0.2 +
    forceMatch     * 0.2 +
    distanceFactor * 0.2;

  if (strength < 0.25) return null;

  const bothForward = a.direction === "forward" && b.direction === "forward";
  const oneForwardOneStuck =
    (a.direction === "forward" && b.direction !== "forward") ||
    (b.direction === "forward" && a.direction !== "forward");

  let type: LinkType;
  let reason: string;
  let directional = false;

  if (oneForwardOneStuck) {
    type = "influence";
    directional = true;
    const mover = a.direction === "forward" ? a : b;
    const rest  = a.direction === "forward" ? b : a;
    reason = `${mover.name} בתנועה קדימה — מושך את ${rest.name}`;
  } else if (sameCtx && !sameForce && bothForward) {
    type = "opportunity";
    reason = `אותו קונטקסט (${CONTEXT_LABEL[a.context]}), כוחות שונים, שניהם בתנועה`;
  } else if (complement) {
    type = "complementary";
    reason = `${FORCE_LABEL[a.dominantForce]} משלים את ${FORCE_LABEL[b.dominantForce]}`;
  } else {
    type = "alignment";
    reason = sameForce && sameCtx
      ? `אותו כוח (${FORCE_LABEL[a.dominantForce]}) + קונטקסט (${CONTEXT_LABEL[a.context]})`
      : sameForce
        ? `אותו כוח: ${FORCE_LABEL[a.dominantForce]}`
        : `אותו קונטקסט: ${CONTEXT_LABEL[a.context]}`;
  }

  const sourceId = directional
    ? (a.direction === "forward" ? a.id : b.id)
    : a.id;
  const targetId = directional
    ? (a.direction === "forward" ? b.id : a.id)
    : b.id;

  return {
    source: sourceId,
    target: targetId,
    strength: Math.min(1, strength),
    type,
    reason,
    directional,
  };
}

export function buildLinks(nodes: UserNode[]): Link[] {
  const out: Link[] = [];
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const link = classifyLink(nodes[i], nodes[j]);
      if (link) out.push(link);
    }
  }
  return out;
}

/* ---------- filter ---------- */

export type Filter = {
  context?: NodeContext;
  minIntensity?: number;
  dominantForce?: DominantForce;
  maxDistanceKm?: number;
  center?: { lat: number; lng: number };
};

export function applyFilter(nodes: UserNode[], f: Filter): UserNode[] {
  return nodes.filter(n => {
    if (f.context && n.context !== f.context) return false;
    if (typeof f.minIntensity === "number" && n.intensity < f.minIntensity) return false;
    if (f.dominantForce && n.dominantForce !== f.dominantForce) return false;
    if (typeof f.maxDistanceKm === "number" && f.center) {
      if (haversineKm(f.center, n) > f.maxDistanceKm) return false;
    }
    return true;
  });
}

/* ---------- ranking ---------- */

export type RankQuery = {
  context?: NodeContext;
  dominantForce?: DominantForce;
  center?: { lat: number; lng: number };
};

export type Ranked = UserNode & { score: number; rank: number };

/**
 * Literal PHILOS ranking formula:
 *   score =
 *     (intensity     * 0.3)  +
 *     (trustScore    * 0.25) +
 *     (contextMatch  * 0.2)  +
 *     (forceMatch    * 0.15) +
 *     (directionScore* 0.1)  -
 *     (distanceKm / 10000)
 */
export function computeScore(n: UserNode, q: RankQuery): number {
  const contextMatch   = q.context       && n.context       === q.context       ? 1 : 0;
  const forceMatch     = q.dominantForce && n.dominantForce === q.dominantForce ? 1 : 0;
  const directionScore = n.direction === "forward" ? 1 : n.direction === "stuck" ? 0.5 : 0;
  const distanceKm     = q.center ? haversineKm(q.center, n) : 0;
  const distancePenalty = distanceKm / 10000;

  return (
    (n.intensity  * 0.3 ) +
    (n.trustScore * 0.25) +
    (contextMatch * 0.2 ) +
    (forceMatch   * 0.15) +
    (directionScore * 0.1) -
    distancePenalty
  );
}

export function rankNodes(nodes: UserNode[], q: RankQuery): Ranked[] {
  return nodes
    .map(n => ({ ...n, score: computeScore(n, q), rank: 0 }))
    .sort((a, b) => b.score - a.score)
    .map((n, i) => ({ ...n, rank: i + 1 }));
}
