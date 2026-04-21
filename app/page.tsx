"use client";

import dynamic from "next/dynamic";
import { useState, type CSSProperties } from "react";

const GlobeView = dynamic(() => import("./globe/GlobeView"), {
  ssr: false,
});

type AnalysisResult = {
  category?: string;
  dominant_force?: string;
  conflict_type?: string;
  action?: string;
};

export default function Page() {
  const [event, setEvent] = useState("");
  const [intensity, setIntensity] = useState("5");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [savedMessage, setSavedMessage] = useState("");

  async function analyze() {
    setLoading(true);
    setSavedMessage("");

    try {
      const res = await fetch(
        "/api/analyze",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event,
            intensity: Number(intensity),
            context,
          }),
        }
      );

      const data = await res.json();
      setResult(data);
    } catch (error) {
      console.error(error);
      setResult({
        category: "error",
        dominant_force: "unknown",
        conflict_type: "connection_error",
        action: "Could not connect to engine",
      });
    } finally {
      setLoading(false);
    }
  }

  function saveInteraction(didIt: boolean, helped: "yes" | "no" | "partial" | "") {
    const payload = {
      event,
      intensity: Number(intensity),
      context,
      category: result?.category ?? "",
      dominant_force: result?.dominant_force ?? "",
      conflict_type: result?.conflict_type ?? "",
      action: result?.action ?? "",
      did_it: didIt,
      helped,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem("philos_last", JSON.stringify(payload));
    setSavedMessage("Saved");
  }

  return (
    <main
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: "black",
        color: "white",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 0,
        }}
      >
        <GlobeView />
      </div>

      <div
        style={{
          position: "relative",
          zIndex: 10,
          minHeight: "100vh",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "center",
          paddingTop: "7vh",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            width: "min(720px, 92vw)",
            background: "rgba(0, 0, 0, 0.62)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 20,
            padding: 24,
            boxShadow: "0 10px 40px rgba(0,0,0,0.35)",
            backdropFilter: "blur(8px)",
            pointerEvents: "auto",
          }}
        >
          <div style={{ marginBottom: 20 }}>
            <div
              style={{
                fontSize: 12,
                letterSpacing: 2,
                opacity: 0.7,
                marginBottom: 10,
              }}
            >
              PHILOS ORIENTATION
            </div>

            <h1
              style={{
                margin: 0,
                fontSize: "clamp(28px, 4vw, 48px)",
                lineHeight: 1.1,
              }}
            >
              בעולם מחובר של ניגודים ומגבלות — ערך הוא המקסימום שלנו.
            </h1>

            <p
              style={{
                marginTop: 12,
                marginBottom: 0,
                opacity: 0.82,
                fontSize: 16,
              }}
            >
              מצב אחד. פעולה אחת. כיוון אמיתי.
            </p>
          </div>

          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14, opacity: 0.85 }}>מה קורה לך עכשיו?</span>
              <input
                value={event}
                onChange={(e) => setEvent(e.target.value)}
                placeholder="תאר מצב..."
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14, opacity: 0.85 }}>Intensity (1–10)</span>
              <input
                value={intensity}
                onChange={(e) => setIntensity(e.target.value)}
                type="number"
                min="1"
                max="10"
                style={inputStyle}
              />
            </label>

            <label style={{ display: "grid", gap: 6 }}>
              <span style={{ fontSize: 14, opacity: 0.85 }}>Context</span>
              <input
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="relationship / work / family..."
                style={inputStyle}
              />
            </label>

            <button
              onClick={analyze}
              disabled={loading || !event.trim()}
              style={{
                marginTop: 8,
                padding: "14px 18px",
                borderRadius: 12,
                border: "none",
                background: loading ? "#444" : "#2347ff",
                color: "white",
                cursor: loading ? "not-allowed" : "pointer",
                fontWeight: 700,
                fontSize: 15,
              }}
            >
              {loading ? "Analyzing..." : "Analyze"}
            </button>
          </div>

          {result && (
            <div
              style={{
                marginTop: 22,
                padding: 18,
                borderRadius: 16,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={rowStyle}>
                <strong>Category:</strong>
                <span>{result.category || "-"}</span>
              </div>

              <div style={rowStyle}>
                <strong>Dominant force:</strong>
                <span>{result.dominant_force || "-"}</span>
              </div>

              <div style={rowStyle}>
                <strong>Conflict:</strong>
                <span>{result.conflict_type || "-"}</span>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 6 }}>Action</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    lineHeight: 1.4,
                  }}
                >
                  {result.action || "-"}
                </div>
              </div>

              <div
                style={{
                  marginTop: 18,
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                }}
              >
                <button
                  onClick={() => saveInteraction(true, "")}
                  style={smallButtonStyle}
                >
                  I did it
                </button>

                <button
                  onClick={() => saveInteraction(true, "yes")}
                  style={smallButtonStyle}
                >
                  Did it help? Yes
                </button>

                <button
                  onClick={() => saveInteraction(true, "no")}
                  style={smallButtonStyle}
                >
                  Did it help? No
                </button>

                <button
                  onClick={() => saveInteraction(true, "partial")}
                  style={smallButtonStyle}
                >
                  Partial
                </button>
              </div>

              {savedMessage && (
                <div style={{ marginTop: 12, color: "#7CFF9B", fontWeight: 600 }}>
                  {savedMessage}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const inputStyle: CSSProperties = {
  padding: "12px 14px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.15)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  outline: "none",
  fontSize: 15,
};

const rowStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  marginBottom: 8,
  fontSize: 14,
};

const smallButtonStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.08)",
  color: "white",
  cursor: "pointer",
  fontWeight: 600,
};