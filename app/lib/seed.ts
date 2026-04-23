// PHILOS NEXUS — seed users
//
// Creates a diverse mock network that triggers all 4 link types:
//   alignment, complementary, influence, opportunity.
// Designed so every category (work/social/health/money/learning) has at least one node,
// every dominant force appears, and direction mix creates hot matches.

import {
  computeTrust,
  directionToImpact,
  type UserNode,
  type DominantForce,
  type NodeContext,
  type Direction,
} from "./philos";

type Seed = {
  name: string;
  lat: number;
  lng: number;
  event: string;
  intensity: number;
  context: NodeContext;
  dominantForce: DominantForce;
  direction: Direction;
  conflict: string | null;
  action: string;
};

const SEEDS: Seed[] = [
  {
    name: "מאיה",
    lat: 32.0853, lng: 34.7818, // Tel Aviv
    event: "פרויקט חדש בעבודה, לחץ גבוה אבל תחושת שליטה",
    intensity: 8, context: "work", dominantForce: "rational", direction: "forward",
    conflict: null,
    action: "להציג את התכנית היום בישיבה",
  },
  {
    name: "דני",
    lat: 32.0853, lng: 34.7818,
    event: "אותו צוות, תקוע על החלטה, מנתח שוב ושוב",
    intensity: 7, context: "work", dominantForce: "rational", direction: "stuck",
    conflict: "analysis_paralysis",
    action: "להפסיק לחשוב, לבחור ולעבור הלאה",
  },
  {
    name: "נועה",
    lat: 31.7683, lng: 35.2137, // Jerusalem
    event: "ריב עם אבא, הרגשתי לא נשמעת, בכיתי",
    intensity: 9, context: "social", dominantForce: "emotional", direction: "stuck",
    conflict: "blocked_feeling",
    action: "לכתוב מה רציתי לומר לפני השיחה הבאה",
  },
  {
    name: "איתי",
    lat: 32.794, lng: 34.9896, // Haifa
    event: "סיימתי מרתון חצי, הגוף עייף אבל מרוצה",
    intensity: 7, context: "health", dominantForce: "physical", direction: "forward",
    conflict: null,
    action: "יום מנוחה מלא, נוזלים וחלבון",
  },
  {
    name: "שירה",
    lat: 32.794, lng: 34.9896,
    event: "פציעה בברך, לא רצתי שלושה שבועות",
    intensity: 6, context: "health", dominantForce: "physical", direction: "backward",
    conflict: "regression",
    action: "פיזיותרפיה ביום ראשון, בלי קיצורי דרך",
  },
  {
    name: "יונתן",
    lat: 37.7749, lng: -122.4194, // San Francisco
    event: "השקתי feature, המשתמשים אוהבים, גאה בעצמי",
    intensity: 8, context: "work", dominantForce: "ego", direction: "forward",
    conflict: null,
    action: "לשתף את הצוות שהצליח, לא רק את עצמי",
  },
  {
    name: "טל",
    lat: 40.7128, lng: -74.0060, // New York
    event: "הפסד כסף בהשקעה, מרגיש טיפש",
    intensity: 7, context: "money", dominantForce: "ego", direction: "stuck",
    conflict: "image_gap",
    action: "לתעד את הלקח ולחזור לתכנית המקורית",
  },
  {
    name: "עמית",
    lat: 51.5074, lng: -0.1278, // London
    event: "קורס חדש בבינה מלאכותית, מוצף אבל סקרן",
    intensity: 7, context: "learning", dominantForce: "rational", direction: "forward",
    conflict: null,
    action: "פרק אחד ביום, להעביר הלאה למי שמתעניין",
  },
  {
    name: "רון",
    lat: 32.0853, lng: 34.7818,
    event: "רוצה להתחיל פרויקט אבל לא מתחיל, נדחה שוב",
    intensity: 6, context: "work", dominantForce: "id", direction: "stuck",
    conflict: "desire_vs_fear",
    action: "15 דקות בלבד היום, בלי לתכנן את הכל",
  },
  {
    name: "ליאור",
    lat: 52.52, lng: 13.405, // Berlin
    event: "חברות חדשה בקהילה, הזמינו אותי לאירוע",
    intensity: 7, context: "social", dominantForce: "social", direction: "forward",
    conflict: null,
    action: "לאשר, להופיע, להציג את עצמי לאדם חדש אחד",
  },
];

export function generateSeedNodes(): UserNode[] {
  const now = Date.now();
  const prior: UserNode[] = [];

  return SEEDS.map((s, i) => {
    const node: UserNode = {
      id: (globalThis.crypto?.randomUUID?.() ?? `seed-${i}-${now}`),
      name: s.name,
      lat: s.lat,
      lng: s.lng,
      event: s.event,
      intensity: s.intensity,
      context: s.context,
      dominantForce: s.dominantForce,
      conflict: s.conflict,
      action: s.action,
      direction: s.direction,
      value: s.intensity,
      impact: directionToImpact(s.direction),
      trustScore: computeTrust(s.intensity, s.direction, s.dominantForce, s.event, prior),
      createdAt: now - (SEEDS.length - i) * 60 * 1000, // staggered a minute apart
    };
    prior.push(node);
    return node;
  });
}
