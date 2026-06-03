"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  FORCE_COLOR, CONTEXT_LABEL,
  computeTrust, directionToImpact,
  loadNodes, saveNode,
  type NodeContext, type Direction, type UserNode,
} from "./lib/philos";
import { loadProfile, type UserProfile } from "./lib/profile";
import {
  MATRIX, CLASS_ORDER, LEVEL_ORDER,
  CLASS_LABEL, CLASS_ICON, CLASS_COLOR,
  LEVEL_LABEL, LEVEL_ICON, LEVEL_COLOR,
  classToDominantForce,
  type ClassKey, type LevelKey,
} from "./lib/orientation";

// ─── Wizard component ─────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  const [mounted,    setMounted]    = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [step,       setStep]       = useState<1|2|3|4>(1);
  const [name,       setName]       = useState("");
  const [selClass,   setSelClass]   = useState<ClassKey | null>(null);
  const [selLevel,   setSelLevel]   = useState<LevelKey | null>(null);
  const [selExpr,    setSelExpr]    = useState<string | null>(null);
  const [intensity,  setIntensity]  = useState(5);
  const [direction,  setDirection]  = useState<Direction>("forward");
  const [context,    setContext]    = useState<NodeContext>("work");
  const [loading,    setLoading]    = useState(false);
  const [profile,    setProfile]    = useState<UserProfile | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p?.name) setName(p.name);
  }, []);

  // Derived
  const cell = selClass && selLevel ? MATRIX[selClass][selLevel] : null;
  const cc   = selClass ? CLASS_COLOR[selClass] : "#38bdf8";

  async function getCoords(): Promise<{lat: number; lng: number}> {
    if (profile && typeof profile.lat === "number") return { lat: profile.lat, lng: profile.lng };
    return new Promise(resolve => {
      const fallback = () => resolve({ lat: 32.08 + (Math.random() - .5) * 2, lng: 34.78 + (Math.random() - .5) * 2 });
      if (!navigator?.geolocation) { fallback(); return; }
      navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), fallback, { timeout: 3000 });
    });
  }

  async function submit() {
    if (!selClass || !selLevel || !selExpr) return;
    setLoading(true);
    const { lat, lng } = await getCoords();
    const prior = loadNodes();
    const dominantForce = classToDominantForce(selClass);
    const trustScore = computeTrust(intensity, direction, dominantForce, selExpr, prior);
    const resolvedName = name.trim() || "אנונימי";
    const node: UserNode = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
      name: resolvedName, lat, lng,
      event:         `${CLASS_LABEL[selClass]} · ${LEVEL_LABEL[selLevel]} · ${selExpr}`,
      intensity,     context,
      dominantForce,
      conflict:      null,
      action:        cell?.suggestedAction ?? "",
      direction,
      value:         intensity,
      impact:        directionToImpact(direction),
      trustScore,
      createdAt:     Date.now(),
    };
    saveNode(node);
    localStorage.setItem("lastResult", JSON.stringify({ dominantForce, conflict: null, action: cell?.suggestedAction ?? "" }));
    router.push("/nexus");
  }

  if (!mounted) return (
    <main style={{ minHeight: "100vh", background: "#020d1a", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ color: "#1e4060", fontSize: 11, letterSpacing: 3 }}>PHILOS · NEXUS</div>
    </main>
  );

  return (
    <main style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 30%,#0a2a4a 0%,#020d1a 60%,#000 100%)",
      color: "#e0f2fe",
      fontFamily: "'Inter',system-ui,sans-serif",
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "28px 16px",
    }}>
      <div style={{ width: "100%", maxWidth: 540 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 22 }}>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#38bdf8", marginBottom: 5 }}>PHILOS · NEXUS</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#00f5d4,#38bdf8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Event Zero
          </h1>
        </div>

        {/* Step bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 24 }}>
          {([1,2,3,4] as const).map(s => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: s < 4 ? "1" : "0" }}>
              <div
                onClick={() => step > s && setStep(s)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: `2px solid ${step >= s ? cc : "#0a2a4a"}`,
                  background: step > s ? cc : step === s ? cc + "33" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: step >= s ? (step > s ? "#020d1a" : cc) : "#1e4060",
                  cursor: step > s ? "pointer" : "default",
                  transition: "all .2s",
                }}>
                {step > s ? "✓" : s}
              </div>
              {s < 4 && <div style={{ flex: 1, height: 2, background: step > s ? cc : "#0a2a4a", transition: "background .2s" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Select Class ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <WLabel>שם</WLabel>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="מה שמך?" style={inputStyle} autoFocus />
            </div>
            <WLabel>מאיזה מקום אתה פועל?</WLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8 }}>
              {CLASS_ORDER.map(c => (
                <button
                  key={c}
                  onClick={() => { setSelClass(c); setSelLevel(null); setSelExpr(null); setStep(2); }}
                  style={{
                    padding: "14px 8px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${selClass === c ? CLASS_COLOR[c] : "#0a2a4a"}`,
                    background: selClass === c ? CLASS_COLOR[c] + "22" : "#030f1e",
                    color: selClass === c ? CLASS_COLOR[c] : "#8bb8cc",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{CLASS_ICON[c]}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{CLASS_LABEL[c]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: Select Level ── */}
        {step === 2 && selClass && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep(1)} style={backBtn}>← חזרה</button>
              <span style={{ fontSize: 12, color: CLASS_COLOR[selClass], fontWeight: 600 }}>
                {CLASS_ICON[selClass]} {CLASS_LABEL[selClass]}
              </span>
            </div>
            <WLabel>באיזה רמה זה מתבטא?</WLabel>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 8 }}>
              {LEVEL_ORDER.map(l => {
                const cellPreview = MATRIX[selClass][l];
                return (
                  <button
                    key={l}
                    onClick={() => { setSelLevel(l); setSelExpr(null); setStep(3); }}
                    style={{
                      padding: "13px 16px", borderRadius: 8, cursor: "pointer", textAlign: "right",
                      border: `1px solid ${selLevel === l ? LEVEL_COLOR[l] : "#0a2a4a"}`,
                      background: selLevel === l ? LEVEL_COLOR[l] + "15" : "#030f1e",
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      transition: "all .15s",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 13, color: selLevel === l ? LEVEL_COLOR[l] : "#caf0f8", fontWeight: 600 }}>
                        {LEVEL_ICON[l]} {LEVEL_LABEL[l]}
                      </div>
                      <div style={{ fontSize: 9, color: "#1e4060", marginTop: 2 }}>
                        {cellPreview.expressions.slice(0, 3).join(" · ")}
                      </div>
                    </div>
                    <span style={{ fontSize: 9, color: LEVEL_COLOR[l], padding: "2px 7px", borderRadius: 10, border: `1px solid ${LEVEL_COLOR[l]}44` }}>
                      {LEVEL_ICON[l]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Step 3: Select Expression + Intensity ── */}
        {step === 3 && selClass && selLevel && cell && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep(2)} style={backBtn}>← חזרה</button>
              <span style={{ fontSize: 11, color: "#8bb8cc" }}>
                <span style={{ color: CLASS_COLOR[selClass] }}>{CLASS_ICON[selClass]} {CLASS_LABEL[selClass]}</span>
                {" · "}
                <span style={{ color: LEVEL_COLOR[selLevel] }}>{LEVEL_ICON[selLevel]} {LEVEL_LABEL[selLevel]}</span>
              </span>
            </div>
            <WLabel>מה ההביטוי הספציפי?</WLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8, marginBottom: 16 }}>
              {cell.expressions.map(e => (
                <button
                  key={e}
                  onClick={() => setSelExpr(selExpr === e ? null : e)}
                  style={{
                    padding: "7px 14px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                    border: `1px solid ${selExpr === e ? cc : "#0a2a4a"}`,
                    background: selExpr === e ? cc + "22" : "#030f1e",
                    color: selExpr === e ? cc : "#8bb8cc",
                    fontWeight: selExpr === e ? 700 : 400,
                    transition: "all .15s",
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
            <WLabel>עוצמה — {intensity}/10</WLabel>
            <input type="range" min={1} max={10} value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              style={{ width: "100%", accentColor: cc, margin: "6px 0 16px" }}
            />
            <WLabel>כיוון</WLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 6, marginBottom: 18 }}>
              {(["forward","stuck","backward"] as Direction[]).map(d => (
                <button key={d} onClick={() => setDirection(d)}
                  style={{
                    padding: "9px 8px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${direction === d ? DIR_COLOR[d] : "#0a2a4a"}`,
                    background: direction === d ? DIR_COLOR[d] + "22" : "#030f1e",
                    color: direction === d ? DIR_COLOR[d] : "#8bb8cc",
                    fontSize: 11, fontWeight: direction === d ? 700 : 400,
                    transition: "all .15s",
                  }}>
                  {DIR_LABEL[d]}
                </button>
              ))}
            </div>
            <WLabel>הקשר</WLabel>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "6px 0 18px" }}>
              {(Object.keys(CONTEXT_LABEL) as NodeContext[]).map(c => (
                <button key={c} onClick={() => setContext(c)}
                  style={{
                    padding: "5px 12px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                    border: `1px solid ${context === c ? cc : "#0a2a4a"}`,
                    background: context === c ? cc + "22" : "transparent",
                    color: context === c ? cc : "#8bb8cc",
                    transition: "all .1s",
                  }}>
                  {CONTEXT_LABEL[c]}
                </button>
              ))}
            </div>
            <button
              onClick={() => selExpr && setStep(4)}
              style={{
                width: "100%", padding: "13px", fontSize: 13, fontWeight: 600, letterSpacing: 2,
                color: "#020d1a",
                background: selExpr ? `linear-gradient(135deg,${cc},${cc}cc)` : "#0a2a4a",
                border: "none", borderRadius: 8,
                cursor: selExpr ? "pointer" : "default",
                opacity: selExpr ? 1 : 0.5,
              }}
            >
              ראה את המפה →
            </button>
          </div>
        )}

        {/* ── Step 4: Diagnosis + Matrix + Submit ── */}
        {step === 4 && selClass && selLevel && selExpr && cell && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <button onClick={() => setStep(3)} style={backBtn}>← חזרה</button>
              <span style={{ fontSize: 11, color: "#8bb8cc" }}>
                <span style={{ color: cc, fontWeight: 600 }}>{CLASS_ICON[selClass]} {CLASS_LABEL[selClass]}</span>
                {" · "}
                <span style={{ color: LEVEL_COLOR[selLevel] }}>{LEVEL_ICON[selLevel]} {LEVEL_LABEL[selLevel]}</span>
                {" · "}
                <span style={{ color: cc }}>{selExpr}</span>
              </span>
            </div>

            {/* Current Position */}
            <div style={{ padding: "11px 14px", borderRadius: 8, border: `1px solid ${cc}44`, background: cc + "0a", marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: cc, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6 }}>מיקום נוכחי</div>
              <div style={{ fontSize: 12, color: "#8bb8cc", lineHeight: 1.5, marginBottom: 8 }}>{cell.description}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                <div style={{ padding: "7px 9px", borderRadius: 5, border: "1px solid #ef444433", background: "#ef44440a" }}>
                  <div style={{ fontSize: 8, color: "#ef4444", letterSpacing: 1, marginBottom: 3 }}>⚠ סיכון</div>
                  <div style={{ fontSize: 10, color: "#8bb8cc" }}>{cell.risk}</div>
                </div>
                <div style={{ padding: "7px 9px", borderRadius: 5, border: "1px solid #34d39933", background: "#34d3990a" }}>
                  <div style={{ fontSize: 8, color: "#34d399", letterSpacing: 1, marginBottom: 3 }}>✦ הזדמנות</div>
                  <div style={{ fontSize: 10, color: "#8bb8cc" }}>{cell.opportunity}</div>
                </div>
              </div>
              <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8, fontSize: 10, color: "#8bb8cc" }}>
                <span>מאזן:</span>
                <span style={{ padding: "2px 8px", borderRadius: 10, border: `1px solid ${CLASS_COLOR[cell.balancingClass]}55`, color: CLASS_COLOR[cell.balancingClass], fontSize: 10 }}>
                  {CLASS_ICON[cell.balancingClass]} {CLASS_LABEL[cell.balancingClass]}
                </span>
              </div>
            </div>

            {/* Action */}
            <div style={{ padding: "9px 12px", borderRadius: 6, border: "1px solid #0a2a4a", background: "#020d1a", marginBottom: 12 }}>
              <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, marginBottom: 4 }}>פעולה מוצעת</div>
              <div style={{ fontSize: 12, color: "#00f5d4" }}>{cell.suggestedAction}</div>
            </div>

            {/* 6×3 Matrix — navigation map */}
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                מפת הניווט · {CLASS_LABEL[selClass]} / {LEVEL_LABEL[selLevel]}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: `80px repeat(3,1fr)`, gap: 3 }}>
                {/* Header row */}
                <div />
                {LEVEL_ORDER.map(l => (
                  <div key={l} style={{ textAlign: "center", fontSize: 9, color: LEVEL_COLOR[l], padding: "3px 0", fontWeight: 600 }}>
                    {LEVEL_ICON[l]} {LEVEL_LABEL[l]}
                  </div>
                ))}
                {/* Data rows — every cell is clickable, shows first expression */}
                {CLASS_ORDER.map(c => (
                  <>
                    <div key={c + "_label"} style={{
                      fontSize: 9, color: CLASS_COLOR[c], fontWeight: 600,
                      display: "flex", alignItems: "center", gap: 3, paddingRight: 2,
                    }}>
                      {CLASS_ICON[c]} {CLASS_LABEL[c]}
                    </div>
                    {LEVEL_ORDER.map(l => {
                      const isActive  = c === selClass && l === selLevel;
                      const sameClass = c === selClass;
                      const sameLevel = l === selLevel;
                      const cellData  = MATRIX[c][l];
                      const hint      = cellData.expressions[0];
                      return (
                        <div
                          key={c + l}
                          onClick={() => {
                            setSelClass(c);
                            setSelLevel(l);
                            // pick first expression of new cell
                            setSelExpr(MATRIX[c][l].expressions[0]);
                          }}
                          title={hint}
                          style={{
                            height: 34, borderRadius: 4, cursor: "pointer",
                            border: isActive
                              ? `2px solid ${CLASS_COLOR[c]}`
                              : (sameClass || sameLevel)
                                ? `1px solid ${CLASS_COLOR[c]}44`
                                : "1px solid #0a2a4a",
                            background: isActive
                              ? CLASS_COLOR[c] + "33"
                              : (sameClass || sameLevel)
                                ? CLASS_COLOR[c] + "0d"
                                : "#030f1e",
                            display: "flex", flexDirection: "column",
                            alignItems: "center", justifyContent: "center",
                            transition: "all .15s",
                            overflow: "hidden", padding: "1px 3px",
                          }}>
                          {isActive
                            ? <span style={{ fontSize: 9, color: CLASS_COLOR[c], fontWeight: 700 }}>●</span>
                            : <span style={{ fontSize: 7, color: sameClass || sameLevel ? CLASS_COLOR[c] + "aa" : "#1e4060", textAlign: "center", lineHeight: 1.2 }}>
                                {hint}
                              </span>
                          }
                        </div>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>

            {/* Submit */}
            <button
              onClick={submit}
              disabled={loading}
              style={{
                width: "100%", padding: "13px", fontSize: 13, fontWeight: 700, letterSpacing: 2,
                color: "#020d1a",
                background: loading ? "#1e4060" : "linear-gradient(135deg,#00f5d4,#38bdf8)",
                border: "none", borderRadius: 8,
                cursor: loading ? "default" : "pointer",
                boxShadow: "0 0 30px rgba(56,189,248,0.2)",
              }}
            >
              {loading ? "שומר…" : "שמור ועבור לנקסוס"}
            </button>
            <div style={{ textAlign: "center", marginTop: 8 }}>
              <a href="/nexus" style={{ fontSize: 11, color: "#1e4060", textDecoration: "none" }}>→ לגלובוס בלי ניתוח חדש</a>
            </div>
          </div>
        )}

        {/* Profile */}
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 10, color: "#1e4060" }}>
          {profile
            ? <span>{profile.name} · <a href="/profile" style={{ color: "#38bdf8" }}>ערוך</a></span>
            : <a href="/profile" style={{ color: "#fbbf24" }}>→ צור פרופיל</a>
          }
        </div>
      </div>
    </main>
  );
}

// ─── Small components + constants ─────────────────────────────────────

const DIR_LABEL: Record<Direction, string> = {
  forward: "קדימה ↑", stuck: "תקוע →", backward: "אחורה ↓",
};
const DIR_COLOR: Record<Direction, string> = {
  forward: "#34d399", stuck: "#fbbf24", backward: "#f87171",
};

function WLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 4 }}>
      {children}
    </div>
  );
}

const backBtn: React.CSSProperties = {
  padding: "4px 10px", fontSize: 11, background: "transparent",
  border: "1px solid #0a2a4a", borderRadius: 4, color: "#8bb8cc", cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "11px 14px", fontSize: 14,
  background: "#030f1e", color: "#e0f2fe",
  border: "1px solid #0a2a4a", borderRadius: 6,
  outline: "none", direction: "rtl",
};
