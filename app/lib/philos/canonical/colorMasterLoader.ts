/**
 * PHILOS Canonical layer — ColorMasterLoader.
 *
 * Read-only reader for `canonical/data/color.master.json` — the frozen
 * Source Lock (`PHILOS_COLOR_MONSTER_SOURCE_LOCK_v1.0.xlsx`, 7 records,
 * `id_field: COLOR_ID`).
 *
 * **`COLOR_ID` is a SYSTEM FUNCTION index, never a Cell_ID** — every one of
 * the 7 records' own `NOTES` field says this explicitly ("Color_ID is a
 * SYSTEM FUNCTION index; it is NOT a 3x3 Cell_ID and never becomes Human
 * state"). This module enforces that boundary by construction: nothing here
 * imports `canon/cellState.ts`, reads a `Cell_ID`, or offers any function
 * that maps one to the other. `Cell_ID != Color_ID` (Phase 4 brief) is
 * therefore true by the plain absence of a conversion path, not by a
 * comment.
 *
 * **`COLOR_ID` typing in the raw Source Lock is inconsistent** (6 records
 * carry it as a numeral-string `"6"`…`"1"`, White carries it as the bare
 * number `0`) — this loader keeps the raw field exactly as the frozen file
 * states it (`string | number`, never silently coerced in the exposed
 * record) but ALSO exposes a normalized `colorId: string` on every lookup
 * result, so callers never have to special-case White's typing themselves.
 *
 * **White = 0, CONFLICT_STATUS = OPEN** (Phase 4 acceptance criterion) —
 * `whiteColorConflict()` surfaces this real, already-recorded conflict
 * verbatim from the Source Lock's own `CONFLICTS`/`CONFLICT_STATUS`/
 * `MAPPING_BASIS` fields; it does not resolve, hide, or silently default the
 * conflict — an unresolved `CONFLICT_STATUS: "OPEN"` stays OPEN until a real
 * future pass closes it in the Source Lock itself.
 */
import { loadMasterFile } from "./masterLoader";

export interface ColorMasterRecord {
  ORDER_INDEX: number;
  COLOR: string;
  /** Raw as the Source Lock states it — string for 6 records, `0` (number)
   *  for White. Use `normalizedColorId()` / the `colorId` field on
   *  `findColorById`'s result for a consistent string key. */
  COLOR_ID: string | number;
  CANONICAL_FUNCTION: string;
  BODY_POSITION_ROLE: string;
  HUMAN_FUNCTION: string;
  MUSIC_FUNCTION: string;
  SYSTEM_FUNCTION: string;
  PROCESS_POSITION: string;
  PRIMARY_QUESTION: string;
  GENERAL_MEANING: string;
  EXPLICIT_SOURCE_RELATIONS: string;
  SYMBOLIC_RELATIONS: string;
  REVIEW_REQUIRED_RELATIONS: string | null;
  CONFLICTS: string | null;
  RELATION_STATUS: string;
  SOURCE_FILES: string;
  NOTES: string;
  MAPPING_BASIS: string | null;
  CONFLICT_STATUS: string | null;
}

const FILE_NAME = "color.master.json";

/** The real, checked normal form of `COLOR_ID` — the ONE function every
 *  caller uses instead of re-deriving `String(...)` ad hoc. */
export function normalizedColorId(raw: string | number): string {
  return String(raw);
}

export const WHITE_COLOR_ID = "0";

/** The whole frozen Color corpus — real, checked (7 records). */
export function loadColorMaster(): ColorMasterRecord[] {
  return loadMasterFile<ColorMasterRecord>(FILE_NAME).records;
}

export function colorMasterMeta(): { source_lock: string; source_lock_sha256_16: string; id_field: string; row_count: number } {
  const { source_lock, source_lock_sha256_16, id_field, row_count } = loadMasterFile<ColorMasterRecord>(FILE_NAME);
  return { source_lock, source_lock_sha256_16, id_field, row_count };
}

export interface ColorMasterLookup {
  record: ColorMasterRecord;
  colorId: string;
}

/** Lookup by normalized `COLOR_ID` — `null` when genuinely absent. Accepts
 *  either typing (`"6"` or `6`) since the frozen data itself is
 *  inconsistent (see module header). */
export function findColorById(colorId: string | number): ColorMasterLookup | null {
  const wanted = normalizedColorId(colorId);
  const record = loadColorMaster().find((r) => normalizedColorId(r.COLOR_ID) === wanted);
  return record ? { record, colorId: wanted } : null;
}

export interface WhiteColorConflict {
  colorId: string;
  conflict_status: string | null;
  mapping_basis: string | null;
  conflicts: string | null;
}

/** The real White(=0)/OPEN conflict, surfaced verbatim — Phase 4's own
 *  named acceptance criterion. `null` only if the Source Lock itself no
 *  longer contains a White record (never fabricated). */
export function whiteColorConflict(): WhiteColorConflict | null {
  const white = findColorById(WHITE_COLOR_ID);
  if (!white) return null;
  return {
    colorId: white.colorId,
    conflict_status: white.record.CONFLICT_STATUS,
    mapping_basis: white.record.MAPPING_BASIS,
    conflicts: white.record.CONFLICTS,
  };
}
