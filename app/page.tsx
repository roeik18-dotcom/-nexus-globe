"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const [event, setEvent] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    if (!event.trim()) {
      setErr("תאר את מה שקורה לך עכשיו");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event, intensity, context }),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      localStorage.setItem("lastResult", JSON.stringify({ ...json, event, intensity, context }));
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
        background:
          "radial-gradient(ellipse at 50% 30%, #0a2a4a 0%, #020d1a 60%, #000 100%)",
        color: "#e0f2fe",
        fontFamily: "'Inter', system-ui, sans-serif",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 40,
      }}
    >
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ fontSize: 11, letterSpacing: 6, color: "#38bdf8", marginBottom: 10, textAlign: "center" }}>
          PHILOS · ORIENTATION
        </div>
        <h1
          style={{
            fontSize: 42,
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
        <p style={{ color: "#8bb8cc", marginTop: 10, marginBottom: 32, fontSize: 14, textAlign: "center" }}>
          כיוון אמיתי.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Event */}
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
              מה קורה לך עכשיו?
            </div>
            <input
              value={event}
              onChange={(e) => setEvent(e.target.value)}
              placeholder="תאר במשפט אחד…"
              style={inputStyle}
            />
          </label>

          {/* Intensity */}
          <label style={{ display: "block" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase" }}>
                Intensity
              </div>
              <div style={{ fontSize: 14, color: "#00f5d4", fontWeight: 700 }}>{intensity}</div>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={intensity}
              onChange={(e) => setIntensity(Number(e.target.value))}
              style={{ width: "100%", accentColor: "#38bdf8" }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "#1e4060", marginTop: 2 }}>
              <span>1</span><span>5</span><span>10</span>
            </div>
          </label>

          {/* Context */}
          <label style={{ display: "block" }}>
            <div style={{ fontSize: 10, letterSpacing: 2, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
              Context
            </div>
            <input
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="work / relationship / health …"
              style={inputStyle}
            />
          </label>

          {/* Analyze */}
          <button
            onClick={analyze}
            disabled={loading}
            style={{
              marginTop: 12,
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
              transition: "transform .15s",
            }}
            onMouseEnter={(e) => {
              if (!loading) (e.currentTarget.style.transform = "translateY(-2px)");
            }}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
          >
            {loading ? "ANALYZING…" : "ANALYZE"}
          </button>

          {err && (
            <div style={{ color: "#ff6b6b", fontSize: 12, textAlign: "center" }}>{err}</div>
          )}
        </div>
      </div>
    </main>
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
