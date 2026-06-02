"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  FORCE_COLOR, FORCE_LABEL, CONTEXT_LABEL,
  computeTrust, directionToImpact,
  loadNodes, saveNode,
  type DominantForce, type NodeContext, type Direction, type UserNode,
} from "./lib/philos";
import { loadProfile, type UserProfile } from "./lib/profile";
import {
  DEVELOPMENT_PATHS, ENERGY_HIERARCHY, ROOT_EXPRESSIONS, ROOT_DESCRIPTION,
  ROOT_CHARACTERISTICS, HIERARCHY_LABEL, type EnergyPath,
} from "./lib/orientation";

// ─── Static wizard data ───────────────────────────────────────────────

type ForceState = { id: string; label: string; desc: string; dir: Direction; conflict?: string };

const FORCE_STATES: Record<DominantForce, ForceState[]> = {
  physical: [
    { id: "energy",    label: "אנרגיה",          desc: "חיוניות, כוח, מוכנות",          dir: "forward"  },
    { id: "recovery",  label: "התאוששות",         desc: "חוזר לאיתני",                   dir: "forward"  },
    { id: "fatigue",   label: "עייפות",           desc: "צריך מנוחה, ריקנות גופנית",     dir: "stuck"    },
    { id: "pain",      label: "כאב",              desc: "כאב פיזי, פציעה",               dir: "backward" },
    { id: "illness",   label: "מחלה",             desc: "גוף מדוכא, חולי",               dir: "backward" },
  ],
  emotional: [
    { id: "joy",       label: "שמחה",             desc: "תחושה חיובית, זרימה",            dir: "forward"  },
    { id: "love",      label: "אהבה / חיבור",     desc: "קשר עמוק, השתייכות",            dir: "forward"  },
    { id: "anger",     label: "כעס",              desc: "תסכול, עלבון, מחאה פנימית",     dir: "stuck"    },
    { id: "sadness",   label: "עצב",              desc: "כאב רגשי, אובדן",               dir: "backward" },
    { id: "fear",      label: "פחד / חרדה",       desc: "אי-ביטחון, חשש",                dir: "backward" },
    { id: "empty",     label: "ריקנות",           desc: "ניתוק, אדישות, חוסר הרגשה",    dir: "stuck",   conflict: "blocked_feeling" },
  ],
  rational: [
    { id: "clarity",   label: "בהירות",           desc: "תובנה, מחשבה ברורה",            dir: "forward"  },
    { id: "planning",  label: "תכנון",            desc: "בונה מסלול, מסדר",              dir: "forward"  },
    { id: "decision",  label: "החלטה",            desc: "נקודת בחירה",                   dir: "forward"  },
    { id: "analysis",  label: "ניתוח",            desc: "שוקל, בוחן, משווה",             dir: "stuck"    },
    { id: "paralysis", label: "שיתוק",            desc: "יותר מדי אפשרויות, קיפאון",     dir: "stuck",   conflict: "analysis_paralysis" },
  ],
  social: [
    { id: "connect",   label: "חיבור",            desc: "קשר, שייכות, יחד",              dir: "forward"  },
    { id: "support",   label: "תמיכה",            desc: "נותן או מקבל עזרה",             dir: "forward"  },
    { id: "collab",    label: "שיתוף פעולה",      desc: "עבודה משותפת, יצירה יחד",       dir: "forward"  },
    { id: "conflict",  label: "קונפליקט",         desc: "מתח עם אחרים, חיכוך",           dir: "stuck"    },
    { id: "lonely",    label: "בדידות",           desc: "מנותק, לבד, לא נראה",           dir: "backward" },
  ],
  id: [
    { id: "impulse",   label: "דחף",              desc: "רוצה לפעול עכשיו, לא מחכה",     dir: "forward"  },
    { id: "desire",    label: "תשוקה",            desc: "רצון עז, משיכה חזקה",           dir: "forward"  },
    { id: "resist",    label: "מרד",              desc: "מתנגד לגבולות, רוצה לשבור",     dir: "stuck"    },
    { id: "chaos",     label: "כאוס פנימי",       desc: "חוסר שליטה, זרם פרוע",          dir: "backward" },
  ],
  ego: [
    { id: "ambition",  label: "שאיפה",            desc: "רוצה לגדול, לבנות, להצליח",     dir: "forward"  },
    { id: "pride",     label: "גאווה",            desc: "תחושת ניצחון, הצלחה",           dir: "forward"  },
    { id: "defend",    label: "הגנה",             desc: "מגן על עמדתי, על זהותי",        dir: "stuck"    },
    { id: "shame",     label: "בושה",             desc: "כישלון נתפס, ביקורת חיצונית",   dir: "backward", conflict: "image_gap" },
  ],
  superego: [
    { id: "duty",      label: "חובה",             desc: "פועל לפי מה שצריך לעשות",       dir: "forward"  },
    { id: "values",    label: "ערכים",            desc: "פועל לפי מה שאני מאמין בו",     dir: "forward"  },
    { id: "critic",    label: "ביקורת עצמית",     desc: "שופט את עצמי, לא מספיק טוב",   dir: "stuck"    },
    { id: "guilt",     label: "אשמה",             desc: "עברתי על ערכיי, חרטה",          dir: "backward", conflict: "regression" },
    { id: "dilemma",   label: "דילמה מוסרית",     desc: "שאלת צדק, אחריות, מה נכון",    dir: "stuck",   conflict: "desire_vs_fear" },
  ],
};

const ACTION_SUGGEST: Record<DominantForce, Record<Direction, string>> = {
  physical:  { forward: "תנצל את האנרגיה — צא לפעולה ממשית עכשיו", stuck: "תן לגוף מנוחה מודעת — קבע זמן הפסקה", backward: "פנה לטיפול ותמיכה — הגוף צריך עזרה" },
  emotional: { forward: "שתף את הרגש עם מישהו שחשוב לך", stuck: "שב עם הרגש 10 דקות — כתוב מה מעכב", backward: "בקש תמיכה — אל תהיה לבד עם זה" },
  rational:  { forward: "תרגם את הבהירות לצעד ראשון קטן", stuck: "בחר אחת ותתחיל — ניתוח ללא פעולה הוא שיתוק", backward: "פשט — מה הצעד הקטן ביותר שאפשר?" },
  social:    { forward: "תעמיק את הקשר — שתף, תן, תשאל", stuck: "פנה לשיחה ישירה — אמור מה מרגיש לא בסדר", backward: "צור קשר יזום — שלח הודעה לאחד שחשוב לך" },
  id:        { forward: "פעל — אבל הגדר גבול אחד לפני הפעולה", stuck: "שים את הדחף בצד לשעה — ראה אם הוא עדיין שם", backward: "בקש עזרה לפני שהדחף גובר ומכתיב" },
  ego:       { forward: "תתחיל — ביצועים נבנים בפעולה, לא בתכנון", stuck: "הגן פחות, הקשב יותר — מה תוכל ללמוד כאן?", backward: "הפרד בין הכישלון לזהות — הכישלון אינו אתה" },
  superego:  { forward: "פעל לפי ערכיך — תעד את הפעולה כהוכחה", stuck: "שאל: האם הביקורת משרתת אותי? בחר ערך אחד לפעול לפיו", backward: "אשמה היא מידע — מה ניתן לתקן? עשה צעד תיקון אחד" },
};

const FORCE_ICONS: Record<DominantForce, string> = {
  physical:  "⚡", emotional: "❤️", rational: "🧠",
  social:    "🤝", id: "🌊",        ego: "🏆", superego: "⚖️",
};

const DIR_LABEL: Record<Direction, string> = {
  forward: "קדימה ↑", stuck: "תקוע →", backward: "אחורה ↓",
};
const DIR_COLOR: Record<Direction, string> = {
  forward: "#34d399", stuck: "#fbbf24", backward: "#f87171",
};

// ─── Component ────────────────────────────────────────────────────────

export default function Page() {
  const router = useRouter();

  // mounted guard: skip SSR entirely — prevents hydration mismatch
  // that causes React to skip attaching event handlers
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [step,      setStep]      = useState<1|2|3|4>(1);
  const [name,      setName]      = useState("");
  const [force,     setForce]     = useState<DominantForce | null>(null);
  const [stateId,   setStateId]   = useState<string | null>(null);
  const [intensity, setIntensity] = useState(5);
  const [context,   setContext]   = useState<NodeContext>("work");
  const [direction, setDirection] = useState<Direction>("forward");
  const [loading,   setLoading]   = useState(false);
  const [profile,   setProfile]   = useState<UserProfile | null>(null);
  // Step 4 navigation: when root(id) is selected, user picks a dev path
  const [devPath,   setDevPath]   = useState<DominantForce | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p?.name) setName(p.name);
  }, []);

  const stateMeta = useMemo(() =>
    force ? FORCE_STATES[force].find(s => s.id === stateId) ?? null : null,
    [force, stateId]
  );

  function selectForce(f: DominantForce) {
    setForce(f);
    setStateId(null);
    setStep(2);
  }

  function selectState(s: ForceState) {
    setStateId(s.id);
    setDirection(s.dir);
    setStep(3);
  }

  async function getCoords(): Promise<{lat: number; lng: number}> {
    if (profile && typeof profile.lat === "number") return { lat: profile.lat, lng: profile.lng };
    return new Promise(resolve => {
      const fallback = () => resolve({ lat: 32.08 + (Math.random() - .5) * 2, lng: 34.78 + (Math.random() - .5) * 2 });
      if (!navigator?.geolocation) { fallback(); return; }
      navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }), fallback, { timeout: 3000 });
    });
  }

  async function submit() {
    if (!force || !stateMeta || !name.trim()) return;
    setLoading(true);
    const { lat, lng } = await getCoords();
    const prior = loadNodes();
    const resolvedName = name.trim() || "אנונימי";
    const trustScore = computeTrust(intensity, direction, force, stateMeta.label, prior);
    const node: UserNode = {
      id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
      name: resolvedName, lat, lng,
      event:         `${FORCE_LABEL[force]} — ${stateMeta.label}`,
      intensity, context,
      dominantForce: force,
      conflict:      stateMeta.conflict ?? null,
      action:        ACTION_SUGGEST[force][direction],
      direction,
      value:         intensity,
      impact:        directionToImpact(direction),
      trustScore,
      createdAt:     Date.now(),
    };
    saveNode(node);
    localStorage.setItem("lastResult", JSON.stringify({ dominantForce: force, conflict: stateMeta.conflict ?? null, action: ACTION_SUGGEST[force][direction] }));
    router.push("/nexus");
  }

  const fc = force ? FORCE_COLOR[force] : "#38bdf8";

  // Block SSR render — client only
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
      padding: "32px 20px",
    }}>
      <div style={{ width: "100%", maxWidth: 560 }}>

        {/* Header */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 10, letterSpacing: 6, color: "#38bdf8", marginBottom: 6 }}>PHILOS · NEXUS</div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, background: "linear-gradient(135deg,#00f5d4,#38bdf8,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Event Zero
          </h1>
          <p style={{ color: "#8bb8cc", fontSize: 12, marginTop: 6 }}>הנקודה שבין אוטומט למודעות</p>
        </div>

        {/* Step bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 28 }}>
          {([1,2,3,4] as const).map((s, i) => (
            <div key={s} style={{ display: "flex", alignItems: "center", flex: s < 4 ? "1" : "0" }}>
              <div
                onClick={() => step > s && setStep(s)}
                style={{
                  width: 28, height: 28, borderRadius: "50%",
                  border: `2px solid ${step >= s ? fc : "#0a2a4a"}`,
                  background: step > s ? fc : step === s ? fc + "33" : "transparent",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                  color: step >= s ? (step > s ? "#020d1a" : fc) : "#1e4060",
                  cursor: step > s ? "pointer" : "default",
                  transition: "all .2s",
                }}>
                {step > s ? "✓" : s}
              </div>
              {s < 4 && <div style={{ flex: 1, height: 2, background: step > s ? fc : "#0a2a4a", transition: "background .2s" }} />}
            </div>
          ))}
        </div>

        {/* ── Step 1: Name + Force ── */}
        {step === 1 && (
          <div>
            <div style={{ marginBottom: 20 }}>
              <Label>שם</Label>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder={profile?.name || "מה שמך?"}
                style={inputStyle}
                autoFocus
              />
            </div>
            <Label>מה הכוח הדומיננטי כרגע?</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 8, marginTop: 8 }}>
              {(Object.keys(FORCE_STATES) as DominantForce[]).map(f => (
                <button
                  key={f}
                  onClick={() => selectForce(f)}
                  style={{
                    padding: "14px 8px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${force === f ? FORCE_COLOR[f] : "#0a2a4a"}`,
                    background: force === f ? FORCE_COLOR[f] + "22" : "#030f1e",
                    color: force === f ? FORCE_COLOR[f] : "#8bb8cc",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                    transition: "all .15s",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{FORCE_ICONS[f]}</span>
                  <span style={{ fontSize: 10, fontWeight: 600 }}>{FORCE_LABEL[f]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Step 2: State ── */}
        {step === 2 && force && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep(1)} style={backBtn}>← חזרה</button>
              <span style={{ fontSize: 13, color: FORCE_COLOR[force], fontWeight: 600 }}>
                {FORCE_ICONS[force]} {FORCE_LABEL[force]}
              </span>
            </div>
            <Label>מה המצב בתוך הכוח הזה?</Label>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}>
              {FORCE_STATES[force].map(s => (
                <button
                  key={s.id}
                  onClick={() => selectState(s)}
                  style={{
                    padding: "12px 16px", borderRadius: 8, cursor: "pointer", textAlign: "right",
                    border: `1px solid ${stateId === s.id ? FORCE_COLOR[force] : "#0a2a4a"}`,
                    background: stateId === s.id ? FORCE_COLOR[force] + "15" : "#030f1e",
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    transition: "all .15s",
                  }}
                >
                  <div>
                    <div style={{ fontSize: 13, color: stateId === s.id ? FORCE_COLOR[force] : "#caf0f8", fontWeight: 600 }}>{s.label}</div>
                    <div style={{ fontSize: 10, color: "#1e4060", marginTop: 2 }}>{s.desc}</div>
                  </div>
                  <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 10, border: `1px solid ${DIR_COLOR[s.dir]}44`, color: DIR_COLOR[s.dir], background: DIR_COLOR[s.dir] + "11", flexShrink: 0 }}>
                    {DIR_LABEL[s.dir]}
                  </span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 16 }}>
              <Label>הקשר</Label>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                {(Object.keys(CONTEXT_LABEL) as NodeContext[]).map(c => (
                  <button
                    key={c}
                    onClick={() => setContext(c)}
                    style={{
                      padding: "6px 14px", borderRadius: 20, fontSize: 11, cursor: "pointer",
                      border: `1px solid ${context === c ? FORCE_COLOR[force] : "#0a2a4a"}`,
                      background: context === c ? FORCE_COLOR[force] + "22" : "transparent",
                      color: context === c ? FORCE_COLOR[force] : "#8bb8cc",
                      transition: "all .1s",
                    }}
                  >
                    {CONTEXT_LABEL[c]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── Step 3: Intensity + Direction ── */}
        {step === 3 && force && stateMeta && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <button onClick={() => setStep(2)} style={backBtn}>← חזרה</button>
              <span style={{ fontSize: 12, color: FORCE_COLOR[force], fontWeight: 500 }}>
                {FORCE_ICONS[force]} {FORCE_LABEL[force]} — {stateMeta.label}
              </span>
            </div>

            <Label>עוצמה — {intensity}/10</Label>
            <div style={{ position: "relative", marginTop: 8, marginBottom: 20 }}>
              <input type="range" min={1} max={10} value={intensity}
                onChange={e => setIntensity(Number(e.target.value))}
                style={{ width: "100%", accentColor: FORCE_COLOR[force] }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1e4060", marginTop: 4 }}>
                <span>נמוך</span><span>בינוני</span><span>גבוה</span><span>קיצוני</span>
              </div>
            </div>

            <Label>כיוון</Label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginTop: 8, marginBottom: 24 }}>
              {(["forward","stuck","backward"] as Direction[]).map(d => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  style={{
                    padding: "10px 8px", borderRadius: 8, cursor: "pointer",
                    border: `2px solid ${direction === d ? DIR_COLOR[d] : "#0a2a4a"}`,
                    background: direction === d ? DIR_COLOR[d] + "22" : "#030f1e",
                    color: direction === d ? DIR_COLOR[d] : "#8bb8cc",
                    fontSize: 12, fontWeight: direction === d ? 700 : 400,
                    transition: "all .15s",
                  }}
                >
                  {DIR_LABEL[d]}
                </button>
              ))}
            </div>
            <button
              onClick={() => setStep(4)}
              style={{ width: "100%", padding: "13px", fontSize: 13, fontWeight: 600, letterSpacing: 2, color: "#020d1a", background: `linear-gradient(135deg,${FORCE_COLOR[force]},${FORCE_COLOR[force]}cc)`, border: "none", borderRadius: 8, cursor: "pointer" }}
            >
              ראה את המפה →
            </button>
          </div>
        )}

        {/* ── Step 4: Diagnosis · Navigation · Projection ── */}
        {step === 4 && force && stateMeta && (() => {
          const path     = DEVELOPMENT_PATHS[force];
          const isRoot   = force === "id";
          const fc2      = FORCE_COLOR[force];
          const activeDev = devPath ? DEVELOPMENT_PATHS[devPath] : null;

          return (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                <button onClick={() => { setStep(3); setDevPath(null); }} style={backBtn}>← חזרה</button>
                <span style={{ fontSize: 12, color: fc2, fontWeight: 500 }}>
                  {FORCE_ICONS[force]} {FORCE_LABEL[force]} — {stateMeta.label}
                </span>
              </div>

              {/* ─── DIAGNOSIS ─── */}
              <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${fc2}44`, background: fc2 + "0a", marginBottom: 10 }}>
                <div style={{ fontSize: 9, color: fc2, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 }}>
                  {isRoot ? "מצב שורש · איד" : `שכבה ${HIERARCHY_LABEL[force]}`}
                </div>
                <div style={{ fontSize: 12, color: "#8bb8cc", marginBottom: 8, lineHeight: 1.5 }}>
                  {isRoot ? ROOT_DESCRIPTION : path.layerDescription}
                </div>
                <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                  {(isRoot ? ROOT_CHARACTERISTICS : path.expressions.slice(0, 4)).map(e => (
                    <span key={e} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, border: `1px solid ${fc2}44`, color: fc2, background: fc2 + "11" }}>
                      {e}
                    </span>
                  ))}
                </div>
              </div>

              {/* ─── NAVIGATION ─── */}
              {isRoot ? (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>
                    נתיבי פיתוח אפשריים
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    {ENERGY_HIERARCHY.map(f => {
                      const p = DEVELOPMENT_PATHS[f];
                      const active = devPath === f;
                      return (
                        <button
                          key={f}
                          onClick={() => setDevPath(active ? null : f)}
                          style={{
                            padding: "9px 12px", borderRadius: 6, cursor: "pointer", textAlign: "right",
                            border: `1px solid ${active ? FORCE_COLOR[f] : "#0a2a4a"}`,
                            background: active ? FORCE_COLOR[f] + "15" : "#030f1e",
                            display: "flex", alignItems: "center", justifyContent: "space-between",
                            transition: "all .15s",
                          }}
                        >
                          <div>
                            <span style={{ fontSize: 12, color: active ? FORCE_COLOR[f] : "#caf0f8", fontWeight: active ? 700 : 400 }}>
                              {FORCE_ICONS[f]} {FORCE_LABEL[f]}
                            </span>
                            {!active && (
                              <div style={{ fontSize: 9, color: "#1e4060", marginTop: 2 }}>
                                {p.expressions.slice(0, 3).join(" · ")}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 10, color: active ? FORCE_COLOR[f] : "#1e4060" }}>
                            {active ? "▲" : "▼"}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div style={{ marginBottom: 10 }}>
                  {/* Hierarchy position */}
                  <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>מיקום בהיררכיה</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", marginBottom: 10, fontSize: 10 }}>
                    <PathNode label="שורש (איד)" color="#ef4444" />
                    {ENERGY_HIERARCHY.slice(0, ENERGY_HIERARCHY.indexOf(force) + 1).map((f, i) => (
                      <span key={f} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Arr />
                        <PathNode label={`${FORCE_ICONS[f]} ${FORCE_LABEL[f]}`} color={f === force ? FORCE_COLOR[f] : "#1e4060"} />
                      </span>
                    ))}
                  </div>

                  {/* Risk + Opportunity */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                    <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ef444433", background: "#ef44440a" }}>
                      <div style={{ fontSize: 8, color: "#ef4444", letterSpacing: 1, marginBottom: 4 }}>⚠ סיכון</div>
                      <div style={{ fontSize: 10, color: "#8bb8cc" }}>{path.risk}</div>
                    </div>
                    <div style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #34d39933", background: "#34d3990a" }}>
                      <div style={{ fontSize: 8, color: "#34d399", letterSpacing: 1, marginBottom: 4 }}>✦ הזדמנות</div>
                      <div style={{ fontSize: 10, color: "#8bb8cc" }}>{path.opportunity}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ─── PROJECTION (expanded dev path or current force) ─── */}
              {(activeDev || (!isRoot)) && (() => {
                const p = activeDev ?? path;
                const pColor = activeDev ? FORCE_COLOR[p.force] : fc2;
                return (
                  <div style={{ padding: "10px 12px", borderRadius: 6, border: `1px solid ${pColor}44`, background: pColor + "08", marginBottom: 10 }}>
                    {activeDev && (
                      <div style={{ fontSize: 11, color: pColor, fontWeight: 700, marginBottom: 6 }}>
                        {FORCE_ICONS[p.force]} {FORCE_LABEL[p.force]}
                        <span style={{ fontSize: 9, color: "#1e4060", fontWeight: 400, marginRight: 8 }}> — {p.layerDescription}</span>
                      </div>
                    )}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginBottom: 8 }}>
                      <div style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #ef444433", background: "#ef44440a" }}>
                        <div style={{ fontSize: 8, color: "#ef4444", letterSpacing: 1, marginBottom: 3 }}>⚠ סיכון</div>
                        <div style={{ fontSize: 10, color: "#8bb8cc" }}>{p.risk}</div>
                      </div>
                      <div style={{ padding: "6px 8px", borderRadius: 4, border: "1px solid #34d39933", background: "#34d3990a" }}>
                        <div style={{ fontSize: 8, color: "#34d399", letterSpacing: 1, marginBottom: 3 }}>✦ הזדמנות</div>
                        <div style={{ fontSize: 10, color: "#8bb8cc" }}>{p.opportunity}</div>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, fontSize: 10, color: "#8bb8cc" }}>
                      {p.nextForce && (
                        <span>
                          הבא: <PathNode label={`${FORCE_ICONS[p.nextForce]} ${FORCE_LABEL[p.nextForce]}`} color={FORCE_COLOR[p.nextForce]} />
                        </span>
                      )}
                      <span>
                        מאזן: <PathNode label={`${p.balancingForce === "id" ? "⚡" : FORCE_ICONS[p.balancingForce as DominantForce]} ${p.balancingForce === "id" ? "איד" : FORCE_LABEL[p.balancingForce as DominantForce]}`} color={p.balancingForce === "id" ? "#ef4444" : FORCE_COLOR[p.balancingForce as DominantForce]} />
                      </span>
                    </div>
                    <div style={{ fontSize: 9, color: "#1e4060", marginBottom: 6 }}>{p.balanceReason}</div>
                    <div style={{ padding: "8px 10px", background: "#020d1a", borderRadius: 4, border: "1px solid #0a2a4a" }}>
                      <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, marginBottom: 3 }}>פעולה מוצעת</div>
                      <div style={{ fontSize: 11, color: "#00f5d4" }}>{p.growthAction}</div>
                    </div>
                  </div>
                );
              })()}

              {/* Submit */}
              <button
                onClick={submit}
                disabled={loading}
                style={{
                  width: "100%", padding: "13px", fontSize: 13, fontWeight: 700, letterSpacing: 2,
                  color: "#020d1a",
                  background: loading ? "#1e4060" : "linear-gradient(135deg,#00f5d4,#38bdf8)",
                  border: "none", borderRadius: 8, cursor: loading ? "default" : "pointer",
                  boxShadow: "0 0 30px rgba(56,189,248,0.2)",
                  marginTop: 4,
                }}
              >
                {loading ? "שומר…" : "שמור ועבור לנקסוס"}
              </button>

              <div style={{ textAlign: "center", marginTop: 8 }}>
                <a href="/nexus" style={{ fontSize: 11, color: "#1e4060", textDecoration: "none" }}>→ לגלובוס בלי ניתוח חדש</a>
              </div>
            </div>
          );
        })()}

        {/* Profile link */}
        <div style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "#1e4060" }}>
          {profile
            ? <span>מחובר: {profile.name} · <a href="/profile" style={{ color: "#38bdf8" }}>ערוך</a></span>
            : <a href="/profile" style={{ color: "#fbbf24" }}>→ צור פרופיל</a>
          }
        </div>
      </div>
    </main>
  );
}

// ─── Small components ─────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 4 }}>
      {children}
    </div>
  );
}

function PathNode({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${color}55`, background: color + "11", color, fontSize: 10, fontWeight: 600, whiteSpace: "nowrap" }}>
      {label}
    </span>
  );
}

function Arr() {
  return <span style={{ color: "#1e4060", fontSize: 11 }}>→</span>;
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
