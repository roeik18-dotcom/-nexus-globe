/**
 * PHILOS Knowledge — source file discovery. Accepts a real directory on
 * disk and reports what real files are in it — never invents a file list,
 * never assumes a corpus exists when the directory is empty or missing.
 *
 * This is discovery only: it does not read file CONTENT (see
 * `parseSource.ts`) and does not register anything (see `sourceRegistry.ts`)
 * — kept separate so each step is independently testable and none silently
 * does another step's job.
 */
import { readdirSync, statSync } from "node:fs";
import { extname, join } from "node:path";

import type { SourceType } from "./sourceRegistry";

/** Extensions this boundary can DISCOVER. Parsing (turning bytes into text)
 *  is currently only implemented for a subset — see `parseSource.ts`'s
 *  `SUPPORTED_PARSE_EXTENSIONS`. A discovered `.pdf`/`.docx` is real and
 *  reportable, just not yet parseable; that gap is stated, not hidden. */
const EXTENSION_TO_TYPE: Record<string, SourceType> = {
  ".md": "markdown",
  ".markdown": "markdown",
  ".txt": "text",
  ".json": "json",
  ".pdf": "pdf",
  ".docx": "docx",
};

/** Directories never worth walking into, even if a corpus root happens to
 *  contain them — real filesystem hazards, not a content judgment. */
const SKIP_DIRS = new Set(["node_modules", ".git", ".next", "dist", "build"]);

export interface DiscoveredFile {
  path: string;
  source_type: SourceType;
  size_bytes: number;
}

export interface DiscoverSourcesResult {
  root_exists: boolean;
  files: DiscoveredFile[];
  /** Present only when `root_exists` is false — states the real reason,
   *  never silently returns an empty list indistinguishable from "checked,
   *  found nothing". */
  reason?: string;
}

function walk(dir: string, out: DiscoveredFile[]): void {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    const ext = extname(entry.name).toLowerCase();
    const sourceType = EXTENSION_TO_TYPE[ext] ?? "other";
    const size = statSync(fullPath).size;
    out.push({ path: fullPath, source_type: sourceType, size_bytes: size });
  }
}

/**
 * Real, synchronous filesystem walk (mirrors the rest of this codebase's
 * `readFileSync`/`existsSync` style store code — no hidden async queue).
 * A missing root directory is reported honestly, not silently swallowed
 * into an empty result that would look identical to "an empty real corpus".
 */
export function discoverSourceFiles(rootDir: string): DiscoverSourcesResult {
  let rootStat;
  try {
    rootStat = statSync(rootDir);
  } catch {
    return { root_exists: false, files: [], reason: `${rootDir} does not exist` };
  }
  if (!rootStat.isDirectory()) {
    return { root_exists: false, files: [], reason: `${rootDir} exists but is not a directory` };
  }
  const files: DiscoveredFile[] = [];
  walk(rootDir, files);
  return { root_exists: true, files };
}
