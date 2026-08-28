"use client";

/**
 * DAY OPENING / DAY CLOSING — the person's two acts, and nothing else.
 *
 * NO ACTION IS CREATED HERE. The operational Action of the day is created
 * through canon's own writer and its consent/MatchPermit gate. These panels
 * record only that a day was opened and that a closing was recorded — the
 * two things a person actually does that nothing else in the system can
 * observe for them.
 *
 * CONSENT IS A REAL CHECKBOX, never defaulted. The server refuses without it
 * (`dayEvent.ts` validation), so unchecking it is not a UI courtesy — the
 * write genuinely fails.
 *
 * THE CLOSING FORM DOES NOT DECIDE WHETHER THE DAY IS CLOSED. It records the
 * person's input. Whether that produces CLOSED or PARTIAL is derived from the
 * ten gates, server-side, and the panel shows what is still missing rather
 * than pretending the button is the decision.
 */
import { useState, useTransition } from "react";

import { openDay, recordDayClosing } from "@/app/lib/philos/day/dayActions";
import type { DaySession } from "@/app/lib/philos/day/daySession";
import type { LinkableObservation } from "@/app/lib/philos/day/linkableObservations";
import type { LinkableState } from "@/app/lib/philos/day/linkableStates";
import { COLOR, FS, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";
import type { ClosableState } from "@/app/lib/philos/day/closableStates";
import { SystemDrawer } from "@/app/lib/philos/shell/SystemDrawer";

function useDayForm() {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return { err, setErr, ok, setOk, pending, start };
}

export function DayOpeningPanel({ session, readOnly = false, linkable = [], linkableStates = [] }: {
  session: DaySession;
  readOnly?: boolean;
  /** The viewer's own eligible Observations, selected SERVER-side. The panel
   *  renders this list and never derives its own — the writer re-derives the
   *  same predicate from the store, so the two cannot drift apart. */
  linkable?: readonly LinkableObservation[];
  /** The viewer's own citable State(t0) records, selected SERVER-side. */
  linkableStates?: readonly LinkableState[];
}) {
  const { err, setErr, ok, setOk, pending, start } = useDayForm();
  const alreadyOpen = session.opened_at.value !== null;
  /* The resolved anchor, if the projection could resolve one. `null` means
     genuinely unlinked — never a placeholder. */
  const linkedRef = session.event_observation_refs.value?.[0] ?? null;

  /* Another day is VIEWED, never written. Backdating an opening a person did
     not perform would put a false record in a log that has no correction. */
  if (readOnly && !alreadyOpen) {
    return (
      <section dir="rtl" style={S.card} id="day-opening">
        <h3 style={S.title}>פתיחת יום</h3>
        <p style={S.note}>יום זה לא נפתח. פתיחה זמינה רק ליום הנוכחי — זו תצוגה בלבד.</p>
      </section>
    );
  }

  if (alreadyOpen) {
    return (
      <section dir="rtl" style={S.card} id="day-opening">
        <h3 style={S.title}>פתיחת יום</h3>
        <p style={S.line}>
          <span style={S.k}>נפתח</span>
          <span style={S.v}>{session.opened_at.value}</span>
        </p>
        <p style={S.line}>
          <span style={S.k}>כוונה</span>
          <span style={S.v}>{session.intention.value ?? "—"}</span>
        </p>
        <p style={S.line}>
          <span style={S.k}>הקשר</span>
          <span style={S.v}>{session.context.value ?? "—"}</span>
        </p>
        {/* WHAT THIS DAY IS ANCHORED TO. Rendered from the resolved session
            field, not from anything the form remembered. When nothing was
            linked it says so plainly rather than showing an empty row. */}
        <p style={S.line} data-day-observation-link={linkedRef ?? undefined}>
          <span style={S.k}>תצפית מקושרת</span>
          <span style={S.v}>
            {linkedRef
              ? <>{linkedRef.slice(0, 8)}… · record origin <b>REAL</b></>
              : "ללא קישור — EventObservationLinked נותר לא פתור"}
          </span>
        </p>
        <p style={S.note}>יום זה כבר נפתח. פתיחה שנייה נדחית — הלוג הוא append-only.</p>
      </section>
    );
  }

  return (
    <section dir="rtl" style={S.card} id="day-opening">
      <h3 style={S.title}>פתיחת יום</h3>
      <form
        action={(fd) =>
          start(async () => {
            setErr(null);
            setOk(null);
            const r = await openDay(fd);
            if (r.ok) setOk(`נפתח: ${r.day_id}`);
            else setErr(r.message);
          })
        }
        style={S.form}
      >
        <input type="hidden" name="date" value={session.date} />

        <label style={S.label}>
          <span style={S.k}>כוונה ליום</span>
          <input name="intention" required style={S.input} placeholder="מה המטרה היום" />
        </label>

        <label style={S.label}>
          <span style={S.k}>הקשר</span>
          <input name="context" required style={S.input} placeholder="מצב פתיחה, נסיבות" />
        </label>

        {/* ── STATE(t0) — ONE CONTROL, NOT A TYPED ID ──────────────────────
            This was a free-text input whose placeholder read `obs_…`, which is
            not even the right prefix: the resolver wants a `dstate_…`
            state_id. A person following the hint typed a ref that could never
            resolve, and the gate stayed shut with no explanation. */}
        {linkableStates.length > 0 ? (
          <label style={S.label}>
            <span style={S.k}>מצב פתיחה · State(t0)</span>
            <select name="state_t0_refs" defaultValue="" data-state-link style={S.input}>
              <option value="">— ללא מצב פתיחה (היום ייפתח חלקי) —</option>
              {linkableStates.map((st) => (
                <option key={st.state_id} value={st.state_id}>
                  {st.observed_at.slice(0, 16).replace("T", " ")}
                  {` · ${st.domain_id}/${st.parameter_id} · level ${st.level}`}
                  {st.declaresCause ? " · מצהיר סיבה" : ""}
                  {` · ${st.state_id.slice(0, 12)}…`}
                </option>
              ))}
            </select>
            <span style={S.small}>
              נבחר מצב אחד. השרת מאמת אותו מול המאגר לפני הכתיבה.
            </span>
          </label>
        ) : (
          <div data-state-link-empty style={S.carry}>
            <span style={S.k}>מצב פתיחה · State(t0)</span>
            <span style={S.small}>אין מצב פתיחה REAL זמין</span>
            <a href="/hub/human-config" style={S.link}>רישום State חדש ←</a>
          </div>
        )}

        {/* ── THE OBSERVATION LINK — ONE CONTROL, NOT TWO RAW IDS ──────────
            The options are the server's own eligible list, so what a person
            can pick is exactly what the writer will accept. There is no
            free-text id field: an Observation has no id of its own, and the
            server derives BOTH refs from this single selection.

            Empty is a legitimate answer and stays the default — the day opens
            PARTIAL and the gate stays honestly unresolved. */}
        {linkable.length > 0 ? (
          <label style={S.label}>
            <span style={S.k}>תצפית קיימת לקישור</span>
            <select name="observation_ref" defaultValue="" data-observation-link style={S.input}>
              <option value="">— ללא קישור (היום ייפתח חלקי) —</option>
              {linkable.map((o) => (
                <option key={o.canon_event_id} value={o.canon_event_id}>
                  {o.observed_at.slice(0, 16).replace("T", " ")}
                  {o.context ? ` · ${o.context.slice(0, 48)}` : ""}
                  {` · ${o.classifiedUnitCount}/10 יחידות`}
                  {` · ${o.canon_event_id.slice(0, 8)}…`}
                </option>
              ))}
            </select>
            <span style={S.small}>
              נבחרת תצפית אחת. השרת גוזר ממנה את שתי ההפניות ומאמת אותן מול המאגר.
            </span>
          </label>
        ) : (
          /* No fake option, and no zero presented as evidence — a real link to
             the one place an eligible Observation can come from. */
          <div data-observation-link-empty style={S.carry}>
            <span style={S.k}>תצפית קיימת לקישור</span>
            <span style={S.small}>אין תצפית REAL זמינה</span>
            <a href="#observation-form" style={S.link}>רישום תצפית חדשה ←</a>
          </div>
        )}

        {session.carry_forward.length > 0 && (
          <div style={S.carry}>
            <span style={S.k}>נגרר מאתמול</span>
            {session.carry_forward.slice(0, 6).map((l) => (
              <label key={l.ref} style={S.check}>
                <input type="checkbox" name="carry_forward_refs" value={l.ref} defaultChecked />
                <span style={S.small}>{l.detail}</span>
              </label>
            ))}
          </div>
        )}

        {/* ── WHAT OPENING COSTS, SAID BEFORE CONSENT ──────────────────────
            The opening is the ONLY writer of these two refs and a second
            opening is refused, so a day opened without them can never acquire
            them. Nothing said so; a person could open first and silently lose
            two gates for that date. */}
        <div data-opening-permanence style={S.permanence}>
          <b style={S.permanenceHead}>הפתיחה מתבצעת פעם אחת ליום</b>
          <span style={S.small}>
            התצפית ומצב הפתיחה חייבים להיווצר לפני הפתיחה ולהיבחר כאן.
            פתיחה ללא אחד מהם פותחת יום חלקי — ולא ניתן לצרף אותם לאותה פתיחה מאוחר יותר.
          </span>
          <span style={S.small}>
            {linkable.length > 0 ? `✓ ${linkable.length} תצפיות זמינות` : "✗ אין תצפית זמינה"}
            {" · "}
            {linkableStates.length > 0 ? `✓ ${linkableStates.length} מצבי פתיחה זמינים` : "✗ אין מצב פתיחה זמין"}
          </span>
          <span style={S.small}>
            <a href="#observation-form" style={S.link}>רישום תצפית</a>
            {" · "}
            <a href="/hub/human-config" style={S.link}>רישום State(t0)</a>
          </span>
        </div>

        <label style={S.check}>
          <input type="checkbox" name="consent" />
          <span style={S.small}>אני מאשר/ת רישום פתיחת יום (canon §10 CONSENT)</span>
        </label>

        <button type="submit" disabled={pending} style={S.btn}>
          {pending ? "רושם…" : "פתח/י יום"}
        </button>
      </form>
      {err && <p style={S.err}>{err}</p>}
      {ok && <p style={S.ok}>{ok}</p>}
    </section>
  );
}

export function DayClosingPanel({ session, readOnly = false, closableStates = [] }: {
  session: DaySession; readOnly?: boolean;
  /** Only states this day may legitimately close on. Resolved server-side. */
  closableStates?: readonly ClosableState[];
}) {
  const { err, setErr, ok, setOk, pending, start } = useDayForm();
  const closed = session.closing_recorded_at.value !== null;
  const notOpened = session.opened_at.value === null;

  return (
    /* `day-closing` is already taken by PersonEventOrientationHeader, which
       renders on every terminal — two elements sharing an id is invalid HTML
       and made the strip's anchor jump to the DEMO acceptance panel instead
       of this form. The newcomer yields. */
    <section dir="rtl" style={S.card} id="day-closing-record">
      <h3 style={S.title}>סגירת יום</h3>

      {/* The gates, before the form — so nobody submits expecting CLOSED and
          gets PARTIAL without having been told why. */}
      {session.missing_gates.length > 0 && (
        <div style={S.gates}>
          {/* The count leads in words; the gate names themselves are internal
              identifiers and move into the drawer with their reasons. */}
          <span style={S.k}>נותרו {session.missing_gates.length} שלבים להשלמה</span>
          <SystemDrawer id="closing-gates" title="אילו שלבים חסרים · פירוט" note="שמות פנימיים וסיבות">
          <ul style={S.ul}>
            {session.gates.filter((g) => !g.met).map((g) => (
              <li key={g.gate} style={S.li}>
                <b style={S.gateName}>{g.gate}</b>
                <span style={S.small}>{g.reason}</span>
              </li>
            ))}
          </ul>
          </SystemDrawer>
          <p style={S.note}>
            רישום סגירה כשעוד חסרים שלבים ייצור סגירה חלקית — לא סגירה מלאה. מה שנשאר פתוח ייגרר למחר.
          </p>
        </div>
      )}

      {closed ? (
        <p style={S.note}>
          סגירה נרשמה ב-{session.closing_recorded_at.value}. סטטוס נגזר: <b>{session.closing_status}</b>.
        </p>
      ) : readOnly ? (
        <p style={S.note}>תצוגה בלבד — סגירה זמינה רק ליום הנוכחי.</p>
      ) : notOpened ? (
        <p style={S.note}>לא ניתן לסגור יום שלא נפתח.</p>
      ) : (
        <form
          action={(fd) =>
            start(async () => {
              setErr(null);
              setOk(null);
              const r = await recordDayClosing(fd);
              if (r.ok) setOk(`נרשמה סגירה: ${r.day_id}`);
              else setErr(r.message);
            })
          }
          style={S.form}
        >
          <input type="hidden" name="date" value={session.date} />

          {/* A SELECTOR, NOT FREE TEXT. This asked for a typed id and hinted
              `obs_…` — the wrong prefix entirely, since the resolver wants a
              `dstate_…`. Anyone following the hint typed a ref that could never
              resolve, and the gate stayed shut with no explanation. The list
              holds only states this day can actually close on: REAL, this
              person's, and caused by something this day produced. */}
          <label style={S.label}>
            <span style={S.k}>מצב סיום · State(t1)</span>
            {closableStates.length === 0 ? (
              <span style={S.note}>
                אין עדיין מצב סיום זכאי. מצב סיום חייב להיות שלך, אמיתי, ולנבוע
                מהפעולה או מהתוצאה של היום הזה — רשום אותו קודם ב-Human Config.
              </span>
            ) : (
              <select name="state_t1_refs" data-closing-state style={S.input} defaultValue="">
                <option value="">— ללא מצב סיום (היום ייסגר חלקית) —</option>
                {closableStates.map((c) => (
                  <option key={c.state_id} value={c.state_id}>
                    {c.recorded_at.slice(0, 16).replace("T", " ")} · {c.parameter_id} · level {c.level}
                  </option>
                ))}
              </select>
            )}
          </label>

          {/* Real ids from this day's own chain — not free text. */}
          {(["action_refs", "effect_refs", "evidence_refs", "learning_refs"] as const).map((field) => {
            const src =
              field === "action_refs" ? session.action_refs
              : field === "effect_refs" ? session.effect_refs
              : field === "evidence_refs" ? session.evidence_refs
              : session.learning_refs;
            const values = src.value ?? [];
            return (
              <div key={field} style={S.refRow}>
                <span style={S.k}>{field}</span>
                {values.length === 0 ? (
                  <span style={S.unknown}>UNKNOWN — {src.unresolved_reason}</span>
                ) : (
                  values.map((v) => (
                    <label key={v} style={S.check}>
                      <input type="checkbox" name={field} value={v} defaultChecked />
                      <span style={S.small}>{v}</span>
                    </label>
                  ))
                )}
              </div>
            );
          })}

          {session.open_loops.length > 0 && (
            <div style={S.carry}>
              <span style={S.k}>לולאות פתוחות</span>
              {session.open_loops.slice(0, 8).map((l) => (
                <label key={l.ref} style={S.check}>
                  <input type="checkbox" name="open_loop_refs" value={l.ref} defaultChecked />
                  <span style={S.small}>{l.detail}</span>
                </label>
              ))}
            </div>
          )}

          <label style={S.check}>
            <input type="checkbox" name="consent" />
            <span style={S.small}>אני מאשר/ת רישום סגירת יום (canon §10 CONSENT)</span>
          </label>

          <button type="submit" disabled={pending} style={S.btn}>
            {pending ? "רושם…" : "רשום/י סגירה"}
          </button>
        </form>
      )}

      {err && <p style={S.err}>{err}</p>}
      {ok && <p style={S.ok}>{ok}</p>}

      {session.claims_under_review.length > 0 && (
        <p style={S.note}>
          {session.claims_under_review.length} טענות נותרות UNDER_REVIEW — סגירת היום אינה מאמתת אותן.
        </p>
      )}
    </section>
  );
}

const S = {
  card: {
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    background: COLOR.bgCard,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACE.sm,
  },
  title: { ...TYPE.subtitle, color: COLOR.text, margin: 0 },
  form: { display: "flex", flexDirection: "column" as const, gap: SPACE.sm },
  label: { display: "flex", flexDirection: "column" as const, gap: SPACE.xs },
  input: {
    background: COLOR.bg,
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.sm,
    color: COLOR.text,
    fontSize: FS.read,
    padding: `${SPACE.xs}px ${SPACE.sm}px`,
    width: "100%",
    boxSizing: "border-box" as const,
  },
  check: { display: "flex", alignItems: "center", gap: SPACE.xs, flexWrap: "wrap" as const },
  carry: { display: "flex", flexDirection: "column" as const, gap: SPACE.xs },
  refRow: { display: "flex", flexDirection: "column" as const, gap: SPACE.xs },
  btn: {
    background: COLOR.accent,
    border: "none",
    borderRadius: RADIUS.sm,
    color: "#08111f",
    cursor: "pointer",
    fontSize: FS.read,
    fontWeight: 700,
    padding: `${SPACE.xs}px ${SPACE.md}px`,
    alignSelf: "flex-start",
  },
  gates: { display: "flex", flexDirection: "column" as const, gap: SPACE.xs },
  ul: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" as const, gap: 2 },
  li: { display: "flex", gap: SPACE.sm, flexWrap: "wrap" as const, minWidth: 0 },
  gateName: {
    fontSize: FS.meta,
    color: COLOR.textDim,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  line: { display: "flex", gap: SPACE.sm, margin: 0, flexWrap: "wrap" as const },
  k: { ...TYPE.micro, color: COLOR.textFaint },
  v: { fontSize: FS.read, color: COLOR.text, overflowWrap: "anywhere" as const, minWidth: 0 },
  small: { fontSize: FS.meta, color: COLOR.textDim, overflowWrap: "anywhere" as const, minWidth: 0 },
  link: { fontSize: FS.base, color: "#5b9cf6", textDecoration: "underline" },
  permanence: {
    display: "flex", flexDirection: "column" as const, gap: 4,
    border: "1px solid rgba(251,191,36,0.35)", borderRadius: RADIUS.sm,
    background: "rgba(251,191,36,0.06)", padding: SPACE.sm,
  },
  permanenceHead: { fontSize: FS.base, fontWeight: 700, color: "#fbbf24" },
  unknown: { fontSize: FS.meta, color: "#fbbf24", overflowWrap: "anywhere" as const },
  note: { fontSize: FS.meta, color: COLOR.textFaint, margin: 0 },
  err: { fontSize: FS.meta, color: "#f2635c", margin: 0 },
  ok: { fontSize: FS.meta, color: "#34d399", margin: 0 },
} as const;
