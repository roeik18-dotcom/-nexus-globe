"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  loadProfile,
  saveProfile,
  newProfile,
  type UserProfile,
  type Gender,
  type BaseValues,
  type ConflictBars,
} from "../lib/profile";
import { FORCE_COLOR, FORCE_LABEL, type DominantForce } from "../lib/philos";

export default function Page() {
  const router = useRouter();
  const [p, setP] = useState<UserProfile>(newProfile());
  const [conflictInput, setConflictInput] = useState("");
  const [savedOnce, setSavedOnce] = useState(false);

  useEffect(() => {
    const existing = loadProfile();
    if (existing) {
      // backfill new fields for older profiles
      setP({
        ...newProfile(),
        ...existing,
        conflictBars: existing.conflictBars ?? {
          emotion_logic: 0.5, ego_social: 0.5,
          action_avoidance: 0.5, personal_collective: 0.5,
        },
      });
      setSavedOnce(true);
    }
  }, []);

  function update<K extends keyof UserProfile>(k: K, v: UserProfile[K]) {
    setP(prev => ({ ...prev, [k]: v, updatedAt: Date.now() }));
  }

  function updateBase(k: keyof BaseValues, v: number) {
    setP(prev => ({ ...prev, baseValues: { ...prev.baseValues, [k]: v }, updatedAt: Date.now() }));
  }

  function updateBar(k: keyof ConflictBars, v: number) {
    setP(prev => ({
      ...prev,
      conflictBars: { ...(prev.conflictBars ?? { emotion_logic: 0.5, ego_social: 0.5, action_avoidance: 0.5, personal_collective: 0.5 }), [k]: v },
      updatedAt: Date.now(),
    }));
  }

  async function autoLocate() {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(pos => {
      update("lat", pos.coords.latitude);
      update("lng", pos.coords.longitude);
    });
  }

  function addConflict() {
    const t = conflictInput.trim();
    if (!t) return;
    setP(prev => ({ ...prev, coreConflicts: Array.from(new Set([...prev.coreConflicts, t])) }));
    setConflictInput("");
  }

  function removeConflict(tag: string) {
    setP(prev => ({ ...prev, coreConflicts: prev.coreConflicts.filter(c => c !== tag) }));
  }

  function submit() {
    if (!p.name.trim()) return alert("שם חובה");
    saveProfile(p);
    router.push("/");
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 20%, #0a2a4a 0%, #020d1a 60%, #000 100%)",
        color: "#e0f2fe",
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: "40px 20px",
      }}
    >
      <div style={{ maxWidth: 620, margin: "0 auto" }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#38bdf8", marginBottom: 10, textAlign: "center" }}>
          PHILOS · PROFILE
        </div>
        <h1
          style={{
            fontSize: 36,
            fontWeight: 700,
            margin: 0,
            textAlign: "center",
            background: "linear-gradient(135deg,#00f5d4,#38bdf8,#a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          מי אתה בבסיס.
        </h1>
        <p style={{ color: "#8bb8cc", marginTop: 8, marginBottom: 28, fontSize: 13, textAlign: "center" }}>
          הפרופיל מעגן אותך בגלובוס. כל ניתוח חדש נמדד מולו.
        </p>

        {/* BASE DATA */}
        <Section title="בסיס">
          <Row>
            <Field label="שם" flex={2}>
              <input value={p.name} onChange={e => update("name", e.target.value)} style={input} placeholder="רועי" />
            </Field>
            <Field label="גיל">
              <input
                type="number" min={13} max={120}
                value={p.age}
                onChange={e => update("age", Number(e.target.value) || 0)}
                style={input}
              />
            </Field>
          </Row>

          <Field label="מגדר">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {([
                ["m", "זכר"], ["f", "נקבה"], ["x", "אחר / לא רלוונטי"],
              ] as [Gender, string][]).map(([k, l]) => (
                <Chip key={k} active={p.gender === k} onClick={() => update("gender", k)} color="#38bdf8">
                  {l}
                </Chip>
              ))}
            </div>
          </Field>
        </Section>

        {/* LOCATION */}
        <Section title="מקום">
          <Field label="עיר / מדינה">
            <input
              value={p.location}
              onChange={e => update("location", e.target.value)}
              style={input}
              placeholder="תל אביב, ישראל"
            />
          </Field>
          <Row>
            <Field label="lat">
              <input type="number" step="0.0001" value={p.lat} onChange={e => update("lat", Number(e.target.value))} style={input} />
            </Field>
            <Field label="lng">
              <input type="number" step="0.0001" value={p.lng} onChange={e => update("lng", Number(e.target.value))} style={input} />
            </Field>
            <button onClick={autoLocate} style={ghostBtn}>אתר אוטומטית</button>
          </Row>
        </Section>

        {/* BASE VALUES */}
        <Section title="ערכי בסיס — מהו הכוח הדומיננטי שלך באופן טבעי">
          {(Object.keys(p.baseValues) as (keyof BaseValues)[]).map(k => (
            <div key={k} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
                <span style={{ color: FORCE_COLOR[k as DominantForce] }}>
                  {FORCE_LABEL[k as DominantForce]}
                </span>
                <b style={{ color: "#e0f2fe" }}>{p.baseValues[k]}/10</b>
              </div>
              <input
                type="range" min={0} max={10}
                value={p.baseValues[k]}
                onChange={e => updateBase(k, Number(e.target.value))}
                style={{ width: "100%", accentColor: FORCE_COLOR[k as DominantForce] }}
              />
            </div>
          ))}
        </Section>

        {/* AXIS */}
        <Section title="ציר אישי ↔ חברתי">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#1e4060", marginBottom: 4 }}>
            <span>אישי −10</span><span>0</span><span>+10 חברתי</span>
          </div>
          <input
            type="range" min={-10} max={10}
            value={p.personalVsSocial}
            onChange={e => update("personalVsSocial", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#a78bfa" }}
          />
          <div style={{ textAlign: "center", fontSize: 12, marginTop: 4, color: "#a78bfa" }}>
            {p.personalVsSocial > 2 ? "נוטה לחברתי" :
             p.personalVsSocial < -2 ? "נוטה לאישי" : "מאוזן"}
            {" · "}
            <b style={{ color: "#e0f2fe" }}>{p.personalVsSocial > 0 ? "+" : ""}{p.personalVsSocial}</b>
          </div>
        </Section>

        {/* COEFFICIENT */}
        <Section title="מקדם — שלב בחיים">
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#1e4060", marginBottom: 4 }}>
            <span>רגרסיה −1</span><span>יציבות 0</span><span>+1 צמיחה</span>
          </div>
          <input
            type="range" min={-1} max={1} step={0.05}
            value={p.growthCoefficient}
            onChange={e => update("growthCoefficient", Number(e.target.value))}
            style={{ width: "100%", accentColor: "#00f5d4" }}
          />
          <div style={{ textAlign: "center", fontSize: 12, marginTop: 4, color: "#00f5d4" }}>
            <b>{p.growthCoefficient > 0 ? "+" : ""}{p.growthCoefficient.toFixed(2)}</b>
          </div>
        </Section>

        {/* BASE + ROLE */}
        <Section title="מה מחזיק אותך">
          <Field label="בסיס אישי — מה מעגן אותך">
            <textarea
              value={p.personalBase}
              onChange={e => update("personalBase", e.target.value)}
              rows={2}
              style={{ ...input, resize: "vertical" }}
              placeholder="למשל: המשפחה שלי, כושר, כתיבה"
            />
          </Field>
          <Field label="תפקיד חברתי — מה אתה נותן לסביבה">
            <textarea
              value={p.socialRole}
              onChange={e => update("socialRole", e.target.value)}
              rows={2}
              style={{ ...input, resize: "vertical" }}
              placeholder="למשל: מנהל צוות, חבר תומך, מלווה"
            />
          </Field>
        </Section>

        {/* CONFLICT BARS */}
        <Section title="ניגודים מדודים — איפה אתה על הצירים">
          {([
            ["emotion_logic",       "רגש",      "היגיון",  "#38bdf8"],
            ["ego_social",          "אגו",       "חברתי",   "#a78bfa"],
            ["action_avoidance",    "הימנעות",  "פעולה",   "#00f5d4"],
            ["personal_collective", "אישי",     "קולקטיב", "#fb923c"],
          ] as [keyof ConflictBars, string, string, string][]).map(([k, left, right, col]) => {
            const v = p.conflictBars?.[k] ?? 0.5;
            return (
              <div key={k} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#8bb8cc", marginBottom: 4 }}>
                  <span>{left}</span>
                  <b style={{ color: col }}>{(v * 100).toFixed(0)}%</b>
                  <span>{right}</span>
                </div>
                <input
                  type="range" min={0} max={1} step={0.05}
                  value={v}
                  onChange={e => updateBar(k, Number(e.target.value))}
                  style={{ width: "100%", accentColor: col }}
                />
              </div>
            );
          })}
        </Section>

        {/* FREE-TEXT CONFLICTS */}
        <Section title="ניגודים חופשיים (תגיות)">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              value={conflictInput}
              onChange={e => setConflictInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addConflict(); } }}
              placeholder="לדוגמה: חופש מול ביטחון"
              style={input}
            />
            <button onClick={addConflict} style={ghostBtn}>הוסף</button>
          </div>
          {p.coreConflicts.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
              {p.coreConflicts.map(tag => (
                <div
                  key={tag}
                  onClick={() => removeConflict(tag)}
                  style={{
                    padding: "4px 10px", fontSize: 11,
                    border: "1px solid #ef444466", background: "#ef444422",
                    color: "#fecaca", borderRadius: 12, cursor: "pointer",
                  }}
                >
                  {tag} ×
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* SUBMIT */}
        <button
          onClick={submit}
          style={{
            width: "100%", marginTop: 10,
            padding: "14px 36px", fontSize: 14, letterSpacing: 3, fontWeight: 600,
            color: "#020d1a",
            background: "linear-gradient(135deg,#00f5d4,#38bdf8)",
            border: "none", borderRadius: 6, cursor: "pointer",
            boxShadow: "0 0 40px rgba(56,189,248,0.35)",
          }}
        >
          {savedOnce ? "עדכן פרופיל" : "שמור פרופיל"}
        </button>

        <div style={{ textAlign: "center", marginTop: 12 }}>
          <a href="/" style={{ fontSize: 11, color: "#38bdf8", textDecoration: "none" }}>
            → חזור לטופס
          </a>
          {" · "}
          <a href="/nexus" style={{ fontSize: 11, color: "#38bdf8", textDecoration: "none" }}>
            → לגלובוס
          </a>
        </div>
      </div>
    </main>
  );
}

/* ---------- small components ---------- */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      border: "1px solid #0a2a4a", borderRadius: 8,
      padding: 16, marginBottom: 14, background: "#030f1eAA",
    }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, flex }: { label: string; children: React.ReactNode; flex?: number }) {
  return (
    <div style={{ marginBottom: 10, flex: flex ?? 1 }}>
      <div style={{ fontSize: 10, color: "#8bb8cc", letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      {children}
    </div>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>{children}</div>;
}

function Chip({
  children, active, onClick, color,
}: { children: React.ReactNode; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 10px", fontSize: 11, borderRadius: 6,
        border: `1px solid ${active ? color : "#0a2a4a"}`,
        background: active ? `${color}22` : "#030f1e",
        color: active ? color : "#8bb8cc",
        cursor: "pointer", fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

const input: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 13,
  background: "#030f1e", color: "#e0f2fe",
  border: "1px solid #0a2a4a", borderRadius: 6, outline: "none",
  direction: "auto",
};

const ghostBtn: React.CSSProperties = {
  padding: "10px 14px", fontSize: 11,
  background: "transparent", color: "#38bdf8",
  border: "1px solid #0a2a4a", borderRadius: 6,
  cursor: "pointer", whiteSpace: "nowrap",
};
