"use client";

/**
 * LOOP 4 / BATCH 2 — live canonical-gate evaluation over REAL Need/Offer
 * records. Not persisted (see matchEvalAction.ts header for why) — every
 * submit recomputes fresh via `evaluateMatch`, shown immediately, never
 * stored. BATCH 2 addition: the six gates render as a real visual
 * checklist after evaluation (✓/✗ per gate, derived from `rejection_
 * reasons`'s real `<GATE>_false` entries) instead of only a flat decision
 * line — the same STATUS vocabulary every other redesigned surface uses.
 *
 * Match-flow continuation pass: each gate's checkbox `name` attribute
 * stays the literal canon token (`CAN`/`WANTS`/.../`CONSENT`) — that's
 * the exact field `evaluateMatchForCurrentUser`/`matchEvalAction.ts`
 * reads via `formData.get("CAN")` etc., so changing it would silently
 * break the real write path. Only the VISIBLE label changed, to a plain-
 * language question a user can answer without knowing the gate name.
 * Nothing here defaults a checkbox to checked — every gate stays an
 * explicit, unchecked-by-default attestation, same as before.
 */
import { useState, useTransition } from "react";
import { evaluateMatchForCurrentUser, type EvaluateMatchResult } from "@/app/lib/philos/canon/matchEvalAction";
import type { MatchPermit } from "@/app/lib/philos/canon/matchPermit";
import { COLOR, RADIUS, STATUS } from "@/app/lib/philos/shell/designTokens";

const GATES = ["CAN", "WANTS", "ALLOWED", "APPROPRIATE", "AVAILABLE", "CONSENT"] as const;

const GATE_QUESTION: Record<(typeof GATES)[number], string> = {
  CAN: "האם המשאב הזה יכול לספק/לעזור מהותית לצורך הזה? · Can this resource actually satisfy or materially help this Need?",
  WANTS: "האם אני באמת רוצה להשתמש/לספק את המשאב הזה עבור הצורך הזה? · Do I actually want to use/provide this resource for this Need?",
  ALLOWED: "האם הפעולה הזו מותרת לפי הכללים/המגבלות הנוכחיים? · Is this action permitted under the current rules/constraints?",
  APPROPRIATE: "האם ההתאמה הזו מתאימה להקשר הספציפי הזה? · Is this match suitable for this specific context?",
  AVAILABLE: "האם המשאב זמין בפועל כרגע בהיקף שצוין? · Is the resource genuinely available now in the stated capacity?",
  CONSENT: "האם אני מסכים/ה במפורש שההתאמה הזו תשמש לפעולה הבאה? · Do I explicitly consent to this match being used for the next action?",
};

export default function EvaluateMatchForm({
  needOptions, offerOptions, onPermit,
}: {
  needOptions: { need_id: string; label: string }[];
  offerOptions: { offer_id: string; label: string }[];
  /** Match→Action integrity gate — called with the real `MatchPermit`
   *  after a permitted evaluation (or `null` on any other outcome), so
   *  a composing parent (`MatchActionFlow.tsx`) can hand it to
   *  `CreateActionForm`. Optional: this form works exactly as before
   *  when no caller needs the permit. */
  onPermit?: (permit: MatchPermit | null) => void;
}) {
  const [result, setResult] = useState<EvaluateMatchResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (needOptions.length === 0 || offerOptions.length === 0) {
    return (
      <div id="match-eval" dir="rtl" style={{ fontSize: 11, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        התאמה (canon) · MATCH — דורש לפחות Need אמיתי אחד ו-Offer אמיתי אחד. רשמו את שניהם למעלה כדי להעריך התאמה.
      </div>
    );
  }

  return (
    <form
      id="match-eval"
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await evaluateMatchForCurrentUser(formData);
          setResult(r);
          onPermit?.(r.ok && r.permit ? r.permit : null);
        });
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 0.5, color: "#8fa3c9" }}>הערכת התאמה (canon, לא נשמר — נגזר בכל בקשה) · EVALUATE MATCH (derived, not persisted)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="need_id" required defaultValue={needOptions[0]?.need_id} style={selectStyle}>
          {needOptions.map((n) => <option key={n.need_id} value={n.need_id}>{n.label}</option>)}
        </select>
        <select name="offer_id" required defaultValue={offerOptions[0]?.offer_id} style={selectStyle}>
          {offerOptions.map((o) => <option key={o.offer_id} value={o.offer_id}>{o.label}</option>)}
        </select>
      </div>
      <div>
        <label style={{ fontSize: 10.5, color: "#8fa3c9", display: "block", marginBottom: 3 }}>
          CONTEXT — משפט קצר שמתאר את ההקשר האמיתי של ניסיון ההתאמה הזה · one short sentence describing the real-world context of this match
        </label>
        <input name="context" type="text" required style={inputStyle} />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {GATES.map((g, i) => (
          <label key={g} style={{ fontSize: 11.5, display: "flex", alignItems: "flex-start", gap: 8, lineHeight: 1.5 }}>
            <input type="checkbox" name={g} style={{ marginTop: 2 }} />
            <span>{i + 1}. {GATE_QUESTION[g]}</span>
          </label>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "#5a76a3" }}>אף תשובה אינה מסומנת מראש — כל שאלה דורשת אישור מפורש שלך. · No answer is pre-checked — every question requires your explicit answer.</div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "מעריך…" : "הערך התאמה · EVALUATE"}</button>
      </div>
      {result ? (
        result.ok ? (
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
              {GATES.map((g) => {
                const failed = (result.result.rejection_reasons as string[]).includes(`${g}_false`);
                const s = failed ? STATUS.blocked : STATUS.verified;
                return (
                  <span key={g} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 10.5, fontWeight: 700, padding: "3px 9px", borderRadius: RADIUS.pill, background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
                    {failed ? "✗" : "✓"} {g}
                  </span>
                );
              })}
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: result.result.decision === "permitted" ? STATUS.verified.text : STATUS.blocked.text }}>
              decision: {result.result.decision}
            </div>
            {result.permit ? (
              <div style={{ fontSize: 10.5, color: STATUS.verified.text, marginTop: 6 }}>
                MATCH PERMIT issued (valid 10 min) — ניתן להשתמש בו ביצירת Action למטה. · usable in Action creation below.
              </div>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: STATUS.blocked.text }}>{result.message}</div>
        )
      ) : null}
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 160 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12, width: "100%" };
const btnStyle: React.CSSProperties = { background: COLOR.accent, color: "#0b0f1a", fontWeight: 600, fontSize: 12, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
