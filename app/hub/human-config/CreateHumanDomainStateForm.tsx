"use client";

/**
 * State-fusion backbone — the real acquisition path for Human Config
 * state. Parameter choices come ONLY from `TEMPERAMENT_DIMENSIONS` — the
 * one real, already-curated set of genuinely measurable Human parameters
 * (7 real Canonical_IDs under the source's own "ממדי מזג — פרמטרים
 * לאבחון" heading; every other Human Config concept is an aphorism/
 * principle/insight, not something with a "level," per
 * `humanConfigHierarchy.ts`'s own audit). This form does NOT expose all
 * ~1200 concepts — that would either fabricate a level for a quote or
 * force the user through schema jargon they didn't ask for.
 *
 * `domain_id` is fixed to `"human_temperament"` — a real, stable domain
 * name for this one real measurable Human parameter set, not a DEMO
 * placeholder and not user-typed (no ambiguity about which domain a
 * Temperament reading belongs to).
 */
import { useState, useTransition } from "react";
import { createDomainStateForCurrentUser, type CreateDomainStateResult } from "@/app/lib/philos/canon/domainStateFormAction";
import { TEMPERAMENT_DIMENSIONS } from "@/app/lib/philos/humanConfig/temperamentDimensions";

export const HUMAN_TEMPERAMENT_DOMAIN_ID = "human_temperament";

export default function CreateHumanDomainStateForm() {
  const [result, setResult] = useState<CreateDomainStateResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        formData.set("domain_id", HUMAN_TEMPERAMENT_DOMAIN_ID);
        startTransition(async () => {
          const r = await createDomainStateForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>
        מצב אנושי חדש · NEW HUMAN STATE (person_roei) — פרמטר מזג אמיתי בלבד, לא כל 926 המושגים
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="parameter_id" required style={selectStyle}>
          <option value="">— בחר פרמטר מזג —</option>
          {TEMPERAMENT_DIMENSIONS.map((d) => (
            <option key={d.parameter_id} value={d.parameter_id}>{d.label_he} · {d.low}↔{d.high}</option>
          ))}
        </select>
        <input name="level" type="number" step="0.1" placeholder="level (מספר, כיוון תלוי פרמטר)" required style={inputStyle} />
        <input name="confidence" type="number" step="0.05" min={0} max={1} placeholder="confidence (0–1)" required style={inputStyle} />
      </div>
      <input name="evidence" type="text" placeholder="evidence — מה מבוסס עליו? (רשות)" style={{ ...inputStyle, width: "100%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום מצב אנושי · RECORD"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · state_id: ${result.state_id.slice(0, 12)}… · level ${result.level}` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 200 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
