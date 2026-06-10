"use client";

/**
 * Nexus — User Intake V1.
 *
 * Convert a stranger into a Personal Map in under 60 seconds. THREE questions
 * only (resistance · need · values), each one tap. The answers select within the
 * EXISTING chain — no new engine, no new calculation, no change to Noa outputs.
 * Success metric is completion rate, not orientation accuracy.
 */

import { useState } from "react";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};

export type Dimension = "Physical" | "Emotional" | "Rational";

/** The profile produced by intake — pure selection, fed into the existing chain. */
export interface IntakeProfile {
  tensionDept: string;   // one of the 6 departments (Q1)
  needDim: Dimension;    // one of the 3 dimensions (Q2)
  values: string[];      // subset of the 5 core values (Q3)
}

// Q1 — where it hurts most → a tension field / department.
export const PAIN_OPTIONS: { label: string; dept: string }[] = [
  { label: "קשרים", dept: "Emotional" },
  { label: "ביטחון", dept: "ID" },
  { label: "בהירות", dept: "Rational" },
  { label: "כיוון", dept: "EGO" },
  { label: "אמת", dept: "SUPEREGO" },
  { label: "קיום", dept: "Physical" },
];

// Q2 — what you most need → a dimension.
export const NEED_OPTIONS: { label: string; dim: Dimension }[] = [
  { label: "עזרה מעשית", dim: "Physical" },
  { label: "תמיכה רגשית", dim: "Emotional" },
  { label: "ידע / הבנה", dim: "Rational" },
];

// Q3 — what matters to you → core values.
export const VALUE_OPTIONS: { label: string; value: string }[] = [
  { label: "אמת", value: "Truth" },
  { label: "צדק", value: "Justice" },
  { label: "הגנה", value: "Protection" },
  { label: "אחריות", value: "Responsibility" },
  { label: "כבוד", value: "Dignity" },
];

export default function UserIntake({ onDone }: { onDone: (p: IntakeProfile) => void }) {
  const [step, setStep] = useState(0);
  const [dept, setDept] = useState<string | null>(null);
  const [dim, setDim] = useState<Dimension | null>(null);
  const [values, setValues] = useState<string[]>([]);

  const toggleValue = (v: string) =>
    setValues(prev => (prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v]));

  const finish = () => onDone({ tensionDept: dept!, needDim: dim!, values });

  const opt = (label: string, selected: boolean, onClick: () => void, accent: string) => (
    <button key={label} onClick={onClick} style={{
      padding: "14px 16px", borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer",
      textAlign: "right", border: `1px solid ${selected ? accent : C.borderSoft}`,
      background: selected ? accent + "22" : "transparent", color: selected ? accent : C.text,
      transition: "all .15s",
    }}>{label}</button>
  );

  return (
    <div dir="rtl" style={{ padding: 16, color: C.text, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* progress */}
      <div style={{ display: "flex", gap: 6, marginBottom: 18 }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{ flex: 1, height: 4, borderRadius: 2, background: i <= step ? C.cyan : C.muted, transition: "background .3s" }} />
        ))}
      </div>
      <div style={{ fontSize: 10, color: C.borderSoft, letterSpacing: 1, marginBottom: 6 }}>שאלה {step + 1} מתוך 3 · פחות מדקה</div>

      {step === 0 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>איפה הכי כואב לך כרגע?</div>
          <div style={{ display: "grid", gap: 8 }}>
            {PAIN_OPTIONS.map(o => opt(o.label, dept === o.dept, () => { setDept(o.dept); setStep(1); }, C.red))}
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>מה אתה הכי צריך כרגע?</div>
          <div style={{ display: "grid", gap: 8 }}>
            {NEED_OPTIONS.map(o => opt(o.label, dim === o.dim, () => { setDim(o.dim); setStep(2); }, C.cyan))}
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>מה חשוב לך?</div>
          <div style={{ fontSize: 11, color: C.borderSoft, marginBottom: 14 }}>אפשר לבחור כמה</div>
          <div style={{ display: "grid", gap: 8 }}>
            {VALUE_OPTIONS.map(o => opt(o.label, values.includes(o.value), () => toggleValue(o.value), C.green))}
          </div>
          <button onClick={finish} disabled={values.length === 0} style={{
            marginTop: 18, padding: "13px 0", borderRadius: 10, fontSize: 15, fontWeight: 700,
            cursor: values.length ? "pointer" : "default", opacity: values.length ? 1 : 0.4,
            border: `1px solid ${C.green}`, background: "#0c3a2c", color: C.green,
          }}>צור את המפה שלי ←</button>
        </>
      )}

      {step > 0 && (
        <button onClick={() => setStep(s => Math.max(0, s - 1))} style={{
          marginTop: "auto", alignSelf: "flex-start", padding: "6px 12px", borderRadius: 6, fontSize: 11,
          cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.borderSoft,
        }}>→ חזרה</button>
      )}
    </div>
  );
}
