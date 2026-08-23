"use client";

import { useEffect, useState } from "react";

/**
 * MissionTimeline — Living Timeline for the selected mission (World lens).
 *
 * Grounded in real temporal data on the Mission record:
 *   timeline.startedAt / targetAt / completedAt   and   evidence[].observedAt
 * Renders a horizontal Yesterday → Today → Forecast strip: Start marker, each
 * evidence observation as a dot, a "Today" marker, and a Target/Forecast marker.
 * When targetAt is null the forecast is derived from state.horizon and clearly
 * labelled "forecast" (illustrative, not a real commitment). Pure presentational.
 */

type EvidenceLike = { observedAt?: string; signal?: string; note?: string };
type MissionLike = {
  state?: { horizon?: string };
  context?: { statement?: string };
  timeline?: { startedAt?: string | null; targetAt?: string | null; completedAt?: string | null };
  evidence?: EvidenceLike[];
  createdAt?: string;
  updatedAt?: string;
};

const HORIZON_DAYS: Record<string, number> = { immediate: 30, medium: 180, long: 540 };

function parse(d?: string | null): number | null {
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isNaN(t) ? null : t;
}
/* `toLocaleDateString(undefined, …)` resolves the locale from the runtime, and
   the server's runtime is not the reader's — so the server rendered one string
   and the client rendered another, which is the hydration mismatch this route
   has been throwing. A fixed locale and a fixed time zone make the two agree;
   the date shown is the date recorded, not the date as the reader's machine
   happens to localise it. */
const DATE_FMT = new Intl.DateTimeFormat("en-GB", {
  year: "2-digit", month: "short", day: "numeric", timeZone: "UTC",
});
function fmt(t: number): string {
  return DATE_FMT.format(new Date(t));
}

export default function MissionTimeline({ mission }: { mission: MissionLike }) {
  // `now` is client-only: SSR + first client render use a deterministic fallback
  // (from mission data), then useEffect sets the real clock — no hydration mismatch.
  const fallbackNow = parse(mission.timeline?.targetAt) ?? parse(mission.updatedAt as string | undefined)
    ?? parse(mission.createdAt) ?? parse(mission.timeline?.startedAt) ?? 0;
  const [now, setNow] = useState<number>(fallbackNow);
  useEffect(() => setNow(Date.now()), []);

  const started = parse(mission.timeline?.startedAt) ?? parse(mission.createdAt);
  const evidence = (mission.evidence ?? [])
    .map(e => ({ t: parse(e.observedAt), signal: e.signal, note: e.note }))
    .filter((e): e is { t: number; signal?: string; note?: string } => e.t !== null)
    .sort((a, b) => a.t - b.t);

  let target = parse(mission.timeline?.targetAt);
  let targetIsForecast = false;
  if (target === null) {
    const days = HORIZON_DAYS[mission.state?.horizon ?? "medium"] ?? 180;
    target = now + days * 86_400_000;
    targetIsForecast = true;
  }

  const start = started ?? (evidence[0]?.t ?? now);
  const min = Math.min(start, ...evidence.map(e => e.t), now);
  const max = Math.max(target, now, ...evidence.map(e => e.t));
  const span = Math.max(max - min, 86_400_000);
  const pct = (t: number) => `${((t - min) / span) * 100}%`;

  const C = { line: "#0c2040", start: "#A371F7", ev: "#22D3EE", now: "#3FB950", target: targetIsForecast ? "#D29922" : "#FB923C" };

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase", color: "#1a3550", marginBottom: 10 }}>
        Living Timeline · Start → Today → {targetIsForecast ? "Forecast" : "Target"}
      </div>
      <div style={{ position: "relative", height: 44, margin: "0 8px" }}>
        {/* baseline */}
        <div style={{ position: "absolute", top: 21, left: 0, right: 0, height: 2, background: C.line }} />
        {/* elapsed (start → today) */}
        <div style={{ position: "absolute", top: 21, left: pct(start), width: `calc(${pct(now)} - ${pct(start)})`, height: 2, background: "#22D3EE55" }} />

        {marker(pct(start), C.start, "Start", fmt(start), "top")}
        {evidence.map((e, i) => (
          <div key={i} title={`${e.signal ?? "evidence"} · ${fmt(e.t)}${e.note ? " — " + e.note : ""}`}
               style={{ position: "absolute", top: 17, left: pct(e.t), width: 9, height: 9, marginLeft: -4.5, borderRadius: "50%", background: C.ev, border: "1px solid #071018", cursor: "help" }} />
        ))}
        {marker(pct(now), C.now, "Today", fmt(now), "bottom")}
        {marker(pct(target), C.target, targetIsForecast ? "Forecast" : "Target", fmt(target), "top")}
      </div>
      <div style={{ fontSize: 12, color: "#1a3550", margin: "2px 8px 0", display: "flex", gap: 14, flexWrap: "wrap" }}>
        <span><i style={{ background: C.ev, ...dot }} />{evidence.length} evidence observation{evidence.length === 1 ? "" : "s"}</span>
        {targetIsForecast && <span><i style={{ background: C.target, ...dot }} />forecast from “{mission.state?.horizon}” horizon (illustrative)</span>}
      </div>
    </div>
  );
}

const dot = { display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 5, verticalAlign: "middle" } as const;

function marker(left: string, color: string, label: string, date: string, side: "top" | "bottom") {
  return (
    <>
      <div style={{ position: "absolute", top: 15, left, width: 3, height: 12, marginLeft: -1.5, background: color, borderRadius: 2 }} />
      <div style={{ position: "absolute", left, transform: "translateX(-50%)", [side === "top" ? "top" : "bottom"]: side === "top" ? -2 : -2, whiteSpace: "nowrap", fontSize: 12, color, fontWeight: 600 }}>
        {label}<span style={{ color: "#1a3550", fontWeight: 400 }}> · {date}</span>
      </div>
    </>
  );
}
