/**
 * CONFIG-DECLARED QUESTIONS — the missing rung of the config→runtime
 * ladder, exposed as REFERENCE.
 *
 *   CONFIG → AVAILABLE PARAMETER → **QUESTION / INPUT** → OBSERVATION →
 *   MEASUREMENT → MEASURED STATE → ORIENTATION
 *
 * The Source Locks declare real `TYPE = "QUESTION"` rows — 1 in Human, 4
 * in Music, three of the latter explicitly authored as Merlin diagnostics.
 * Every one is `RUNTIME_READY`/`READY` in its own lock, and until now none
 * of them reached any surface: they are excluded from the ACTIVE ref set
 * (correctly — "what may be asked" must not inflate "what is known"), and
 * nothing else read them. The person could not see what their own config
 * says may be asked.
 *
 * **This panel asks nothing and answers nothing.** It states what the
 * config declares is askable, cites each question's real ref, and stops
 * there. An unanswered question is not a measurement; an answer would not
 * be one either until it becomes a real Observation
 * (`humanConfig/parameterAcquisition.ts` keeps SOURCE QUESTION ≠ USER
 * ANSWER ≠ OBSERVATION ≠ EVIDENCE ≠ STATE as four distinct types, and is
 * deliberately still unwired — wiring it would mean inventing responses
 * nobody gave). The only real next step offered is the one that already
 * exists: record a real self-Observation.
 *
 * SECONDARY by construction — it lives inside a collapsed `<details>`, so
 * it informs without becoming another wall of configuration cards.
 */
import { buildHumanConfigQuestions, type ConfigQuestion } from "@/app/lib/philos/canonical/activeConfig";
import { availableDomainConfigs } from "@/app/lib/philos/canonical/domainConfigRegistry";
import { COLOR, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import { ProvenanceBadge } from "@/app/lib/philos/shell/provenance";
import { Epistemic } from "@/app/lib/philos/shell/epistemics";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

export default function ConfigQuestionsPanel() {
  // HUMAN CONFIG (cross-domain base) and each DOMAIN CONFIG slot are two
  // separate axes and are rendered as two separate groups — never one bag.
  const groups: { label: string; axis: string; questions: ConfigQuestion[] }[] = [
    { label: "HUMAN CONFIG", axis: "בסיס חוצה-דומיינים", questions: buildHumanConfigQuestions() },
    ...availableDomainConfigs().map((slot) => ({
      label: `DOMAIN CONFIG · ${slot.label_he}`,
      axis: "סלוט דומיין — זמין, לא נבחר",
      questions: slot.questions(),
    })),
  ];
  const total = groups.reduce((n, g) => n + g.questions.length, 0);

  return (
    <section dir="rtl" style={S.band}>
      {/* Folded by default — system detail, kept whole, one click away. */}
      <SystemDrawer id="config-questions" title="שאלות קונפיג · פירוט מערכת" note="מצב הגדרות">
      <div style={S.head}>
        <span style={S.eyebrow}>
          שאלות שהקונפיג מגדיר ({total})
        </span>
        <ProvenanceBadge p={total > 0 ? "CANON" : "UNKNOWN"} />
      </div>

      <div style={S.rule}>
        הקונפיג קובע מה <b>ניתן לשאול ולמדוד</b> — הוא אינו מספק את המדידה.
        שאלה שלא נענתה אינה מדידה, ותשובה אינה הופכת למצב עד שנרשמת Observation אמיתית.
      </div>

      {total === 0 ? (
        <Epistemic state="UNKNOWN" reason="אין שאלה מוגדרת בקונפיג עם RUNTIME_READY" />
      ) : (
        groups.map((g) => (
          <div key={g.label} style={{ marginTop: SPACE.sm }}>
            <div style={S.groupHead}>
              {g.label} <span style={S.groupAxis}>· {g.axis}</span>{" "}
              <span style={S.groupCount}>{g.questions.length}</span>
            </div>
            {g.questions.length === 0 ? (
              <div style={S.none}>אין שאלה מוגדרת בציר הזה</div>
            ) : (
              g.questions.map((q) => (
                <div key={q.ref} style={S.row}>
                  <span style={S.qText}>{q.text}</span>
                  <span style={S.qMeta} dir="ltr">
                    {q.ref} · {q.runtime_status}
                  </span>
                </div>
              ))
            )}
          </div>
        ))
      )}

      <div style={S.footer}>
        הצעד האמיתי היחיד מכאן הוא רישום תצפית עצמית —{" "}
        <a href="#record-observation" style={{ color: COLOR.accent }}>
          ＋ תצפית עצמית חדשה
        </a>
        . אין מסלול אוטומטי משאלה למצב, וזה מכוון.
      </div>
      </SystemDrawer>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  band: { background: "rgba(90,120,180,0.05)", border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.md, padding: `${SPACE.md}px ${SPACE.md}px` },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 },
  eyebrow: { ...TYPE.micro, color: COLOR.accent },
  rule: { fontSize: 13, color: COLOR.textDim, lineHeight: 1.55, background: "rgba(251,191,36,0.05)", border: "1px solid rgba(251,191,36,0.22)", borderRadius: RADIUS.sm, padding: "6px 9px" },
  groupHead: { ...TYPE.micro, color: COLOR.textDim, marginBottom: 3 },
  groupAxis: { color: COLOR.textFaint, fontWeight: 500, letterSpacing: 0 },
  groupCount: { color: COLOR.textFaint, fontFamily: "ui-monospace, monospace" },
  none: { fontSize: 13, color: "#8798b8", fontStyle: "italic", padding: "2px 0" },
  row: { display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, padding: "4px 8px", background: "rgba(90,120,180,0.05)", borderRadius: RADIUS.sm, marginBottom: 3 },
  qText: { fontSize: 13, color: COLOR.text, flex: 1, minWidth: 200 },
  qMeta: { fontSize: 12, color: COLOR.textFaint, fontFamily: "ui-monospace, monospace" },
  footer: { marginTop: SPACE.sm, paddingTop: 6, borderTop: `1px solid ${COLOR.border}`, fontSize: 13, color: COLOR.textFaint, lineHeight: 1.5 },
};
