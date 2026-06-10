"use client";

import { useState, useEffect, useMemo } from "react";
import { getCurrentPerson, createPerson, type Person } from "../lib/personStore";
import { computePersonChain } from "../lib/personChain";
import {
  computeNoaChain,
  deptLabel,
  buildNoaSnapshot,
  riskHe,
  type CollapseRisk,
} from "../lib/noa";
import NoaTransformation from "./NoaTransformation";
import PersonalMap from "./PersonalMap";
import UserIntake, { type IntakeProfile } from "./UserIntake";
import PhilosDiagnostic from "./PhilosDiagnostic";

// Palette aligned with page.tsx
const C = {
  bg: "#030f1e",
  card: "#040e1c",
  border: "#0a2a4a",
  borderSoft: "#1e4060",
  cyan: "#38bdf8",
  green: "#34d399",
  red: "#ef4444",
  orange: "#fb923c",
  yellow: "#fbbf24",
  purple: "#a78bfa",
  muted: "#1e4060",
  text: "#cfe6f5",
};

const riskColor: Record<CollapseRisk, string> = {
  low: C.green, medium: C.yellow, high: C.orange, critical: C.red,
};
const levelColor: Record<string, string> = {
  low: C.red, medium: C.yellow, high: C.cyan, strong: C.green,
  "very high": C.red, minimal: C.green, critical: C.red,
};

const sectionLabel: React.CSSProperties = {
  fontSize: 9, color: C.borderSoft, letterSpacing: 2,
  textTransform: "uppercase", margin: "18px 0 8px",
};
const card: React.CSSProperties = {
  background: C.card, border: `1px solid ${C.border}`, borderRadius: 6, padding: 11,
};
const line: React.CSSProperties = { fontSize: 12, lineHeight: 1.7 };
const metaTxt: React.CSSProperties = { fontSize: 10.5, color: C.borderSoft, marginTop: 4 };

function Bar({ pct, color }: { pct: number; color: string }) {
  return (
    <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden" }}>
      <div style={{ height: "100%", borderRadius: 3, width: `${Math.max(0, Math.min(100, pct))}%`, background: color }} />
    </div>
  );
}

function actionBtn(active: boolean, color: string): React.CSSProperties {
  return {
    padding: "5px 12px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600,
    border: `1px solid ${color}`, background: active ? `${color}22` : "transparent", color,
    whiteSpace: "nowrap",
  };
}

function Stat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderRadius: 6, padding: "8px 10px" }}>
      <div style={{ fontSize: 9.5, color: C.borderSoft, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: color ?? C.text }}>{value}</div>
    </div>
  );
}

// Value Network — shared values per helper role (display mapping only; loads
// come from the existing load distribution).
const SHARED_VALUES = ["Truth", "Justice", "Protection", "Responsibility", "Dignity"];
const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice",
  therapist: "Protection",
  journalist: "Truth",
  donor: "Responsibility",
  peer_survivor: "Dignity",
};
// Helper role → main human dimension it supports (display mapping only).
const ROLE_DIMENSION: Record<string, string> = {
  lawyer: "Rational",
  therapist: "Emotional",
  journalist: "Rational",
  donor: "Physical",
  peer_survivor: "Emotional",
};

// Value Network Offers — concrete offers per helper role (display only; loads
// and trust are demo data, no backend / no payment / no real messaging).
const OFFER_DATA: Record<string, { roleLabel: string; offers: string[]; trust: string }> = {
  lawyer: { roleLabel: "Lawyer", offers: ["legal review", "case strategy", "rights guidance"], trust: "verified demo" },
  therapist: { roleLabel: "Therapist", offers: ["emotional support", "stabilization session", "recovery plan"], trust: "verified demo" },
  journalist: { roleLabel: "Journalist", offers: ["story framing", "public visibility", "media contact"], trust: "verified demo" },
  donor: { roleLabel: "Donor", offers: ["emergency support", "basic resource funding"], trust: "verified demo" },
  peer_survivor: { roleLabel: "Peer Survivor", offers: ["belonging", "experience sharing", "non-isolation support"], trust: "verified demo" },
};

// Person-first profile (demo identity data; chain values come from computeNoaChain).
const NOA_PROFILE = {
  name: "נועה וקסנר",
  nameEn: "Noa Wexner",
  flag: "🇮🇱",
  country: "Israel",
  avatarInitial: "NW",
  statement: "Carrying a collective burden — connecting through shared values to a network that shares the load.",
  coreValues: ["Truth", "Justice", "Protection", "Responsibility", "Dignity"],
  primaryValue: "Justice",
};

// Timeline status colors.
const STATUS_C: Record<string, string> = { completed: "#34d399", active: "#fbbf24", pending: "#1e4060" };

// Social-profile demo content.
const VALUE_ICON: Record<string, string> = { Justice: "⚖", Protection: "🛡", Truth: "🔍", Responsibility: "🤝", Dignity: "❤️" };
const PROFILE_PHOTOS = [
  { label: "משפחה", emoji: "👨‍👩‍👧" },
  { label: "חברים", emoji: "👥" },
  { label: "קהילה", emoji: "🏘️" },
  { label: "פעילות ערכית", emoji: "✊" },
];
const PROFILE_RESOURCES = ["זמן", "ידע", "קשרים", "חשיפה", "תמיכה", "משאבים"];
const PROFILE_POSTS = [
  "No person should have to carry a collective burden alone.",
  "Values become real when people act on them.",
  "The network is strongest when responsibility is shared.",
];
// Pentagon vertices for the value-network diagram (left%, top% in the box).
const VALUE_NODES = [
  { v: "Truth", left: 50, top: 9 },
  { v: "Protection", left: 89, top: 38 },
  { v: "Dignity", left: 74, top: 86 },
  { v: "Responsibility", left: 26, top: 86 },
  { v: "Justice", left: 11, top: 38 },
];

// Profile tabs.
const TABS = ["journey", "map", "me", "overview", "community", "requests", "chain", "posts"] as const;
type ProfileTab = (typeof TABS)[number];

// Score interpretation bands (UI reading of the existing score — no calc change).
const SCORE_BANDS = [
  { range: "0–25", label: "Collapse / no orientation" },
  { range: "26–50", label: "First stabilization" },
  { range: "51–75", label: "Active recovery" },
  { range: "76–100", label: "Strong orientation" },
];
function bandIndex(score: number): number {
  return score <= 25 ? 0 : score <= 50 ? 1 : score <= 75 ? 2 : 3;
}

export default function NoaPanel() {
  const c = computeNoaChain(0);
  const [copied, setCopied] = useState(false);
  const [requested, setRequested] = useState<Set<string>>(() => new Set());
  const [fulfilled, setFulfilled] = useState<Set<string>>(() => new Set());
  const [following, setFollowing] = useState(false);
  const [joined, setJoined] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("journey");
  const [myProfile, setMyProfile] = useState<IntakeProfile | null>(null);
  const [currentPerson, setCurrentPerson] = useState<Person | null>(null);

  // Load the locally-persisted current person (L1), if one exists. Client-only.
  useEffect(() => { setCurrentPerson(getCurrentPerson()); }, []);

  // On intake completion, persist a real Person entity (L1) from the answers.
  // Dimension scores are approximate (V1): the dimension the person says they
  // most need is treated as their most depleted (low); the others sit mid.
  const onIntakeDone = (p: IntakeProfile) => {
    setMyProfile(p);
    const scoreFor = (dim: string) => (p.needDim === dim ? 30 : 60);
    try {
      createPerson({
        name: "You",
        values: p.values,
        primaryValue: p.values[0],
        needs: [p.needDim],
        physical: scoreFor("Physical"),
        emotional: scoreFor("Emotional"),
        rational: scoreFor("Rational"),
        intake: { tensionDept: p.tensionDept, needDim: p.needDim, values: p.values },
      });
    } catch { /* storage unavailable */ }
    setCurrentPerson(getCurrentPerson());
  };

  // The current person projected into a chain (V1/approximate). Null → surfaces
  // fall back to the locked Noa chain (honest default).
  const personChain = useMemo(
    () => (currentPerson ? computePersonChain(currentPerson) : null),
    [currentPerson]
  );
  const score = c.orientation?.score ?? 0;
  const band = SCORE_BANDS[bandIndex(score)];
  const requestSupport = (role: string) =>
    setRequested(prev => { const n = new Set(prev); n.add(role); return n; });
  const markFulfilled = (role: string) =>
    setFulfilled(prev => { const n = new Set(prev); n.add(role); return n; });
  const queueItems = (c.load?.helpers ?? []).filter(h => requested.has(h.role));
  const requestedLoad = queueItems.reduce((s, h) => s + h.allocated, 0);
  const networkCapacity = c.load?.distributedLoad ?? 0;
  const valuesCovered = queueItems.map(h => ROLE_VALUE[h.role] ?? "—").join(", ") || "—";
  const rolesActivated = queueItems.map(h => OFFER_DATA[h.role]?.roleLabel ?? "—").join(", ") || "—";
  const dimsActivated = [...new Set(queueItems.map(h => ROLE_DIMENSION[h.role]).filter(Boolean))].join(" + ") || "—";
  const energySupport = requestedLoad === 0 ? "none" : requestedLoad >= networkCapacity ? "full" : "partial";
  const impactNote = queueItems.length === 0
    ? "No requests yet — select offers to preview operational impact."
    : requestedLoad >= networkCapacity
      ? "The full value network is activated into operational support."
      : "These requests begin converting the value network into operational support.";
  const fulfilledItems = queueItems.filter(h => fulfilled.has(h.role));
  const fulfilledCount = fulfilledItems.length;
  const fulfilledLoad = fulfilledItems.reduce((s, h) => s + h.allocated, 0);
  const pendingLoad = requestedLoad - fulfilledLoad;
  const fulfilledValues = fulfilledItems.map(h => ROLE_VALUE[h.role] ?? "—").join(", ") || "—";
  const fulfilledDims = [...new Set(fulfilledItems.map(h => ROLE_DIMENSION[h.role]).filter(Boolean))].join(" + ") || "—";
  const operationalStatus = fulfilledCount === 0 ? "waiting for support"
    : fulfilledCount <= 2 ? "initial support active"
      : fulfilledCount <= 4 ? "multi-role support active"
        : "full value-network support active";

  // Profile timeline — the story as human-readable events (reads existing state).
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  const fulfilledStatus = fulfilledCount === 0 ? "pending"
    : queueItems.length > 0 && fulfilledCount >= queueItems.length ? "completed" : "active";
  const timeline = [
    { title: "Case opened", text: "Noa became Case Zero.", status: "completed" },
    { title: "Collapse detected", text: "Negative forces dominate across 6 departments.", status: "completed" },
    { title: "Value network activated", text: "Truth · Justice · Protection · Responsibility · Dignity", status: "completed" },
    { title: "Support requested", text: `${queueItems.length} request${queueItems.length === 1 ? "" : "s"} created`, status: queueItems.length > 0 ? "completed" : "pending" },
    { title: "Support fulfilled", text: `${fulfilledCount} / ${queueItems.length} fulfilled`, status: fulfilledStatus },
    { title: "First stabilization", text: c.orientation ? `Orientation Score ${score} / ${cap(c.orientation.level)}` : "—", status: "completed" },
  ];

  // Tension Flow — the actual causal chain (not a linear ladder). Reads existing outputs.
  const tensionFlow = [
    { label: "Origin", value: c.tension?.origin ?? "Space" },
    { label: "Base opposition", value: c.tension?.strongest.name ?? "—" },
    { label: "Vector", value: deptLabel(c.tension?.strongest.department) },
    { label: "Expression cell", value: `${deptLabel(c.attention.strongest.department)} · ${c.attention.strongest.channel}` },
    { label: "Attention", value: `highest pull (${c.attention.strongest.attentionPct}%)` },
    { label: "Leakage", value: c.leakage ? `${c.leakage.totalLeakage} / ${cap(c.leakage.leakageLevel)}` : "—" },
    { label: "Value response", value: "Truth · Justice · Protection · Responsibility · Dignity" },
    { label: "Network response", value: c.load ? c.load.helpers.map(h => h.name.split(" ")[0]).join(" · ") : "—" },
    { label: "Load distribution", value: c.load ? `Noa ${c.load.beforePct}% → ${c.load.afterPct}% · Community ${c.load.communityPct}%` : "—" },
    { label: "Action", value: c.action ? cap(c.action.recommendedAction) : "—" },
    { label: "Impact", value: c.action ? `+${c.action.expectedEnergyGain} energy · −${c.action.expectedLoadReduction} load · +${c.action.expectedOrientationGain} orientation · ${c.action.collectiveImpact} collective` : "—" },
  ];
  const flowPhaseColor = (i: number) => (i <= 5 ? C.red : i <= 7 ? C.purple : C.green);

  function copy() {
    const text = buildNoaSnapshot(0);
    const done = (ok: boolean) => { setCopied(ok); setTimeout(() => setCopied(false), 1800); };
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(() => done(true), () => done(legacyCopy(text)));
    } else {
      done(legacyCopy(text));
    }
  }

  return (
    <div dir="rtl" style={{ flex: 1, overflowY: "auto", padding: 18, color: C.text, fontSize: 13 }}>

      {/* Profile Card — person-first: who is this, what they stand for, who supports them */}
      <div style={{ ...card, padding: 14, marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 10 }}>
          {/* Deterministic Philos avatar: purple(truth/justice) → red(collapse) → green(recovery), white glow = orientation */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{ width: 52, height: 52, borderRadius: "50%", background: `linear-gradient(135deg, ${C.purple}, ${C.red} 52%, ${C.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: 0.5, boxShadow: "0 0 0 2px rgba(255,255,255,0.28), 0 0 14px rgba(255,255,255,0.12)" }}>{NOA_PROFILE.avatarInitial}</div>
            <span style={{ position: "absolute", bottom: -2, right: -2, fontSize: 13, lineHeight: 1, background: C.card, borderRadius: "50%", padding: "1px 2px", border: `1px solid ${C.border}` }}>{NOA_PROFILE.flag}</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{NOA_PROFILE.name}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", marginTop: 3 }}>
              <span style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.purple, background: "#a78bfa18", border: `1px solid ${C.purple}55`, borderRadius: 4, padding: "1px 6px" }}>Case Zero</span>
              <span style={{ fontSize: 11, color: C.borderSoft }}>{NOA_PROFILE.flag} {NOA_PROFILE.country} · {NOA_PROFILE.nameEn}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6, marginBottom: 10 }}>{NOA_PROFILE.statement}</div>

        <div style={{ fontSize: 9, color: C.borderSoft, textTransform: "uppercase", letterSpacing: 1, marginBottom: 5 }}>Core values · primary <b style={{ color: C.purple }}>{NOA_PROFILE.primaryValue}</b></div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {NOA_PROFILE.coreValues.map(v => {
            const primary = v === NOA_PROFILE.primaryValue;
            return <span key={v} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: primary ? "#a78bfa22" : C.bg, border: `1px solid ${primary ? C.purple : C.border}`, color: primary ? C.purple : C.text, fontWeight: primary ? 700 : 400 }}>{v}{primary ? " ★" : ""}</span>;
          })}
        </div>

        {/* Profile actions — social-network style (local UI state only) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <button onClick={() => setFollowing(f => !f)} style={actionBtn(following, C.cyan)}>{following ? "✓ Following" : "Follow Case"}</button>
          <button onClick={() => setJoined(j => !j)} style={actionBtn(joined, C.green)}>{joined ? "✓ Joined" : "Join Value Network"}</button>
          <button onClick={copy} style={actionBtn(copied, C.purple)}>{copied ? "Snapshot copied" : "Share Snapshot"}</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="Orientation" value={c.orientation ? `${score} · ${c.orientation.level}` : "—"} color={c.orientation ? (levelColor[c.orientation.level] ?? C.text) : C.text} />
          <Stat label="Energy" value={c.load ? `${c.load.afterEnergy} (+${c.load.energyRecovered})` : "—"} color={C.green} />
          <Stat label="Community support" value={c.load ? `${c.load.communityPct}%` : "—"} color={C.cyan} />
          <Stat label="Active network" value={`${c.load?.helpers.length ?? 0} helpers`} />
          <Stat label="Requests" value={`${queueItems.length}`} />
          <Stat label="Fulfilled support" value={`${fulfilledCount}`} color={C.green} />
        </div>
        <div style={{ fontSize: 11, marginTop: 9 }}>Operational status: <b style={{ color: fulfilledCount === 0 ? C.borderSoft : C.green }}>{operationalStatus}</b></div>
        <div style={{ fontSize: 9, color: C.borderSoft, marginTop: 9, letterSpacing: 0.3 }}>Noa Chain MVP 0.5 · value-based profile · demo</div>
      </div>

      {/* Profile tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: "6px 4px", borderRadius: 6, fontSize: 11, cursor: "pointer", fontWeight: 600, textTransform: "capitalize", border: `1px solid ${tab === t ? C.cyan : C.border}`, background: tab === t ? "#38bdf822" : "transparent", color: tab === t ? C.cyan : C.borderSoft }}>{t}</button>
        ))}
      </div>

      {/* Journey — the First 30 Seconds; Continue settles into the Personal Map */}
      {tab === "journey" && (
        <div style={{ height: 620 }}>
          <NoaTransformation onContinue={() => setTab("map")} />
        </div>
      )}

      {/* Personal Map — the permanent "You Are Here" screen (current person if any, else Noa) */}
      {tab === "map" && <PersonalMap chain={personChain ?? undefined} />}

      {/* Me — User Intake (3 questions) → the user's own Personal Map */}
      {tab === "me" && (
        <>
          {/* L1 · read-only current-person summary (shown only if one exists) */}
          {currentPerson && (
            <div style={{ background: C.bg, border: `1px solid ${C.border}`, borderInlineStart: `3px solid ${C.green}`, borderRadius: 6, padding: "8px 11px", marginBottom: 10 }}>
              <div style={{ fontSize: 9, color: C.borderSoft, letterSpacing: 1, textTransform: "uppercase", marginBottom: 3 }}>Current Person · stored locally</div>
              <div style={{ fontSize: 13, fontWeight: 700 }}>{currentPerson.name} <span style={{ fontSize: 10, color: C.green }}>· {currentPerson.primaryValue}</span></div>
              <div style={{ fontSize: 10, color: "#9fc7df", marginTop: 2 }}>
                values: {currentPerson.values.join(", ") || "—"}{currentPerson.needs.length ? ` · needs: ${currentPerson.needs.join(", ")}` : ""}
              </div>
              <div style={{ fontSize: 8.5, color: C.borderSoft, marginTop: 2 }}>id {currentPerson.id} · created {new Date(currentPerson.createdAt).toLocaleString()}</div>
            </div>
          )}

          {myProfile ? (
            <>
              <PersonalMap profile={myProfile} chain={personChain ?? undefined} />
              <button onClick={() => setMyProfile(null)} style={{ marginTop: 8, padding: "7px 14px", borderRadius: 6, fontSize: 11, cursor: "pointer", border: `1px solid ${C.borderSoft}`, background: "transparent", color: C.borderSoft }}>↻ התחל מחדש</button>
            </>
          ) : (
            <div style={{ minHeight: 420 }}>
              <UserIntake onDone={onIntakeDone} />
            </div>
          )}
        </>
      )}

      {/* Profile Timeline — story as human-readable events with live status */}
      {tab === "overview" && (
      <>
      <div style={sectionLabel}>Timeline</div>
      <div style={{ ...card, marginBottom: 6 }}>
        {timeline.map((t, i) => (
          <div key={t.title} style={{ display: "flex", gap: 10 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0, border: `2px solid ${STATUS_C[t.status]}`, background: t.status === "completed" ? STATUS_C[t.status] : "transparent", color: "#03101e", fontSize: 9, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{t.status === "completed" ? "✓" : ""}</span>
              {i < timeline.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 12, background: C.border }} />}
            </div>
            <div style={{ paddingBottom: i < timeline.length - 1 ? 10 : 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600 }}>{t.title} <span style={{ fontSize: 9, color: STATUS_C[t.status], textTransform: "uppercase", letterSpacing: 0.5, marginInlineStart: 4 }}>{t.status}</span></div>
              <div style={{ fontSize: 11, color: "#7fa6bd", lineHeight: 1.5, marginTop: 1 }}>{t.text}</div>
            </div>
          </div>
        ))}
      </div>
      </>
      )}

      {/* Overview social sections */}
      {tab === "overview" && (
        <>
          {/* Story */}
          <div style={sectionLabel}>Story</div>
          <div style={{ ...card, marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.9 }}>
              אירוע פגיעה יצר עומס גדול שנפל על אדם אחד. המערכת זיהתה מוקד מתח: <b style={{ color: C.cyan }}>{c.tension?.strongest.name ?? "Connection ↔ Disconnection"}</b>. המוקד הזה יצר קשב עודף, דליפת אנרגיה, עומס רגשי וירידת יציבות. Nexus חיברה בין נועה לאנשים שמחוברים לאותם ערכים. העומס חולק. האנרגיה החלה לחזור.
            </div>
          </div>

          {/* Current Need (from action) */}
          <div style={sectionLabel}>Current Need</div>
          <div style={{ ...card, borderRight: `3px solid ${C.yellow}`, marginBottom: 8, fontSize: 12, color: C.text }}>
            {c.action ? `Strengthen ${c.action.targetDimension.toLowerCase()} stability.` : "—"}
          </div>
        </>
      )}

      {/* Community tab — social value-network sections */}
      {tab === "community" && (
        <>
          {/* Community */}
          <div style={sectionLabel}>Community</div>
          {(c.load?.helpers ?? []).map(h => {
            const val = ROLE_VALUE[h.role] ?? "—";
            return (
              <div key={h.role} style={{ ...card, display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16 }}>{VALUE_ICON[val] ?? "•"}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, flex: 1 }}>{h.name.split(" ")[0]}</span>
                <span style={{ fontSize: 11, color: C.purple }}>{val}</span>
              </div>
            );
          })}

          {/* Value Network diagram (radial) */}
          <div style={sectionLabel}>Value Network</div>
          <div style={{ ...card, position: "relative", height: 180, marginBottom: 8 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
              {VALUE_NODES.map(n => <line key={n.v} x1="50" y1="50" x2={n.left} y2={n.top} stroke={C.border} strokeWidth="0.6" />)}
            </svg>
            <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", width: 42, height: 42, borderRadius: "50%", background: `linear-gradient(135deg,${C.purple},${C.red} 52%,${C.green})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff", boxShadow: "0 0 0 2px rgba(255,255,255,0.25)" }}>Noa</div>
            {VALUE_NODES.map(n => (
              <div key={n.v} style={{ position: "absolute", left: `${n.left}%`, top: `${n.top}%`, transform: "translate(-50%,-50%)", fontSize: 10, fontWeight: 600, color: C.purple, background: C.bg, border: `1px solid ${C.purple}66`, borderRadius: 10, padding: "2px 8px", whiteSpace: "nowrap" }}>{n.v}</div>
            ))}
          </div>

          {/* Resources */}
          <div style={sectionLabel}>Resources</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
            {PROFILE_RESOURCES.map(r => (
              <span key={r} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>{r}</span>
            ))}
          </div>
        </>
      )}

      {/* Posts tab — photos + posts */}
      {tab === "posts" && (
        <>
          {/* Photos (placeholders only) */}
          <div style={sectionLabel}>Photos</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
            {PROFILE_PHOTOS.map(p => (
              <div key={p.label} style={{ height: 68, background: C.bg, border: `1px dashed ${C.border}`, borderRadius: 8, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <span style={{ fontSize: 22 }}>{p.emoji}</span>
                <span style={{ fontSize: 10, color: C.borderSoft }}>{p.label}</span>
              </div>
            ))}
          </div>

          {/* Posts */}
          <div style={sectionLabel}>Posts</div>
          {PROFILE_POSTS.map((p, i) => (
            <div key={i} style={{ ...card, marginBottom: 6 }}>
              <div style={{ fontSize: 12, color: C.text, lineHeight: 1.6 }}>&quot;{p}&quot;</div>
              <div style={{ fontSize: 9, color: C.borderSoft, marginTop: 5 }}>נועה · Case Zero</div>
            </div>
          ))}
        </>
      )}

      {/* Philos Diagnostic Engine — the FLOW (story first). Matrix below = evidence. */}
      {tab === "chain" && <PhilosDiagnostic chain={personChain ?? undefined} />}

      {/* 1 — Base Tension Field */}
      {tab === "chain" && c.tension && (
        <>
          <div style={sectionLabel}>1 · Base Tension Field — origin: {c.tension.origin}</div>
          <div style={{ fontSize: 10, color: C.borderSoft, marginBottom: 8 }}>{c.tension.origin} → base oppositions → 6 departments</div>
          {c.tension.fields.map(f => (
            <div key={f.name} style={{ ...card, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 600, marginBottom: 5 }}>
                <span>{f.name}</span><span>{f.intensity}</span>
              </div>
              <Bar pct={f.intensity} color={`linear-gradient(90deg,${C.purple},${C.red})` as unknown as string} />
              <div style={metaTxt}>→ {deptLabel(f.department)}</div>
            </div>
          ))}
          <div style={{ ...line, marginTop: 4 }}>Strongest tension: <b style={{ color: C.cyan }}>{c.tension.strongest.name}</b> → {deptLabel(c.tension.strongest.department)} ({c.tension.strongest.intensity}) · avg {c.tension.averageTension}</div>
        </>
      )}

      {/* 2 — 18 Expression Cells */}
      {tab === "chain" && (
      <>
      <div style={sectionLabel}>2 · Expression Matrix — 18 cells (dominance %)</div>
      <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 1fr 1fr", gap: 4 }}>
        <div />
        {["Body", "Emotion", "Mind"].map(ch => (
          <div key={ch} style={{ fontSize: 9.5, color: C.borderSoft, textAlign: "center" }}>{ch}</div>
        ))}
        {[...new Set(c.attention.cells.map(x => x.department))].map(dept => (
          <Cells key={dept} dept={dept} cells={c.attention.cells} strong={c.attention.strongest} />
        ))}
      </div>
      <div style={{ ...line, marginTop: 6 }}>Strongest attention: <b style={{ color: C.red }}>{deptLabel(c.attention.strongest.department)} · {c.attention.strongest.channel}</b> ({c.attention.strongest.dominance}% · {c.attention.strongest.attentionPct}%)</div>
      </>
      )}

      {/* 3 — Collapse Map */}
      {tab === "chain" && c.collapse && (
        <>
          <div style={sectionLabel}>3 · Collapse Map — {c.collapse.totalNegativeDominance}% avg</div>
          <div style={{ ...card, borderRight: `3px solid ${C.red}`, marginBottom: 8, ...line }}>{c.collapse.summary}</div>
          {c.collapse.departments.map(d => (
            <div key={d.name} style={{ ...card, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{deptLabel(d.name)}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: C.red }}>{d.negativeDominance}%</span>
              </div>
              <Bar pct={d.negativeDominance} color={C.red} />
            </div>
          ))}
        </>
      )}

      {/* 4 — Root Resource Matrix */}
      {tab === "chain" && c.resource && (
        <>
          <div style={sectionLabel}>4 · Root Resource Matrix</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {(["Physical", "Emotional", "Rational"] as const).map(dim => (
              <Stat key={dim} label={`${dim} deficit`} value={`${c.resource!.dimensionDeficits[dim]}`} color={levelColor[c.resource!.dimensionLevels[dim]] ?? C.text} />
            ))}
          </div>
          <div style={{ ...line, marginTop: 8 }}>Strongest depleted root: <b style={{ color: C.cyan }}>{c.resource.strongestRoot}</b> · most affected: {c.resource.mostAffectedDepartments.map(deptLabel).join(", ")}</div>
        </>
      )}

      {/* 5 — Energy Leakage */}
      {tab === "chain" && c.leakage && (
        <>
          <div style={sectionLabel}>5 · Energy Leakage</div>
          <div style={{ ...card, borderRight: `3px solid ${C.red}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 700, marginBottom: 6 }}>
              <span>total leakage</span>
              <span style={{ color: riskColor[c.leakage.leakageLevel === "high" ? "high" : c.leakage.leakageLevel === "critical" ? "critical" : "medium"] }}>{c.leakage.totalLeakage} / 100 · {c.leakage.leakageLevel}</span>
            </div>
            <Bar pct={c.leakage.totalLeakage} color={c.leakage.leakageLevel === "critical" ? C.red : C.orange} />
            <div style={metaTxt}>strongest: <b style={{ color: C.text }}>{deptLabel(c.leakage.strongestLeakingDepartment)}</b> · cell <b style={{ color: C.text }}>{deptLabel(c.leakage.strongestLeakingCell.department)}·{c.leakage.strongestLeakingCell.channel}</b></div>
            <div style={metaTxt}>attention drain {c.leakage.attentionDrain} · mission pressure {Math.round(c.leakage.missionPressure * 100)}% · load ×{c.leakage.personalLoadFactor.toFixed(2)}</div>
          </div>
        </>
      )}

      {/* Value Network — the people behind the flow (between leakage & load) */}
      {tab === "community" && c.load && (
        <>
          <div style={sectionLabel}>Value Network · capacity</div>
          <div style={{ fontSize: 10.5, color: C.borderSoft, lineHeight: 1.8, marginBottom: 8 }}>
            Noa → Shared Values → Value Network → Helpers → Load Distribution
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
            {SHARED_VALUES.map(v => (
              <span key={v} style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, background: C.bg, border: `1px solid ${C.purple}55`, color: C.purple }}>{v}</span>
            ))}
          </div>
          {c.load.helpers.map(h => (
            <div key={h.role} style={{ ...card, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{h.name}</span>
              <span style={{ fontSize: 11, color: C.purple }}>{ROLE_VALUE[h.role] ?? "—"}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.cyan, background: "#0a2a4a", borderRadius: 10, padding: "2px 8px" }}>{h.allocated}</span>
            </div>
          ))}
          <div style={{ ...line, marginTop: 4 }}>Total network capacity = <b style={{ color: C.cyan }}>{c.load.distributedLoad}</b></div>
          <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6, marginTop: 8 }}>
            The Value Network transforms a private burden into a shared responsibility by connecting people through common values.
          </div>
        </>
      )}

      {/* Value Network Offers — concrete offers + local support request */}
      {tab === "community" && c.load && (
        <>
          <div style={sectionLabel}>Value Network Offers</div>
          {c.load.helpers.map(h => {
            const od = OFFER_DATA[h.role];
            if (!od) return null;
            const done = requested.has(h.role);
            return (
              <div key={h.role} style={{ ...card, marginBottom: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{h.name} <span style={{ fontSize: 10, color: C.borderSoft }}>· {od.roleLabel}</span></span>
                  <span style={{ fontSize: 11, color: C.purple }}>{ROLE_VALUE[h.role] ?? "—"}</span>
                </div>
                <ul style={{ margin: "4px 0 8px", paddingInlineStart: 16, fontSize: 11.5, color: C.text, lineHeight: 1.6 }}>
                  {od.offers.map(o => <li key={o}>{o}</li>)}
                </ul>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 10, color: C.borderSoft }}>load handled <b style={{ color: C.cyan }}>{h.allocated}</b> · trust: {od.trust}</span>
                  {done ? (
                    <span style={{ fontSize: 11, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>✓ Request created</span>
                  ) : (
                    <button onClick={() => requestSupport(h.role)} style={{ padding: "5px 11px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600, border: `1px solid ${C.green}`, background: "#34d39922", color: C.green, whiteSpace: "nowrap" }}>Request Support</button>
                  )}
                </div>
              </div>
            );
          })}
        </>
      )}

      {/* Support Request Summary — measurable view of the activated network */}
      {tab === "requests" && c.load && (
        <>
          <div style={sectionLabel}>Support Request Summary</div>
          <div style={{ ...card, marginBottom: 8 }}>
            <div style={line}>Requests: <b>{queueItems.length}</b></div>
            <div style={line}>Total requested load: <b style={{ color: C.cyan }}>{requestedLoad}</b> / {networkCapacity}</div>
            <div style={line}>Values covered: <span style={{ color: C.purple }}>{valuesCovered}</span></div>
            <div style={line}>Roles activated: {rolesActivated}</div>
            <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${networkCapacity ? (requestedLoad / networkCapacity) * 100 : 0}%`, background: C.cyan }} />
            </div>
          </div>
        </>
      )}

      {/* Requested Impact Preview — operational effect of the selected requests */}
      {tab === "requests" && c.load && (
        <>
          <div style={sectionLabel}>Requested Impact Preview</div>
          <div style={{ ...card, borderRight: `3px solid ${C.cyan}`, marginBottom: 8 }}>
            <div style={line}>Load covered: <b style={{ color: C.cyan }}>{requestedLoad}</b> / {networkCapacity}</div>
            <div style={line}>Energy support: <b style={{ color: energySupport === "none" ? C.borderSoft : C.green }}>{energySupport}</b></div>
            <div style={line}>Values activated: <span style={{ color: C.purple }}>{valuesCovered}</span></div>
            <div style={line}>Main dimension supported: <b>{dimsActivated}</b></div>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>{impactNote}</div>
          </div>
        </>
      )}

      {/* Fulfillment Progress — request created → support fulfilled */}
      {tab === "requests" && c.load && (
        <>
          <div style={sectionLabel}>Fulfillment Progress</div>
          <div style={{ ...card, borderRight: `3px solid ${C.green}`, marginBottom: 8 }}>
            <div style={line}>Fulfilled: <b style={{ color: C.green }}>{fulfilledCount}</b> / {queueItems.length}</div>
            <div style={line}>Fulfilled load: <b style={{ color: C.green }}>{fulfilledLoad}</b> / {networkCapacity}</div>
            <div style={line}>Pending load: <b style={{ color: C.yellow }}>{pendingLoad}</b></div>
            <div style={line}>Fulfilled values: <span style={{ color: C.purple }}>{fulfilledValues}</span></div>
            <div style={{ height: 6, borderRadius: 3, background: C.border, overflow: "hidden", marginTop: 8 }}>
              <div style={{ height: "100%", borderRadius: 3, width: `${networkCapacity ? (fulfilledLoad / networkCapacity) * 100 : 0}%`, background: C.green }} />
            </div>
          </div>
        </>
      )}

      {/* Support Outcome Summary — what fulfilled support has achieved */}
      {tab === "requests" && c.load && (
        <>
          <div style={sectionLabel}>Support Outcome Summary</div>
          <div style={{ ...card, borderRight: `3px solid ${C.green}`, marginBottom: 8 }}>
            <div style={line}>Fulfilled load: <b style={{ color: C.green }}>{fulfilledLoad}</b> / {networkCapacity}</div>
            <div style={line}>Remaining requested load: <b style={{ color: C.yellow }}>{pendingLoad}</b></div>
            <div style={line}>Fulfilled values: <span style={{ color: C.purple }}>{fulfilledValues}</span></div>
            <div style={line}>Active dimensions: <b>{fulfilledDims}</b></div>
            <div style={line}>Operational status: <b style={{ color: fulfilledCount === 0 ? C.borderSoft : C.green }}>{operationalStatus}</b></div>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6, marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border}` }}>Fulfilled support converts requested help into active load handling.</div>
          </div>
        </>
      )}

      {/* Support Request Queue — visible workflow from the local request state */}
      {tab === "requests" && c.load && (
        <>
          <div style={sectionLabel}>Support Request Queue {queueItems.length > 0 ? `(${queueItems.length})` : ""}</div>
          {queueItems.length === 0 ? (
            <div style={{ fontSize: 11.5, color: C.borderSoft, padding: "8px 0" }}>No support requests yet.</div>
          ) : (
            queueItems.map(h => {
              const od = OFFER_DATA[h.role];
              const isFulfilled = fulfilled.has(h.role);
              return (
                <div key={h.role} style={{ ...card, borderRight: `3px solid ${isFulfilled ? C.green : C.yellow}`, marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{h.name} <span style={{ fontSize: 10, color: C.borderSoft }}>· {od?.roleLabel}</span></span>
                    <span style={{ fontSize: 11, color: C.purple }}>{ROLE_VALUE[h.role] ?? "—"}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.6 }}>Request: {od?.offers.join(", ")}</div>
                  <div style={{ fontSize: 10, color: C.borderSoft, marginTop: 5, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                    <span>load handled <b style={{ color: C.cyan }}>{h.allocated}</b></span>
                    {isFulfilled ? (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green, whiteSpace: "nowrap" }}>✓ fulfilled demo support</span>
                    ) : (
                      <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ color: C.yellow, whiteSpace: "nowrap" }}>pending demo request</span>
                        <button onClick={() => markFulfilled(h.role)} style={{ padding: "4px 9px", borderRadius: 4, fontSize: 10, cursor: "pointer", fontWeight: 600, border: `1px solid ${C.green}`, background: "#34d39922", color: C.green, whiteSpace: "nowrap" }}>Mark as fulfilled</button>
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </>
      )}

      {/* 6 — Harmonic Flow */}
      {tab === "chain" && c.flow && (
        <>
          <div style={sectionLabel}>6 · Harmonic Flow — resources → 3 dimensions</div>
          {c.flow.dimensions.map(d => (
            <div key={d.dimension} style={{ ...card, marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                <span>{d.dimension}</span>
                <span>{d.deficitBefore} → <b style={{ color: C.green }}>{d.deficitAfter}</b></span>
              </div>
              <Bar pct={d.coveragePct} color={`linear-gradient(90deg,${C.cyan},${C.green})` as unknown as string} />
              <div style={metaTxt}>inflow <span style={{ color: C.green }}>+{d.inflow}</span> · coverage {d.coveragePct}%</div>
            </div>
          ))}
          <div style={{ ...sectionLabel, margin: "10px 0 6px" }}>department rebalance</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            {c.flow.departments.map(d => (
              <div key={d.department} style={{ ...card, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span>{deptLabel(d.department)}</span>
                <span>{d.dominanceBefore} → <b style={{ color: C.green }}>{d.dominanceAfter}</b></span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 7 — Load Distribution + 8 — Energy Recovery */}
      {tab === "chain" && c.load && (
        <>
          <div style={sectionLabel}>7 · Load Distribution + 8 · Energy Recovery</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
            <div style={{ ...card, borderRight: `3px solid ${C.red}` }}>
              <div style={{ fontSize: 9, color: C.borderSoft, textTransform: "uppercase", marginBottom: 5 }}>Before</div>
              <div style={line}>נועה <b>{c.load.beforePct}%</b></div>
              <div style={line}>אנרגיה <b>{c.load.beforeEnergy}</b></div>
              <div style={line}>סיכון: <span style={{ color: riskColor[c.load.collapseRiskBefore], fontWeight: 700 }}>{riskHe(c.load.collapseRiskBefore)}</span></div>
            </div>
            <div style={{ ...card, borderRight: `3px solid ${C.green}` }}>
              <div style={{ fontSize: 9, color: C.borderSoft, textTransform: "uppercase", marginBottom: 5 }}>After</div>
              <div style={line}>נועה <b>{c.load.afterPct}%</b> · קהילה <b>{c.load.communityPct}%</b></div>
              <div style={line}>אנרגיה <span style={{ color: C.green, fontWeight: 700 }}>+{c.load.energyRecovered}</span> → <b>{c.load.afterEnergy}</b></div>
              <div style={line}>סיכון: <span style={{ color: riskColor[c.load.collapseRiskAfter], fontWeight: 700 }}>{riskHe(c.load.collapseRiskAfter)}</span></div>
            </div>
          </div>
          {c.load.helpers.map(h => (
            <div key={h.role} style={{ ...card, display: "grid", gridTemplateColumns: "1fr auto auto", gap: 10, alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 500 }}>{h.name}</span>
              <span style={{ fontSize: 11, color: C.borderSoft }}>{h.loadType}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.green, background: "#0c2a1e", borderRadius: 10, padding: "2px 8px" }}>{h.allocated}</span>
            </div>
          ))}
        </>
      )}

      {/* 9 — Orientation Score */}
      {(tab === "overview" || tab === "chain") && c.orientation && (
        <>
          <div style={sectionLabel}>9 · Orientation Score</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 34, fontWeight: 800, color: levelColor[c.orientation.level] ?? C.text }}>{c.orientation.score}</span>
            <span style={{ fontSize: 12, color: C.borderSoft }}>/ 100</span>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: levelColor[c.orientation.level] ?? C.text, border: "1px solid currentColor", borderRadius: 10, padding: "2px 8px" }}>{c.orientation.level}</span>
          </div>
          {[
            ["Balance gain", c.orientation.balanceGain],
            ["Energy recovery", c.orientation.energyRecovery],
            ["Collective distribution", c.orientation.collectiveDistribution],
            ["Leakage relief", c.orientation.leakageRelief],
          ].map(([label, v]) => (
            <div key={label as string} style={{ marginBottom: 7 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.borderSoft, marginBottom: 3 }}><span>{label}</span><span>{v}</span></div>
              <Bar pct={v as number} color={`linear-gradient(90deg,${C.cyan},${C.green})` as unknown as string} />
            </div>
          ))}
          <div style={{ ...line, marginTop: 6 }}>Strongest remaining deficit: <b style={{ color: C.cyan }}>{c.orientation.strongestRemainingDeficit.dimension}</b> ({c.orientation.strongestRemainingDeficit.deficit})</div>

          {/* Meaning — 45/Medium is not failure */}
          <div style={{ marginTop: 10, padding: "10px 12px", background: C.bg, border: `1px solid ${C.border}`, borderRight: `3px solid ${C.yellow}`, borderRadius: 6 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.yellow }}>{score} = {band.label}</div>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.7, marginTop: 6 }}>
              {score}/100 does not mean full recovery. It means first stabilization.<br />
              <b style={{ color: C.red }}>Before Nexus:</b> Noa was in critical collapse pressure.<br />
              <b style={{ color: C.green }}>After Nexus:</b> the burden is partly distributed, energy returns, and the system moves from collapse toward balance.<br />
              <span style={{ color: C.borderSoft }}>This is not the end state — it is the first successful intervention.</span>
            </div>
          </div>

          {/* Interpretation scale */}
          <div style={{ ...sectionLabel, margin: "12px 0 6px" }}>score interpretation</div>
          {SCORE_BANDS.map((b, i) => {
            const cur = i === bandIndex(score);
            return (
              <div key={b.range} style={{
                display: "flex", justifyContent: "space-between", fontSize: 11.5,
                padding: "6px 10px", borderRadius: 6, marginBottom: 4,
                background: cur ? "#fbbf2418" : C.bg,
                border: `1px solid ${cur ? C.yellow : C.border}`,
                color: cur ? C.text : C.borderSoft, fontWeight: cur ? 700 : 400,
              }}>
                <span>{b.range}</span><span>{b.label}{cur ? " ← Noa" : ""}</span>
              </div>
            );
          })}
        </>
      )}

      {/* Tension Flow — methodology as a flow model, not a linear ladder */}
      {(tab === "overview" || tab === "chain") && (
        <>
          <div style={sectionLabel}>Tension Flow</div>
          <div style={{ ...card, marginBottom: 8 }}>
            <div style={{ fontSize: 11.5, color: C.text, lineHeight: 1.7, marginBottom: 8, paddingBottom: 8, borderBottom: `1px solid ${C.border}` }}>
              Philos does not move a person through a simple ladder. It follows where tension appears, where attention is pulled, where energy leaks, and which value network can redistribute the load.
            </div>
            <div style={{ fontSize: 10, color: C.borderSoft, marginBottom: 10 }}>The question is not &quot;what is the next stage?&quot; — it is &quot;where is the resistance?&quot;</div>
            {tensionFlow.map((s, i) => (
              <div key={s.label} style={{ display: "flex", gap: 10 }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, marginTop: 4, background: flowPhaseColor(i) }} />
                  {i < tensionFlow.length - 1 && <span style={{ width: 2, flex: 1, minHeight: 10, background: C.border }} />}
                </div>
                <div style={{ paddingBottom: i < tensionFlow.length - 1 ? 8 : 0 }}>
                  <div style={{ fontSize: 9, color: C.borderSoft, textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                  <div style={{ fontSize: 12, color: C.text, lineHeight: 1.4 }}>{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* 10 — Action → Impact → Collective Impact */}
      {(tab === "overview" || tab === "chain") && c.action && (
        <>
          <div style={sectionLabel}>10 · Action → Impact → Collective Impact</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 20, fontWeight: 800, color: C.green, textTransform: "capitalize" }}>{c.action.recommendedAction}</span>
            <span style={{ fontSize: 11, color: C.borderSoft }}>→ {c.action.targetDimension} / {c.action.targetDepartment}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Stat label="energy gain" value={`+${c.action.expectedEnergyGain}`} color={C.green} />
            <Stat label="load reduction" value={`−${c.action.expectedLoadReduction}`} color={C.green} />
            <Stat label="orientation gain" value={`+${c.action.expectedOrientationGain}`} color={C.green} />
            <Stat label="collective impact" value={`${c.action.collectiveImpact}`} color={C.cyan} />
          </div>
          <div style={{ ...metaTxt, marginTop: 8, lineHeight: 1.6 }}>{c.action.actionReason}</div>
        </>
      )}

      {/* 11 — Copy Snapshot */}
      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "center" }}>
        <button onClick={copy} style={{ padding: "6px 12px", borderRadius: 4, fontSize: 11, cursor: "pointer", fontWeight: 600, border: `1px solid ${C.cyan}`, background: "#38bdf822", color: C.cyan }}>⧉ Copy Snapshot</button>
        {copied && <span style={{ fontSize: 11, color: C.green }}>הועתק ✓</span>}
      </div>
    </div>
  );
}

function Cells({ dept, cells, strong }: { dept: string; cells: ReturnType<typeof computeNoaChain>["attention"]["cells"]; strong: ReturnType<typeof computeNoaChain>["attention"]["strongest"] }) {
  const byCh = (ch: string) => cells.find(x => x.department === dept && x.channel === ch)!;
  return (
    <>
      <div style={{ fontSize: 11, color: C.text, display: "flex", alignItems: "center" }}>{deptLabel(dept)}</div>
      {["Body", "Emotion", "Mind"].map(ch => {
        const cell = byCh(ch);
        const isStrong = cell.department === strong.department && cell.channel === strong.channel;
        return (
          <div key={ch} style={{
            fontSize: 12, fontWeight: 600, textAlign: "center", padding: "7px 0", borderRadius: 6,
            border: `1px solid ${C.border}`, background: `rgba(239,68,68,${(cell.dominance / 100) * 0.45})`,
            outline: isStrong ? `2px solid ${C.red}` : "none", outlineOffset: -2,
          }}>{cell.dominance}</div>
        );
      })}
    </>
  );
}

function legacyCopy(text: string): boolean {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
