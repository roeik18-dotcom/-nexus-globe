/**
 * THE INVITE PAGE — what the invited person sees.
 *
 * It states what is being offered AND what is not. An invitation that only
 * said "join this group" would let someone accept believing a proposed role
 * came with it; the page names the role as a proposal and says plainly that
 * accepting does not grant it.
 *
 * SIGNED IN OR NOTHING. Accepting is a consent, and a consent needs a person.
 * `resolveViewerContext` throws for an unresolved viewer, and middleware
 * redirects the signed-out to /signin before this renders — so there is no
 * path where an anonymous visitor accepts on someone's behalf.
 *
 * OPENING THE LINK IS NOT ACCEPTING IT. Loading this page records
 * INVITATION_VIEWED and nothing more; membership needs the button.
 */
import Link from "next/link";

import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { systemClock } from "@/app/lib/philos/eventStore";
import { loadGroupEvents } from "@/app/lib/philos/community/groupEventStore";
import {
  checkRecipient, findByToken, isOpen, RECIPIENT_MESSAGE,
} from "@/app/lib/philos/community/invitation";
import { markViewedCore } from "@/app/lib/philos/community/invitationActions";
import { COLOR, COLOR_ROLE, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";
import InviteDecision from "./InviteDecision";

const STATE_HE: Record<string, string> = {
  ISSUED: "פתוחה", VIEWED: "פתוחה", ACCEPTED: "כבר התקבלה",
  DECLINED: "נדחתה", EXPIRED: "פגה", REVOKED: "בוטלה",
};

export default async function InvitePage(
  ctx: { params: Promise<{ token: string }> },
) {
  const { token } = await ctx.params;
  const viewer = await resolveViewerContext();

  const viewAudit = await markViewedCore(token);

  const { events } = loadGroupEvents();
  const inv = findByToken(events, token, systemClock.now());
  const who = inv ? checkRecipient(inv, viewer.person_id) : null;

  return (
    <main dir="rtl" style={S.page}>
      <div style={S.card}>
        <h1 style={S.h1}>הזמנה לקבוצת ערך</h1>

        {!inv ? (
          <p style={S.body}>הקישור אינו תקף. ייתכן שההזמנה בוטלה או שהקישור שגוי.</p>
        ) : (
          <>
            <dl style={{ margin: 0 }}>
              <Row k="מי מזמין" v={inv.inviter_id} />
              <Row k="לאיזו קבוצה" v={inv.group_id} />
              <Row k="מה מוצע" v="חברות בקבוצה" />
              <Row k="תפוגה" v={inv.expires_at.slice(0, 10)} />
              <Row k="מצב ההזמנה" v={STATE_HE[inv.state] ?? inv.state} />
            </dl>

            {/* THE HONEST HALF. Stated before the buttons, not after. */}
            <div data-not-granted style={S.warn}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>מה אינו מוענק אוטומטית</div>
              <ul style={S.list}>
                <li>תפקיד{inv.proposed_role ? ` — "${inv.proposed_role}" הוא הצעה בלבד` : ""}. נדרשת החלטה נפרדת.</li>
                <li>הרשאות או יכולות בקבוצה.</li>
                <li>קבלה מוסיפה חברות בלבד.</li>
              </ul>
            </div>

            {/* The view was not recorded. Say so rather than showing a
                state the log does not support. */}
            {!viewAudit.recorded && "because" in viewAudit ? (
              <p data-view-failed style={{ ...S.body, color: "#fc8a84" }}>
                פתיחת ההזמנה לא נרשמה ביומן. ההכרעה עדיין אפשרית, אך מצב הצפייה אינו מעודכן.
              </p>
            ) : null}

            {isOpen(inv) ? (
              who && !who.ok ? (
                <p data-not-recipient style={S.body}>{RECIPIENT_MESSAGE[who.reason]}</p>
              ) : (
                <InviteDecision invitationId={inv.invitation_id} />
              )
            ) : (
              <p style={S.body}>הזמנה זו אינה פתוחה עוד ולא ניתן להכריע בה.</p>
            )}
          </>
        )}

        <Link href="/hub/community" style={S.link}>← חזרה לקהילה</Link>
      </div>
    </main>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: "flex", gap: SPACE.md, padding: "7px 0",
      borderTop: `1px solid ${COLOR.border}` }}>
      <dt style={{ fontSize: 14, color: COLOR.textDim, minInlineSize: 110 }}>{k}</dt>
      <dd style={{ fontSize: 16, color: COLOR.text, margin: 0, wordBreak: "break-all" }}>{v}</dd>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  page: { background: COLOR.bg, minBlockSize: "100vh", padding: "40px 20px" },
  card: { maxInlineSize: 720, margin: "0 auto", background: COLOR.bgRaised,
    border: `1px solid ${COLOR.border}`, borderInlineStart: `4px solid ${COLOR_ROLE.green}`,
    borderRadius: RADIUS.lg, padding: `${SPACE.lg}px ${SPACE.xl}px` },
  h1: { fontSize: 26, color: COLOR.text, fontWeight: 700, margin: "0 0 12px" },
  body: { fontSize: 16, color: COLOR.textDim, lineHeight: 1.5 },
  warn: { marginTop: SPACE.md, padding: "12px 14px", borderRadius: RADIUS.md,
    background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.3)",
    fontSize: 15, color: COLOR.text, lineHeight: 1.6 },
  list: { margin: 0, paddingInlineStart: 18, color: COLOR.textDim },
  link: { display: "inline-block", marginTop: SPACE.lg, fontSize: 14,
    color: COLOR.textDim, textDecoration: "none" },
};
