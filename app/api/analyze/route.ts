export async function POST() {
  return Response.json({
    category: "internal_conflict",
    dominantForce: "emotion",
    conflict: "hesitation",
    action: "take one small step immediately",
  });
}
