"use client";

/**
 * INDEPENDENT VERIFICATION — THE FORM THE SECOND PERSON USES.
 *
 * Deliberately a separate form from `CreateEffectForm`, on purpose and not
 * for tidiness: reporting an outcome and checking one are two acts by two
 * people, and a single form invites them to be one. Nothing here asks who is
 * verifying — the server takes that from the signed-in session, so a person
 * cannot name someone else in the person's place.
 *
 * WHAT A READER SEES WHEN THEY CANNOT USE IT. Whoever performed the action,
 * and whoever the outcome is about, will be refused — and the refusal says
 * which of the two they are, in plain words, rather than failing silently or
 * hiding the form. Being unable to verify your own outcome is the feature.
 */
import { useState, useTransition } from "react";

import { verifyEffect, type VerifyEffectResult } from "@/app/lib/philos/canon/verifyEffectAction";

export interface VerifiableEffect {
  effect_id: string;
  label: string;
  /** Shown so the verifier knows consent is required before they tick it. */
  concerns_subject_internal_state: boolean;
}

export default function VerifyEffectForm({ effects }: { effects: VerifiableEffect[] }) {
  const [result, setResult] = useState<VerifyEffectResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (effects.length === 0) {
    return (
      <div dir="rtl" id="verify-effect" style={emptyStyle}>
        <b>אימות תוצאה</b> — אין כרגע תוצאה שממתינה לאימות.
        תוצאה נכנסת לרשימה הזו אחרי שנרשמה, וכל עוד לא אומתה.
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      id="verify-effect"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => setResult(await verifyEffect(formData)));
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>אימות תוצאה · VERIFY OUTCOME</div>
      <div style={{ fontSize: 12, color: "#8fa3c9", lineHeight: 1.6 }}>
        הטופס הזה מיועד <b>לאדם אחר</b>: לא למי שביצע את הפעולה, ולא למי שהתוצאה נוגעת אליו.
        המערכת מזהה את המאמת לפי החשבון המחובר, ולכן אי אפשר לרשום כאן שם של מישהו אחר.
        אימות נרשם פעם אחת בלבד לכל תוצאה.
      </div>

      <select name="effect_id" required style={selectStyle} defaultValue="">
        <option value="">— בחר תוצאה לאימות —</option>
        {effects.map((e) => <option key={e.effect_id} value={e.effect_id}>{e.label}</option>)}
      </select>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {/* `self` is absent from this list, not merely discouraged. */}
        <select name="verifier_type" required style={selectStyle} defaultValue="">
          <option value="">— סוג האימות —</option>
          <option value="counterparty">הייתי צד בעניין וראיתי את התוצאה</option>
          <option value="third_party">צפיתי מבחוץ, ואיני צד בעניין</option>
          <option value="observed_measured">התוצאה נמדדה או תועדה באופן שאפשר להראות</option>
        </select>
        <input name="confidence" type="number" min={0} max={1} step={0.05} placeholder="עד כמה אני בטוח (0–1)" required style={inputStyle} />
      </div>

      <input name="statement" type="text" placeholder="מה בדיוק אני מאשר שקרה?" required style={inputStyle} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="method" type="text" placeholder="איך ידעתי — מה ראיתי או מדדתי?" required style={inputStyle} />
        <input name="provenance" type="text" placeholder="מהיכן הידיעה הגיעה" required style={inputStyle} />
      </div>

      <label style={{ fontSize: 13, display: "block", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="subject_consent" />{" "}
        הנבדק הסכים במפורש שאאמת תוצאה הנוגעת למצבו הפנימי
      </label>
      <div style={{ fontSize: 12, color: "#8fa3c9", lineHeight: 1.5 }}>
        כשהתוצאה נוגעת למצב פנימי של אדם — מה שהוא מרגיש, חושב או חווה — אי אפשר לאמת אותה בלי הסכמתו.
        אדם מבחוץ אינו רשאי לקבוע עבור אדם אחר מה מצבו הפנימי.
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "אמת תוצאה · VERIFY"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? "האימות נרשם — התוצאה נחשבת מעכשיו ראיה." : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const emptyStyle: React.CSSProperties = { fontSize: 13, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12, lineHeight: 1.6 };
const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 160 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
