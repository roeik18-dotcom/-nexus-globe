/**
 * `/decisions` — the one job: "I decided X. Was I right?"
 *
 * The page answers three questions in this order, and nothing else:
 *   1. What is waiting for me to look at it today.
 *   2. What has this journal actually shown so far.
 *   3. What did I decide, historically.
 *
 * There is ONE action at a time. When something is due, that action is
 * reviewing it — recording a new decision is available but demoted, because
 * a journal that lets you keep adding without ever closing is how the
 * unreviewed pile becomes the product.
 *
 * The empty account gets one empty state and one form. Not a chain of
 * panels, not a metric, not nine terminals' worth of scaffolding for a
 * person who has recorded nothing.
 */
import SignOutButton from "@/app/signin/SignOutButton";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { requiredTierFor } from "@/app/lib/philos/decision/decision";
import {
  inQueueOrder,
  projectReviewQueue,
  type QueueEntry,
  summariseOutcomes,
} from "@/app/lib/philos/decision/decisionProjection";
import { loadDecisionReviews, loadDecisions } from "@/app/lib/philos/decision/decisionStore";
import { systemClock } from "@/app/lib/philos/eventStore";
import PhilosNav from "@/app/lib/philos/shell/PhilosNav";
import RecordDecisionForm from "./RecordDecisionForm";
import ReviewDecisionForm from "./ReviewDecisionForm";

export const metadata = { title: "Philos — החלטות" };
export const dynamic = "force-dynamic";

const OUTCOME_LABEL: Record<string, string> = {
  met: "התממש",
  partly: "חלקית",
  not_met: "לא התממש",
  cannot_tell: "אי אפשר לדעת",
};

const SUPPORT_LABEL: Record<string, string> = {
  happened_after: "קרה אחרי",
  correlated: "יש קשר",
  plausibly_contributed: "כנראה תרם",
  causally_supported: "נתמך סיבתית",
  experimentally_shown: "הוכח בחזרה",
};

export default async function DecisionsPage() {
  const viewer = await resolveViewerContext();
  const now = systemClock.now();

  const [decisionRecords, reviewRecords] = await Promise.all([
    loadDecisions(),
    loadDecisionReviews(),
  ]);

  const mine = decisionRecords
    .filter((r) => r.decision.subject === viewer.subject_id)
    .map((r) => r.decision);
  const reviews = reviewRecords.map((r) => r.review);

  const queue = inQueueOrder(projectReviewQueue(mine, reviews, now));
  const summary = summariseOutcomes(queue);

  const due = queue.filter((e) => e.status === "due");
  const awaiting = queue.filter((e) => e.status === "awaiting");
  const reviewed = queue.filter((e) => e.status === "reviewed");
  const next = due[0];

  return (
    <div style={{ minHeight: "100vh", background: "#0b0f1a" }}>
      <div style={{ padding: "12px 20px 0" }}>
        <PhilosNav />
      </div>

      <div dir="rtl" style={S.page}>
        <h1 style={S.title}>מה החלטת, והאם צדקת</h1>

        {mine.length === 0 ? (
          <>
            <p style={S.lede}>
              רשום החלטה אחת ומה אתה מצפה שיקרה. בתאריך שתקבע נחזור ונשאל אותך מה קרה
              בפועל. זה הכול — אין כאן מה למלא מעבר לזה.
            </p>
            <section style={S.card}>
              <RecordDecisionForm />
            </section>
          </>
        ) : (
          <>
            {next ? (
              <section style={S.cardDue}>
                <div style={S.eyebrow}>
                  הגיע מועד הבדיקה
                  {next.overdue_days && next.overdue_days > 0
                    ? ` · עברו ${next.overdue_days} ימים`
                    : null}
                </div>
                <h2 style={S.h2}>{next.decision.statement}</h2>
                <p style={S.because}>החלטת כך כי: {next.decision.because}</p>
                <ReviewDecisionForm
                  decisionId={next.decision.decision_id}
                  expectation={next.decision.expected_outcome}
                  requiredTier={requiredTierFor(next.decision.stakes)}
                  hasAlternatives={next.decision.alternatives_considered.length > 0}
                />
              </section>
            ) : (
              <p style={S.lede}>
                אין כרגע החלטה שהגיע מועד הבדיקה שלה.
                {awaiting.length > 0
                  ? ` ${awaiting.length} ממתינות למועד שקבעת.`
                  : null}
              </p>
            )}

            <section style={S.summary}>
              <h2 style={S.h2}>מה היומן הזה הראה עד עכשיו</h2>
              {/* COUNTS, ALWAYS BESIDE THEIR TOTAL. No rate is computed — see
                  `decisionProjection.ts` for why a ratio over a self-selected
                  sample is a mood, not an accuracy figure. */}
              <ul style={S.counts}>
                <Count n={summary.total} label="החלטות נרשמו" />
                <Count n={summary.reviewed} label={`נסקרו מתוך ${summary.total}`} />
                <Count n={summary.met} label={`ציפיות שהתממשו מתוך ${summary.reviewed} שנסקרו`} />
                <Count n={summary.not_met} label={`ציפיות שלא התממשו מתוך ${summary.reviewed}`} />
                <Count n={summary.cannot_tell} label={`עדיין אי אפשר לדעת, מתוך ${summary.reviewed}`} />
                <Count
                  n={summary.surprises}
                  label={`הפתעות שנרשמו מתוך ${summary.reviewed}`}
                  note="המספר היחיד כאן ששווה לעקוב אחריו"
                />
              </ul>
              {summary.reviewed === 0 ? (
                <p style={S.note}>
                  עוד לא נסקרה אף החלטה, ולכן אין כאן שום דבר להסיק ממנו. זה מצב תקין
                  ביומן חדש.
                </p>
              ) : null}
              {summary.unreviewed_overdue > 1 ? (
                <p style={S.note}>
                  {summary.unreviewed_overdue} החלטות עברו את מועד הבדיקה ולא נסקרו. ערמה
                  כזו היא הסימן המובהק שהיומן הפסיק להיקרא.
                </p>
              ) : null}
            </section>

            {reviewed.length > 0 ? (
              <section style={S.card}>
                <h2 style={S.h2}>מה כבר נסגר</h2>
                <ul style={S.list}>
                  {reviewed.map((e) => (
                    <li key={e.decision.decision_id} style={S.item}>
                      <div style={S.itemHead}>{e.decision.statement}</div>
                      <div style={S.itemMeta}>
                        {OUTCOME_LABEL[e.review!.expectation_met]} ·{" "}
                        {SUPPORT_LABEL[e.review!.causal_support]}
                        {e.review!.verification_tier === "self_attested"
                          ? " · אישור עצמי"
                          : null}
                        {e.review!.reviewed_early ? " · נסקר לפני המועד" : null}
                      </div>
                      {e.review!.surprise ? (
                        <div style={S.surprise}>הפתיע: {e.review!.surprise}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {awaiting.length > 0 ? (
              <section style={S.card}>
                <h2 style={S.h2}>ממתינות למועד</h2>
                <ul style={S.list}>
                  {awaiting.map((e) => (
                    <li key={e.decision.decision_id} style={S.item}>
                      <div style={S.itemHead}>{e.decision.statement}</div>
                      <div style={S.itemMeta}>
                        נבדוק ב־{String(e.decision.review_due).slice(0, 10)}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            {/* DEMOTED ON PURPOSE. Adding is always possible; it is never the
                thing the page leads with once something is waiting. */}
            <details style={S.drawer}>
              <summary style={S.summaryLine}>רשום החלטה חדשה</summary>
              <div style={S.drawerBody}>
                <RecordDecisionForm />
              </div>
            </details>
          </>
        )}

        <details style={S.drawer}>
          <summary style={S.summaryLine}>פרטים טכניים</summary>
          <div style={S.drawerBody}>
            <TechnicalRows viewerSubject={viewer.subject_id} queue={queue} now={now} />
          </div>
        </details>

        <div style={{ marginBlockStart: 8 }}>
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}

function Count({ n, label, note }: { n: number; label: string; note?: string }) {
  return (
    <li style={S.count}>
      <span style={S.countN}>{n}</span>
      <span style={S.countLabel}>{label}</span>
      {note ? <span style={S.countNote}>{note}</span> : null}
    </li>
  );
}

function TechnicalRows({
  viewerSubject,
  queue,
  now,
}: {
  viewerSubject: string;
  queue: readonly QueueEntry[];
  now: string;
}) {
  return (
    <div style={S.tech}>
      <div>subject · {viewerSubject}</div>
      <div>now · {now}</div>
      <div>decisions.jsonl · decision-reviews.jsonl</div>
      {queue.map((e) => (
        <div key={e.decision.decision_id}>
          {e.decision.decision_id} · {e.status} · stakes={e.decision.stakes} ·
          origin={e.decision.record_origin} · due={e.decision.review_due}
          {e.review ? ` · review=${e.review.review_id} · ${e.review.causal_support}` : ""}
        </div>
      ))}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: {
    display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1fr)",
    maxWidth: 820, margin: "0 auto", padding: "8px 16px 32px", minWidth: 0,
  },
  title: { fontSize: "clamp(22px, 5vw, 30px)", fontWeight: 800, color: "#f2f6fc", margin: 0, lineHeight: 1.25 },
  lede: { margin: 0, fontSize: 16, lineHeight: 1.65, color: "#9fb0d0" },
  h2: { fontSize: 18, fontWeight: 700, color: "#e6ebf5", margin: 0 },
  card: {
    padding: 16, borderRadius: 12, background: "rgba(20,28,46,0.6)",
    border: "1px solid rgba(120,150,220,0.16)", display: "grid", gap: 12,
  },
  cardDue: {
    padding: 16, borderRadius: 12, background: "rgba(20,28,46,0.75)",
    border: "1px solid rgba(251,191,36,0.4)", display: "grid", gap: 10,
  },
  eyebrow: { fontSize: 12.5, fontWeight: 700, color: "#fbbf24" },
  because: { margin: 0, fontSize: 14.5, lineHeight: 1.6, color: "#9fb0d0" },
  summary: {
    padding: 16, borderRadius: 12, background: "rgba(20,28,46,0.6)",
    border: "1px solid rgba(120,150,220,0.16)", display: "grid", gap: 10,
  },
  counts: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 },
  count: { display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" },
  countN: { fontSize: 20, fontWeight: 800, color: "#f2f6fc", minWidth: 28 },
  countLabel: { fontSize: 14.5, color: "#c9d6ea" },
  countNote: { fontSize: 12.5, color: "#8fa3c9" },
  note: { margin: 0, fontSize: 14, lineHeight: 1.6, color: "#8fa3c9" },
  list: { listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 10 },
  item: { display: "grid", gap: 3 },
  itemHead: { fontSize: 15.5, color: "#e6ebf5" },
  itemMeta: { fontSize: 13, color: "#8fa3c9" },
  surprise: { fontSize: 13.5, color: "#c9a6f5" },
  drawer: { borderTop: "1px solid rgba(120,150,220,0.14)", paddingBlockStart: 8 },
  summaryLine: {
    cursor: "pointer", listStyle: "none", fontSize: 13, fontWeight: 700,
    color: "#7d90b4", paddingBlock: 4,
  },
  drawerBody: { paddingBlockStart: 10 },
  tech: {
    display: "grid", gap: 4, fontSize: 11.5, color: "#6c86b5",
    fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere",
  },
};
