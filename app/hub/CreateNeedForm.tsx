"use client";

/**
 * LOOP 2 — the acquisition path for the "OPEN NEEDS: 0" empty state on
 * Community. §52 consolidation: calls the SAME `registerNeedAction`
 * `/marketplace`'s own real form already uses (`app/marketplace/actions.ts`)
 * — no parallel Need write path, no duplicate Need model. Community and
 * Marketplace read and write the exact same canon Need store.
 */
import { useState, useTransition } from "react";
import { registerNeedAction, type RegisterActionResult } from "@/app/marketplace/actions";

const DOMAINS: { value: "G" | "E" | "C"; label: string }[] = [
  { value: "G", label: "גוף · Body" },
  { value: "E", label: "רגש · Emotion" },
  { value: "C", label: "שכל · Cognition" },
];

export default function CreateNeedForm(
  /**
   * ORIGIN GROUP — supplied by the calling surface when the write genuinely
   * happens inside a group (Community passes its active real group).
   * Marketplace passes nothing and no link is created there.
   *
   * Rendered as a VISIBLE statement, never a silent hidden field: the person
   * can see which group their Need will be attached to before submitting,
   * because this is the one input that will create a REAL group relation.
   */
  { community }: { community?: { group_id: string; label: string } } = {},
) {
  const [result, setResult] = useState<RegisterActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        formData.set("context", community ? `registered via Community — ${community.group_id}` : "registered via Community");
        // Explicit only. No group prop -> no field -> no link.
        if (community) formData.set("community", community.group_id);
        startTransition(async () => {
          const r = await registerNeedAction(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>צורך חדש · NEW NEED (person_roei) — אותו Need store כמו /marketplace</div>
      {community ? (
        <div style={{ fontSize: 13, color: "#34d399", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 12, letterSpacing: 1, border: "1px solid rgba(52,211,153,0.4)", borderRadius: 4, padding: "1px 5px" }}>COMMUNITY_HAS_NEED</span>
          <span>ייווצר קשר אמיתי לקבוצה <b>{community.label}</b> — הצורך עצמו נשאר של האדם ({community.group_id})</span>
        </div>
      ) : null}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="domain" required style={selectStyle}>
          {DOMAINS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
        </select>
        <input name="desired_change" type="text" placeholder="desired_change — מה השינוי הרצוי?" required style={{ ...inputStyle, flex: 2 }} />
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "רושם…" : "רשום צורך · RECORD NEED"}</button>
        {result ? (
          <span style={{ fontSize: 13, color: result.ok ? "#34d399" : "#f2635c" }}>
            {result.ok ? `נרשם · need_id: ${result.id.slice(0, 12)}…` : result.message}
          </span>
        ) : null}
      </div>
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13 };
const inputStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 140 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
