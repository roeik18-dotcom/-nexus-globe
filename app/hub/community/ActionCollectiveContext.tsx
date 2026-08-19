/**
 * ActionCollectiveContext — additive to `/hub/community`, below
 * `CommunityCommandTerminal`. Connects canon Action/Effect to collective
 * context ONLY where real data supports it (Action/Effect/Learning
 * integration pass).
 *
 * **Why "group action"/"community effect"/"collective effect" are shown as
 * UNKNOWN, not computed.** Canon's `Action` (`action.ts`, §13) carries
 * `owner: string` — a single real-world subject, no `group_id` field of any
 * kind. There is therefore no real, stored data connecting a canon Action to
 * the legacy Value-Group log's `group_id` (a structurally separate ontology
 * — see `canonEvent.ts`'s own header on why canon and the legacy event
 * system deliberately never merge). Inventing that link here — e.g. by
 * matching `Action.owner` against a group's member list — would be exactly
 * the fabricated group attribution this pass explicitly forbids. What IS
 * real and shown: the total count of canon Actions system-wide (every
 * canon Action is, by its own schema, an INDIVIDUAL action — canon has no
 * concept of a collective Action at all), verbatim from `actionStore`.
 * `CommunityCommandTerminal.tsx` (sibling, above) already shows the real
 * GROUP-level metrics — from the legacy Value-Group log, which does carry
 * real group semantics — so this component does not duplicate those.
 *
 * **Identity-link addition**: the canon/Value-Group id-space gap above is
 * about GROUP attribution (no `group_id` on `Action`) and remains real and
 * unresolved. A SEPARATE, narrower question — "is this community's own
 * member the SAME human as the canon subject who owns these Actions" — now
 * has a real, checked answer via `personCommunityLink.ts`. When (and only
 * when) that link is `VERIFIED_SAME_PERSON`, this component may honestly
 * count `Action`s owned by that exact linked `person_id` as this member's
 * own individual actions — still never "group"/"collective", which stays
 * UNKNOWN exactly as before.
 */
import type { ActionRecord } from "@/app/lib/philos/canon/actionStore";
import type { LinkStatus } from "@/app/lib/philos/community/personCommunityLink";

export default function ActionCollectiveContext({
  actions,
  identityLink,
}: {
  actions: ActionRecord[];
  /** Real, checked (`resolveShellIdentityLink`) — when `VERIFIED_SAME_
   *  PERSON`, `person_id` is the canon subject this community's member is
   *  the same human as. */
  identityLink?: { status: LinkStatus; person_id: string; community_member_id: string };
}) {
  const linked = identityLink?.status === "VERIFIED_SAME_PERSON";
  const memberOwnActions = linked ? actions.filter((a) => a.action.owner === identityLink!.person_id) : [];

  return (
    <div dir="rtl" style={S.card}>
      <div style={S.head}>Action קנוני — הקשר קולקטיבי</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 10 }}>
        <Metric label="פעולה אישית (individual)" value={`${actions.length} Actions`} color="#f2635c" note="כל Action קנוני הוא אישי — owner יחיד, אין group_id" />
        <Metric label="פעולה קבוצתית (group)" value="לא ידוע" color="#5a76a3" note="Action קנוני אינו נושא group_id — אין קישור אמיתי לקבוצה" />
        <Metric label="השפעה קהילתית (community)" value="לא ידוע" color="#5a76a3" note="אין נתון אמיתי המקשר Effect לקהילה" />
        <Metric label="השפעה קולקטיבית (collective)" value="לא ידוע" color="#5a76a3" note="אין נתון אמיתי המקשר Effect לקבוצה" />
      </div>

      {linked ? (
        <div style={S.linkedRow}>
          <span style={{ color: "#34d399", fontWeight: 700 }}>{memberOwnActions.length}</span> Action{"("}ים{")"} של{" "}
          <b>{identityLink!.person_id}</b> — אותה זהות קנונית כמו החבר/ה "{identityLink!.community_member_id}" בקהילה זו
          (VERIFIED_SAME_PERSON).
        </div>
      ) : (
        <div style={S.note}>
          זהות ה-owner של Action קנוני לעומת חברי הקהילה: {identityLink?.status ?? "לא נבדק"} — ראה פאנל הזהות למעלה כדי לקשר במפורש.
        </div>
      )}

      <div style={S.note}>
        שתי המערכות (canon ו-Value-Group) נשארות נפרדות במכוון — אין מיזוג מזהים, אין ייחוס קבוצתי מומצא.
      </div>
    </div>
  );
}

function Metric({ label, value, color, note }: { label: string; value: string; color: string; note: string }) {
  return (
    <div style={{ minWidth: 150 }}>
      <div style={{ fontSize: 9, letterSpacing: 1, color: "#5a76a3", textTransform: "uppercase" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 10, color: "#7b8ca6", marginTop: 2 }}>{note}</div>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  card: { fontFamily: "system-ui", background: "#0f1a2e", border: "1px solid #2a3f66", borderRadius: 8, padding: "14px 18px", margin: "12px 20px 0", color: "#e6ebf5" },
  head: { fontSize: 10, letterSpacing: 1, color: "#5aa6ff" },
  note: { fontSize: 10, color: "#5a76a3", marginTop: 10 },
  linkedRow: { fontSize: 11, color: "#8fa3c9", marginTop: 10, padding: "6px 10px", borderRadius: 6, background: "rgba(52,211,153,0.06)", border: "1px solid rgba(52,211,153,0.2)" },
};
