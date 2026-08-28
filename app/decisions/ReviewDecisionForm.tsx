"use client";

/**
 * Reviewing one decision at its horizon.
 *
 * The form shows the pre-registered expectation ABOVE the answer box and
 * does not let it be edited — the whole value of the record is that this
 * sentence was fixed before the outcome was known.
 *
 * The causal rung is offered as a claim, and the server stores what the
 * claim EARNS (`checkCausalClaim`). When it is demoted the screen says so
 * afterwards rather than silently recording something weaker.
 */
import { useActionState } from "react";

import { EXPECTATION_OUTCOMES } from "@/app/lib/philos/decision/decisionReview";
import { recordReviewFormAction, type ReviewFormState } from "@/app/lib/philos/decision/decisionActions";
import { CAUSAL_RELATION } from "@/app/lib/philos/decision/evidenceAxes";

const OUTCOME_LABEL: Record<string, string> = {
  met: "כן, זה קרה",
  partly: "חלקית",
  not_met: "לא, זה לא קרה",
  cannot_tell: "עדיין אי אפשר לדעת",
};

/** The OUTCOME axis, shown for orientation only — it is DERIVED from the
 *  canon Effect and its verification, never chosen on this form. */
const LEVEL_LABEL: Record<string, string> = {
  self_attested: "דיווח עצמי מסומן",
  measured: "מדידה או תיעוד",
  corroborated: "אושש בידי הצד השני",
  independently_verified: "אומת בידי גורם עצמאי",
};

const RELATION_LABEL: Record<string, string> = {
  occurred_after: "זה קרה אחרי",
  associated_with: "יש קשר",
  probably_contributed: "כנראה תרם",
  causally_supported: "נתמך סיבתית",
  experimentally_demonstrated: "הודגם בחזרה או בביקורת",
};

export default function ReviewDecisionForm({
  decisionId,
  expectation,
  requiredLevel,
  hasAlternatives,
}: {
  decisionId: string;
  expectation: string;
  requiredLevel: string;
  hasAlternatives: boolean;
}) {
  const [state, formAction, pending] = useActionState<ReviewFormState, FormData>(
    recordReviewFormAction,
    {},
  );

  if (state.ok) {
    return (
      <div dir="rtl" style={S.done}>
        <div style={S.doneTitle}>הסקירה נרשמה</div>
        <p style={S.doneBody}>
          נרשם: <b>{RELATION_LABEL[state.causal_relation ?? "occurred_after"]}</b>.
          {state.capped ? " זה פחות ממה שביקשת — הראיה שהצגת לא מספיקה לדרגה גבוהה יותר." : null}
        </p>
      </div>
    );
  }

  return (
    <form action={formAction} noValidate dir="rtl" style={S.form}>
      <input type="hidden" name="decision_ref" value={decisionId} />

      {/* FIXED, NOT EDITABLE. Written before the outcome was known — that is
          the entire basis on which this review can be honest. */}
      <div style={S.expectation}>
        <span style={S.expectationLabel}>מה ציפית שיקרה</span>
        <p style={S.expectationText}>{expectation}</p>
      </div>

      <Field label="מה קרה בפועל">
        <textarea name="what_happened" rows={3} style={S.input} />
      </Field>

      <Field label="האם הציפייה התממשה">
        <select name="expectation_met" defaultValue="cannot_tell" style={S.input}>
          {EXPECTATION_OUTCOMES.map((o: string) => (
            <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
          ))}
        </select>
      </Field>

      <Field
        label="מה עוד יכול להסביר את התוצאה"
        hint="שורה לכל הסבר חלופי. בלי לפחות אחד אי אפשר לטעון ״נתמך סיבתית״ — אין למה להשוות."
      >
        <textarea name="alternative_explanations" rows={2} style={S.input} />
      </Field>

      <Field label="מה עוד קרה באותו זמן" hint="גורמים מתערבים. שורה לכל אחד.">
        <textarea name="intervening_factors" rows={2} style={S.input} />
      </Field>

      {/* THE OUTCOME AXIS IS NOT A FIELD. It is derived from the canon Effect
          and whatever verification that Effect carries — offering it here
          would let a person type a level the records do not support, which is
          the duplication this rebuild removed. The floor is shown so the
          reason a causal rung is unavailable is legible. */}
      <div style={S.expectation}>
        <span style={S.expectationLabel}>רמת האימות הנדרשת לסיכון הזה</span>
        <p style={S.expectationText}>{LEVEL_LABEL[requiredLevel] ?? requiredLevel}</p>
      </div>

      <Field
        label="עד כמה ההחלטה עצמה גרמה לזה"
        hint={
          hasAlternatives
            ? "מה שתבחר נבדק מול הראיה. אם היא לא מספיקה — יירשם מה שהיא כן מאפשרת."
            : "לא נרשמה חלופה בזמן ההחלטה, ולכן ״נתמך סיבתית״ אינו זמין כאן — אין למה להשוות."
        }
      >
        <select name="causal_relation" defaultValue="occurred_after" style={S.input}>
          {CAUSAL_RELATION.map((c: string) => (
            <option key={c} value={c}>{RELATION_LABEL[c]}</option>
          ))}
        </select>
      </Field>

      <Field label="חזרה או ביקורת, אם יש" hint="נדרש רק לדרגה הגבוהה ביותר. אפשר להשאיר ריק.">
        <input name="comparison_basis" style={S.input} />
      </Field>

      <Field label="טווח הזמן שנבדק" hint="אפשר להשאיר ריק.">
        <input name="time_window" style={S.input} />
      </Field>

      <div style={S.actions}>
        <button type="submit" disabled={pending} style={S.submit}>
          {pending ? "רושם…" : "רשום סקירה"}
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
  field: { display: "grid", gap: 4, minWidth: 0 },
  label: { fontSize: 14, fontWeight: 700, color: "#e6ebf5" },
  hint: { fontSize: 12.5, lineHeight: 1.5, color: "#8fa3c9" },
  input: {
    width: "100%", boxSizing: "border-box", padding: "8px 10px", fontSize: 15,
    fontFamily: "inherit", color: "#f2f6fc", background: "#0e1524",
    border: "1px solid rgba(120,150,220,0.28)", borderRadius: 8,
  },
  expectation: {
    padding: "10px 14px", borderRadius: 10, background: "rgba(91,156,246,0.08)",
    border: "1px solid rgba(91,156,246,0.3)", display: "grid", gap: 4,
  },
  expectationLabel: { fontSize: 12, fontWeight: 700, color: "#7fb0f5" },
  expectationText: { margin: 0, fontSize: 15.5, lineHeight: 1.6, color: "#e6ebf5" },
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
