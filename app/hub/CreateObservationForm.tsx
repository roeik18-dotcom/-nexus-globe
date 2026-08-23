"use client";

/**
 * LOOP 1 — the acquisition path for the "Human state: לא ידוע" empty state.
 * A real, minimal self-report form → `createObservationForCurrentUser` →
 * persisted canon Observation → Hub/Brain/Dynamics re-derive from it on
 * next load (server components, revalidated by the action itself).
 */
import { useState, useTransition } from "react";
import { createObservationForCurrentUser, type CreateObservationResult } from "@/app/lib/philos/canon/observationFormAction";

const DOMAINS: { value: "G" | "E" | "C"; label: string }[] = [
  { value: "G", label: "גוף · Body" },
  { value: "E", label: "רגש · Emotion" },
  { value: "C", label: "שכל · Cognition" },
];
const FRAMES: { value: "I" | "R"; label: string }[] = [
  { value: "I", label: "אישי · Individual" },
  { value: "R", label: "יחסי · Relational" },
];

export default function CreateObservationForm({ subject }: {
  /** The CURRENT viewer's canon subject, resolved server-side. The label was
   *  the literal string "(person_roei)", so every viewer — including one who
   *  is not Roei — was told the form writes as Roei. The write path itself was
   *  always correct (`createObservationForCurrentUser` resolves the session),
   *  which is exactly why the label had to be fixed rather than trusted: a
   *  screen that names the wrong author is a leak whether or not the write
   *  follows it. */
  subject?: string;
}) {
  const [result, setResult] = useState<CreateObservationResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await createObservationForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>תצפית עצמית חדשה · NEW SELF-OBSERVATION{subject ? ` (${subject})` : ""}</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="domain" required style={selectStyle}>
          {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <select name="frame" required style={selectStyle}>
          {FRAMES.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
        </select>
        <input name="level" type="number" step="0.1" placeholder="level (חתום: מחסור← שיווי משקל →עודף)" required style={inputStyle} />
        <input name="confidence" type="number" step="0.05" min={0} max={1} placeholder="confidence (0–1)" required style={inputStyle} />
      </div>
      <input name="context" type="text" placeholder="context — מה בפועל נצפה?" required style={{ ...inputStyle, width: "100%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום תצפית · RECORD"}</button>
      </div>
      {result ? (
        result.ok ? (
          <div style={{ fontSize: 13, color: "#34d399", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 6, padding: "6px 10px" }}>
            <div style={{ fontWeight: 700 }}>נרשם · RECORDED</div>
            <div style={{ color: "#cfe0f5", marginTop: 2 }}>
              entity id: {result.canon_event_id.slice(0, 12)}… · dimension: {result.domain}/{result.frame} ·
              confidence: {result.confidence} · time: {result.time.slice(0, 16).replace("T", " ")}
            </div>
            {result.before ? (
              <div style={{ color: "#cfe0f5", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(52,211,153,0.2)" }}>
                <div>BEFORE: level {result.before.level}, stability {result.before.stability} ({result.before.observed_at.slice(0, 16).replace("T", " ")})</div>
                <div>AFTER: level {result.after.level}, stability {result.after.stability}</div>
                <div style={{ color: "#fbbf24" }}>
                  Δ level {result.delta!.level >= 0 ? "+" : ""}{result.delta!.level.toFixed(2)}, Δ stability {result.delta!.stability >= 0 ? "+" : ""}{result.delta!.stability.toFixed(2)}
                </div>
              </div>
            ) : (
              <div style={{ color: "#6c86b5", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(52,211,153,0.2)" }}>
                אין שינוי מצב מוצדק קנונית: {result.gatingReason}
              </div>
            )}
          </div>
        ) : (
          <span style={{ fontSize: 13, color: "#f2635c" }}>{result.message}</span>
        )
      ) : null}
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
