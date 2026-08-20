/**
 * DayClosingFusion — Human × Value chronological question layer, rendered
 * under Day Closing. Pure presentation over `dayClosingFusion.ts`'s
 * `buildDayClosingQuestions` — no logic lives here.
 *
 * Visual order (per the product requirement this was built from):
 * DAY SUMMARY → ACTION→EFFECT→EVIDENCE → HUMAN CHANGE ↔ VALUE-DOMAIN CHANGE
 * → SUPPORT/CONSTRAINT/GAP → TARGETED QUESTIONS → LEARNING →
 * TOMORROW CARRY-FORWARD (the last of these already exists in `DayCycle.tsx`
 * itself, immediately below where this component is rendered — not
 * duplicated here).
 */
import type { ActionLifecycleEntry } from "@/app/lib/philos/canon/actionLifecycle";
import type { TensionItem } from "@/app/lib/philos/tension";
import type { ClosingQuestion } from "@/app/lib/philos/dayClosingFusion";
import { humanChangeRows } from "@/app/lib/philos/dayClosingFusion";
import type { OrientationCore } from "@/app/lib/philos/orientationCore";

const DOMAIN_WORD: Record<"G" | "E" | "C", string> = { G: "גוף", E: "רגש", C: "שכל" };
const CLASS_LABEL: Record<ClosingQuestion["question_class"], string> = {
  clarify: "CLARIFY",
  evidence: "EVIDENCE",
  gap: "GAP",
  constraint: "CONSTRAINT",
  value: "VALUE",
  human_value: "HUMAN × VALUE",
  expected_vs_actual: "EXPECTED vs ACTUAL",
  learning: "LEARNING",
  next_action: "NEXT ACTION",
};
const CLASS_COLOR: Record<ClosingQuestion["question_class"], string> = {
  clarify: "#5b9cf6",
  evidence: "#fbbf24",
  gap: "#f2635c",
  constraint: "#f2635c",
  value: "#6c86b5",
  human_value: "#6c86b5",
  expected_vs_actual: "#a78bfa",
  learning: "#34d399",
  next_action: "#34d399",
};

export default function DayClosingFusion({
  core, todaysActions, questions,
}: {
  core: OrientationCore;
  todaysActions: ActionLifecycleEntry[];
  questions: ClosingQuestion[];
}) {
  const humanRows = humanChangeRows(core);
  const openQuestions = questions.filter((q) => q.status === "open");
  const blockedQuestions = questions.filter((q) => q.status === "blocked");

  return (
    <div dir="rtl" style={S.wrap}>
      <div style={S.head}>Human × Value — שכבת שאלות כרונולוגית</div>

      {/* ACTION → EFFECT → EVIDENCE */}
      <div style={S.subHead}>Action → Effect → Evidence (היום)</div>
      {todaysActions.length === 0 ? (
        <Empty>אין Action רשום היום.</Empty>
      ) : (
        <div style={S.list}>
          {todaysActions.map((a) => (
            <div key={a.action.action.action_id} style={S.row}>
              <span>{a.action.action.type}</span>
              <span style={S.meta}>{a.verification_state}</span>
              <span style={S.meta}>{a.effects.length} Effect(s)</span>
            </div>
          ))}
        </div>
      )}

      {/* HUMAN CHANGE ↔ VALUE-DOMAIN CHANGE — A012: when there is genuinely
          no real state anywhere yet, one compact acquisition-oriented line
          replaces 3 separate "UNKNOWN" domain rows + a "UNKNOWN" Value
          Domain row; once any real Observation exists, the real grid shows
          exactly as before (never hidden once real data exists). */}
      <div style={S.subHead}>Human Change ↔ Value-Domain Change</div>
      {humanRows.every((r) => r.current_level === null) ? (
        <Empty>אין עדיין תצפית אמיתית לאף ממד (גוף/רגש/שכל) — רשמו תצפית עצמית למעלה כדי להתחיל.</Empty>
      ) : (
        <div style={S.fusionRow}>
          <div style={S.fusionCol}>
            <div style={S.fusionColHead}>HUMAN</div>
            {humanRows.map((r) => (
              <div key={r.domain} style={S.row}>
                <span>{DOMAIN_WORD[r.domain]}</span>
                <span>{r.current_level === null ? "לא ידוע" : `level ${r.current_level}`}</span>
                <span style={S.meta}>{r.delta === null ? "אין דלתא" : `Δ ${r.delta >= 0 ? "+" : ""}${r.delta.toFixed(2)}`}</span>
              </div>
            ))}
          </div>
          <div style={S.fusionDivider}>↔</div>
          <div style={S.fusionCol}>
            <div style={S.fusionColHead}>VALUE DOMAIN</div>
            <Empty>אין עדיין תצורת Value Domain אמיתית.</Empty>
          </div>
        </div>
      )}

      {/* TARGETED QUESTIONS */}
      <div style={S.subHead}>שאלות ממוקדות · TARGETED QUESTIONS ({openQuestions.length})</div>
      {openQuestions.length === 0 ? (
        <Empty>אין שאלה מוצדקת היום — לא נמצא פער/ראיה חסרה/Tension פתוח.</Empty>
      ) : (
        <div style={S.list}>
          {openQuestions.map((q) => (
            <QuestionCard key={q.id} q={q} />
          ))}
        </div>
      )}

      <div style={S.subHead}>חסום · Human × Value (תמיד)</div>
      <div style={S.list}>
        {blockedQuestions.map((q) => (
          <QuestionCard key={q.id} q={q} />
        ))}
      </div>

      <div style={S.note}>
        מענה לשאלות אלה אינו כתוב כרגע לשום store — לתעד תשובה כ-Learning/Evidence אמיתי דורש החלטת סכימה, לא רק טופס UI.
      </div>
    </div>
  );
}

function QuestionCard({ q }: { q: ClosingQuestion }) {
  const color = CLASS_COLOR[q.question_class];
  return (
    <div style={{ ...S.qCard, borderColor: `${color}55` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ ...S.qClass, color }}>{CLASS_LABEL[q.question_class]}</span>
        {q.status === "blocked" ? <span style={S.blockedTag}>BLOCKED</span> : null}
      </div>
      <div style={S.qText}>{q.text}</div>
      <div style={S.qReason}>למה השאלה הזו? {q.reason}</div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}

const S: Record<string, React.CSSProperties> = {
  wrap: { marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(90,120,180,0.14)" },
  head: { fontSize: 13, fontWeight: 700, color: "#a78bfa", marginBottom: 10 },
  subHead: { fontSize: 13, fontWeight: 700, color: "#8fa3c9", marginTop: 10, marginBottom: 4 },

  list: { display: "flex", flexDirection: "column", gap: 4 },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13 },
  meta: { color: "#8aa0c8" },
  empty: { fontSize: 13, color: "#7b8ca6", fontStyle: "italic", padding: "3px 2px" },

  fusionRow: { display: "flex", gap: 10, alignItems: "stretch" },
  fusionCol: { flex: 1, display: "flex", flexDirection: "column", gap: 3 },
  fusionColHead: { fontSize: 12, fontWeight: 800, letterSpacing: 1, color: "#6c86b5", marginBottom: 2 },
  fusionDivider: { display: "flex", alignItems: "center", fontSize: 16, color: "#6c86b5" },

  qCard: { border: "1px solid", borderRadius: 8, padding: "8px 10px", background: "rgba(90,120,180,0.04)" },
  qClass: { fontSize: 12, fontWeight: 800, letterSpacing: 0.5 },
  blockedTag: { fontSize: 12, fontWeight: 800, color: "#6c86b5", border: "1px solid #6c86b555", borderRadius: 4, padding: "1px 5px" },
  qText: { fontSize: 13, color: "#dbe6f6", marginTop: 4 },
  qReason: { fontSize: 12, color: "#7f97c2", marginTop: 3, fontStyle: "italic" },

  note: { fontSize: 12, color: "#6c86b5", marginTop: 10, lineHeight: 1.6 },
};
