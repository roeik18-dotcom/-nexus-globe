"use client";

/**
 * Person ↔ Community-Member identity link — the real confirmation UI.
 * Shows the current resolved status for the one real triple (person_roei
 * ↔ p_you/"את/ה" ↔ the real Value Group) and the two-step declare→confirm
 * flow (`identityLinkActions.ts`). See `personCommunityLink.ts`'s own
 * header for why VERIFIED here means "self-confirmed twice," not
 * independent third-party verification — this codebase has no second
 * participant yet.
 */
import { useState, useTransition } from "react";
import type { LinkStatus } from "@/app/lib/philos/community/personCommunityLink";
import { confirmSamePersonAction, declareSamePersonAction, type IdentityLinkActionResult } from "./identityLinkActions";

const STATUS_LABEL: Record<LinkStatus, string> = {
  NOT_LINKED: "NOT_LINKED",
  UNVERIFIED: "UNVERIFIED",
  DECLARED_SAME_PERSON: "DECLARED_SAME_PERSON",
  VERIFIED_SAME_PERSON: "VERIFIED_SAME_PERSON",
  CONFLICT: "CONFLICT",
};
const STATUS_COLOR: Record<LinkStatus, string> = {
  NOT_LINKED: "#6c86b5",
  UNVERIFIED: "#fbbf24",
  DECLARED_SAME_PERSON: "#5b9cf6",
  VERIFIED_SAME_PERSON: "#34d399",
  CONFLICT: "#f2635c",
};

export default function PersonCommunityLinkPanel({
  personId,
  communityMemberId,
  communityMemberDisplayName,
  communityId,
  initialStatus,
}: {
  personId: string;
  communityMemberId: string;
  communityMemberDisplayName: string;
  communityId: string;
  initialStatus: LinkStatus;
}) {
  const [status, setStatus] = useState<LinkStatus>(initialStatus);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction = (action: () => Promise<IdentityLinkActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setMessage(result.message);
      else setStatus(result.link_status);
    });
  };

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h3 style={S.title}>זהות אחת — Person ↔ Community Member</h3>
        <span style={{ ...S.statusTag, color: STATUS_COLOR[status] }}>{STATUS_LABEL[status]}</span>
      </div>
      <div style={S.row}>
        <span style={S.meta}>PERSON (canon)</span>
        <span style={S.value}>{personId}</span>
      </div>
      <div style={S.row}>
        <span style={S.meta}>COMMUNITY_MEMBER (Value Group)</span>
        <span style={S.value}>{communityMemberId} · "{communityMemberDisplayName}"</span>
      </div>
      <div style={S.row}>
        <span style={S.meta}>COMMUNITY</span>
        <span style={S.value}>{communityId}</span>
      </div>

      <div style={S.note}>
        {status === "NOT_LINKED"
          ? "אין עדיין קישור מוצהר. אין התאמת שם תצוגה, אין ניחוש — רק הצהרה מפורשת."
          : status === "DECLARED_SAME_PERSON"
          ? "הוצהר פעם אחת. שלב שני, נפרד, נדרש כדי לאשר."
          : status === "VERIFIED_SAME_PERSON"
          ? "אושר בשני שלבים מפורשים על ידי אותו משתמש יחיד — לא אימות צד-שלישי (אין עוד משתתף במערכת היום)."
          : status === "CONFLICT"
          ? "נמצאה סתירה בין רשומות קישור אמיתיות — לא נפתר בשקט."
          : "קיימת הצהרה שאינה של המשתמש עצמו — ממתינה לאישורו."}
      </div>

      {message ? <div style={S.error}>{message}</div> : null}

      <div style={S.actions}>
        {status === "NOT_LINKED" ? (
          <button disabled={pending} onClick={() => runAction(declareSamePersonAction)} style={S.button}>
            {pending ? "…" : `הצהר: "${communityMemberDisplayName}" זה אני`}
          </button>
        ) : null}
        {status === "DECLARED_SAME_PERSON" ? (
          <button disabled={pending} onClick={() => runAction(confirmSamePersonAction)} style={{ ...S.button, background: "#34d399" }}>
            {pending ? "…" : "אשר שוב — שלב 2/2"}
          </button>
        ) : null}
        {status === "VERIFIED_SAME_PERSON" ? <span style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>✓ אותה זהות קנונית</span> : null}
      </div>
    </section>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { background: "rgba(18,24,38,0.7)", border: "1px solid rgba(91,156,246,0.3)", borderRadius: 16, padding: "16px 18px", margin: "16px 20px" },
  head: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  title: { fontSize: 13.5, fontWeight: 700, margin: 0, color: "#f0f4fc" },
  statusTag: { fontSize: 13, fontWeight: 800, letterSpacing: 0.5, fontFamily: "ui-monospace, monospace" },
  row: { display: "flex", justifyContent: "space-between", gap: 8, padding: "4px 8px", borderRadius: 6, background: "rgba(90,120,180,0.05)", fontSize: 13, marginBottom: 3 },
  meta: { color: "#8aa0c8" },
  value: { color: "#dbe6f6", fontWeight: 600 },
  note: { fontSize: 13, color: "#8fa3c9", lineHeight: 1.7, margin: "8px 0", maxWidth: 720 },
  error: { fontSize: 13, color: "#f2635c", marginBottom: 8 },
  actions: { marginTop: 8 },
  button: { fontSize: 13, fontWeight: 700, padding: "7px 16px", borderRadius: 10, border: "none", background: "#5b9cf6", color: "#0b0f1a", cursor: "pointer" },
};
