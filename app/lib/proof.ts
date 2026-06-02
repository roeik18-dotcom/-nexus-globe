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

// ─── Proof Layer ─────────────────────────────────────────────────────
// A + B model: self-reported claims + peer verification.
// System-detected (C) is a future layer.

export type EvidenceType = "text" | "link" | "peer";
export type ProofStatus  = "claimed" | "verified" | "rejected";

export interface ProofItem {
  id:            string;
  userId:        string;
  actionId:      string;        // links to ProofAction.id
  claim:         string;        // "what did you do?"
  evidenceType:  EvidenceType;
  evidence:      string;        // free text, URL, or peer name
  verifiedBy?:   string;        // userId of peer verifier
  status:        ProofStatus;
  weight:        number;        // claimed=1 · verified=3 · repeated verified=5
  createdAt:     number;
}

// Weight table — source of trust
const PROOF_WEIGHT: Record<ProofStatus, number> = {
  claimed:  1,
  verified: 3,
  rejected: 0,
};

const PROOFS_KEY = "nexus:proofs";

// ── CRUD ──────────────────────────────────────────────────────────────

export function loadProofs(userId?: string): ProofItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(PROOFS_KEY);
    const all: ProofItem[] = raw ? JSON.parse(raw) : [];
    return userId ? all.filter(p => p.userId === userId) : all;
  } catch { return []; }
}

function _saveProof(proof: ProofItem): void {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(PROOFS_KEY);
    const all: ProofItem[] = raw ? JSON.parse(raw) : [];
    const idx = all.findIndex(p => p.id === proof.id);
    if (idx >= 0) all[idx] = proof; else all.push(proof);
    localStorage.setItem(PROOFS_KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function addProof(
  userId:       string,
  actionId:     string,
  claim:        string,
  evidenceType: EvidenceType,
  evidence:     string,
): ProofItem {
  const proof: ProofItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    userId, actionId, claim, evidenceType, evidence,
    status: "claimed",
    weight: PROOF_WEIGHT.claimed,
    createdAt: Date.now(),
  };
  _saveProof(proof);
  return proof;
}

export function verifyProof(proofId: string, verifierUserId: string): ProofItem | null {
  const all = loadProofs();
  const proof = all.find(p => p.id === proofId);
  if (!proof) return null;
  if (proof.userId === verifierUserId) return null; // no self-verification

  // Consistency: count how many proofs this user already has verified
  const alreadyVerified = all.filter(
    p => p.userId === proof.userId && p.status === "verified"
  ).length;

  proof.verifiedBy = verifierUserId;
  proof.status     = "verified";
  proof.weight     = alreadyVerified >= 2 ? 5 : PROOF_WEIGHT.verified; // 3rd+ = 5
  _saveProof(proof);
  return proof;
}

export function rejectProof(proofId: string, verifierUserId: string): ProofItem | null {
  const all = loadProofs();
  const proof = all.find(p => p.id === proofId);
  if (!proof || proof.userId === verifierUserId) return null;
  proof.status = "rejected";
  proof.weight = 0;
  _saveProof(proof);
  return proof;
}

// ── Trust from Proof ──────────────────────────────────────────────────
// Replaces simple action-point counting.
// Falls back to action-based score if no proofs submitted yet.

export function calcTrustFromProofs(userId: string, actions: ProofAction[]): number {
  const proofs = loadProofs(userId);
  if (proofs.length === 0) {
    // no proofs yet — use action-based score as baseline
    return calcTrustScore(actions);
  }
  return Math.min(
    proofs.reduce((sum, p) => sum + p.weight, 0),
    100
  );
}

// Proof status label (Hebrew)
export const PROOF_STATUS_LABEL: Record<ProofStatus, string> = {
  claimed:  "טענה",
  verified: "מאומת",
  rejected: "נדחה",
};

export const PROOF_STATUS_COLOR: Record<ProofStatus, string> = {
  claimed:  "#fbbf24",
  verified: "#34d399",
  rejected: "#f87171",
};

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

// ─── Reputation Engine ────────────────────────────────────────────────
// Per-user score (MVP = Option A).
// Structured for contextual reputation (Option C) via byContext.
//
// Four factors, each 0–25 → total 0–100:
//   frequency   — how many verified proofs
//   consistency — spread over time (not one burst)
//   recency     — how recently active
//   impact      — proof weight + evidence diversity

export type ReputationLevel =
  | "none"
  | "emerging"
  | "established"
  | "trusted"
  | "authority";

export interface ReputationScore {
  overall:     number;                  // 0–100
  frequency:   number;                  // 0–25
  consistency: number;                  // 0–25
  recency:     number;                  // 0–25
  impact:      number;                  // 0–25
  level:       ReputationLevel;
  byContext:   Record<string, number>;  // prepared for Option C (contextual)
}

export const REPUTATION_LEVEL_LABEL: Record<ReputationLevel, string> = {
  none:        "אין עדיין",
  emerging:    "מתפתח",
  established: "מוכר",
  trusted:     "מהימן",
  authority:   "סמכות",
};

export const REPUTATION_LEVEL_COLOR: Record<ReputationLevel, string> = {
  none:        "#475569",
  emerging:    "#fbbf24",
  established: "#38bdf8",
  trusted:     "#34d399",
  authority:   "#a78bfa",
};

const DAY_MS = 86_400_000;

// ── Factor calculators (pure — take verified proofs as input) ─────────

function _frequency(verified: ProofItem[]): number {
  // Each verified proof = 3.5 pts, capped at 25
  return Math.min(Math.round(verified.length * 3.5), 25);
}

function _consistency(verified: ProofItem[]): number {
  if (verified.length < 2) return 0;
  const now = Date.now();
  // Bucket each proof into a 7-day week
  const weekBuckets = new Set(
    verified.map(p => Math.floor((now - p.createdAt) / (7 * DAY_MS)))
  );
  const activeWeeks = weekBuckets.size;
  // Span in weeks from oldest proof to now
  const oldest = Math.min(...verified.map(p => p.createdAt));
  const spanWeeks = Math.max((now - oldest) / (7 * DAY_MS), 1);
  // Ratio of active weeks to total span, scaled to 25
  return Math.min(Math.round((activeWeeks / spanWeeks) * 25), 25);
}

function _recency(verified: ProofItem[]): number {
  if (verified.length === 0) return 0;
  const now = Date.now();
  const mostRecent = Math.max(...verified.map(p => p.createdAt));
  const days = (now - mostRecent) / DAY_MS;
  if (days <=  7) return 25;
  if (days <= 30) return 18;
  if (days <= 90) return 10;
  return 3;
}

function _impact(verified: ProofItem[]): number {
  if (verified.length === 0) return 0;
  const avgWeight  = verified.reduce((s, p) => s + p.weight, 0) / verified.length;
  // Diversity bonus: unique evidence types used
  const diversity  = new Set(verified.map(p => p.evidenceType)).size;
  return Math.min(Math.round((avgWeight / 5) * 20 + diversity * 1.5), 25);
}

// ── Main export ───────────────────────────────────────────────────────

/**
 * Compute reputation for a user from their verified proof history.
 *
 * @param verified  ProofItem[] already filtered to status === "verified"
 * @param actions   ProofAction[] — kept for future impact weighting by type
 */
export function computeReputation(
  verified: ProofItem[],
  _actions: ProofAction[],   // reserved for Option C contextual weighting
): ReputationScore {
  const frequency   = _frequency(verified);
  const consistency = _consistency(verified);
  const recency     = _recency(verified);
  const impact      = _impact(verified);
  const overall     = Math.min(frequency + consistency + recency + impact, 100);

  const level: ReputationLevel =
    overall >= 80 ? "authority"    :
    overall >= 55 ? "trusted"      :
    overall >= 30 ? "established"  :
    overall >= 10 ? "emerging"     : "none";

  // byContext: Option C structure — all contexts inherit overall for now.
  // When ProofItem gains a .context field, re-weight per domain.
  const byContext: Record<string, number> = {
    work:     overall,
    social:   overall,
    health:   overall,
    money:    overall,
    learning: overall,
  };

  return { overall, frequency, consistency, recency, impact, level, byContext };
}
