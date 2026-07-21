import type { EvidenceGrade } from "@/app/lib/types";

const GITHUB = "https://github.com/roeik18-dotcom/-nexus-globe/blob/main";

// ── Types ─────────────────────────────────────────────────────────────────────

type DocKind = "Research" | "Documentation";
type Tier    = "foundation" | "architecture" | "engine";

interface ResearchItem {
  title:       string;
  description: string;
  grade:       EvidenceGrade;
  tier:        Tier;
  sourcePath:  string;
  kind:        DocKind;
  href:        string;
}

interface SimulationEntry {
  filename: string;
  label:    string;
  stage:    string;
  result:   string;
  pass:     boolean;
}

interface VisualItem {
  title:       string;
  description: string;
  sourcePath:  string;
  href:        string;
}

// ── Data ──────────────────────────────────────────────────────────────────────
//
// Grade is a first-class field here. "Grade: X" text has been removed from
// descriptions and normalised into the typed `grade` field — one-time,
// local to this file. data/*.json is unchanged.

const RESEARCH: ResearchItem[] = [
  // — Foundations ——————————————————————————————————————————————————————————
  {
    title:       "Research Charter",
    description: "Epistemic rules, evidence grades, §6.1 forbidden moves, H9/G9 distinction, stop conditions.",
    grade:       "Frozen",
    tier:        "foundation",
    sourcePath:  "docs/research-charter.md",
    kind:        "Research",
    href:        `${GITHUB}/docs/research-charter.md`,
  },
  {
    title:       "Reality Flow v0",
    description: "Layer 0: Matter + Space + Time axiom, 5 physical laws, energy flow foundations.",
    grade:       "Candidate",
    tier:        "foundation",
    sourcePath:  "docs/philos-reality-flow-v0.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/philos-reality-flow-v0.md`,
  },
  // — Architecture —————————————————————————————————————————————————————————
  {
    title:       "OPM Specification",
    description: "Orientation Process Model — 9 dimensions, dimensionPressure, dimensionDeficit, capacity.",
    grade:       "Candidate",
    tier:        "architecture",
    sourcePath:  "docs/philos-opm-spec.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/philos-opm-spec.md`,
  },
  {
    title:       "Marketplace Core v0",
    description: "Entity taxonomy, constraint graph, Invariants I1–I5, §7 Evidence Layers (Intent / Behavior / Outcomes).",
    grade:       "Candidate",
    tier:        "architecture",
    sourcePath:  "docs/marketplace-core-v0.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/marketplace-core-v0.md`,
  },
  {
    title:       "Evidence Roadmap",
    description: "Per-claim evidence grades across FEP falsification, Marketplace, M9, and Application tracks. Living index.",
    grade:       "Candidate",
    tier:        "architecture",
    sourcePath:  "docs/evidence-roadmap.md",
    kind:        "Research",
    href:        `${GITHUB}/docs/evidence-roadmap.md`,
  },
  // — Engines ——————————————————————————————————————————————————————————————
  {
    title:       "Marketplace Dynamics v0",
    description: "Matching Engine, Resolution Engine, update equations. Value Fusion §10.3.",
    grade:       "Candidate",
    tier:        "engine",
    sourcePath:  "docs/marketplace-dynamics-v0.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/marketplace-dynamics-v0.md`,
  },
  {
    title:       "Transition Engine",
    description: "Energy flow laws T1–T7, 6 force classes, 18 channels. Stability tests passed for 5 cases.",
    grade:       "Candidate",
    tier:        "engine",
    sourcePath:  "docs/transition-engine-v0.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/transition-engine-v0.md`,
  },
  {
    title:       "Case Pattern Engine",
    description: "Human Pattern Engine spec — case schema, similarity rules, pattern matching.",
    grade:       "Candidate",
    tier:        "engine",
    sourcePath:  "docs/human-pattern-engine-v0.md",
    kind:        "Documentation",
    href:        `${GITHUB}/docs/human-pattern-engine-v0.md`,
  },
];

const SIMULATIONS: SimulationEntry[] = [
  { filename: "stage0_null_fep.png",                label: "FEP Null Model",                  stage: "Stage 0a",          result: "max h = 3.78×10⁻¹² — PASS",                  pass: true },
  { filename: "stage0b_arch_convergence.png",        label: "5-var Constraint Graph",          stage: "Stage 0b-arch",     result: "ρ(A) = 0.62, 500/500 inits — PASS",           pass: true },
  { filename: "stage0c_arch_convergence.png",        label: "α×β Convergence Sweep",           stage: "Stage 0c-arch",     result: "Operating region 100% Type A — PASS",          pass: true },
  { filename: "stage0d_arch_convergence.png",        label: "10-var Marketplace",              stage: "Stage 0d-arch",     result: "ρ(W) = 0.70, operating region stable — PASS",  pass: true },
  { filename: "transition_engine_trajectories.png",  label: "Transition Engine Trajectories",  stage: "Transition Engine", result: "5 cases stable",                               pass: true },
  { filename: "transition_engine_stability.png",     label: "Transition Engine Stability",     stage: "Transition Engine", result: "Stability confirmed",                          pass: true },
];

const VISUALS: VisualItem[] = [
  { title: "Philos World Map",       description: "Orbital ecosystem map — 15 user entry points, OPM + Marketplace twin engines, evidence layer coloring.", sourcePath: "artifacts/visuals/philos-world.html",   href: "/artifacts/philos-world.html" },
  { title: "AI Agents Architecture", description: "System architecture one-pager — 4 layers, 12 concepts, JS-generated knowledge graph, Hebrew bilingual.", sourcePath: "artifacts/visuals/ai-agents-v5.html",   href: "/artifacts/ai-agents-v5.html" },
  { title: "Project Status Map",     description: "Philos / Nexus Globe project status — completed work, missing items, work order, time estimates.",        sourcePath: "artifacts/visuals/project-status.html", href: "/artifacts/project-status.html" },
];

// ── Derived state (computed from typed data, not parsed from strings) ─────────

const FROZEN_COUNT          = RESEARCH.filter(r => r.grade === "Frozen").length;
const CANDIDATE_COUNT       = RESEARCH.filter(r => r.grade === "Candidate").length;
const PASS_COUNT            = SIMULATIONS.filter(s => s.pass).length;
const EMPIRICAL_VALIDATION  = 0 as const; // 0 Behavior · 0 Outcomes signals in data/*.json

const FOUNDATIONS  = RESEARCH.filter(r => r.tier === "foundation");
const ARCHITECTURE = RESEARCH.filter(r => r.tier === "architecture");
const ENGINES      = RESEARCH.filter(r => r.tier === "engine");

// ── Style maps ────────────────────────────────────────────────────────────────

const KIND_STYLE: Record<DocKind, { bg: string; fg: string }> = {
  Research:      { bg: "rgba(255,184,77,0.14)",  fg: "#FFB84D" },
  Documentation: { bg: "rgba(163,113,247,0.14)", fg: "#A371F7" },
};

const GRADE_STYLE: Record<EvidenceGrade, { bg: string; fg: string }> = {
  "Frozen":          { bg: "rgba(106,174,245,0.14)", fg: "#6aaef5" },
  "Candidate":       { bg: "rgba(240,192,96,0.14)",  fg: "#f0c060" },
  "Placeholder":     { bg: "rgba(163,113,247,0.14)", fg: "#A371F7" },
  "Not established": { bg: "rgba(232,120,120,0.14)", fg: "#e87878" },
};

// ── Components ────────────────────────────────────────────────────────────────

const CHIP: React.CSSProperties = {
  display:       "inline-block",
  padding:       "2px 7px",
  borderRadius:  3,
  fontSize:      10,
  fontWeight:    700,
  letterSpacing: "0.5px",
  textTransform: "uppercase" as const,
};

function KindBadge({ kind }: { kind: DocKind }) {
  const s = KIND_STYLE[kind];
  return <span style={{ ...CHIP, background: s.bg, color: s.fg }}>{kind}</span>;
}

function GradeChip({ grade }: { grade: EvidenceGrade }) {
  const s = GRADE_STYLE[grade];
  return <span style={{ ...CHIP, background: s.bg, color: s.fg }}>{grade}</span>;
}

const CARD_BASE: React.CSSProperties = {
  display:         "flex",
  flexDirection:   "column" as const,
  background:      "#060f1c",
  border:          "1px solid #0c1e35",
  borderRadius:    7,
  padding:         "15px 17px",
  textDecoration:  "none",
  color:           "inherit",
};

function ResearchCard({ item }: { item: ResearchItem }) {
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer" style={CARD_BASE}>
      <div style={{ display: "flex", gap: 5, marginBottom: 8, flexWrap: "wrap" as const }}>
        <KindBadge kind={item.kind} />
        <GradeChip grade={item.grade} />
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#cfe6f5", marginBottom: 6, lineHeight: 1.3 }}>
        {item.title}
      </div>
      <div style={{ fontSize: 12, color: "#4a6a88", lineHeight: 1.6, flexGrow: 1, marginBottom: 12 }}>
        {item.description}
      </div>
      <div style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace", fontSize: 10.5, color: "#1e3a52" }}>
        {item.sourcePath}
      </div>
    </a>
  );
}

function SimCard({ s }: { s: SimulationEntry }) {
  return (
    <a
      href={`/artifacts/simulation/${s.filename}`}
      target="_blank"
      rel="noopener noreferrer"
      style={CARD_BASE}
    >
      <div style={{ display: "flex", gap: 5, alignItems: "center", marginBottom: 8 }}>
        <span style={{ ...CHIP, background: "rgba(45,168,144,0.14)", color: "#2DA890" }}>Simulation</span>
        {s.pass && (
          <span style={{ ...CHIP, background: "rgba(75,184,122,0.14)", color: "#4bb87a" }}>PASS</span>
        )}
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#cfe6f5", marginBottom: 4 }}>
        {s.label}
      </div>
      <div style={{ fontSize: 12, color: "#4a6a88", marginBottom: 12, flexGrow: 1 }}>
        {s.stage} — {s.result}
      </div>
      <div style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace", fontSize: 10.5, color: "#1e3a52" }}>
        research/simulation/output/{s.filename}
      </div>
    </a>
  );
}

function VisualCard({ item }: { item: VisualItem }) {
  return (
    <a href={item.href} target="_blank" rel="noopener noreferrer" style={CARD_BASE}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ ...CHIP, background: "rgba(91,140,255,0.12)", color: "#5B8CFF" }}>Projection</span>
      </div>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: "#cfe6f5", marginBottom: 6, lineHeight: 1.3 }}>
        {item.title}
      </div>
      <div style={{ fontSize: 12, color: "#4a6a88", lineHeight: 1.6, flexGrow: 1, marginBottom: 12 }}>
        {item.description}
      </div>
      <div style={{ fontFamily: "var(--font-geist-mono), 'Courier New', monospace", fontSize: 10.5, color: "#1e3a52" }}>
        {item.sourcePath}
      </div>
    </a>
  );
}

function SectionHead({ label, step }: { label: string; step: string }) {
  return (
    <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 14 }}>
      <span style={{ fontFamily: "var(--font-geist-mono), monospace", fontSize: 10, color: "#0d2540", fontWeight: 700 }}>
        {step}
      </span>
      <h2 style={{ fontSize: 10, fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase" as const, color: "#1a3550" }}>
        {label}
      </h2>
    </div>
  );
}

const GRID: React.CSSProperties = {
  display:             "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(255px, 1fr))",
  gap:                 10,
};

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LabPage() {
  return (
    <div
      style={{
        minHeight:  "100dvh",
        background: "#020d1a",
        color:      "#cfe6f5",
        fontFamily: "var(--font-geist-sans), system-ui, sans-serif",
        padding:    "40px 24px 80px",
      }}
    >
      <div style={{ maxWidth: 920, margin: "0 auto" }}>

        {/* ── Header ── */}
        <header style={{ borderBottom: "1px solid #0a1e30", paddingBottom: 24, marginBottom: 32 }}>
          <div
            style={{
              display:       "inline-block",
              background:    "rgba(255,107,107,0.10)",
              border:        "1px solid rgba(255,107,107,0.22)",
              borderRadius:  4,
              padding:       "2px 9px",
              fontSize:      10,
              fontWeight:    700,
              letterSpacing: "1.5px",
              textTransform: "uppercase" as const,
              color:         "#ff6b6b",
              marginBottom:  14,
            }}
          >
            Not product UI
          </div>
          <h1 style={{ fontSize: 24, fontWeight: 600, letterSpacing: "-0.3px", color: "#e0f0ff", marginBottom: 8 }}>
            Lab
          </h1>
          <p style={{ fontSize: 13.5, color: "#3a5a78", maxWidth: 520, lineHeight: 1.6 }}>
            Research artifacts and visual references — not product UI. All items are read-only.
          </p>
        </header>

        {/* ── Summary strip ── */}
        <div
          style={{
            display:      "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
            gap:          8,
            marginBottom: 12,
          }}
        >
          {/* Frozen */}
          <div style={{ background: "#060f1c", border: "1px solid #0c1e35", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#6aaef5", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
              {FROZEN_COUNT}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#1a3a5a" }}>
              Frozen
            </div>
          </div>
          {/* Candidate */}
          <div style={{ background: "#060f1c", border: "1px solid #0c1e35", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f0c060", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
              {CANDIDATE_COUNT}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#1a3a5a" }}>
              Candidate
            </div>
          </div>
          {/* Simulation PASS */}
          <div style={{ background: "#060f1c", border: "1px solid #0c1e35", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#4bb87a", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
              {PASS_COUNT} / {SIMULATIONS.length}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#1a3a5a" }}>
              Simulation PASS
            </div>
          </div>
          {/* Empirical validation */}
          <div style={{ background: "#060f1c", border: "1px solid #0c1e35", borderRadius: 7, padding: "12px 16px" }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#4a6a88", fontVariantNumeric: "tabular-nums", lineHeight: 1, marginBottom: 4 }}>
              {EMPIRICAL_VALIDATION}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" as const, color: "#1a3a5a" }}>
              Empirical validation
            </div>
          </div>
        </div>

        {/* Evidence state line */}
        <div
          style={{
            fontSize:     11,
            color:        "#1e3a52",
            fontFamily:   "var(--font-geist-mono), 'Courier New', monospace",
            marginBottom: 44,
            letterSpacing: "0.3px",
          }}
        >
          Signal: Intent only · 0 Behavior · 0 Outcomes
        </div>

        {/* ── 01 Foundations ── */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Foundations" step="01" />
          <div style={GRID}>
            {FOUNDATIONS.map(item => <ResearchCard key={item.sourcePath} item={item} />)}
          </div>
        </section>

        {/* ── 02 Architecture ── */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Architecture" step="02" />
          <div style={GRID}>
            {ARCHITECTURE.map(item => <ResearchCard key={item.sourcePath} item={item} />)}
          </div>
        </section>

        {/* ── 03 Engines ── */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Engines" step="03" />
          <div style={GRID}>
            {ENGINES.map(item => <ResearchCard key={item.sourcePath} item={item} />)}
          </div>
        </section>

        {/* ── 04 Experiments ── */}
        <section style={{ marginBottom: 44 }}>
          <SectionHead label="Experiments" step="04" />
          <div style={GRID}>
            {SIMULATIONS.map(s => <SimCard key={s.filename} s={s} />)}
          </div>
        </section>

        {/* ── 05 Results ── */}
        <section style={{ marginBottom: 52 }}>
          <SectionHead label="Results" step="05" />
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8 }}>

            {/* Simulation outcome */}
            <div
              style={{
                background:   "#060f1c",
                border:       "1px solid #0c1e35",
                borderLeft:   "3px solid #4bb87a",
                borderRadius: 7,
                padding:      "14px 17px",
                display:      "flex",
                alignItems:   "baseline",
                gap:          12,
                flexWrap:     "wrap" as const,
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: "#cfe6f5" }}>
                {PASS_COUNT} / {SIMULATIONS.length} simulations — stable outcome
              </span>
              <span style={{ fontSize: 11, color: "#4a6a88" }}>
                Simulation only. These are computational runs, not empirical validation.
              </span>
            </div>

            {/* Empirical validation */}
            <div
              style={{
                background:   "#060f1c",
                border:       "1px solid #0c1e35",
                borderLeft:   "3px solid #1e3a52",
                borderRadius: 7,
                padding:      "14px 17px",
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, color: "#cfe6f5", marginBottom: 4 }}>
                Empirical validation: {EMPIRICAL_VALIDATION}
              </div>
              <div style={{ fontSize: 11, color: "#4a6a88", lineHeight: 1.6 }}>
                No Behavior or Outcomes signals recorded in any entity or relation file.
                All evidence signals are Intent only.
              </div>
            </div>

            {/* Active test empty state */}
            <div
              style={{
                background:   "#060f1c",
                border:       "1px solid #0c1e35",
                borderRadius: 7,
                padding:      "14px 17px",
                fontSize:     11,
                color:        "#1e3a52",
                fontFamily:   "var(--font-geist-mono), 'Courier New', monospace",
              }}
            >
              No active-test status is recorded in the repository.
            </div>

          </div>
        </section>

        {/* ── Projections (secondary) ── */}
        <div style={{ borderTop: "1px solid #0a1e30", paddingTop: 32, marginBottom: 44 }}>
          <SectionHead label="Projections" step="—" />
          <p style={{ fontSize: 11, color: "#1a3550", marginBottom: 14 }}>
            Visual representations derived from the model. Not primary documents.
          </p>
          <div style={GRID}>
            {VISUALS.map(item => <VisualCard key={item.sourcePath} item={item} />)}
          </div>
        </div>

        {/* ── Footer ── */}
        <footer
          style={{
            borderTop:       "1px solid #0a1e30",
            marginTop:       20,
            paddingTop:      18,
            display:         "flex",
            justifyContent:  "space-between",
            flexWrap:        "wrap" as const,
            gap:             8,
          }}
        >
          <span style={{ fontSize: 11, color: "#102030", fontFamily: "var(--font-geist-mono), monospace" }}>
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
