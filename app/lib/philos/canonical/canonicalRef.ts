/**
 * PHILOS Canonical layer — CanonicalRef: the one reference format runtime
 * instances (`PersonInstance`/`ValueDomainInstance`, `personInstance.ts`)
 * use to point at a frozen Source Lock record, WITHOUT ever copying that
 * record's `SOURCE_TEXT` into the runtime instance.
 *
 * Format, exactly as the Phase 4 brief states it:
 *   `HUMAN:<SOURCE_NUMBER>`  — e.g. `HUMAN:12`
 *   `MUSIC:<SOURCE_NUMBER>`  — e.g. `MUSIC:GEN-MU-PROC-04`
 *   `COLOR:<COLOR_ID>`       — e.g. `COLOR:6`, `COLOR:0` (White)
 *
 * **Why the resolved summary type has no `SOURCE_TEXT` field, structurally,
 * not by convention:** `CanonicalRefResolved` below is a deliberately
 * narrower type than the loaders' own `HumanMasterRecord`/`MusicMasterRecord`/
 * `ColorMasterRecord` — it is built by explicit field-by-field selection in
 * `resolveCanonicalRef`, never by spreading the loaded record. A caller that
 * stores this resolution result (e.g. inside a `PersonInstance.evidence`
 * entry) therefore cannot accidentally carry `SOURCE_TEXT` along with it,
 * even by refactoring mistake — the field does not exist on the type to
 * spread in the first place. A caller that genuinely needs the full frozen
 * record for DISPLAY (e.g. an audit page rendering the real source text)
 * calls the kind-specific loader directly — that is a read, not a runtime
 * instance, and stays outside `personInstance.ts` entirely.
 */
import { findColorById, normalizedColorId, type ColorMasterRecord } from "./colorMasterLoader";
import { findHumanBySourceNumber, type HumanMasterRecord } from "./humanMasterLoader";
import { findMusicBySourceNumber, type MusicMasterRecord } from "./musicMasterLoader";
import type { SourceKind } from "./sourceKind";

export type CanonicalRefKind = "HUMAN" | "MUSIC" | "COLOR";

export interface CanonicalRef {
  kind: CanonicalRefKind;
  /** `HUMAN`/`MUSIC`: the real `SOURCE_NUMBER`. `COLOR`: the real (raw)
   *  `COLOR_ID`. Always a string here — the ref's own wire format is a
   *  string regardless of the underlying field's JSON type. */
  source_number: string;
}

/** The one canonical formatter — every `CanonicalRef` displayed or stored
 *  as a string goes through this, never hand-built with template literals
 *  at the call site. */
export function formatCanonicalRef(ref: CanonicalRef): string {
  return `${ref.kind}:${ref.source_number}`;
}

const REF_PATTERN = /^(HUMAN|MUSIC|COLOR):(.+)$/;

/** Pure, total — never throws. `null` for anything that is not
 *  `KIND:<non-empty>` with a recognized kind. */
export function parseCanonicalRef(raw: string): CanonicalRef | null {
  const match = REF_PATTERN.exec(raw.trim());
  if (!match) return null;
  const [, kind, source_number] = match;
  if (source_number.trim() === "") return null;
  return { kind: kind as CanonicalRefKind, source_number };
}

/** Narrower than the loaders' own record types — see module header. No
 *  `SOURCE_TEXT` field exists on this type. */
export interface CanonicalRefResolved {
  ref: CanonicalRef;
  source_kind: SourceKind;
  label: string;
  runtime_status: string;
  type_or_function: string;
  mapping_basis: string | null;
  conflict_status: string | null;
}

export type CanonicalRefResolution =
  | { status: "invalid"; raw: string }
  | { status: "not_found"; ref: CanonicalRef }
  | ({ status: "resolved" } & CanonicalRefResolved);

function fromHuman(ref: CanonicalRef, r: HumanMasterRecord): CanonicalRefResolved {
  return {
    ref, source_kind: "CANON",
    label: r.SOURCE_HEADING || r.SOURCE_SECTION,
    runtime_status: r.RUNTIME_STATUS,
    type_or_function: r.TYPE,
    mapping_basis: r.MAPPING_BASIS ?? null,
    conflict_status: null,
  };
}

function fromMusic(ref: CanonicalRef, r: MusicMasterRecord): CanonicalRefResolved {
  return {
    ref, source_kind: "CANON",
    label: r.SOURCE_HEADING || r.SOURCE_SECTION,
    runtime_status: r.RUNTIME_STATUS,
    type_or_function: r.TYPE,
    mapping_basis: r.MAPPING_BASIS ?? null,
    conflict_status: null,
  };
}

function fromColor(ref: CanonicalRef, r: ColorMasterRecord): CanonicalRefResolved {
  return {
    ref: { kind: "COLOR", source_number: normalizedColorId(r.COLOR_ID) },
    source_kind: "CANON",
    label: r.COLOR,
    runtime_status: r.RELATION_STATUS,
    type_or_function: r.CANONICAL_FUNCTION,
    mapping_basis: r.MAPPING_BASIS,
    conflict_status: r.CONFLICT_STATUS,
  };
}

/**
 * The one resolver every consumer uses — `HUMAN:<n>` / `MUSIC:<n>` /
 * `COLOR:<id>` → a real, checked record from the matching frozen master, or
 * an honest `not_found`/`invalid`. Never throws; never fabricates a
 * resolution for a ref that does not exist in the Source Lock.
 */
export function resolveCanonicalRef(raw: string): CanonicalRefResolution {
  const ref = parseCanonicalRef(raw);
  if (!ref) return { status: "invalid", raw };

  if (ref.kind === "HUMAN") {
    const r = findHumanBySourceNumber(ref.source_number);
    return r ? { status: "resolved", ...fromHuman(ref, r) } : { status: "not_found", ref };
  }
  if (ref.kind === "MUSIC") {
    const r = findMusicBySourceNumber(ref.source_number);
    return r ? { status: "resolved", ...fromMusic(ref, r) } : { status: "not_found", ref };
  }
  const found = findColorById(ref.source_number);
  return found ? { status: "resolved", ...fromColor(ref, found.record) } : { status: "not_found", ref };
}
