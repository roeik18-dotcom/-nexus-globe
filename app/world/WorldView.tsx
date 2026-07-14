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

const DATA_LAYERS = [
  { label: "Mission",    desc: "What each actor is trying to achieve"         },
  { label: "Gap",        desc: "Distance between current state and mission"   },
  { label: "Value",      desc: "Which values are required to close the gap"   },
  { label: "Capability", desc: "Domains that can address the required values" },
  { label: "Provider",   desc: "Entities with relevant capabilities"          },
  { label: "Evidence",   desc: "Intent → Behavior → Outcomes signal grades"  },
  { label: "Network",    desc: "Trust and connection graph between entities"  },
  { label: "System",     desc: "OPM pressure, deficit, capacity readings"     },
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

const LIVE_LAYERS = new Set(["Mission", "Gap", "Value", "Capability", "Provider"]);

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

  const activeValueIds = new Set<string>(
    (selectedMission?.requiredValues ?? []).map(r => r.valueId)
  );
  const activeCapIds = new Set<string>(
    vcRelations.filter(r => activeValueIds.has(r.valueId)).map(r => r.capabilityId)
  );
  const activeProvIds = new Set<string>(
    pcRelations.filter(r => activeCapIds.has(r.capabilityId)).map(r => r.providerId)
  );

  // All-missions live value set — preserved base layer
  const allLiveValueIds = new Set<string>(
    missions.flatMap(m => (m.requiredValues ?? []).map(r => r.valueId))
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

          {/* Sidebar */}
          <div style={{ flex: "0 0 240px", minWidth: 200, display: "flex", flexDirection: "column" as const, gap: 20 }}>

            {/* Cascade state panel */}
            {selectedMission && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 8 }}>
                  Cascade State
                </div>
                <div style={{
                  background: "rgba(164,113,247,0.06)",
                  border: "1px solid rgba(164,113,247,0.18)",
                  borderRadius: 5, padding: "10px 12px",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: "#A371F7", marginBottom: 8, lineHeight: 1.4 }}>
                    {missionLabel(selectedMission)}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 5 }}>
                    {[
                      { label: "Values",       count: activeValueIds.size, total: VALUES.length,         step: 2, color: "#5B8CFF" },
                      { label: "Capabilities", count: activeCapIds.size,   total: capabilities.length,   step: 3, color: "#FFB84D" },
                      { label: "Providers",    count: activeProvIds.size,   total: providers.length,      step: 4, color: "#34D399" },
                    ].map(row => (
                      <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: 10,
                          color: cascadeStep >= row.step ? row.color : "#1a3550",
                          transition: "color 0.35s ease",
                        }}>
                          {row.label}
                        </span>
                        <span style={{
                          fontSize: 10, fontWeight: 600,
                          color: cascadeStep >= row.step ? row.color : "#0a1e30",
                          fontVariantNumeric: "tabular-nums",
                          transition: "color 0.35s ease",
                        }}>
                          {cascadeStep >= row.step ? `${row.count} / ${row.total}` : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                  {!reducedMotion && (
                    <div style={{ marginTop: 8, fontSize: 9, color: "#3a2060" }}>
                      Click any mission to replay
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Values legend */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Values — Candidate Grade
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                {VALUES.map(v => {
                  const isActive = activeValueIds.has(v.id);
                  return (
                    <div
                      key={v.id}
                      style={{
                        display: "flex", alignItems: "center", gap: 7,
                        opacity: cascadeStep >= 2 ? (isActive ? 1 : 0.28) : 1,
                        transition: "opacity 0.35s ease",
                      }}
                    >
                      <div style={{ width: 7, height: 7, borderRadius: "50%", background: VALUE_COLOR[v.id], opacity: 0.7, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: isActive && cascadeStep >= 2 ? VALUE_COLOR[v.id] : "#2a4a62" }}>
                        {v.label}
                        {isActive && cascadeStep >= 2 && (
                          <span style={{ fontSize: 8, marginLeft: 4, opacity: 0.7 }}>●</span>
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Data layers */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Data Layers
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                {DATA_LAYERS.map((layer, i) => {
                  const isLive = LIVE_LAYERS.has(layer.label);
                  return (
                    <div
                      key={layer.label}
                      style={{
                        background: isLive ? "rgba(52,211,153,0.05)" : "#040d18",
                        border: `1px solid ${isLive ? "rgba(52,211,153,0.2)" : "#0a1c2e"}`,
                        borderRadius: 4, padding: "6px 9px",
                      }}
                    >
                      <div style={{ fontSize: 10, fontWeight: 600, color: isLive ? "#34D399" : "#1a3a52", marginBottom: 2, display: "flex", justifyContent: "space-between" }}>
                        <span>{String(i + 1).padStart(2, "0")} {layer.label}</span>
                        {isLive && <span style={{ fontSize: 9, opacity: 0.75 }}>LIVE</span>}
                      </div>
                      <div style={{ fontSize: 9.5, color: isLive ? "#1a4a3a" : "#0d1f2e", lineHeight: 1.45 }}>
                        {layer.desc}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Legend */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Legend
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {[
                  { type: "solid-thick", color: "#A371F7", label: "Active cascade line"              },
                  { type: "solid",       color: "#34D399", label: "Live value references (all missions)" },
                  { type: "dashed",      color: "#5B8CFF", label: "Potential relationships"          },
                  { type: "diamond",     color: "#FFB84D", label: "Capability node"                  },
                  { type: "dot-prov",    color: "#34D399", label: "Provider node"                    },
                  { type: "circle-lg",   color: "#5B8CFF", label: "Value node"                       },
                  { type: "dot-dom",     color: "#1a3a5a", label: "Capability domain"                },
                ].map(item => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width={24} height={12} viewBox="0 0 24 12">
                      {item.type === "solid-thick" && (
                        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={2.5} strokeOpacity={0.8} />
                      )}
                      {item.type === "solid" && (
                        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={1.8} strokeOpacity={0.8} />
                      )}
                      {item.type === "dashed" && (
                        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.7} />
                      )}
                      {item.type === "diamond" && (
                        <rect x={9} y={3} width={6} height={6} transform="rotate(45 12 6)" fill={item.color} fillOpacity={0.2} stroke={item.color} strokeWidth={1.5} />
                      )}
                      {item.type === "dot-prov" && (
                        <circle cx={12} cy={6} r={3.5} fill={item.color} fillOpacity={0.25} stroke={item.color} strokeWidth={1.2} />
                      )}
                      {item.type === "circle-lg" && (
                        <circle cx={12} cy={6} r={5} fill="#060f1c" stroke={item.color} strokeWidth={1.2} strokeOpacity={0.7} />
                      )}
                      {item.type === "dot-dom" && (
                        <circle cx={12} cy={6} r={3} fill={item.color} fillOpacity={0.35} />
                      )}
                    </svg>
                    <span style={{ fontSize: 10.5, color: "#1a3550" }}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Layer semantics */}
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 10 }}>
                Layer Semantics
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {[
                  { name: "Potential Layer",    line: "dashed", color: "#5B8CFF", desc: "Architecturally possible relationships." },
                  { name: "Live Reference Layer", line: "solid", color: "#34D399", desc: "Relationships present in loaded repositories." },
                  { name: "Live PUDM Cascade",  line: "solid",  color: "#A371F7", desc: "Mission-driven chain: Value → Capability → Provider. Taxonomic, not contextual." },
                  { name: "Observed Flow",      line: "none",   color: "#6E7681", desc: "Reserved — requires Capability + execution evidence." },
                ].map(s => (
                  <div key={s.name} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <svg width={18} height={18} viewBox="0 0 18 18" style={{ flexShrink: 0, marginTop: 1 }}>
                      {s.line === "dashed" && (
                        <line x1={1} y1={9} x2={17} y2={9} stroke={s.color} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.7} />
                      )}
                      {s.line === "solid" && (
                        <line x1={1} y1={9} x2={17} y2={9} stroke={s.color} strokeWidth={1.8} strokeOpacity={0.8} />
                      )}
                      {s.line === "none" && (
                        <line x1={1} y1={9} x2={17} y2={9} stroke={s.color} strokeWidth={1} strokeOpacity={0.3} strokeDasharray="1 4" />
                      )}
                    </svg>
                    <div>
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: s.color, opacity: s.line === "none" ? 0.4 : 1, marginBottom: 1 }}>
                        {s.name}
                      </div>
                      <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Architecture links */}
            <div style={{ borderTop: "1px solid #0a1e30", paddingTop: 14, display: "flex", flexDirection: "column" as const, gap: 6 }}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 4 }}>
                Architecture Docs
              </div>
              {[
                { label: "OPM Specification",   href: "/lab" },
                { label: "Marketplace Core v0", href: "/lab" },
                { label: "Research Charter",    href: "/lab" },
              ].map(link => (
                <a key={link.label} href={link.href} style={{ fontSize: 10.5, color: "#1a3a52", textDecoration: "none", lineHeight: 1.4 }}>
                  {link.label} →
                </a>
              ))}
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
