"use client";

/**
 * State-fusion backbone — the real acquisition path for Value Domain
 * state (Section 3 of the product decision: "generalize the existing
 * Value/Music demo contract... Music can become the first real Value
 * Domain later, but do not fabricate Roei's Music state").
 *
 * No pre-populated domain/parameter catalog exists for this path — the
 * only existing catalog (`demoMusicDomain.ts`) is explicitly DEMO and
 * must never be offered as if it were real (see that file's own
 * header). So `domain_id`/`parameter_id` are real free-text fields here:
 * the user names their own first real Value Domain and parameter (e.g.
 * "music" / "harmony_practice", or any other domain entirely) — matching
 * `valueDomainConfig.ts`'s own design goal, "a second, unrelated Value
 * Domain could use it without any code change."
 */
import { useState, useTransition } from "react";
import { createDomainStateForCurrentUser, type CreateDomainStateResult } from "@/app/lib/philos/canon/domainStateFormAction";

export default function CreateValueDomainStateForm() {
  const [result, setResult] = useState<CreateDomainStateResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await createDomainStateForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>
        מצב תחום-ערך חדש · NEW VALUE-DOMAIN STATE (person_roei) — לא Music דמו; תחום אמיתי משלך
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="domain_id" type="text" placeholder="domain_id — לדוגמה: music, career, language" required style={inputStyle} />
        <input name="parameter_id" type="text" placeholder="parameter_id — לדוגמה: harmony_practice" required style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="level" type="number" step="0.1" placeholder="level" required style={inputStyle} />
        <input name="confidence" type="number" step="0.05" min={0} max={1} placeholder="confidence (0–1)" required style={inputStyle} />
      </div>
      <input name="evidence" type="text" placeholder="evidence — מה מבוסס עליו? (רשות)" style={{ ...inputStyle, width: "100%" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום מצב תחום-ערך · RECORD"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · state_id: ${result.state_id.slice(0, 12)}… · ${result.domain_id}/${result.parameter_id} · level ${result.level}` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
