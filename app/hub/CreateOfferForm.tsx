"use client";

/**
 * LOOP 3 — the acquisition path for the "AVAILABLE RESOURCES: 0" empty
 * state. §52 consolidation: calls the SAME `registerOfferAction`
 * `/marketplace`'s own real form already uses (`app/marketplace/actions.ts`)
 * — no parallel Offer write path, no duplicate Offer model. Fields trimmed
 * to exactly what `registerOfferCore` persists (available_resource,
 * resource_type, amount_or_capacity, domain, willingness, consent) — it
 * fixes `frame:"I"`, `competence`, `availability`, `cost` internally, so
 * asking for them here would silently discard whatever the user typed.
 * `willingness`/`consent` are canon's own CONSENT gate (§10) — real
 * checkboxes the user must actually check, never pre-checked.
 */
import { useState, useTransition } from "react";
import { registerOfferAction, type RegisterActionResult } from "@/app/marketplace/actions";

const DOMAINS: { value: "G" | "E" | "C"; label: string }[] = [
  { value: "G", label: "גוף · Body" },
  { value: "E", label: "רגש · Emotion" },
  { value: "C", label: "שכל · Cognition" },
];

export default function CreateOfferForm() {
  const [result, setResult] = useState<RegisterActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await registerOfferAction(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 11, letterSpacing: 0.5, color: "#8fa3c9" }}>משאב חדש · NEW OFFER (person_roei) — אותו Offer store כמו /marketplace</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="domain" required style={selectStyle}>{DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}</select>
        <input name="available_resource" type="text" placeholder="available_resource" required style={inputStyle} />
        <input name="resource_type" type="text" placeholder="resource_type" required style={inputStyle} />
        <input name="amount_or_capacity" type="text" placeholder="amount_or_capacity" required style={inputStyle} />
      </div>
      <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="willingness" /> willingness — אני מוכן/ה בפועל להעניק זאת
      </label>
      <label style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="consent" /> consent — אני מסכים/ה שמידע זה יירשם ויוצג (canon §10)
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום משאב · RECORD OFFER"}</button>
        {result ? (
          <span style={{ fontSize: 11, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · offer_id: ${result.id.slice(0, 8)}…` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 12, flex: 1, minWidth: 120 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 12, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
