"use client";

/**
 * QUARANTINE — this form triggers an EXISTING / EXPERIMENTAL PRODUCT RULE
 * (`prior.level + 1`), NOT a canonical PHILOS state transition. The UI now
 * says so at the point of use, in both the zero-state note and the success
 * panel, so nobody reads the resulting number as "the person's measured
 * state changed". Behavior is unchanged — see
 * `canon/domainStateLearning.ts`'s QUARANTINE header and
 * `canon/STATE-TRANSITION-BOUNDARY.md`.
 *
 * State-fusion backbone — the real user-facing trigger for
 * `applyDomainStateLearning` (`domainStateLearningAction.ts`). This
 * component duplicates NO validation logic: every gate (same subject,
 * same domain, same parameter, prior state before the Effect,
 * Action↔Effect link, verification threshold) lives entirely in
 * `deriveDomainStateLearning` and runs server-side; this form only
 * collects the five real references and displays whatever the real
 * action returns — success or a precise rejection reason.
 *
 * `parameterOptions` (real `domain_id`/`parameter_id` pairs with an
 * already-existing prior DomainState for this subject) is how "select
 * ONLY legitimate compatible records" is honored at the UI layer — a
 * combination with zero real prior state simply isn't offered, so the
 * common failure mode never needs to be discovered via a rejected
 * submit. Action/Effect options are still real, but not cross-filtered
 * against each other client-side — the real server-side check is
 * authoritative and reports precisely why a combination was rejected.
 */
import { useState, useTransition } from "react";
import { applyDomainStateLearning, type ApplyDomainStateLearningResult } from "@/app/lib/philos/canon/domainStateLearningAction";

export interface DomainStateParameterOption {
  domain_id: string;
  parameter_id: string;
  label: string;
  current_level: number;
  current_observed_at: string;
}

export default function CreateDomainStateLearningForm({
  parameterOptions, actionOptions, effectOptions,
}: {
  parameterOptions: DomainStateParameterOption[];
  actionOptions: { action_id: string; label: string }[];
  effectOptions: { effect_id: string; label: string }[];
}) {
  const [result, setResult] = useState<ApplyDomainStateLearningResult | null>(null);
  const [pending, startTransition] = useTransition();

  if (parameterOptions.length === 0 || actionOptions.length === 0 || effectOptions.length === 0) {
    return (
      <div dir="rtl" style={{ fontSize: 13, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ color: "#fbbf24", fontWeight: 700, marginBottom: 4 }}>
          כלל מוצר ניסיוני (DomainState · level + 1) — אינו מעבר מצב קנוני של PHILOS
        </div>
        עדכון DomainState — דורש לפחות מצב-דומיין אמיתי אחד (מעל), Action אמיתי אחד ו-Effect אמיתי אחד (ב-/marketplace).
        {parameterOptions.length === 0 ? " עדיין אין מצב-דומיין אמיתי — רשמו אחד למעלה." : ""}
      </div>
    );
  }

  return (
    <form
      dir="rtl"
      style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}
      action={(formData) => {
        const [domain_id, parameter_id] = String(formData.get("parameter_key") ?? "").split("::");
        formData.set("domain_id", domain_id ?? "");
        formData.set("parameter_id", parameter_id ?? "");
        startTransition(async () => {
          const r = await applyDomainStateLearning(formData);
          setResult(r);
        });
      }}
    >
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9" }}>
        עדכון DomainState (person_roei) — Prior State → Action → Effect → Updated DomainState
      </div>
      <div style={{ fontSize: 13, color: "#fbbf24", lineHeight: 1.45 }}>
        כלל מוצר ניסיוני · EXPERIMENTAL PRODUCT RULE — הרמה מתקדמת ב-<code>prior.level + 1</code>.
        זהו אינו מעבר מצב קנוני של PHILOS, ואינו קובע ש-State(t+1) של האדם השתנה.
        קנון אינו קובע כלל עדכון; השאלות הפתוחות מתועדות ב-<code>canon/STATE-TRANSITION-BOUNDARY.md</code>.
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="parameter_key" required style={selectStyle}>
          <option value="">— בחר פרמטר עם מצב קודם אמיתי —</option>
          {parameterOptions.map((p) => (
            <option key={`${p.domain_id}::${p.parameter_id}`} value={`${p.domain_id}::${p.parameter_id}`}>
              {p.label} · current: {p.current_level} ({p.current_observed_at.slice(0, 10)})
            </option>
          ))}
        </select>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select name="action_id" required style={selectStyle}>
          <option value="">— בחר Action —</option>
          {actionOptions.map((a) => <option key={a.action_id} value={a.action_id}>{a.label}</option>)}
        </select>
        <select name="effect_id" required style={selectStyle}>
          <option value="">— בחר Effect —</option>
          {effectOptions.map((e) => <option key={e.effect_id} value={e.effect_id}>{e.label}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button type="submit" disabled={pending} style={btnStyle}>{pending ? "מעבד…" : "עדכן DomainState (כלל ניסיוני)"}</button>
      </div>
      {result ? (
        result.ok ? (
          <div style={{ fontSize: 13, color: "#dbe6f6", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 6, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ fontWeight: 700, color: "#34d399" }}>DomainState עודכן · DOMAINSTATE UPDATED</div>
            <div style={{ color: "#fbbf24", fontSize: 13 }}>
              {result.rule} — כלל מוצר ניסיוני (level + 1), לא מעבר מצב קנוני
            </div>
            <div>BEFORE — level {result.prior_level} ({result.prior_observed_at.slice(0, 16).replace("T", " ")})</div>
            <div>ACTION — {result.action_id.slice(0, 12)}…</div>
            <div>EFFECT — {result.effect_id.slice(0, 12)}…</div>
            <div>Δ delta — {result.delta >= 0 ? "+" : ""}{result.delta}</div>
            <div>AFTER — level {result.updated_level} ({result.updated_observed_at.slice(0, 16).replace("T", " ")})</div>
            <div style={{ color: "#8fa3c9" }}>evidence — {result.evidence}</div>
            <div style={{ color: "#6c86b5" }}>state_id: {result.state_id.slice(0, 16)}…</div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#f2635c" }}>{result.message}</div>
        )
      ) : null}
    </form>
  );
}

const selectStyle: React.CSSProperties = { background: "#0b0f1a", color: "#e8edf6", border: "1px solid #2a3550", borderRadius: 6, padding: "6px 8px", fontSize: 13, flex: 1, minWidth: 220 };
const btnStyle: React.CSSProperties = { background: "#5b9cf6", color: "#0b0f1a", fontWeight: 600, fontSize: 13, border: "none", borderRadius: 6, padding: "7px 14px", cursor: "pointer" };
