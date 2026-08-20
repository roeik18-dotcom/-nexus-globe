/**
 * THE ONE RESOLVER. Every terminal calls this and renders what it returns.
 *
 * It reads viewer-scoped evidence exactly once and answers five semantic
 * questions. No terminal may answer any of them itself — that is how the
 * product came to hold three different opinions about one session.
 *
 * The signature is the enforcement: it takes a `ViewerContext` and nothing
 * else. There is no surface parameter, no route, no `selected`, no
 * `?community=`. A caller cannot leak navigation state in even by accident,
 * because there is no argument to leak it through.
 */
import { loadValueDeclarations } from "../community/valueDeclarationStoreAccessor";
import { findDomainStatesForSubject } from "../canon/domainStateStoreAccessor";
import { resolveValueDomainParam } from "../canon/domainStateQuery";
import { projectCanonDynamics } from "../canon/projectCanonDynamics";
import { buildMeasuredStateSpace } from "../orientationCore";
import { loadPhilosEvents } from "@/app/lib/philos-event-store";
import { recordedMembershipsOf } from "../community/groupContext";
import { systemClock } from "../eventStore";
import type { ViewerContext } from "../identity/viewerContext";
import {
  emptyViewerContext, UNKNOWN_FIELD,
  type GroupValueRef, type ResolvedViewerContext,
} from "./resolvedViewerContext";

export async function resolveViewerContextSemantics(
  viewer: ViewerContext,
  opts?: { asOf?: string },
): Promise<ResolvedViewerContext> {
  const asOf = opts?.asOf ?? systemClock.now();
  const ctx = emptyViewerContext(viewer, asOf);

  const [declarations, domainStates, canon, events] = await Promise.all([
    loadValueDeclarations().catch(() => []),
    findDomainStatesForSubject(viewer.subject_id).catch(() => []),
    projectCanonDynamics().catch(() => null),
    loadPhilosEvents().catch(() => []),
  ]);

  /* ── PERSONAL VALUE ────────────────────────────────────────────────────
     PERSONAL scope AND held by this viewer. Both halves matter: a GROUP
     declaration this viewer AUTHORED (`declared_by`) is not a value they
     hold, and that is exactly the record that exists today —
     `scope: GROUP, holder: vg_ahrayut_kehilatit, declared_by: person_roei`.
     Hub and Marketplace rendered its label as the person's VALUE. */
  const mine = declarations.filter(
    (d) => d.scope === "PERSONAL" && (d.holder_id === viewer.subject_id || d.holder_id === viewer.person_id),
  );
  if (mine.length === 1) {
    ctx.personal_value = {
      value: mine[0].label, status: "RESOLVED", provenance: "REAL",
      because: "הצהרת ערך אישית של הצופה עצמו",
      evidence: [mine[0].value_id],
    };
  } else if (mine.length > 1) {
    // Two personal values with no recorded precedence. Surfaced, not picked.
    ctx.personal_value = {
      value: null, status: "CONFLICTING", evidence: mine.map((d) => d.value_id),
      because: `${mine.length} הצהרות ערך אישיות ללא סדר עדיפות מתועד`,
    };
  }

  /* ── GROUP VALUES — adjacent, never merged into the field above. ────── */
  const myGroups = new Set(recordedMembershipsOf(viewer, events));
  ctx.group_values = declarations
    .filter((d) => d.scope === "GROUP" && myGroups.has(d.holder_id))
    .map((d): GroupValueRef => ({
      group_id: d.holder_id, label: d.label,
      declaration_status: d.status, declared_by: d.declared_by,
    }));

  /* ── ACTIVE DOMAIN ─────────────────────────────────────────────────────
     A recorded DomainState for THIS viewer, or nothing. The shell used
     `selected.domain` — the domain of a record the user clicked — which is
     navigation state wearing a user-model label. */
  /* DELEGATED, not reimplemented. `resolveValueDomainParam` already owns the
     "most recent recorded DomainState wins" rule and is used by the person
     frame. Writing that rule a second time here would have created exactly
     the defect this module exists to remove — two authorities that happen to
     agree today because they read the same store. */
  const selectedDomain = resolveValueDomainParam(viewer.subject_id, domainStates);
  if (selectedDomain) {
    ctx.active_domain = {
      value: selectedDomain.config.domain.domain_id, status: "RESOLVED", provenance: "REAL",
      because: "רשומת DomainState אמיתית של הצופה — הכלל היחיד, ב-resolveValueDomainParam",
      evidence: selectedDomain.config.states.map((st) => st.parameter_id),
    };
  }

  /* ── REFERENCE ─────────────────────────────────────────────────────────
     The frame the viewer's most recent OBSERVED cell was measured against.
     Real, viewer-scoped, and the one field where Hub was right and six
     terminals were simply not reading it. */
  if (canon) {
    const space = buildMeasuredStateSpace(canon, viewer.subject_id);
    const observed = Object.values(space.cells)
      .filter((c) => c.status === "OBSERVED" && c.reference && c.observed_at)
      .sort((a, b) => (b.observed_at ?? "").localeCompare(a.observed_at ?? ""));
    if (observed.length > 0) {
      ctx.reference = {
        value: observed[0].reference ?? null, status: "RESOLVED", provenance: "REAL",
        because: "מסגרת היחוס של התצפית האחרונה של הצופה",
        evidence: observed[0].canon_event_id ? [observed[0].canon_event_id] : [],
      };
    }
  }

  /* ── PROJECT / REFERENCE GROUP ─────────────────────────────────────────
     No store records either. They stay UNKNOWN with their reason, and this
     resolver deliberately has no branch that could fill them. */
  ctx.project = UNKNOWN_FIELD("אין מאגר שרושם פרויקט נוכחי — לא נגזר מדומיין, מערך או מקבוצה");
  ctx.reference_group = UNKNOWN_FIELD("אין מאגר קבוצות יחוס — קנון §21 אוסר ברירת מחדל");

  return ctx;
}
