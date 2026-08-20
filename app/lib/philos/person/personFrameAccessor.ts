/**
 * PERSON FRAME ACCESSOR — the ONE server-side resolution of
 * `PersonInContext`, so seven surfaces cannot drift into seven answers.
 *
 * `buildPersonInContext` is pure and takes its inputs as parameters. That
 * is deliberate — it keeps the frame testable and I/O-free — but it means
 * every caller would otherwise have to resolve those inputs itself, which
 * is exactly how the same question ends up answered differently on
 * different screens. This module does the resolution once.
 *
 * **The one thing this module must never get wrong:** `activeDomainId`
 * comes from a REAL recorded `DomainState` (`resolveValueDomainParam`) and
 * from nowhere else. Not from the domain registry's contents, not from
 * which config happens to be activated, not from which surface is asking.
 * A registered domain config is availability; only a recorded reading is
 * selection. Every other guard in the frame is downstream of this one.
 *
 * Read-only: loads DomainState records and (optionally) already-resolved
 * verified group memberships. Writes nothing, derives no measurement.
 */
import { findDomainStatesForSubject } from "../canon/domainStateStoreAccessor";
import { resolveValueDomainParam } from "../canon/domainStateQuery";
import type { ValueGroupView } from "../projectValueGroup";
import { buildPersonInContext, type PersonInContext } from "./personInContext";
import { resolvePersonContext } from "./personContext";
import { resolveViewerContext } from "../identity/viewerContext";
import { resolvePersonRef } from "./personRef";

export async function resolvePersonFrame(params: {
  subject: string;
  asOf: string;
  /** Real Observation fields when the caller already has them; the frame
   *  is a measurement FRAME, so these describe what a reading would be
   *  relative to — never the reading itself. */
  reference?: string | null;
  context?: string | null;
  /** Already-verified value-group memberships. The caller resolves these
   *  because membership verification is its own subsystem; this module
   *  never infers one. */
  verifiedGroups?: readonly { view: ValueGroupView }[];
}): Promise<PersonInContext> {
  const { subject, asOf, reference = null, context = null, verifiedGroups = [] } = params;

  /* `subject` here is already a server-resolved id (every caller passes the
     viewer's own `personRef.person_id`), not a query value — so this asks the
     viewer gate about a subject the viewer has already been granted. Routing
     it through `resolvePersonRef` keeps ONE gate rather than a second path
     that happens to be safe today. */
  const person = resolvePersonRef(await resolveViewerContext(), subject);
  const personContext = resolvePersonContext({ person, reference, context, asOf });

  // REAL DomainState records only — this is the single source of domain
  // SELECTION in the whole system.
  const domainStates = await findDomainStatesForSubject(subject).catch(() => []);
  const selected = resolveValueDomainParam(subject, domainStates);

  return buildPersonInContext({
    person,
    context: personContext,
    activeDomainId: selected?.config.domain.domain_id ?? null,
    verifiedGroupRelations: verifiedGroups.map((g) => ({
      group_id: g.view.group_id,
      name: g.view.name,
      central_value: g.view.central_value,
    })),
  });
}
