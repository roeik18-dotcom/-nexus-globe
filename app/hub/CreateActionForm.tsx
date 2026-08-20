"use client";

/**
 * LOOP 5 — the acquisition path for real Action creation. `recordAction`
 * (`actionLifecycle.ts`) has been real and persisted since the Marketplace
 * Legacy Convergence pass, but was never reachable from any UI until this
 * form. `inputs` is optional: real Need/Offer ids `person_roei` already
 * owns, offered as checkboxes — never invented, never required.
 *
 * Match→Action integrity gate: when `inputs` selects BOTH a real Need
 * and a real Offer, `createActionForCurrentUserCore` now requires a
 * valid, matching `MatchPermit` (see `matchPermit.ts`) or rejects the
 * submission. `matchPermit` is optional here — this form works exactly
 * as before for any Action that doesn't reference a Need+Offer pair;
 * the composing parent (`MatchActionFlow.tsx`, `/marketplace`) supplies
 * it when the user just ran a permitted evaluation.
 */
import { useState, useTransition } from "react";
import { createActionForCurrentUser, type CreateActionResult } from "@/app/lib/philos/canon/actionFormAction";
import type { MatchPermit } from "@/app/lib/philos/canon/matchPermit";

const TYPES: { value: "transfer" | "non_transfer"; label: string }[] = [
  { value: "non_transfer", label: "non_transfer — הסרת חסם / שינוי גבול / יצירת גישה" },
  { value: "transfer", label: "transfer — העברה בין-אישית" },
];
const SCOPES: { value: "self_regulation" | "melting_pot"; label: string }[] = [
  { value: "self_regulation", label: "self_regulation — ויסות עצמי" },
  { value: "melting_pot", label: "melting_pot — כור היתוך (בין-אישי)" },
];

export default function CreateActionForm({
  inputOptions, matchPermit,
}: {
  inputOptions: { id: string; label: string }[];
  matchPermit?: MatchPermit | null;
}) {
  const [result, setResult] = useState<CreateActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        startTransition(async () => {
          const r = await createActionForCurrentUser(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>פעולה חדשה · NEW ACTION (person_roei)</div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="type" required style={selectStyle}>{TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select>
        <select name="mechanism_scope" required style={selectStyle}>{SCOPES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}</select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input name="reversibility" type="text" placeholder="reversibility — כמה ניתנת לביטול?" required style={inputStyle} />
        <input name="provenance" type="text" placeholder="provenance — מקור הפעולה" required style={inputStyle} />
      </div>
      {inputOptions.length > 0 ? (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontSize: 13 }}>
          <span style={{ color: "#6c86b5" }}>inputs (אופציונלי):</span>
          {inputOptions.map((o) => (
            <label key={o.id} style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <input type="checkbox" name="inputs" value={o.id} /> {o.label}
            </label>
          ))}
        </div>
      ) : null}
      {matchPermit ? (
        <>
          <input type="hidden" name="match_permit" value={JSON.stringify(matchPermit)} />
          <div style={{ fontSize: 13, color: "#34d399" }}>
            MATCH PERMIT זמין ({matchPermit.need_id.slice(0, 10)}…↔{matchPermit.offer_id.slice(0, 10)}…) — יאומת אם תבחר גם Need וגם Offer זה למעלה ב-inputs.
          </div>
        </>
      ) : (
        <div style={{ fontSize: 12, color: "#6c86b5" }}>
          אין MATCH PERMIT זמין — Action שבוחר גם Need וגם Offer יידחה ללא הערכת התאמה מותרת קודמת.
        </div>
      )}
      <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <input type="checkbox" name="consent" /> consent — אני מסכים/ה שפעולה זו תירשם (canon §10)
      </label>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום פעולה · RECORD ACTION"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · action_id: ${result.action_id.slice(0, 12)}…` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 160 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 160 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
