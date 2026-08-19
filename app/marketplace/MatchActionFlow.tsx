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
  needOptions, offerOptions, inputOptions,
}: {
  needOptions: { need_id: string; label: string }[];
  offerOptions: { offer_id: string; label: string }[];
  inputOptions: { id: string; label: string }[];
}) {
  const [permit, setPermit] = useState<MatchPermit | null>(null);

  return (
    <>
      <div dir="rtl" style={{ padding: "0 20px" }}>
        <EvaluateMatchForm needOptions={needOptions} offerOptions={offerOptions} onPermit={setPermit} />
      </div>
      <div id="action" dir="rtl" style={{ padding: "0 20px" }}>
        <CreateActionForm inputOptions={inputOptions} matchPermit={permit} />
      </div>
    </>
  );
}
