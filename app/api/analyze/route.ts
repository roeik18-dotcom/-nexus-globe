import { NextRequest } from "next/server";

type Body = {
  event?: string;
  intensity?: number;
  context?: string;
};

function classify(event: string, intensity: number, context: string) {
  const e = (event || "").toLowerCase();
  const c = (context || "").toLowerCase();

  let category = "uncertainty";
  let dominantForce: "emotion" | "logic" | "fear" | "desire" | "duty" = "emotion";
  let conflict = "hesitation";
  let action = "take one small step immediately";

  if (/(לחץ|חרדה|פחד|stress|afraid|panic|anxious)/.test(e)) {
    category = "anxiety";
    dominantForce = "fear";
    conflict = "avoidance";
    action = "name the worst case out loud, then do the smallest next step";
  } else if (/(כעס|זעם|angry|frustrat|rage)/.test(e)) {
    category = "frustration";
    dominantForce = "emotion";
    conflict = "blocked_expression";
    action = "walk for 10 minutes before you speak or decide";
  } else if (/(עצוב|depress|sad|down|ריק)/.test(e)) {
    category = "low_state";
    dominantForce = "emotion";
    conflict = "disengagement";
    action = "contact one person you trust in the next 30 minutes";
  } else if (/(דיל|deal|בחיר|choos|decid|דילמ)/.test(e)) {
    category = "decision";
    dominantForce = "logic";
    conflict = "tradeoff";
    action = "write the two options, pick a 24h reversible test for one";
  } else if (/work|עבוד|קריירה|career|job/.test(c)) {
    category = "career_friction";
    dominantForce = "duty";
    conflict = "role_vs_self";
    action = "do 25 minutes of the most avoided task, then stop";
  } else if (/relation|זוג|חבר|family|משפח/.test(c)) {
    category = "relational";
    dominantForce = "emotion";
    conflict = "expectation_gap";
    action = "send one honest sentence to the person in question";
  } else if (intensity >= 8) {
    category = "crisis";
    dominantForce = "fear";
    conflict = "overload";
    action = "pause. breathe for 3 minutes. postpone any decision by 24h";
  }

  return { category, dominantForce, conflict, action };
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const event = body.event || "";
  const intensity = typeof body.intensity === "number" ? body.intensity : 5;
  const context = body.context || "";

  const result = classify(event, intensity, context);

  return Response.json({
    ...result,
    echo: { event, intensity, context },
  });
}
