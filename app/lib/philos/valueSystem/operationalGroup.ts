/**
 * PHILOS Value System — Operational Group Profile (operational-groups pass).
 *
 * ONE shared assembler for "everything real the system knows about a Value
 * Group", consumed by Community's group detail, Hub's relevant-now card,
 * Brain's group reasoning, Dynamics' group trajectory, Marketplace's group
 * stage, Globe's topology strip and World's relevance block — so no
 * terminal re-derives group facts its own way.
 *
 * Every field is either a fold over records this codebase already persists
 * (the value-group event projection, canon Need/Offer/Action/Effect/
 * Learning stores, the bridge link registry, the tension derivation, the
 * capital/membership timelines, the group resolver) or an EXPLICIT
 * UNKNOWN with the reason:
 *
 *   supporters     no supporter record type exists anywhere — UNKNOWN
 *   capabilities   no canon Capability store exists (PUDM capability data
 *                  is LEGACY reference, never group-linked) — UNKNOWN;
 *                  the nearest REAL thing is member Offers, listed as
 *                  RESOURCES below, never re-labeled capabilities
 *   general_values no record ties a General Value candidate to a group —
 *                  UNKNOWN unless a real observation-graph join exists
 *   quality        the source explicitly deferred a quality formula —
 *                  PARTIAL, always separate from the group itself
 *
 * Needs/Offers are canon SUBJECT-owned records with no group foreign key;
 * they enter a group profile ONLY through real membership: records owned
 * by the identity-linked person when that person is a real member — and
 * they are labeled as exactly that, never as "the group's needs".
 *
 * The TRACE (acceptance): Person → Group → Need → Resource/Offer → Action
 * → Effect → Evidence, every hop a real stored reference — membership
 * event, Need/Offer ownership, `action.inputs` naming both ids,
 * `effect.action_ref`, `verified_outcome`. If any hop has no real
 * reference the trace stops there and says so.
 */
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { buildCapitalTimeline, buildMembershipTimeline, projectValueGroup, type ValueGroupView } from "@/app/lib/philos/projectValueGroup";
import { GROUP_ID } from "@/app/lib/philos/valueGroupLog";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksByRelation } from "@/app/lib/philos/bridge/entityLink";
import { buildCommunityTensions, sortTensions, type TensionItem } from "@/app/lib/philos/tension";
import { resolveShellIdentityLink } from "@/app/lib/philos/community/resolveShellIdentityLink";
import { findNeedsForSubject } from "@/app/lib/philos/canon/needStoreAccessor";
import { findOffersForSource } from "@/app/lib/philos/canon/offerStoreAccessor";
import { buildActionLifecycleSummary, type ActionLifecycleEntry } from "@/app/lib/philos/canon/actionLifecycle";
import { resolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { QUALITY_GROUP_MODEL } from "@/app/lib/philos/community/sourceValueModel";
import { BASE_VALUES, CANDIDATE_VALUE_FAMILIES } from "./baseValueRegistry";
import { resolveValueGroups, type ValueGroupResolverResult } from "./groupResolver";
import type { NeedRecord } from "@/app/lib/philos/canon/needStore";
import type { OfferRecord } from "@/app/lib/philos/canon/offerStore";

export interface TraceHop {
  step: string;
  /** The real record/reference backing this hop — null = chain stops. */
  ref: string | null;
  detail: string;
  linked_via: string;
}

export interface OperationalGroupProfile {
  group_id: string;
  name: string;
  provenance: "REAL";
  view: ValueGroupView;
  /** Derived via the base-value registry (STATIC rule, stated). */
  leading_family: { family_ref: string; label: string; via_base_value: string } | null;
  /** UNKNOWN unless a real observation-graph join exists. */
  general_values: string[];
  members: { person_id: string; display_name: string }[];
  /** No supporter record type exists — always UNKNOWN today. */
  supporters: "UNKNOWN";
  resolution: ValueGroupResolverResult;
  /** Member-owned canon records, labeled as such. */
  member_needs: NeedRecord[];
  member_offers: OfferRecord[];
  capabilities: "UNKNOWN";
  /** Real group-linked Actions (bridge) with their lifecycle entries. */
  linked_actions: ActionLifecycleEntry[];
  /** Real Effect claims (group impact) + canon effects on linked actions. */
  effect_claims: number;
  verified_effects: number;
  evidence_statements: string[];
  learnings: { learning_id: string; kind: string }[];
  capital_flow: { date: string; delta: number; balance: number; currency: string }[];
  membership_over_time: { date: string; count: number }[];
  trend: string;
  quality: { status: string; note: string };
  tensions: TensionItem[];
  trace: TraceHop[];
}

/** central_value → base value → its first candidate family (registry §17.3). */
export function deriveLeadingFamily(centralValue: string): OperationalGroupProfile["leading_family"] {
  const bv = BASE_VALUES.find((b) => centralValue.includes(b.label) || b.label.includes(centralValue));
  if (!bv) return null;
  const fam = CANDIDATE_VALUE_FAMILIES.find((f) => f.id === bv.candidate_family_refs[0]);
  return fam ? { family_ref: fam.id, label: fam.label, via_base_value: `${bv.id} ${bv.label}` } : null;
}

/**
 * The one profile assembler for the REAL group. Returns null when the
 * projection genuinely has no group. All reads are the same accessors the
 * individual routes already use.
 */
export async function buildOperationalGroupProfile(): Promise<OperationalGroupProfile | null> {
  /* The member-owned reads below were scoped to `REAL_CURRENT_SUBJECT`, so
     any viewer who happened to be a member of this group saw ROEI's Needs,
     Offers and Action lifecycle presented as their own. The membership gate
     was correct; the subject it then read for was a constant. */
  const viewer = await resolveViewerContext();
  const events = await loadPhilosEvents();
  const today = todayIn(systemClock);
  const view = projectValueGroup(events, GROUP_ID, today);
  if (!view) return null;

  const identityLink = await resolveShellIdentityLink();
  const linked = identityLink.status === "VERIFIED_SAME_PERSON";
  const memberId = linked ? identityLink.community_member_id : undefined;
  const bridge = buildDefaultLinkRegistry(events, today);
  const bridgeActionIds = linksByRelation(bridge, "ACTION_AFFECTS_COMMUNITY")
    .filter((l) => l.target.canonical_id === view.group_id).map((l) => l.source.canonical_id);

  // Member-owned canon records — real membership is the ONLY door in.
  const isMember = !!memberId && view.members.some((m) => m.person_id === memberId);
  const [ownNeeds, ownOffers, lifecycle] = await Promise.all([
    isMember ? findNeedsForSubject(viewer.subject_id).catch(() => []) : Promise.resolve([]),
    isMember ? findOffersForSource(viewer.subject_id).catch(() => []) : Promise.resolve([]),
    buildActionLifecycleSummary(viewer.subject_id).catch(() => ({ subject: viewer.subject_id, actions: [], counts: { actions_total: 0, no_effect_recorded: 0, effect_claimed_only: 0, effect_verified: 0, learnings_with_state_prime: 0 } })),
  ]);

  const linked_actions = lifecycle.actions.filter((a) => bridgeActionIds.includes(a.action.action.action_id));
  const evidence_statements = [
    ...view.impact.filter((i) => i.verified).map((i) => i.statement),
    ...linked_actions.flatMap((a) => a.effects.filter((e) => e.verified).map((e) => e.effect.effect.verified_outcome?.statement ?? "")),
  ].filter(Boolean);
  const learnings = linked_actions.flatMap((a) => a.effects.flatMap((e) => e.learnings.map((l) => ({ learning_id: l.learning.learning_id, kind: l.learning.result.kind }))));

  const resolution = resolveValueGroups({
    familyMatches: [], generalValueMatches: [], baseValueMatches: [],
    groups: [{
      group_id: view.group_id, name: view.name, central_value: view.central_value, provenance: "REAL",
      member_ids: view.members.map((m) => m.person_id),
      transfers: view.transfers.filter((t) => t.state === "completed").map((t) => ({ transfer_id: t.transfer_id, recipient: t.recipient })),
      effects: view.impact.map((i) => ({ id: i.impact_id, verified: i.verified })),
      tension_ids: sortTensions(buildCommunityTensions(view, "REAL")).map((t) => t.id),
      bridge_action_ids: bridgeActionIds,
      bridge_effect_ids: memberId
        ? linksByRelation(bridge, "EFFECT_AFFECTS_PERSON").filter((l) => l.target.canonical_id === memberId).map((l) => l.source.canonical_id)
        : [],
    }],
    viewer: linked ? { linked: true, community_member_id: memberId } : { linked: false },
  });

  const capitalTl = buildCapitalTimeline(events);
  const membershipTl = buildMembershipTimeline(events);
  const lastCap = capitalTl[capitalTl.length - 1];
  const trend = lastCap
    ? `הון ${lastCap.balance} ${lastCap.currency} (Δ אחרון ${lastCap.delta >= 0 ? "+" : ""}${lastCap.delta}) · ${membershipTl.length > 0 ? `${membershipTl[membershipTl.length - 1].count} חברים` : "אין אירועי הצטרפות"}`
    : "אין אירוע כספי — אין מגמת הון";

  // TRACE — every hop a real stored reference; stop honestly where none.
  const trace: TraceHop[] = [];
  trace.push(isMember
    ? { step: "PERSON → GROUP", ref: memberId!, detail: `${viewer.subject_id} ↔ ${memberId} חבר אמיתי ב-${view.name}`, linked_via: "member.joined event + VERIFIED_SAME_PERSON" }
    : { step: "PERSON → GROUP", ref: null, detail: "אין חברות אמיתית — השרשרת נעצרת", linked_via: "—" });
  const needIds = new Set(ownNeeds.map((n) => n.need.need_id));
  const offerIds = new Set(ownOffers.map((o) => o.offer.offer_id));
  const firstNeed = ownNeeds[0] ?? null;
  trace.push(firstNeed
    ? { step: "GROUP → NEED", ref: firstNeed.need.need_id, detail: firstNeed.need.desired_change, linked_via: `Need.subject = ${firstNeed.need.subject} (חבר מקושר) — אין שדה group ב-Need; שיוך דרך חברות בלבד` }
    : { step: "GROUP → NEED", ref: null, detail: "אין Need של חבר מקושר", linked_via: "—" });
  const firstOffer = ownOffers[0] ?? null;
  trace.push(firstOffer
    ? { step: "NEED → RESOURCE/OFFER", ref: firstOffer.offer.offer_id, detail: `${firstOffer.offer.available_resource} (${firstOffer.offer.resource_type})`, linked_via: `Offer.source = ${firstOffer.offer.source}` }
    : { step: "NEED → RESOURCE/OFFER", ref: null, detail: "אין Offer של חבר מקושר", linked_via: "—" });
  const matchedAction = lifecycle.actions.find((a) =>
    a.action.action.inputs.some((id) => needIds.has(id)) && a.action.action.inputs.some((id) => offerIds.has(id)));
  trace.push(matchedAction
    ? { step: "MATCH → ACTION", ref: matchedAction.action.action.action_id, detail: `${matchedAction.action.action.type} · inputs מפנים ל-Need+Offer אמיתיים`, linked_via: "action.inputs" }
    : { step: "MATCH → ACTION", ref: null, detail: "אין Action שה-inputs שלו מפנים ל-Need+Offer", linked_via: "—" });
  const tracedEffect = matchedAction?.effects[0] ?? null;
  trace.push(tracedEffect
    ? { step: "ACTION → EFFECT", ref: tracedEffect.effect.effect.effect_id, detail: tracedEffect.effect.effect.claimed_outcome.statement, linked_via: `effect.action_ref = ${tracedEffect.effect.effect.action_ref.slice(0, 14)}…` }
    : { step: "ACTION → EFFECT", ref: null, detail: "אין Effect עם action_ref לפעולה", linked_via: "—" });
  trace.push(tracedEffect?.verified && tracedEffect.effect.effect.verified_outcome
    ? { step: "EFFECT → EVIDENCE", ref: tracedEffect.effect.effect.effect_id, detail: `${tracedEffect.effect.effect.verified_outcome.statement} (${tracedEffect.effect.effect.verified_outcome.verifier_type} · ${tracedEffect.effect.effect.verified_outcome.method})`, linked_via: "effect.verified_outcome" }
    : { step: "EFFECT → EVIDENCE", ref: null, detail: "אין verified_outcome — claims בלבד", linked_via: "—" });

  return {
    group_id: view.group_id,
    name: view.name,
    provenance: "REAL",
    view,
    leading_family: deriveLeadingFamily(view.central_value),
    general_values: [],
    members: view.members.map((m) => ({ person_id: m.person_id, display_name: m.display_name })),
    supporters: "UNKNOWN",
    resolution,
    member_needs: ownNeeds,
    member_offers: ownOffers,
    capabilities: "UNKNOWN",
    linked_actions,
    effect_claims: view.impact.length + linked_actions.reduce((s, a) => s + a.effects.length, 0),
    verified_effects: view.impact.filter((i) => i.verified).length + linked_actions.reduce((s, a) => s + a.effects.filter((e) => e.verified).length, 0),
    evidence_statements,
    learnings,
    capital_flow: capitalTl.map((c) => ({ date: c.date, delta: c.delta, balance: c.balance, currency: c.currency })),
    membership_over_time: membershipTl.map((m) => ({ date: m.date, count: m.count })),
    trend,
    quality: { status: QUALITY_GROUP_MODEL.status, note: "VALUE GROUP ≠ QUALITY GROUP — אין נוסחת איכות; STANDARD→CRITERIA→EVIDENCE→VERIFIED EFFECTS בלבד" },
    tensions: sortTensions(buildCommunityTensions(view, "REAL")),
    trace,
  };
}
