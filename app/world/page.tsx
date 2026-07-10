import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";

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
  { label: "Founder",         values: ["growth", "execution", "capital"]     },
  { label: "Researcher",      values: ["knowledge", "learning", "trust"]     },
  { label: "Policy Maker",    values: ["justice", "community", "security"]   },
  { label: "Investor",        values: ["capital", "growth", "trust"]         },
  { label: "Doctor",          values: ["health", "care", "knowledge"]        },
  { label: "Educator",        values: ["knowledge", "learning", "community"] },
  { label: "Artist",          values: ["creativity", "community", "trust"]   },
  { label: "Engineer",        values: ["execution", "knowledge", "growth"]   },
  { label: "Activist",        values: ["justice", "community", "care"]       },
  { label: "Entrepreneur",    values: ["growth", "creativity", "execution"]  },
  { label: "Caregiver",       values: ["care", "health", "community"]        },
  { label: "Analyst",         values: ["knowledge", "trust", "capital"]      },
  { label: "Designer",        values: ["creativity", "execution", "community"]},
  { label: "Journalist",      values: ["knowledge", "trust", "justice"]      },
  { label: "Scientist",       values: ["knowledge", "learning", "health"]    },
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
const VALUE_R = 195;
const DOMAIN_R = 295;
const USER_R = 395;
const CORE_R = 65;

function degToRad(deg: number) {
  return (deg - 90) * (Math.PI / 180);
}

function polar(r: number, angleDeg: number) {
  const rad = degToRad(angleDeg);
  return { x: CX + r * Math.cos(rad), y: CY + r * Math.sin(rad) };
}

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

export default function WorldPage() {
  const DATA = path.join(process.cwd(), "data");
  const liveMissions = readJsonStore<Mission>(path.join(DATA, "missions.json"));
  const liveGaps     = readJsonStore<Gap>(path.join(DATA, "gaps.json"));
  const liveValues   = readJsonStore<Value>(path.join(DATA, "values.json"));
  const liveValueIds = new Set(
    liveMissions.flatMap(m => (m.requiredValues ?? []).map(r => r.valueId))
  );

  const valueNodes = VALUES.map((v) => ({ ...v, ...polar(VALUE_R, v.angle) }));
  const valueMap = Object.fromEntries(valueNodes.map((v) => [v.id, v]));

  const domainNodes = DOMAINS.map((d, i) => {
    const parent = valueMap[d.valueId];
    const sameGroup = DOMAINS.filter((x) => x.valueId === d.valueId);
    const idx = sameGroup.indexOf(d);
    const parentV = VALUES.find((v) => v.id === d.valueId)!;
    const offsetAngle = parentV.angle + (idx === 0 ? -14 : 14);
    return { ...d, i, ...polar(DOMAIN_R, offsetAngle) };
  });

  const userNodes = USERS.map((u, i) => {
    const angle = (i / USERS.length) * 360;
    return { ...u, i, ...polar(USER_R, angle) };
  });

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
        <header style={{ marginBottom: 28, display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(255,107,107,0.10)",
                border: "1px solid rgba(255,107,107,0.22)",
                borderRadius: 4,
                padding: "2px 9px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase" as const,
                color: "#ff6b6b",
                marginBottom: 10,
              }}
            >
              Potential Map
            </div>
            <div
              style={{
                display: "inline-block",
                background: "rgba(52,211,153,0.10)",
                border: "1px solid rgba(52,211,153,0.25)",
                borderRadius: 4,
                padding: "2px 9px",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "1.5px",
                textTransform: "uppercase" as const,
                color: "#34D399",
                marginBottom: 10,
                marginLeft: 8,
              }}
            >
              Live · {liveMissions.length}M {liveGaps.length}G {liveValues.length}V
            </div>
            <h1
              style={{
                fontSize: 22,
                fontWeight: 600,
                letterSpacing: "-0.3px",
                color: "#e0f0ff",
                marginBottom: 6,
              }}
            >
              Living World
            </h1>
            <p style={{ fontSize: 12.5, color: "#3a5a78", maxWidth: 500, lineHeight: 1.65 }}>
              Potential layer (dashed) shows the architecture&apos;s design space.
              Live layer (solid) reflects data loaded from JSON stores.
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <a href="/lab" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← Lab</a>
            <a href="/" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>← App</a>
          </div>
        </header>

        {/* Caveat */}
        <div
          style={{
            background: "rgba(255,184,77,0.06)",
            border: "1px solid rgba(255,184,77,0.18)",
            borderRadius: 5,
            padding: "9px 14px",
            marginBottom: 28,
            fontSize: 11.5,
            color: "#9a7030",
            lineHeight: 1.6,
          }}
        >
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
              aria-label="Philos Living World — potential relationships and live value references diagram"
            >
              <defs>
                {VALUES.map((v) => (
                  <radialGradient key={v.id} id={`vg-${v.id}`} cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor={VALUE_COLOR[v.id]} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={VALUE_COLOR[v.id]} stopOpacity={0} />
                  </radialGradient>
                ))}
                <radialGradient id="core-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#5B8CFF" stopOpacity={0.18} />
                  <stop offset="100%" stopColor="#5B8CFF" stopOpacity={0} />
                </radialGradient>
              </defs>

              {/* Ring guides */}
              <circle cx={CX} cy={CY} r={VALUE_R}  fill="none" stroke="#0a1e30" strokeWidth={1} strokeDasharray="3 6" />
              <circle cx={CX} cy={CY} r={DOMAIN_R} fill="none" stroke="#081828" strokeWidth={1} strokeDasharray="3 8" />
              <circle cx={CX} cy={CY} r={USER_R}   fill="none" stroke="#060f1e" strokeWidth={1} strokeDasharray="3 10" />

              {/* User → Value potential connections */}
              {userNodes.map((u) =>
                u.values.map((vid) => {
                  const vn = valueMap[vid];
                  return (
                    <line
                      key={`u-${u.i}-${vid}`}
                      x1={u.x} y1={u.y}
                      x2={vn.x} y2={vn.y}
                      stroke={VALUE_COLOR[vid]}
                      strokeWidth={0.6}
                      strokeDasharray="3 5"
                      strokeOpacity={0.18}
                    />
                  );
                })
              )}

              {/* Value → Domain potential connections */}
              {domainNodes.map((d) => {
                const vn = valueMap[d.valueId];
                return (
                  <line
                    key={`d-${d.i}`}
                    x1={vn.x} y1={vn.y}
                    x2={d.x} y2={d.y}
                    stroke={VALUE_COLOR[d.valueId]}
                    strokeWidth={0.8}
                    strokeDasharray="3 4"
                    strokeOpacity={0.28}
                  />
                );
              })}

              {/* Core → Value potential connections */}
              {valueNodes.map((v) => (
                <line
                  key={`cv-${v.id}`}
                  x1={CX} y1={CY}
                  x2={v.x} y2={v.y}
                  stroke={VALUE_COLOR[v.id]}
                  strokeWidth={0.9}
                  strokeDasharray="4 5"
                  strokeOpacity={0.32}
                />
              ))}

              {/* Value glow halos */}
              {valueNodes.map((v) => (
                <circle key={`vh-${v.id}`} cx={v.x} cy={v.y} r={28} fill={`url(#vg-${v.id})`} />
              ))}

              {/* Domain nodes */}
              {domainNodes.map((d) => (
                <g key={`dn-${d.i}`}>
                  <circle
                    cx={d.x} cy={d.y} r={5}
                    fill={VALUE_COLOR[d.valueId]}
                    fillOpacity={0.22}
                    stroke={VALUE_COLOR[d.valueId]}
                    strokeWidth={0.8}
                    strokeOpacity={0.5}
                  />
                  <text
                    x={d.x}
                    y={d.y}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={7.5}
                    fill={VALUE_COLOR[d.valueId]}
                    fillOpacity={0.55}
                    style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    transform={`translate(${d.x < CX ? -14 : 14}, ${d.y < CY ? -11 : 11})`}
                    x2={d.x}
                  >
                    {d.label}
                  </text>
                </g>
              ))}

              {/* User mission nodes */}
              {userNodes.map((u) => {
                const isLeft = u.x < CX - 20;
                const isRight = u.x > CX + 20;
                return (
                  <g key={`un-${u.i}`}>
                    <circle
                      cx={u.x} cy={u.y} r={7}
                      fill="#060f1c"
                      stroke="#0c2040"
                      strokeWidth={1}
                    />
                    <circle
                      cx={u.x} cy={u.y} r={3}
                      fill="#1a3a5a"
                    />
                    <text
                      x={u.x + (isLeft ? -13 : isRight ? 13 : 0)}
                      y={u.y}
                      textAnchor={isLeft ? "end" : isRight ? "start" : "middle"}
                      dominantBaseline="central"
                      fontSize={8}
                      fill="#2a5a80"
                      style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                    >
                      {u.label}
                    </text>
                  </g>
                );
              })}

              {/* Value nodes */}
              {valueNodes.map((v) => (
                <g key={`vn-${v.id}`}>
                  <circle
                    cx={v.x} cy={v.y} r={13}
                    fill="#060f1c"
                    stroke={VALUE_COLOR[v.id]}
                    strokeWidth={1.2}
                    strokeOpacity={0.6}
                  />
                  <text
                    x={v.x} y={v.y - 1}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={8.5}
                    fontWeight="600"
                    fill={VALUE_COLOR[v.id]}
                    fillOpacity={0.85}
                    style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
                  >
                    {v.label}
                  </text>
                </g>
              ))}

              {/* Fusion Core */}
              <circle cx={CX} cy={CY} r={CORE_R + 20} fill="url(#core-glow)" />
              <circle cx={CX} cy={CY} r={CORE_R}
                fill="#030e1a"
                stroke="#0e2a46"
                strokeWidth={1.5}
              />

              {/* OPM ⇄ Marketplace axes */}
              <line x1={CX - 40} y1={CY - 12} x2={CX + 40} y2={CY - 12}
                stroke="#1a3a5a" strokeWidth={1} strokeDasharray="2 4" />
              <line x1={CX - 40} y1={CY + 12} x2={CX + 40} y2={CY + 12}
                stroke="#1a3a5a" strokeWidth={1} strokeDasharray="2 4" />

              <text x={CX} y={CY - 23} textAnchor="middle" fontSize={7.5} fill="#1a4a6a"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                OPM
              </text>
              <text x={CX} y={CY - 12} textAnchor="middle" fontSize={6} fill="#0e2a40"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                ⇅
              </text>
              <text x={CX} y={CY + 8} textAnchor="middle" fontSize={6} fill="#0e2a40"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                MARKETPLACE
              </text>
              <text x={CX} y={CY + 20} textAnchor="middle" fontSize={7.5} fill="#1a3050"
                fontWeight="700"
                style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}>
                PHILOS
              </text>
              <text x={CX} y={CY + 32} textAnchor="middle" fontSize={6.5} fill="#0d2035"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                Fusion Core
              </text>

              {/* Ring labels */}
              <text x={CX + VALUE_R + 6} y={CY} fontSize={7} fill="#0a2030"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                Values
              </text>
              <text x={CX + DOMAIN_R + 6} y={CY} fontSize={7} fill="#081828"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                Domains
              </text>
              <text x={CX + USER_R + 6} y={CY} fontSize={7} fill="#060f1a"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                Missions
              </text>

              {/* Potential label */}
              <text x={CX} y={CY + USER_R + 32} textAnchor="middle" fontSize={7.5} fill="#0d2030"
                letterSpacing="2"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                ── ── POTENTIAL RELATIONSHIPS ── ──
              </text>

              {/* Live Reference Layer — solid lines = real records from JSON stores, not observed flow */}
              <g>
                {valueNodes.filter(v => liveValueIds.has(v.id)).map(v => (
                  <line
                    key={`live-cv-${v.id}`}
                    x1={CX} y1={CY}
                    x2={v.x} y2={v.y}
                    stroke={VALUE_COLOR[v.id]}
                    strokeWidth={1.8}
                    strokeOpacity={0.7}
                  />
                ))}
                {valueNodes.filter(v => liveValueIds.has(v.id)).map(v => (
                  <circle
                    key={`live-vring-${v.id}`}
                    cx={v.x} cy={v.y} r={17}
                    fill="none"
                    stroke={VALUE_COLOR[v.id]}
                    strokeWidth={1.5}
                    strokeOpacity={0.55}
                  />
                ))}
              </g>

              {/* Live label */}
              <text x={CX} y={CY + USER_R + 46} textAnchor="middle" fontSize={7.5} fill="#1a4a2a"
                letterSpacing="2"
                style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace" }}>
                ── LIVE: {liveMissions.length}M · {liveGaps.length}G · {liveValues.length}V ──
              </text>
            </svg>
          </div>

          {/* Sidebar */}
          <div style={{ flex: "0 0 240px", minWidth: 200, display: "flex", flexDirection: "column" as const, gap: 20 }}>

            {/* Values legend */}
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase" as const,
                  color: "#1a3550",
                  marginBottom: 10,
                }}
              >
                Values — Candidate Grade
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 4 }}>
                {VALUES.map((v) => (
                  <div key={v.id} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                    <div
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: "50%",
                        background: VALUE_COLOR[v.id],
                        opacity: 0.7,
                        flexShrink: 0,
                      }}
                    />
                    <span style={{ fontSize: 11, color: "#2a4a62" }}>{v.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Data layers */}
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase" as const,
                  color: "#1a3550",
                  marginBottom: 10,
                }}
              >
                Data Layers
              </div>
              {(() => {
                const LIVE_LAYERS = new Set(["Mission", "Gap", "Value", "Capability"]);
                return (
                  <div style={{ display: "flex", flexDirection: "column" as const, gap: 6 }}>
                    {DATA_LAYERS.map((layer, i) => {
                      const isLive = LIVE_LAYERS.has(layer.label);
                      return (
                        <div
                          key={layer.label}
                          style={{
                            background: isLive ? "rgba(52,211,153,0.05)" : "#040d18",
                            border: `1px solid ${isLive ? "rgba(52,211,153,0.2)" : "#0a1c2e"}`,
                            borderRadius: 4,
                            padding: "6px 9px",
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
                );
              })()}
            </div>

            {/* Legend */}
            <div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase" as const,
                  color: "#1a3550",
                  marginBottom: 10,
                }}
              >
                Legend
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {[
                  { line: "solid",  color: "#34D399", label: "Live value references" },
                  { line: "dashed", color: "#5B8CFF", label: "Potential relationships" },
                  { line: "circle-sm", color: "#2a5a80", label: "Mission actor" },
                  { line: "circle-lg", color: "#5B8CFF", label: "Value node" },
                  { line: "dot", color: "#1a3a5a", label: "Capability domain" },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <svg width={24} height={12} viewBox="0 0 24 12">
                      {item.line === "solid" && (
                        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={1.8} strokeOpacity={0.8} />
                      )}
                      {item.line === "dashed" && (
                        <line x1={0} y1={6} x2={24} y2={6} stroke={item.color} strokeWidth={1.2} strokeDasharray="3 3" strokeOpacity={0.7} />
                      )}
                      {item.line === "circle-sm" && (
                        <circle cx={12} cy={6} r={4} fill="#060f1c" stroke={item.color} strokeWidth={1} strokeOpacity={0.6} />
                      )}
                      {item.line === "circle-lg" && (
                        <circle cx={12} cy={6} r={5} fill="#060f1c" stroke={item.color} strokeWidth={1.2} strokeOpacity={0.7} />
                      )}
                      {item.line === "dot" && (
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
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: "2px",
                  textTransform: "uppercase" as const,
                  color: "#1a3550",
                  marginBottom: 10,
                }}
              >
                Layer Semantics
              </div>
              <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>
                {[
                  {
                    name: "Potential Layer",
                    line: "dashed",
                    color: "#5B8CFF",
                    desc: "Architecturally possible relationships.",
                  },
                  {
                    name: "Live Reference Layer",
                    line: "solid",
                    color: "#34D399",
                    desc: "Relationships present in loaded repositories.",
                  },
                  {
                    name: "Observed Flow",
                    line: "none",
                    color: "#6E7681",
                    desc: "Reserved — requires Capability + execution evidence.",
                  },
                ].map((s) => (
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
                      <div style={{ fontSize: 9.5, fontWeight: 600, color: s.color, opacity: s.line === "none" ? 0.4 : 1, marginBottom: 1 }}>{s.name}</div>
                      <div style={{ fontSize: 9, color: "#0f2030", lineHeight: 1.5 }}>{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Link to docs */}
            <div
              style={{
                borderTop: "1px solid #0a1e30",
                paddingTop: 14,
                display: "flex",
                flexDirection: "column" as const,
                gap: 6,
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "2px", textTransform: "uppercase" as const, color: "#1a3550", marginBottom: 4 }}>
                Architecture Docs
              </div>
              {[
                { label: "OPM Specification", href: "/lab" },
                { label: "Marketplace Core v0", href: "/lab" },
                { label: "Research Charter", href: "/lab" },
              ].map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  style={{ fontSize: 10.5, color: "#1a3a52", textDecoration: "none", lineHeight: 1.4 }}
                >
                  {link.label} →
                </a>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer
          style={{
            borderTop: "1px solid #0a1e30",
            marginTop: 48,
            paddingTop: 16,
            display: "flex",
            justifyContent: "space-between",
            flexWrap: "wrap" as const,
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#102030",
              fontFamily: "var(--font-geist-mono), monospace",
            }}
          >
            /world · Potential + Live Layer · {liveMissions.length}M {liveGaps.length}G {liveValues.length}V
          </span>
          <span style={{ fontSize: 11, color: "#0d1e2e" }}>
            Values: Candidate grade — designed, not validated
          </span>
        </footer>
      </div>
    </div>
  );
}
