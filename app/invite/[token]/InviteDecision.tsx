"use client";

/**
 * ACCEPT / DECLINE. A client component only so the server's answer can be
 * shown: both actions return a result, and a plain form action would discard
 * it — making a refusal look identical to a success.
 *
 * NO TOKEN CROSSES THIS BOUNDARY. A prop on a client component is serialised
 * into the page, so passing the token here would print a live credential in
 * the document source. The invitation is named by id, and the server checks
 * that the session IS the bound recipient — which is the gate that matters.
 */
import { useState, useTransition } from "react";

import {
  acceptInvitationAction, declineInvitationAction,
} from "@/app/lib/philos/community/invitationActions";
import { COLOR, RADIUS, SPACE } from "@/app/lib/philos/shell/designTokens";

export default function InviteDecision({ invitationId }: { invitationId: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: (fd: FormData) => Promise<{ ok: boolean; message?: string; state?: string }>) =>
    start(async () => {
      setErr(null);
      const fd = new FormData();
      fd.set("invitation_id", invitationId);
      const r = await fn(fd);
      if (r.ok) setDone(r.state ?? "OK"); else setErr(r.message ?? "נכשל");
    });

  if (done === "ACCEPTED") {
    return (
      <p data-accepted style={{ ...S.msg, color: "#34d399" }}>
        ✓ הצטרפת לקבוצה. תפקיד והרשאות לא הוענקו — הם דורשים החלטה נפרדת.
      </p>
    );
  }
  if (done === "DECLINED") {
    return <p data-declined style={S.msg}>ההזמנה נדחתה. לא נוצרה חברות.</p>;
  }

  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: SPACE.sm, marginTop: SPACE.lg,
      alignItems: "center" }}>
      <button type="button" disabled={pending} data-accept
        onClick={() => run(acceptInvitationAction)}
        style={{ ...S.btn, border: "1px solid #34d399", color: "#34d399" }}>
        {pending ? "…" : "קבל את ההזמנה"}
      </button>
      <button type="button" disabled={pending} data-decline
        onClick={() => run(declineInvitationAction)}
        style={{ ...S.btn, border: "1px solid #f2635c", color: "#f2635c" }}>
        דחה
      </button>
      {/* The server's own words, not a re-wording of them. */}
      {err ? <span style={{ ...S.msg, color: "#fc8a84" }}>{err}</span> : null}
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  btn: { fontSize: 16, fontWeight: 600, padding: "9px 20px", borderRadius: RADIUS.sm,
    background: "transparent", cursor: "pointer" },
  msg: { fontSize: 15, color: COLOR.textDim, lineHeight: 1.5, marginTop: SPACE.md },
};
