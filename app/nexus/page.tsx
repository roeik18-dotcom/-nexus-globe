"use client";

// diagnostic step 1: shell layout only — no globe, no data engines, no localStorage

export default function Page() {
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", background: "#020d1a", color: "#e0f2fe", fontFamily: "system-ui, sans-serif" }}>

      {/* ── Main area (globe placeholder) ── */}
      <div style={{ flex: 1, position: "relative", display: "grid", placeItems: "center" }}>
        <div style={{ color: "#1e4060", fontSize: 12, letterSpacing: 2 }}>GLOBE PLACEHOLDER</div>

        {/* Top overlay */}
        <div style={{
          position: "absolute", top: 20, left: 20, right: 340, zIndex: 5,
          background: "rgba(3,15,30,0.85)",
          border: "1px solid #0a2a4a55",
          backdropFilter: "blur(8px)",
          borderRadius: 8, padding: "14px 18px",
          pointerEvents: "none",
        }}>
          <div style={{ fontSize: 9, letterSpacing: 3, color: "#38bdf8", textTransform: "uppercase", marginBottom: 6 }}>
            Last action · —
          </div>
          <div style={{ fontSize: 16, color: "#00f5d4", fontWeight: 700, marginBottom: 8 }}>—</div>
        </div>

        {/* Bottom-left legend */}
        <div style={{
          position: "absolute", bottom: 20, left: 20, zIndex: 5,
          background: "rgba(3,15,30,0.85)", border: "1px solid #0a2a4a",
          backdropFilter: "blur(8px)", borderRadius: 8, padding: "10px 12px",
        }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 6 }}>
            קווים
          </div>
          <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
        </div>
      </div>

      {/* ── Side panel ── */}
      <div style={{ width: 320, background: "#030f1e", borderLeft: "1px solid #0a2a4a", padding: 20, overflowY: "auto" }}>
        <div style={{ fontSize: 13, letterSpacing: 4, color: "#38bdf8", fontWeight: 700, marginBottom: 4 }}>
          PHILOS · NEXUS
        </div>
        <div style={{ fontSize: 10, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 18 }}>
          0 / 0 nodes · 0 links · top 0
        </div>

        {/* Profile placeholder */}
        <div style={{ padding: 12, borderRadius: 6, marginBottom: 16, border: "1px solid #fbbf2466", background: "#fbbf2411" }}>
          <div style={{ fontSize: 10, color: "#fbbf24", textAlign: "center" }}>→ צור פרופיל</div>
        </div>

        {/* Daily summary placeholder */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>סיכום יום</div>
          <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
        </div>

        {/* Debate layer placeholder */}
        <div style={{ padding: 12, borderRadius: 6, marginBottom: 16, border: "1px solid #0a2a4a", background: "#040e1c" }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Debate · דיון ציבורי</div>
          <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
        </div>

        {/* System placeholder */}
        <div style={{ padding: 12, border: "1px solid #0a2a4a", borderRadius: 6, background: "#040e1c", marginBottom: 16 }}>
          <div style={{ fontSize: 9, color: "#1e4060", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>System</div>
          <div style={{ fontSize: 10, color: "#1e4060" }}>—</div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 16, display: "flex", gap: 6 }}>
          <a href="/" style={{
            flex: 1, textAlign: "center",
            padding: "10px 12px", fontSize: 11, letterSpacing: 2,
            color: "#020d1a", fontWeight: 700,
            background: "linear-gradient(135deg,#00f5d4,#38bdf8)",
            borderRadius: 6, textDecoration: "none",
          }}>
            ניתוח חדש
          </a>
        </div>
      </div>
    </div>
  );
}
