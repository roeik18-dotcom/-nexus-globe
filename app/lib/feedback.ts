export type Feedback = {
  did: boolean;
  helped: "yes" | "no" | "partial";
  ts: number;
};

const KEY = "philos.feedback.v1";

export function saveFeedback(f: Feedback) {
  try {
    const arr: Feedback[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    arr.push(f);
    localStorage.setItem(KEY, JSON.stringify(arr));
  } catch {}
}

export function loadFeedback(): Feedback[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

export function computeExecutionImpact() {
  const all = loadFeedback();
  if (all.length === 0) return { rate: undefined, succeeded: 0, total: 0 };
  const succeeded = all.filter(
    (f) => f.did && (f.helped === "yes" || f.helped === "partial")
  ).length;
  const rate = Math.round((succeeded / all.length) * 100);
  return { rate, succeeded, total: all.length };
}
