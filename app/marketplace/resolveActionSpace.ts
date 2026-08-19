/**
 * Action Space resolver — the smallest real bridge from a `SystemContextRef`
 * to the Marketplace/PUDM data (systemic-integration-audit → Marketplace
 * slice). Reuses the exact `SystemContextRef`/`SelectedContext` contract
 * already proven on Dynamics and Globe; adds no new ref kind, no new store,
 * no new id.
 *
 * **The honest finding this file encodes, verified this pass by reading the
 * real schemas, not assumed**: `Mission`/`Gap`/`Value`/`Capability`/
 * `Provider` (`app/lib/{mission,gap,value,capability,provider}/schema.ts`)
 * have NO subject/person-scoping field at all — not "the ids don't match",
 * the schema has no field for this kind of link to exist on. Canon's
 * `Observation.subject` / legacy's `PhilosEvent.actor_id` are both
 * person-shaped strings (`"person_..."`); real `providers.json` ids are
 * organization-shaped (`"prov_yc_001"`). There is categorically no bridge
 * today. `findKnownResource` still performs a REAL exact-string check
 * against every real provider id (never skipped, never faked as "checked")
 * so this stays true even if that ever changes — it does not currently, and
 * this file states that plainly rather than assuming it.
 *
 * **Need (updated — real persistence slice)**: canon's `Need` type
 * (`need.ts`) has a real `subject: string` field, and now has a real store
 * (`needStore.ts`/`needStoreAccessor.ts`) — `findKnownNeeds` performs a REAL
 * read (`findNeedsForSubject`, never skipped) against it. Today it honestly
 * returns none, because no Need has been explicitly submitted for any real
 * subject yet — a real, checked absence, not a structural impossibility
 * anymore. Nothing here ever calls the write path (`ingestNeed`); this file
 * remains read-only.
 *
 * **Admissibility**: the real gate function is `matching.ts::evaluateMatch
 * (attempt, need, offer)` — it requires a real `Need` AND a real `Offer` as
 * input. A real Need CAN now exist (see above); a real Offer still cannot
 * (no persistence built for Offer yet). So the gate is still never called
 * here with fabricated inputs — it's one step closer to evaluable, not
 * evaluable yet. The melting-pot canon's admissibility PREDICATE
 * (`PHILOS-MELTING-POT-CANON.md` §21) is quoted verbatim as context — it is
 * specified, not implemented as running code anywhere in this repo
 * (confirmed this pass, matching the prior Marketplace audit).
 *
 * **Value dimensions**: Personal Benefit / Community Reinforcement /
 * Systemic Impact / Risk have no field or function anywhere in this codebase
 * — stated as `not_computed`, never given an invented number. Cost exists
 * only as `Offer.cost`/`Transfer.cost`, a free-text string, presence-
 * validated only — `partially_supported`, and unpopulated here since no
 * Offer exists. Evidence Strength is the one dimension genuinely already
 * covered — by `persisted_or_derived`/`claimed_or_verified`, already shown
 * elsewhere in `SelectedContext` — pointed to here, not duplicated.
 */
import {
  resolveSharedContext,
  findKnownNeeds,
  ADMISSIBILITY_GATE_FUNCTION,
  ADMISSIBILITY_PREDICATE,
} from "@/app/lib/philos/sharedContext";
import type { Provider } from "@/app/lib/provider/schema";
import { type SystemContextRef } from "@/app/lib/systemContext";
export type { KnownNeedResult, ActionSpaceSummary } from "@/app/lib/systemContext";
export { findKnownNeeds, ADMISSIBILITY_GATE_FUNCTION, ADMISSIBILITY_PREDICATE };

/**
 * Marketplace's context resolution IS the shared projection now
 * (semantic-unity slice): this used to be its own resolver, poorer than
 * Dynamics' (no `relationships`, no `knownNeeds`/`actionSpace`). It is now a
 * thin alias to `sharedContext.ts::resolveSharedContext` — the SAME function
 * Dynamics and Globe call — kept as a named export so existing imports
 * (`from "./resolveActionSpace"`) and the page/panel below stay unchanged.
 */
export const resolveSelectedContext = (ref: SystemContextRef | null) => resolveSharedContext(ref);

export type KnownResourceResult =
  | { found: true; checked_entities: number; provider: Provider }
  | { found: false; checked_entities: number; reason: string };

/** A REAL exact-string check against every real provider id — never skipped,
 *  never replaced with an assumed "not found". Returns `found: false` today
 *  because it genuinely finds nothing, not because the check was omitted. */
export function findKnownResource(subject: string | undefined, providers: readonly Provider[]): KnownResourceResult {
  if (subject !== undefined) {
    const match = providers.find((p) => p.id === subject);
    if (match) {
      // Would be a real match if the id spaces ever converge — not
      // fabricated, just structured to be honest either way.
      return { found: true, checked_entities: providers.length, provider: match };
    }
  }
  return {
    found: false,
    checked_entities: providers.length,
    reason:
      subject === undefined
        ? "no subject/actor identity available for this context"
        : `no real provider/value/capability record names subject "${subject}" — PUDM entities have no subject-scoping field at all`,
  };
}

export interface ValueDimensionStatus {
  label: string;
  status: "not_computed" | "partially_supported";
  note: string;
}

export const VALUE_DIMENSIONS: ValueDimensionStatus[] = [
  { label: "Personal Benefit", status: "not_computed", note: "no field or function computes this anywhere in canon or the legacy log" },
  { label: "Community Reinforcement", status: "not_computed", note: "no field or function computes this anywhere in canon or the legacy log" },
  { label: "Systemic Impact", status: "not_computed", note: "legacy recordImpact.ts measures Value-Group-level claims only, unconnected to this subject" },
  { label: "Cost", status: "partially_supported", note: "Offer.cost/Transfer.cost exist as free-text strings — but no Offer exists for this context" },
  { label: "Risk", status: "not_computed", note: "named only in the unimplemented melting-pot admissibility predicate (§21), no field anywhere" },
  { label: "Evidence Strength", status: "partially_supported", note: "already shown above via persisted/derived and claimed/verified — not duplicated here" },
];
