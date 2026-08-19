/**
 * Philos Canon — OfferStore: real persistence for `Offer` (canon §11,
 * `./offer.ts`). Mirrors `needStore.ts` exactly in shape and reasoning —
 * `Offer` is real, canon-owned data (`offer.ts`, unmodified, imported not
 * reimplemented) but is not an Observation and not a Need, so it gets its
 * OWN file (`offers.jsonl`), its OWN store class, its OWN append-rejection
 * codes — never mixed into `canon-events.jsonl` or `needs.jsonl`.
 *
 * Built this pass (Marketplace Legacy Convergence) because REAL_SUPPLY
 * had no persistence mechanism at all — `resolveActionSpace.ts`'s own
 * prior header stated this plainly ("no persistence built for Offer
 * yet"). This closes that gap the same way `needStore.ts` already closed
 * it for Need — CREATE only, append-only, no transitions, matching
 * `Offer`'s own canon-stated "ephemeral / per-match" nature: a SECOND
 * record for an `offer_id` already stored is rejected, never silently
 * overwritten — an update is a new record.
 *
 * `offer.offer_id` is the real identity — no new id scheme, same
 * reasoning `needStore.ts` gives for `need.need_id`.
 *
 * Validation reuses `validateOffer` (`offer.ts`) verbatim — no parallel
 * Offer model.
 */
import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import { type Offer, type OfferError, validateOffer } from "./offer";
import { parseOffsetInstant } from "./observation";

export const OFFER_STORE_FILENAME = "offers.jsonl";

/** Wraps the real, unmodified `Offer` type. `recorded_at` is when this
 *  record was appended — distinct from any time Offer itself carries
 *  (Offer, notably, has no `time` field — see `offer.ts`'s own header). */
export interface OfferRecord {
  offer: Offer;
  recorded_at: string;
}

export const OFFER_APPEND_REJECTION_CODES = [
  "empty_append",
  "duplicate_offer_id",
  "offer_id_already_stored",
  "ambiguous_recorded_at",
  "invalid_offer",
] as const;

export type OfferAppendRejectionCode = (typeof OFFER_APPEND_REJECTION_CODES)[number];

export interface OfferAppendRejection {
  code: OfferAppendRejectionCode;
  offer_id?: string;
  message: string;
  errors?: OfferError[];
}

export type OfferAppendCheck = { ok: true } | { ok: false; rejections: OfferAppendRejection[] };

/** Pure and total: never throws, never mutates its arguments — same
 *  contract as `checkNeedAppend`. */
export function checkOfferAppend(
  stored: readonly OfferRecord[],
  incoming: readonly OfferRecord[],
): OfferAppendCheck {
  const rejections: OfferAppendRejection[] = [];

  if (incoming.length === 0) {
    return { ok: false, rejections: [{ code: "empty_append", message: "an append must carry at least one Offer record" }] };
  }

  const storedIds = new Set(stored.map((r) => r?.offer?.offer_id));
  const seen = new Set<string>();
  for (const r of incoming) {
    const id = r?.offer?.offer_id;

    if (id !== undefined && storedIds.has(id)) {
      rejections.push({
        code: "offer_id_already_stored",
        offer_id: id,
        message: `${id} is already in the offer log; the log is append-only — not yet supported by this store`,
      });
    }
    if (id !== undefined && seen.has(id)) {
      rejections.push({ code: "duplicate_offer_id", offer_id: id, message: `${id} appears twice in the same append` });
    }
    if (id !== undefined) seen.add(id);

    if (parseOffsetInstant(r?.recorded_at) === null) {
      rejections.push({
        code: "ambiguous_recorded_at",
        offer_id: id,
        message: `recorded_at "${String(r?.recorded_at)}" is unparseable or lacks an explicit timezone offset`,
      });
    }

    const validation = validateOffer(r?.offer as Offer);
    if (!validation.valid) {
      rejections.push({ code: "invalid_offer", offer_id: id, message: "Offer failed structural validation", errors: validation.errors });
    }
  }

  return rejections.length === 0 ? { ok: true } : { ok: false, rejections };
}

export class OfferAppendRejectedError extends Error {
  readonly rejections: readonly OfferAppendRejection[];
  constructor(rejections: readonly OfferAppendRejection[]) {
    super(`Offer append rejected: ${rejections.map((r) => r.message).join("; ")}`);
    this.name = "OfferAppendRejectedError";
    this.rejections = rejections;
  }
}

export interface OfferStore {
  load(): Promise<OfferRecord[]>;
  append(records: readonly OfferRecord[]): Promise<OfferRecord[]>;
}

/** Deterministic order: `recorded_at` ascending, tie-broken by `offer_id`. */
export function inOfferOrder(records: readonly OfferRecord[]): OfferRecord[] {
  return [...records].sort((a, b) =>
    a.recorded_at === b.recorded_at ? a.offer.offer_id.localeCompare(b.offer.offer_id) : a.recorded_at.localeCompare(b.recorded_at),
  );
}

export class InMemoryOfferStore implements OfferStore {
  private records: OfferRecord[];
  constructor(bootstrap: readonly OfferRecord[] = []) {
    this.records = [...bootstrap];
  }
  async load(): Promise<OfferRecord[]> {
    return inOfferOrder(this.records);
  }
  async append(incoming: readonly OfferRecord[]): Promise<OfferRecord[]> {
    const check = checkOfferAppend(this.records, incoming);
    if (!check.ok) throw new OfferAppendRejectedError(check.rejections);
    this.records = [...this.records, ...incoming];
    return [...incoming];
  }
}

export class OfferLogCorruptError extends Error {
  readonly line_number: number;
  constructor(lineNumber: number, filePath: string) {
    super(`unparseable Offer record on line ${lineNumber} of ${filePath}; refusing to read a partial log`);
    this.name = "OfferLogCorruptError";
    this.line_number = lineNumber;
  }
}

/** Durable, file-system-backed store — mirrors `FileSystemNeedStore`
 *  exactly in shape, at a DIFFERENT file (`offers.jsonl`) so the two logs
 *  never share a byte of storage. */
export class FileSystemOfferStore implements OfferStore {
  private readonly filePath: string;
  constructor(dataDir: string) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, OFFER_STORE_FILENAME);
  }

  private readStored(): OfferRecord[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const records: OfferRecord[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        records.push(JSON.parse(trimmed) as OfferRecord);
      } catch {
        throw new OfferLogCorruptError(i + 1, this.filePath);
      }
    });
    return records;
  }

  async load(): Promise<OfferRecord[]> {
    return inOfferOrder(this.readStored());
  }

  async append(incoming: readonly OfferRecord[]): Promise<OfferRecord[]> {
    const check = checkOfferAppend(this.readStored(), incoming);
    if (!check.ok) throw new OfferAppendRejectedError(check.rejections);
    for (const r of incoming) {
      appendFileSync(this.filePath, JSON.stringify(r) + "\n", "utf-8");
    }
    return [...incoming];
  }
}
