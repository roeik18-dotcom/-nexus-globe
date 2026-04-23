import { NextRequest } from "next/server";
import type { DominantForce, NodeContext, Direction } from "../../lib/philos";

type Body = {
  event?: string;
  intensity?: number;
  context?: NodeContext;
  direction?: Direction;
};

/**
 * Classify event text into the PHILOS 6-force model.
 * Hebrew + English keywords. Falls back via context, then rational.
 */
function classifyForce(event: string, context: NodeContext): DominantForce {
  const t = (event || "").toLowerCase();

  if (/(עצוב|כעס|פחד|חרדה|דאג|בדידות|sad|angry|afraid|anxious|lonely|cry|heart|love|אהבה|געגוע|miss)/.test(t))
    return "emotional";

  if (/(גוף|כאב|חול|עייפ|רעב|שינה|אוכל|ספורט|pain|tired|hungry|sleep|sick|exercise|body|energy|food)/.test(t))
    return "physical";

  if (/(תשוק|רצון|חשק|דחף|מיני|סיגר|אלכוהול|אכיל|desire|crave|urge|impulse|addict|lust|binge)/.test(t))
    return "id";

  if (/(גאוו|כבוד|קריירה|תדמ|מעמד|הכרה|pride|status|image|recognition|promotion|ego|reputation)/.test(t))
    return "ego";

  if (/(חבר|משפחה|קהיל|צוות|שותף|זוג|קונפליקט|friend|family|team|relation|partner|group|community|social)/.test(t))
    return "social";

  if (/(להחלי|לחשוב|דילמ|אסטרטג|תכנון|ניתוח|decid|think|plan|analy|strategy|logic|choose|decision)/.test(t))
    return "rational";

  if (context === "work")     return "rational";
  if (context === "social")   return "social";
  if (context === "health")   return "physical";
  if (context === "money")    return "rational";
  if (context === "learning") return "rational";

  return "rational";
}

function deriveConflict(force: DominantForce, direction: Direction): string | null {
  if (direction === "forward") return null;
  if (direction === "stuck") {
    if (force === "emotional") return "blocked_feeling";
    if (force === "rational")  return "analysis_paralysis";
    if (force === "physical")  return "depletion";
    if (force === "ego")       return "image_gap";
    if (force === "social")    return "expectation_gap";
    if (force === "id")        return "unmet_craving";
  }
  if (direction === "backward") return "regression";
  return null;
}

function deriveAction(force: DominantForce, direction: Direction, intensity: number): string {
  if (intensity >= 9) {
    return "עצור. נשום 3 דקות. דחה החלטה ב־24 שעות.";
  }
  if (direction === "backward") {
    return "כתוב משפט אחד על מה שאתה נמנע ממנו, ושלח אותו לעצמך.";
  }
  if (direction === "stuck") {
    if (force === "emotional") return "תן שם לרגש, ואז בצע פעולה פיזית של 10 דקות.";
    if (force === "rational")  return "רשום שתי אופציות, קבע ניסוי הפיך של 24 שעות לאחת.";
    if (force === "physical")  return "מים + 20 דקות הליכה + ארוחה אמיתית. בסדר הזה.";
    if (force === "ego")       return "שאל: מי מחליט את הסטנדרט הזה? אם זה לא אתה — שחרר.";
    if (force === "social")    return "שלח משפט אחד כן לאדם הנוגע בדבר.";
    if (force === "id")        return "השהה 20 דקות. אחר כך החלט מחדש.";
  }
  // forward
  return "בצע את הצעד הבא הקטן ביותר ב־25 דקות, ואז עצור.";
}

export async function POST(req: NextRequest) {
  let body: Body = {};
  try { body = await req.json(); } catch {}

  const event     = body.event || "";
  const intensity = typeof body.intensity === "number" ? body.intensity : 5;
  const context   = (body.context || "work") as NodeContext;
  const direction = (body.direction || "forward") as Direction;

  const dominantForce = classifyForce(event, context);
  const conflict      = deriveConflict(dominantForce, direction);
  const action        = deriveAction(dominantForce, direction, intensity);

  return Response.json({
    dominantForce,
    conflict,
    action,
    echo: { event, intensity, context, direction },
  });
}
