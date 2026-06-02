"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  CONTEXT_LABEL,
  DIRECTION_LABEL,
  computeTrust,
  directionToImpact,
  loadNodes,
  saveNode,
  type DominantForce,
  type NodeContext,
  type Direction,
  type UserNode,
} from "./lib/philos";
import { loadProfile, type UserProfile } from "./lib/profile";

export default function Page() {
  const router = useRouter();

  const [profile, setProfile]     = useState<UserProfile | null>(null);
  const [name, setName]           = useState("");
  const [event, setEvent]         = useState("");
  const [intensity, setIntensity] = useState(5);
  const [context, setContext]     = useState<NodeContext>("work");
  const [direction, setDirection] = useState<Direction>("forward");
  const [loading, setLoading]     = useState(false);
  const [err, setErr]             = useState<string | null>(null);
  const [live, setLive]           = useState<LiveAnalysis | null>(null);

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p?.name && !name) setName(p.name);
  }, []);

  function onEventChange(text: string) {
    setEvent(text);
    setLive(detectLive(text, context, direction));
  }

  async function getCoords(): Promise<{ lat: number; lng: number }> {
    // prefer profile location when set
    if (profile && typeof profile.lat === "number" && typeof profile.lng === "number") {
      return { lat: profile.lat, lng: profile.lng };
    }
    return new Promise(resolve => {
      const fallback = () => {
        resolve({
          lat: 32.08 + (Math.random() - 0.5) * 2,
          lng: 34.78 + (Math.random() - 0.5) * 2,
        });
      };
      if (typeof navigator === "undefined" || !navigator.geolocation) {
        fallback();
        return;
      }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        fallback,
        { timeout: 3000 },
      );
    });
  }

  async function analyze() {
    if (!name.trim())  { setErr("תן שם (שלך או של מי שהצומת מייצג)"); return; }
    if (!event.trim()) { setErr("תאר במשפט אחד מה קורה עכשיו");       return; }

    setLoading(true);
    setErr(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, intensity, context, direction }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      const dominantForce = json.dominantForce as DominantForce;
      const conflict      = (json.conflict ?? null) as string | null;
      const action        = String(json.action ?? "");

      const { lat, lng } = await getCoords();
      const prior = loadNodes();
      const trustScore = computeTrust(intensity, direction, dominantForce, event, prior);

      const node: UserNode = {
        id: (globalThis.crypto?.randomUUID?.() ?? String(Date.now() + Math.random())),
        name: name.trim(),
        lat, lng,
        event: event.trim(),
        intensity,
        context,
        dominantForce,
        conflict,
        action,
        direction,
        value: intensity,
        impact: directionToImpact(direction),
        trustScore,
        createdAt: Date.now(),
      };

      saveNode(node);
      localStorage.setItem("lastResult", JSON.stringify({
        dominantForce, conflict, action,
        echo: { event, intensity, context, direction, name },
      }));

      router.push("/nexus");
    } catch (e: any) {
      setErr(e?.message ?? "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at 50% 30%, #0a2a4a 0%, #020d1a 60%, #000 100%)",
        color: "#e0f2fe",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{ width: "100%", maxWidth: 540 }}>
        {/* profile banner */}
        <div style={{
          padding: "8px 12px", marginBottom: 16,
          border: `1px solid ${profile ? "#00f5d444" : "#fbbf2466"}`,
          background: profile ? "#00f5d411" : "#fbbf2411",
          borderRadius: 6, fontSize: 11,
          display: "flex", justifyContent: "space-between", alignItems: "center",
          color: profile ? "#00f5d4" : "#fbbf24",
        }}>
          <span>
            {profile
              ? `מחובר: ${profile.name} · ${profile.age}${profile.location ? ` · ${profile.location}` : ""}`
              : "אין פרופיל — צור פרופיל כדי להיות מסומן בגלובוס"}
          </span>
          <a href="/profile" style={{ color: "inherit", textDecoration: "underline", fontSize: 10 }}>
            {profile ? "ערוך" : "צור עכשיו"}
          </a>
        </div>

        <div style={{ fontSize: 11, letterSpacing: 6, color: "#38bdf8", marginBottom: 10, textAlign: "center" }}>
          PHILOS · NEXUS
        </div>
        <h1
          style={{
            fontSize: 40,
            fontWeight: 700,
            letterSpacing: -1,
            margin: 0,
            textAlign: "center",
            background: "linear-gradient(135deg,#00f5d4,#38bdf8,#a78bfa)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          מצב אחד. פעולה אחת.
        </h1>
        <p style={{ color: "#8bb8cc", marginTop: 8, marginBottom: 28, fontSize: 13, textAlign: "center" }}>
          ממפים את הכוח השולט, הקונפליקט, והצעד הבא.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Field label="שם">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="למשל: רועי" style={inputStyle} />
          </Field>

          <Field label="מה קורה עכשיו?">
            <input
              value={event}
              onChange={e => onEventChange(e.target.value)}
              placeholder="תאר במשפט אחד…"
              style={inputStyle}
            />
          </Field>

          {/* ── Live detection panel ── */}
          {live && (
            <div style={{
              padding: "12px 14px",
              border: `1px solid ${live.forceColor}55`,
              borderRadius: 8,
              background: `${live.forceColor}0d`,
              transition: "all .2s",
            }}>
              <div style={{ fontSize: 9, color: live.forceColor, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 10 }}>
                זיהוי חי
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap", marginBottom: 10 }}>
                <LiveTag icon="⚡" label="כוח"  value={live.force}   color={live.forceColor} />
                <LiveTag icon="💬" label="רגש"  value={live.emotion} color={live.forceColor} />
                <LiveTag icon="📌" label="נושא" value={live.topic}   color={live.forceColor} />
                <LiveTag icon="🏷" label="סוג"  value={live.actionType} color={live.forceColor} />
              </div>
              {/* Path */}
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", fontSize: 11 }}>
                <PathNode label="פעולה"   color={live.forceColor} />
                <Arrow />
                <PathNode label={live.actionType} color="#fbbf24" />
                <Arrow />
                <PathNode label="הוכחה"   color="#38bdf8" />
                <Arrow />
                <PathNode label={`אמון +${live.trustBoost}`} color="#34d399" />
                <Arrow />
                <PathNode label="הזדמנות" color="#a78bfa" />
              </div>
            </div>
          )}

          <Field label={`Intensity — ${intensity}/10`}>
            <input
              type="range" min={1} max={10} value={intensity}
              onChange={e => setIntensity(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#38bdf8" }}
            />
          </Field>

          <Field label="Context">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 6 }}>
              {(Object.keys(CONTEXT_LABEL) as NodeContext[]).map(c => (
                <Chip key={c} active={context === c} onClick={() => setContext(c)} color="#38bdf8">
                  {CONTEXT_LABEL[c]}
                </Chip>
              ))}
            </div>
          </Field>

          <Field label="Direction">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
              {(Object.keys(DIRECTION_LABEL) as Direction[]).map(d => (
                <Chip
                  key={d}
                  active={direction === d}
                  onClick={() => setDirection(d)}
                  color={d === "forward" ? "#00f5d4" : d === "stuck" ? "#fbbf24" : "#ef4444"}
                >
                  {DIRECTION_LABEL[d]}
                </Chip>
              ))}
            </div>
          </Field>

          <button
            onClick={analyze}
            disabled={loading}
            style={{
              marginTop: 10,
              padding: "14px 36px",
              fontSize: 14,
              letterSpacing: 3,
              fontWeight: 600,
              color: "#020d1a",
              background: loading ? "#1e4060" : "linear-gradient(135deg,#00f5d4,#38bdf8)",
              border: "none",
              borderRadius: 6,
              cursor: loading ? "default" : "pointer",
              boxShadow: "0 0 40px rgba(56,189,248,0.35)",
            }}
          >
            {loading ? "ANALYZING…" : "ANALYZE"}
          </button>

          {err && <div style={{ color: "#ff6b6b", fontSize: 12, textAlign: "center" }}>{err}</div>}

          <div style={{ textAlign: "center", marginTop: 4 }}>
            <a href="/nexus" style={{ fontSize: 11, color: "#38bdf8", textDecoration: "none" }}>
              → לגלובוס בלי ניתוח חדש
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}

// ─── Live detection ────────────────────────────────────────────────────

type LiveAnalysis = {
  force: string; forceColor: string;
  emotion: string; topic: string;
  actionType: string; trustBoost: number;
};

const FORCE_RULES: Array<{
  pattern: RegExp;
  force: string; forceColor: string;
  emotion: string; topic: string;
  actionType: string; trustBoost: number;
}> = [
  { pattern: /עזר|תרמ|שיתפ|חיבר|צוות|קהיל|יחד/,
    force: "חברתי",   forceColor: "#fb923c", emotion: "חיבור",          topic: "קשרים",  actionType: "עזרה",  trustBoost: 3 },
  { pattern: /פתר|תיקנ|טיפל|מצאת/,
    force: "רציונלי", forceColor: "#38bdf8", emotion: "ביטחון",          topic: "בעיות",  actionType: "פתרון", trustBoost: 4 },
  { pattern: /תיאמ|ארגנ|פגישה|קישור|התקשר/,
    force: "חברתי",   forceColor: "#fb923c", emotion: "שיתוף פעולה",    topic: "תיאום",  actionType: "תיאום", trustBoost: 2 },
  { pattern: /הרגשתי|רגש|שמחה|עצב|פחד|אהבה|כעס|חרדה/,
    force: "רגשי",    forceColor: "#f472b6", emotion: "עיבוד רגשי",     topic: "רגש",    actionType: "ביטוי", trustBoost: 2 },
  { pattern: /החלטתי|תכננתי|ניתחתי|חשבתי|הבנתי|למדתי/,
    force: "רציונלי", forceColor: "#38bdf8", emotion: "ניתוח",           topic: "תכנון",  actionType: "דיווח", trustBoost: 2 },
  { pattern: /הצגתי|הצלחתי|ניצחתי|הוכחתי|קיבלתי/,
    force: "אגו",     forceColor: "#a78bfa", emotion: "הכרה",            topic: "הישגים", actionType: "ביטוי", trustBoost: 2 },
  { pattern: /ספורט|הלכתי|ריצה|גוף|כאב|פצוע|שינה/,
    force: "פיזי",    forceColor: "#22c55e", emotion: "אנרגיה",          topic: "גוף",    actionType: "דיווח", trustBoost: 1 },
  { pattern: /רציתי|פתאום|ספונטני|דחף|התפרץ/,
    force: "דחף",     forceColor: "#ef4444", emotion: "דחף מיידי",       topic: "שליטה", actionType: "דיווח", trustBoost: 1 },
];

function detectLive(text: string, _ctx: string, _dir: string): LiveAnalysis | null {
  if (!text.trim()) return null;
  for (const r of FORCE_RULES) {
    if (r.pattern.test(text)) {
      return { force: r.force, forceColor: r.forceColor, emotion: r.emotion,
               topic: r.topic, actionType: r.actionType, trustBoost: r.trustBoost };
    }
  }
  return { force: "לא ידוע", forceColor: "#475569", emotion: "—", topic: "—", actionType: "כללי", trustBoost: 1 };
}

function LiveTag({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 8, color: "#1e4060", letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 13, color, fontWeight: 700 }}>{icon} {value}</div>
    </div>
  );
}

function PathNode({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ padding: "3px 8px", borderRadius: 4, border: `1px solid ${color}55`, background: `${color}11`, color, fontSize: 10, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function Arrow() {
  return <span style={{ color: "#1e4060", fontSize: 12 }}>→</span>;
}

// ─── Field / Chip ───────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block" }}>
      <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </label>
  );
}

function Chip({
  children, active, onClick, color,
}: { children: React.ReactNode; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "8px 10px",
        fontSize: 11,
        borderRadius: 6,
        border: `1px solid ${active ? color : "#0a2a4a"}`,
        background: active ? `${color}22` : "#030f1e",
        color: active ? color : "#8bb8cc",
        cursor: "pointer",
        fontWeight: active ? 700 : 400,
      }}
    >
      {children}
    </button>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 14px",
  fontSize: 14,
  background: "#030f1e",
  color: "#e0f2fe",
  border: "1px solid #0a2a4a",
  borderRadius: 6,
  outline: "none",
  direction: "rtl",
};
