"use client";

/**
 * Noa — The Transformation Moment (visual only).
 *
 * A guided, animated step-through of the validated Noa chain: one person alone
 * and collapsing → the value network forms → the load redistributes → energy and
 * orientation recover → "this is why you're here." All numbers come from the
 * locked, deterministic chain (lib/noa, computeNoaChain) — nothing is invented.
 * Reads only; no data, engine, or core changes.
 */

import { useMemo, useState } from "react";
import { computeNoaChain } from "../lib/noa";

const C = {
  bg: "#030f1e", card: "#040e1c", border: "#0a2a4a", borderSoft: "#1e4060",
  cyan: "#38bdf8", green: "#34d399", red: "#ef4444", orange: "#fb923c",
  yellow: "#fbbf24", purple: "#a78bfa", muted: "#1e4060", text: "#cfe6f5",
};

const STEP_TITLES = [
  "לבד מול הקריסה",
  "האנרגיה דולפת",
  "רשת הערך נוצרת",
  "העומס מתפזר",
  "התייצבות ראשונה",
  "למה אתה כאן",
];

export default function NoaTransformation() {
  const chain = useMemo(() => computeNoaChain(0), []);
  const [step, setStep] = useState(0);
  const last = STEP_TITLES.length - 1;

  const collapse = chain.collapse?.totalNegativeDominance ?? 77;
  const leakage = chain.leakage?.totalLeakage ?? 78;
  const load = chain.load;
  const beforePct = load?.beforePct ?? 100;
  const afterPct = load?.afterPct ?? 35;
  const communityPct = load?.communityPct ?? 65;
  const beforeEnergy = load?.beforeEnergy ?? 25;
  const afterEnergy = load?.afterEnergy ?? 55;
  const orientation = chain.orientation?.score ?? 45;
  const helpers = load?.helpers ?? [];
  const action = chain.action;

  // Metric state evolves with the step → CSS transitions animate the change.
  const networkOn = step >= 2;
  const loadShared = step >= 3;
  const recovered = step >= 4;

  const loadNow = loadShared ? afterPct : beforePct;
  const communityNow = loadShared ? communityPct : 0;
  const energyNow = recovered ? afterEnergy : beforeEnergy;
  const orientationNow = recovered ? orientation : 0;
  const riskNow = recovered ? "בינוני" : "קריטי";
  const riskColor = recovered ? C.yellow : C.red;

  const NARRATION = [
    `נועה נושאת ${beforePct}% מהעומס לבדה. הקריסה ב‑${collapse}%, סיכון קריסה קריטי, אנרגיה ${beforeEnergy} בלבד. זו לא חולשה — זו ריכוז נטל.`,
    `כשאדם נושא הכול לבד, האנרגיה דולפת החוצה (${leakage}/100). זו ההתנגדות — לא חוסר ערכים, אלא נטל מרוכז במקום אחד.`,
    `רשת הערך מתעוררת סביבה — ${helpers.length} אנשים שחולקים את אותם ערכים, כל אחד מביא דבר אחר.`,
    `הנטל מתפזר: נועה ${beforePct}% → ${afterPct}%, והקהילה סופגת ${communityPct}%. הנטל הפרטי הופך לאחריות משותפת.`,
    `האנרגיה משוחזרת ${beforeEnergy} → ${afterEnergy}, סיכון הקריסה יורד קריטי → בינוני, והאוריינטציה עולה ל‑${orientation}/100 — התייצבות ראשונה.`,
    `זה הרעיון כולו: נטל פרטי → אחריות משותפת. פעולה מומלצת: ${action?.recommendedAction ?? "stabilize"} · impact קולקטיבי ${action?.collectiveImpact ?? 27}.`,
  ];

  // Helper bubbles around Noa (fixed angles, no randomness).
  const positioned = helpers.slice(0, 5).map((h, i) => {
    const ang = (-90 + i * (360 / Math.max(1, Math.min(5, helpers.length)))) * (Math.PI / 180);
    return { ...h, x: 50 + Math.cos(ang) * 38, y: 50 + Math.sin(ang) * 38 };
  });

  const bar = (label: string, value: number, color: string, suffix = "%") => (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: C.borderSoft, marginBottom: 3 }}>
        <span>{label}</span><span style={{ color, fontWeight: 700 }}>{value}{suffix}</span>
      </div>
      <div style={{ height: 6, background: "#0a1a2e", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(0, Math.min(100, value))}%`, height: "100%", background: color, borderRadius: 4, transition: "width .8s ease, background .8s ease" }} />
      </div>
    </div>
  );

  return (
    <div dir="rtl" style={{ padding: 14, color: C.text, display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Title + step dots */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 2 }}>המסע של נועה · {step + 1}/{STEP_TITLES.length}</div>
        <div style={{ display: "flex", gap: 4 }}>
          {STEP_TITLES.map((_, i) => (
            <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i <= step ? C.cyan : C.muted, transition: "background .4s" }} />
          ))}
        </div>
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: recovered ? C.green : (networkOn ? C.cyan : C.orange), transition: "color .6s", marginBottom: 10 }}>
        {STEP_TITLES[step]}
      </div>

      {/* Stage: Noa + value network */}
      <div style={{ position: "relative", aspectRatio: "1.4", background: "radial-gradient(circle at 50% 50%, #07182b 0%, #030f1e 70%)", border: `1px solid ${C.border}`, borderRadius: 10, marginBottom: 12 }}>
        {/* connection lines */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: networkOn ? 0.5 : 0, transition: "opacity .8s" }}>
          {positioned.map((p, i) => (
            <line key={i} x1="50%" y1="50%" x2={`${p.x}%`} y2={`${p.y}%`} stroke={loadShared ? C.green : C.borderSoft} strokeWidth="1" />
          ))}
        </svg>
        {/* helpers */}
        {positioned.map((p, i) => (
          <div key={i} title={`${p.name} · ${p.loadType}`} style={{
            position: "absolute", left: `${p.x}%`, top: `${p.y}%`, transform: `translate(-50%,-50%) scale(${networkOn ? 1 : 0.3})`,
            opacity: networkOn ? 1 : 0, transition: `opacity .5s ${i * 0.12}s, transform .5s ${i * 0.12}s`,
            width: 34, height: 34, borderRadius: "50%", background: "#06223a", border: `1px solid ${loadShared ? C.green : C.cyan}`,
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8, color: C.text, textAlign: "center", lineHeight: 1.1,
          }}>{p.name.split(" ")[0]}</div>
        ))}
        {/* Noa center */}
        <div style={{
          position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)",
          width: 58, height: 58, borderRadius: "50%",
          background: recovered ? "#0c3a2c" : (loadShared ? "#0c2c3a" : "#3a0c12"),
          border: `2px solid ${recovered ? C.green : (loadShared ? C.cyan : C.red)}`,
          boxShadow: `0 0 ${recovered ? 24 : (loadShared ? 16 : 8)}px ${recovered ? C.green : (loadShared ? C.cyan : C.red)}66`,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 800, color: C.text,
          transition: "all .8s ease",
        }}>נועה</div>
      </div>

      {/* Metrics */}
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        {bar("עומס אישי", loadNow, loadShared ? C.green : C.red)}
        {bar("קהילה", communityNow, C.cyan)}
      </div>
      <div style={{ display: "flex", gap: 12, marginBottom: 6 }}>
        {bar("אנרגיה", energyNow, recovered ? C.green : C.orange, "")}
        {bar("אוריינטציה", orientationNow, recovered ? C.green : C.muted, "/100")}
      </div>
      <div style={{ fontSize: 9, color: C.borderSoft, marginBottom: 10 }}>
        סיכון קריסה: <b style={{ color: riskColor, transition: "color .6s" }}>{riskNow}</b>
      </div>

      {/* Narration */}
      <div style={{ flex: 1, fontSize: 12, lineHeight: 1.6, color: C.text, background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: "10px 12px" }}>
        {NARRATION[step]}
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <button onClick={() => setStep(s => Math.max(0, s - 1))} disabled={step === 0}
          style={navBtn(step === 0)}>◀ הקודם</button>
        {step < last ? (
          <button onClick={() => setStep(s => Math.min(last, s + 1))} style={navBtn(false, true)}>הבא ▶</button>
        ) : (
          <button onClick={() => setStep(0)} style={navBtn(false, true)}>↻ מהתחלה</button>
        )}
      </div>
    </div>
  );
}

function navBtn(disabled: boolean, primary = false): React.CSSProperties {
  return {
    flex: 1, padding: "8px 0", borderRadius: 6, fontSize: 12, fontWeight: 600,
    cursor: disabled ? "default" : "pointer", opacity: disabled ? 0.4 : 1,
    border: `1px solid ${primary ? C.green : C.borderSoft}`,
    background: primary ? "#0c3a2c" : "transparent",
    color: primary ? C.green : C.text,
  };
}
