/**
 * Need↔Value-Group declaration store. Mirrors `personCommunityLinkStore.ts`
 * exactly in shape — append-only, reject a duplicate id rather than silently
 * ignoring it, a pure `check` gate separate from the store class, JSONL
 * persistence in its OWN file (`need-group-links.jsonl`).
 *
 * Never mixed into `needs.jsonl`: this is a bridge fact about a Need, not a
 * canon Need, and canon §12's schema closure is only true on disk if the two
 * logs never share a byte.
 *
 * Append-only, no edits: a correction is a NEW record with a later
 * `created_at`; `resolveNeedGroup` takes the last one.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type NeedGroupLink, type NeedGroupLinkError, validateNeedGroupLink } from "./needGroupLink";

export const NEED_GROUP_LINK_STORE_FILENAME = "need-group-links.jsonl";

export const NEED_GROUP_LINK_REJECTION_CODES = [
  "empty_append",
  "duplicate_link_id",
  "link_id_already_stored",
  "invalid_link",
] as const;

export type NeedGroupLinkRejectionCode = (typeof NEED_GROUP_LINK_REJECTION_CODES)[number];

export interface NeedGroupLinkRejection {
  code: NeedGroupLinkRejectionCode;
  link_id?: string;
  message: string;
  errors?: NeedGroupLinkError[];
}

export type NeedGroupLinkAppendCheck = { ok: true } | { ok: false; rejections: NeedGroupLinkRejection[] };

/** Pure and total: never throws, never mutates its arguments. */
export function checkNeedGroupLinkAppend(
  stored: readonly NeedGroupLink[],
  incoming: readonly NeedGroupLink[],
): NeedGroupLinkAppendCheck {
  const rejections: NeedGroupLinkRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one NeedGroupLink record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.link_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.link_id;
    if (id !== undefined && storedIds.has(id)) {
      rejections.push({ code: "link_id_already_stored", link_id: id, message: `${id} is already in the log; append-only, a correction is a new record` });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_link_id", link_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    const validation = validateNeedGroupLink(r as NeedGroupLink);
    if (!validation.valid) {
      rejections.push({ code: "invalid_link", link_id: id, message: "NeedGroupLink failed structural validation", errors: validation.errors });
    }
  }
  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class NeedGroupLinkRejectedError extends Error {
  readonly rejections: readonly NeedGroupLinkRejection[];
  constructor(rejections: readonly NeedGroupLinkRejection[]) {
    super(`NeedGroupLink append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "NeedGroupLinkRejectedError";
    this.rejections = rejections;
  }
}

export interface NeedGroupLinkStore {
  load(): Promise<NeedGroupLink[]>;
  append(records: readonly NeedGroupLink[]): Promise<NeedGroupLink[]>;
}

/** Deterministic order: `created_at` ascending, tie-broken by `link_id`. */
export function inNeedGroupLinkOrder(records: readonly NeedGroupLink[]): NeedGroupLink[] {
  return [...records].sort((a, b) =>
    a.created_at === b.created_at ? a.link_id.localeCompare(b.link_id) : a.created_at.localeCompare(b.created_at),
  );
}

export class InMemoryNeedGroupLinkStore implements NeedGroupLinkStore {
  private records: NeedGroupLink[];
  constructor(bootstrap: readonly NeedGroupLink[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<NeedGroupLink[]> {
    return inNeedGroupLinkOrder(this.records);
  }
  async append(incoming: readonly NeedGroupLink[]): Promise<NeedGroupLink[]> {
    const check = checkNeedGroupLinkAppend(this.records, incoming);
    if (!check.ok) throw new NeedGroupLinkRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class NeedGroupLinkLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable NeedGroupLink record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "NeedGroupLinkLogCorruptError";
    this.line_number = lineNumber;
  }
}

export class FileSystemNeedGroupLinkStore implements NeedGroupLinkStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, NEED_GROUP_LINK_STORE_FILENAME);
  }

  private readStored(): NeedGroupLink[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: NeedGroupLink[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as NeedGroupLink);
      } catch {
        throw new NeedGroupLinkLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<NeedGroupLink[]> {
    return inNeedGroupLinkOrder(this.readStored());
  }

  async append(incoming: readonly NeedGroupLink[]): Promise<NeedGroupLink[]> {
    const stored = this.readStored();
    const check = checkNeedGroupLinkAppend(stored, incoming);
    if (!check.ok) throw new NeedGroupLinkRejectedError(check.rejections);
    appendFileSync(this.filePath, incoming.map((r) => JSON.stringify(r)).join("\n") + "\n", "utf-8");
    return [...incoming];
  }
}
