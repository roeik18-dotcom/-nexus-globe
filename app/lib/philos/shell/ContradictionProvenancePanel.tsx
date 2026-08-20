/**
 * CONTRADICTION PROVENANCE — Brain's view of the master.
 *
 * Brain's question is "what does this mean and why". For the contradiction
 * layer that means: where did each identity come from, which taxonomies
 * claim it, and where the sources disagree.
 *
 * This is the ONLY surface that shows taxonomy membership and conflicts.
 * Community/Globe/World show the spine (the chain); Brain shows the
 * evidence behind it. Neither redefines the other — both read the same
 * `contradictionMaster.ts`.
 *
 * Deliberately NOT a browsable dump of 110 rows. It reports the shape of
 * the evidence — how many identities rest on how many sources, where the
 * closed sets collide — and puts the row-level detail behind AUDIT.
 */
import {
  CONTRADICTION_MASTER, TAXONOMY_CONFLICTS, type TaxonomyKey,
} from "../valueSystem/contradictionMaster";
import { multiLayerContradictions, DIRECT_CONTRADICTION_VALUE_RELATIONS } from "../valueSystem/socialValueSpine";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "./designTokens";
import { ProvenanceBadge } from "./provenance";

const TAX_LABEL: Record<TaxonomyKey, string> = {
  core_10: "core-10 (מוכרז סגור)",
  extended_30: "extended-30 (מוכרז סגור)",
  repo_24: "repo (הטקסונומיה שרצה היום)",
  six_class_v1: "6 מחלקות · גרסה 1",
  six_class_v2: "6 מחלקות · גרסה 2",
  grouping_4: "4 קבוצות",
  value_relation: "יחסי ניגוד–ערך",
};

export default function ContradictionProvenancePanel() {
  const total = CONTRADICTION_MASTER.length;
  const counts = (Object.keys(TAX_LABEL) as TaxonomyKey[]).map((t) => ({
    key: t,
    n: CONTRADICTION_MASTER.filter((c) => c.taxonomy_memberships.some((m) => m.taxonomy === t)).length,
  }));
  const shared = CONTRADICTION_MASTER.filter((c) => c.taxonomy_memberships.length > 1).length;
  const single = total - shared;
  const tagged = multiLayerContradictions().length;
  const srcSpread = CONTRADICTION_MASTER.reduce((a, c) => a + c.source_files.length, 0) / total;

  return (
    <section dir="rtl" style={S.band}>
      <div style={S.head}>
        <span style={S.eyebrow}>פרובננס הניגודים · CONTRADICTION PROVENANCE — למה היחס קיים</span>
        <ProvenanceBadge p="STATIC" />
      </div>

      <div style={S.metrics}>
        <M k="זהויות" v={total} note="אחת לכל ניגוד" />
        <M k="בטקסונומיה אחת בלבד" v={single} note={`${Math.round((single / total) * 100)}% מהמרשם`} tone="#fbbf24" />
        <M k="בכמה טקסונומיות" v={shared} note="חפיפה אמיתית" tone="#34d399" />
        <M k="עם תגי-שכבה" v={tagged} note="רב-שכבתי לפי המקור" tone="#a78bfa" />
        <M k="מקורות לזהות" v={srcSpread.toFixed(2)} note="ממוצע" />
      </div>

      <div style={S.subHead}>חברות לפי טקסונומיה — אף אחת אינה מחייבת</div>
      <div style={S.taxRow}>
        {counts.map((c) => (
          <span key={c.key} style={S.taxChip} title={TAX_LABEL[c.key]}>
            <b style={{ color: COLOR.text }}>{c.n}</b> {TAX_LABEL[c.key]}
          </span>
        ))}
      </div>

      <div style={S.subHead}>התנגשויות מקור · SOURCE CONFLICTS ({TAXONOMY_CONFLICTS.length})</div>
      {TAXONOMY_CONFLICTS.map((c) => (
        <div key={c.conflict_id} style={S.conflict}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ ...TYPE.micro, fontSize: FS.tag, color: c.status === "SOURCE_CONFLICT" ? "#f2635c" : "#fbbf24" }}>
              {c.status}
            </span>
            <span style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint }}>{c.conflict_id}</span>
          </div>
          {"statement" in c ? (
            <div style={S.conflictBody}>{c.statement}</div>
          ) : (
            <>
              <div style={S.conflictBody}><b>נטען בקוד:</b> {c.previously_claimed}</div>
              <div style={S.conflictBody}><b>נמדד ב-21 הקבצים:</b> {c.measured}</div>
            </>
          )}
        </div>
      ))}

      {/* SAFE LINK REPAIR (matrix gap B): Brain held only a COUNT of the four
          value-emergence relations. Brain is the provenance authority, so it
          must show each one with its source wording, its status and its
          cardinality — including that the source never names the resulting
          value. */}
      <div style={S.subHead}>יחסי צמיחת-ערך · VALUE-EMERGENCE RELATIONS ({DIRECT_CONTRADICTION_VALUE_RELATIONS.length})</div>
      {DIRECT_CONTRADICTION_VALUE_RELATIONS.map((r) => (
        <div key={`${r.pole_a}|${r.pole_b}`} style={S.rel}>
          <span style={{ fontSize: 13, color: COLOR.text, fontWeight: 700, minWidth: 150 }}>
            {r.pole_a} ↔ {r.pole_b}
          </span>
          <span style={{ ...TYPE.micro, fontSize: FS.tag, color: "#a78bfa" }}>{r.relation}</span>
          <span style={{ fontSize: FS.tag, color: COLOR.textFaint, flex: 1, minWidth: 170 }}>
            «{r.source_rule}» · קובץ {r.source_file}
          </span>
          <span style={{ ...TYPE.micro, fontSize: FS.tag, color: "#fbbf24" }}>
            ערך שנוצר: NOT NAMED BY SOURCE
          </span>
          <span style={{ ...TYPE.micro, fontSize: FS.tag, color: "#8798b8" }}>
            cardinality {r.cardinality}
          </span>
        </div>
      ))}

      <div style={S.rule}>
        {single} מתוך {total} הזהויות מופיעות ב<b>טקסונומיה אחת בלבד</b>. זו אינה מערכת אחת
        בשמות שונים — אלה החלטות סיווג נפרדות. לכן הזהות מופרדת מהחברות, ואף טקסונומיה אינה
        מוכרזת מחייבת.
      </div>
    </section>
  );
}

function M({ k, v, note, tone }: { k: string; v: number | string; note: string; tone?: string }) {
  return (
    <div style={S.metric}>
      <div style={{ fontSize: 17, fontWeight: 800, color: tone ?? COLOR.text, fontFamily: "ui-monospace, monospace" }}>{v}</div>
      <div style={{ ...TYPE.micro, fontSize: FS.tag, color: COLOR.textDim }}>{k}</div>
      <div style={{ fontSize: FS.tag, color: COLOR.textFaint }}>{note}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(91,156,246,0.05)", border: "1px solid rgba(91,156,246,0.20)", borderRadius: RADIUS.md, padding: `${SPACE.sm}px ${SPACE.md}px`, marginBottom: SPACE.md },
  head: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 7 },
  eyebrow: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.accent },
  metrics: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(96px, 1fr))", gap: 6 },
  metric: { background: "rgba(20,28,48,0.5)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.sm, padding: "6px 8px", display: "flex", flexDirection: "column", gap: 1 },
  subHead: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, margin: "9px 0 4px" },
  taxRow: { display: "flex", flexWrap: "wrap", gap: 5 },
  taxChip: { fontSize: FS.tag, color: COLOR.textDim, border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px" },
  conflict: { background: "rgba(242,99,92,0.05)", border: "1px solid rgba(242,99,92,0.18)", borderRadius: RADIUS.sm, padding: "6px 9px", marginBottom: 4 },
  rel: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 7, background: "rgba(167,139,250,0.06)", border: "1px solid rgba(167,139,250,0.18)", borderRadius: RADIUS.sm, padding: "5px 9px", marginBottom: 3 },
  conflictBody: { fontSize: FS.tag, color: COLOR.textDim, lineHeight: 1.55, marginTop: 2 },
  rule: { marginTop: SPACE.sm, fontSize: FS.tag, color: COLOR.textDim, lineHeight: 1.6, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: RADIUS.sm, padding: "6px 9px" },
};
