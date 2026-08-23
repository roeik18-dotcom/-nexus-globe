/**
 * SystemGateFunnel — WORLD's own question, drawn.
 *
 * World is the SYSTEM terminal: its question is "what reaches system scale,
 * and what stops it". The data to answer that already exists, fully, in
 * `worldDataContract.ts` — a real four-stage pipeline with a real gate and a
 * per-record rejection ledger:
 *
 *   chronology (by provenance) → REAL upstream → [SYSTEM GATE] → eligible → observed
 *
 * It was rendered as four sentences and one bare `NO_EVIDENCE_RECORD 34` row,
 * so the single most important fact this terminal owns — that 34 real records
 * reach the gate and none pass it, for one dominant reason — read as an
 * inventory rather than as a blockage.
 *
 * This draws the pipeline: stage widths carry the real counts, and every
 * record lost between two stages leaves as a labelled branch with its own
 * reason. A total collapse at the gate is therefore VISIBLE as a collapse.
 *
 * HONESTY RULES THIS COMPONENT KEEPS:
 *   - Zero is drawn as zero. A stage with no records gets a hairline and the
 *     word, never a minimum-width bar that suggests survivors.
 *   - Provenance is never summed into one "upstream" number: REAL, DERIVED,
 *     DEMO and REFERENCE stay separate segments, because only REAL is a claim
 *     about the world.
 *   - The gate reason is the contract's own sentence (`system_zero_reason`),
 *     quoted, not re-worded here.
 *   - Nothing is inferred about WHY a reason occurred — the ledger's reason
 *     codes are printed as they are stored.
 */
import { COLOR, RADIUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface FunnelProvenance {
  real: number; derived: number; demo: number; reference: number;
}

const PROV_SEG: { key: keyof FunnelProvenance; color: string; label: string }[] = [
  { key: "real", color: "#34d399", label: "REAL" },
  { key: "derived", color: "#a78bfa", label: "DERIVED" },
  { key: "demo", color: "#fbbf24", label: "DEMO" },
  { key: "reference", color: "#5a6d92", label: "REFERENCE" },
];

/** Reason codes the ledger can store, glossed for a reader. Unknown codes
 *  fall through and print raw — never dropped, never renamed. */
const REASON_HE: Record<string, string> = {
  NO_EVIDENCE_RECORD: "אין רשומת ראיה",
  NO_EXTERNAL_VERIFICATION: "אין אימות חיצוני",
  NOT_SYSTEM_SCALE: "לא בקנה-מידה מערכתי",
  NO_WORLD_RELEVANCE_LINK: "אין קישור רלוונטיות עולמית",
};

export default function SystemGateFunnel({
  provenance, eligible, observed, externalVerified, evidenceRecords,
  rejections, unresolvedCandidates, zeroReason, groupEffect,
}: {
  provenance: FunnelProvenance;
  eligible: number;
  observed: number;
  externalVerified: number;
  evidenceRecords: number;
  rejections: readonly { reason: string; n: number }[];
  unresolvedCandidates: number;
  zeroReason: string | null;
  /** The REAL upstream outcome that exists but has not reached SYSTEM. */
  groupEffect: { statement: string; verified: number } | null;
}) {
  const total = provenance.real + provenance.derived + provenance.demo + provenance.reference;
  const stages = [
    { key: "chronology", label: "כרונולוגיה", term: "CHRONOLOGY", n: total,
      because: "כל הרשומות שנקראו, לפי פרובננס" },
    { key: "real", label: "אמיתי במעלה", term: "REAL UPSTREAM", n: provenance.real,
      because: "רק REAL הוא טענה על העולם" },
    { key: "eligible", label: "עומד בשער", term: "SYSTEM ELIGIBLE", n: eligible,
      because: "עבר את שער SYSTEM ללא שינוי" },
    { key: "observed", label: "נצפה בפועל", term: "OBSERVED AT SYSTEM", n: observed,
      because: "הוצב בפועל בקנה-מידה מערכתי" },
  ];
  const maxN = Math.max(...stages.map((s) => s.n), 1);
  const sortedRejections = [...rejections].sort((a, b) => b.n - a.n);

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>שער המערכת · SYSTEM GATE</div>
          <h2 style={S.title}>מה מגיע לקנה-מידה מערכתי — ומה עוצר אותו</h2>
        </div>
        <div style={S.headMeta}>
          <span style={S.chip}>{evidenceRecords} רשומות ראיה</span>
          <span style={{ ...S.chip, color: externalVerified ? "#34d399" : "#fbbf24" }}>
            {externalVerified} באימות חיצוני
          </span>
        </div>
      </header>

      {/* THE PIPELINE. Each stage is a bar whose width is its real count; the
          drop between two stages is drawn as a branch leaving the pipe. */}
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {stages.map((st, i) => {
          const prev = i > 0 ? stages[i - 1].n : null;
          const lost = prev !== null ? prev - st.n : 0;
          const isGate = st.key === "eligible";
          return (
            <div key={st.key}>
              {/* DROP-OUT BRANCH — what did not survive into this stage. */}
              {prev !== null && lost > 0 ? (
                <div style={S.branch}>
                  <span style={S.branchElbow} aria-hidden />
                  <span style={{ fontSize: 12.5, color: "#f87171", fontWeight: 700 }}>
                    −{lost.toLocaleString()}
                  </span>
                  <span style={{ fontSize: 12.5, color: COLOR.textDim }}>
                    {isGate
                      ? sortedRejections.length > 0
                        ? sortedRejections.map((r) =>
                            `${REASON_HE[r.reason] ?? r.reason} (${r.n})`).join(" · ")
                        : "נדחה בשער — הסיבה לא נרשמה"
                      : "לא REAL — פרובננס אחר, אינו טענה על העולם"}
                  </span>
                </div>
              ) : null}

              <div style={S.stageRow}>
                <span style={S.stageLabel}>
                  <span style={{ color: COLOR.text, fontWeight: 700 }}>{st.label}</span>
                  <span style={S.stageTerm}>{st.term}</span>
                </span>

                <span style={S.track}>
                  {st.n === 0 ? (
                    /* ZERO IS DRAWN AS ZERO — a hairline and the word, never a
                       minimum-width bar that would read as survivors. */
                    <span style={S.zeroLine}>
                      <span style={S.zeroWord}>0 — אף רשומה</span>
                    </span>
                  ) : st.key === "chronology" ? (
                    /* Provenance stays split: only REAL is a world claim. */
                    <span style={{ display: "flex", blockSize: 22, borderRadius: 4,
                      overflow: "hidden", inlineSize: `${(st.n / maxN) * 100}%` }}>
                      {PROV_SEG.map((p) => provenance[p.key] > 0 ? (
                        <i key={p.key} title={`${p.label} ${provenance[p.key]}`}
                          style={{ display: "block", blockSize: "100%",
                            inlineSize: `${(provenance[p.key] / st.n) * 100}%`,
                            background: p.color, opacity: 0.75 }} />
                      ) : null)}
                    </span>
                  ) : (
                    <span style={{ display: "block", blockSize: 22, borderRadius: 4,
                      inlineSize: `${(st.n / maxN) * 100}%`,
                      background: st.key === "observed" ? "#e6edf7" : "#34d399", opacity: 0.8 }} />
                  )}
                </span>

                <span style={S.stageN}>{st.n.toLocaleString()}</span>
              </div>
              <div style={S.stageBecause}>{st.because}</div>
            </div>
          );
        })}
      </div>

      {/* PROVENANCE KEY — only segments that occur. */}
      <div style={S.legend}>
        {PROV_SEG.filter((p) => provenance[p.key] > 0).map((p) => (
          <span key={p.key} style={S.legendItem}>
            <i style={{ inlineSize: 10, blockSize: 10, borderRadius: 2, background: p.color,
              display: "inline-block", opacity: 0.75 }} />
            {p.label} <b style={{ color: COLOR.text }}>{provenance[p.key]}</b>
          </span>
        ))}
        {unresolvedCandidates > 0 ? (
          <span style={{ ...S.legendItem, color: "#fbbf24" }}>
            {unresolvedCandidates} מועמדים מאומתים שלא חיצונית — &quot;קרוב, לא שם&quot;
          </span>
        ) : null}
      </div>

      {/* THE GATE'S OWN SENTENCE — quoted from the contract, not re-worded. */}
      {zeroReason ? (
        <div style={S.gateReason}>
          <span style={{ ...TYPE.micro, color: "#fbbf24" }}>למה SYSTEM = 0 · </span>
          {zeroReason}
        </div>
      ) : null}

      {/* UPSTREAM / DOWNSTREAM — the real effect that exists on one side of the
          gate, and the absence on the other. This is the dependency the
          terminal is actually reporting. */}
      {groupEffect ? (
        <div style={S.updown}>
          <div style={S.updownRow}>
            <span style={{ ...S.updownTag, color: "#34d399", borderColor: "rgba(52,211,153,0.4)" }}>
              במעלה · UPSTREAM
            </span>
            <span style={{ fontSize: 13, color: COLOR.text, lineHeight: 1.5 }}>
              {groupEffect.statement}
              <span style={{ color: COLOR.textFaint }}>
                {" "}· {groupEffect.verified} אפקטים מאומתים בקנה-מידה קבוצתי
              </span>
            </span>
          </div>
          <div style={S.updownArrow}>↓ תלוי ב: רשומת ראיה חיצונית מאומתת</div>
          <div style={S.updownRow}>
            <span style={{ ...S.updownTag, color: "#f87171", borderColor: "rgba(248,113,113,0.4)" }}>
              במורד · DOWNSTREAM
            </span>
            <span style={{ fontSize: 13, color: COLOR.textDim, lineHeight: 1.5 }}>
              לא נוצר — אין אירוע עולם, מקור מאומת או קישור WorldRelevance.
              האפקט הקבוצתי אמיתי ונשאר זמין לרלוונטיות עולמית כשתיווצר.
            </span>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(230,237,247,0.05), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`, borderRadius: 20,
    padding: "16px 20px 14px", margin: "0 20px 14px",
    display: "flex", flexDirection: "column", gap: 12,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end",
    justifyContent: "space-between", gap: 8 },
  eyebrow: { ...TYPE.micro, color: "#e6edf7", marginBottom: 4 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: COLOR.text },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 12, fontWeight: 700, color: COLOR.textDim,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px",
    fontFamily: "ui-monospace, monospace" },

  stageRow: { display: "flex", alignItems: "center", gap: 12 },
  stageLabel: { inlineSize: 168, flexShrink: 0, display: "flex", flexDirection: "column", gap: 1 },
  stageTerm: { ...TYPE.micro, fontSize: 11, color: COLOR.textFaint },
  track: { flex: 1, minInlineSize: 0, display: "block" },
  stageN: { inlineSize: 58, textAlign: "start", fontSize: 19, fontWeight: 800,
    color: COLOR.text, fontFamily: "ui-monospace, monospace", flexShrink: 0 },
  stageBecause: { fontSize: 11.5, color: COLOR.textFaint, marginInlineStart: 180,
    marginBlockEnd: 8 },

  zeroLine: { display: "flex", alignItems: "center", gap: 8, blockSize: 22 },
  zeroWord: { fontSize: 12, color: "#f87171", fontWeight: 700 },

  branch: { display: "flex", alignItems: "center", gap: 8, marginInlineStart: 180,
    marginBlockEnd: 4 },
  branchElbow: { inlineSize: 14, blockSize: 12, borderInlineStart: "2px solid rgba(248,113,113,0.5)",
    borderBlockEnd: "2px solid rgba(248,113,113,0.5)", borderEndStartRadius: 4, display: "block" },

  legend: { display: "flex", flexWrap: "wrap", gap: 14, alignItems: "center",
    fontSize: 12.5, color: COLOR.textDim, borderTop: `1px solid ${COLOR.border}`,
    paddingBlockStart: 10 },
  legendItem: { display: "inline-flex", alignItems: "center", gap: 6 },

  gateReason: { fontSize: 13, color: COLOR.textDim, lineHeight: 1.7,
    background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.25)",
    borderRadius: RADIUS.md, padding: "8px 12px" },

  updown: { borderTop: `1px solid ${COLOR.border}`, paddingBlockStart: 10,
    display: "flex", flexDirection: "column", gap: 6 },
  updownRow: { display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" },
  updownTag: { ...TYPE.micro, fontSize: 11, border: "1px solid", borderRadius: RADIUS.pill,
    padding: "2px 9px", flexShrink: 0 },
  updownArrow: { fontSize: 12, color: COLOR.textFaint, marginInlineStart: 6 },
};
