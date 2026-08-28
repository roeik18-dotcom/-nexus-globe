"use client";

/**
 * MatchActionFlow — Match→Action integrity gate, wired into production.
 *
 * Composes the two already-existing real forms (`EvaluateMatchForm`,
 * `CreateActionForm`) with one small piece of shared client state: the
 * `MatchPermit` a permitted evaluation returns. No new product surface,
 * no new concept — this is the connective glue closing the exact gap
 * this pass fixed (`matchPermit.ts`'s own header explains the full
 * rationale). The permit lives only in this component's memory; a
 * reload clears it, which is correct — a decision that was always
 * "derived, not persisted" should not survive a reload either.
 */
import { useState } from "react";
import EvaluateMatchForm from "@/app/hub/EvaluateMatchForm";
import CreateActionForm from "@/app/hub/CreateActionForm";
import type { MatchPermit } from "@/app/lib/philos/canon/matchPermit";

export default function MatchActionFlow({
  needOptions, offerOptions, inputOptions, actingSubject, dayRef,
}: {
  needOptions: { need_id: string; label: string }[];
  offerOptions: { offer_id: string; label: string }[];
  inputOptions: { id: string; label: string }[];
  /** Display only — passed through to the action form's label. */
  actingSubject?: string;
  /** The open day the Action will DECLARE. Server-resolved, never client-chosen. */
  dayRef?: string;
}) {
  const [permit, setPermit] = useState<MatchPermit | null>(null);

  return (
    /* CLOSED UNTIL ASKED FOR. These two are a WRITE path — evaluate a match,
       then record the action it permits — and they stood open above the
       terminal's own answer, so eighteen empty fields greeted a person who
       had come to read what the market currently holds. They stay one unit:
       the permit produced by the first is consumed by the second, so
       collapsing them separately would let someone open the action form
       without the evaluation that authorises it. */
    <div dir="rtl" style={{ padding: "0 20px" }}>
      <details>
        <summary style={{ cursor: "pointer", listStyle: "none", fontSize: 13, fontWeight: 700, color: "#7d90b4", paddingBlock: 6 }}>
          הערכת התאמה ורישום פעולה
        </summary>
        <div style={{ display: "grid", gap: 12, marginBlockStart: 10 }}>
          <EvaluateMatchForm needOptions={needOptions} offerOptions={offerOptions} onPermit={setPermit} />
          <div id="action">
            <CreateActionForm inputOptions={inputOptions} matchPermit={permit} actingSubject={actingSubject} dayRef={dayRef} />
          </div>
        </div>
      </details>
    </div>
  );
}
