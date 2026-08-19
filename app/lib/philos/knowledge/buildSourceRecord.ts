/**
 * PHILOS Knowledge — ties discovery + parsing + hashing into one real
 * `SourceRecord`, still with no I/O and no store write. The three prior
 * modules (`discoverSourceFiles`, `parseBySourceType`, `computeContentHash`)
 * stay independently testable; this is the pure composition the CALLER (a
 * future ingestion script, once a real corpus directory exists) would use
 * before handing records to `SourceRegistryStore.register`.
 *
 * `status` defaults to `"RAW_SOURCE"` — never `"CANONICAL"` — per this
 * pass's explicit instruction not to silently promote anything. A caller
 * MAY pass a different initial status (e.g. `"REVIEW_REQUIRED"` for a
 * legacy/contradictory source), but never gets `"CANONICAL"` as a default.
 */
import { basename, extname } from "node:path";

import { parseBySourceType } from "./parseSource";
import { computeContentHash, deriveSourceId, type SourceOrigin, type SourceRecord, type SourceStatus, type SourceType } from "./sourceRegistry";

export function buildSourceRecord(input: {
  path: string;
  source_type: SourceType;
  content: string;
  origin: SourceOrigin;
  ingested_at: string;
  domain?: string;
  status?: SourceStatus;
  review_note?: string;
}): SourceRecord {
  const contentHash = computeContentHash(input.content);
  const fallbackTitle = basename(input.path, extname(input.path));
  const parsed = parseBySourceType(input.source_type, input.content, fallbackTitle);
  const title = parsed?.title ?? fallbackTitle;

  return {
    source_id: deriveSourceId(contentHash),
    source_title: title,
    source_path: input.path,
    source_type: input.source_type,
    domain: input.domain,
    origin: input.origin,
    status: input.status ?? "RAW_SOURCE",
    ingested_at: input.ingested_at,
    content_hash: contentHash,
    size_bytes: Buffer.byteLength(input.content, "utf-8"),
    review_note: input.review_note,
  };
}
