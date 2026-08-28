"use client";

/**
 * Recording a decision. Bound through `useActionState` over a SERVER action,
 * never a client closure — React disables a closure-bound form until
 * hydration and renders `javascript:throw` as its action, which is how the
 * verify button came to do nothing at all. This shape posts natively without
 * JS and enhances with it.
 *
 * Validation lives on the server for the same reason: a `required` attribute
 * is enforced by the browser, and a browser that refuses a submission leaves
 * no server-side trace and sometimes no visible message either. `noValidate`
 * is deliberate.
 */
import { useActionState } from "react";

import {
  type DecisionFormState,
  openCaseAndRecordDecisionFormAction,
} from "@/app/lib/philos/decision/decisionActions";
import { HORIZONS } from "@/app/lib/philos/decision/decision";
import { RISK_LEVELS } from "@/app/lib/philos/decision/evidenceAxes";

const RISK_LABEL: Record<string, string> = {
  low: "נמוך — דיווח עצמי מספיק",
  medium: "בינוני — צריך מדידה או תיעוד",
  significant: "משמעותי — צריך מדידה או אישוש",
  public: "פומבי או בלתי הפיך — צריך אימות עצמאי",
};

export default function RecordDecisionForm() {
  const [state, formAction, pending] = useActionState<DecisionFormState, FormData>(
    openCaseAndRecordDecisionFormAction,
    {},
  );

  if (state.ok) {
    return (
      <div dir="rtl" style={S.done}>
        <div style={S.doneTitle}>ההחלטה נרשמה</div>
        <p style={S.doneBody}>
          נחזור אליה במועד שקבעת. עד אז אין מה לעשות איתה — זה כל הרעיון.
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate dir="rtl" style={S.form}>
      <Field label="מה החלטת" hint="במילים שלך, כפי שתזכור אותן">
        <textarea name="statement" rows={2} style={S.input} />
      </Field>

      <Field label="למה" hint="הנימוק כפי שהוא עכשיו, לא כפי שיישמע אחר כך">
        <textarea name="because" rows={2} style={S.input} />
      </Field>

      <Field
        label="לפי איזה שיקול בחרת דווקא בזה"
        hint="הכלל שהכריע בין החלופות. זה הצעד שהמערכת השאירה עד היום משתמע."
      >
        <textarea name="decision_logic" rows={2} style={S.input} />
      </Field>

      <Field
        label="מה אתה מצפה שיקרה"
        hint="זה השדה היחיד שהופך את השאלה ״צדקתי?״ לניתנת לתשובה. הוא נכתב עכשיו, לפני שידוע."
      >
        <textarea name="expected_outcome" rows={2} style={S.input} />
      </Field>

      <Field
        label="מה עוד היה על השולחן"
        hint="שורה לכל חלופה. אפשר להשאיר ריק — אבל בלי חלופה אי אפשר יהיה לטעון אחר כך שההחלטה היא שגרמה."
      >
        <textarea name="alternatives" rows={2} style={S.input} />
      </Field>

      <div style={S.row}>
        <Field label="מתי לבדוק">
          <select name="horizon_days" defaultValue={7} style={S.input}>
            {HORIZONS.map((h) => (
              <option key={h.days} value={h.days}>{h.label}</option>
            ))}
          </select>
        </Field>

        <Field label="כמה זה עולה אם טעיתי">
          <select name="risk_level" defaultValue="low" style={S.input}>
            {RISK_LEVELS.map((s: string) => (
              <option key={s} value={s}>{RISK_LABEL[s]}</option>
            ))}
          </select>
        </Field>

        <Field label="כמה אתה בטוח" hint="0 עד 1">
          <input name="confidence" type="number" step="0.1" min="0" max="1" defaultValue="0.5" style={S.input} />
        </Field>
      </div>

      <div style={S.actions}>
        <button type="submit" disabled={pending} style={S.submit}>
          {pending ? "רושם…" : "רשום החלטה"}
        </button>
        {state.error ? <span style={S.error}>{state.error}</span> : null}
      </div>
    </form>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label style={S.field}>
      <span style={S.label}>{label}</span>
      {hint ? <span style={S.hint}>{hint}</span> : null}
      {children}
    </label>
  );
}

const S: Record<string, React.CSSProperties> = {
  form: { display: "grid", gap: 14 },
  field: { display: "grid", gap: 4, minWidth: 0, flex: "1 1 180px" },
  label: { fontSize: 14, fontWeight: 700, color: "#e6ebf5" },
  hint: { fontSize: 12.5, lineHeight: 1.5, color: "#8fa3c9" },
  input: {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 15,
    fontFamily: "inherit", color: "#f2f6fc", background: "#0e1524",
    border: "1px solid rgba(120,150,220,0.28)", borderRadius: 8,
  },
  row: { display: "flex", flexWrap: "wrap", gap: 12 },
  actions: { display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" },
  submit: {
    padding: "10px 20px", fontSize: 15, fontWeight: 700, fontFamily: "inherit",
    color: "#02101f", background: "#6fe3b4", border: "none", borderRadius: 999,
    cursor: "pointer",
  },
  error: { fontSize: 14, color: "#fbbf24" },
  done: {
    padding: 16, borderRadius: 12, background: "rgba(111,227,180,0.08)",
    border: "1px solid rgba(111,227,180,0.35)", display: "grid", gap: 6,
  },
  doneTitle: { fontSize: 17, fontWeight: 800, color: "#6fe3b4" },
  doneBody: { margin: 0, fontSize: 15, lineHeight: 1.6, color: "#c9d6ea" },
};
