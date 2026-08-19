"use client";

/**
 * LOOP 6 (LEARNING) — the acquisition path for the real State' boundary.
 * `candidate_level`/`candidate_stability` are the caller's own real
 * self-assessment of their new state — canon's own design forbids this
 * module from computing that number itself (see
 * `learningFormAction.ts` header). The outcome (`state_prime` vs.
 * `no_update`, with its real reason) is shown exactly as canon's gate
 * decided it — never overridden client-side.
 */
import { useState, useTransition } from "react";
import { createLearningForCurrentUser, type CreateLearningResult } from "@/app/lib/philos/canon/learningFormAction";

export default function CreateLearningForm({
  effectOptions,
  observationOptions,
}: {
  effectOptions: { effect_id: string; label: string }[];
  observationOptions: { canon_event_id: string; label: string }[];
}) {
  const [result, setResult] = useState<CreateLearningResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (effectOptions.length === 0 || observationOptions.length === 0) {
    return (
      <div dir="rtl" style={{ fontSize: 11, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        למידה (canon) · LEARNING — דורש לפחות Effect אמיתי אחד ו-Observation אמיתית אחת (מצב קודם).
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await createLearningForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 0.5, color: "#8fa3c9" }}>למידה חדשה · NEW LEARNING (person_roei) — State → State'</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="effect_ref" required style={selectStyle}>
          <option value="">— בחר Effect —</option>
          {effectOptions.map((e) => <option key={e.effect_id} value={e.effect_id}>{e.label}</option>)}
        </select>
        <select name="canon_event_id" required style={selectStyle}>
          <option value="">— בחר Observation (מצב קודם) —</option>
          {observationOptions.map((o) => <option key={o.canon_event_id} value={o.canon_event_id}>{o.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="candidate_level" type="number" step={0.1} placeholder="candidate_level — הרמה החדשה" required style={inputStyle} />
        <input name="candidate_stability" type="number" step={0.1} placeholder="candidate_stability — היציבות החדשה" required style={inputStyle} />
        <input name="confidence" type="number" min={0} max={1} step={0.05} placeholder="confidence (0–1)" required style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="update_method" type="text" placeholder="update_method — איך העריכו את המצב החדש?" required style={inputStyle} />
        <input name="context" type="text" placeholder="context" required style={inputStyle} />
        <input name="provenance" type="text" placeholder="provenance" required style={inputStyle} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום למידה · RECORD LEARNING"}</button>
        {result ? (
          <span style={{ fontSize: 11, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok
              // `state_prime` means the GATE accepted the caller's proposed
              // candidate — it does not set, persist or reach a State(t+1).
              // See `canon/STATE-TRANSITION-BOUNDARY.md`.
              ? result.outcome === "state_prime"
                ? `נרשם · candidate_state_prime התקבל בשער — מועמד בלבד, לא State(t+1) (learning_id: ${result.learning_id.slice(0, 10)}…)`
                : `נרשם · אין עדכון מצב — ${result.reason} (learning_id: ${result.learning_id.slice(0, 10)}…)`
              : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 200 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 12, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
