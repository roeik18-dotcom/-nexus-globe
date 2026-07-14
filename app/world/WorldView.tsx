"use client";

import { useState, useRef, useEffect } from "react";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";
import type { Capability } from "@/app/lib/capability/schema";
import type { ValueCapabilityRelation } from "@/app/lib/value-capability-relation/schema";
import type { Provider } from "@/app/lib/provider/schema";
import type { ProviderCapabilityRelation } from "@/app/lib/provider-capability-relation/schema";

const VALUES = [
  { id: "knowledge",   label: "Knowledge",   angle: 0   },
  { id: "trust",       label: "Trust",       angle: 30  },
  { id: "health",      label: "Health",      angle: 60  },
  { id: "capital",     label: "Capital",     angle: 90  },
  { id: "justice",     label: "Justice",     angle: 120 },
  { id: "creativity",  label: "Creativity",  angle: 150 },
  { id: "community",   label: "Community",   angle: 180 },
  { id: "growth",      label: "Growth",      angle: 210 },
  { id: "learning",    label: "Learning",    angle: 240 },
  { id: "security",    label: "Security",    angle: 270 },
  { id: "execution",   label: "Execution",   angle: 300 },
  { id: "care",        label: "Care",        angle: 330 },
];

const DOMAINS = [
  { label: "Education",      valueId: "knowledge"  },
  { label: "Media",          valueId: "knowledge"  },
  { label: "Research",       valueId: "learning"   },
  { label: "Academia",       valueId: "learning"   },
  { label: "Finance",        valueId: "capital"    },
  { label: "Investment",     valueId: "capital"    },
  { label: "Healthcare",     valueId: "health"     },
  { label: "Wellness",       valueId: "health"     },
  { label: "Legal",          valueId: "justice"    },
  { label: "Policy",         valueId: "justice"    },
  { label: "Security",       valueId: "security"   },
  { label: "Infrastructure", valueId: "security"   },
  { label: "Design",         valueId: "creativity" },
  { label: "Arts",           valueId: "creativity" },
  { label: "Social Impact",  valueId: "community"  },
  { label: "Civic",          valueId: "community"  },
  { label: "Startups",       valueId: "growth"     },
  { label: "Commerce",       valueId: "growth"     },
  { label: "Operations",     valueId: "execution"  },
  { label: "Engineering",    valueId: "execution"  },
  { label: "Networks",       valueId: "trust"      },
  { label: "Governance",     valueId: "trust"      },
  { label: "Caregiving",     valueId: "care"       },
  { label: "Support",        valueId: "care"       },
];

const USERS = [
  { label: "Founder",         values: ["growth", "execution", "capital"]      },
  { label: "Researcher",      values: ["knowledge", "learning", "trust"]      },
  { label: "Policy Maker",    values: ["justice", "community", "security"]    },
  { label: "Investor",        values: ["capital", "growth", "trust"]          },
  { label: "Doctor",          values: ["health", "care", "knowledge"]         },
  { label: "Educator",        values: ["knowledge", "learning", "community"]  },
  { label: "Artist",          values: ["creativity", "community", "trust"]    },
  { label: "Engineer",        values: ["execution", "knowledge", "growth"]    },
  { label: "Activist",        values: ["justice", "community", "care"]        },
  { label: "Entrepreneur",    values: ["growth", "creativity", "execution"]   },
  { label: "Caregiver",       values: ["care", "health", "community"]         },
  { label: "Analyst",         values: ["knowledge", "trust", "capital"]       },
  { label: "Designer",        values: ["creativity", "execution", "community"]},
  { label: "Journalist",      values: ["knowledge", "trust", "justice"]       },
  { label: "Scientist",       values: ["knowledge", "learning", "health"]     },
];


const CX = 500;
const CY = 480;
const VALUE_R  = 195;
const CAP_R    = 242;
const DOMAIN_R = 295;
const PROV_R   = 348;
const USER_R   = 395;
const CORE_R   = 65;

const VALUE_COLOR: Record<string, string> = {
  knowledge:  "#5B8CFF",
  trust:      "#2DA890",
  health:     "#4ADE80",
  capital:    "#FFB84D",
  justice:    "#A371F7",
  creativity: "#F472B6",
  community:  "#22D3EE",
  growth:     "#34D399",
  learning:   "#60A5FA",
  security:   "#F87171",
  execution:  "#FBBF24",
  care:       "#E879F9",
};

function degToRad(deg: number): number {
  return (deg - 90) * (Math.PI / 180);
}

function polar(r: number, angleDeg: number): { x: number; y: number } {
  const rad = degToRad(angleDeg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

type CascadeStep = 0 | 1 | 2 | 3 | 4;


interface Props {
  missions: Mission[];
  gaps: Gap[];
  values: Value[];
  capabilities: Capability[];
  vcRelations: ValueCapabilityRelation[];
  providers: Provider[];
  pcRelations: ProviderCapabilityRelation[];
}

export default function WorldView({
  missions,
  gaps,
  values,
  capabilities,
  vcRelations,
  providers,
  pcRelations,
}: Props) {
  const [selectedMissionId, setSelectedMissionId] = useState<string>(missions[0]?.id ?? "");
  const [cascadeStep, setCascadeStep] = useState<CascadeStep>(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = mq.matches;
    setReducedMotion(mq.matches);
    const listener = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      setReducedMotion(e.matches);
    };
    mq.addEventListener("change", listener);
    return () => mq.removeEventListener("change", listener);
  }, []);

  useEffect(() => {
    if (missions.length === 0) return;
    if (reducedMotionRef.current) {
      setCascadeStep(4);
    } else {
      setCascadeStep(1);
      const t2 = setTimeout(() => setCascadeStep(2), 300);
      const t3 = setTimeout(() => setCascadeStep(3), 700);
      const t4 = setTimeout(() => setCascadeStep(4), 1400);
      timers.current = [t2, t3, t4];
    }
    return () => { timers.current.forEach(clearTimeout); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startCascade(missionId: string) {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setSelectedMissionId(missionId);
    if (reducedMotionRef.current) {
      setCascadeStep(4);
      return;
    }
    setCascadeStep(1);
    const t2 = setTimeout(() => setCascadeStep(2), 300);
    const t3 = setTimeout(() => setCascadeStep(3), 700);
    const t4 = setTimeout(() => setCascadeStep(4), 1400);
    timers.current = [t2, t3, t4];
  }

  // ─── Static node positions ────────────────────────────────────────────────────

  const valueNodes = VALUES.map(v => ({ ...v, ...polar(VALUE_R, v.angle) }));
  const valueMap   = new Map(valueNodes.map(v => [v.id, v]));

  const domainNodes = DOMAINS.map((d, i) => {
    const sameGroup  = DOMAINS.filter(x => x.valueId === d.valueId);
    const idx        = sameGroup.indexOf(d);
    const parentV    = VALUES.find(v => v.id === d.valueId)!;
    const offsetAngle = parentV.angle + (idx === 0 ? -14 : 14);
    return { ...d, i, ...polar(DOMAIN_R, offsetAngle) };
  });

  const userNodes = USERS.map((u, i) => ({
    ...u, i, ...polar(USER_R, (i / USERS.length) * 360),
  }));

  // Primary value per capability — first VCR match determines color + sort angle
  const capPrimaryValId = new Map<string, string>();
  for (const vcr of vcRelations) {
    if (!capPrimaryValId.has(vcr.capabilityId)) capPrimaryValId.set(vcr.capabilityId, vcr.valueId);
  }

  const sortedCaps = [...capabilities].sort((a, b) => {
    const aAngle = VALUES.find(v => v.id === capPrimaryValId.get(a.id))?.angle ?? 180;
    const bAngle = VALUES.find(v => v.id === capPrimaryValId.get(b.id))?.angle ?? 180;
    return aAngle - bAngle;
  });
  const capNodes = sortedCaps.map((cap, i) => ({
    ...cap, ...polar(CAP_R, (i / sortedCaps.length) * 360),
  }));
  const capMap = new Map(capNodes.map(c => [c.id, c]));

  // Primary value per provider — via first PCR → capPrimaryValId chain
  const provPrimaryValId = new Map<string, string>();
  for (const pcr of pcRelations) {
    if (!provPrimaryValId.has(pcr.providerId)) {
      const vid = capPrimaryValId.get(pcr.capabilityId);
      if (vid) provPrimaryValId.set(pcr.providerId, vid);
    }
  }

  const sortedProvs = [...providers].sort((a, b) => {
    const aAngle = VALUES.find(v => v.id === provPrimaryValId.get(a.id))?.angle ?? 180;
    const bAngle = VALUES.find(v => v.id === provPrimaryValId.get(b.id))?.angle ?? 180;
    return aAngle - bAngle;
  });
  const provNodes = sortedProvs.map((prov, i) => ({
    ...prov, ...polar(PROV_R, (i / sortedProvs.length) * 360),
  }));
  const provMap = new Map(provNodes.map(p => [p.id, p]));

  // ─── Mission-scoped active sets ───────────────────────────────────────────────

  const selectedMission = missions.find(m => m.id === selectedMissionId) ?? missions[0];

  // Correct PUDM chain: Mission.gaps → Gap.requiredValues → Value
  // Gap is the authoritative source of required values — Mission holds only GapRef pointers
  const gapById = new Map(gaps.map(g => [g.id, g]));
  const activeValueIds = new Set<string>(
    (selectedMission?.gaps ?? [])
      .flatMap(ref => gapById.get(ref.gapId)?.requiredValues ?? [])
      .map(r => r.valueId)
  );
  const activeCapIds = new Set<string>(
    vcRelations.filter(r => activeValueIds.has(r.valueId)).map(r => r.capabilityId)
  );
  const activeProvIds = new Set<string>(
    pcRelations.filter(r => activeCapIds.has(r.capabilityId)).map(r => r.providerId)
  );

  // All-missions live value set — preserved base layer, also via Gap chain
  const allLiveValueIds = new Set<string>(
    missions
      .flatMap(m => (m.gaps ?? []))
      .flatMap(ref => gapById.get(ref.gapId)?.requiredValues ?? [])
      .map(r => r.valueId)
  );

  // Active cascade edges
  const cascadeVcrs = vcRelations.filter(
    r => activeValueIds.has(r.valueId) && activeCapIds.has(r.capabilityId)
  );
  const cascadePcrs = pcRelations.filter(
    r => activeCapIds.has(r.capabilityId) && activeProvIds.has(r.providerId)
  );

  // ─── Opacity helpers ──────────────────────────────────────────────────────────

  function valueStrokeOpacity(vId: string): number {
    if (cascadeStep < 2) return 0.6;
    return activeValueIds.has(vId) ? 1 : 0.12;
  }

  function valueLabelOpacity(vId: string): number {
    if (cascadeStep < 2) return 0.85;
    return activeValueIds.has(vId) ? 1 : 0.25;
  }

  function capGroupOpacity(capId: string): number {
    if (cascadeStep === 0) return 0.18;
    if (cascadeStep < 3)   return 0.22;
    return activeCapIds.has(capId) ? 1 : 0.1;
  }

  function provGroupOpacity(provId: string): number {
    if (cascadeStep === 0) return 0.12;
    if (cascadeStep < 4)   return 0.18;
    return activeProvIds.has(provId) ? 1 : 0.07;
  }

  // ─── UI helpers ───────────────────────────────────────────────────────────────

  function missionLabel(m: Mission): string {
    return (
      m.context.domain ??
      m.id.replace(/^mission_/, "").replace(/_\d+$/, "").replace(/_/g, " ")
    );
  }

  const cascadeStatusText = [
    "── IDLE ──",
    "── CORE ACTIVATED ──",
    `── VALUES: ${activeValueIds.size} active ──`,
    `── CAPABILITIES: ${activeCapIds.size} reachable ──`,
    `── PROVIDERS: ${activeProvIds.size} reachable ──`,
  ][cascadeStep];

  // ─── Live Decision Engine — Insights ────────────────────────────────────────

  const STAGE_NAMES = ["Idle", "Core Activated", "Values Lit", "Capabilities Lit", "Providers Reached"];

  // Dominant value: which value appears across the most gaps for this mission
  const valGapCount = new Map<string, number>();
  (selectedMission?.gaps ?? []).forEach(ref => {
    const gap = gapById.get(ref.gapId);
    (gap?.requiredValues ?? []).forEach(rv => {
      valGapCount.set(rv.valueId, (valGapCount.get(rv.valueId) ?? 0) + 1);
    });
  });
  const dominantValId = [...valGapCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const dominantVal   = VALUES.find(v => v.id === dominantValId) ?? null;

  // Most connected active value: highest number of VCR edges
  const valVcrCount = new Map<string, number>();
  for (const vcr of vcRelations) {
    if (activeValueIds.has(vcr.valueId)) {
      valVcrCount.set(vcr.valueId, (valVcrCount.get(vcr.valueId) ?? 0) + 1);
    }
  }
  const topConnectedValId    = [...valVcrCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  const topConnectedVal      = VALUES.find(v => v.id === topConnectedValId) ?? null;
  const topConnectedVcrCount = topConnectedValId ? (valVcrCount.get(topConnectedValId) ?? 0) : 0;

  // Coverage: active capabilities with at least one provider in PCR
  const capsWithProvider  = new Set(pcRelations.map(r => r.capabilityId));
  const coveredCapCount   = [...activeCapIds].filter(id => capsWithProvider.has(id)).length;
  const uncoveredCapCount = activeCapIds.size - coveredCapCount;
  const coveragePct       = activeCapIds.size > 0 ? Math.round((coveredCapCount / activeCapIds.size) * 100) : 0;

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#020d1a",
        color: "#cfe6f5",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding: "32px 16px 80px",
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Header */}
        <header style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
              <span style={{
                display: "inline-block",
                background: "rgba(255,107,107,0.10)",
                border: "1px solid rgba(255,107,107,0.22)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#ff6b6b",
              }}>Potential Map</span>
              <span style={{
                display: "inline-block",
                background: "rgba(52,211,153,0.10)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#34D399",
              }}>Live · {missions.length}M {gaps.length}G {values.length}V {capabilities.length}C {providers.length}P</span>
              <span style={{
                display: "inline-block",
                background: "rgba(164,113,247,0.10)",
                border: "1px solid rgba(164,113,247,0.22)",
                borderRadius: 4, padding: "2px 9px",
                fontSize: 10, fontWeight: 700, letterSpacing: "1.5px",
                textTransform: "uppercase" as const, color: "#A371F7",
              }}>Live PUDM Cascade</span>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.3px", color: "#e0f0ff", marginBottom: 6 }}>
              Living World
            </h1>
            <p style={{ fontSize: 12.5, color: "#3a5a78", maxWidth: 500, lineHeight: 1.65 }}>
              Potential layer (dashed) shows the architecture&apos;s design space.
              Cascade layer (solid) animates the full Value → Capability → Provider chain for a real mission.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/lab" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← Lab</a>
            <a href="/" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← App</a>
          </div>
        </header>

        {/* Mission selector */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 8 }}>
            Select Mission — cascade replays on each click
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missions.map(m => {
              const isActive = m.id === selectedMissionId;
              return (
                <button
                  key={m.id}
                  onClick={() => startCascade(m.id)}
                  style={{
                    fontSize: 11, padding: "5px 12px", borderRadius: 4,
                    cursor: "pointer", fontWeight: isActive ? 700 : 400,
                    background: isActive ? "#A371F7" : "transparent",
                    color: isActive ? "#fff" : "#2a4a6a",
                    border: `1px solid ${isActive ? "#A371F7" : "#0c2040"}`,
                    fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                    transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
                  }}
                >
                  {missionLabel(m)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Cascade disclaimer */}
        <div style={{
          background: "rgba(164,113,247,0.05)",
          border: "1px solid rgba(164,113,247,0.15)",
          borderRadius: 5, padding: "9px 14px", marginBottom: 14,
          fontSize: 11, color: "#6a4a8a", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#A371F7" }}>Live Reference Cascade</strong> — repository-backed, not observed flow.
          &nbsp;·&nbsp;
          Since{" "}
          <code style={{ fontSize: 10, color: "#7a5aaa", background: "rgba(164,113,247,0.1)", padding: "1px 4px", borderRadius: 2 }}>
            required_for
          </code>{" "}
          relations don&apos;t exist yet, this animation shows taxonomic cascade (what can address these values in general), not contextual matching (what is required for this specific mission).
        </div>

        {/* Caveat */}
        <div style={{
          background: "rgba(255,184,77,0.06)",
          border: "1px solid rgba(255,184,77,0.18)",
          borderRadius: 5, padding: "9px 14px", marginBottom: 28,
          fontSize: 11.5, color: "#9a7030", lineHeight: 1.6,
        }}>
          <strong style={{ color: "#FFB84D" }}>Potential Layer</strong> — dashed lines show the architecture&apos;s full design space.
          &nbsp;·&nbsp;
          <strong style={{ color: "#34D399" }}>Live Reference Layer</strong> — solid lines show values referenced by real records. Not observed flow.
        </div>

        <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>

          {/* SVG World */}
          <div style={{ flex: "1 1 600px", minWidth: 320 }}>
            <svg
              viewBox="0 0 1000 960"
              width="100%"
              style={{ display: "block", overflow: "visible" }}
              aria-label="Philos Living World — potential relationships, live value references, and PUDM cascade diagram"
            >
              <defs>
                {VALUES.map(v => (
                  <radialGradient key={v.id} id={`vg-${v.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={VALUE_COLOR[v.id]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={VALUE_COLOR[v.id]} stopOpacity={0} />
                  </radialGradient>
                ))}
                <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#5B8CFF" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#5B8CFF" stopOpacity={0} />
                </radialGradient>
                <radialGradient id="core-pulse" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#A371F7" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#A371F7" stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* Ring guides */}
              <circle cx={CX} cy={CY} r={VALUE_R}  fill="none" stroke="#0a1e30" strokeWidth={1} strokeDasharray="3 6" />
              <circle cx={CX} cy={CY} r={CAP_R}    fill="none" stroke="#0c2238" strokeWidth={1} strokeDasharray="2 8" />
              <circle cx={CX} cy={CY} r={DOMAIN_R} fill="none" stroke="#081828" strokeWidth={1} strokeDasharray="3 8" />
              <circle cx={CX} cy={CY} r={PROV_R}   fill="none" stroke="#0a1a2a" strokeWidth={1} strokeDasharray="2 10" />
              <circle cx={CX} cy={CY} r={USER_R}   fill="none" stroke="#060f1e" strokeWidth={1} strokeDasharray="3 10" />

              {/* ── POTENTIAL LAYER ────────────────────────────────────────── */}

              {/* User → Value potential connections */}
              {userNodes.map(u =>
                u.values.map(vid => {
                  const vn = valueMap.get(vid);
                  if (!vn) return null;
                  return (
                    <line
                      key={`u-${u.i}-${vid}`}
                      x1={u.x} y1={u.y} x2={vn.x} y2={vn.y}
                      stroke={VALUE_COLOR[vid]}
                      strokeWidth={0.6} strokeDasharray="3 5" strokeOpacity={0.18}
                    />
                  );
                })
              )}

              {/* Value → Domain potential connections */}
              {domainNodes.map(d => {
                const vn = valueMap.get(d.valueId);
                if (!vn) return null;
                return (
                  <line
                    key={`d-${d.i}`}
                    x1={vn.x} y1={vn.y} x2={d.x} y2={d.y}
                    stroke={VALUE_COLOR[d.valueId]}
                    strokeWidth={0.8} strokeDasharray="3 4" strokeOpacity={0.28}
                  />
                );
              })}

              {/* Core → Value potential connections */}
              {valueNodes.map(v => (
                <line
                  key={`cv-${v.id}`}
                  x1={CX} y1={CY} x2={v.x} y2={v.y}
                  stroke={VALUE_COLOR[v.id]}
                  strokeWidth={0.9} strokeDasharray="4 5" strokeOpacity={0.32}
                />
              ))}

              {/* Value glow halos */}
              {valueNodes.map(v => (
                <circle key={`vh-${v.id}`} cx={v.x} cy={v.y} r={28} fill={`url(#vg-${v.id})`} />
              ))}

              {/* ── ALL-MISSIONS LIVE REFERENCE LAYER ─────────────────────── */}

              {valueNodes.filter(v => allLiveValueIds.has(v.id)).map(v => (
                <line
                  key={`live-cv-${v.id}`}
                  x1={CX} y1={CY} x2={v.x} y2={v.y}
                  stroke={VALUE_COLOR[v.id]} strokeWidth={1.8} strokeOpacity={0.7}
                />
              ))}
              {valueNodes.filter(v => allLiveValueIds.has(v.id)).map(v => (
                <circle
                  key={`live-vring-${v.id}`}
                  cx={v.x} cy={v.y} r={17}
                  fill="none" stroke={VALUE_COLOR[v.id]} strokeWidth={1.5} strokeOpacity={0.55}
                />
              ))}

              {/* ── LIVE PUDM CASCADE LAYER ───────────────────────────────── */}

              {/* Step 2 — active core → value lines */}
              {valueNodes.map(v => (
                <line
                  key={`casc-cv-${v.id}`}
                  x1={CX} y1={CY} x2={v.x} y2={v.y}
                  stroke={VALUE_COLOR[v.id]} strokeWidth={2.8}
                  style={{
                    opacity: cascadeStep >= 2 && activeValueIds.has(v.id) ? 1 : 0,
                    transition: "opacity 0.35s ease",
                  }}
                />
              ))}

              {/* Step 2 — active value highlight rings */}
              {valueNodes.map(v => (
                <circle
                  key={`casc-vring-${v.id}`}
                  cx={v.x} cy={v.y} r={21}
                  fill="none" stroke={VALUE_COLOR[v.id]} strokeWidth={2.2}
                  style={{
                    opacity: cascadeStep >= 2 && activeValueIds.has(v.id) ? 0.85 : 0,
                    transition: "opacity 0.35s ease",
                  }}
                />
              ))}

              {/* Step 3 — VCR lines: active value → active capability */}
              {cascadeVcrs.map(r => {
                const vn = valueMap.get(r.valueId);
                const cn = capMap.get(r.capabilityId);
                if (!vn || !cn) return null;
                return (
                  <line
                    key={`casc-vc-${r.id}`}
                    x1={vn.x} y1={vn.y} x2={cn.x} y2={cn.y}
                    stroke={VALUE_COLOR[r.valueId]} strokeWidth={1.4}
                    style={{
                      opacity: cascadeStep >= 3 ? 0.65 : 0,
                      transition: "opacity 0.4s ease",
                    }}
                  />
                );
              })}

              {/* Capability nodes — all visible, active ones lit at step 3 */}
              {capNodes.map(cap => {
                const color   = VALUE_COLOR[capPrimaryValId.get(cap.id) ?? "knowledge"];
                const isActive = activeCapIds.has(cap.id);
                return (
                  <g
                    key={`cap-${cap.id}`}
                    style={{ opacity: capGroupOpacity(cap.id), transition: "opacity 0.4s ease" }}
                  >
                    <rect
                      x={cap.x - 5.5} y={cap.y - 5.5}
                      width={11} height={11}
                      transform={`rotate(45 ${cap.x} ${cap.y})`}
                      fill={color}
                      fillOpacity={isActive && cascadeStep >= 3 ? 0.22 : 0.07}
                      stroke={color}
                      strokeWidth={isActive && cascadeStep >= 3 ? 1.8 : 0.8}
                    />
                    {isActive && cascadeStep >= 3 && (
                      <text
                        x={cap.x} y={cap.y + 17}
                        textAnchor="middle" fontSize={6} fill={color} fillOpacity={0.8}
                        style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}
                      >
                        {cap.context.label.length > 13
                          ? cap.context.label.slice(0, 12) + "…"
                          : cap.context.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Step 4 — PCR lines: active capability → active provider */}
              {cascadePcrs.map(r => {
                const cn = capMap.get(r.capabilityId);
                const pn = provMap.get(r.providerId);
                if (!cn || !pn) return null;
                const color = VALUE_COLOR[capPrimaryValId.get(r.capabilityId) ?? "knowledge"];
                return (
                  <line
                    key={`casc-cp-${r.id}`}
                    x1={cn.x} y1={cn.y} x2={pn.x} y2={pn.y}
                    stroke={color} strokeWidth={1}
                    style={{
                      opacity: cascadeStep >= 4 ? 0.5 : 0,
                      transition: "opacity 0.5s ease",
                    }}
                  />
                );
              })}

              {/* Provider nodes — all visible, active ones lit at step 4 */}
              {provNodes.map(prov => {
                const color    = VALUE_COLOR[provPrimaryValId.get(prov.id) ?? "knowledge"];
                const isActive  = activeProvIds.has(prov.id);
                return (
                  <g
                    key={`prov-${prov.id}`}
                    style={{ opacity: provGroupOpacity(prov.id), transition: "opacity 0.5s ease" }}
                  >
                    <circle
                      cx={prov.x} cy={prov.y} r={5}
                      fill={color}
                      fillOpacity={isActive && cascadeStep >= 4 ? 0.28 : 0.06}
                      stroke={color}
                      strokeWidth={isActive && cascadeStep >= 4 ? 1.5 : 0.7}
                      strokeDasharray={isActive && cascadeStep >= 4 ? undefined : "2 3"}
                    />
                    {isActive && cascadeStep >= 4 && (
                      <text
                        x={prov.x} y={prov.y + 13}
                        textAnchor="middle" fontSize={5.5} fill={color} fillOpacity={0.75}
                        style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}
                      >
                        {prov.context.label.length > 11
                          ? prov.context.label.slice(0, 10) + "…"
                          : prov.context.label}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* ── EXISTING STATIC NODES (potential layer) ──────────────── */}

              {/* Domain nodes */}
              {domainNodes.map(d => (
                <g key={`dn-${d.i}`}>
                  <circle
                    cx={d.x} cy={d.y} r={5}
                    fill={VALUE_COLOR[d.valueId]} fillOpacity={0.22}
                    stroke={VALUE_COLOR[d.valueId]} strokeWidth={0.8} strokeOpacity={0.5}
                  />
                  <text
                    x={d.x} y={d.y}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={7.5} fill={VALUE_COLOR[d.valueId]} fillOpacity={0.55}
                    style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    transform={`translate(${d.x < CX ? -14 : 14}, ${d.y < CY ? -11 : 11})`}
                  >
                    {d.label}
                  </text>
                </g>
              ))}

              {/* User mission nodes */}
              {userNodes.map(u => {
                const isLeft  = u.x < CX - 20;
                const isRight = u.x > CX + 20;
                return (
                  <g key={`un-${u.i}`}>
                    <circle cx={u.x} cy={u.y} r={7} fill="#060f1c" stroke="#0c2040" strokeWidth={1} />
                    <circle cx={u.x} cy={u.y} r={3} fill="#1a3a5a" />
                    <text
                      x={u.x + (isLeft ? -13 : isRight ? 13 : 0)} y={u.y}
                      textAnchor={isLeft ? "end" : isRight ? "start" : "middle"}
                      dominantBaseline="central" fontSize={8} fill="#2a5a80"
                      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    >
                      {u.label}
                    </text>
                  </g>
                );
              })}

              {/* Value nodes — opacity reflects cascade state */}
              {valueNodes.map(v => (
                <g key={`vn-${v.id}`}>
                  <circle
                    cx={v.x} cy={v.y} r={13}
                    fill="#060f1c" stroke={VALUE_COLOR[v.id]} strokeWidth={1.2}
                    style={{
                      strokeOpacity: valueStrokeOpacity(v.id),
                      transition: "stroke-opacity 0.35s ease",
                    }}
                  />
                  <text
                    x={v.x} y={v.y - 1}
                    textAnchor="middle" dominantBaseline="central"
                    fontSize={8.5} fontWeight="600" fill={VALUE_COLOR[v.id]}
                    style={{
                      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
                      fillOpacity: valueLabelOpacity(v.id),
                      transition: "fill-opacity 0.35s ease",
                    }}
                  >
                    {v.label}
                  </text>
                </g>
              ))}

              {/* ── FUSION CORE ────────────────────────────────────────────── */}

              {/* Core pulse glow (step 1) */}
              <circle
                cx={CX} cy={CY} r={CORE_R + 42} fill="url(#core-pulse)"
                style={{ opacity: cascadeStep === 1 ? 1 : 0, transition: "opacity 0.25s ease" }}
              />
              <circle cx={CX} cy={CY} r={CORE_R + 20} fill="url(#core-glow)" />
              <circle
                cx={CX} cy={CY} r={CORE_R}
                fill="#030e1a"
                stroke={cascadeStep >= 1 ? "#7a50c0" : "#0e2a46"}
                strokeWidth={cascadeStep >= 1 ? 2.5 : 1.5}
                style={{ transition: "stroke 0.2s ease, stroke-width 0.2s ease" }}
              />

              {/* OPM ⇄ Marketplace axes */}
              <line x1={CX - 40} y1={CY - 12} x2={CX + 40} y2={CY - 12} stroke="#1a3a5a" strokeWidth={1} strokeDasharray="2 4" />
              <line x1={CX - 40} y1={CY + 12} x2={CX + 40} y2={CY + 12} stroke="#1a3a5a" strokeWidth={1} strokeDasharray="2 4" />
              <text x={CX} y={CY - 23} textAnchor="middle" fontSize={7.5} fill="#1a4a6a"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>OPM</text>
              <text x={CX} y={CY - 12} textAnchor="middle" fontSize={6} fill="#0e2a40"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>⇅</text>
              <text x={CX} y={CY + 8} textAnchor="middle" fontSize={6} fill="#0e2a40"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>MARKETPLACE</text>
              <text x={CX} y={CY + 20} textAnchor="middle" fontSize={7.5} fill="#1a3050" fontWeight="700"
                style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>PHILOS</text>
              <text x={CX} y={CY + 32} textAnchor="middle" fontSize={6.5} fill="#0d2035"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Fusion Core</text>

              {/* Ring labels */}
              <text x={CX + VALUE_R  + 6} y={CY} fontSize={7} fill="#0a2030"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Values</text>
              <text x={CX + CAP_R    + 6} y={CY} fontSize={7} fill="#0c2838"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Capabilities</text>
              <text x={CX + DOMAIN_R + 6} y={CY} fontSize={7} fill="#081828"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Domains</text>
              <text x={CX + PROV_R   + 6} y={CY} fontSize={7} fill="#0a1a28"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Providers</text>
              <text x={CX + USER_R   + 6} y={CY} fontSize={7} fill="#060f1a"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>Missions</text>

              {/* Potential label */}
              <text x={CX} y={CY + USER_R + 32} textAnchor="middle" fontSize={7.5} fill="#0d2030"
                letterSpacing={2} style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                ── ── POTENTIAL RELATIONSHIPS ── ──
              </text>

              {/* Live label */}
              <text x={CX} y={CY + USER_R + 46} textAnchor="middle" fontSize={7.5} fill="#1a4a2a"
                letterSpacing={2} style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                ── LIVE: {missions.length}M · {gaps.length}G · {values.length}V · {capabilities.length}C · {providers.length}P ──
              </text>

              {/* Cascade step indicator */}
              <text x={CX} y={CY + USER_R + 60} textAnchor="middle" fontSize={7} fill="#4a2a7a"
                letterSpacing={1} style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                {cascadeStatusText}
              </text>
            </svg>
          </div>

          {/* Sidebar — Live Decision Engine */}
          <div style={{ flex: "0 0 240px", minWidth: 200, display: "flex", flexDirection: "column" as const, gap: 14 }}>

            {/* 1. MISSION */}
            <div style={{
              background: "rgba(164,113,247,0.07)",
              border: "1px solid rgba(164,113,247,0.2)",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#5a3a90", marginBottom: 8 }}>
                Mission
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#c0a0ff", lineHeight: 1.4, marginBottom: 7 }}>
                {selectedMission ? missionLabel(selectedMission) : "—"}
              </div>
              <div style={{ fontSize: 9.5, color: "#7a5aaa", marginBottom: 8 }}>
                Step {cascadeStep}/4 · {STAGE_NAMES[cascadeStep]}
              </div>
              <div style={{ background: "rgba(164,113,247,0.12)", borderRadius: 2, height: 3, overflow: "hidden" as const }}>
                <div style={{
                  height: "100%", borderRadius: 2,
                  background: "linear-gradient(90deg, #A371F7, #7a50c0)",
                  width: `${(cascadeStep / 4) * 100}%`,
                  transition: "width 0.4s ease",
                }} />
              </div>
            </div>

            {/* 2. LIVE FLOW */}
            <div style={{
              background: "#030c18",
              border: "1px solid #0a1e30",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Live Flow
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const }}>
                {([
                  { label: "Mission",      activeFrom: 1, color: "#A371F7", count: null },
                  { label: "Gap",          activeFrom: 1, color: "#8a60d0", count: selectedMission?.gaps.length ?? 0 },
                  { label: "Values",       activeFrom: 2, color: "#5B8CFF", count: activeValueIds.size },
                  { label: "Capabilities", activeFrom: 3, color: "#FFB84D", count: activeCapIds.size },
                  { label: "Providers",    activeFrom: 4, color: "#34D399", count: activeProvIds.size },
                ] as { label: string; activeFrom: number; color: string; count: number | null }[]).map((node, idx, arr) => {
                  const isActive  = cascadeStep >= node.activeFrom;
                  const isGlowing = cascadeStep === node.activeFrom;
                  return (
                    <div key={node.label}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                          background: isActive ? node.color : "transparent",
                          border: `1.5px solid ${isActive ? node.color : "#0a2040"}`,
                          boxShadow: isGlowing ? `0 0 7px ${node.color}` : "none",
                          transition: "background 0.3s ease, box-shadow 0.3s ease",
                        }} />
                        <span style={{
                          fontSize: 10.5, flex: 1,
                          color: isActive ? node.color : "#1a3550",
                          fontWeight: isActive ? 600 : 400,
                          transition: "color 0.3s ease",
                        }}>
                          {node.label}
                        </span>
                        {node.count !== null && (
                          <span style={{
                            fontSize: 9.5, fontWeight: 600, fontVariantNumeric: "tabular-nums",
                            color: isActive ? node.color : "#0a1e30",
                          }}>
                            {isActive ? node.count : "—"}
                          </span>
                        )}
                      </div>
                      {idx < arr.length - 1 && (
                        <div style={{
                          marginLeft: 3.5, width: 1, height: 8,
                          background: cascadeStep > node.activeFrom ? node.color : "#0a2040",
                          opacity: cascadeStep > node.activeFrom ? 0.45 : 0.2,
                          transition: "background 0.3s ease, opacity 0.3s ease",
                        }} />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 3. SYSTEM STATUS */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                System Status
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                {([
                  { label: "Missions",     value: String(missions.length),                                         color: "#A371F7" },
                  { label: "Gaps",         value: String(gaps.length),                                             color: "#8a60d0" },
                  { label: "Values",       value: String(values.length),                                           color: "#5B8CFF" },
                  { label: "Capabilities", value: String(capabilities.length),                                     color: "#FFB84D" },
                  { label: "Providers",    value: String(providers.length),                                        color: "#34D399" },
                  { label: "Coverage",     value: cascadeStep >= 3 ? `${coveragePct}%` : "—",                      color: "#22D3EE" },
                ] as { label: string; value: string; color: string }[]).map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10, color: "#1a3550" }}>{row.label}</span>
                    <span style={{ fontSize: 10, fontWeight: 600, color: row.color, fontVariantNumeric: "tabular-nums" }}>
                      {row.value}
                    </span>
                  </div>
                ))}
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 10, color: "#1a3550" }}>Mode</span>
                  <span style={{
                    fontSize: 8, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const,
                    background: "rgba(255,184,77,0.1)", border: "1px solid rgba(255,184,77,0.2)",
                    borderRadius: 3, padding: "2px 6px", color: "#FFB84D",
                  }}>
                    Taxonomic
                  </span>
                </div>
              </div>
            </div>

            {/* 4. TOP INSIGHTS */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Top Insights
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 10 }}>
                {dominantVal && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: VALUE_COLOR[dominantVal.id], marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: VALUE_COLOR[dominantVal.id], marginBottom: 1 }}>
                        Dominant value
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a6a", lineHeight: 1.45 }}>
                        <strong style={{ color: "#3a6a9a" }}>{dominantVal.label}</strong>
                        {" "}in {valGapCount.get(dominantVal.id)}/{selectedMission?.gaps.length ?? 0} gaps
                      </div>
                    </div>
                  </div>
                )}
                {topConnectedVal && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: VALUE_COLOR[topConnectedVal.id], marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: VALUE_COLOR[topConnectedVal.id], marginBottom: 1 }}>
                        Most connected
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a6a", lineHeight: 1.45 }}>
                        <strong style={{ color: "#3a6a9a" }}>{topConnectedVal.label}</strong>
                        {" "}→ {topConnectedVcrCount} capabilities
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep >= 3 && uncoveredCapCount > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#F87171", marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#F87171", marginBottom: 1 }}>
                        Coverage gap
                      </div>
                      <div style={{ fontSize: 9, color: "#3a2020", lineHeight: 1.45 }}>
                        {uncoveredCapCount} {uncoveredCapCount !== 1 ? "capabilities" : "capability"} with no provider
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep >= 3 && uncoveredCapCount === 0 && activeCapIds.size > 0 && (
                  <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#34D399", marginTop: 3, flexShrink: 0 }} />
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: "#34D399", marginBottom: 1 }}>
                        Full coverage
                      </div>
                      <div style={{ fontSize: 9, color: "#1a4a3a", lineHeight: 1.45 }}>
                        All {activeCapIds.size} capabilities have providers
                      </div>
                    </div>
                  </div>
                )}
                {cascadeStep < 3 && (
                  <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.45 }}>
                    Waiting for cascade to reach Capabilities…
                  </div>
                )}
              </div>
            </div>

            {/* 5. NEXT ACTION */}
            <div style={{
              background: "#030c18",
              border: "1px solid #081828",
              borderRadius: 6, padding: "12px 14px",
            }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Next Action
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {([
                  { label: "required_for", status: "Not implemented", color: "#6E7681", note: "Contextual matching deferred (G-2)" },
                  { label: "selected_for", status: "Disabled",        color: "#6E7681", note: "Requires execution evidence"        },
                  { label: "Evidence",     status: "Waiting",         color: "#FFB84D", note: "Intent-grade only"                  },
                ] as { label: string; status: string; color: string; note: string }[]).map(action => (
                  <div key={action.label} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <div style={{ width: 1, alignSelf: "stretch", background: action.color, opacity: 0.3, marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                        <code style={{
                          fontSize: 8.5, color: action.color,
                          background: "rgba(110,118,129,0.08)",
                          padding: "1px 4px", borderRadius: 2,
                        }}>
                          {action.label}
                        </code>
                        <span style={{ fontSize: 8.5, color: action.color, opacity: 0.65 }}>{action.status}</span>
                      </div>
                      <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.45 }}>{action.note}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </div>

        {/* Footer */}
        <footer style={{
          borderTop: "1px solid #0a1e30",
          marginTop: 48, paddingTop: 16,
          display: "flex", justifyContent: "space-between", flexWrap: "wrap" as const, gap: 8,
        }}>
          <span style={{ fontSize: 11, color: "#102030", fontFamily: "var(--font-geist-mono), monospace" }}>
            /world · Potential + Live Layer + PUDM Cascade · {missions.length}M {gaps.length}G {values.length}V {capabilities.length}C {providers.length}P
          </span>
          <span style={{ fontSize: 11, color: "#0d1e2e" }}>
            Values: Candidate grade — designed, not validated
          </span>
        </footer>
      </div>
    </div>
  );
}
