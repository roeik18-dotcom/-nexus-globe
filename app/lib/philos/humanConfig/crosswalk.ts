/**
 * HUMAN CONFIG CROSSWALK — the bridge between two authorities that must
 * NOT be merged.
 *
 * ── The two authorities, and why neither wins ──────────────────────────
 *
 *   SOURCE LOCK v1.0 (189 rows, `canonical/data/human.master.json`)
 *     RUNTIME GOVERNANCE / ELIGIBILITY. Classifies each row by what the
 *     runtime may do with it (`TYPE` × `RUNTIME_STATUS`): which rows are
 *     activatable, which are theory, which are gaps. This is the authority
 *     every one of the seven surfaces actually consumes today.
 *
 *   PRODUCTION 2.1 (1492 rows, the live Dropbox workbook)
 *     SEMANTIC / SOURCE CORPUS. Classifies each atomic unit by its
 *     rhetorical form (אקסיומה/אפוריזם, טענה/עיקרון, מנגנון …) and carries
 *     the actual source text, hierarchy and provenance.
 *
 * **RATIFIED 2026-08-19 as a dual-authority model** — see
 * `PHILOS-SOURCE-AUTHORITY-CONTRACT.md` at the repo root. Neither
 * supersedes the other; this crosswalk IS the permanent bridge, and the
 * measured gaps (59 MISSING_IN_2_1, 543 SOURCE_ONLY, 2 runtime-active rows
 * with no corpus counterpart) stay explicit rather than reconciled.
 *
 * They measure ORTHOGONAL axes over largely the same underlying corpus.
 * "Which one is correct" is not a well-formed question, and picking a
 * winner would destroy real information either way: dropping the Source
 * Lock loses runtime eligibility, dropping 2.1 loses the source itself.
 *
 * ── What this module is, and what it refuses to do ─────────────────────
 *
 * A pure, READ-ONLY projection. It joins the two by NORMALIZED HEADING —
 * the one key both actually share — and reports the relationship per row.
 * It has no store, writes nothing, and is total over its inputs.
 *
 * **No Production row becomes runtime-active merely because it exists.**
 * The strongest verdict this module can assign a 2.1 unit is
 * `RUNTIME_CANDIDATE`, and that word is doing real work: it means "this
 * unit's heading is governed by a Source Lock row that IS runtime-active",
 * which is a statement about the HEADING's eligibility, never a promotion
 * of the unit. Activation stays exactly where it is — `activeConfig.ts`'s
 * mechanical fold over the Source Lock's own TYPE/RUNTIME_STATUS fields.
 * Nothing here calls it, and nothing here can widen it.
 *
 * Provenance is preserved on every row: each side keeps its own id
 * (`SOURCE_NUMBER` / `Canonical_ID`), its own classification word, and its
 * own source file. Nothing is relabelled into the other's vocabulary.
 */

/** The Source Lock fields this crosswalk needs. Structural subset — the
 *  real loader returns more, and this module never asks for SOURCE_TEXT. */
export interface CrosswalkLockRow {
  SOURCE_NUMBER: string | number;
  SOURCE_HEADING: string;
  SOURCE_SECTION: string;
  SOURCE_FILE: string;
  TYPE: string;
  RUNTIME_STATUS: string;
}

/** The Production 2.1 fields this crosswalk needs. */
export interface CrosswalkUnitRow {
  Canonical_ID: string;
  Heading: string;
  Section: string;
  Type: string;
  /** The workbook's own review/mapping state, verbatim when present. */
  Semantic_State?: string;
  Mapping_State?: string;
  Status?: string;
}

export type LockVerdict =
  | "EXACT_MATCH"
  | "SEMANTIC_MATCH"
  | "EXPANDED"
  | "RENAMED"
  | "SPLIT"
  | "MERGED"
  | "MISSING_IN_2_1"
  | "CONFLICT";

export type UnitVerdict =
  | "LINKED_TO_RUNTIME_GOVERNANCE"
  | "SOURCE_ONLY"
  | "RUNTIME_CANDIDATE"
  | "REVIEW_REQUIRED"
  | "UNRESOLVED";

export interface LockCrosswalkRow {
  source_number: string;
  heading: string;
  section: string;
  source_file: string;
  lock_type: string;
  runtime_status: string;
  /** True iff `activeConfig.ts`'s rule would activate this row. Mirrored
   *  here, never re-derived loosely — see `RUNTIME_ACTIVE_LOCK_TYPES`. */
  runtime_active: boolean;
  verdict: LockVerdict;
  /** Canonical_IDs of the 2.1 units sharing this normalized heading. */
  matched_unit_ids: string[];
  /** Why this verdict — stated, never implied. */
  basis: string;
}

export interface UnitCrosswalkRow {
  canonical_id: string;
  heading: string;
  section: string;
  unit_type: string;
  verdict: UnitVerdict;
  /** SOURCE_NUMBERs of the Source Lock rows sharing this heading. */
  matched_lock_ids: string[];
  basis: string;
}

export interface HumanConfigCrosswalk {
  lock_rows: LockCrosswalkRow[];
  unit_rows: UnitCrosswalkRow[];
  summary: {
    lock_total: number;
    unit_total: number;
    lock_by_verdict: Record<string, number>;
    unit_by_verdict: Record<string, number>;
    /** Distinct normalized headings on each side, and their intersection. */
    lock_headings: number;
    unit_headings: number;
    shared_headings: number;
    heading_coverage_pct: number;
  };
}

/** The Source Lock TYPEs `activeConfig.ts` activates. Duplicated as a
 *  literal (not imported) ONLY to keep this module free of a runtime
 *  dependency on the activation path — the test asserts the two agree, so
 *  they cannot drift silently. */
export const RUNTIME_ACTIVE_LOCK_TYPES = ["STATIC_ATTRIBUTE", "SCALE", "DYNAMIC_PARAMETER"] as const;

/**
 * Heading normalization — the join key.
 *
 * Deliberately conservative: case/whitespace folding, Hebrew niqqud and
 * bidi marks stripped, and the punctuation both sources sprinkle
 * inconsistently around headings removed. It does NOT stem, translate, or
 * fuzzy-match; two headings join only when they are the same string once
 * that noise is gone. A looser key would manufacture matches, which is
 * exactly the failure this crosswalk exists to avoid.
 */
export function normalizeHeading(raw: unknown): string {
  return String(raw ?? "")
    .normalize("NFKC")
    .replace(/[֑-ׇ]/g, "")      // Hebrew niqqud / cantillation
    .replace(/[‎‏‪-‮]/g, "") // bidi controls
    .replace(/[\s ]+/g, "")
    .replace(/["'`׳״.,:;()[\]{}—–\-_/\\|!?*]+/g, "")
    .toLowerCase()
    .trim();
}

function isRuntimeActive(row: CrosswalkLockRow): boolean {
  return (
    (RUNTIME_ACTIVE_LOCK_TYPES as readonly string[]).includes(row.TYPE) &&
    row.RUNTIME_STATUS !== "NOT_FOR_RUNTIME"
  );
}

function unitNeedsReview(u: CrosswalkUnitRow): boolean {
  const fields = [u.Semantic_State, u.Mapping_State, u.Status].map((v) => String(v ?? "").toUpperCase());
  return fields.some((v) => v.includes("REVIEW") || v.includes("OPEN") || v.includes("UNRESOLVED"));
}

/**
 * The one crosswalk derivation. Pure — no I/O, no clock, no store. Given
 * the same two inputs it returns the same output.
 */
export function buildHumanConfigCrosswalk(params: {
  lockRows: readonly CrosswalkLockRow[];
  unitRows: readonly CrosswalkUnitRow[];
}): HumanConfigCrosswalk {
  const { lockRows, unitRows } = params;

  // Index both sides by normalized heading.
  const unitsByHeading = new Map<string, CrosswalkUnitRow[]>();
  for (const u of unitRows) {
    const h = normalizeHeading(u.Heading);
    if (!h) continue;
    const list = unitsByHeading.get(h) ?? [];
    list.push(u);
    unitsByHeading.set(h, list);
  }
  const locksByHeading = new Map<string, CrosswalkLockRow[]>();
  for (const l of lockRows) {
    const h = normalizeHeading(l.SOURCE_HEADING);
    if (!h) continue;
    const list = locksByHeading.get(h) ?? [];
    list.push(l);
    locksByHeading.set(h, list);
  }

  // ── Source Lock side ────────────────────────────────────────────────
  const lock_rows: LockCrosswalkRow[] = lockRows.map((l) => {
    const h = normalizeHeading(l.SOURCE_HEADING);
    const units = h ? unitsByHeading.get(h) ?? [] : [];
    const siblings = h ? locksByHeading.get(h) ?? [] : [];
    const active = isRuntimeActive(l);

    let verdict: LockVerdict;
    let basis: string;

    if (!h) {
      verdict = "UNRESOLVED" as LockVerdict extends string ? LockVerdict : never;
      // `UNRESOLVED` is not in LockVerdict; an empty heading is a CONFLICT
      // between the row existing and having nothing to join on.
      verdict = "CONFLICT";
      basis = "Source Lock row carries no SOURCE_HEADING — nothing to join on";
    } else if (units.length === 0) {
      verdict = "MISSING_IN_2_1";
      basis = "no Production 2.1 unit shares this normalized heading";
    } else if (siblings.length > 1) {
      verdict = "MERGED";
      basis = `${siblings.length} Source Lock rows share this heading — the lock collapses what 2.1 keeps separate (${units.length} units)`;
    } else if (units.length === 1) {
      verdict = String(units[0].Heading).trim() === String(l.SOURCE_HEADING).trim() ? "EXACT_MATCH" : "RENAMED";
      basis = verdict === "EXACT_MATCH"
        ? "one 2.1 unit, heading identical character-for-character"
        : "one 2.1 unit, headings differ only by normalization (punctuation/whitespace/niqqud)";
    } else if (units.length <= 5) {
      verdict = "SPLIT";
      basis = `${units.length} 2.1 units share this heading — 2.1 atomizes what the lock holds as one row`;
    } else {
      verdict = "EXPANDED";
      basis = `${units.length} 2.1 units share this heading — substantially elaborated in the corpus`;
    }

    // SEMANTIC_MATCH is reserved for a heading that joins while the two
    // sides disagree on Section — same subject, different placement.
    if ((verdict === "EXACT_MATCH" || verdict === "RENAMED") && units.length === 1) {
      const sameSection = normalizeHeading(units[0].Section) === normalizeHeading(l.SOURCE_SECTION);
      if (!sameSection) {
        verdict = "SEMANTIC_MATCH";
        basis = "heading joins but the two authorities file it under different Sections — same subject, different placement";
      }
    }

    return {
      source_number: String(l.SOURCE_NUMBER),
      heading: String(l.SOURCE_HEADING),
      section: String(l.SOURCE_SECTION),
      source_file: String(l.SOURCE_FILE),
      lock_type: l.TYPE,
      runtime_status: l.RUNTIME_STATUS,
      runtime_active: active,
      verdict,
      matched_unit_ids: units.map((u) => u.Canonical_ID),
      basis,
    };
  });

  // ── Production 2.1 side ─────────────────────────────────────────────
  const unit_rows: UnitCrosswalkRow[] = unitRows.map((u) => {
    const h = normalizeHeading(u.Heading);
    const locks = h ? locksByHeading.get(h) ?? [] : [];
    const activeLocks = locks.filter(isRuntimeActive);

    let verdict: UnitVerdict;
    let basis: string;

    if (!h) {
      verdict = "UNRESOLVED";
      basis = "unit carries no Heading — nothing to join on";
    } else if (unitNeedsReview(u)) {
      verdict = "REVIEW_REQUIRED";
      basis = "the workbook's own Semantic_State/Mapping_State/Status marks this unit for review — not eligible until resolved there";
    } else if (locks.length === 0) {
      verdict = "SOURCE_ONLY";
      basis = "no Source Lock row governs this heading — corpus material with no runtime governance";
    } else if (activeLocks.length > 0) {
      verdict = "RUNTIME_CANDIDATE";
      basis = `heading is governed by ${activeLocks.length} runtime-active Source Lock row(s) — CANDIDATE only: eligibility belongs to the heading, and activation stays with activeConfig.ts. This unit is NOT runtime-active.`;
    } else {
      verdict = "LINKED_TO_RUNTIME_GOVERNANCE";
      basis = `heading is governed by ${locks.length} Source Lock row(s), none runtime-active (theory/clinical/gap/review)`;
    }

    return {
      canonical_id: String(u.Canonical_ID),
      heading: String(u.Heading),
      section: String(u.Section),
      unit_type: String(u.Type),
      verdict,
      matched_lock_ids: locks.map((l) => String(l.SOURCE_NUMBER)),
      basis,
    };
  });

  const count = <T extends string>(rows: { verdict: T }[]): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const r of rows) out[r.verdict] = (out[r.verdict] ?? 0) + 1;
    return out;
  };

  const lockHeadings = new Set([...locksByHeading.keys()]);
  const unitHeadings = new Set([...unitsByHeading.keys()]);
  let shared = 0;
  for (const h of lockHeadings) if (unitHeadings.has(h)) shared += 1;

  return {
    lock_rows,
    unit_rows,
    summary: {
      lock_total: lockRows.length,
      unit_total: unitRows.length,
      lock_by_verdict: count(lock_rows),
      unit_by_verdict: count(unit_rows),
      lock_headings: lockHeadings.size,
      unit_headings: unitHeadings.size,
      shared_headings: shared,
      heading_coverage_pct: lockHeadings.size === 0 ? 0 : Math.round((shared / lockHeadings.size) * 1000) / 10,
    },
  };
}
