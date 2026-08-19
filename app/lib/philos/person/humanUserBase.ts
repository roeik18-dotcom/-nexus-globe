/**
 * HUMAN USER BASE — the reusable, cross-domain reference base for a person.
 *
 * ── What it answers ────────────────────────────────────────────────────
 *
 *   "What is KNOWN about this person as REFERENCE, in any domain?"
 *   equivalently: what may be asked, what may be measured, what
 *   capabilities/resources/processes the config even defines.
 *
 * ── What it is NOT, enforced structurally ──────────────────────────────
 *
 *   HUMAN CONFIG != PERSON
 *   HUMAN CONFIG != LIVE STATE
 *   HUMAN CONFIG != OBSERVATION
 *   HUMAN CONFIG != EVIDENCE
 *
 * This type deliberately has NO field for `measure`, `live_state`, `score`,
 * `dominant_domain`, `tension`, or `next_action`. Not "left empty" — absent
 * from the type, so no caller can populate one by accident and no surface
 * can read one. Those belong to their own systems (Observation/CellState,
 * tension.ts, brainDerivation.ts) and arrive from live records, never from
 * config. `humanUserBase.test.ts` asserts their absence.
 *
 * The one number here is `confidence`, and it is NOT a score: it is the
 * source row's own recorded confidence about its own mapping, carried
 * verbatim as provenance metadata. It never ranks parameters, never sums,
 * and never becomes a level.
 *
 * ── The structural roles ───────────────────────────────────────────────
 *
 * These twelve are the grammar that survives domain replacement (see
 * `canonical/__tests__/domainSwap.test.ts`). Human Config populates the
 * cross-domain ones; a `DomainConfigSlot` populates the same shapes with
 * its own vocabulary. Nothing here is Music-specific, and nothing here
 * mentions a domain by name.
 *
 * Roles with no honest source in Human Config today are present as EMPTY
 * ARRAYS with a stated reason in `unresolved[]` — never omitted (which
 * would read as "not applicable") and never padded.
 */
import { buildActivePersonRefs, buildHumanConfigQuestions, type ConfigQuestion } from "../canonical/activeConfig";
import type { PersonRef } from "./personRef";

/** Provenance for a single base entry — where it came from, and how
 *  strongly its own source vouches for it. Never a quality judgement of
 *  the person. */
export interface BaseProvenance {
  /** The formatted `HUMAN:<SOURCE_NUMBER>` ref. */
  ref: string;
  /** The Source Lock's own TYPE word, verbatim, never re-classified. */
  source_type: string;
  /** The Source Lock's own RUNTIME_STATUS, verbatim. */
  runtime_status: string;
  /** The source's own confidence about its own mapping, when it records
   *  one. `null` = the source states none. Never defaulted, never a score
   *  about the person. */
  confidence: number | null;
}

export interface BaseEntry {
  /** Stable id — the canonical ref, reused rather than minted. */
  id: string;
  /** The source's own short label. */
  label: string;
  provenance: BaseProvenance;
}

/**
 * The twelve structural roles. Every one is REFERENCE: what the config
 * defines as possible/relevant, never what is currently true.
 */
export interface HumanUserBase {
  person: PersonRef;

  /** CONTEXT — the frames this base is expressed in (Source Lock sections). */
  context: BaseEntry[];
  /** DIMENSION — the axes the config names (SCALE rows). */
  dimension: BaseEntry[];
  /** PARAMETER — what is measurABLE. Never a measurement. */
  parameter: BaseEntry[];
  /** DIRECTION — orientation/polarity the config declares for an axis. */
  direction: BaseEntry[];
  /** CAPABILITY — capabilities the config DEFINES. Defining a capability
   *  is not possessing it; possession needs a real record. */
  capability: BaseEntry[];
  /** RESOURCE — resource kinds the config names. Not resources held. */
  resource: BaseEntry[];
  /** PROCESS — processes/workflows the config models. Not processes running. */
  process: BaseEntry[];
  /** ENVIRONMENT — environmental factors the config models. */
  environment: BaseEntry[];
  /** RELATION — relations the config declares between its own entries.
   *  Never a relation between PEOPLE. */
  relation: BaseEntry[];
  /** PROVENANCE — the base's own source identity. */
  provenance: {
    source_lock: string;
    total_in_lock: number;
    active_refs: number;
  };
  /** CONFIDENCE — per-entry, carried on each `BaseProvenance`. This
   *  aggregate states only how many entries carry one at all. */
  confidence: { entries_with_confidence: number; entries_without: number };
  /** QUESTION — what the config says MAY BE ASKED. An unanswered question
   *  is not a measurement, and an answer is not one either until it
   *  becomes a real Observation. */
  question: ConfigQuestion[];

  /** Roles with no honest source today, each with its real reason. */
  unresolved: string[];
}

/** The Source Lock TYPE → structural role mapping. Only the lock's own
 *  words appear on the left; nothing is invented on the right. */
const ROLE_OF_TYPE: Record<string, keyof Pick<HumanUserBase, "dimension" | "parameter">> = {
  SCALE: "dimension",
  DYNAMIC_PARAMETER: "parameter",
  STATIC_ATTRIBUTE: "parameter",
};

/**
 * Build the base. Pure and synchronous — folds the already-frozen Source
 * Lock through `activeConfig.ts`'s existing activation rule. No I/O beyond
 * that frozen read, no store, no clock.
 *
 * `activeConfig` is reused rather than re-derived so this module cannot
 * widen activation: if a row is not active there, it is not here.
 */
export function buildHumanUserBase(person: PersonRef): HumanUserBase {
  const active = buildActivePersonRefs();

  const dimension: BaseEntry[] = [];
  const parameter: BaseEntry[] = [];

  for (const [type, refs] of Object.entries(active.by_type)) {
    const role = ROLE_OF_TYPE[type];
    if (!role) continue;
    for (const ref of refs) {
      const entry: BaseEntry = {
        id: ref,
        label: ref,
        provenance: {
          ref,
          source_type: type,
          runtime_status: active.status_by_ref[ref] ?? "UNKNOWN",
          // The Source Lock records no per-row confidence field, so this
          // is honestly null rather than a fabricated 1.0.
          confidence: null,
        },
      };
      (role === "dimension" ? dimension : parameter).push(entry);
    }
  }

  const withConf = [...dimension, ...parameter].filter((e) => e.provenance.confidence !== null).length;

  return {
    person,
    // CONTEXT/DIRECTION/CAPABILITY/RESOURCE/PROCESS/ENVIRONMENT/RELATION:
    // the Human Source Lock's vocabulary has no TYPE that honestly maps to
    // these. Empty with a stated reason beats a fabricated mapping.
    context: [],
    dimension,
    parameter,
    direction: [],
    capability: [],
    resource: [],
    process: [],
    environment: [],
    relation: [],
    provenance: {
      source_lock: "HUMAN_CONFIG_MASTER_SOURCE_LOCK_v1.0.xlsx",
      total_in_lock: active.total_in_lock,
      active_refs: active.refs.length,
    },
    confidence: { entries_with_confidence: withConf, entries_without: dimension.length + parameter.length - withConf },
    question: buildHumanConfigQuestions(),
    unresolved: [
      "CONTEXT — the Source Lock records SOURCE_SECTION per row, but a section is a document location, not a person-context; promoting one to the other would be invented structure",
      "DIRECTION — no Human Source Lock TYPE declares polarity/orientation for an axis; the 7 temperament dimensions carry their poles in a separate curated module, not in the lock",
      "CAPABILITY — the Human lock defines no capability rows (the Music domain lock does); defining is not possessing either way",
      "RESOURCE — no resource vocabulary exists in the Human lock",
      "PROCESS — no process/workflow rows in the Human lock (the Music domain lock has WORKFLOW_STAGE)",
      "ENVIRONMENT — no environment rows in the Human lock (the Music domain lock has ENVIRONMENT_STATE)",
      "RELATION — the lock declares no relations between its own entries; inferring them from adjacency or section would be fabrication",
      "CONFIDENCE — the Source Lock carries no per-row confidence field, so every entry's confidence is null rather than defaulted",
    ],
  };
}
