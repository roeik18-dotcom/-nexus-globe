/**
 * Person↔Community-Member Link store: real persistence for
 * `PersonCommunityLink` (`personCommunityLink.ts`). Mirrors
 * `canon/needStore.ts` exactly in shape (append-only; reject a duplicate
 * id, never silently ignore it; a pure `checkX` gate separate from the
 * store class; JSONL persistence) — its own file
 * (`person-community-links.jsonl`), never mixed into `canon-events.jsonl`
 * or `needs.jsonl`. This is a cross-system bridge fact (canon subject ↔
 * Value-Group viewer), not itself a canon Observation or Need, so it does
 * not belong in either of those logs — same reasoning `needStore.ts`'s own
 * header already applies one level up.
 *
 * Append-only, no edits: `declareSamePerson`/`confirmSamePerson`
 * (`personCommunityLink.ts`) each produce a NEW record; a correction is a
 * new record, never a mutation of one already stored — same discipline as
 * every other store in this codebase.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type PersonCommunityLink, type LinkError, validateLink } from "./personCommunityLink";

export const PERSON_COMMUNITY_LINK_STORE_FILENAME = "person-community-links.jsonl";

export const LINK_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_link_id",
  "link_id_already_stored",
  "invalid_link",
] as const;

export type LinkAppendRejectionCode = (typeof LINK_APPEND_REJECTION_CODES)[number];

export interface LinkAppendRejection {
  code: LinkAppendRejectionCode;
  link_id?: string;
  message: string;
  errors?: LinkError[];
}

export type LinkAppendCheck = { ok: true } | { ok: false; rejections: LinkAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments. */
export function checkLinkAppend(
  stored: readonly PersonCommunityLink[],
  incoming: readonly PersonCommunityLink[],
): LinkAppendCheck {
  const rejections: LinkAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one PersonCommunityLink record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.link_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.link_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({ code: "link_id_already_stored", link_id: id, message: `${id} is already in the link log; append-only, a correction is a new record` });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_link_id", link_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    const validation = validateLink(r as PersonCommunityLink);
    if (!validation.valid) {
      rejections.push({ code: "invalid_link", link_id: id, message: "PersonCommunityLink failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class LinkAppendRejectedError extends Error {
  readonly rejections: readonly LinkAppendRejection[];
  constructor(rejections: readonly LinkAppendRejection[]) {
    super(`PersonCommunityLink append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "LinkAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface PersonCommunityLinkStore {
  load(): Promise<PersonCommunityLink[]>;
  append(records: readonly PersonCommunityLink[]): Promise<PersonCommunityLink[]>;
}

/** Deterministic order: `created_at` ascending, tie-broken by `link_id`. */
export function inLinkOrder(records: readonly PersonCommunityLink[]): PersonCommunityLink[] {
  return [...records].sort((a, b) =>
    a.created_at === b.created_at ? a.link_id.localeCompare(b.link_id) : a.created_at.localeCompare(b.created_at),
  );
}

export class InMemoryPersonCommunityLinkStore implements PersonCommunityLinkStore {
  private records: PersonCommunityLink[];
  constructor(bootstrap: readonly PersonCommunityLink[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<PersonCommunityLink[]> {
    return inLinkOrder(this.records);
  }
  async append(incoming: readonly PersonCommunityLink[]): Promise<PersonCommunityLink[]> {
    const check = checkLinkAppend(this.records, incoming);
    if (!check.ok) throw new LinkAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class LinkLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable PersonCommunityLink record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "LinkLogCorruptError";
    this.line_number = lineNumber;
  }
}

export class FileSystemPersonCommunityLinkStore implements PersonCommunityLinkStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, PERSON_COMMUNITY_LINK_STORE_FILENAME);
  }

  private readStored(): PersonCommunityLink[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: PersonCommunityLink[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as PersonCommunityLink);
      } catch {
        throw new LinkLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<PersonCommunityLink[]> {
    return inLinkOrder(this.readStored());
  }

  async append(incoming: readonly PersonCommunityLink[]): Promise<PersonCommunityLink[]> {
    const check = checkLinkAppend(this.readStored(), incoming);
    if (!check.ok) throw new LinkAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
