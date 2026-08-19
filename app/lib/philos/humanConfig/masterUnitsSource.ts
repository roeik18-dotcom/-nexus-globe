/**
 * Real Human Config source reader — MASTER_UNITS + its own audit sheets,
 * read LIVE from the real Dropbox master workbook, never copied into this
 * git repository.
 *
 * Explicitly authorized, read-only, this pass (see
 * PHILOS-PRODUCT-MASTER-LEDGER.md §23): reads
 * `קונפינג-אדם-MASTER-PRODUCTION-2.1-TAXONOMY-AUDITED-PROGRESS.xlsx` from
 * its real location. Path-resolution logic (highest MASTER-PRODUCTION
 * version) mirrors `voice-gateway/app/master_config.py::human_master_path()`
 * exactly — same directory, same version-picking rule — so this module
 * and the separate Merlin track never disagree about which file is
 * canonical. `voice-gateway/` itself is NOT imported, called, or modified
 * by this module; the logic is duplicated (a few lines) rather than
 * cross-track-coupled, per this session's standing track-isolation rule.
 *
 * Never writes to Dropbox. Never persists a copy of the workbook's content
 * into any file in this repository — cached in memory only (by mtime,
 * same discipline the Python reader uses), for the lifetime of the
 * server process. Server-only: imports `fs`/`path`, so Next.js will error
 * if this is ever imported from a Client Component.
 *
 * Column names below are the REAL header row of MASTER_UNITS, verified by
 * reading the file's own header at this pass's build time — not the
 * (slightly different) column names guessed in the ingestion request that
 * authorized this read. Never rewritten from what the source actually
 * says.
 */
import fs from "fs";
import path from "path";
import os from "os";
import ExcelJS from "exceljs";

const HUMAN_DIR = path.join(
  os.homedir(),
  "Library/CloudStorage/Dropbox/----text----/+אדם/קונפינג-אדם-מאגר-אב-שלד-היררכי",
);
const HUMAN_SHEET = "MASTER_UNITS";

export interface MasterUnitRecord {
  Source_ID: string;
  Document_ID: string;
  Section: string;
  Heading: string;
  Atomic_ID: string;
  Canonical_ID: string;
  Original_Text: string;
  Canonical_Text: string;
  Type: string;
  Domain: string;
  Tags: string;
  Keywords: string;
  Parent: string;
  Children: string;
  Supports: string;
  Contradicts: string;
  Expands: string;
  Prerequisite: string;
  Related: string;
  Duplicate_Group: string;
  Duplicate_Role: string;
  Canonical_Source: string;
  Confidence: string;
  Mapping_State: string;
  Status: string;
  Version: string;
  Source_Line_Start: string;
  Source_Line_End: string;
  Editor_Note: string;
  Validation_Note: string;
  Semantic_State: string;
  Resolution_Basis: string;
  Original_Text_SHA256: string;
}

const MASTER_UNITS_COLUMNS: (keyof MasterUnitRecord)[] = [
  "Source_ID", "Document_ID", "Section", "Heading", "Atomic_ID", "Canonical_ID",
  "Original_Text", "Canonical_Text", "Type", "Domain", "Tags", "Keywords",
  "Parent", "Children", "Supports", "Contradicts", "Expands", "Prerequisite",
  "Related", "Duplicate_Group", "Duplicate_Role", "Canonical_Source",
  "Confidence", "Mapping_State", "Status", "Version", "Source_Line_Start",
  "Source_Line_End", "Editor_Note", "Validation_Note", "Semantic_State",
  "Resolution_Basis", "Original_Text_SHA256",
];

export interface ReviewQueueRecord {
  Atomic_ID: string;
  Source_ID: string;
  Original_Text: string;
  Heading: string;
  Reason_Open: string;
}

export interface CollisionAuditRecord {
  Heading_ID: string;
  Exact_Text: string;
  Cluster: string;
  Taxonomy_Neighbors: string;
  Verdict: string;
}

export interface CoverageMetric {
  Check: string;
  Value: string;
}

export interface HumanConfigSource {
  /** Absolute path of the exact workbook version actually read — surfaced
   *  in the UI's provenance line, never hidden. */
  sourceFilePath: string;
  sourceFileName: string;
  units: MasterUnitRecord[];
  reviewQueue: ReviewQueueRecord[];
  collisionAudit: CollisionAuditRecord[];
  coverage: CoverageMetric[];
}

/** The exact file explicitly authorized this pass (see
 *  PHILOS-PRODUCT-MASTER-LEDGER.md §23) — used first, deterministically.
 *  `human_master_path()`'s own "highest MASTER-PRODUCTION version" rule is
 *  genuinely ambiguous when two files share a version number with
 *  different suffixes (real case in this directory:
 *  `2.1-FINAL-OPEN-PASS.xlsx` vs `2.1-TAXONOMY-AUDITED-PROGRESS.xlsx` —
 *  directory-iteration order, not a real ordering rule, would pick between
 *  them). Named-file-first avoids depending on that ambiguity; the
 *  version-scan below is kept only as a fallback if this exact file is
 *  ever renamed/moved. */
const AUTHORIZED_HUMAN_MASTER_FILENAME = "קונפינג-אדם-MASTER-PRODUCTION-2.1-TAXONOMY-AUDITED-PROGRESS.xlsx";

function resolveHumanMasterPath(): string | null {
  if (!fs.existsSync(HUMAN_DIR)) return null;
  const authorizedPath = path.join(HUMAN_DIR, AUTHORIZED_HUMAN_MASTER_FILENAME);
  if (fs.existsSync(authorizedPath)) return authorizedPath;

  // Fallback: highest-version MASTER-PRODUCTION xlsx (same rule as
  // `human_master_path()` in the Python reader) — only reached if the
  // authorized file above is missing.
  let best: { ver: [number, number]; file: string } | null = null;
  for (const f of fs.readdirSync(HUMAN_DIR)) {
    const n = f.normalize("NFC");
    if (!n.includes("MASTER-PRODUCTION") || !f.endsWith(".xlsx") || f.startsWith("~$")) continue;
    const m = n.match(/MASTER-PRODUCTION-(\d+)\.(\d+)/);
    if (!m) continue;
    const ver: [number, number] = [Number(m[1]), Number(m[2])];
    if (!best || ver[0] > best.ver[0] || (ver[0] === best.ver[0] && ver[1] > best.ver[1])) {
      best = { ver, file: path.join(HUMAN_DIR, f) };
    }
  }
  return best ? best.file : null;
}

function cellText(v: ExcelJS.CellValue): string {
  if (v === null || v === undefined) return "";
  if (typeof v === "object" && "richText" in v) return (v as ExcelJS.CellRichTextValue).richText.map((r) => r.text).join("");
  if (typeof v === "object" && "text" in v) return String((v as { text: unknown }).text ?? "");
  return String(v);
}

function readSheetAsObjects<T>(
  ws: ExcelJS.Worksheet | undefined,
  columns: readonly (keyof T & string)[],
): T[] {
  if (!ws) return [];
  const out: T[] = [];
  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // header
    const values = row.values as ExcelJS.CellValue[]; // 1-indexed, [0] unused
    const rec = {} as Record<keyof T & string, string>;
    columns.forEach((col, i) => {
      rec[col] = cellText(values[i + 1]);
    });
    out.push(rec as T);
  });
  return out;
}

let cached: { mtimeMs: number; data: HumanConfigSource } | null = null;

/** The one entry point every caller uses. In-memory cache only, keyed by
 *  the resolved file's own mtime — never a copy on disk in this repo. */
export async function loadHumanConfigSource(): Promise<HumanConfigSource | null> {
  const filePath = resolveHumanMasterPath();
  if (!filePath) return null;
  const stat = fs.statSync(filePath);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.data;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const units = readSheetAsObjects<MasterUnitRecord>(wb.getWorksheet(HUMAN_SHEET), MASTER_UNITS_COLUMNS);
  const reviewQueue = readSheetAsObjects<ReviewQueueRecord>(
    wb.getWorksheet("SEMANTIC_REVIEW_QUEUE"),
    ["Atomic_ID", "Source_ID", "Original_Text", "Heading", "Reason_Open"],
  );
  const collisionAudit = readSheetAsObjects<CollisionAuditRecord>(
    wb.getWorksheet("TAXONOMY_COLLISION_AUDIT"),
    ["Heading_ID", "Exact_Text", "Cluster", "Taxonomy_Neighbors", "Verdict"],
  );
  const coverage = readSheetAsObjects<CoverageMetric>(wb.getWorksheet("COVERAGE"), ["Check", "Value"]);

  const data: HumanConfigSource = {
    sourceFilePath: filePath,
    sourceFileName: path.basename(filePath),
    units,
    reviewQueue,
    collisionAudit,
    coverage,
  };
  cached = { mtimeMs: stat.mtimeMs, data };
  return data;
}
