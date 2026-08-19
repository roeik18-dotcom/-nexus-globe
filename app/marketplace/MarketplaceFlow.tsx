"use client";

/**
 * MarketplaceFlow — Marketplace's PRIMARY visual (Visual Delivery pass;
 * BATCH 2 originally). One dominant flow band, same visual grammar as
 * Dynamics' `CausalChainFlow` and the same shared provenance vocabulary
 * (`shell/provenance.tsx`):
 *
 *   NEED → OFFER → MATCH → ACTION → EFFECT → EVIDENCE
 *
 * Every stage card shows the real count, the LATEST real record's own
 * content/owner/time, and a provenance badge — or an explicit UNKNOWN
 * with the reason. Two stages need saying twice:
 *
 *   MATCH     `MatchPermit` is deliberately derived-not-persisted
 *             (`matchPermit.ts`: a permit is a decision, not a record).
 *             The honest, real trace of a REALIZED match is a canon
 *             Action whose `inputs` reference BOTH a real Need and a real
 *             Offer — a mechanical join over stored records, so the stage
 *             is badged STATIC (the join is a rule) and its rows are real.
 *             Zero is stated with the reason, never padded.
 *   EVIDENCE  only Effects with a real `verified_outcome` — never summed
 *             with claims; a claimed-only Effect keeps EVIDENCE at
 *             UNKNOWN, exactly like Dynamics' EVIDENCE stage.
 *
 * Ownership is part of the flow, not a footnote: each card names the real
 * owner field of its latest record (Need.subject / Offer.source /
 * Action.owner / Effect.subject), and the band header names the resolved
 * Person and the REAL Value Group when the identity link is verified.
 */
import { COLOR, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { ProvenanceBadge, PROVENANCE_STYLE, type Provenance } from "@/app/lib/philos/shell/provenance";

export interface FlowStage {
  key: string;
  label: string;
  gloss: string;
  count: number;
  sub?: string;
  /** Latest real record for this stage — `null` = stage genuinely empty. */
  latest: { text: string; owner: string; time: string } | null;
  provenance: Provenance;
  /** Why the stage is empty / how the value is derived — always shown. */
  note?: string;
  href: string;
}

export default function MarketplaceFlow({
  stages, person, valueGroup,
}: {
  stages: FlowStage[];
  person?: string;
  valueGroup?: { name: string; central_value: string; provenance: "REAL" | "DEMO" };
}) {
  const known = stages.filter((s) => s.count > 0).length;
  return (
    <section style={S.band}>
      <header dir="rtl" style={S.head}>
        <div>
          <div style={S.eyebrow}>זרימת השוק · MARKETPLACE FLOW</div>
          <h2 style={S.title}>NEED → OFFER → MATCH → ACTION → EFFECT → EVIDENCE</h2>
        </div>
        <div style={S.headMeta}>
          {person ? <span style={S.chip}>PERSON: {person}</span> : <span style={{ ...S.chip, fontStyle: "italic" }}>PERSON: UNKNOWN</span>}
          {valueGroup ? (
            <span style={{ ...S.chip, color: PROVENANCE_STYLE[valueGroup.provenance].text }}>
              VALUE GROUP: {valueGroup.name} · {valueGroup.central_value}
            </span>
          ) : (
            <span style={{ ...S.chip, fontStyle: "italic" }}>VALUE GROUP: UNKNOWN</span>
          )}
          <span style={{ ...S.chip, color: known === stages.length ? "#34d399" : "#fbbf24" }}>{known}/{stages.length} שלבים פעילים</span>
        </div>
      </header>

      <div dir="ltr" style={S.rail}>
        <div style={S.track}>
          {stages.map((s, i) => (
            <div key={s.key} style={{ display: "flex", alignItems: "stretch" }}>
              <StageCard stage={s} index={i + 1} />
              {i < stages.length - 1 ? <Arrow active={s.count > 0} /> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StageCard({ stage, index }: { stage: FlowStage; index: number }) {
  const active = stage.count > 0;
  const p = PROVENANCE_STYLE[active ? stage.provenance : "UNKNOWN"];
  return (
    <a
      href={stage.href}
      style={{
        width: 196, minHeight: 158, boxSizing: "border-box", borderRadius: RADIUS.lg, textDecoration: "none",
        background: active ? "linear-gradient(180deg, rgba(20,28,48,0.95), rgba(14,19,33,0.95))" : "rgba(90,111,150,0.05)",
        border: `1px solid ${active ? p.border : COLOR.border}`,
        borderTop: `3px solid ${active ? p.text : "rgba(90,111,150,0.35)"}`,
        padding: "10px 12px", display: "flex", flexDirection: "column", gap: 5, flexShrink: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
        <span style={{ ...TYPE.micro, color: active ? p.text : COLOR.textFaint }}>{index}. {stage.label}</span>
        <ProvenanceBadge p={active ? stage.provenance : "UNKNOWN"} />
      </div>
      <div dir="rtl" style={{ fontSize: 9.5, color: COLOR.textFaint }}>{stage.gloss}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: active ? COLOR.text : "#8798b8" }}>{stage.count}</span>
        {stage.sub ? <span style={{ fontSize: 9, color: COLOR.textFaint }}>{stage.sub}</span> : null}
      </div>
      {stage.latest ? (
        <div dir="rtl" style={{ display: "flex", flexDirection: "column", gap: 2, marginTop: "auto", paddingTop: 5, borderTop: `1px solid ${COLOR.border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: COLOR.text, lineHeight: 1.3 }}>
            {stage.latest.text.length > 52 ? `${stage.latest.text.slice(0, 52)}…` : stage.latest.text}
          </div>
          <div style={{ fontSize: 9, color: COLOR.textDim, fontFamily: "ui-monospace, monospace", direction: "ltr", textAlign: "right" }}>
            {stage.latest.owner} · {stage.latest.time.slice(0, 10)}
          </div>
        </div>
      ) : (
        <div dir="rtl" style={{ marginTop: "auto", paddingTop: 5, borderTop: `1px solid ${COLOR.border}`, fontSize: 9.5, color: "#8798b8", fontStyle: "italic", lineHeight: 1.35 }}>
          {stage.note ?? "UNKNOWN — אין רשומה"}
        </div>
      )}
      {stage.latest && stage.note ? (
        <div dir="rtl" style={{ fontSize: 8.5, color: COLOR.textFaint, lineHeight: 1.3 }}>{stage.note}</div>
      ) : null}
    </a>
  );
}

function Arrow({ active }: { active: boolean }) {
  return (
    <div style={{ width: 24, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 15, color: active ? "#34d399" : COLOR.textFaint }}>→</span>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: {
    background: "linear-gradient(180deg, rgba(91,156,246,0.07), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`,
    borderRadius: 20,
    padding: `${SPACE.md}px ${SPACE.lg}px`,
    margin: `0 0 ${SPACE.md}px`,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: SPACE.sm, marginBottom: SPACE.md },
  eyebrow: { ...TYPE.micro, color: COLOR.accent, marginBottom: 4 },
  title: { fontSize: 13.5, fontWeight: 800, margin: 0, color: COLOR.text, direction: "ltr", textAlign: "right" },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 9.5, fontWeight: 700, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px", fontFamily: "ui-monospace, monospace" },
  rail: { overflowX: "auto", paddingBottom: 4 },
  track: { display: "flex", alignItems: "stretch", minWidth: "fit-content" },
};
