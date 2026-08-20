/**
 * Philos Canon — the Merlin-facing shared-state endpoint (Phase 7).
 *
 * `GET /api/canon/shared-state?subject=<id>&asOf=<ISO-8601>` — the ONE real,
 * read-only HTTP boundary an external process (Merlin/voice-gateway) uses to
 * read the EXACT SAME Person/Value runtime state the 7 web terminals
 * (Hub/Dynamics/Brain/Community/Marketplace/Globe/World) already render.
 * Every field below is produced by calling an already-real, already-tested
 * function verbatim — `buildPersonInstance`/`buildValueDomainInstance`
 * (`personInstance.ts`), `buildActionLifecycleSummary`
 * (`canon/actionLifecycle.ts`), `buildBrainDerivation`
 * (`canonical/brainDerivation.ts`), the three MasterLoaders — never a second
 * derivation written for this route. This is what "Merlin reads canonical
 * refs through the existing loaders" (Phase 7 brief) means in practice: the
 * loaders run HERE, in-process, exactly as they do for `/hub`; Merlin is a
 * plain HTTP client of the result, same shape as `philos_orientation.py`'s
 * existing contract with `/api/canon/observations/{id}/orientation`.
 *
 * Same auth shape as every sibling route in this directory
 * (`actions/route.ts`): `Authorization: Bearer <CANON_READ_TOKEN>`,
 * fail-closed when the env var is unset.
 *
 * **Read-only, by construction.** No `POST`/`PUT`/`DELETE` is exported —
 * Merlin (or anything else) cannot write Human/Music/Color master data, or
 * any canon store, through this route. There is no code path here that
 * calls `.append()`/`recordAction`/`recordEffect` on anything.
 *
 * **HTTP contract**
 *   401  missing/invalid bearer token, or `CANON_READ_TOKEN` unset
 *   200  body is `SharedStateResponse` (below)
 *   500  unexpected store/loader failure
 */
import { timingSafeEqual } from "node:crypto";
import { buildViewerLinkRegistry } from "@/app/lib/philos/bridge/viewerLinkRegistry";

import { findDomainStatesForSubject } from "@/app/lib/philos/canon/domainStateStoreAccessor";
import { buildActionLifecycleSummary } from "@/app/lib/philos/canon/actionLifecycle";
import { findNeedsForSubject } from "@/app/lib/philos/canon/needStoreAccessor";
import { findOffersForSource } from "@/app/lib/philos/canon/offerStoreAccessor";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { systemClock, todayIn } from "@/app/lib/philos/eventStore";
import { buildDefaultLinkRegistry } from "@/app/lib/philos/bridge/linkRegistry";
import { linksForEntity } from "@/app/lib/philos/bridge/entityLink";
import { mayReadSubject, tryResolveViewerContext } from "@/app/lib/philos/identity/viewerContext";
import { buildPersonInstance, buildValueDomainInstance } from "@/app/lib/philos/canonical/personInstance";
import { buildActivePersonRefs } from "@/app/lib/philos/canonical/activeConfig";
import { availableDomainConfigs } from "@/app/lib/philos/canonical/domainConfigRegistry";
import { buildBrainDerivation } from "@/app/lib/philos/canonical/brainDerivation";
import { projectCanonDynamics } from "@/app/lib/philos/canon/projectCanonDynamics";
import { HUMAN_CANON_DOMAIN_ID } from "@/app/hub/CanonicalSlicePanel";
import { musicMasterMeta, readyMusicRecords, summarizeMusicMaster } from "@/app/lib/philos/canonical/musicMasterLoader";
import { humanMasterMeta, summarizeHumanMaster } from "@/app/lib/philos/canonical/humanMasterLoader";
import { colorMasterMeta, loadColorMaster, whiteColorConflict } from "@/app/lib/philos/canonical/colorMasterLoader";

function authorized(request: Request): boolean {
  const expected = process.env.CANON_READ_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const prefix = "Bearer ";
  if (!header.startsWith(prefix)) return false;
  const presented = Buffer.from(header.slice(prefix.length));
  const secret = Buffer.from(expected);
  if (presented.length !== secret.length) return false;
  return timingSafeEqual(presented, secret);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) return json({ error: "unauthorized" }, 401);

  const url = new URL(request.url);
  /* IMPERSONATION HOLE, CLOSED.
     `?subject=` was read straight off the query string and fell back to the
     single-user constant. A caller holding the shared bearer token could
     therefore read ANY subject's canon state — domain states, action
     lifecycle, person instance — by naming them in a URL. The bearer proves
     the caller is a trusted service; it says nothing about WHICH human's
     records that service may read.

     The acting subject now comes from the viewer, server-side, and a
     `?subject=` that names anyone else is REFUSED rather than silently
     narrowed to the viewer — a request that asked for someone else's data
     should not receive a 200 full of a different person's records. */
  /* 401 vs 500. `resolveViewerContext()` THROWS when nobody resolves, which
     is right for a render that must not proceed but wrong for a route that
     owes the caller a status. `tryResolveViewerContext()` asks the same
     question without a fallback identity — null is the only other answer. */
  const viewer = await tryResolveViewerContext();
  if (!viewer) return json({ error: "unauthenticated", detail: "no valid session" }, 401);
  const requested = url.searchParams.get("subject");
  if (requested !== null && !mayReadSubject(viewer, requested)) {
    return json({ error: "forbidden", detail: "subject is not readable by this viewer" }, 403);
  }
  const subject = viewer.subject_id;
  const asOf = url.searchParams.get("asOf") ?? systemClock.now();

  try {
    const domainStates = await findDomainStatesForSubject(subject);
    const human = buildPersonInstance({ subject_id: subject, domain_id: HUMAN_CANON_DOMAIN_ID, records: domainStates, source_kind: "CANON", source_refs: buildActivePersonRefs().refObjects, asOf });
    // One instance per REGISTERED domain slot — this route names no domain.
    const domainInstances = availableDomainConfigs().map((slot) =>
      buildValueDomainInstance({
        subject_id: subject, domain_id: slot.domain_id, records: domainStates,
        source_kind: "CANON", source_refs: slot.activeConfig().refObjects, asOf,
      }),
    );
    const music = domainInstances[0];

    const lifecycle = await buildActionLifecycleSummary(subject);

    // Community/Marketplace opportunities — the SAME real Need/Offer store
    // reads Community/Marketplace already use, never a new query.
    const [needs, offers] = await Promise.all([findNeedsForSubject(subject), findOffersForSource(subject)]);
    const openNeeds = needs.filter((n) => n.need.subject === subject);
    const openOffers = offers.filter((o) => o.offer.source === subject);

    // Real canon Observations for this subject (runtime reconciliation,
    // 2026-08-17) — the SAME projection every terminal reads. Exposed so
    // consumers can do temporal orientation, and so the next-action rule
    // below can never claim "no first observation" when one exists.
    const canonGraph = await projectCanonDynamics();
    const subjectObservations = canonGraph.nodes
      .filter((n) => n.subject === subject)
      .sort((a, b) => b.observed_at.localeCompare(a.observed_at));
    const brain = buildBrainDerivation({
      subject_id: subject, lifecycle, instances: [human, music],
      pendingNeeds: openNeeds.map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change })),
      hasRealObservation: subjectObservations.length > 0,
    });

    // World relevance — the SAME Canonical Cross-Entity Link Registry
    // Brain/Globe already build, over the SAME real event log.
    const events = await loadPhilosEvents();
    const registry = await buildViewerLinkRegistry({ events });
    const worldLinks = linksForEntity(registry, "person", subject);

    const colors = loadColorMaster();
    const whiteConflict = whiteColorConflict();

    const body = {
      subject_id: subject,
      asOf,
      human,
      music,
      human_master: { ...humanMasterMeta(), summary: summarizeHumanMaster(), source_kind: "CANON" },
      music_master: {
        ...musicMasterMeta(), summary: summarizeMusicMaster(), source_kind: "CANON",
        ready_sample: readyMusicRecords().slice(0, 10).map((r) => ({
          source_number: r.SOURCE_NUMBER, heading: r.SOURCE_HEADING || r.SOURCE_SECTION, type: r.TYPE, runtime_status: r.RUNTIME_STATUS,
        })),
      },
      color_master: {
        ...colorMasterMeta(), source_kind: "CANON",
        colors: colors.map((c) => ({
          color_id: String(c.COLOR_ID), color: c.COLOR, canonical_function: c.CANONICAL_FUNCTION,
          mapping_basis: c.MAPPING_BASIS, conflict_status: c.CONFLICT_STATUS,
        })),
        white_conflict: whiteConflict,
      },
      open_loops: {
        no_effect_recorded: lifecycle.counts.no_effect_recorded,
        effect_claimed_only: lifecycle.counts.effect_claimed_only,
        effect_verified: lifecycle.counts.effect_verified,
      },
      actions: lifecycle.actions.map((a) => ({
        action_id: a.action.action.action_id, type: a.action.action.type, recorded_at: a.action.recorded_at,
        verification_state: a.verification_state,
      })),
      effects: lifecycle.actions.flatMap((a) => a.effects.map((e) => ({
        effect_id: e.effect.effect.effect_id, action_ref: e.effect.effect.action_ref, verified: e.verified,
        claimed_statement: e.effect.effect.claimed_outcome.statement,
        verified_statement: e.effect.effect.verified_outcome?.statement ?? null,
      }))),
      learning: lifecycle.actions.flatMap((a) => a.effects.flatMap((e) => e.learnings.map((l) => ({
        learning_id: l.learning.learning_id, effect_ref: l.learning.effect_ref, kind: l.learning.result.kind,
      })))),
      brain,
      observations: subjectObservations.slice(0, 20).map((o) => ({
        canon_event_id: o.canon_event_id, domain: o.domain, frame: o.frame,
        level: o.level, observed_at: o.observed_at, provenance: o.provenance,
        confidence: o.confidence ?? null,
        context_snippet: (o.context ?? "").slice(0, 200),
      })),
      community_marketplace: {
        open_needs: openNeeds.map((n) => ({ need_id: n.need.need_id, desired_change: n.need.desired_change })),
        open_offers: openOffers.map((o) => ({ offer_id: o.offer.offer_id, available_resource: o.offer.available_resource })),
        source_kind: "CANON",
      },
      world_relevance: { bridge_link_count: worldLinks.length, source_kind: "CANON" },
    };

    return json(body, 200);
  } catch {
    return json({ error: "read_failed" }, 500);
  }
}
