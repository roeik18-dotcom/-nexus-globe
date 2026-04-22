// PHILOS NEXUS — Daily Summary Engine
//
// personalScore = avgIntensity*0.4 + forwardRatio*0.4 + actionCompletion*0.2  (scale 0..10)
// socialScore   = linksCreated*0.3 + helpGiven*0.4 + alignment*0.3            (scale 0..10)
// valueScore    = personalScore*0.5 + socialScore*0.5                         (scale 0..10)
// impact        = high if valueScore > 7, medium if > 4, else low

import {
  buildLinks,
  type UserNode,
  type DominantForce,
} from "./philos";

export type Impact = "high" | "medium" | "low";

export type DailySummary = {
  day: string;               // yyyy-mm-dd
  nodeCount: number;
  personalScore: number;     // 0..10
  socialScore:   number;     // 0..10
  valueScore:    number;     // 0..10
  impact: Impact;

  avgIntensity:     number;  // 0..10
  forwardRatio:     number;  // 0..1
  actionCompletion: number;  // 0..1  (heuristic: non-stuck + action text present)
  linksCreated:     number;  // count
  helpGiven:        number;  // count
  alignment:        number;  // 0..1

  dominantForce: DominantForce | null;
  mainConflict:  string | null;
  recommendation: string;
};

function todayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp01(x: number) { return Math.max(0, Math.min(1, x)); }
function clamp10(x: number) { return Math.max(0, Math.min(10, x)); }

/** dominant force among a set of nodes */
function topForce(nodes: UserNode[]): DominantForce | null {
  if (!nodes.length) return null;
  const count: Record<string, number> = {};
  nodes.forEach(n => { count[n.dominantForce] = (count[n.dominantForce] || 0) + 1; });
  const sorted = Object.entries(count).sort((a, b) => b[1] - a[1]);
  return (sorted[0]?.[0] as DominantForce) ?? null;
}

function topConflict(nodes: UserNode[]): string | null {
  const c: Record<string, number> = {};
  nodes.forEach(n => {
    if (n.conflict) c[n.conflict] = (c[n.conflict] || 0) + 1;
  });
  const sorted = Object.entries(c).sort((a, b) => b[1] - a[1]);
  return sorted[0]?.[0] ?? null;
}

function recommendationFor(
  dominantForce: DominantForce | null,
  forwardRatio: number,
  avgIntensity: number,
  socialScore: number,
): string {
  if (forwardRatio < 0.3 && avgIntensity >= 5) return "צעד קטן אחד מיידי. עכשיו. לא לדבר, לעשות.";
  if (dominantForce === "emotional" && avgIntensity > 7) return "ייצוב לפני פעולה. קודם לנשום, אחר כך להחליט.";
  if (socialScore < 3) return "צור חיבור אחד — שיחה קצרה עם מישהו שמביא לך אוויר.";
  if (avgIntensity < 3) return "העלה רמת מאמץ. המערכת רועדת נמוך, צריך קלט חזק יותר.";
  if (dominantForce === "rational" && forwardRatio < 0.5) return "הגיון יתר חוסם תנועה. פעל לפני שתנתח שוב.";
  if (dominantForce === "ego")   return "בדוק מניע — האם זה שלך, או של הדימוי.";
  if (dominantForce === "id")    return "דחף חי. נתב אותו לערוץ בונה לפני שיתפזר.";
  if (dominantForce === "social") return "שמור על קו אישי. אל תיבלע בציפיות.";
  if (dominantForce === "physical") return "הגוף מדבר. מנוחה או תנועה — בחר אחד, וקבע.";
  return "שמור קו. המערכת זזה קדימה.";
}

/** Build DailySummary for nodes created today (same local date). */
export function computeDailySummary(allNodes: UserNode[]): DailySummary {
  const today = todayKey(Date.now());
  const todays = allNodes.filter(n => todayKey(n.createdAt) === today);

  if (!todays.length) {
    return {
      day: today,
      nodeCount: 0,
      personalScore: 0,
      socialScore: 0,
      valueScore: 0,
      impact: "low",
      avgIntensity: 0,
      forwardRatio: 0,
      actionCompletion: 0,
      linksCreated: 0,
      helpGiven: 0,
      alignment: 0,
      dominantForce: null,
      mainConflict: null,
      recommendation: "אין מדידה היום. התחל מניתוח אחד קצר.",
    };
  }

  const n          = todays.length;
  const avgIntensity = todays.reduce((s, x) => s + x.intensity, 0) / n;          // 0..10
  const forwardRatio = todays.filter(x => x.direction === "forward").length / n; // 0..1
  const nonStuck     = todays.filter(x => x.direction !== "stuck").length;
  const hasAction    = todays.filter(x => (x.action || "").trim().length > 0).length;
  const actionCompletion = clamp01(
    (nonStuck * 0.6 + hasAction * 0.4) / n
  );

  const links = buildLinks(todays);
  const linksCreated = links.length;

  // helpGiven heuristic: nodes where dominantForce === "social" with forward direction
  const helpGiven = todays.filter(x => x.dominantForce === "social" && x.direction === "forward").length;

  // alignment heuristic: share of links where both ends have same dominantForce
  const alignment = linksCreated
    ? links.filter(l => l.strength >= 1).length / linksCreated
    : 0;

  const personalScore = clamp10(
    avgIntensity * 0.4 +
    forwardRatio * 10 * 0.4 +
    actionCompletion * 10 * 0.2
  );

  const socialScore = clamp10(
    Math.min(10, linksCreated) * 0.3 +
    Math.min(10, helpGiven)   * 0.4 +
    alignment * 10            * 0.3
  );

  const valueScore = clamp10(personalScore * 0.5 + socialScore * 0.5);
  const impact: Impact =
    valueScore > 7 ? "high" :
    valueScore > 4 ? "medium" : "low";

  const dominantForce = topForce(todays);
  const mainConflict  = topConflict(todays);

  return {
    day: today,
    nodeCount: n,
    personalScore,
    socialScore,
    valueScore,
    impact,
    avgIntensity,
    forwardRatio,
    actionCompletion,
    linksCreated,
    helpGiven,
    alignment,
    dominantForce,
    mainConflict,
    recommendation: recommendationFor(dominantForce, forwardRatio, avgIntensity, socialScore),
  };
}

export const IMPACT_COLOR: Record<Impact, string> = {
  high:   "#00f5d4",
  medium: "#fbbf24",
  low:    "#ef4444",
};

export const IMPACT_LABEL: Record<Impact, string> = {
  high:   "גבוה",
  medium: "בינוני",
  low:    "נמוך",
};
