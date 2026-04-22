"use client";

import { useMemo, useState } from "react";
import GlobeView from "./globe/GlobeView";
import { useGraphData } from "./graph/useGraphData";
import { computeExecutionImpact, saveFeedback } from "./lib/feedback";

type AnalysisResult = {
  category: string;
  dominantForce: string;
  conflict: string;
  action: string;
};

export default function Page() {
  const data = useGraphData();
  const [event, setEvent] = useState("");
  const [intensity, setIntensity] = useState(5);
  const [context, setContext] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [tick, setTick] = useState(0);

  async function analyze() {
    const res = await fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, intensity: Number(intensity), context }),
    });
    const json = await res.json();
    setResult(json); window.location.href="/nexus";
  }

  const metric = useMemo(() => computeExecutionImpact(), [tick]);

  return (
    <div style={{ padding: 20, background: "#000", minHeight: "100vh", color: "#fff" }}>
      <div style={{ width: "100%", height: 500, marginBottom: 24 }}>
        <GlobeView data={data} />
      </div>

      <div style={{ maxWidth: 760, margin: "0 auto", border: "1px solid #222", borderRadius: 16, padding: 20 }}>
        <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>PHILOS ORIENTATION</div>
        <h1 style={{ fontSize: 28, lineHeight: 1.2, margin: "0 0 8px" }}>בעולם מחובר של ניגודים ומגבלות — ערך הוא המקסימום שלנו.</h1>
        <div style={{ opacity: 0.75, marginBottom: 20 }}>מצב אחד. פעולה אחת. כיוון אמיתי.</div>

        <div style={{ marginBottom: 10 }}>מה קורה לך עכשיו?</div>
        <input value={event} onChange={(e) => setEvent(e.target.value)} placeholder="event" style={{ width: "100%", marginBottom: 14, padding: 12, borderRadius: 12, border: "1px solid #333", background: "#111", color: "#fff" }} />

        <div style={{ marginBottom: 10 }}>Intensity (1–10)</div>
        <input value={intensity} onChange={(e) => setIntensity(Number(e.target.value))} type="number" min={1} max={10} style={{ width: "100%", marginBottom: 14, padding: 12, borderRadius: 12, border: "1px solid #333", background: "#111", color: "#fff" }} />

        <div style={{ marginBottom: 10 }}>Context</div>
        <input value={context} onChange={(e) => setContext(e.target.value)} placeholder="context" style={{ width: "100%", marginBottom: 14, padding: 12, borderRadius: 12, border: "1px solid #333", background: "#111", color: "#fff" }} />

        <button onClick={analyze} style={{ width: "100%", padding: 14, borderRadius: 12, border: 0, background: "#5b3df5", color: "#fff", fontWeight: 700, marginBottom: 20 }}>
          Analyze
        </button>

        {result && (
          <div style={{ border: "1px solid #222", borderRadius: 14, padding: 16 }}>
            <div style={{ marginBottom: 8 }}><b>Category:</b> {result.category}</div>
            <div style={{ marginBottom: 8 }}><b>Dominant force:</b> {result.dominantForce}</div>
            <div style={{ marginBottom: 8 }}><b>Conflict:</b> {result.conflict}</div>
            <div style={{ marginBottom: 16 }}><b>Action:</b> {result.action}</div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              <button onClick={() => { saveFeedback({ did: true, helped: "yes", ts: Date.now() }); setTick((t) => t + 1); }}>Did it help? Yes</button>
              <button onClick={() => { saveFeedback({ did: true, helped: "no", ts: Date.now() }); setTick((t) => t + 1); }}>Did it help? No</button>
              <button onClick={() => { saveFeedback({ did: true, helped: "partial", ts: Date.now() }); setTick((t) => t + 1); }}>Partial</button>
            </div>

            <div>
              <b>Execution × Impact:</b>{" "}
              {metric.rate === undefined ? "—" : `${metric.rate}% (${metric.succeeded}/${metric.total})`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
