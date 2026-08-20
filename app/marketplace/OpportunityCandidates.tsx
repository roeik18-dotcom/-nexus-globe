/**
 * OpportunityCandidates — BATCH 11 (Opportunity Engine), the smallest
 * honest slice. The mission's own spec: NEED + CAPABILITY + RESOURCE +
 * VALUE ALIGNMENT + CONTEXTUAL EVIDENCE + CONSTRAINTS → OPPORTUNITY
 * CANDIDATE. Of those six inputs, only NEED and RESOURCE (canon
 * Need/Offer) are real and computable today — CAPABILITY and VALUE
 * ALIGNMENT have no real link anywhere in this codebase (same
 * "no value_context field" gap already documented on the Value detail
 * page); CONTEXTUAL EVIDENCE/CONSTRAINTS exist on `Offer.constraints`
 * but are currently always empty (no ingestion path populates them).
 *
 * Rather than fabricate the missing inputs or invent a ranking/score, an
 * "Opportunity Candidate" here is exactly what's real: every (Need,
 * Offer) PAIR that already exists for the real subject — the same real
 * cartesian surface `EvaluateMatchForm` already requires you to already
 * know about via its two dropdowns. This makes that surface discoverable
 * instead of requiring the user to already know which pair to pick. No
 * new persistence, no new store — a pure render over data the page
 * already loaded.
 *
 * OPPORTUNITY → HUMAN DECISION → COMMITMENT → ACTION: the "human
 * decision" step is exactly `EvaluateMatchForm`'s own 6 real gates
 * (CAN/WANTS/ALLOWED/APPROPRIATE/AVAILABLE/CONSENT) — never
 * auto-evaluated here, since that decision belongs to the human, not
 * this list. Selecting a candidate below just points at that real form.
 */
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import type { OfferRecord } from "@/app/lib/philos/canon/offerStore";

export default function OpportunityCandidates({ needs, offers }: { needs: NeedRecord[]; offers: OfferRecord[] }) {
  if (needs.length === 0 || offers.length === 0) {
    return (
      <div dir="rtl" style={{ fontSize: 13, color: "#8fa3c9", background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        הזדמנויות (canon) · OPPORTUNITY CANDIDATES — דורש לפחות Need אמיתי אחד ו-Offer אמיתי אחד. אין עדיין. CAPABILITY/VALUE ALIGNMENT אינם קיימים כנתון אמיתי במערכת כרגע.
      </div>
    );
  }

  const candidates = needs.flatMap((n) => offers.map((o) => ({ n, o })));

  return (
    <div dir="rtl" style={{ background: "rgba(90,120,180,0.06)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
      <div style={{ fontSize: 13, letterSpacing: 0.5, color: "#8fa3c9", marginBottom: 8 }}>
        מועמדי הזדמנות · OPPORTUNITY CANDIDATES ({candidates.length}) — Need×Offer אמיתיים בלבד; CAPABILITY/VALUE ALIGNMENT: לא זמין כנתון אמיתי
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {candidates.map(({ n, o }) => (
          <a
            key={`${n.need.need_id}::${o.offer.offer_id}`}
            href="#match-eval"
            style={{ display: "flex", justifyContent: "space-between", gap: 8, padding: "6px 10px", borderRadius: 6, background: "rgba(90,120,180,0.05)", textDecoration: "none", color: "inherit", fontSize: 13 }}
          >
            <span>{n.need.desired_change} ↔ {o.offer.available_resource}</span>
            <span style={{ color: "#6c86b5", fontSize: 12 }}>הערך → HUMAN DECISION (6 שערים)</span>
          </a>
        ))}
      </div>
    </div>
  );
}
