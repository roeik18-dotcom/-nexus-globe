// PHILOS NEXUS — Real Opportunity Engine
//
// Need + Offer + Trust + Reputation + Context = Opportunity
//
// For every pair (A, B):
//   if need(A) ∩ offer(B) != ∅ → score → RealOpportunity
//
// No money. No marketplace. Need → Offer → Opportunity.

import type { UserNode } from "./philos";
import { deriveNeeds, NEED_LABEL, type NeedTag } from "./need";
import {
  loadProofs, computeReputation, type ReputationScore,
} from "./proof";

// ─── Types ────────────────────────────────────────────────────────────

export type OpportunityType =
  | "connection"     // חיבור — social / emotional
  | "mentorship"     // מנטורינג — knowledge / structure transfer
  | "collaboration"  // שיתוף פעולה — work / create together
  | "learning"       // למידה — depth / structure / clarity
  | "support"        // תמיכה — recovery / grounding / expression
  | "business";      // עסקי — momentum / vision + work context

export interface RealOpportunity {
  id:              string;
  seeker:          UserNode;       // has the need
  provider:        UserNode;       // fills the need
  matchedNeeds:    NeedTag[];      // seeker's needs met by provider
  matchedOffers:   NeedTag[];      // provider's offers that match
  type:            OpportunityType;
  score:           number;         // 0–100
  reason:          string;
  suggestedAction: string;
  avgTrust:        number;
  bidirectional:   boolean;        // provider also needs from seeker
  contextMatch:    boolean;
}

export const OPPORTUNITY_TYPE_LABEL: Record<OpportunityType, string> = {
  connection:    "חיבור",
  mentorship:    "מנטורינג",
  collaboration: "שיתוף פעולה",
  learning:      "למידה",
  support:       "תמיכה",
  business:      "שותפות",
};

export const OPPORTUNITY_TYPE_COLOR: Record<OpportunityType, string> = {
  connection:    "#fb923c",
  mentorship:    "#a78bfa",
  collaboration: "#38bdf8",
  learning:      "#22c55e",
  support:       "#f472b6",
  business:      "#fbbf24",
};

const TYPE_ACTION: Record<OpportunityType, string> = {
  connection:    "שלח הצגה קצרה — 2 שורות",
  mentorship:    "בקש שיחה של 20 דקות",
  collaboration: "הצע פרויקט קטן ראשון",
  learning:      "שאל שאלה ספציפית אחת",
  support:       "הצע עזרה ישירה אחת",
  business:      "הצג ערך ספציפי אחד",
};

// ─── Classification ───────────────────────────────────────────────────

function classifyType(
  seeker: UserNode,
  provider: UserNode,
  needs: NeedTag[],
): OpportunityType {
  if (needs.some(n => ["depth", "structure", "vision"].includes(n)) &&
      ["rational", "superego", "ego"].includes(provider.dominantForce)) {
    return "mentorship";
  }
  if (needs.some(n => ["connection", "validation"].includes(n))) {
    return "connection";
  }
  if (seeker.context === "work" && provider.context === "work") {
    return needs.some(n => ["momentum", "vision"].includes(n)) ? "collaboration" : "business";
  }
  if (needs.some(n => ["recovery", "grounding", "patience", "expression"].includes(n))) {
    return "support";
  }
  if (needs.some(n => ["depth", "structure"].includes(n))) {
    return "learning";
  }
  return "connection";
}

// ─── Scoring ──────────────────────────────────────────────────────────

function scoreOpp(
  seekerTrust: number,
  providerTrust: number,
  seekerRep: ReputationScore,
  providerRep: ReputationScore,
  matchCount: number,
  bidirectional: boolean,
  contextMatch: boolean,
): number {
  const base  = Math.min(matchCount * 22, 40);                    // 0–40
  const trust = ((seekerTrust + providerTrust) / 200) * 25;       // 0–25
  const rep   = ((seekerRep.overall + providerRep.overall) / 200) * 20; // 0–20
  const ctx   = contextMatch ? 10 : 4;                            // 4–10
  const bidir = bidirectional ? 5 : 0;                            // 0–5
  return Math.round(Math.min(base + trust + rep + ctx + bidir, 100));
}

// ─── Reason text ──────────────────────────────────────────────────────

function buildReason(
  seeker: UserNode,
  provider: UserNode,
  needs: NeedTag[],
  type: OpportunityType,
): string {
  const needNames = needs.slice(0, 2).map(n => NEED_LABEL[n]).join(" + ");
  switch (type) {
    case "mentorship":
      return `${provider.name} מציע ${needNames} — בדיוק מה ש-${seeker.name} צריך`;
    case "learning":
      return `${provider.name} יכול ללמד ${needNames}`;
    case "support":
      return `${provider.name} מציע ${needNames} — תמיכה אמיתית`;
    case "collaboration":
      return `${seeker.name} + ${provider.name} = שיתוף פעולה ב-${needNames}`;
    case "business":
      return `הזדמנות עסקית: ${needNames} — שני צדדים בהקשר עבודה`;
    case "connection":
    default:
      return `${seeker.name} ו-${provider.name} יכולים להתחבר דרך ${needNames}`;
  }
}

// ─── Node proof-trust helper (reads localStorage) ────────────────────

function nodeTrust(userId: string): number {
  const proofs = loadProofs(userId);
  if (!proofs.length) return 0;
  return Math.min(proofs.reduce((s, p) => s + p.weight, 0), 100);
}

function nodeRep(userId: string): ReputationScore {
  const proofs   = loadProofs(userId);
  const verified = proofs.filter(p => p.status === "verified");
  return computeReputation(verified, []);
}

// ─── Main engine ──────────────────────────────────────────────────────

/**
 * Generate real opportunities for a given node (as seeker).
 * Pass `candidates` as the pool of potential providers (all visible nodes).
 * Pass optional pre-computed trust map for performance.
 */
export function generateOpportunities(
  seeker: UserNode,
  candidates: UserNode[],
  proofTrustMap: Record<string, number> = {},
): RealOpportunity[] {
  const seekerNeeds  = deriveNeeds(seeker).needs;
  if (!seekerNeeds.length) return [];

  const seekerTrust = proofTrustMap[seeker.id] ?? (nodeTrust(seeker.name) || seeker.trustScore);
  const seekerRep   = nodeRep(seeker.name);

  const out: RealOpportunity[] = [];

  for (const provider of candidates) {
    if (provider.id === seeker.id) continue;

    const providerOffers = deriveNeeds(provider).offers;
    if (!providerOffers.length) continue;

    const matched = seekerNeeds.filter(n => providerOffers.includes(n));
    if (!matched.length) continue;

    // Check bidirectionality
    const providerNeeds  = deriveNeeds(provider).needs;
    const seekerOffers   = deriveNeeds(seeker).offers;
    const reverseMatched = providerNeeds.filter(n => seekerOffers.includes(n));
    const bidirectional  = reverseMatched.length > 0;

    const providerTrust = proofTrustMap[provider.id] ?? (nodeTrust(provider.name) || provider.trustScore);
    const providerRep   = nodeRep(provider.name);
    const contextMatch  = seeker.context === provider.context;

    const type  = classifyType(seeker, provider, matched);
    const score = scoreOpp(seekerTrust, providerTrust, seekerRep, providerRep, matched.length, bidirectional, contextMatch);

    if (score < 10) continue; // filter noise

    out.push({
      id:             `${seeker.id}-${provider.id}`,
      seeker,
      provider,
      matchedNeeds:   matched,
      matchedOffers:  providerOffers.filter(o => matched.includes(o)),
      type,
      score,
      reason:         buildReason(seeker, provider, matched, type),
      suggestedAction: TYPE_ACTION[type],
      avgTrust:       Math.round((seekerTrust + providerTrust) / 2),
      bidirectional,
      contextMatch,
    });
  }

  return out.sort((a, b) => b.score - a.score);
}

/**
 * Generate opportunities for ALL nodes (system-wide view).
 * Returns top opportunities across the whole graph.
 */
export function generateAllOpportunities(
  nodes: UserNode[],
  proofTrustMap: Record<string, number> = {},
  limit = 10,
): RealOpportunity[] {
  const all: RealOpportunity[] = [];
  for (const seeker of nodes) {
    const opps = generateOpportunities(seeker, nodes, proofTrustMap);
    all.push(...opps.slice(0, 3)); // top 3 per node
  }
  // deduplicate by pair (a-b = b-a)
  const seen = new Set<string>();
  const deduped = all.filter(o => {
    const key = [o.seeker.id, o.provider.id].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return deduped.sort((a, b) => b.score - a.score).slice(0, limit);
}
