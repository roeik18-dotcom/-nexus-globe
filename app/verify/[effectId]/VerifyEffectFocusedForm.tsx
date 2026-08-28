"use client";

/**
 * THE FIVE FIELDS, AND NOTHING ELSE.
 *
 * The verifier's own words: what they are confirming, how they know, where
 * the knowledge came from, how sure they are, and — only when the outcome is
 * about someone's inner state — whether that person consented.
 *
 * `verifier_id` is absent by design. It is taken from the session on the
 * server, so there is no field here for naming somebody else, and no way to
 * submit a verification as a person you are not.
 */
import { useState, useTransition } from "react";

import { verifyEffect, type VerifyEffectResult } from "@/app/lib/philos/canon/verifyEffectAction";

export default function VerifyEffectFocusedForm({
  effectId, concernsInternalState, subject,
}: {
  effectId: string;
  concernsInternalState: boolean;
  subject: string;
}) {
  const [result, setResult] = useState<VerifyEffectResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (result?.ok) return <VerificationRecorded verifier_id={result.verifier_id} effect_id={result.effect_id} />;

  return (
    <form
      dir="rtl"
      id="verify-effect"
      data-verify-form
      style={S.form}
      action={(formData) => {
        formData.set("effect_id", effectId);
        startTransition(async () => setResult(await verifyEffect(formData)));
      }}
    >
      <label style={S.field}>
        <span style={S.label}>מה בדיוק מאושר כאן — מה קרה בפועל?</span>
        <textarea name="statement" required rows={3} style={S.textarea}
          placeholder="במילים שלך — מה נראה או נודע" />
      </label>

      <label style={S.field}>
        <span style={S.label}>איך ידעת?</span>
        <input name="method" type="text" required style={S.input}
          placeholder="ראיתי בעצמי / נכחתי / נמדד ותועד" />
      </label>

      <label style={S.field}>
        <span style={S.label}>מהיכן הידיעה הגיעה?</span>
        <input name="provenance" type="text" required style={S.input}
          placeholder="מקור הידיעה" />
      </label>

      <label style={S.field}>
        <span style={S.label}>מה סוג הבדיקה שלך?</span>
        {/* `self` is absent, not merely discouraged — it is not a check. */}
        <select name="verifier_type" required defaultValue="" style={S.input}>
          <option value="" disabled>— בחר/י —</option>
          <option value="counterparty">הייתי צד בעניין וראיתי את התוצאה</option>
          <option value="third_party">צפיתי מבחוץ, ואיני צד בעניין</option>
          <option value="observed_measured">התוצאה נמדדה או תועדה באופן שאפשר להראות</option>
        </select>
      </label>

      <label style={S.field}>
        <span style={S.label}>רמת הוודאות (0 עד 1)</span>
        <input name="confidence" type="number" min={0} max={1} step={0.05} required
          style={S.input} placeholder="למשל 0.85" />
      </label>

      {/* Only shown when it is load-bearing. An always-visible consent box on an
          external fact would be a question with no meaning. */}
      {concernsInternalState ? (
        <div style={S.consent}>
          <label style={S.checkRow}>
            <input type="checkbox" name="subject_consent" />
            <span>{subject} הסכים/ה במפורש שאאמת תוצאה הנוגעת למצבו/ה הפנימי</span>
          </label>
          <p style={S.consentNote}>
            כשהתוצאה נוגעת למה שאדם מרגיש, חושב או חווה — אי אפשר לאמת אותה בלי הסכמתו.
            אדם מבחוץ אינו רשאי לקבוע עבור אדם אחר מה מצבו הפנימי.
          </p>
        </div>
      ) : null}

      <div style={S.actions}>
        <button type="submit" disabled={pending} style={S.btn}>
          {pending ? "רושם…" : "אמת תוצאה"}
        </button>
        {result && !result.ok ? (
          <span style={S.err} role="alert" data-verify-error={result.reason}>{result.message}</span>
        ) : null}
      </div>
    </form>
  );
}

/**
 * THE SUCCESS SCREEN, as its own component so it can be asserted directly.
 *
 * It says three things a person needs after submitting: that it landed, what
 * changed because of it, and whose name it was recorded under. The last one
 * matters — a verification is an act by a named person, and showing the name
 * back is how they can tell the system recorded the right one.
 */
export function VerificationRecorded({
  verifier_id, effect_id,
}: { verifier_id: string; effect_id: string }) {
  return (
    <div dir="rtl" style={S.done} role="status" data-verify-done data-verifier={verifier_id}>
      <div style={S.doneTitle}>האימות נרשם</div>
      <p style={S.doneBody}>
        מרגע זה התוצאה נחשבת <b>ראיה</b>: אדם אחר — לא מי שביצע את הפעולה ולא מי שהיא נוגעת אליו — בדק אותה ואישר.
      </p>
      <p style={S.doneBody}>
        אין צורך לשלוח שוב. אימות נרשם פעם אחת בלבד לכל תוצאה, וניסיון נוסף יידחה.
      </p>
      <p style={S.doneMeta}>נרשם על שם {verifier_id} · תוצאה {effect_id}</p>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  form: { display: "grid", gap: 14, minWidth: 0 },
  field: { display: "grid", gap: 6, minWidth: 0 },
  label: { fontSize: 13, color: "#9fb0d0", fontWeight: 600 },
  input: {
    background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550",
    borderRadius: 8, padding: "10px 12px", fontSize: 15, width: "100%",
    maxWidth: "100%", boxSizing: "border-box", fontFamily: "inherit",
  },
  textarea: {
    background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550",
    borderRadius: 8, padding: "10px 12px", fontSize: 15, width: "100%",
    maxWidth: "100%", boxSizing: "border-box", resize: "vertical",
    fontFamily: "inherit", lineHeight: 1.5,
  },
  consent: {
    background: "rgba(90,120,180,0.06)", border: "1px solid #1e2942",
    borderRadius: 10, padding: "12px 14px", display: "grid", gap: 8,
  },
  checkRow: { display: "flex", alignItems: "flex-start", gap: 8, fontSize: 14, lineHeight: 1.5 },
  consentNote: { margin: 0, fontSize: 12, color: "#8fa3c9", lineHeight: 1.6 },
  actions: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, minWidth: 0 },
  btn: {
    background: "#34d399", color: "#02101f", fontWeight: 800, fontSize: 15,
    border: "none", borderRadius: 8, padding: "11px 22px", cursor: "pointer",
    fontFamily: "inherit",
  },
  err: { fontSize: 13, color: "#f2635c", overflowWrap: "anywhere", minWidth: 0 },
  done: {
    background: "rgba(52,211,153,0.10)", border: "1px solid rgba(52,211,153,0.40)",
    borderRadius: 10, padding: "16px 18px", display: "grid", gap: 8,
  },
  doneTitle: { fontSize: 18, fontWeight: 800, color: "#34d399" },
  doneBody: { margin: 0, fontSize: 14, lineHeight: 1.6 },
  doneMeta: { margin: 0, fontSize: 12, color: "#8fa3c9" },
};
