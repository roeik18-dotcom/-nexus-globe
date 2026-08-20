import type { Metadata } from "next";
import {
  ESSENCE_ONTOLOGY,
  ESSENCE_LAYER_ORDER,
  ESSENCE_FLOW,
  type EssenceLayer,
  type EssenceNode,
} from "../lib/essence/ontology";

export const metadata: Metadata = { title: "Essence · Philos Human Model" };

// ── Display constants ──────────────────────────────────────────────────────────

const LAYER_META: Record<EssenceLayer, { label: string; accent: string; description: string }> = {
  core: {
    label: "Core",
    accent: "#A78BFA",
    description: "What fundamentally defines this person — stable across years and contexts.",
  },
  aspirations: {
    label: "Aspirations",
    accent: "#34D399",
    description: "Where this person is going — the direction that Core produces.",
  },
  expression: {
    label: "Expression",
    accent: "#5B8CFF",
    description: "How this person shows up — the outward form of Core and Aspirations.",
  },
  identity: {
    label: "Identity",
    accent: "#FFB84D",
    description: "How this person is known — Expression crystallized through roles and context.",
  },
};

const STABILITY_COLOR: Record<string, string> = {
  Foundational: "#A78BFA",
  Stable:       "#34D399",
  Adaptive:     "#5B8CFF",
  Contextual:   "#FFB84D",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function nodesByLayer(layer: EssenceLayer): EssenceNode[] {
  return Object.values(ESSENCE_ONTOLOGY).filter(n => n.layer === layer);
}

// ── Sub-components (server) ────────────────────────────────────────────────────

function StabilityBadge({ stability }: { stability: string }) {
  const color = STABILITY_COLOR[stability] ?? "#cfe6f5";
  return (
    <span style={{
      fontSize: 12, fontWeight: 700, letterSpacing: "1.5px",
      textTransform: "uppercase" as const,
      color,
      background: color + "14",
      border: `1px solid ${color}30`,
      borderRadius: 3, padding: "2px 7px",
    }}>
      {stability}
    </span>
  );
}

function NodeCard({ node }: { node: EssenceNode }) {
  const layerAccent = LAYER_META[node.layer].accent;
  return (
    <div style={{
      background: "#030c18",
      border: `1px solid #0a1e2e`,
      borderRadius: 8,
      padding: "16px 18px",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: layerAccent }}>
          {node.name}
        </span>
        <StabilityBadge stability={node.stabilityClass} />
      </div>

      <p style={{ fontSize: 13, color: "#2a6a8a", lineHeight: 1.65, marginBottom: 10 }}>
        {node.definition}
      </p>

      <div style={{ fontSize: 12, color: "#0d2030", fontFamily: "var(--font-geist-mono), monospace", marginBottom: 6 }}>
        <span style={{ color: "#1a4060" }}>ownership: </span>
        {node.ownershipQuestion}
      </div>

      {node.examples.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#0f2a3e", marginBottom: 4 }}>
            Examples
          </div>
          <ul style={{ margin: 0, paddingLeft: 14 }}>
            {node.examples.slice(0, 3).map((ex, i) => (
              <li key={i} style={{ fontSize: 13, color: "#1a4060", lineHeight: 1.6 }}>
                {ex}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FlowArrow({ from, to }: { from: EssenceLayer; to: EssenceLayer }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, color: "#0f2030",
      fontFamily: "var(--font-geist-mono), monospace",
      padding: "4px 0",
    }}>
      <span style={{ color: LAYER_META[from].accent }}>{LAYER_META[from].label}</span>
      <span style={{ color: "#0a1e2e" }}>──→</span>
      <span style={{ color: LAYER_META[to].accent }}>{LAYER_META[to].label}</span>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function EssencePage() {
  const flowEdges: Array<[EssenceLayer, EssenceLayer]> = ESSENCE_LAYER_ORDER.flatMap(from =>
    (ESSENCE_FLOW[from] ?? []).map(to => [from, to] as [EssenceLayer, EssenceLayer])
  );

  return (
    <main style={{
      minHeight: "100dvh",
      background: "#020d1a",
      color: "#cfe6f5",
      fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
      padding: "48px 20px 80px",
    }}>
      <div style={{ maxWidth: 960, margin: "0 auto" }}>

        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block",
            background: "rgba(167,139,250,0.08)",
            border: "1px solid rgba(167,139,250,0.2)",
            borderRadius: 4, padding: "3px 10px", marginBottom: 16,
            fontSize: 12, fontWeight: 700, letterSpacing: "2px",
            textTransform: "uppercase" as const, color: "#A78BFA",
          }}>
            Philos Human Model
          </div>
          <h1 style={{
            fontSize: 22, fontWeight: 600, color: "#e0f0ff",
            letterSpacing: "-0.3px", marginBottom: 10, lineHeight: 1.4,
            maxWidth: 580,
          }}>
            Essence — the canonical model of who the user is.
          </h1>
          <p style={{ fontSize: 15, color: "#2a4a64", maxWidth: 520, lineHeight: 1.7, marginBottom: 24 }}>
            All agents query Essence. No agent maintains an independent user model.
            Observations feed the semantic pipeline; interpretations are derived, not assumed.
          </p>

          {/* DAG flow diagram */}
          <div style={{
            background: "#030c18",
            border: "1px solid #0a1e2e",
            borderRadius: 8,
            padding: "16px 20px",
            display: "inline-block",
          }}>
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#0f2030", marginBottom: 10 }}>
              Generative flow (DAG)
            </div>
            <div style={{ display: "flex", flexDirection: "column" as const, gap: 2 }}>
              {flowEdges.map(([from, to]) => (
                <FlowArrow key={`${from}-${to}`} from={from} to={to} />
              ))}
            </div>
          </div>
        </div>

        {/* Layer sections */}
        {ESSENCE_LAYER_ORDER.map(layer => {
          const meta = LAYER_META[layer];
          const nodes = nodesByLayer(layer);
          return (
            <section key={layer} style={{ marginBottom: 48 }}>
              {/* Layer header */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 6 }}>
                  <h2 style={{
                    fontSize: 16, fontWeight: 700, color: meta.accent,
                    letterSpacing: "-0.2px",
                  }}>
                    {meta.label}
                  </h2>
                  <span style={{
                    fontSize: 12, fontWeight: 700, letterSpacing: "1.5px",
                    textTransform: "uppercase" as const,
                    color: meta.accent + "99",
                  }}>
                    {nodes.length} nodes
                  </span>
                </div>
                <p style={{ fontSize: 13, color: "#1a3a55", maxWidth: 480 }}>
                  {meta.description}
                </p>
              </div>

              {/* Node grid */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 12,
              }}>
                {nodes.map(node => (
                  <NodeCard key={node.id} node={node} />
                ))}
              </div>
            </section>
          );
        })}

        {/* Pipeline note */}
        <div style={{
          background: "#030c18",
          border: "1px solid #0a1e2e",
          borderRadius: 8,
          padding: "16px 20px",
          marginBottom: 48,
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: "1.5px", textTransform: "uppercase" as const, color: "#0f2030", marginBottom: 10 }}>
            Semantic pipeline
          </div>
          <div style={{
            fontSize: 13,
            color: "#1a4060",
            fontFamily: "var(--font-geist-mono), monospace",
            lineHeight: 2,
          }}>
            {[
              "Observation",
              "→ Classification",
              "→ Normalization",
              "→ Candidate Interpretation",
              "→ Evidence Evaluation",
              "→ Conflict Detection",
              "→ Write Policy",
              "→ Proposal | Accepted Interpretation",
              "→ Canonical Essence",
            ].map((step, i) => (
              <div key={i} style={{ color: i === 0 ? "#2a6a8a" : i === 8 ? "#A78BFA" : "#1a4060" }}>
                {step}
              </div>
            ))}
          </div>
          <p style={{ fontSize: 13, color: "#0d2030", marginTop: 10, lineHeight: 1.6 }}>
            No interpretation writes directly to Canonical Essence.
            Evidence is cross-domain infrastructure — referenced here, not owned here.
          </p>
        </div>

        {/* Footer */}
        <div style={{
          borderTop: "1px solid #071420", paddingTop: 16,
          fontSize: 13, color: "#0d1e2e",
          fontFamily: "var(--font-geist-mono), monospace",
        }}>
          Essence · Human Model v1 · Ontology: {Object.keys(ESSENCE_ONTOLOGY).length} nodes · All data is Candidate grade
        </div>

      </div>
    </main>
  );
}
