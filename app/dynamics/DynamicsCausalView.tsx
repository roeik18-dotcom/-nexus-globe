/**
 * DYNAMICS, AS A CAUSAL READING.
 *
 * The 15-row SYSTEM TRACE table stated every edge of the canon pipeline as
 * `from → to · linkage · status · ids · basis`. Every fact was there and the
 * one question the surface exists to answer — where does the chain break —
 * required reading fifteen rows to find three words.
 *
 * The reading order is the one Roei specified:
 *
 *   1 CURRENT STATE   what is true now, and how much of it is measured
 *   2 CHANGE          what moved, in which direction, over what window
 *   3 TENSIONS        contradictions and pressure, related where relations exist
 *   4 CAUSAL FLOW     the chain, drawn, with the breaks loudest
 *   5 ACTION          possible vs performed, never merged
 *   6 LEARNING        ACTION → EFFECT → EVIDENCE → LEARNING as one legible run
 *
 * Nothing is deleted. The full trace stays, one disclosure down, because a
 * table IS the right form for checking an individual edge against the store —
 * it is simply the wrong form for finding out whether anything is wrong.
 */
import CausalChain, { type ChainLink, type ChainStage } from "@/app/lib/philos/shell/CausalChain";
import SystemTracePanel from "@/app/lib/philos/shell/SystemTracePanel";
import type { TraceEdge } from "@/app/lib/philos/systemTrace";
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface DynamicsCausalInput {
  /** Measured cells out of nine — the honesty anchor for "current state". */
  observedCells: number;
  /** Real counts behind each stage of the canon pipeline. */
  counts: {
    observations: number; needs: number; offers: number; actions: number;
    effects: number; verifiedEffects: number; learnings: number | null;
  };
  /** Recorded contradictions, and how many are unresolved. */
  tensions: { label: string; status: string; detail: string }[];
  /** The full edge list — still rendered, one tier down. */
  edges: TraceEdge[];
  /** Window the records span. */
  window: { from: string; to: string } | null;
}

/** The canon pipeline as stages, newest cause first (RTL: rightmost). */
function buildChain(i: DynamicsCausalInput): { stages: ChainStage[]; links: ChainLink[] } {
  const c = i.counts;
  const stages: ChainStage[] = [
    { key: "obs", label: "תצפית", term: "OBSERVATION", count: c.observations, provenance: "REAL" },
    { key: "need", label: "צורך", term: "NEED", count: c.needs, provenance: "REAL" },
    { key: "offer", label: "הצעה", term: "OFFER", count: c.offers, provenance: "REAL" },
    { key: "action", label: "פעולה", term: "ACTION", count: c.actions, provenance: "REAL" },
    { key: "effect", label: "אפקט", term: "EFFECT", count: c.effects, provenance: "REAL" },
    { key: "evidence", label: "ראיה", term: "EVIDENCE", count: c.verifiedEffects, provenance: "REAL" },
    { key: "learning", label: "למידה", term: "LEARNING", count: c.learnings },
  ];

  /* Each link is classified from the EDGE LIST, never from the drawing. An
     edge the trace marks PARTIAL/UNLINKED becomes a drawn break; one it marks
     IMPLEMENTED becomes an arrow. The picture cannot disagree with the table
     below it because it is built from the same rows. */
  const find = (from: string, to: string) =>
    i.edges.find((e) => e.from.includes(from) && e.to.includes(to));

  const pairs: [number, string, string][] = [
    [0, "Observation", "Need"], [1, "Need", "Offer"], [2, "Match", "Action"],
    [3, "Action", "Effect"], [4, "Effect", "Evidence"], [5, "Learning", "State"],
  ];

  const links: ChainLink[] = pairs.map(([idx, a, b]) => {
    const e = find(a, b);
    return {
      from: idx,
      linkage: e?.linkage ?? "NO_LINK_POSSIBLE",
      status: e?.status ?? "MISSING_DATA",
      basis: e?.basis ?? "אין קשת מתועדת בין שני השלבים האלה",
    };
  });
  return { stages, links };
}

export default function DynamicsCausalView({ input }: { input: DynamicsCausalInput }) {
  const { stages, links } = buildChain(input);
  const c = input.counts;
  const unresolved = input.tensions.filter((t) => /UNRESOLVED|CONFLICT/i.test(t.status));

  return (
    <div dir="rtl" style={S.page}>
      {/* ── 1 · CURRENT STATE ─────────────────────────────────────────── */}
      <section style={S.block} aria-label="מצב נוכחי">
        <h2 style={S.h2}>מצב נוכחי · CURRENT STATE</h2>
        <div style={S.stateRow}>
          <Figure n={input.observedCells} of={9} label="תאי מדידה נשאו תצפית" term="MEASURED CELLS" />
          <Figure n={c.observations} label="תצפיות אמיתיות" term="OBSERVATIONS" />
          <Figure n={c.verifiedEffects} label="אפקטים מאומתים" term="VERIFIED EFFECTS"
                  tone={c.verifiedEffects > 0 ? STATUS.real.text : undefined} />
          {input.window ? (
            <span style={S.window}>
              <span style={S.figLabel}>חלון</span>
              <code style={S.mono}>{input.window.from} → {input.window.to}</code>
            </span>
          ) : null}
        </div>
        <p style={S.note}>
          תשעה תאים הם המרחב הנמדד המלא. תא ללא תצפית הוא <b>UNKNOWN</b> — לא אפס,
          ולא נקודת אמצע מומצאת.
        </p>
      </section>

      {/* ── 3 · TENSIONS (before the chain: pressure is why one reads it) ── */}
      <section style={S.block} aria-label="מתחים">
        <h2 style={S.h2}>מתחים · TENSIONS</h2>
        {input.tensions.length === 0 ? (
          <p style={S.empty}>אין ניגוד רשום. זו תשובה — לא רשימה ריקה.</p>
        ) : (
          <ul style={S.tensionList}>
            {input.tensions.map((t, i) => (
              <li key={i} style={{ ...S.tension, borderInlineStartColor: /UNRESOLVED|CONFLICT/i.test(t.status) ? STATUS.blocked.text : STATUS.claimed.text }}>
                <span style={S.tensionHead}>
                  <b style={S.tensionLabel}>{t.label}</b>
                  <span style={{ ...S.tensionStatus, color: /UNRESOLVED|CONFLICT/i.test(t.status) ? STATUS.blocked.text : STATUS.claimed.text }}>
                    {t.status}
                  </span>
                </span>
                <span style={S.tensionDetail}>{t.detail}</span>
              </li>
            ))}
          </ul>
        )}
        {unresolved.length > 0 ? (
          <p style={S.note}>
            {unresolved.length} מתוכם ללא הכרעה מתועדת. ניגוד פתוח אינו שגיאה —
            הוא מצב שהמערכת מחזיקה במפורש.
          </p>
        ) : null}
      </section>

      {/* ── 4 · CAUSAL FLOW ───────────────────────────────────────────── */}
      <section style={S.block} aria-label="זרימה סיבתית">
        <CausalChain
          title="זרימה סיבתית · CAUSAL FLOW"
          stages={stages}
          links={links}
          note="חץ מצויר רק כשקיימת הפניה מפורשת בין הרשומות. קו מקווקו הוא סדר זמנים בלבד — כרונולוגיה אינה סיבתיות — ושבר מצויר הוא רשומות שקיימות בלי הפניה ביניהן."
        />
      </section>

      {/* ── 5 · ACTION LAYER ──────────────────────────────────────────── */}
      <section style={S.block} aria-label="שכבת פעולה">
        <h2 style={S.h2}>שכבת פעולה · ACTION LAYER</h2>
        <div style={S.actionRow}>
          <div style={S.actionCol}>
            <span style={S.figLabel}>בוצע · PERFORMED</span>
            <span style={S.actionN}>{c.actions}</span>
            <span style={S.actionNote}>פעולות עם רשומה אמיתית</span>
          </div>
          <div style={{ ...S.actionCol, borderInlineStart: `1px solid ${COLOR.border}` }}>
            <span style={S.figLabel}>אפשרי · POSSIBLE</span>
            <span style={{ ...S.actionN, color: COLOR.textFaint }}>
              {c.needs > 0 && c.offers > 0 ? c.needs * c.offers : "—"}
            </span>
            <span style={S.actionNote}>
              צמדי Need×Offer שניתן להעריך. אפשרות אינה ביצוע.
            </span>
          </div>
        </div>
      </section>

      {/* ── 6 · LEARNING ──────────────────────────────────────────────── */}
      <section style={S.block} aria-label="למידה">
        <h2 style={S.h2}>למידה · LEARNING</h2>
        <div style={S.learnRow}>
          {[
            { l: "פעולה", t: "ACTION", n: c.actions },
            { l: "אפקט", t: "EFFECT", n: c.effects },
            { l: "ראיה", t: "EVIDENCE", n: c.verifiedEffects },
            { l: "למידה", t: "LEARNING", n: c.learnings },
          ].map((s, i, arr) => (
            <span key={s.t} style={S.learnStep}>
              <span style={{ ...S.learnN, color: s.n ? COLOR.text : COLOR.textFaint }}>{s.n ?? "—"}</span>
              <span style={S.learnLabel}>{s.l}</span>
              <span style={S.learnTerm}>{s.t}</span>
              {i < arr.length - 1 ? <span aria-hidden style={S.learnArrow}>⟵</span> : null}
            </span>
          ))}
        </div>
        <p style={S.note}>
          למידה נספרת רק כשקיימת רשומה עם <code style={S.mono}>state_prime</code> —
          אפקט מאומת אינו למידה, והמעבר בין השניים הוא גבול פתוח בקנון.
        </p>
      </section>

      {/* ── AUDIT · the full trace, unchanged ─────────────────────────── */}
      <details style={S.audit}>
        <summary style={S.auditSummary}>
          מסלול מערכת מלא · FULL SYSTEM TRACE
          <span style={S.auditCount}>{input.edges.length} קשתות</span>
        </summary>
        <div style={{ marginTop: SPACE.sm }}>
          <SystemTracePanel edges={input.edges} />
        </div>
      </details>
    </div>
  );
}

function Figure({ n, of, label, term, tone }: { n: number | null; of?: number; label: string; term: string; tone?: string }) {
  return (
    <span style={S.figure}>
      <span style={{ ...S.figN, color: tone ?? (n ? COLOR.text : COLOR.textFaint) }}>
        {n ?? "—"}{of !== undefined ? <span style={S.figOf}>/{of}</span> : null}
      </span>
      <span style={S.figLabel}>{label}</span>
      <span style={S.figTerm}>{term}</span>
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", gap: SPACE.xl },
  block: { display: "flex", flexDirection: "column", gap: SPACE.sm },
  h2: { ...TYPE.title, fontSize: FS.head, color: COLOR.text, margin: 0 },

  stateRow: { display: "flex", gap: SPACE.xl, flexWrap: "wrap", alignItems: "flex-end" },
  figure: { display: "flex", flexDirection: "column", gap: 2 },
  figN: { fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  figOf: { fontSize: FS.read, color: COLOR.textFaint, fontWeight: 600 },
  figLabel: { fontSize: FS.meta, color: COLOR.textDim },
  figTerm: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  window: { display: "flex", flexDirection: "column", gap: 2, marginInlineStart: "auto" },
  mono: { fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: COLOR.textDim, direction: "ltr", unicodeBidi: "isolate" },

  tensionList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: SPACE.sm },
  tension: { display: "flex", flexDirection: "column", gap: 3, borderInlineStart: "3px solid", paddingInlineStart: SPACE.md },
  tensionHead: { display: "flex", gap: SPACE.sm, alignItems: "baseline", flexWrap: "wrap" },
  tensionLabel: { fontSize: FS.read, color: COLOR.text },
  tensionStatus: { ...TYPE.micro, fontSize: FS.tag },
  tensionDetail: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.6 },

  actionRow: { display: "flex", gap: SPACE.xl, flexWrap: "wrap" },
  actionCol: { display: "flex", flexDirection: "column", gap: 3, paddingInlineStart: SPACE.md, minWidth: 200 },
  actionN: { fontSize: 26, fontWeight: 700, color: COLOR.text, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  actionNote: { fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.6, maxWidth: 280 },

  learnRow: { display: "flex", gap: SPACE.lg, flexWrap: "wrap", alignItems: "baseline" },
  learnStep: { display: "inline-flex", alignItems: "baseline", gap: 6 },
  learnN: { fontSize: 19, fontWeight: 700, fontVariantNumeric: "tabular-nums" },
  learnLabel: { fontSize: FS.meta, color: COLOR.textDim },
  learnTerm: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint },
  learnArrow: { color: COLOR.textFaint, marginInlineStart: SPACE.sm },

  note: { margin: 0, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.7, maxWidth: "72ch" },
  empty: { margin: 0, fontSize: FS.read, color: COLOR.textDim },

  audit: { background: "rgba(0,0,0,0.24)", borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, opacity: 0.82 },
  auditSummary: { cursor: "pointer", fontSize: FS.meta, letterSpacing: 1, color: "#6c86b5", display: "flex", gap: SPACE.md, alignItems: "baseline" },
  auditCount: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, marginInlineStart: "auto" },
};
