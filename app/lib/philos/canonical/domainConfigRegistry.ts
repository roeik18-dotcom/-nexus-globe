/**
 * PHILOS Canonical layer — DOMAIN CONFIG SLOT registry.
 *
 * ── The gap this closes ────────────────────────────────────────────────
 *
 * Seven call sites independently wrote the same two lines:
 *
 *   buildValueDomainInstance({ domain_id: MUSIC_CANON_DOMAIN_ID,
 *                              source_refs: buildActiveMusicRefs()… })
 *
 * — `app/hub/page.tsx`, `PersonNowPanel`, `WeeklyLearningPanel`,
 * `CanonicalSlicePanel`, `CanonicalBrainPanel`, `DynamicsView`, and
 * `api/canon/shared-state`. Nothing was factually wrong in any of them,
 * but the SHAPE was: Music was named, by hand, as a permanent second half
 * of the person, in the core of a system whose own architecture says a
 * domain is a SWAPPABLE slot. A future BUSINESS or HEALTH config could not
 * have been added without editing seven files, which is the operational
 * definition of "Music is privileged in the ontology".
 *
 * ── The three axes this module keeps separate ──────────────────────────
 *
 *   HUMAN CONFIG   the reusable, cross-domain reference base for the
 *                  person. NOT a domain, NOT a slot, and deliberately not
 *                  registered here — `buildActivePersonRefs()` stays its
 *                  own thing. Human Config answers "what is known/askable/
 *                  measurable about this person", across every domain.
 *   VALUE/DIRECTION a separate axis entirely (value groups, families,
 *                  general values). No value relation may activate a
 *                  domain, and nothing in this module reads one.
 *   DOMAIN CONFIG  this registry. A swappable contextual slot. Music is
 *                  the first and broadest ARCHETYPE — one instance of the
 *                  contract, not the contract itself.
 *
 * ── What a registered slot may and may not claim ───────────────────────
 *
 * A slot's `activeConfig()` returns REFS ONLY (`ActiveConfigSet`), folded
 * mechanically from its Source Lock's own TYPE/RUNTIME_STATUS fields. This
 * module adds no selection, no promotion and no interpretation on top of
 * that, and specifically:
 *
 *   - **Availability is not selection.** A registered slot means "this
 *     domain's config exists and could be selected". It does NOT mean the
 *     person is in that domain. `resolveSelectedDomain` is the ONLY thing
 *     that answers "which domain is active", and it answers from a real
 *     recorded `DomainState` — never from this registry's contents.
 *   - **Config is not state.** An active `WORKFLOW_STAGE` ref says the
 *     workflow model knows the stage exists; it never says the person is
 *     in it. An active `CAPABILITY` ref says the domain defines that
 *     capability; it never says the person possesses it. An active
 *     `ENGINEERING_PARAMETER` ref says the parameter is measurable; it
 *     never supplies a measurement.
 *   - **No writes.** Nothing here appends to any store, and no slot may
 *     be registered at runtime — the registry is a frozen constant, so a
 *     request cannot grow the set of domains a person "has".
 *
 * ── Why Music is the only real entry ───────────────────────────────────
 *
 * Because it is the only domain with a real, frozen Source Lock in this
 * repository (`music.master.json`, 80 records). BUSINESS / HEALTH /
 * RELATIONSHIPS / EDUCATION are named in the architecture as future slots
 * and are deliberately NOT registered here: registering a slot with no
 * source would be inventing domain data. They appear only in
 * `__tests__/domainSwap.test.ts`, explicitly labelled SYNTHESIS_TEST,
 * where they prove the contract survives Music's removal.
 */
import {
  type ActiveConfigSet, type ConfigQuestion,
  buildActiveMusicRefs, buildMusicConfigQuestions,
} from "./activeConfig";
import { MUSIC_CANON_DOMAIN_ID } from "./musicMasterLoader";

/**
 * One swappable domain slot. Everything a surface needs to render a domain
 * WITHOUT naming which domain it is.
 */
export interface DomainConfigSlot {
  /** The stable `domain_id` that real `DomainState` records carry. The
   *  join key between config (this slot) and runtime (a real reading). */
  domain_id: string;
  label_he: string;
  label_en: string;
  /** The `CanonicalRef` kind prefix this slot's refs carry (e.g. "MUSIC"),
   *  so a surface can cite a ref without knowing the domain. */
  ref_kind: string;
  /** REFS ONLY, folded from the slot's own Source Lock. Pure + sync. */
  activeConfig: () => ActiveConfigSet;
  /** The questions this domain's config declares may be ASKED. REFERENCE
   *  only, deliberately NOT part of `activeConfig` — see
   *  `activeConfig.ts::ConfigQuestion`. A question is not an answer and an
   *  answer is not a measurement; nothing consumes these as state. */
  questions: () => ConfigQuestion[];
  /** `SOURCE_LOCK` = a real frozen master file backs this slot.
   *  `SYNTHESIS_TEST` = a substitution fixture; never registered in
   *  production code, never rendered as a real domain. */
  provenance: "SOURCE_LOCK" | "SYNTHESIS_TEST";
  /** The real source lock file name, for citation. */
  source_lock: string;
}

/**
 * The registered domain configs. Frozen: a domain cannot be added at
 * runtime, so no request can grow the set of domains a person "has".
 *
 * MUSIC is here because `music.master.json` is real. Nothing else is here
 * because nothing else has a source — see the module header.
 */
export const DOMAIN_CONFIG_SLOTS: readonly DomainConfigSlot[] = Object.freeze([
  Object.freeze({
    domain_id: MUSIC_CANON_DOMAIN_ID,
    label_he: "מוזיקה",
    label_en: "Music",
    ref_kind: "MUSIC",
    activeConfig: buildActiveMusicRefs,
    questions: buildMusicConfigQuestions,
    provenance: "SOURCE_LOCK" as const,
    source_lock: "MUSIC_CONFIG_MASTER_SOURCE_LOCK_v1.0.xlsx",
  }),
]);

/**
 * Every domain config that EXISTS and could be selected. Availability
 * only — see the header: this is never "the person's domains".
 */
export function availableDomainConfigs(): readonly DomainConfigSlot[] {
  return DOMAIN_CONFIG_SLOTS;
}

export function findDomainConfig(domainId: string): DomainConfigSlot | null {
  return DOMAIN_CONFIG_SLOTS.find((d) => d.domain_id === domainId) ?? null;
}

export type SelectedDomainResolution =
  | { selected: true; slot: DomainConfigSlot; basis: string }
  | { selected: false; reason: string; available: readonly DomainConfigSlot[] };

/**
 * The ONE answer to "which domain is active for this subject".
 *
 * `activeDomainId` must come from a REAL recorded `DomainState` (that is
 * how `app/hub/page.tsx` already resolves it — `valueDomainParam?.config
 * .domain.domain_id`). It must never be passed from this registry's own
 * contents: the existence of a Music config is not a person being in the
 * Music domain, and that inference is exactly what this function exists to
 * make impossible to write by accident.
 *
 * When nothing real selects a domain the answer is UNKNOWN **with the
 * reason**, never a default and never the first registered slot.
 */
export function resolveSelectedDomain(activeDomainId?: string | null): SelectedDomainResolution {
  if (!activeDomainId) {
    return {
      selected: false,
      available: DOMAIN_CONFIG_SLOTS,
      reason:
        "אין רשומת בחירת-דומיין: ACTIVE DOMAIN נגזר אך ורק מ-DomainState אמיתי שנרשם, ולנושא זה אין. " +
        "קיום קונפיג דומיין אינו בחירה של דומיין.",
    };
  }
  const slot = findDomainConfig(activeDomainId);
  if (!slot) {
    return {
      selected: false,
      available: DOMAIN_CONFIG_SLOTS,
      reason: `נרשם DomainState עבור domain_id="${activeDomainId}", אך אין קונפיג דומיין רשום עבורו — לא הומצא קונפיג.`,
    };
  }
  return {
    selected: true,
    slot,
    basis: `DomainState אמיתי שנרשם עבור domain_id="${activeDomainId}"`,
  };
}

/** One row per available domain, for a CONFIG BASELINE strip that names no
 *  domain in its own code. Availability + counts only — never a state. */
export interface DomainConfigBaseline {
  domain_id: string;
  label_he: string;
  label_en: string;
  active_refs: number;
  total_in_lock: number;
  by_type: Record<string, string[]>;
  provenance: DomainConfigSlot["provenance"];
  /** True only when a real DomainState selected this domain. */
  selected: boolean;
}

export function buildDomainConfigBaselines(activeDomainId?: string | null): DomainConfigBaseline[] {
  const resolution = resolveSelectedDomain(activeDomainId);
  const selectedId = resolution.selected ? resolution.slot.domain_id : null;
  return DOMAIN_CONFIG_SLOTS.map((slot) => {
    const set = slot.activeConfig();
    return {
      domain_id: slot.domain_id,
      label_he: slot.label_he,
      label_en: slot.label_en,
      active_refs: set.refs.length,
      total_in_lock: set.total_in_lock,
      by_type: set.by_type,
      provenance: slot.provenance,
      selected: slot.domain_id === selectedId,
    };
  });
}
