// PHILOS NEXUS — Topic-Based Debate Layer
//
// Measure POSITIONS, not people.
// Every Topic has 3 axes with a -1..+1 scale. A Stance is one user's position
// on one Topic. Edges between users on the same topic are classified by
// normalized euclidean distance:
//   < 0.3  → agree    (green)
//   < 0.7  → tension  (orange)
//   else   → conflict (red)
//
// No content moderation claims. No labeling. No personal judgement.
// Just: "where do your coordinates sit relative to theirs, on this axis."

import type { UserNode, DominantForce } from "./philos";

export type Axis = {
  key:   string; // internal id
  left:  string; // -1 pole label
  right: string; // +1 pole label
};

export type Topic = {
  id:    string;
  title: string;
  color: string;
  axes:  Axis[];   // expect exactly 3 for rendering consistency
};

export type Stance = {
  topicId:   string;
  userId:    string;
  values:    number[]; // -1..+1, length === topic.axes.length
  intensity: number;   // 0..1
  rationale?: string;
};

export type Relation = "agree" | "tension" | "conflict";

export type Edge = {
  topicId:   string;
  a:         string;   // userId
  b:         string;
  relation:  Relation;
  dist:      number;   // normalized 0..1
  closeness: number;   // 1 - dist
  axisDiffs: { key: string; diff: number }[]; // biggest axis gap first
};

export const RELATION_COLOR: Record<Relation, string> = {
  agree:    "#22c55e",
  tension:  "#fb923c",
  conflict: "#ef4444",
};

export const RELATION_LABEL: Record<Relation, string> = {
  agree:    "הסכמה",
  tension:  "מתח",
  conflict: "ניגוד",
};

export const SEED_TOPICS: Topic[] = [
  {
    id: "climate",
    title: "שינוי אקלים",
    color: "#22c55e",
    axes: [
      { key: "action_caution",        left: "פעולה מיידית",    right: "זהירות כלכלית" },
      { key: "collective_individual", left: "פתרון קולקטיבי",  right: "בחירה אישית" },
      { key: "tech_nature",           left: "פתרון טכנולוגי",  right: "התאמה לטבע" },
    ],
  },
  {
    id: "ai_regulation",
    title: "רגולציית AI",
    color: "#a78bfa",
    axes: [
      { key: "innovation_safety",  left: "חדשנות חופשית",    right: "בטיחות תחילה" },
      { key: "private_public",     left: "ידי החברות",       right: "פיקוח ציבורי" },
      { key: "trust_doubt",        left: "אמון בכלים",       right: "ספק עמוק" },
    ],
  },
  {
    id: "work_meaning",
    title: "עבודה ומשמעות",
    color: "#38bdf8",
    axes: [
      { key: "purpose_pay",           left: "משמעות",    right: "תגמול" },
      { key: "flex_stability",        left: "גמישות",    right: "יציבות" },
      { key: "self_team",             left: "עצמאות",    right: "צוות" },
    ],
  },
];

export const TOPIC_BY_ID: Record<string, Topic> =
  Object.fromEntries(SEED_TOPICS.map(t => [t.id, t]));

/* ---------- store ---------- */

const STANCE_KEY = "philos.stances";

export function loadStances(): Stance[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STANCE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveStance(s: Stance): Stance[] {
  const all = loadStances();
  const rest = all.filter(x => !(x.topicId === s.topicId && x.userId === s.userId));
  rest.push(s);
  localStorage.setItem(STANCE_KEY, JSON.stringify(rest));
  return rest;
}

export function saveStances(ss: Stance[]): Stance[] {
  if (typeof window === "undefined") return ss;
  localStorage.setItem(STANCE_KEY, JSON.stringify(ss));
  return ss;
}

export function clearStances() {
  if (typeof window !== "undefined") localStorage.removeItem(STANCE_KEY);
}

/* ---------- relation math ---------- */

function clamp(x: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, x));
}

/** Normalized euclidean distance, result in [0,1]. */
export function distance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  if (!n) return 1;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    s += d * d;
  }
  // each axis spans [-1,1] so max per-axis squared diff = 4, max total = 4n
  return Math.min(1, Math.sqrt(s) / (2 * Math.sqrt(n)));
}

export function classifyRelation(dist: number): Relation {
  if (dist < 0.3) return "agree";
  if (dist < 0.7) return "tension";
  return "conflict";
}

export function computeEdges(topic: Topic, stances: Stance[]): Edge[] {
  const sub = stances.filter(s => s.topicId === topic.id);
  const out: Edge[] = [];
  for (let i = 0; i < sub.length; i++) {
    for (let j = i + 1; j < sub.length; j++) {
      const a = sub[i], b = sub[j];
      const dist = distance(a.values, b.values);
      const axisDiffs = topic.axes
        .map((ax, idx) => ({ key: ax.key, diff: Math.abs((a.values[idx] ?? 0) - (b.values[idx] ?? 0)) }))
        .sort((x, y) => y.diff - x.diff);
      out.push({
        topicId:   topic.id,
        a:         a.userId,
        b:         b.userId,
        relation:  classifyRelation(dist),
        dist,
        closeness: 1 - dist,
        axisDiffs,
      });
    }
  }
  return out;
}

/* ---------- clusters ---------- */

export type Cluster = {
  id:       string;
  userIds:  string[];
  centroid: number[];
};

/** Greedy single-link clustering at agree threshold (0.3). */
export function clusters(topic: Topic, stances: Stance[]): Cluster[] {
  const sub = stances.filter(s => s.topicId === topic.id);
  const seen = new Set<string>();
  const out: Cluster[] = [];
  for (const s of sub) {
    if (seen.has(s.userId)) continue;
    const ids = [s.userId];
    const sum = [...s.values];
    seen.add(s.userId);
    for (const o of sub) {
      if (seen.has(o.userId)) continue;
      if (distance(s.values, o.values) < 0.3) {
        ids.push(o.userId);
        for (let i = 0; i < sum.length; i++) sum[i] += o.values[i] ?? 0;
        seen.add(o.userId);
      }
    }
    out.push({
      id: `cl_${out.length}`,
      userIds: ids,
      centroid: sum.map(x => x / ids.length),
    });
  }
  return out.sort((a, b) => b.userIds.length - a.userIds.length);
}

/* ---------- system stress ---------- */

/**
 * Aggregate measure of polarization on a topic, 0..1.
 * stress = mean(conflict dist) * share(conflict edges) * 1.5 (capped at 1).
 * Higher stress = the network is pulled apart on this topic.
 */
export function systemStress(edges: Edge[]): number {
  if (!edges.length) return 0;
  const conflicts = edges.filter(e => e.relation === "conflict");
  if (!conflicts.length) return 0;
  const avgDist = conflicts.reduce((s, e) => s + e.dist, 0) / conflicts.length;
  const share   = conflicts.length / edges.length;
  return clamp(avgDist * share * 1.5, 0, 1);
}

/* ---------- synthetic stances (demo) ---------- */

/**
 * Deterministic synthetic stance per (user, topic).
 * Base position per dominantForce, plus small per-user hash jitter (±0.2).
 * This is *not* a claim about real people — it's for the demo to light up.
 */
const FORCE_STANCE: Record<DominantForce, Record<string, number[]>> = {
  rational:  {
    climate:       [ 0.5,  0.4,  0.6],
    ai_regulation: [ 0.7,  0.6,  0.3],
    work_meaning:  [ 0.3,  0.4,  0.4],
  },
  emotional: {
    climate:       [-0.7, -0.5, -0.5],
    ai_regulation: [ 0.3,  0.5,  0.8],
    work_meaning:  [-0.6, -0.3, -0.3],
  },
  physical:  {
    climate:       [-0.4, -0.2, -0.8],
    ai_regulation: [ 0.5,  0.4,  0.5],
    work_meaning:  [ 0.1, -0.5, -0.2],
  },
  ego:       {
    climate:       [ 0.6,  0.8, -0.1],
    ai_regulation: [-0.7, -0.6, -0.5],
    work_meaning:  [ 0.8,  0.6,  0.7],
  },
  social:    {
    climate:       [-0.5, -0.8,  0.2],
    ai_regulation: [ 0.2,  0.7,  0.4],
    work_meaning:  [-0.4,  0.2, -0.6],
  },
  id:        {
    climate:       [ 0.2,  0.6, -0.4],
    ai_regulation: [-0.5, -0.4,  0.6],
    work_meaning:  [ 0.5, -0.6,  0.4],
  },
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return h;
}

function jitter(seed: string, axisIdx: number): number {
  const h = Math.abs(hashStr(seed + ":" + axisIdx));
  return ((h % 1000) / 1000 - 0.5) * 0.4; // ±0.2
}

export function generateSyntheticStances(nodes: UserNode[]): Stance[] {
  const out: Stance[] = [];
  for (const n of nodes) {
    for (const topic of SEED_TOPICS) {
      const base = FORCE_STANCE[n.dominantForce][topic.id];
      if (!base) continue;
      const values = base.map((b, i) => clamp(b + jitter(n.id, i), -1, 1));
      out.push({
        topicId:   topic.id,
        userId:    n.id,
        values,
        intensity: n.intensity / 10,
      });
    }
  }
  return out;
}
