/**
 * MARKETPLACE, AS A MATCH MODEL.
 *
 * The surface rendered seven equal-width bordered cards in a row — the
 * strongest AI-card-grid signature in the product — for a pipeline whose whole
 * point is ASYMMETRY: most stages hold one record, the value group holds nine,
 * and MATCH is the only stage that is a judgement rather than a record. Equal
 * cards erased exactly the thing worth seeing, and the row clipped at 1440px.
 *
 * The model is NEED ↔ OFFER → MATCH → ACTION → EFFECT → EVIDENCE, so that is
 * the drawing. Two things are kept strictly apart, because the surface used to
 * merge them:
 *
 *   HYPOTHETICAL   a Need and an Offer that COULD be evaluated together.
 *                  A pair is not a match; PHILOS has to permit it first.
 *   EXECUTED       a Match that was permitted, an Action that ran, an Effect
 *                  that was recorded, an outcome that was verified.
 *
 * Nothing here computes a match. The permit comes from the canon evaluator;
 * this only draws what the store already decided.
 */
import CausalChain, { type ChainLink, type ChainStage } from "@/app/lib/philos/shell/CausalChain";
import { COLOR, FS, RADIUS, SPACE, STATUS, TYPE } from "@/app/lib/philos/shell/designTokens";

export interface MarketMatchInput {
  needs: { id: string; text: string; at: string }[];
  offers: { id: string; text: string; at: string }[];
  /** Actions whose inputs name BOTH a need and an offer — a permitted match
   *  that actually ran. Never inferred from a pair existing. */
  executedMatches: number;
  actions: { id: string; text: string; at: string; type: string }[];
  effects: { id: string; text: string; at: string; verified: boolean }[];
  /** The viewer's group, when they have one. Context, not a transaction. */
  group?: { name: string; central_value: string; members: number } | null;
}

export default function MarketMatchView({ input }: { input: MarketMatchInput }) {
  const nNeed = input.needs.length;
  const nOffer = input.offers.length;
  const nAction = input.actions.length;
  const nEffect = input.effects.length;
  const nEvidence = input.effects.filter((e) => e.verified).length;
  const nMatch = input.executedMatches;
  /* Pairs that COULD be evaluated. Not matches — the distinction the old
     seven-card row lost by giving MATCH a card of its own with a "1" in it. */
  const candidatePairs = nNeed * nOffer;

  const stages: ChainStage[] = [
    { key: "need", label: "צורך", term: "NEED", count: nNeed, provenance: "REAL" },
    { key: "offer", label: "הצעה", term: "OFFER", count: nOffer, provenance: "REAL" },
    { key: "match", label: "התאמה", term: "MATCH", count: nMatch, provenance: nMatch > 0 ? "REAL" : undefined,
      flag: nMatch === 0 && candidatePairs > 0 ? "candidate" : undefined },
    { key: "action", label: "פעולה", term: "ACTION", count: nAction, provenance: "REAL" },
    { key: "effect", label: "אפקט", term: "EFFECT", count: nEffect, provenance: "REAL" },
    { key: "evidence", label: "ראיה", term: "EVIDENCE", count: nEvidence, provenance: "REAL" },
  ];

  const links: ChainLink[] = [
    { from: 0, linkage: nNeed > 0 && nOffer > 0 ? "CHRONOLOGICAL_ONLY" : "NO_LINK_POSSIBLE",
      status: nNeed > 0 && nOffer > 0 ? "PARTIAL" : "MISSING_DATA",
      basis: nNeed > 0 && nOffer > 0
        ? `${candidatePairs} צמדים ניתנים להערכה. צמד אינו התאמה — נדרש היתר מהמעריך.`
        : "אין צורך והצעה שניתן להעריך יחד" },
    { from: 1, linkage: nMatch > 0 ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: nMatch > 0 ? "IMPLEMENTED" : "PARTIAL",
      basis: nMatch > 0
        ? "Action.inputs נושא גם Need וגם Offer — התאמה שבוצעה"
        : "לא קיימת פעולה שה-inputs שלה נושאים גם צורך וגם הצעה" },
    { from: 2, linkage: nAction > 0 ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: nAction > 0 ? "IMPLEMENTED" : "MISSING_DATA",
      basis: "פעולה קיימת עם רשומה אמיתית" },
    { from: 3, linkage: nEffect > 0 ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: nEffect > 0 ? "IMPLEMENTED" : "MISSING_DATA",
      basis: "Effect.action_ref נושא את מזהה הפעולה" },
    { from: 4, linkage: nEvidence > 0 ? "VERIFIED_REFERENCE_LINK" : "UNLINKED",
      status: nEvidence > 0 ? "IMPLEMENTED" : "PARTIAL",
      basis: nEvidence > 0
        ? "verified_outcome רשום על האפקט עצמו"
        : "אפקט קיים ללא verified_outcome — טענה, לא ראיה" },
  ];

  return (
    <div dir="rtl" style={S.page}>
      <CausalChain
        title="מודל ההתאמה"
        stages={stages}
        links={links}
        note="חץ מצויר רק כשרשומה נושאת הפניה לקודמתה. צמד צורך–הצעה מצויר כקו מקווקו ללא ראש חץ: קיומו של צמד אינו התאמה, וההיתר מגיע מהמעריך הקנוני בלבד."
      />

      {/* ── HYPOTHETICAL vs EXECUTED — never in the same column ────────── */}
      <section style={S.split} aria-label="אפשרי מול בוצע">
        <div style={S.col}>
          <h3 style={S.colHead}>אפשרי · HYPOTHETICAL</h3>
          <span style={{ ...S.colN, color: COLOR.textFaint }}>{candidatePairs || "—"}</span>
          <span style={S.colNote}>
            צמדי צורך×הצעה שניתן להעריך. אף אחד מהם אינו התאמה עד שהמעריך נותן היתר.
          </span>
        </div>
        <div style={{ ...S.col, borderInlineStart: `1px solid ${COLOR.border}` }}>
          <h3 style={S.colHead}>בוצע · EXECUTED</h3>
          <span style={{ ...S.colN, color: nMatch > 0 ? STATUS.real.text : COLOR.textFaint }}>{nMatch || "—"}</span>
          <span style={S.colNote}>
            התאמות שהפכו לפעולה עם רשומה. {nEvidence > 0 ? `${nEvidence} מהן הגיעו לראיה מאומתת.` : "אף אחת לא הגיעה לראיה מאומתת."}
          </span>
        </div>
      </section>

      {/* ── THE RECORDS — entities, in one list each, not a card per stage ── */}
      <section style={S.records} aria-label="הרשומות">
        <RecordList title="מה נדרש" term="NEED" items={input.needs} empty="לא נרשם צורך" />
        <RecordList title="מה זמין" term="OFFER" items={input.offers} empty="לא נרשמה הצעה" />
        <RecordList title="מה נעשה" term="ACTION" items={input.actions} empty="לא נרשמה פעולה" />
        <RecordList
          title="מה השתנה" term="EFFECT" empty="לא נרשם אפקט"
          items={input.effects.map((e) => ({ id: e.id, text: e.text, at: e.at, mark: e.verified ? "מאומת" : "טענה" }))}
        />
      </section>

      {input.group ? (
        <p style={S.groupNote}>
          הקשר קבוצתי: <b style={{ color: COLOR.textDim }}>{input.group.name}</b> · {input.group.members} חברים ·
          ערך מרכזי {input.group.central_value}. חברות בקבוצה אינה רלוונטיות עסקה —
          היא הקשר, ולא צד בהתאמה.
        </p>
      ) : null}
    </div>
  );
}

function RecordList({ title, term, items, empty }: {
  title: string; term: string;
  items: { id: string; text: string; at: string; mark?: string }[];
  empty: string;
}) {
  return (
    <div style={S.list}>
      <h3 style={S.listHead}>
        {title}
        <span style={S.listCount}>{items.length || "—"}</span>
      </h3>
      {items.length === 0 ? (
        <p style={S.listEmpty}>{empty}</p>
      ) : (
        <ul style={S.ul}>
          {items.slice(0, 6).map((it) => (
            <li key={it.id} style={S.li}>
              <span style={S.liText}>{it.text}</span>
              <span style={S.liMeta}>
                {it.mark ? <b style={{ color: it.mark === "מאומת" ? STATUS.real.text : STATUS.claimed.text }}>{it.mark} · </b> : null}
                <code style={S.mono}>{it.at.slice(0, 10)}</code>
              </span>
            </li>
          ))}
          {items.length > 6 ? <li style={S.liMore}>ועוד {items.length - 6}</li> : null}
        </ul>
      )}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { display: "flex", flexDirection: "column", gap: SPACE.xl },

  split: { display: "flex", gap: SPACE.xl, flexWrap: "wrap" },
  col: { display: "flex", flexDirection: "column", gap: 4, paddingInlineStart: SPACE.md, minWidth: 240, flex: 1 },
  colHead: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, margin: 0 },
  colN: { fontSize: 26, fontWeight: 700, lineHeight: 1, fontVariantNumeric: "tabular-nums" },
  colNote: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.65, maxWidth: "44ch" },

  records: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(270px, 1fr))", gap: SPACE.lg },
  list: { display: "flex", flexDirection: "column", gap: 6, minWidth: 0 },
  listHead: { ...TYPE.micro, fontSize: FS.tag, color: COLOR.textFaint, margin: 0, display: "flex", gap: SPACE.sm, alignItems: "baseline" },
  listCount: { fontSize: FS.read, fontWeight: 700, color: COLOR.text, fontVariantNumeric: "tabular-nums" },
  ul: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 },
  li: { display: "flex", flexDirection: "column", gap: 2, borderInlineStart: `2px solid ${COLOR.border}`, paddingInlineStart: SPACE.sm },
  liText: { fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.55 },
  liMeta: { fontSize: FS.tag, color: COLOR.textFaint },
  liMore: { fontSize: FS.tag, color: COLOR.textFaint },
  listEmpty: { margin: 0, fontSize: FS.meta, color: COLOR.textFaint },

  mono: { fontFamily: "ui-monospace, monospace", direction: "ltr", unicodeBidi: "isolate" },
  groupNote: { margin: 0, fontSize: FS.tag, color: COLOR.textFaint, lineHeight: 1.7, maxWidth: "72ch" },
};
