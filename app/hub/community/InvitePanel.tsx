"use client";

/**
 * INVITE A PERSON — the leader's side of the join path.
 *
 * THE LINK IS SHOWN ONCE. `issueInvitationAction` returns the plaintext token
 * exactly once, because only its hash is stored; there is no later screen
 * that can show it again. The panel therefore keeps it in view until the
 * leader navigates away, and says so.
 *
 * NO CHANNEL. Nothing here emails or texts the link. The leader copies it and
 * shares it however they already talk to that person — which also means the
 * system never holds a contact address it was not given.
 *
 * THE BUTTON IS NOT THE GATE. Revoke and issue re-check real leadership
 * server-side on every submit; hiding a control is a courtesy, not security.
 */
import { useState, useTransition } from "react";

import { issueInvitationAction, revokeInvitationAction } from "@/app/lib/philos/community/invitationActions";
import type { InvitationView } from "@/app/lib/philos/community/invitation";
import { COLOR, COLOR_ROLE, FS, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";

const STATE_HE: Record<string, string> = {
  ISSUED: "נשלחה", VIEWED: "נצפתה", ACCEPTED: "התקבלה",
  DECLINED: "נדחתה", EXPIRED: "פגה", REVOKED: "בוטלה",
};
const OPEN = new Set(["ISSUED", "VIEWED"]);

export default function InvitePanel({ groupId, canInvite, invitations }: {
  groupId: string | null;
  /** Real leadership, resolved on the server. */
  canInvite: boolean;
  invitations: InvitationView[];
}) {
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!groupId) {
    return (
      <section dir="rtl" style={S.card}>
        <h3 style={S.title}>הזמן אדם</h3>
        <p style={S.note}>אין קבוצה נבחרת. בחר/י קבוצה כדי להזמין אליה.</p>
      </section>
    );
  }

  return (
    <section dir="rtl" data-invite-panel style={S.card}>
      <h3 style={S.title}>הזמן אדם</h3>

      {canInvite ? (
        <form
          action={(fd) => start(async () => {
            setErr(null); setLink(null);
            const r = await issueInvitationAction(fd);
            if (r.ok) setLink(r.url); else setErr(r.message);
          })}
          style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, alignItems: "center" }}
        >
          <input type="hidden" name="group_id" value={groupId} />
          {/* REQUIRED. An invitation with no named recipient is a bearer
              token, so the form cannot create one. */}
          <input name="invitee_person_id" required placeholder="מזהה האדם המוזמן"
            data-invitee-field style={S.input} />
          <input name="proposed_role" placeholder="תפקיד מוצע (לא חובה)" style={S.input} />
          <button type="submit" disabled={pending} data-issue-invite style={S.primary}>
            {pending ? "…" : "צור קישור הזמנה"}
          </button>
          {/* Said next to the control that creates it, not in a tooltip. */}
          <span style={S.note}>תפקיד מוצע נשאר הצעה — קבלה אינה מעניקה אותו.</span>
        </form>
      ) : (
        <p style={S.note}>רק רכז/ת מאומת/ת של הקבוצה יכול/ה להזמין.</p>
      )}

      {err ? <p style={{ ...S.note, color: "#fc8a84" }}>{err}</p> : null}

      {link ? (
        <div data-invite-link style={{ ...S.linkBox }}>
          <div style={{ fontSize: FS.meta, color: COLOR.textDim, marginBottom: 4 }}>
            הקישור מוצג פעם אחת בלבד — העתק/י אותו עכשיו. במערכת נשמר רק גיבוב.
          </div>
          <code dir="ltr" style={S.code}>{link}</code>
        </div>
      ) : null}

      <div style={{ marginTop: SPACE.md }}>
        <div style={{ fontSize: FS.section, color: COLOR.text, marginBottom: 6 }}>
          הזמנות ({invitations.length})
        </div>
        {invitations.length === 0 ? (
          <p style={S.note}>אין הזמנות.</p>
        ) : invitations.map((inv) => (
          <div key={inv.invitation_id} data-invitation={inv.invitation_id} style={S.row}>
            <span style={{ fontSize: 15, color: COLOR.text }}>
              {STATE_HE[inv.state] ?? inv.state}
            </span>
            <span style={{ fontSize: FS.meta, color: COLOR.textDim }}>
              תפוגה {inv.expires_at.slice(0, 10)}
            </span>
            <span style={{ fontSize: FS.meta, color: COLOR.textFaint }}>
              נמען: {inv.invitee_person_id ?? "לא מקושר"}
            </span>
            {inv.proposed_role ? (
              <span style={{ fontSize: FS.meta, color: COLOR.textFaint }}>
                תפקיד מוצע: {inv.proposed_role} · לא הוענק
              </span>
            ) : null}
            {inv.accepted_by ? (
              <span style={{ fontSize: FS.meta, color: "#34d399" }}>הצטרף/ה</span>
            ) : null}
            {canInvite && OPEN.has(inv.state) ? (
              <form
                action={(fd) => start(async () => { await revokeInvitationAction(fd); })}
                style={{ marginInlineStart: "auto" }}
              >
                <input type="hidden" name="invitation_id" value={inv.invitation_id} />
                <button type="submit" data-revoke style={S.danger}>בטל</button>
              </form>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: COLOR.bgRaised, border: `1px solid ${COLOR.border}`,
    borderInlineStart: `4px solid ${COLOR_ROLE.green}`, borderRadius: RADIUS.lg,
    padding: `${SPACE.md}px ${SPACE.lg}px`, margin: "12px 0" },
  title: { fontSize: 22, color: COLOR.text, fontWeight: 700, margin: "0 0 8px" },
  note: { fontSize: 14, color: COLOR.textDim, lineHeight: 1.5, margin: "4px 0 0" },
  input: { fontSize: 15, padding: "7px 10px", borderRadius: RADIUS.sm,
    border: `1px solid ${COLOR.border}`, background: "rgba(0,0,0,0.25)", color: COLOR.text },
  primary: { fontSize: 15, fontWeight: 600, padding: "7px 16px", borderRadius: RADIUS.sm,
    border: `1px solid ${COLOR_ROLE.green}`, color: COLOR_ROLE.green,
    background: "transparent", cursor: "pointer" },
  danger: { fontSize: 13, padding: "4px 12px", borderRadius: RADIUS.sm,
    border: "1px solid #f2635c", color: "#f2635c", background: "transparent", cursor: "pointer" },
  linkBox: { marginTop: SPACE.md, padding: "10px 12px", borderRadius: RADIUS.md,
    background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.3)" },
  code: { fontSize: 14, color: "#9fd0ff", wordBreak: "break-all", display: "block" },
  row: { display: "flex", flexWrap: "wrap", gap: SPACE.md, alignItems: "baseline",
    padding: "8px 0", borderTop: `1px solid ${COLOR.border}` },
};
