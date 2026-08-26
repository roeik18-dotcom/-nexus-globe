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
import { COLOR, FS, RADIUS, SPACE, TYPE } from "@/app/lib/philos/shell/designTokens";

function useDayForm() {
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return { err, setErr, ok, setOk, pending, start };
}

export function DayOpeningPanel({ session, readOnly = false }: { session: DaySession; readOnly?: boolean }) {
  const { err, setErr, ok, setOk, pending, start } = useDayForm();
  const alreadyOpen = session.opened_at.value !== null;

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

        <label style={S.label}>
          <span style={S.k}>State(t0) refs</span>
          <input name="state_t0_refs" style={S.input} placeholder="obs_… (מזהה קיים)" />
        </label>

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

export function DayClosingPanel({ session, readOnly = false }: { session: DaySession; readOnly?: boolean }) {
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
          <span style={S.k}>שערים חסרים · {session.missing_gates.length}</span>
          <ul style={S.ul}>
            {session.gates.filter((g) => !g.met).map((g) => (
              <li key={g.gate} style={S.li}>
                <b style={S.gateName}>{g.gate}</b>
                <span style={S.small}>{g.reason}</span>
              </li>
            ))}
          </ul>
          <p style={S.note}>
            רישום סגירה עם שער חסר יניב <b>PARTIAL</b> — לא סגירה. הלולאות הפתוחות ייגררו למחר.
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

          <label style={S.label}>
            <span style={S.k}>State(t1) refs</span>
            <input name="state_t1_refs" style={S.input} placeholder="obs_… (מזהה קיים)" />
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
  unknown: { fontSize: FS.meta, color: "#fbbf24", overflowWrap: "anywhere" as const },
  note: { fontSize: FS.meta, color: COLOR.textFaint, margin: 0 },
  err: { fontSize: FS.meta, color: "#f2635c", margin: 0 },
  ok: { fontSize: FS.meta, color: "#34d399", margin: 0 },
} as const;
