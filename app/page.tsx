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

  useEffect(() => {
    const p = loadProfile();
    setProfile(p);
    if (p?.name && !name) setName(p.name);
  }, []);

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
            <input value={event} onChange={e => setEvent(e.target.value)} placeholder="תאר במשפט אחד…" style={inputStyle} />
          </Field>

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
  direction: "auto",
};
