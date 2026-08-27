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
import type { AssuranceTier } from "@/app/lib/philos/community/personCommunityLink";
import {
  ASSURANCE_LABEL, ASSURANCE_TONE, NO_INDEPENDENT_VERIFICATION, SECOND_STEP_PENDING,
  isSelfTier, storedStatusLine,
} from "@/app/lib/philos/community/identityAssuranceVocabulary";

/**
 * The tier a given stored status resolves to FOR THIS VIEWER'S OWN PANEL.
 *
 * This panel is the one surface that transitions the link, so it re-renders
 * from the action's returned status before the server round-trip lands. Both
 * writers produce `declaration_source: "self"` on a REAL record, so a status
 * they return maps to exactly one tier — this is a local echo of the writer's
 * own guarantee, not a second implementation of the resolver's rule. The
 * authoritative tier still arrives as `initialAssurance` from the server.
 */
const STATUS_TIER: Record<LinkStatus, AssuranceTier> = {
  NOT_LINKED: "NONE",
  UNVERIFIED: "NONE",
  CONFLICT: "NONE",
  DECLARED_SAME_PERSON: "SELF_DECLARED_SAME_PERSON",
  VERIFIED_SAME_PERSON: "SELF_ATTESTED_SAME_PERSON",
};

export default function PersonCommunityLinkPanel({
  personId,
  communityMemberId,
  communityMemberDisplayName,
  communityId,
  initialStatus,
  initialAssurance,
}: {
  personId: string;
  communityMemberId: string;
  communityMemberDisplayName: string;
  communityId: string;
  /** Stored status — audit metadata only. */
  initialStatus: LinkStatus;
  /** The resolver's tier. The conclusion this panel shows. */
  initialAssurance: AssuranceTier;
}) {
  const [status, setStatus] = useState<LinkStatus>(initialStatus);
  const [assurance, setAssurance] = useState<AssuranceTier>(initialAssurance);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const runAction = (action: () => Promise<IdentityLinkActionResult>) => {
    setMessage(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) setMessage(result.message);
      else { setStatus(result.link_status); setAssurance(STATUS_TIER[result.link_status]); }
    });
  };

  return (
    <section dir="rtl" style={S.card}>
      <div style={S.head}>
        <h3 style={S.title}>זהות אחת — Person ↔ Community Member</h3>
        {/* THE CONCLUSION is the tier. The stored status follows it, labelled. */}
        <span style={{ ...S.statusTag, color: ASSURANCE_TONE[assurance] }}>{ASSURANCE_LABEL[assurance]}</span>
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
      {isSelfTier(assurance) ? (
        <div style={S.row}>
          <span style={S.meta}>אימות</span>
          <span style={{ ...S.value, color: "#fbbf24" }}>
            {NO_INDEPENDENT_VERIFICATION}
            {assurance === "SELF_DECLARED_SAME_PERSON" ? ` · ${SECOND_STEP_PENDING}` : ""}
          </span>
        </div>
      ) : null}
      <div style={S.row}>
        <span style={S.meta}>AUDIT</span>
        <span style={{ ...S.value, color: "#8798b8" }}>{storedStatusLine(status)}</span>
      </div>

      <div style={S.note}>
        {status === "NOT_LINKED"
          ? "אין עדיין קישור מוצהר. אין התאמת שם תצוגה, אין ניחוש — רק הצהרה מפורשת."
          : status === "DECLARED_SAME_PERSON"
          ? "הוצהר פעם אחת. שלב שני, נפרד, נדרש כדי לאשר."
          : status === "VERIFIED_SAME_PERSON"
          ? "הנושא הצהיר ואישר בשני שלבים — הצהרה עצמית, לא אימות של גורם עצמאי (אין עוד משתתף במערכת היום)."
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
        {status === "VERIFIED_SAME_PERSON"
          ? <span style={{ color: "#34d399", fontSize: 13, fontWeight: 700 }}>✓ {ASSURANCE_LABEL.SELF_ATTESTED_SAME_PERSON}</span>
          : null}
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
