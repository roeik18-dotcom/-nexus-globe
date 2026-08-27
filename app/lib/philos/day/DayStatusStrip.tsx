/**
 * DAY STATUS — the ONE compact strip all seven terminals render.
 *
 * Seven terminals, one component, one projection. The alternative — each
 * terminal drawing its own day header — is how seven screens end up
 * disagreeing about whether the day is closed. The full operational flow map
 * is deliberately NOT drawn here: it belongs to Hub and Dynamics, and
 * repeating it seven times would make every screen look like the same screen.
 *
 * What this strip shows is only what every terminal needs to share: which
 * day, whose day (both ids, and whether the bridge verified them as one
 * human), the derived status, what is missing, one next action, and a link
 * to the shared Day Closing. Terminal-specific projection goes beside it, as
 * `children`, not inside it.
 *
 * STATUS IS RENDERED, NEVER RECOMPUTED. `closing_status` and `missing_gates`
 * come from `daySession.ts`. A component that recomputed them would be a
 * second implementation of the gate rules, and the screen could then claim a
 * day was closed that the projection considered partial.
 */
import Link from "next/link";

import { COLOR, FS, RADIUS, SPACE, TYPE } from "../shell/designTokens";
import { nextActionFor, type DaySession } from "./daySession";
import {
  ASSURANCE_LABEL, ASSURANCE_TONE, NO_INDEPENDENT_VERIFICATION, SECOND_STEP_PENDING,
  isLinkedTier, isSelfTier, storedStatusLine,
} from "../community/identityAssuranceVocabulary";

const STATUS_COLOR: Record<DaySession["closing_status"], string> = {
  OPEN: COLOR.accent,
  PARTIAL: "#fbbf24",
  CLOSED: "#34d399",
};

const STATUS_LABEL: Record<DaySession["closing_status"], string> = {
  OPEN: "פתוח",
  PARTIAL: "חלקי",
  CLOSED: "סגור",
};

export default function DayStatusStrip({
  session,
  /** Where the shared Day Closing lives. One destination, from every terminal. */
  closingHref = "/hub#day-closing-record",
  children,
}: {
  session: DaySession;
  closingHref?: string;
  children?: React.ReactNode;
}) {
  const status = session.closing_status;
  const missing = session.missing_gates;
  /* THE TIER DECIDES WHAT IS SHOWN — the stored status is audit metadata.
     This read `link_status === "VERIFIED_SAME_PERSON"` and printed that string
     as the conclusion, which told a person their identity was VERIFIED when
     what actually happened is that they attested to it themselves, twice. */
  const assurance = session.identity.assurance;
  const linked = isLinkedTier(assurance);
  /* Absence of independent verification is STATED, never left to be inferred
     from the absence of a word. */
  const selfOnly = isSelfTier(assurance);

  return (
    <section dir="rtl" style={S.wrap} aria-label="מצב היום">
      <div style={S.row}>
        <span style={S.eyebrow}>יום · DAY</span>

        <span style={{ ...S.badge, borderColor: STATUS_COLOR[status], color: STATUS_COLOR[status] }}>
          {STATUS_LABEL[status]}
        </span>

        <span style={S.id} title={session.day_id}>{session.date}</span>

        {/* Both ids, always. Collapsing them would assert an identity the
            bridge alone is entitled to state. */}
        <span style={S.identity} data-identity-assurance={assurance}>
          <span style={S.idPart}>{session.identity.subject_id}</span>
          <span style={S.join}>{linked ? "≡" : "≠"}</span>
          <span style={S.idPart}>{session.identity.person_id}</span>
          {/* THE CONCLUSION, in words a person can act on. */}
          <span style={{ ...S.linkTag, color: ASSURANCE_TONE[assurance] }}>
            {ASSURANCE_LABEL[assurance]}
          </span>
          {assurance === "SELF_DECLARED_SAME_PERSON" && (
            <span style={S.noIndependent}>{SECOND_STEP_PENDING}</span>
          )}
          {selfOnly && (
            <span style={S.noIndependent}>{NO_INDEPENDENT_VERIFICATION}</span>
          )}
          {/* The stored value, labelled as exactly that — never presented as
              the conclusion, and never shown bare. */}
          <span style={S.storedStatus} data-stored-link-status={session.identity.link_status}>
            {storedStatusLine(session.identity.link_status)}
          </span>
        </span>

        {status !== "CLOSED" && (
          <span style={S.missing}>
            חסר {missing.length}/{session.gates.length}
          </span>
        )}

        <Link href={closingHref} style={S.closingLink}>
          סגירת יום ←
        </Link>
      </div>

      {/* One next action. Named from a real missing gate, never invented. */}
      <div style={S.next}>
        <span style={S.nextLabel}>הפעולה הבאה</span>
        <span style={S.nextText}>{nextActionFor(session)}</span>
      </div>

      {missing.length > 0 && (
        <ul style={S.gateList}>
          {session.gates.filter((g) => !g.met).map((g) => (
            <li key={g.gate} data-gate={g.gate} data-gate-met="false" style={S.gateItem}>
              <b style={S.gateName}>{g.gate}</b>
              <span style={S.gateReason}>{g.reason}</span>
            </li>
          ))}
        </ul>
      )}

      {/* WHAT IS ALREADY TRUE. The strip listed only what was missing, which
          made a gate that had just been satisfied simply disappear — the
          person got no confirmation that the thing they did counted, and a
          met gate had no rendering at all. Same list, same row shape; the
          only claim added is that these are done. */}
      {session.gates.some((g) => g.met) && (
        <ul style={S.gateList} data-gates-met>
          {session.gates.filter((g) => g.met).map((g) => (
            <li key={g.gate} data-gate={g.gate} data-gate-met="true" style={S.gateItem}>
              <b style={S.gateName}>{g.gate}</b>
              <span style={S.gateMet}>MET</span>
              {/* A gate that carries a reason WHEN MET says on what basis it
                  was met. Without this, IdentityLinked read as a bare "MET" —
                  which is exactly how a two-step self-report gets mistaken for
                  independent verification. Gates with nothing to qualify
                  (`reason: null`) render as before. */}
              {g.reason ? <span style={S.gateReason}>{g.reason}</span> : null}
            </li>
          ))}
        </ul>
      )}

      {/* CARRY-FORWARD — what this day inherited and what it will hand on.
          Rendered here rather than only inside the opening form, because on a
          read-only day (another date) that form is not shown at all, and the
          inherited loops are exactly what someone looking at another day came
          to see. */}
      {session.carry_forward.length > 0 && (
        <details style={S.carry}>
          <summary style={S.carrySummary}>
            נגרר · CARRY-FORWARD — {session.carry_forward.length}
          </summary>
          <ul style={S.gateList}>
            {session.carry_forward.slice(0, 12).map((l) => (
              <li key={`${l.kind}:${l.ref}`} style={S.gateItem}>
                <b style={S.gateName}>{l.kind}</b>
                <span style={S.gateReason}>{l.detail}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {children}
    </section>
  );
}

/**
 * Unresolved data, stated as UNKNOWN with its reason — never as zero.
 * Terminals pass the fields their own projection depends on.
 */
export function DayUnresolved({
  fields,
}: {
  fields: { label: string; reason: string | null }[];
}) {
  const unresolved = fields.filter((f) => f.reason !== null);
  if (unresolved.length === 0) return null;
  return (
    <div dir="rtl" style={S.unresolved}>
      <span style={S.eyebrow}>לא ידוע · UNKNOWN</span>
      <ul style={S.gateList}>
        {unresolved.map((f) => (
          <li key={f.label} style={S.gateItem}>
            <b style={S.gateName}>{f.label}</b>
            <span style={S.gateReason}>{f.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const S = {
  wrap: {
    border: `1px solid ${COLOR.border}`,
    borderRadius: RADIUS.md,
    background: COLOR.bgRaised,
    padding: SPACE.md,
    marginBottom: SPACE.lg,
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACE.sm,
  },
  row: {
    display: "flex",
    flexWrap: "wrap" as const,
    alignItems: "center",
    gap: SPACE.sm,
    minWidth: 0,
  },
  eyebrow: { ...TYPE.micro, color: COLOR.textFaint },
  badge: {
    ...TYPE.micro,
    border: "1px solid",
    borderRadius: RADIUS.pill,
    padding: `2px ${SPACE.sm}px`,
  },
  id: { fontSize: FS.meta, color: COLOR.text, fontWeight: 700 },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: SPACE.xs,
    flexWrap: "wrap" as const,
    minWidth: 0,
  },
  idPart: {
    fontSize: FS.meta,
    color: COLOR.textDim,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    overflowWrap: "anywhere" as const,
  },
  join: { fontSize: FS.meta, color: COLOR.textFaint },
  linkTag: { ...TYPE.micro },
  noIndependent: { ...TYPE.micro, color: "#fbbf24" },
  storedStatus: { ...TYPE.micro, color: COLOR.textFaint },
  missing: { fontSize: FS.meta, color: "#fbbf24", fontWeight: 700 },
  closingLink: {
    marginInlineStart: "auto",
    fontSize: FS.meta,
    color: COLOR.accent,
    textDecoration: "none",
    fontWeight: 700,
  },
  next: { display: "flex", alignItems: "baseline", gap: SPACE.sm, flexWrap: "wrap" as const },
  nextLabel: { ...TYPE.micro, color: COLOR.textFaint },
  nextText: { fontSize: FS.read, color: COLOR.text, fontWeight: 600 },
  gateList: { listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column" as const, gap: 2 },
  gateItem: { display: "flex", gap: SPACE.sm, flexWrap: "wrap" as const, minWidth: 0 },
  gateName: {
    fontSize: FS.meta,
    color: COLOR.textDim,
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
  },
  gateReason: { fontSize: FS.meta, color: COLOR.textFaint, overflowWrap: "anywhere" as const, minWidth: 0 },
  gateMet: { fontSize: FS.meta, color: "#34d399", fontWeight: 700 },
  carry: { borderTop: `1px solid ${COLOR.border}`, paddingTop: SPACE.xs },
  carrySummary: { ...TYPE.micro, color: COLOR.textDim, cursor: "pointer" },
  unresolved: {
    display: "flex",
    flexDirection: "column" as const,
    gap: SPACE.xs,
    borderTop: `1px solid ${COLOR.border}`,
    paddingTop: SPACE.sm,
  },
} as const;
