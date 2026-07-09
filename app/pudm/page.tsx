/**
 * PUDM Explorer — /pudm
 *
 * Server Component. Reads live data from data/{missions,gaps,values}.json
 * and renders the PUDM chain as an inspectable tree.
 * Updates automatically as new node types are added to the chain.
 */

import path from "path";
import { readJsonStore } from "@/app/lib/json-store";
import type { Mission } from "@/app/lib/mission/schema";
import type { Gap } from "@/app/lib/gap/schema";
import type { Value } from "@/app/lib/value/schema";

export const metadata = { title: "PUDM Explorer — Philos" };

// ─── Data ─────────────────────────────────────────────────────────────────────

const DATA = path.join(process.cwd(), "data");

// ─── Design tokens ────────────────────────────────────────────────────────────

const GRADE: Record<string, string> = {
  "Frozen":          "#3FB950",
  "Candidate":       "#D29922",
  "Placeholder":     "#58A6FF",
  "Not established": "#6E7681",
};

const STATUS: Record<string, string> = {
  open:      "#F85149",
  closed:    "#3FB950",
  deferred:  "#6E7681",
  active:    "#3FB950",
  completed: "#58A6FF",
  abandoned: "#F85149",
  paused:    "#D29922",
};

const SEVERITY: Record<string, string> = {
  critical:    "#F85149",
  significant: "#D29922",
  moderate:    "#58A6FF",
  minor:       "#6E7681",
};

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

// ─── Micro-components (Server-safe, no hooks) ─────────────────────────────────

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center",
      padding: "2px 8px", borderRadius: 4,
      fontSize: 11, fontWeight: 600, letterSpacing: "0.4px",
      fontFamily: "monospace",
      background: color + "20", color, border: `1px solid ${color}40`,
    }}>
      {label}
    </span>
  );
}

function ValueChip({ id }: { id: string }) {
  const c = VALUE_COLOR[id] ?? "#94A3B8";
  return (
    <span style={{
      display: "inline-block", padding: "2px 10px", borderRadius: 12,
      fontSize: 12, fontWeight: 500,
      background: c + "1A", color: c, border: `1px solid ${c}40`,
    }}>
      {id}
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PudmPage() {
  const missions = readJsonStore<Mission>(path.join(DATA, "missions.json"));
  const gaps     = readJsonStore<Gap>    (path.join(DATA, "gaps.json"));
  const values   = readJsonStore<Value>  (path.join(DATA, "values.json"));

  // Lookup maps
  const gapById   = new Map(gaps.map  (g => [g.id, g]));
  const valueById = new Map(values.map(v => [v.id, v]));

  // Cross-reference: which gaps need each value?
  const gapsByValueId = new Map<string, Gap[]>();
  for (const gap of gaps) {
    for (const ref of gap.requiredValues ?? []) {
      const arr = gapsByValueId.get(ref.valueId) ?? [];
      arr.push(gap);
      gapsByValueId.set(ref.valueId, arr);
    }
  }

  return (
    <>
      <style>{`
        :root {
          --bg: #0D1117; --surface: #161B22; --surface-2: #21262D;
          --border: #30363D; --text: #E6EDF3; --muted: #7D8590;
        }
        @media (prefers-color-scheme: light) { :root {
          --bg: #F6F8FA; --surface: #FFFFFF; --surface-2: #F0F2F4;
          --border: #D0D7DE; --text: #1F2328; --muted: #656D76;
        }}
        :root[data-theme="light"] {
          --bg: #F6F8FA; --surface: #FFFFFF; --surface-2: #F0F2F4;
          --border: #D0D7DE; --text: #1F2328; --muted: #656D76;
        }
        :root[data-theme="dark"] {
          --bg: #0D1117; --surface: #161B22; --surface-2: #21262D;
          --border: #30363D; --text: #E6EDF3; --muted: #7D8590;
        }
        *, *::before, *::after { box-sizing: border-box; }
        details > summary { cursor: pointer; list-style: none; user-select: none; }
        details > summary::-webkit-details-marker { display: none; }
        details > summary .arrow { display: inline-block; transition: transform 0.15s; }
        details[open] > summary .arrow { transform: rotate(90deg); }
      `}</style>

      <main style={{
        maxWidth: 960, margin: "0 auto",
        padding: "40px 24px 96px",
        fontFamily: "system-ui, -apple-system, sans-serif",
        color: "var(--text)", background: "var(--bg)", minHeight: "100vh",
      }}>

        {/* ── Header ── */}
        <header style={{ marginBottom: 32 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, flexWrap: "wrap", marginBottom: 14 }}>
            <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.4px" }}>
              PUDM Explorer
            </h1>
            <span style={{ fontFamily: "monospace", fontSize: 12, color: "var(--muted)" }}>
              Mission&nbsp;→&nbsp;Gap&nbsp;→&nbsp;Value&nbsp;→&nbsp;
              <span style={{ opacity: 0.35 }}>Capability&nbsp;→&nbsp;Provider</span>
            </span>
          </div>

          {/* Stats row */}
          <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
            {([
              { label: "Missions",    n: missions.length, color: "#58A6FF" },
              { label: "Gaps",        n: gaps.length,     color: "#D29922" },
              { label: "Values",      n: values.length,   color: "#3FB950" },
              { label: "Capabilities",n: 0,               color: "var(--muted)", dim: true },
              { label: "Providers",   n: 0,               color: "var(--muted)", dim: true },
            ] as const).map(s => (
              <div key={s.label} style={{ display: "flex", alignItems: "baseline", gap: 5, opacity: (s as {dim?: boolean}).dim ? 0.3 : 1 }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.n}</span>
                <span style={{ fontSize: 12, color: "var(--muted)" }}>{s.label}</span>
              </div>
            ))}
          </div>
        </header>

        <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 36 }} />

        {/* ── Missions ── */}
        {missions.map(m => {
          const mGaps   = (m.gaps ?? []).map(r => gapById.get(r.gapId)).filter((g): g is Gap => !!g);
          const mValues = (m.requiredValues ?? []).map(r => valueById.get(r.valueId)).filter((v): v is Value => !!v);

          return (
            <section key={m.id} style={{ marginBottom: 48 }}>

              {/* Mission card */}
              <div style={{
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: 8, overflow: "hidden",
              }}>
                {/* Header bar */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 8, padding: "10px 16px",
                  background: "var(--surface-2)", borderBottom: "1px solid var(--border)",
                  flexWrap: "wrap",
                }}>
                  <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                    letterSpacing: "1px", color: "#58A6FF", opacity: 0.8 }}>MISSION</span>
                  <Pill label={m.evidenceGrade}  color={GRADE[m.evidenceGrade]  ?? "#6E7681"} />
                  <Pill label={m.state.status}   color={STATUS[m.state.status]  ?? "#6E7681"} />
                  <Pill label={m.state.horizon}  color="#58A6FF" />
                  <code style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)", fontFamily: "monospace" }}>
                    {m.id}
                  </code>
                </div>

                {/* Body */}
                <div style={{ padding: "18px 20px" }}>
                  <p style={{ fontSize: 14, lineHeight: 1.65, maxWidth: 680, marginBottom: 14 }}>
                    &ldquo;{m.context.statement}&rdquo;
                  </p>
                  <div style={{ display: "flex", gap: 24, fontSize: 12, color: "var(--muted)", marginBottom: 20, flexWrap: "wrap" }}>
                    <span>Actor: <code style={{ color: "var(--text)", fontSize: 11 }}>{m.context.actor.id}</code> ({m.context.actor.type})</span>
                    {m.context.domain && <span>Domain: <strong style={{ color: "var(--text)", fontWeight: 600 }}>{m.context.domain}</strong></span>}
                  </div>

                  {/* Gaps */}
                  <details open style={{ marginBottom: 14 }}>
                    <summary style={{ fontSize: 13, fontWeight: 600, color: "#D29922", padding: "4px 0" }}>
                      <span className="arrow" style={{ marginRight: 6, fontSize: 10 }}>▶</span>
                      Gaps ({mGaps.length})
                    </summary>
                    <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                      {mGaps.map(gap => (
                        <div key={gap.id} style={{
                          background: "var(--surface-2)", border: "1px solid var(--border)",
                          borderRadius: 6, padding: "12px 14px",
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8, flexWrap: "wrap" }}>
                            <span style={{ fontFamily: "monospace", fontSize: 10, fontWeight: 700,
                              letterSpacing: "1px", color: "#D29922", opacity: 0.8 }}>GAP</span>
                            <Pill label={gap.state.status}   color={STATUS[gap.state.status]   ?? "#6E7681"} />
                            {gap.state.severity &&
                              <Pill label={gap.state.severity} color={SEVERITY[gap.state.severity] ?? "#6E7681"} />}
                            <Pill label={gap.evidenceGrade}  color={GRADE[gap.evidenceGrade]   ?? "#6E7681"} />
                            {gap.context.domain &&
                              <span style={{ fontSize: 11, color: "var(--muted)" }}>{gap.context.domain}</span>}
                            <code style={{ marginLeft: "auto", fontSize: 10, color: "var(--muted)" }}>{gap.id}</code>
                          </div>
                          <p style={{ fontSize: 13, lineHeight: 1.55, marginBottom: 10, color: "var(--text)" }}>
                            {gap.context.description}
                          </p>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            <span style={{ fontSize: 11, color: "var(--muted)", marginRight: 2 }}>values →</span>
                            {(gap.requiredValues ?? []).map(ref => <ValueChip key={ref.valueId} id={ref.valueId} />)}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>

                  {/* Required values */}
                  <details>
                    <summary style={{ fontSize: 13, fontWeight: 600, color: "#3FB950", padding: "4px 0" }}>
                      <span className="arrow" style={{ marginRight: 6, fontSize: 10 }}>▶</span>
                      Required Values ({mValues.length})
                    </summary>
                    <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {mValues.map(v => {
                        const c = VALUE_COLOR[v.id] ?? "#94A3B8";
                        return (
                          <span key={v.id} style={{
                            display: "inline-flex", flexDirection: "column", gap: 2,
                            padding: "8px 12px", borderRadius: 6,
                            background: c + "18", border: `1px solid ${c}40`,
                          }}>
                            <span style={{ fontSize: 13, fontWeight: 600, color: c }}>{v.context.label}</span>
                            {v.context.domain && <span style={{ fontSize: 11, color: "var(--muted)" }}>{v.context.domain}</span>}
                          </span>
                        );
                      })}
                    </div>
                  </details>
                </div>
              </div>
            </section>
          );
        })}

        {/* ── Values grid ── */}
        <hr style={{ border: "none", borderTop: "1px solid var(--border)", marginBottom: 28 }} />

        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.3px", marginBottom: 6 }}>
            Values <span style={{ fontWeight: 400, color: "var(--muted)", fontSize: 14 }}>— {values.length} Candidate</span>
          </h2>
          <p style={{ fontSize: 13, color: "var(--muted)" }}>
            The 12 universal goods in the PUDM chain. Every Gap points to the Values it requires to close.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {values.map(v => {
            const c    = VALUE_COLOR[v.id] ?? "#94A3B8";
            const cGaps = gapsByValueId.get(v.id) ?? [];
            return (
              <div key={v.id} style={{
                background: "var(--surface)",
                border: `1px solid ${c}30`,
                borderTop: `3px solid ${c}`,
                borderRadius: 6,
                padding: "14px 16px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 15, fontWeight: 700, color: c }}>{v.context.label}</span>
                  {v.context.domain && (
                    <span style={{ fontSize: 11, color: "var(--muted)", marginLeft: "auto" }}>{v.context.domain}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, lineHeight: 1.6, color: "var(--muted)", marginBottom: 10 }}>
                  {v.context.description}
                </p>
                {cGaps.length > 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.8 }}>
                    <span style={{ marginRight: 4 }}>Needed by:</span>
                    {cGaps.map((g, i) => (
                      <span key={g.id}>
                        <code style={{ color: c, fontSize: 11 }}>{g.id}</code>
                        {i < cGaps.length - 1 && <span style={{ color: "var(--border)" }}>, </span>}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 11, color: "var(--muted)", opacity: 0.4 }}>no gaps yet</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: 48, padding: "12px 16px",
          background: "var(--surface-2)", borderRadius: 6,
          fontSize: 11, color: "var(--muted)", fontFamily: "monospace",
        }}>
          Live · data/missions.json · data/gaps.json · data/values.json
          &nbsp;·&nbsp;Capability → Provider nodes pending
        </div>

      </main>
    </>
  );
}
