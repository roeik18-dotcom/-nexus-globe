/**
 * PHILOS Knowledge — SourceRegistry: the ingestion BOUNDARY only (per the
 * "STOP. Do NOT use Nexus/Force ontology as a substitute corpus" correction).
 *
 * This module does NOT contain the real PHILOS/HUMAN theory corpus — that
 * corpus is external to this repository and has not been supplied yet
 * (`PHILOS-PRODUCT-MASTER-LEDGER.md::ORIGINAL_PHILOS_CORPUS`). What this file
 * provides is the plumbing that will let a real corpus be added later AS
 * FILES/DIRECTORIES, without hand-writing its contents into code: a
 * source-level record (never a claim/concept-level one — that is Step 2,
 * explicitly deferred), a real SHA-256 content hash (not a guessed id), and
 * an honest status vocabulary so a registered file can be marked
 * `REVIEW_REQUIRED`/`CONTRADICTORY` rather than silently promoted to
 * `CANONICAL`.
 *
 * **Architecture, mirrored from `needStore.ts` on purpose** (same append-
 * only JSONL store, same pure `checkX` gate separate from the store class,
 * same `InMemory`/`FileSystem` dual implementation, same "corruption is
 * loud" `LogCorruptError`) — this codebase already has one proven pattern
 * for "a real append-only registry with a pure validation gate"; reusing it
 * here is not inventing a second architecture, it's applying the first one
 * to a new, clearly separate kind of record.
 *
 * **Separate data directory from canon.** `SourceRecord` is knowledge-layer
 * metadata about a document, never a canon `Observation` — mixing the two
 * stores would blur "what PHILOS knows about concepts" with "what PHILOS
 * observed about a person" (the `KNOWLEDGE GRAPH` vs `LIVE STATE GRAPH`
 * distinction from this pass's own brief). See `sourceRegistryAccessor.ts`.
 *
 * **Origin is a real, load-bearing field.** `internal_repo` sources (already
 * present in this repository — e.g. `docs/philos-research-questions.md`,
 * `app/lib/ontology.ts`) are real and registrable today. `external_corpus`
 * sources are the ones this boundary exists to receive once supplied — this
 * file registers none of those, because none exist here to register.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

import { parseOffsetInstant } from "../canon/observation";

export type SourceType = "markdown" | "text" | "json" | "pdf" | "docx" | "other";

/**
 * Per this pass's explicit instruction: never silently promote a registered
 * file to `CANONICAL`. Everything starts at `RAW_SOURCE` unless the caller
 * states otherwise with a reason (`review_note`).
 */
export const SOURCE_STATUSES = [
  "RAW_SOURCE",
  "EXTRACTED",
  "REVIEW_REQUIRED",
  "CANONICAL",
  "EXTERNAL_REFERENCE",
  "HISTORICAL",
  "SUPERSEDED",
  "CONTRADICTORY",
] as const;
export type SourceStatus = (typeof SOURCE_STATUSES)[number];

/** Where a source came from — real, not inferred from content. */
export type SourceOrigin = "internal_repo" | "external_corpus";

export interface SourceRecord {
  /** Deterministic — derived from `content_hash`, never a free-choice id. */
  source_id: string;
  source_title: string;
  /** Real filesystem path (repo-relative or absolute) — never invented. */
  source_path: string;
  source_type: SourceType;
  /** Free-text grouping the CALLER supplies (e.g. "philos-theory",
   *  "human-model", "merlin-profile") — never inferred from content by this
   *  module, which does no classification. */
  domain?: string;
  origin: SourceOrigin;
  status: SourceStatus;
  /** ISO 8601 with an explicit offset — same discipline as canon's `time`/`expiry`. */
  ingested_at: string;
  /** SHA-256 of the raw file content — real, computed, never guessed. */
  content_hash: string;
  size_bytes: number;
  /** Required whenever `status` is `REVIEW_REQUIRED`/`CONTRADICTORY`/`SUPERSEDED` — why. */
  review_note?: string;
}

/** Real, deterministic — same content always hashes to the same value. */
export function computeContentHash(content: string): string {
  return createHash("sha256").update(content, "utf-8").digest("hex");
}

/** Deterministic, derived from the hash — two registrations of the same
 *  bytes always produce the same id, which is what makes dedup possible. */
export function deriveSourceId(contentHash: string): string {
  return `src_${contentHash.slice(0, 16)}`;
}

export const SOURCE_REGISTER_REJECTION_CODES = [
  "empty_append",
  "duplicate_content_hash",
  "duplicate_in_batch",
  "empty_source_path",
  "empty_source_title",
  "ambiguous_ingested_at",
  "review_note_required",
] as const;
export type SourceRegisterRejectionCode = (typeof SOURCE_REGISTER_REJECTION_CODES)[number];

export interface SourceRegisterRejection {
  code: SourceRegisterRejectionCode;
  source_id?: string;
  message: string;
}

export type SourceRegisterCheck = { ok: true } | { ok: false; rejections: SourceRegisterRejection[] };

const STATUS_REQUIRES_NOTE: ReadonlySet<SourceStatus> = new Set(["REVIEW_REQUIRED", "CONTRADICTORY", "SUPERSEDED"]);

/**
 * Pure and total: never throws. Dedup is by CONTENT HASH, not path or
 * title — the same document registered from two paths (or re-registered
 * unchanged) is caught; a genuinely edited document (different hash) is a
 * new record, mirroring the append-only "a correction is a new record"
 * discipline `checkNeedAppend`/`checkCanonAppend` already apply.
 */
export function checkSourceRegister(
  stored: readonly SourceRecord[],
  incoming: readonly SourceRecord[],
): SourceRegisterCheck {
  const rejections: SourceRegisterRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "a register call must carry at least one SourceRecord" }] };
  }

  const storedHashes = new Set(stored.map((r) => r.content_hash));
  const seen = new Set<string>();

  for (const r of incoming) {
    if (storedHashes.has(r.content_hash)) {
      rejections.push({
        code: "duplicate_content_hash",
        source_id: r.source_id,
        message: `content hash ${r.content_hash.slice(0, 12)}… is already registered — the same bytes exist under an earlier source_id; re-registering unchanged content is not a new source`,
      });
    }
    if (seen.has(r.content_hash)) {
      rejections.push({ code: "duplicate_in_batch", source_id: r.source_id, message: "this content hash appears twice in the same register call" });
    }
    seen.add(r.content_hash);

    if (!r.source_path || r.source_path.trim() === "") {
      rejections.push({ code: "empty_source_path", source_id: r.source_id, message: "source_path is required — a source must point at a real file" });
    }
    if (!r.source_title || r.source_title.trim() === "") {
      rejections.push({ code: "empty_source_title", source_id: r.source_id, message: "source_title is required" });
    }
    if (parseOffsetInstant(r.ingested_at) === null) {
      rejections.push({ code: "ambiguous_ingested_at", source_id: r.source_id, message: `ingested_at "${r.ingested_at}" is unparseable or lacks an explicit timezone offset` });
    }
    if (STATUS_REQUIRES_NOTE.has(r.status) && (!r.review_note || r.review_note.trim() === "")) {
      rejections.push({ code: "review_note_required", source_id: r.source_id, message: `status "${r.status}" requires a review_note explaining why` });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class SourceRegisterRejectedError extends Error {
  readonly rejections: readonly SourceRegisterRejection[];
  constructor(rejections: readonly SourceRegisterRejection[]) {
    super(`Source register rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "SourceRegisterRejectedError";
    this.rejections = rejections;
  }
}

export interface SourceRegistryStore {
  load(): Promise<SourceRecord[]>;
  register(records: readonly SourceRecord[]): Promise<SourceRecord[]>;
}

/** Deterministic order: `ingested_at` ascending, tie-broken by `source_id`. */
export function inSourceOrder(records: readonly SourceRecord[]): SourceRecord[] {
  return [...records].sort((a, b) =>
    a.ingested_at === b.ingested_at ? a.source_id.localeCompare(b.source_id) : a.ingested_at.localeCompare(b.ingested_at),
  );
}

export class InMemorySourceRegistryStore implements SourceRegistryStore {
  private records: SourceRecord[];
  constructor(bootstrap: readonly SourceRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<SourceRecord[]> {
    return inSourceOrder(this.records);
  }
  async register(incoming: readonly SourceRecord[]): Promise<SourceRecord[]> {
    const check = checkSourceRegister(this.records, incoming);
    if (!check.ok) throw new SourceRegisterRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class SourceLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable SourceRecord on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "SourceLogCorruptError";
    this.line_number = lineNumber;
  }
}

export const SOURCE_REGISTRY_FILENAME = "sources.jsonl";

export class FileSystemSourceRegistryStore implements SourceRegistryStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, SOURCE_REGISTRY_FILENAME);
  }

  private readStored(): SourceRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: SourceRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as SourceRecord);
      } catch {
        throw new SourceLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<SourceRecord[]> {
    return inSourceOrder(this.readStored());
  }

  async register(incoming: readonly SourceRecord[]): Promise<SourceRecord[]> {
    const check = checkSourceRegister(this.readStored(), incoming);
    if (!check.ok) throw new SourceRegisterRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
