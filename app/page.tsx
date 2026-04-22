"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch("/api/analyze", { method: "POST" });
      if (!res.ok) throw new Error(`API ${res.status}`);
      const json = await res.json();
      localStorage.setItem("lastResult", JSON.stringify(json));
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
      <div style={{ fontSize: 11, letterSpacing: 6, color: "#38bdf8", marginBottom: 16 }}>
        PHILOS · ORIENTATION
      </div>
      <h1
        style={{
          fontSize: 56,
          fontWeight: 700,
          letterSpacing: -1,
          margin: 0,
          background: "linear-gradient(135deg,#00f5d4,#38bdf8,#a78bfa)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        One state. One action.
      </h1>
      <p style={{ color: "#8bb8cc", marginTop: 14, marginBottom: 36, fontSize: 14 }}>
        Press analyze to reveal your network.
      </p>

      <button
        onClick={analyze}
        disabled={loading}
        style={{
          padding: "14px 36px",
          fontSize: 14,
          letterSpacing: 3,
          fontWeight: 600,
          color: "#020d1a",
          background: loading
            ? "#1e4060"
            : "linear-gradient(135deg,#00f5d4,#38bdf8)",
          border: "none",
          borderRadius: 6,
          cursor: loading ? "default" : "pointer",
          boxShadow: "0 0 40px rgba(56,189,248,0.35)",
          transition: "transform .15s",
        }}
        onMouseEnter={(e) => { if (!loading) (e.currentTarget.style.transform = "translateY(-2px)"); }}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
      >
        {loading ? "ANALYZING…" : "ANALYZE"}
      </button>

      {err && (
        <div style={{ marginTop: 20, color: "#ff6b6b", fontSize: 12 }}>
          {err}
        </div>
      )}
    </main>
  );
}
