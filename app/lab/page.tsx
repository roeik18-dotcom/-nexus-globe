const GITHUB = "https://github.com/roeik18-dotcom/-nexus-globe/blob/main";

type Kind = "Visual" | "Research" | "Documentation" | "Simulation";

interface Item {
  title: string;
  description: string;
  sourcePath: string;
  kind: Kind;
  href: string;
}

const VISUALS: Item[] = [
  {
    title: "Philos World Map",
    description:
      "Orbital ecosystem map — 15 user entry points, OPM + Marketplace twin engines, evidence layer coloring.",
    sourcePath: "artifacts/visuals/philos-world.html",
    kind: "Visual",
    href: "/artifacts/philos-world.html",
  },
  {
    title: "AI Agents Architecture",
    description:
      "System architecture one-pager — 4 layers, 12 concepts, JS-generated knowledge graph, Hebrew bilingual.",
    sourcePath: "artifacts/visuals/ai-agents-v5.html",
    kind: "Visual",
    href: "/artifacts/ai-agents-v5.html",
  },
  {
    title: "Project Status Map",
    description:
      "Philos / Nexus Globe project status — completed work, missing items, work order, time estimates.",
    sourcePath: "artifacts/visuals/project-status.html",
    kind: "Visual",
    href: "/artifacts/project-status.html",
  },
];

const RESEARCH: Item[] = [
  {
    title: "Research Charter",
    description:
      "Epistemic rules, evidence grades, §6.1 forbidden moves, H9/G9 distinction, stop conditions. Grade: Frozen.",
    sourcePath: "docs/research-charter.md",
    kind: "Research",
    href: `${GITHUB}/docs/research-charter.md`,
  },
  {
    title: "Evidence Roadmap",
    description:
      "Per-claim evidence grades across FEP falsification, Marketplace, M9, and Application tracks. Living index.",
    sourcePath: "docs/evidence-roadmap.md",
    kind: "Research",
    href: `${GITHUB}/docs/evidence-roadmap.md`,
  },
  {
    title: "OPM Specification",
    description:
      "Orientation Process Model — 9 dimensions, dimensionPressure, dimensionDeficit, capacity. Grade: Candidate.",
    sourcePath: "docs/philos-opm-spec.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/philos-opm-spec.md`,
  },
  {
    title: "Marketplace Core v0",
    description:
      "Entity taxonomy, constraint graph, Invariants I1–I5, §7 Evidence Layers (Intent / Behavior / Outcomes).",
    sourcePath: "docs/marketplace-core-v0.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/marketplace-core-v0.md`,
  },
  {
    title: "Marketplace Dynamics v0",
    description:
      "Matching Engine, Resolution Engine, update equations. Value Fusion §10.3 — Grade: Candidate.",
    sourcePath: "docs/marketplace-dynamics-v0.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/marketplace-dynamics-v0.md`,
  },
  {
    title: "Transition Engine",
    description:
      "Energy flow laws T1–T7, 6 force classes, 18 channels. Stability tests passed for 5 cases.",
    sourcePath: "docs/transition-engine-v0.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/transition-engine-v0.md`,
  },
  {
    title: "Case Pattern Engine",
    description:
      "Human Pattern Engine spec — case schema, similarity rules, pattern matching. Grade: Candidate.",
    sourcePath: "docs/human-pattern-engine-v0.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/human-pattern-engine-v0.md`,
  },
  {
    title: "Reality Flow v0",
    description:
      "Layer 0: Matter + Space + Time axiom, 5 physical laws, energy flow foundations.",
    sourcePath: "docs/philos-reality-flow-v0.md",
    kind: "Documentation",
    href: `${GITHUB}/docs/philos-reality-flow-v0.md`,
  },
];

const SIMULATIONS: Array<{
  filename: string;
  label: string;
  stage: string;
  result: string;
}> = [
  {
    filename: "stage0_null_fep.png",
    label: "FEP Null Model",
    stage: "Stage 0a",
    result: "max h = 3.78×10⁻¹² — PASS",
  },
  {
    filename: "stage0b_arch_convergence.png",
    label: "5-var Constraint Graph",
    stage: "Stage 0b-arch",
    result: "ρ(A) = 0.62, 500/500 inits — PASS",
  },
  {
    filename: "stage0c_arch_convergence.png",
    label: "α×β Convergence Sweep",
    stage: "Stage 0c-arch",
    result: "Operating region 100% Type A — PASS",
  },
  {
    filename: "stage0d_arch_convergence.png",
    label: "10-var Marketplace",
    stage: "Stage 0d-arch",
    result: "ρ(W) = 0.70, operating region stable — PASS",
  },
  {
    filename: "transition_engine_trajectories.png",
    label: "Transition Engine Trajectories",
    stage: "Transition Engine",
    result: "5 cases stable",
  },
  {
    filename: "transition_engine_stability.png",
    label: "Transition Engine Stability",
    stage: "Transition Engine",
    result: "Stability confirmed",
  },
];

const KIND_STYLE: Record<Kind, { bg: string; fg: string }> = {
  Visual:        { bg: "rgba(91,140,255,0.14)",  fg: "#5B8CFF" },
  Research:      { bg: "rgba(255,184,77,0.14)",  fg: "#FFB84D" },
  Documentation: { bg: "rgba(163,113,247,0.14)", fg: "#A371F7" },
  Simulation:    { bg: "rgba(45,168,144,0.14)",  fg: "#2DA890" },
};

function Badge({ kind }: { kind: Kind }) {
  const s = KIND_STYLE[kind];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 7px",
        borderRadius: 3,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.5px",
        textTransform: "uppercase" as const,
        background: s.bg,
        color: s.fg,
      }}
    >
      {kind}
    </span>
  );
}

function Card({ item }: { item: Item }) {
  return (
    <a
      href={item.href}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "flex",
        flexDirection: "column" as const,
        gap: 0,
        background: "#060f1c",
        border: "1px solid #0c1e35",
        borderRadius: 7,
        padding: "15px 17px",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div style={{ marginBottom: 8 }}>
        <Badge kind={item.kind} />
      </div>
      <div
        style={{
          fontSize: 13.5,
          fontWeight: 600,
          color: "#cfe6f5",
          marginBottom: 6,
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </div>
      <div
        style={{
          fontSize: 12,
          color: "#4a6a88",
          lineHeight: 1.6,
          flexGrow: 1,
          marginBottom: 12,
        }}
      >
        {item.description}
      </div>
      <div
        style={{
          fontFamily: "var(--font-geist-mono), 'Courier New', monospace",
          fontSize: 10.5,
          color: "#1e3a52",
        }}
      >
        {item.sourcePath}
      </div>
    </a>
  );
}

function SectionHead({ label }: { label: string }) {
  return (
    <h2
      style={{
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "2.5px",
        textTransform: "uppercase" as const,
        color: "#1a3550",
        marginBottom: 14,
      }}
    >
      {label}
    </h2>
  );
}

const GRID: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
  gap: 10,
};

export default function LabPage() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#020d1a",
        color: "#cfe6f5",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding: "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* Header */}
        <header
          style={{
            borderBottom: "1px solid #0a1e30",
            paddingBottom: 24,
            marginBottom: 44,
          }}
        >
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
              marginBottom: 14,
            }}
          >
            Not product UI
          </div>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: "-0.3px",
              color: "#e0f0ff",
              marginBottom: 8,
            }}
          >
            Lab
          </h1>
          <p style={{ fontSize: 13.5, color: "#3a5a78", maxWidth: 520, lineHeight: 1.6 }}>
            Research artifacts and visual references — not product UI. All items are read-only.
          </p>
        </header>

        {/* Visual Artifacts */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Visual Artifacts" />
          <div style={GRID}>
            {VISUALS.map((item) => (
              <Card key={item.sourcePath} item={item} />
            ))}
          </div>
        </section>

        {/* Research & Documentation */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Research & Documentation" />
          <div style={GRID}>
            {RESEARCH.map((item) => (
              <Card key={item.sourcePath} item={item} />
            ))}
          </div>
        </section>

        {/* Simulation Outputs */}
        <section>
          <SectionHead label="Simulation Outputs" />
          <div style={GRID}>
            {SIMULATIONS.map((s) => (
              <a
                key={s.filename}
                href={`/artifacts/simulation/${s.filename}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "flex",
                  flexDirection: "column" as const,
                  background: "#060f1c",
                  border: "1px solid #0c1e35",
                  borderRadius: 7,
                  padding: "15px 17px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ marginBottom: 8 }}>
                  <Badge kind="Simulation" />
                </div>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: "#cfe6f5",
                    marginBottom: 4,
                  }}
                >
                  {s.label}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: "#4a6a88",
                    marginBottom: 12,
                    flexGrow: 1,
                  }}
                >
                  {s.stage} — {s.result}
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-geist-mono), 'Courier New', monospace",
                    fontSize: 10.5,
                    color: "#1e3a52",
                  }}
                >
                  research/simulation/output/{s.filename}
                </div>
              </a>
            ))}
          </div>
        </section>

        {/* Footer */}
        <footer
          style={{
            borderTop: "1px solid #0a1e30",
            marginTop: 60,
            paddingTop: 18,
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
            /lab · Philos research index
          </span>
          <a href="/" style={{ fontSize: 11, color: "#1a3a5a", textDecoration: "none" }}>
            ← back to app
          </a>
        </footer>
      </div>
    </div>
  );
}
