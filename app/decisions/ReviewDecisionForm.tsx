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

import { CAUSAL_SUPPORT, EXPECTATION_OUTCOMES } from "@/app/lib/philos/decision/decisionReview";
import { recordReviewFormAction, type ReviewFormState } from "@/app/lib/philos/decision/decisionActions";
import { VERIFICATION_TIERS } from "@/app/lib/philos/decision/decision";

const OUTCOME_LABEL: Record<string, string> = {
  met: "כן, זה קרה",
  partly: "חלקית",
  not_met: "לא, זה לא קרה",
  cannot_tell: "עדיין אי אפשר לדעת",
};

const TIER_LABEL: Record<string, string> = {
  self_attested: "אני אומר את זה — אישור עצמי מסומן",
  measured: "יש מדידה, קבלה או צד שני",
  independent: "אדם אחר בדק ואישר",
};

const SUPPORT_LABEL: Record<string, string> = {
  happened_after: "זה קרה אחרי",
  correlated: "יש קשר",
  plausibly_contributed: "כנראה תרם",
  causally_supported: "נתמך סיבתית",
  experimentally_shown: "הוכח בחזרה או בביקורת",
};

export default function ReviewDecisionForm({
  decisionId,
  expectation,
  requiredTier,
  hasAlternatives,
}: {
  decisionId: string;
  expectation: string;
  requiredTier: string;
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
          נרשם: <b>{SUPPORT_LABEL[state.causal_support ?? "happened_after"]}</b>.
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
          {EXPECTATION_OUTCOMES.map((o) => (
            <option key={o} value={o}>{OUTCOME_LABEL[o]}</option>
          ))}
        </select>
      </Field>

      <Field
        label="מה הפתיע אותך"
        hint="השדה הכי שימושי כאן. ציפייה שהתממשה לא מלמדת כלום; הפתעה היא המקום היחיד שבו משהו באמת מתעדכן."
      >
        <textarea name="surprise" rows={2} style={S.input} />
      </Field>

      <Field
        label="איך אתה יודע"
        hint={`רמת הסיכון של ההחלטה הזו דורשת לפחות: ${TIER_LABEL[requiredTier] ?? requiredTier}`}
      >
        <select name="verification_tier" defaultValue="self_attested" style={S.input}>
          {VERIFICATION_TIERS.map((t) => (
            <option key={t} value={t}>{TIER_LABEL[t]}</option>
          ))}
        </select>
      </Field>

      <Field
        label="עד כמה ההחלטה עצמה גרמה לזה"
        hint={
          hasAlternatives
            ? "מה שתבחר נבדק מול הראיה. אם היא לא מספיקה — יירשם מה שהיא כן מאפשרת."
            : "לא נרשמה חלופה בזמן ההחלטה, ולכן ״נתמך סיבתית״ אינו זמין כאן — אין למה להשוות."
        }
      >
        <select name="causal_support" defaultValue="happened_after" style={S.input}>
          {CAUSAL_SUPPORT.map((c) => (
            <option key={c} value={c}>{SUPPORT_LABEL[c]}</option>
          ))}
        </select>
      </Field>

      <Field label="חזרה או ביקורת, אם יש" hint="נדרש רק לדרגה הגבוהה ביותר. אפשר להשאיר ריק.">
        <input name="comparison_basis" style={S.input} />
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
