/**
 * WHERE THIS GROUP SITS ON THE SPECTRUM — three different questions, answered
 * separately, because the system has three different answers and they disagree.
 *
 * The 28/223 treemap below this block is the whole described landscape. It is
 * an honest picture of the ONTOLOGY and it says nothing about this group: every
 * one of its 223 cells is unpopulated, because no group in the system has a
 * RESOLVED sub-value. Rendering only that map left the reader to conclude that
 * the selected group is somewhere in it. It is not.
 *
 * So this states, in order and without merging them:
 *
 *   CANONICAL POSITION   F03, DERIVED from the base-value registry via BV05,
 *                        carrying that record's own REVIEW_REQUIRED status.
 *                        This is what the system currently treats as canonical
 *                        — not what anyone verified.
 *
 *   CANDIDATE FAN        the 16 sub-values whose NAMES relate to the group's
 *                        declared value, fanned across the 5 families they
 *                        belong to. The largest cluster is F22, which is NOT
 *                        the canonical family. That disagreement is the finding;
 *                        suppressing either side would hide it.
 *
 *   CONNECTED            0 of 223. A candidate is a string relationship. It is
 *                        not a recorded link, and nothing here creates one.
 *
 * THE THREE DISTINCTIONS THIS BLOCK EXISTS TO KEEP APART, each stated on the
 * screen rather than only here:
 *
 *   candidate ≠ connected        a name that relates is not a recorded edge
 *   exact string match ≠ resolved   SV018 is spelled exactly like this group
 *                                and that is still not a ruling
 *   canonical ≠ verified         F03 is the recorded answer and is under review
 *
 * NOTHING IS COMPUTED HERE THAT COULD BE MISTAKEN FOR A JUDGEMENT. There is no
 * score, no ranking by confidence, no "best" candidate. Families are ordered by
 * how many candidates they hold — a count, printed as a count. The exact-name
 * match is string equality against the group's own name, and it is labelled as
 * exactly that. The ruling stays with a person.
 */
import type { SubvalueCandidate } from "@/app/lib/philos/community/valueMapping";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { STATE } from "@/app/lib/philos/shell/visualGrammar";

export interface CanonicalPosition {
  family_ref: string;
  label: string;
  via_base_value: string;
}

/** The `because` codes the resolver emits, in the reader's language. Each one
 *  says what KIND of string relationship was found — never how strong it is. */
const BECAUSE_HE: Record<string, string> = {
  SHARED_PREFIX: "פותח באותה מילה",
  CONTAINS: "מכיל את המילה",
  EXACT: "זהה",
};

export default function GroupSpectrumPosition({
  groupName, groupId, canonical, canonicalStatus, mappingStatus, mappingBecause,
  candidates, familyLabels, populatedSubvalues, totalSubvalues, totalFamilies,
}: {
  groupName: string;
  groupId: string;
  /** From the base-value registry rule. Null when the label maps to no base value. */
  canonical: CanonicalPosition | null;
  /** That registry record's OWN status string — printed, never re-interpreted. */
  canonicalStatus: string;
  mappingStatus: string;
  mappingBecause: string;
  candidates: readonly SubvalueCandidate[];
  familyLabels: Readonly<Record<string, string>>;
  populatedSubvalues: number;
  totalSubvalues: number;
  totalFamilies: number;
}) {
  /* Group the candidates by the family they belong to and order by how many
     each holds. A COUNT, not a score — and the canonical family is marked
     wherever it lands in that order rather than being lifted to the top,
     because lifting it would restate the ranking as agreement. */
  const byFamily = new Map<string, SubvalueCandidate[]>();
  for (const c of candidates) {
    const fam = c.family_id ?? "—";
    byFamily.set(fam, [...(byFamily.get(fam) ?? []), c]);
  }
  const fans = [...byFamily.entries()]
    .map(([family_id, list]) => ({ family_id, list }))
    .sort((a, b) => b.list.length - a.list.length || a.family_id.localeCompare(b.family_id));

  /* STRING EQUALITY WITH THE GROUP'S OWN NAME. A fact about two strings and
     nothing more — it is surfaced because a reader deciding this mapping needs
     to see it, and labelled so it cannot be read as a resolution. */
  const exactNameMatch = candidates.find((c) => c.name_he === groupName) ?? null;

  return (
    <section dir="rtl" data-spectrum-position style={S.wrap}>
      {/* ── 1 · THE SUBJECT ─────────────────────────────────────────────── */}
      <header style={S.head}>
        <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.4, color: COLOR.textFaint }}>
          SELECTED GROUP
        </span>
        <h3 style={S.name}>{groupName}</h3>
        <code style={S.id}>{groupId}</code>
      </header>

      <div style={S.cols}>
        {/* ── 2 · CANONICAL POSITION ────────────────────────────────────── */}
        <div data-spectrum-block="canonical" style={S.block}>
          <div style={{ ...S.blockHead, color: STATE.DERIVED.hue }}>CANONICAL POSITION</div>
          {canonical ? (
            <>
              <div style={S.big}>
                <b style={{ color: COLOR.text }}>{canonical.family_ref}</b>
                <span style={{ color: COLOR.textDim, fontSize: FS.read }}>{canonical.label}</span>
              </div>
              <div style={S.tags}>
                <Tag hue={STATE.DERIVED.hue} text="DERIVED" />
                <Tag hue={STATE.UNRESOLVED.hue} text="REVIEW_REQUIRED" />
              </div>
              <p style={S.note}>
                נגזר מ-{canonical.via_base_value} דרך רישום ערכי הבסיס — כלל רשום, לא ראיה.
                סטטוס הרשומה עצמה: <b style={{ color: STATE.UNRESOLVED.hue }}>{canonicalStatus}</b>.
              </p>
              {/* canonical ≠ verified, said on the screen. */}
              <p style={S.rule}>
                <b style={{ color: COLOR.text }}>קנוני ≠ מאומת</b> — זה מה שהמערכת מתייחסת אליו
                כמשפחה הקנונית היום. איש לא אישר אותו.
              </p>
            </>
          ) : (
            <p style={S.note}>הערך המרכזי אינו ממופה לאף ערך בסיס — אין עמדה קנונית.</p>
          )}
        </div>

        {/* ── 3 · UNRESOLVED CANDIDATE FAN ──────────────────────────────── */}
        <div data-spectrum-block="candidates" style={S.block}>
          <div style={{ ...S.blockHead, color: STATE.UNRESOLVED.hue }}>UNRESOLVED TAXONOMY CANDIDATES</div>
          <div style={S.big}>
            <b style={{ color: COLOR.text }}>{candidates.length}</b>
            <span style={{ color: COLOR.textDim, fontSize: FS.read }}>
              מועמדים על פני {fans.length} משפחות
            </span>
          </div>
          <div style={S.tags}>
            <Tag hue={STATE.UNRESOLVED.hue} text={mappingStatus} />
          </div>

          {/* THE FAN. Ordered by candidate count; the canonical family is
              marked in place, never moved to the front. */}
          <ul style={S.fan}>
            {fans.map(({ family_id, list }) => {
              const isCanonical = canonical?.family_ref === family_id;
              const isLargest = list.length === fans[0].list.length;
              return (
                <li key={family_id} style={S.fanRow} data-fan-family={family_id}>
                  <span style={S.fanCount}>×{list.length}</span>
                  <span style={{ ...S.fanId, color: isCanonical ? STATE.DERIVED.hue : COLOR.text }}>
                    {family_id}
                  </span>
                  <span style={S.fanLabel}>{familyLabels[family_id] ?? "—"}</span>
                  {isCanonical ? <Tag hue={STATE.DERIVED.hue} text="קנוני" /> : null}
                  {isLargest && !isCanonical ? (
                    <Tag hue={STATE.UNRESOLVED.hue} text="האשכול הגדול ביותר" />
                  ) : null}
                  <span style={S.fanNames}>
                    {list.map((c) => (
                      <span key={c.subvalue_id}
                        style={c === exactNameMatch ? S.nameHit : undefined}
                        title={`${c.subvalue_id} — ${BECAUSE_HE[c.because] ?? c.because}`}>
                        {c.name_he}
                      </span>
                    )).reduce<React.ReactNode[]>((acc, el, i) =>
                      i === 0 ? [el] : [...acc, <span key={`s${i}`} style={S.sep}> · </span>, el], [])}
                  </span>
                </li>
              );
            })}
          </ul>

          {/* THE EXACT-NAME MATCH, NAMED AS A STRING FACT. */}
          {exactNameMatch ? (
            <p style={S.exact}>
              <b style={{ color: STATE.UNRESOLVED.hue }}>{exactNameMatch.subvalue_id} {exactNameMatch.name_he}</b>
              {" "}נכתב בדיוק כמו שם הקבוצה, והוא במשפחה {exactNameMatch.family_id} — לא במשפחה הקנונית.{" "}
              <b style={{ color: COLOR.text }}>התאמת מחרוזת מדויקת ≠ הכרעה</b> — זו עובדה על שתי מחרוזות,
              לא ראיה ולא מיפוי.
            </p>
          ) : null}

          <p style={S.note}>{mappingBecause}</p>
        </div>

        {/* ── 4 · WHAT IS ACTUALLY CONNECTED ────────────────────────────── */}
        <div data-spectrum-block="connected" style={S.block}>
          <div style={{ ...S.blockHead, color: COLOR.textFaint }}>CONNECTED SUB-VALUES</div>
          <div style={S.big}>
            <b style={{ color: populatedSubvalues ? COLOR.text : COLOR.textFaint }}>
              {populatedSubvalues}/{totalSubvalues}
            </b>
            <span style={{ color: COLOR.textDim, fontSize: FS.read }}>מקושרים בפועל</span>
          </div>
          <div style={S.tags}>
            <Tag hue={COLOR.textFaint} text={STATE.EMPTY_MEASURED.tag === "0" ? "נמדד" : "UNKNOWN"} />
          </div>
          <p style={S.rule}>
            <b style={{ color: COLOR.text }}>מועמד ≠ מקושר</b> — אף אחד מ-{candidates.length} המועמדים
            אינו קשר רשום. אין לקבוצה הזאת תת-ערך מוכרע, ולכן היא אינה יושבת באף תא מ-{totalSubvalues}
            {" "}תאי המפה שמתחת.
          </p>
          <p style={S.note}>
            המפה מתחת מציגה את כל {totalFamilies} המשפחות ו-{totalSubvalues} תתי-הערכים — הנוף המתואר
            במלואו. אכלוס הוא ממד נפרד, והוא {populatedSubvalues}.
          </p>
        </div>
      </div>
    </section>
  );
}

function Tag({ hue, text }: { hue: string; text: string }) {
  return (
    <span style={{ ...TYPE.micro, fontSize: FS.tag, letterSpacing: 0.8, color: hue,
      border: `1px solid ${hue}55`, borderRadius: RADIUS.pill, padding: "1px 8px", whiteSpace: "nowrap" }}>
      {text}
    </span>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap: { marginBlockEnd: SPACE.md },
  head: { display: "flex", alignItems: "baseline", gap: SPACE.sm, flexWrap: "wrap", marginBlockEnd: 10 },
  name: { margin: 0, fontSize: 17, fontWeight: 700, color: COLOR.text },
  id: { fontSize: FS.tag, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace" },

  /* Three columns, because these are three ANSWERS to three questions and a
     vertical stack would read as one narrative that resolves. Side by side
     they stay visibly separate, and the disagreement is legible in one look. */
  cols: { display: "grid", gap: SPACE.md, alignItems: "start",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" },
  block: { display: "flex", flexDirection: "column", gap: 6, minInlineSize: 0 },
  blockHead: { ...TYPE.micro, fontSize: FS.tag, letterSpacing: 1.4 },
  big: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap", fontSize: 19, fontWeight: 700 },
  tags: { display: "flex", gap: 5, flexWrap: "wrap" },
  note: { margin: 0, fontSize: FS.base, color: COLOR.textFaint, lineHeight: 1.6 },
  /* The three distinctions get reading size and full strength — they are the
     content, not a footnote on it. */
  rule: { margin: 0, fontSize: FS.meta, color: COLOR.textDim, lineHeight: 1.65 },

  fan: { listStyle: "none", margin: "2px 0 0", padding: 0, display: "flex",
    flexDirection: "column", gap: 5 },
  fanRow: { display: "flex", alignItems: "baseline", gap: 7, flexWrap: "wrap", fontSize: FS.meta },
  fanCount: { fontFamily: "ui-monospace, monospace", fontWeight: 700, color: COLOR.text, minWidth: 26 },
  fanId: { fontFamily: "ui-monospace, monospace", fontWeight: 700 },
  fanLabel: { color: COLOR.textDim },
  fanNames: { flexBasis: "100%", color: COLOR.textFaint, fontSize: FS.base, lineHeight: 1.6,
    paddingInlineStart: 33 },
  nameHit: { color: STATE.UNRESOLVED.hue, fontWeight: 700 },
  sep: { color: COLOR.textFaint },
  exact: { margin: "2px 0 0", fontSize: FS.base, color: COLOR.textDim, lineHeight: 1.65 },
};
