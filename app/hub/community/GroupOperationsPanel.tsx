/**
 * GroupOperationsPanel — COMMUNITY's own question, drawn.
 *
 * Community is the GROUP terminal: its question is "how does this group
 * actually operate". The route answered it with six bare counters
 * (`CommunityFlow`) plus the shared spine — which is the same spine Globe and
 * World render, so Community never visibly answered anything only Community
 * could.
 *
 * The data was already there. `OperationalGroupProfile` — the object
 * `loadSelectedEntity` builds and now hands back — carries the real roster
 * with display names, and two genuine TIME SERIES that had never reached the
 * screen at all:
 *
 *   capital_flow          {date, delta, balance, currency}[] — every recorded
 *                         money movement, with the running balance after it.
 *   membership_over_time  {date, count}[] — how the group actually grew.
 *
 * A running balance and a growth curve are the two things a group operator
 * looks at first, and both were being reduced to "13,400 ILS · 4 תנועות".
 *
 * WHAT THIS COMPONENT WILL NOT DO:
 *   - It never invents a point. Both series are drawn from their own recorded
 *     dates; a single-point series renders as a single point, not a trend.
 *   - `GroupOperationalState` (`group-events.jsonl`) is a SEPARATE, newer log
 *     and is currently EMPTY. Its absence is reported as an unmeasured channel
 *     — never merged into these figures, and never drawn as a zero, because
 *     "no log" and "a log that recorded nothing" are different facts.
 *   - CLAIMED and VERIFIED effects are never summed.
 */
import type { GroupOperationalState } from "@/app/lib/philos/community/groupOperationalState";
import type { OperationalGroupProfile } from "@/app/lib/philos/valueSystem/operationalGroup";
import { COLOR, RADIUS, TYPE } from "@/app/lib/philos/shell/designTokens";
import { BOOTSTRAP_LABEL, BOOTSTRAP_TAG } from "@/app/lib/philos/eventProvenance";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

const CH_W = 460, CH_H = 96;

export default function GroupOperationsPanel({
  profile, state, spine,
}: {
  profile: OperationalGroupProfile;
  /** The newer operational log's state for this group, or null when it holds
   *  no event under this group id. Reported, never merged. */
  state: GroupOperationalState | null;
  /** The figures the shared spine publishes for the same group, so this panel
   *  can be checked against it rather than quietly diverging. Since the
   *  canonical correction pass these agree by construction: the spine's
   *  `budgetTransactionCount` and this panel's `capital_flow` are the same
   *  money-event set. The check stays so a future divergence is caught. */
  spine?: { memberCount: number; budgetTransactionCount: number };
}) {
  const flow = profile.capital_flow;
  const growth = profile.membership_over_time;
  const currency = flow.length > 0 ? flow[flow.length - 1].currency : "";
  const balance = flow.length > 0 ? flow[flow.length - 1].balance : null;

  /* THE TWO MEMBERSHIP QUANTITIES, named rather than reconciled.
     `member_count`             — persons affiliated by ANY affiliation event
                                  (founder / appointed leader / joiner).
     `membership_history_count` — `member.joined` events only, which is all a
                                  join curve can plot.
     They differ by exactly the founder and the appointed leaders, who are
     affiliated without a join event. Neither is corrected into the other. */
  const memberCount = profile.members.length;
  const membershipHistoryCount = growth.length;
  const joinedByEvent = growth.length > 0 ? growth[growth.length - 1].count : 0;
  const withoutJoinEvent = memberCount - membershipHistoryCount;

  /* Should be impossible after the correction pass; surfaced, not hidden. */
  const flowDrift = spine !== undefined && spine.budgetTransactionCount !== flow.length;

  return (
    <section dir="rtl" style={S.band}>
      <header style={S.head}>
        <div>
          <div style={S.eyebrow}>תפעול הקבוצה · GROUP OPERATION</div>
          <h2 style={S.title}>מי בקבוצה, איך גדלה, ולאן זז הכסף</h2>
        </div>
        <div style={S.headMeta}>
          {/* THE CHIPS CARRY THEIR OWN ORIGIN. `profile.members.length` and the
              balance are both projected from `bootstrap ++ appended`; printed
              bare they were the shortest, most quotable untrue figures on the
              screen. Each now states the REAL number and tags the rest. */}
          <span style={S.chip}>
            {profile.origin.joins.real} חברים REAL
            {profile.origin.joins.bootstrap > 0
              ? ` · +${profile.origin.joins.bootstrap} ${BOOTSTRAP_TAG}` : ""}
          </span>
          {/* The balance is CUMULATIVE, so a single seeded money event
              contaminates it entirely — `bootstrapOnly` was the wrong test,
              because a real `allocation.proposed` that moved no money made it
              false while every shekel shown was still seed. */}
          {balance !== null ? (
            <span style={{ ...S.chip, color: profile.origin.money.bootstrap > 0 ? "#fbbf24" : "#34d399" }}>
              {balance.toLocaleString()} {currency}
              {profile.origin.money.bootstrap > 0 ? ` · ${BOOTSTRAP_TAG}` : ""}
            </span>
          ) : null}
          <span style={{ ...S.chip, color: profile.verified_effects > 0 ? "#34d399" : "#fbbf24" }}>
            {profile.verified_effects}/{profile.effect_claims} מאומת
          </span>
        </div>
      </header>

      {/* ── THE TWO REAL SERIES ──────────────────────────────────────── */}
      <div style={S.charts}>
        <div style={S.chartCol}>
          <div style={S.colHead}>
            תנועות תקציב · BUDGET TRANSACTIONS
            {/* Same split as the roster: the REAL count leads, the reference
                bundle is named rather than folded in. */}
            <b style={S.colFigure}>{profile.origin.money.real}</b>
          </div>
          <div style={S.originLine}>
            {profile.origin.money.bootstrap > 0 ? (
              <>
                <span style={S.originTag}>{BOOTSTRAP_TAG}</span>
                <span>
                  {profile.origin.money.bootstrap} תנועות והיתרה המוצגת מגיעות מחבילת הייחוס
                  המהודרת — {BOOTSTRAP_LABEL}. אין כאן כסף REAL.
                </span>
              </>
            ) : null}
          </div>
          {flow.length === 0 ? (
            <Empty>
              לא נרשמה אף תנועת תקציב REAL. אין כרגע כותב תקציב או הקצאות במוצר —
              המסלול היחיד שקיים הוא חבילת הייחוס המהודרת, שאינה נתון המשתמש.
            </Empty>
          ) : (
            <CapitalFlowChart flow={flow} />
          )}
          <SemanticNote>
            תנועת תקציב = אירוע שהזיז כסף בפועל (resource_delta כספי ≠ 0).
            אלה בדיוק האירועים שמהם חושבה היתרה.
          </SemanticNote>
          {flowDrift ? (
            <Disagreement>
              הגרף מצייר {flow.length} תנועות והשדרה מדווחת {spine!.budgetTransactionCount} —
              שתי קריאות של אותה כמות שאינן תואמות. יש לבדוק את מקור התקציב.
            </Disagreement>
          ) : null}
        </div>

        <div style={S.chartCol}>
          {/* JOIN HISTORY — explicitly not "total membership". The curve can
              only plot `member.joined` events, so it is labelled as the join
              history it is, and the affiliation total lives on the roster. */}
          <div style={S.colHead}>
            היסטוריית הצטרפות · JOIN HISTORY
            <b style={S.colFigure}>{joinedByEvent}</b>
          </div>
          {growth.length === 0 ? (
            <Empty>לא נרשמה היסטוריית הצטרפות</Empty>
          ) : (
            <MembershipChart points={growth} />
          )}
          <SemanticNote>
            זו היסטוריית אירועי member.joined ({membershipHistoryCount}) — לא סך חברי הקבוצה.
            {withoutJoinEvent > 0
              ? ` ${withoutJoinEvent} מסונפים נוספים (מייסד וממונים) נכנסו ללא אירוע הצטרפות, ולכן אינם על העקומה. סך המסונפים ביומן המאוחד: ${memberCount} — מתוכם ${profile.origin.joins.real} REAL והשאר מחבילת הייחוס.`
              : ""}
          </SemanticNote>
        </div>
      </div>

      {/* ── THE ROSTER — real people, with the names the records carry ── */}
      <div>
        <div style={S.colHead}>
          חברים מסונפים · AFFILIATED MEMBERS
          {/* THE FIGURE IS SPLIT, NOT AVERAGED. `memberCount` counted the
              compiled seed roster together with the viewer's own recorded
              join and printed one number on a REAL screen. The REAL count is
              the one in the strong position; the reference bundle is named. */}
          <b style={S.colFigure}>{profile.origin.joins.real}</b>
        </div>
        {/* TWO SOURCES DISAGREE AND NEITHER IS PROMOTED. `memberships.jsonl`
            holds eight rows for this group and none of them is the viewer;
            the event log holds the viewer's own recorded join. They are shown
            side by side, unmerged, because silently unioning them is what
            produced a "9 members" figure nobody could account for. */}
        {profile.origin.joins.bootstrap > 0 ? (
          <div style={S.unresolvedLine}>
            <span style={S.unresolvedTag}>לא הוכרע</span>
            <span>
              שני מקורות חברות אינם מסכימים: <b>רשימת החברים השמורה</b> (רשומות מאוחסנות,
              ללא כותב במוצר) מול <b>אירועי ההצטרפות ביומן</b>. הם מוצגים זה לצד זה
              ואינם מאוחדים — קביעת המקור הסמכותי ומודל ביטול החברות היא החלטה פתוחה.
              {/* The two store names stay in the product, one click away: a
                  person reading "two sources disagree" is entitled to know
                  which two, and a test asserts both are still named here. */}
              <SystemDrawer id="membership-sources" title="שמות המקורות · פירוט מערכת" note="UNRESOLVED">
                <div dir="ltr" style={{ fontSize: 12, color: "#8fa3c9" }}>
                  <div><b>memberships.jsonl</b> — stored rows, no in-product writer</div>
                  <div><b>member.joined</b> — the viewer&apos;s own recorded join event</div>
                </div>
              </SystemDrawer>
            </span>
          </div>
        ) : null}
        <div style={S.originLine}>
          {profile.origin.joins.bootstrap > 0 ? (
            <>
              <span style={S.originTag}>{BOOTSTRAP_TAG}</span>
              <span>
                {profile.origin.joins.bootstrap} מתוך {memberCount} המסונפים מגיעים מחבילת הייחוס
                המהודרת (<code>valueGroupLog.ts</code>) — {BOOTSTRAP_LABEL}. הם אינם נספרים כ-REAL.
              </span>
            </>
          ) : null}
          {profile.origin.joins.real === 0 ? (
            <span> אין עדיין אף הצטרפות REAL מתועדת לקבוצה הזו.</span>
          ) : null}
        </div>
        <div style={S.roster}>
          {profile.members.map((m) => (
            <span key={m.person_id} style={S.person} title={m.person_id}>
              <i style={S.avatar}>{initials(m.display_name || m.person_id)}</i>
              <span style={S.personName}>{m.display_name || m.person_id}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── WHAT THE GROUP IS WORKING ON ─────────────────────────────── */}
      <div style={S.stats}>
        <Stat label="צרכים של חברים" term="MEMBER NEEDS" n={profile.member_needs.length} />
        <Stat label="משאבים של חברים" term="MEMBER OFFERS" n={profile.member_offers.length} />
        <Stat label="פעולות מקושרות בגשר" term="BRIDGE-LINKED" n={profile.linked_actions.length}
          note="join: ACTION_AFFECTS_COMMUNITY" />
        <Stat label="אפקטים נטענים" term="CLAIMED" n={profile.effect_claims} color="#fbbf24" />
        <Stat label="אפקטים מאומתים" term="VERIFIED" n={profile.verified_effects} color="#34d399" />
        <Stat label="מתחים" term="TENSIONS" n={profile.tensions.length}
          color={profile.tensions.length ? "#f87171" : undefined} />
      </div>

      {/* ── QUALITY + TREND, in the store's own words ─────────────────── */}
      <div style={S.quality}>
        <span style={{ ...S.qTag, color: "#5b9cf6", borderColor: "rgba(91,156,246,0.4)" }}>
          {profile.quality.status}
        </span>
        <span style={{ fontSize: 12.5, color: COLOR.textDim, lineHeight: 1.6 }}>
          {profile.quality.note}
        </span>
      </div>
      {profile.trend ? (
        <div style={{ fontSize: 12.5, color: COLOR.textFaint }}>מגמה · {profile.trend}</div>
      ) : null}

      {/* ── THE SEPARATE OPERATIONAL LOG. Absence stated, never merged. ── */}
      <div style={S.channelNote}>
        {state
          ? `יומן תפעולי נפרד: ${state.counts.events} אירועים (${state.counts.real} REAL)`
          : "יומן תפעולי נפרד (group-events) — ריק. זהו ערוץ שלא נמדד, ולא אפס שנמדד; "
            + "הנתונים למעלה מגיעים מיומן קבוצות-הערך, ולא מוזגו."}
      </div>
    </section>
  );
}

/** Money in/out as signed bars, with the recorded running balance over them.
 *  Both come from the SAME records — the balance is the store's, not a
 *  cumulative sum recomputed here. */
function CapitalFlowChart({ flow }: {
  flow: readonly { date: string; delta: number; balance: number; currency: string }[];
}) {
  const maxAbs = Math.max(...flow.map((f) => Math.abs(f.delta)), 1);
  const maxBal = Math.max(...flow.map((f) => f.balance), 1);
  const n = flow.length;
  const slot = CH_W / n;
  const bw = Math.min(slot * 0.5, 46);
  const zero = CH_H * 0.62;

  const pts = flow.map((f, i) => {
    const x = slot * i + slot / 2;
    const y = CH_H - 8 - (f.balance / maxBal) * (CH_H - 26);
    return { x, y, f };
  });

  return (
    <div dir="ltr" style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${CH_W} ${CH_H + 20}`} width="100%" height={CH_H + 20}
        role="img" aria-label={`${n} תנועות הון`} style={{ display: "block", minWidth: 300 }}>
        <line x1="0" y1={zero} x2={CH_W} y2={zero} stroke="rgba(120,150,220,0.25)" strokeWidth="1" />
        {flow.map((f, i) => {
          const h = (Math.abs(f.delta) / maxAbs) * (CH_H * 0.34);
          const x = slot * i + slot / 2 - bw / 2;
          const up = f.delta >= 0;
          return (
            <rect key={i} x={x} y={up ? zero - h : zero} width={bw} height={Math.max(h, 1)}
              fill={up ? "#34d399" : "#f87171"} fillOpacity={0.75} rx="2">
              <title>{`${f.date} · ${f.delta >= 0 ? "+" : ""}${f.delta.toLocaleString()} ${f.currency} · יתרה ${f.balance.toLocaleString()}`}</title>
            </rect>
          );
        })}
        {/* Recorded balance line */}
        <polyline fill="none" stroke="#5b9cf6" strokeWidth="1.5" strokeOpacity={0.9}
          points={pts.map((p) => `${p.x},${p.y}`).join(" ")} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="#5b9cf6" stroke="#0a0e17" strokeWidth="1" />
        ))}
        {flow.map((f, i) => (
          <text key={i} x={slot * i + slot / 2} y={CH_H + 14} textAnchor="middle"
            style={{ fontSize: 9.5, fill: "#6c86b5" }}>{f.date.slice(5, 10)}</text>
        ))}
      </svg>
      <div dir="rtl" style={S.chartKey}>
        <span style={S.keyItem}><i style={{ ...S.sw, background: "#34d399" }} />כניסה</span>
        <span style={S.keyItem}><i style={{ ...S.sw, background: "#f87171" }} />יציאה</span>
        <span style={S.keyItem}><i style={{ ...S.sw, background: "#5b9cf6" }} />יתרה רשומה</span>
      </div>
    </div>
  );
}

/** Membership as a step curve — a join is a step, never a smooth slope. */
function MembershipChart({ points }: { points: readonly { date: string; count: number }[] }) {
  const max = Math.max(...points.map((p) => p.count), 1);
  const n = points.length;
  const slot = n > 1 ? CH_W / (n - 1) : CH_W;
  const y = (c: number) => CH_H - 8 - (c / max) * (CH_H - 26);

  // Step path: hold the previous level until the next recorded date.
  let d = "";
  points.forEach((p, i) => {
    const x = n > 1 ? slot * i : CH_W / 2;
    if (i === 0) d += `M ${x} ${y(p.count)}`;
    else d += ` L ${x} ${y(points[i - 1].count)} L ${x} ${y(p.count)}`;
  });

  return (
    <div dir="ltr" style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${CH_W} ${CH_H + 20}`} width="100%" height={CH_H + 20}
        role="img" aria-label={`חברות לאורך זמן, ${n} נקודות`}
        style={{ display: "block", minWidth: 300 }}>
        <path d={d} fill="none" stroke="#34d399" strokeWidth="2" />
        {points.map((p, i) => {
          const x = n > 1 ? slot * i : CH_W / 2;
          return (
            <g key={i}>
              <circle cx={x} cy={y(p.count)} r="3.5" fill="#34d399"
                stroke="#0a0e17" strokeWidth="1">
                <title>{`${p.date} · ${p.count} חברים`}</title>
              </circle>
              <text x={x} y={y(p.count) - 8} textAnchor="middle"
                style={{ fontSize: 10, fontWeight: 700, fill: "#e6edf7" }}>{p.count}</text>
              <text x={x} y={CH_H + 14} textAnchor="middle"
                style={{ fontSize: 9.5, fill: "#6c86b5" }}>{p.date.slice(5, 10)}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function Stat({ label, term, n, color, note }: {
  label: string; term: string; n: number; color?: string;
  /** The JOIN this figure was produced by, when more than one join exists for
   *  the same concept. Two different joins must never look like one number
   *  disagreeing with itself. */
  note?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontSize: 12, color: COLOR.textFaint }}>{label}</span>
      <span style={{ fontSize: 19, fontWeight: 800, color: n > 0 ? (color ?? COLOR.text) : "#5a6d92" }}>
        {n}
      </span>
      <span style={{ ...TYPE.micro, fontSize: 10.5, color: COLOR.textFaint }}>{term}</span>
      {note ? (
        <span style={{ fontSize: 10.5, color: "#5a6d92", fontFamily: "ui-monospace, monospace" }}>
          {note}
        </span>
      ) : null}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12.5, color: "#5a6d92", fontStyle: "italic",
    padding: "14px 0" }}>{children}</div>;
}

/** A stated semantic distinction — NOT a warning. Two figures that differ
 *  because they measure different things are explained here in neutral type,
 *  so the reader never has to treat them as a contradiction. */
function SemanticNote({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, color: COLOR.textFaint, lineHeight: 1.6 }}>
      {children}
    </div>
  );
}

/** Two real readings of one quantity, both kept. Never averaged, never
 *  silently reconciled — the same rule `ChainContradiction` follows. */
function Disagreement({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11.5, color: "#fbbf24", lineHeight: 1.6,
      background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.22)",
      borderRadius: RADIUS.sm, padding: "5px 9px" }}>
      {children}
    </div>
  );
}

function initials(s: string): string {
  const parts = s.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] ?? "") + (parts[1][0] ?? "");
  return s.replace(/^[a-z_]+/, "").slice(0, 2) || s.slice(0, 2);
}

const S: Record<string, React.CSSProperties> = {
  /* Provenance is prose, not decoration: it sits under the figure it qualifies
     and is legible, never a faint footnote. */
  originLine: { display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap",
    fontSize: 12, lineHeight: 1.5, color: "#fbbf24", marginBlockStart: 4 },
  unresolvedLine: { display: "flex", alignItems: "baseline", gap: 6, flexWrap: "wrap",
    fontSize: 12, lineHeight: 1.5, color: "#f2635c", marginBlockStart: 6 },
  unresolvedTag: { fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px",
    borderRadius: 999, border: "1px solid rgba(242,99,92,0.45)", color: "#f2635c" },
  originTag: { fontSize: 10, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px",
    borderRadius: 999, border: "1px solid rgba(251,191,36,0.4)", color: "#fbbf24" },
  band: {
    background: "linear-gradient(180deg, rgba(52,211,153,0.06), rgba(11,15,26,0.9))",
    border: `1px solid ${COLOR.borderStrong}`, borderRadius: 20,
    padding: "16px 20px 14px", marginBlockEnd: 14,
    display: "flex", flexDirection: "column", gap: 12,
  },
  head: { display: "flex", flexWrap: "wrap", alignItems: "flex-end",
    justifyContent: "space-between", gap: 8 },
  eyebrow: { ...TYPE.micro, color: "#34d399", marginBottom: 4 },
  title: { fontSize: 15, fontWeight: 700, margin: 0, color: COLOR.text },
  headMeta: { display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" },
  chip: { fontSize: 12, fontWeight: 700, color: COLOR.textDim,
    border: `1px solid ${COLOR.border}`, borderRadius: RADIUS.pill, padding: "2px 9px",
    fontFamily: "ui-monospace, monospace" },

  charts: { display: "grid", gap: "14px 24px",
    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" },
  chartCol: { display: "flex", flexDirection: "column", gap: 6, minInlineSize: 0 },
  colHead: { display: "flex", alignItems: "baseline", gap: 8, ...TYPE.micro,
    color: COLOR.textFaint },
  colFigure: { marginInlineStart: "auto", fontSize: 17, fontWeight: 800, color: COLOR.text,
    letterSpacing: 0, textTransform: "none" },
  chartKey: { display: "flex", gap: 12, fontSize: 11.5, color: COLOR.textDim, marginBlockStart: 2 },
  keyItem: { display: "inline-flex", alignItems: "center", gap: 5 },
  sw: { inlineSize: 10, blockSize: 10, borderRadius: 2, display: "inline-block" },

  roster: { display: "flex", flexWrap: "wrap", gap: 6, marginBlockStart: 6 },
  person: { display: "inline-flex", alignItems: "center", gap: 6,
    background: "rgba(90,120,180,0.10)", borderRadius: RADIUS.pill, padding: "3px 11px 3px 4px" },
  avatar: { inlineSize: 21, blockSize: 21, borderRadius: "50%", display: "inline-flex",
    alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800,
    color: "#02101f", background: "#5b9cf6", fontStyle: "normal", flexShrink: 0 },
  personName: { fontSize: 12.5, color: COLOR.textDim },

  stats: { display: "grid", gap: "10px 18px", borderTop: `1px solid ${COLOR.border}`,
    paddingBlockStart: 10, gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))" },

  quality: { display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap",
    borderTop: `1px solid ${COLOR.border}`, paddingBlockStart: 10 },
  qTag: { ...TYPE.micro, fontSize: 11, border: "1px solid", borderRadius: RADIUS.pill,
    padding: "2px 9px", flexShrink: 0 },
  channelNote: { fontSize: 11.5, color: COLOR.textFaint, lineHeight: 1.6 },
};
