/**
 * THE ONE LOADER for the cross-terminal selected entity.
 *
 * Community, Globe and World each already load some of what the projection
 * needs and none of them load all of it. This function is the single place
 * that assembles the whole, from the SAME accessors those routes already use —
 * it introduces no store, no cache and no derivation of its own.
 *
 * Callers pass whatever they have already loaded. A route that has read the
 * social system hands it over rather than paying for a second read; a route
 * that has not, gets it loaded here. Either way the RESULT is identical,
 * because it is the same accessors either way — which is what makes "the same
 * object on three terminals" a property of the code rather than a promise.
 */
import { loadGroupEvents } from "../community/groupEventStore";
import { loadNeedGroupLinks } from "../community/needGroupLinkStoreAccessor";
import { buildOperationalTrace, type OperationalTrace } from "./operationalTrace";
import { projectGroupOperationalState, type GroupOperationalState } from "../community/groupOperationalState";
import { buildOperationalGroupProfile, type OperationalGroupProfile } from "../valueSystem/operationalGroup";
import { loadSocialSystem, type SocialSystemState } from "../social/loadSocialSystem";
import { resolveViewerContext } from "../identity/viewerContext";
import {
  buildSelectedEntityWorldProjection,
  type SelectedEntityWorldProjection,
} from "./selectedEntityWorldProjection";

export async function loadSelectedEntityProjection(opts?: {
  /** Already-loaded social system, if the caller has one. */
  social?: SocialSystemState;
  /** Already-projected operational states keyed by group id, if the caller has them. */
  operational?: ReadonlyMap<string, GroupOperationalState>;
}): Promise<SelectedEntityWorldProjection | null> {
  return (await loadSelectedEntity(opts))?.projection ?? null;
}

/**
 * The projection, the trace, AND the two objects they were built from.
 *
 * `profile` and `state` are returned rather than kept private because the
 * terminals need to draw their OWN question from them (Community's roster,
 * capital flow and membership curve all live on `profile`), and the only
 * alternative was each route calling `buildOperationalGroupProfile()` a second
 * time. Handing back what was already loaded keeps the "one join, one read"
 * property this loader exists to guarantee — a second call could observe a
 * different store state and silently disagree with the spine above it.
 *
 * `state` is null whenever the operational log has no entry under the group id
 * — which is the case today, since `group-events.jsonl` is empty. That is a
 * genuine unmeasured channel, and callers must render it as one rather than
 * as a zero.
 */
export async function loadSelectedEntity(opts?: {
  social?: SocialSystemState;
  operational?: ReadonlyMap<string, GroupOperationalState>;
}): Promise<{
  projection: SelectedEntityWorldProjection;
  trace: OperationalTrace;
  profile: OperationalGroupProfile;
  state: GroupOperationalState | null;
} | null> {
  const profile = await buildOperationalGroupProfile();
  if (!profile) return null;
  const viewerSubject = (await resolveViewerContext()).subject_id;

  /* THE JOIN. `profile.group_id` is the canonical id and the only key used to
     reach into the operational log. If the log has no entry under that id the
     answer is a null state — which the projection renders as an empty CHANNEL,
     never as a measured zero, and never by falling back to a name match. */
  const state: GroupOperationalState | null =
    opts?.operational?.get(profile.group_id)
    ?? (() => {
      const ge = loadGroupEvents();
      const s = projectGroupOperationalState(profile.group_id, ge.events);
      return s.history.length > 0 ? s : null;
    })();

  const social = opts?.social ?? (await loadSocialSystem(await resolveViewerContext()));

  /* THE CANONICAL NEED↔GROUP JOIN. The audit found the NEED cell reporting a
     membership-owned need as though it were a group join. This is the store
     that actually declares `group_id`, and it is filtered on the same key. */
  const needLinks = await loadNeedGroupLinks().catch(() => []);
  const linkedNeedIds = needLinks
    .filter((l) => l.group_id === profile.group_id)
    .map((l) => l.need_id);

  /* EFFECT/EVIDENCE ARE NOT RE-READ FROM `group-effects.jsonl` /
     `group-evidence.jsonl`. Those files are EXPORTS of the same
     `impact.recorded` / `impact.verified` events `projectValueGroup` already
     folds, and reading them here would be a second reconstruction of one
     truth — the exact category of bug this projection exists to remove. The
     effect and its verification come from `profile.view.impact`, where the
     verification is attached to the impact it verifies by `impact_event_id`,
     so "supports" is structural rather than asserted. */
  /* THE TRACE IS BUILT HERE so the projection and the trace can never drift:
     the ACTION cell's third reading is literally the trace's ACTION hop. */
  const trace = await buildOperationalTrace(profile.group_id, viewerSubject);

  const projection = buildSelectedEntityWorldProjection({
    viaNeedActionIds: trace.hops.find((h) => h.key === "action")?.ids ?? [],
    realizedMatchIds: trace.hops.find((h) => h.key === "match")?.ids ?? [],
    profile,
    state,
    systemEvidence: social.systemEvidence,
    systemEligibleRecords: social.world.system_eligible_records.length,
    observedWorldEvents: social.world.system_observed_records.length,
    systemZeroReason: social.world.system_zero_reason,
    linkedNeedIds,
    groupEffects: profile.view.impact.map((i) => ({
      effect_id: i.impact_id,
      status: i.verified ? "VERIFIED" : "CLAIMED",
      /* The group itself resolved as REAL; its own impact records inherit that
         and nothing else does. A DEMO group never reaches this function. */
      provenance: "REAL" as const,
    })),
    groupEvidence: profile.view.impact
      .filter((i) => i.verified && i.verification)
      .map((i) => ({
        evidence_id: i.verification!.event_id,
        effect_id: i.impact_id,
        /* The level the VERIFIER's record carries, verbatim. Not re-labelled,
           and specifically not called `community_verified` unless it says so. */
        level: i.verification_level,
        provenance: "REAL" as const,
      })),
  });
  return projection ? { projection, trace, profile, state } : null;
}
