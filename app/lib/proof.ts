// Proof Lab — Infrastructure for Trust
// Core logic extracted from proof-lab.html. No side effects; all pure functions.

// ─── Types ────────────────────────────────────────────────────────────

export type ActionType = "help" | "report" | "coordinate" | "resolve" | "unknown";

export interface ProofAction {
  id: string;
  text: string;
  valueNote: string;
  type: ActionType;
  points: number;
  ts: number;
}

export interface ProofUser {
  name: string;
  actions: ProofAction[];
}

export interface Opportunity {
  id: string;
  name: string;
  threshold: number;
  unlocked: boolean;
}

export interface ClassifyResult {
  type: ActionType;
  confidence: number; // 0–100
}

// ─── Classification patterns (Hebrew) ────────────────────────────────

const PATTERNS: Record<ActionType, { text: string; weight: number }[]> = {
  help: [
    { text: "עזרתי", weight: 1.0 }, { text: "עזרה", weight: 0.9 },
    { text: "סייעתי", weight: 1.0 }, { text: "סיוע", weight: 0.9 },
    { text: "תמכתי", weight: 0.9 }, { text: "תמיכה", weight: 0.8 },
    { text: "ליוויתי", weight: 0.8 }, { text: "הנחיתי", weight: 0.7 },
    { text: "הדרכה", weight: 0.7 }, { text: "הכוונה", weight: 0.6 },
  ],
  report: [
    { text: "דיווחתי", weight: 1.0 }, { text: "דיווח", weight: 0.9 },
    { text: "תיעדתי", weight: 0.8 }, { text: "תיעוד", weight: 0.7 },
    { text: "רשמתי", weight: 0.6 }, { text: "סיכום", weight: 0.5 },
    { text: "דוח", weight: 0.8 }, { text: "הגשתי", weight: 0.6 },
  ],
  coordinate: [
    { text: "תיאמתי", weight: 1.0 }, { text: "תיאום", weight: 0.9 },
    { text: "ארגנתי", weight: 0.8 }, { text: "פגישה", weight: 0.5 },
    { text: "שיחה", weight: 0.4 }, { text: "התקשרתי", weight: 0.6 },
    { text: "העברתי מידע", weight: 0.7 }, { text: "קישור", weight: 0.5 },
  ],
  resolve: [
    { text: "פתרתי", weight: 1.0 }, { text: "פתרון", weight: 0.9 },
    { text: "טיפלתי", weight: 0.9 }, { text: "תיקנתי", weight: 0.8 },
    { text: "מצאתי פתרון", weight: 1.0 }, { text: "בעיה", weight: 0.3 },
    { text: "תקלה", weight: 0.4 }, { text: "שיפרתי", weight: 0.6 },
  ],
  unknown: [],
};

const ACTION_POINTS: Record<ActionType, number> = {
  help: 3, resolve: 4, coordinate: 2, report: 1, unknown: 1,
};

export const ACTION_LABELS: Record<ActionType, string> = {
  help: "עזרה", resolve: "פתרון", coordinate: "תיאום", report: "דיווח", unknown: "כללי",
};

export const OPPORTUNITY_DEFS: Omit<Opportunity, "unlocked">[] = [
  { id: "o1", name: "גישה לפרויקט Beta",  threshold: 20  },
  { id: "o2", name: "חברות בצוות הליבה", threshold: 50  },
  { id: "o3", name: "מנטורינג — מומחה",   threshold: 80  },
  { id: "o4", name: "הצגה בפני הנהלה",    threshold: 100 },
];

// ─── Pure functions ───────────────────────────────────────────────────

export function classifyAction(text: string): ClassifyResult {
  if (!text.trim()) return { type: "unknown", confidence: 0 };

  const scores: Partial<Record<ActionType, number>> = {};
  for (const [cat, patterns] of Object.entries(PATTERNS) as [ActionType, typeof PATTERNS[ActionType]][]) {
    if (cat === "unknown") continue;
    scores[cat] = patterns.reduce(
      (s, { text: p, weight }) => (text.includes(p) ? s + weight : s),
      0
    );
  }

  const sorted = (Object.entries(scores) as [ActionType, number][]).sort((a, b) => b[1] - a[1]);
  const [topType, topScore] = sorted[0];
  if (topScore === 0) return { type: "unknown", confidence: 0 };
  const confidence = Math.round(Math.min(topScore / 2, 1) * 100);
  return { type: topType, confidence };
}

export function pointsForType(type: ActionType): number {
  return ACTION_POINTS[type] ?? 1;
}

export function calcTrustScore(actions: ProofAction[]): number {
  return Math.min(actions.reduce((s, a) => s + a.points, 0), 100);
}

export function calcValueContribution(actions: ProofAction[]): number {
  return actions.reduce((s, a) => s + a.points, 0);
}

export function getOpportunities(trustScore: number): Opportunity[] {
  return OPPORTUNITY_DEFS.map(o => ({ ...o, unlocked: trustScore >= o.threshold }));
}

export function makeAction(
  text: string,
  valueNote: string,
  override?: ActionType
): ProofAction {
  const { type, confidence } = override
    ? { type: override, confidence: 100 }
    : classifyAction(text);
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    text,
    valueNote,
    type,
    points: pointsForType(type),
    ts: Date.now(),
  };
}

// ─── localStorage persistence ─────────────────────────────────────────

const STORAGE_KEY = "nexus:proof";

export function loadProofUser(name: string): ProofUser {
  if (typeof window === "undefined") return { name, actions: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, ProofUser> = raw ? JSON.parse(raw) : {};
    return all[name] ?? { name, actions: [] };
  } catch {
    return { name, actions: [] };
  }
}

export function saveProofUser(user: ProofUser): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const all: Record<string, ProofUser> = raw ? JSON.parse(raw) : {};
    all[user.name] = user;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}
