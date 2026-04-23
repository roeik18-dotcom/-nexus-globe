// PHILOS NEXUS — Match Engine
//
// Given the node graph + typed links, surface "who needs whom right now":
// matches that suggest where energy should flow next.
//
// matchScore =
//   link.strength            * 0.35  (base connection quality)
//   + avgIntensity/10        * 0.25  (both nodes are charged)
//   + typeWeight             * 0.20  (opportunity > influence > complementary > alignment)
//   + urgencyBoost           * 0.15  (one stuck + one forward = urgent pull)
//   + profileProximity       * 0.05  (closer to user's anchor)

import {
  buildLinks,
  haversineKm,
  LINK_LABEL,
  FORCE_LABEL,
  CONTEXT_LABEL,
  type UserNode,
  type Link,
  type LinkType,
} from "./philos";
import type { UserProfile } from "./profile";

export type Urgency = "hot" | "warm" | "cold";

export type Match = {
  a: UserNode;
  b: UserNode;
  link: Link;
  score: number;      // 0..1
  urgency: Urgency;
  reason: string;
  suggestion: string;
};

const TYPE_WEIGHT: Record<LinkType, number> = {
  opportunity:   1.0,
  influence:     0.8,
  complementary: 0.7,
  alignment:     0.5,
};

function suggestFor(link: Link, a: UserNode, b: UserNode): string {
  const reasons: string[] = [];

  // 1. same context
  if (a.context === b.context) {
    reasons.push(`אותו תחום (${CONTEXT_LABEL[a.context]}) — שיתוף פעולה טבעי`);
  }

  // 2. same force
  if (a.dominantForce === b.dominantForce) {
    reasons.push(`אותו כוח (${FORCE_LABEL[a.dominantForce]}) — תקשורת ישירה`);
  }

  // 3. intensity similarity (diff ≤ 2)
  const diff = Math.abs(a.intensity - b.intensity);
  if (diff <= 2) {
    reasons.push(`עוצמה דומה (${a.intensity} vs ${b.intensity}) — קצב תואם`);
  }

  // 4. forward + stuck dynamic
  const forwardStuck =
    (a.direction === "forward" && b.direction === "stuck") ||
    (a.direction === "stuck"   && b.direction === "forward");
  if (forwardStuck) {
    const forwardName = a.direction === "forward" ? a.name : b.name;
    const stuckName   = a.direction === "stuck"   ? a.name : b.name;
    reasons.push(`${forwardName} בתנועה, ${stuckName} תקוע — משיכה טבעית`);
  }

  if (reasons.length > 0) {
    return reasons.slice(0, 3).join(" + ");
  }

  // fallback — no signals matched, keep original type-specific text
  switch (link.type) {
    case "opportunity":
      return `פעל יחד על ${a.context === b.context ? "אותו משתנה" : "חיבור הקונטקסטים"} — שניהם בתנועה, זמן קצר להזדמנות.`;
    case "influence":
      return `קדם את הצד התקוע. קח את המומנטום של ${link.directional ? "הצד הנע" : "המצב הפעיל"} וחבר אותו.`;
    case "complementary":
      return `החיבור הזה סוגר פער — אחד משלים את חוסר של השני. בדוק איפה הם נפגשים.`;
    case "alignment":
    default:
      return `בסיס משותף — בנה עליו. לא מתח גבוה, אבל יציב.`;
  }
}

export function computeMatches(nodes: UserNode[], profile: UserProfile | null): Match[] {
  if (nodes.length < 2) return [];

  const links = buildLinks(nodes);
  const byId: Record<string, UserNode> = {};
  nodes.forEach(n => (byId[n.id] = n));

  const center = profile ? { lat: profile.lat, lng: profile.lng } : null;

  const out: Match[] = [];

  for (const link of links) {
    const a = byId[link.source];
    const b = byId[link.target];
    if (!a || !b) continue;

    const avgIntensity = (a.intensity + b.intensity) / 2 / 10;    // 0..1
    const typeWeight   = TYPE_WEIGHT[link.type];

    // urgency: one stuck + one forward = hot pull
    const oneStuck   = (a.direction === "stuck") !== (b.direction === "stuck");
    const oneForward = (a.direction === "forward") !== (b.direction === "forward");
    const urgencyBoost =
      oneStuck && oneForward ? 1 :
      a.direction === "forward" && b.direction === "forward" ? 0.6 :
      a.conflict || b.conflict ? 0.5 :
      0.2;

    const profileProximity = center
      ? Math.max(0, 1 - Math.min(haversineKm(center, a), haversineKm(center, b)) / 10000)
      : 0.3;

    const score =
      link.strength       * 0.35 +
      avgIntensity        * 0.25 +
      typeWeight          * 0.20 +
      urgencyBoost        * 0.15 +
      profileProximity    * 0.05;

    const urgency: Urgency =
      score > 0.7 ? "hot" :
      score > 0.45 ? "warm" : "cold";

    out.push({
      a, b, link,
      score: Math.min(1, score),
      urgency,
      reason: `${LINK_LABEL[link.type]} · ${link.reason}`,
      suggestion: suggestFor(link, a, b),
    });
  }

  return out.sort((x, y) => y.score - x.score);
}

export const URGENCY_COLOR: Record<Urgency, string> = {
  hot:  "#ef4444",
  warm: "#fbbf24",
  cold: "#38bdf8",
};

export const URGENCY_LABEL: Record<Urgency, string> = {
  hot:  "חם",
  warm: "פושר",
  cold: "קר",
};
