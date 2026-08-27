"use client";

/**
 * LOOP 6 (EFFECT/EVIDENCE) — the acquisition path for real Effect
 * creation, referencing one of person_roei's own real Actions.
 * `self_verified` maps to `verifier_type: "self"` on `verified_outcome` —
 * canon §17's own rule ("self is always sufficient authority"), not a
 * workaround. Leaving it unchecked keeps the Effect honestly
 * `effect_claimed_only`.
 */
import { useState, useTransition } from "react";
import { createEffectForCurrentUser, type CreateEffectResult } from "@/app/lib/philos/canon/effectFormAction";

export default function CreateEffectForm({
  actionOptions,
  observationOptions = [],
}: {
  actionOptions: { action_id: string; label: string }[];
  /** Real Observations for this subject. Offering them lets the person state
   *  WHICH Observation recorded this outcome — the t1 half of the chain that
   *  `Effect.observed_in_ref` exists for. Optional, and never pre-selected:
   *  an outcome that no Observation recorded simply carries none. */
  observationOptions?: { canon_event_id: string; label: string }[];
}) {
  const [result, setResult] = useState<CreateEffectResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (actionOptions.length === 0) {
    return (
      <div dir="rtl" style={{ fontSize: 13, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        אפקט (canon) · EFFECT — דורש לפחות Action אמיתי אחד. רשמו Action למעלה כדי לרשום אפקט עבורה.
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await createEffectForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>אפקט חדש · NEW EFFECT (person_roei)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="action_ref" required style={selectStyle}>
          <option value="">— בחר Action —</option>
          {actionOptions.map((a) => <option key={a.action_id} value={a.action_id}>{a.label}</option>)}
        </select>
        {/* OBSERVED-IN (t1) — optional by design. "לא נרשמה בתצפית" is a real
            answer, not a missing selection, so it is the default. */}
        {observationOptions.length > 0 ? (
          <select name="observed_in_ref" style={selectStyle} defaultValue="">
            <option value="">— התוצאה לא נרשמה בתצפית (ברירת מחדל) —</option>
            {observationOptions.map((o) => (
              <option key={o.canon_event_id} value={o.canon_event_id}>נרשמה בתצפית: {o.label}</option>
            ))}
          </select>
        ) : null}
        <input name="confidence" type="number" min={0} max={1} step={0.05} placeholder="confidence (0–1)" required style={inputStyle} />
      </div>
      <input name="statement" type="text" placeholder="statement — מה קרה בפועל?" required style={inputStyle} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="method" type="text" placeholder="method — איך אתה יודע?" required style={inputStyle} />
        <input name="context" type="text" placeholder="context" required style={inputStyle} />
        <input name="provenance" type="text" placeholder="provenance" required style={inputStyle} />
      </div>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="concerns_subject_internal_state" /> concerns_subject_internal_state — האפקט נוגע במצב הפנימי שלי
      </label>
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="self_verified" /> self_verified — אני מאשר/ת שהתוצאה אכן קרתה בפועל
      </label>
      {/* WHAT TICKING THAT BOX IS WORTH. `verifier_type` is hardcoded "self"
          in the writer, so the same person who claims the outcome is the one
          confirming it. That is self-report, and calling it evidence on screen
          would repeat exactly the defect the identity tier work removed. */}
      <div data-effect-evidence-note style={{ fontSize: 12, color: "#8fa3c9", lineHeight: 1.5 }}>
        ללא סימון: <b>תוצאה דווחה ונקשרה לפעולה</b> — טרם קיימת ראיה קבילה, ואין אימות עצמאי.
        עם סימון: זהו <b>אישור עצמי</b> של מדווח התוצאה בלבד (verifier_type = self),
        לא ראיה עצמאית ולא אימות של גורם חיצוני.
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום אפקט · RECORD EFFECT"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · effect_id: ${result.effect_id.slice(0, 12)}…` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 160 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
