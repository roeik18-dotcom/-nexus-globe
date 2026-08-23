/**
 * SystemShell — the global PHILOS shell (Global Design System redesign
 * pass). Every major surface renders the SAME header: wordmark, real
 * navigation (only routes that actually exist), a one-line purpose
 * statement, and — when a context is selected — a compact identity strip.
 *
 * **Redesign pass**: previously an 11px text-link row with no visual
 * weight — every surface felt like a bare utility page, not one product.
 * Rebuilt on `designTokens.ts`: a real wordmark mark (not just text), a
 * filled pill for the current route (not a border), consistent
 * REAL/DEMO/status badges via `statusBadgeStyle`, real vertical rhythm,
 * and a bottom border that visually separates "app chrome" from page
 * content — the same structural role a browser tab bar plays, absent
 * before this pass. Functionally unchanged: same nav destinations, same
 * `?ctx=`/`?subject=`/`?community=` handoff logic, same optional props.
 *
 * **Shell-navigation pass**: the seven terminals now share ONE product
 * order — Hub · Brain · Dynamics · Community · Marketplace · Globe ·
 * World — with Community and Marketplace sitting as peers between
 * Dynamics and the two world views, rather than Marketplace trailing the
 * row as an afterthought. Same seven destinations, same URLs, no route
 * added or renamed. A compact product context strip (PERSON · ACTIVE
 * DOMAIN · VALUE · PROJECT) renders below the purpose line; see
 * `ContextStrip` for why every slot is either passed-in real state or a
 * literal UNKNOWN.
 */
import { encodeSystemContextRef, type ContextSurface, type SelectedContext } from "@/app/lib/systemContext";
import Link from "next/link";

import SocialScaleNav from "./SocialScaleNav";

import type { ReactNode } from "react";
import type { ResolvedViewerContext } from "../context/resolvedViewerContext";
import OrientationBand, { type ViewScale } from "./OrientationBand";
import { SELECTED_GROUP_PARAM } from "@/app/lib/philos/community/selectedGroupContext";
import { COLOR, FS, PRODUCT_FAMILY_CUE, RADIUS, SPACE, STATUS, TERMINAL, TYPE } from "./designTokens";

export interface ShellCommunity {
  group_id: string;
  label: string;
  provenance: "REAL" | "DEMO";
}

/** The resolved Person↔Community-Member identity link status, real and
 *  checked (`personCommunityLink.ts::resolvePersonCommunityLink`) —
 *  passed in by whichever page already resolved it, never re-derived
 *  here. `undefined` = the page did not resolve one (not the same as
 *  NOT_LINKED, which IS a real resolved status and renders). */
export interface ShellIdentityLink {
  status: "VERIFIED_SAME_PERSON" | "DECLARED_SAME_PERSON" | "UNVERIFIED" | "CONFLICT" | "NOT_LINKED";
  person_id: string;
  community_member_id: string;
}

/**
 * `key` identifies each nav item for "you are here" highlighting — broader
 * than `ContextSurface` (which exists for the SEPARATE concern of "which
 * surfaces can receive a `?ctx=` handoff", used by `buildContextActions`)
 * so Hub/Brain/Community/World can be highlighted too without widening that
 * other, narrower type.
 */
export type ShellSurfaceKey = "hub" | "brain" | "dynamics" | "globe" | "community" | "world" | "marketplace";

/**
 * Each flag names a query param THAT destination route's own `page.tsx`
 * actually reads today (verified against the real route each pass this
 * flag set changed) — never carried speculatively to a route that would
 * just ignore it. A destination may read more than one (Dynamics reads
 * both `ctx` and `community`), so these compose rather than cascade.
 */
/**
 * NAV ORDER — and the one place the social-value family is expressed.
 *
 * Community, Globe and World are ADJACENT because they are one structural
 * family sharing a conceptual spine:
 *
 *   contradictions -> values -> group values / value groups
 *   -> social structure (Community) -> network (Globe) -> wider system (World)
 *
 * Marketplace sits AFTER them, still outside the family. It is an operational
 * mechanism (Need -> Capability/Resource/Offer -> Match -> Commitment ->
 * Action -> Effect); it consumes the family's consequences and does not
 * define the contradiction/value/group ontology. It must never sit BETWEEN
 * family members, which would split the family visually — that constraint is
 * what the original ordering protected, and it still holds.
 *
 * HEADER ROLE BAND. The sequence now reads BLUE -> YELLOW -> GREEN -> ORANGE
 * (Brain, Dynamics, the SOCIAL capsule, Marketplace), so the header's colour
 * roles sit adjacent as one band instead of GREEN being separated from the
 * others by Marketplace. This is PROXIMITY ONLY: no role changed, no route
 * changed, and Marketplace remains a standalone item outside the capsule's
 * border rather than becoming a family member. `PRODUCT_FAMILY_CUE !=
 * CANONICAL_COLOR_ROLE` is untouched — the capsule's green is the family cue,
 * and each member still resolves its own accent from `TERMINAL`.
 *
 * **This order is a product decision, not the master's.**
 * `PHILOS-SYSTEM-LANGUAGE.md` §8 numbers the terminals 1-7 with
 * COMMUNITY 4, MARKETPLACE 5, GLOBE 6, WORLD 7. That numbering is
 * preserved in `TERMINAL` and in the master; only the nav sequence differs,
 * and it differs deliberately. Routes are unchanged.
 *
 * `family` marks the three that read as one group. It carries NO colour
 * claim: each keeps its own source-defined Colour Role (Community GREEN,
 * Globe GREEN+PURPLE, World WHITE+PURPLE). The relationship is structural,
 * not chromatic — World is not green and must never be shown as green.
 */
/**
 * WHICH LAYER EACH TERMINAL READS.
 *
 * This is NAVIGATION state — where the user is standing — and it is kept
 * deliberately separate from `active_domain`, which is a claim about the
 * user's model and comes only from a recorded DomainState. Standing on
 * /hub/community makes the SCALE "GROUP"; it does not make Community the
 * active domain. Conflating those two is the defect the canonical resolver
 * was built to remove, so the two never share a value or a type.
 */
const SURFACE_SCALE: Record<ShellSurfaceKey, ViewScale> = {
  hub: "PERSON", brain: "PERSON", dynamics: "PERSON", marketplace: "PERSON",
  community: "GROUP", globe: "NETWORK", world: "SYSTEM",
};

const NAV: { label: string; href: string; key: ShellSurfaceKey; carriesCtx?: boolean; carriesSubject?: boolean; carriesCommunity?: boolean; carriesGroup?: boolean; family?: "social" }[] = [
  { label: "Hub", href: "/hub", key: "hub", carriesSubject: true },
  { label: "Brain", href: "/brain", key: "brain", carriesSubject: true },
  // ROLE-BAND ORDER (ruled by Roei): GREEN sits next to BLUE, and YELLOW sits
  // between GREEN and ORANGE. Reading left to right the header is therefore
  // PURPLE · BLUE · GREEN · YELLOW · ORANGE. Dynamics moved AFTER the social
  // family to make that true; its route, colour and behaviour are unchanged,
  // and the family stays three consecutive `family: "social"` entries so the
  // capsule still collapses them into one control.
  /* THE SOCIAL FAMILY ARE THREE LENSES OVER ONE ENTITY. Their hrefs are NOT
     built here — `SocialScaleNav` renders all three as one client control, and
     that is where the selected entity is carried across a lens change. The
     `carries*` flags below therefore never apply to them; `selectedGroup` is
     handed to `SocialScaleNav` instead. */
  { label: "Community", href: "/hub/community", key: "community", carriesCommunity: true, family: "social" },
  { label: "Globe", href: "/planet", key: "globe", carriesCtx: true, family: "social" },
  { label: "World", href: "/world", key: "world", family: "social" },
  /* Dynamics and Marketplace are the CHANGE and POSSIBILITY lenses over the
     same selected entity, so they carry it exactly as the social three do.
     Without this the loop Community → … → Marketplace → Community dropped the
     subject at the fourth step and each of the two fell back to viewer-scoped
     state — real, but a different question from the one being asked. */
  { label: "Dynamics", href: "/dynamics", key: "dynamics", carriesCtx: true, carriesCommunity: true, carriesGroup: true },
  { label: "Marketplace", href: "/marketplace", key: "marketplace", carriesCtx: true, carriesGroup: true },
];

type NavItem = (typeof NAV)[number];

/**
 * NAVIGATION GROUPING — the nav is a list of GROUPS, not a flat list of
 * destinations. Consecutive members sharing a `family` collapse into ONE
 * group so the shell can render them as a single category container with
 * internal sub-tabs. Non-family items stay standalone.
 *
 * This is computed once, at module level, so the grouping is defined in
 * exactly one place (LOCK: the family treatment lives only in SystemShell).
 * Marketplace deliberately carries no family and therefore stays outside
 * the capsule, ordered before it.
 */
export const NAV_GROUPS: { kind: "item" | "family"; items: NavItem[] }[] = NAV.reduce(
  (acc, item) => {
    const prev = acc[acc.length - 1];
    if (item.family && prev && prev.kind === "family" && prev.items[0].family === item.family) {
      prev.items.push(item);
      return acc;
    }
    acc.push({ kind: item.family ? "family" : "item", items: [item] });
    return acc;
  },
  [] as { kind: "item" | "family"; items: NavItem[] }[],
);

function StatusPill({ label, value, kind }: { label: string; value: string; kind: "real" | "demo" | "unknown" | "blocked" | "verified" | "claimed" | "needs_attention" | "active" | "completed" }) {
  const s = STATUS[kind];
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "5px 12px", borderRadius: 8, background: COLOR.bgRaised, border: `1px solid ${COLOR.border}` }}>
      <span style={{ ...TYPE.micro, color: COLOR.textFaint }}>{label}</span>
      <span style={{ fontSize: FS.read, fontWeight: 600, color: COLOR.text }}>{value}</span>
      {/* MONOSPACE IS FOR MACHINE TOKENS — identifiers and figures, where a
          fixed advance width is the point. A status WORD is prose, and the
          mono face on VERIFIED / UNKNOWN / REAL is most of what made these
          screens read as console output rather than as a product. */}
      <span style={{ fontSize: FS.tag, fontWeight: 800, letterSpacing: 0.6, padding: "1px 6px", borderRadius: 999, background: s.bg, border: `1px solid ${s.border}`, color: s.text }}>
        {s.label}
      </span>
    </div>
  );
}

/**
 * PRODUCT CONTEXT STRIP — one compact line, identical on every terminal:
 * PERSON · ACTIVE DOMAIN · VALUE · PROJECT.
 *
 * Shell-navigation pass discipline: this strip performs NO reads of its
 * own and derives nothing. Every slot is either a real value the calling
 * page ALREADY resolved and passes in, or the literal string `UNKNOWN`.
 *   - PERSON        = the `subject` the page already resolved.
 *   - ACTIVE DOMAIN = `selected.domain`, a real field on an already-
 *                     resolved `SelectedContext` (never guessed from the
 *                     surface you happen to be on).
 *   - VALUE         = a real, already-computed value label (e.g. a value
 *                     group's own `central_value`) passed by the page.
 *                     A Music config EXISTING is not a value being active,
 *                     so nothing is shown on that basis.
 *   - PROJECT       = always UNKNOWN today: no store in this repo records
 *                     a current project, and inferring one is explicitly
 *                     out of bounds.
 */
/* `ContextStrip` stood here. It rendered PERSON · ACTIVE DOMAIN · VALUE ·
   PROJECT · REFERENCE · REFERENCE GROUP as six equally weighted 10px slots,
   which is how a screen ends up with five UNKNOWNs shouting as loudly as the
   one resolved fact. `OrientationBand` replaces it with a real hierarchy and
   is DELETED rather than kept as a second way to render the same context. */


export function SystemShell({
  viewerContext,
  signOut,
  surface,
  purpose,
  selected,
  community,
  subject,
  observedCount,
  identityLink,
  dense,
  selectedGroup,
}: {
  /** COMPACT VARIANT. The orientation band and the status-pill row are the
   *  shell's REFERENCE tier — right for a reading surface, wrong for one whose
   *  subject is a map that should own the viewport. `dense` keeps the nav and
   *  the one-line purpose and moves the rest behind a disclosure, so a
   *  map-first route is not paying 353px of chrome before its own content.
   *  Opt-in: every other terminal renders exactly as before. */
  dense?: boolean;
  /** THE SELECTED ENTITY, carried across the three social lenses. Every nav
   *  link in that family appends it, so switching lens never drops the
   *  subject. `undefined` = nothing selected; links stay bare. */
  selectedGroup?: string;
  surface: ShellSurfaceKey;
  purpose: string;
  selected?: SelectedContext;
  /** Real, checked — never inferred. Carried across nav links via
   *  `?community=`, the same param `app/hub/community/page.tsx` already
   *  reads. `undefined` = no community context selected on this page. */
  community?: ShellCommunity;
  /** Real, checked — never inferred. A direct subject string for surfaces
   *  that resolve a bare subject (Hub, Brain) rather than a full
   *  `SystemContextRef`-based `SelectedContext` (Dynamics/Globe/
   *  Marketplace). When both are given, `subject` wins — it is the more
   *  specific, more recently-resolved value on subject-native surfaces. */
  subject?: string;
  /** STEP 2 — the frame this screen's readings are relative to (canon §19
   *  `P = P(person, reference_group, context, time)`). `undefined` = the page
   *  did not resolve one. A stated UNKNOWN frame is honest; an absent frame
   *  reads as an absolute fact, which it never is. */
  /** How many of the nine canon cells have a real Observation
   *  (`buildMeasuredStateSpace().observed_count`). The honesty anchor: it is
   *  what stops a partially-measured space from reading as a whole person.
   *  `undefined` = this surface does not project the state space. */
  observedCount?: number;
  /** A real, already-computed value label (a value group's own
   *  `central_value`, for instance) for the context strip's VALUE slot.
   *  `undefined` renders UNKNOWN — never inferred from the presence of a
   *  config. */
  /** Real, checked (`resolveRealPersonCommunityLink`) — the ONE shared
   *  insertion point that propagates the Person↔Community-Member link
   *  status across every surface that mounts this shell. */
  identityLink?: ShellIdentityLink;
  /** The ONE canonical semantic context. Replaces `valueLabel`,
   *  `personContext` and the `selected.domain` read. */
  viewerContext: ResolvedViewerContext;
  /** Server-rendered sign-out control, passed as a slot — see the note at the
   *  render site for why this cannot be an import. */
  signOut?: ReactNode;
}) {
  const ctxValue = selected?.status === "found" ? encodeSystemContextRef(selected.ref) : undefined;
  // Real cross-surface subject handoff: Hub/Brain read `?subject=` — never
  // fabricated, only carried when a real subject exists.
  const subjectValue = subject ?? (selected?.status === "found" ? selected.subject : undefined);
  const communityValue = community?.group_id;

  const identityKind =
    identityLink?.status === "VERIFIED_SAME_PERSON" ? "verified" :
    identityLink?.status === "CONFLICT" ? "blocked" :
    identityLink?.status === "DECLARED_SAME_PERSON" ? "active" :
    identityLink?.status === "UNVERIFIED" ? "claimed" : "unknown";

  // Terminal identity — the locked per-surface colour role
  // (`PHILOS-SYSTEM-LANGUAGE.md` §8). Routing metadata for the surface, never
  // a state, never a value, never a cell (`Cell_ID ≠ Color_ID`).
  const terminal = TERMINAL[surface];

  // Query-parameter carry rules per nav item — shared by standalone items and
  // by the social-family sub-tabs so both preserve context identically.
  const hrefFor = (item: NavItem) => {
    const parts: string[] = [];
    if (item.carriesCtx && ctxValue) parts.push(`ctx=${encodeURIComponent(ctxValue)}`);
    if (item.carriesSubject && subjectValue) parts.push(`subject=${encodeURIComponent(subjectValue)}`);
    if (item.carriesCommunity && communityValue) parts.push(`community=${encodeURIComponent(communityValue)}`);
    if (item.carriesGroup && selectedGroup) parts.push(`${SELECTED_GROUP_PARAM}=${encodeURIComponent(selectedGroup)}`);
    return parts.length > 0 ? `${item.href}?${parts.join("&")}` : item.href;
  };

  return (
    <div style={{ fontFamily: "system-ui" }}>
      {/* Accent rail — the one visual cue that tells you which terminal you
          are on before you read a word. Same rail on all seven, different
          colour, straight from the locked table. */}
      <div style={{ height: 2, background: `linear-gradient(90deg, ${terminal.accent}, ${terminal.support} 60%, transparent)`, borderRadius: 2, marginBottom: SPACE.sm }} />
      <div
        style={{
          display: "flex", alignItems: "center", gap: SPACE.sm, flexWrap: "wrap",
          padding: `${SPACE.sm}px 0`, borderBottom: `1px solid ${COLOR.border}`, marginBottom: SPACE.md,
        }}
      >
        {/* Wordmark — a real mark, not just text, so the shell reads as
            app chrome rather than a page title. */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginInlineEnd: SPACE.sm }}>
          <div
            style={{
              width: 26, height: 26, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              background: `linear-gradient(135deg, ${terminal.accent}, ${terminal.support})`, color: "#02101f", fontWeight: 900, fontSize: FS.head,
            }}
          >
            Φ
          </div>
          <span style={{ ...TYPE.subtitle, letterSpacing: 2.5, color: COLOR.text }}>PHILOS</span>
          <span style={{ ...TYPE.micro, color: terminal.accent, marginInlineStart: 2 }} title={terminal.question_he}>
            {terminal.glyphs} {terminal.label_he}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
          {NAV_GROUPS.map((group) => {
            if (group.kind === "item") {
              const item = group.items[0];
              const here = item.key === surface;
              /* HEADER ROLE BAND.
                 Every terminal already owns a canonical accent in `TERMINAL`,
                 but the nav painted it only on the ACTIVE item — so six of the
                 seven roles were invisible and the header carried no colour
                 structure at all. Each item now shows its own accent as a
                 2px seat under the label, dim when elsewhere and solid when
                 here. Read left to right the band is the role sequence the
                 nav order encodes: Hub PURPLE, then BLUE -> GREEN
                 (the social capsule) -> YELLOW -> ORANGE.

                 A seat rather than a fill: seven filled pills would make the
                 header a colour chart and destroy the one thing the active
                 state has to communicate. `Cell_ID != Color_ID` is unaffected
                 — this paints a terminal's own declared accent, and derives
                 nothing from it. */
              const accent = TERMINAL[item.key].accent;
              return here ? (
                <span
                  key={item.label}
                  style={{ fontSize: FS.meta, fontWeight: 700, padding: "6px 14px", borderRadius: 8, color: "#02101f", background: accent, boxShadow: `inset 0 -2px 0 0 ${accent}` }}
                >
                  {item.label}
                </span>
              ) : (
                <Link
                  key={item.label}
                  href={hrefFor(item)}
                  style={{
                    fontSize: FS.meta, fontWeight: 500, padding: "6px 14px", borderRadius: 8,
                    color: COLOR.textDim, textDecoration: "none",
                    boxShadow: `inset 0 -2px 0 0 ${accent}55`,
                  }}
                >
                  {item.label}
                </Link>
              );
            }

            // SOCIAL-VALUE FAMILY — rendered by `SocialScaleNav`, a CLIENT
            // control, because changing scale must behave like changing a
            // view rather than leaving for another product. It uses
            // `next/link` with prefetch; the plain `<a href>` this replaced
            // made every scale change a FULL PAGE RELOAD that tore down and
            // rebuilt the 3D globe. It also carries the current selection
            // across the change, so one object stays selected through a zoom.
            //
            // PRODUCT_FAMILY_CUE != CANONICAL_COLOR_ROLE still holds: the bar
            // is tinted with the family cue, and no member's canonical role is
            // restated by it.
            return <SocialScaleNav key="social-family" selectedGroup={selectedGroup} />;
          })}
        </div>
      </div>

      {/* The purpose line is orientation prose. A map-first surface states its
          purpose in the map; `dense` drops the row rather than paying a full
          text line above the subject. */}
      {dense ? null : (
        <p style={{ ...TYPE.body, color: COLOR.textDim, margin: `0 0 ${SPACE.sm}px`, maxWidth: 640 }}>{purpose}</p>
      )}

      {/* THE SHARED ORIENTATION BAND. One implementation, seven terminals.
          It takes the canonical context and the scale this screen reads —
          and no other prop, so a terminal has no channel through which to
          pass a semantic override. `ContextStrip` is gone: six equal 10px
          metadata slots, mostly UNKNOWN, competing with the one or two facts
          that were real. */}
      {dense ? null : (
        <OrientationBand
          ctx={viewerContext}
          scale={SURFACE_SCALE[surface]}
          surfaceTitle={terminal.label_he}
          accent={terminal.accent}
        />
      )}

      <div style={{ display: dense ? "none" : "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: SPACE.sm }}>
        {selected?.status === "found" ? (
          <StatusPill label="SELECTED" value={selected.subject ? `${selected.label} · ${selected.subject}` : selected.label} kind="active" />
        ) : null}
        {community ? (
          <StatusPill label="COMMUNITY" value={community.label} kind={community.provenance === "DEMO" ? "demo" : "real"} />
        ) : null}
        {identityLink ? (
          <StatusPill label="IDENTITY" value={`${identityLink.person_id} ↔ ${identityLink.community_member_id}`} kind={identityKind} />
        ) : null}
        {/* Sign out, as a SLOT. `SystemShell` is imported by client
            components (WorldGlobe, DynamicsView), so anything it imports ends
            up in the client bundle — importing the button directly dragged
            `next/headers` across the boundary and broke every page that
            renders a globe. The server pages render it and pass it down, the
            same way `personFrameSlot` and `canonicalSlice` already work. */}
        {signOut}
      </div>
    </div>
  );
}
