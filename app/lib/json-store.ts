/**
 * Shared JSON file-store utilities
 *
 * Used by every JsonXxxRepository in the PUDM chain.
 * Not suitable for: concurrent writes, production traffic, large datasets.
 * To migrate a repository to PostgreSQL: implement the repository interface
 * with a Prisma adapter and drop the import of this module.
 */

import fs from "fs";
import path from "path";

// ─── File I/O ─────────────────────────────────────────────────────────────────

/**
 * Read a JSON array from `filePath`. Returns [] if the file does not exist
 * or is empty. Throws a descriptive error if the file exists but is not
 * valid JSON or does not contain an array.
 */
export function readJsonStore<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, "utf-8").trim();
  } catch (e: unknown) {
    const code = (e as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return [];
    throw e;
  }
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`[json-store] ${filePath} contains invalid JSON`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`[json-store] ${filePath} must contain a JSON array, got ${typeof parsed}`);
  }
  return parsed as T[];
}

/**
 * Write a JSON array to `filePath`. Creates parent directories if needed.
 * Uses a temp-file + rename for atomic replacement so a crash during write
 * cannot leave the file truncated.
 */
export function writeJsonStore<T>(filePath: string, records: T[]): void {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = `${filePath}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(records, null, 2) + "\n", "utf-8");
  fs.renameSync(tmp, filePath);
}

// ─── ID and timestamp ─────────────────────────────────────────────────────────

/** Generate a unique record id with a given prefix (e.g. "gap", "value"). */
export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Current UTC timestamp as ISO 8601. */
export function nowIso(): string {
  return new Date().toISOString();
}

// ─── Pagination ───────────────────────────────────────────────────────────────

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 1000;

/**
 * Apply offset + limit to a result set, sorted stably by createdAt then id.
 * Enforces a maximum page size so callers cannot force the entire store into
 * a single response.
 */
export function paginate<T extends { createdAt: string; id: string }>(
  records: T[],
  offset = 0,
  limit = DEFAULT_LIMIT
): T[] {
  const capped = Math.min(limit, MAX_LIMIT);
  const sorted = [...records].sort((a, b) =>
    a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : a.id < b.id ? -1 : 1
  );
  return sorted.slice(offset, offset + capped);
}
