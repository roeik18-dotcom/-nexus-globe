/**
 * Philos · File-System Event Store — the durable log.
 *
 * Lives OUTSIDE `app/lib/philos/` for the same reason
 * `essence-timeline-fs-repository.ts` lives outside `app/lib/essence/`: the
 * domain layer stays free of `node:fs` and `node:path`, so every projection and
 * command remains testable without a disk.
 *
 * ── Storage shape ──────────────────────────────────────────────────────────
 * The log a caller sees is `bootstrap ++ appended`:
 *   • **bootstrap** — `VALUE_GROUP_EVENTS`, the hand-authored 42-event seed for
 *     the one reference Value Group. It stays in code rather than being written
 *     to disk on first run, so the fixture the blueprint quotes (and that
 *     `globeHonesty.test.ts` pins at 10 nodes / 8 arcs) remains a reviewable,
 *     version-controlled artefact instead of drifting into machine-local state.
 *   • **appended** — one JSON object per line in `<dataDir>/philos-events.jsonl`,
 *     everything a real user has done since.
 * `load()` returns the union in canonical order, so nothing upstream can tell —
 * or needs to tell — which half an event came from.
 *
 * ── Durability ─────────────────────────────────────────────────────────────
 * `appendFileSync` is a single syscall: a line is written whole or not at all,
 * so a crash cannot leave a half-event behind.
 *
 * ── Corruption is loud, not silent ─────────────────────────────────────────
 * A line that will not parse throws `PhilosLogCorruptError`. The essence
 * timeline repository skips such a line with a warning, which is right for an
 * observation trail; it is wrong here. This log is the sole source of every
 * figure on every Philos screen, and skipping one event silently would leave a
 * member count, a budget and an impact total quietly wrong with nothing on
 * screen able to say so. The blueprint's rule is that absence is stated, never
 * papered over — so the read refuses rather than under-reports.
 */

import { existsSync, mkdirSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";

import type { PhilosEvent } from "./philos/events";
import { inOrder } from "./philos/events";
import {
  AppendRejectedError,
  checkAppend,
  type PhilosEventStore,
} from "./philos/eventStore";
import { VALUE_GROUP_EVENTS } from "./philos/valueGroupLog";

export const PHILOS_LOG_FILENAME = "philos-events.jsonl";

/** Thrown when the log on disk cannot be read as events. Never swallowed. */
export class PhilosLogCorruptError extends Error {
  readonly line_number: number;

  constructor(lineNumber: number, filePath: string) {
    super(
      `unparseable event on line ${lineNumber} of ${filePath}; refusing to read a partial log, ` +
        `because every Philos figure is derived from it and a skipped event would be an invisible error`,
    );
    this.name = "PhilosLogCorruptError";
    this.line_number = lineNumber;
  }
}

export class FileSystemPhilosEventStore implements PhilosEventStore {
  private readonly filePath: string;
  private readonly bootstrap: readonly PhilosEvent[];

  constructor(dataDir: string, bootstrap: readonly PhilosEvent[] = VALUE_GROUP_EVENTS) {
    mkdirSync(dataDir, { recursive: true });
    this.filePath = join(dataDir, PHILOS_LOG_FILENAME);
    this.bootstrap = bootstrap;
  }

  private readAppended(): PhilosEvent[] {
    if (!existsSync(this.filePath)) return [];
    const lines = readFileSync(this.filePath, "utf-8").split("\n");
    const events: PhilosEvent[] = [];
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        events.push(JSON.parse(trimmed) as PhilosEvent);
      } catch {
        throw new PhilosLogCorruptError(i + 1, this.filePath);
      }
    });
    return events;
  }

  async load(): Promise<PhilosEvent[]> {
    return inOrder([...this.bootstrap, ...this.readAppended()]);
  }

  async append(incoming: readonly PhilosEvent[]): Promise<PhilosEvent[]> {
    // Checked against the full log — bootstrap included — so a new event cannot
    // reuse a seed id, and a `caused_by` pointing at a seed event resolves.
    const check = checkAppend(await this.load(), incoming);
    if (!check.ok) throw new AppendRejectedError(check.rejections);
    for (const e of incoming) {
      appendFileSync(this.filePath, JSON.stringify(e) + "\n", "utf-8");
    }
    return [...incoming];
  }
}

/**
 * The process-wide store.
 *
 * Durable BY DEFAULT, which is where this departs from
 * `proposal-server-repository.ts` (in-memory unless `ESSENCE_DATA_DIR` is set).
 * The whole point of this milestone is that an action survives a refresh; a
 * default that silently forgets would make the product look finished in
 * development and be broken in the only way that matters. `PHILOS_DATA_DIR`
 * overrides the location; nothing turns durability off.
 */
function createDefaultStore(): PhilosEventStore {
  const dir = process.env.PHILOS_DATA_DIR ?? join(process.cwd(), ".philos-data");
  return new FileSystemPhilosEventStore(dir);
}

let _store: PhilosEventStore | null = null;

export function philosEventStore(): PhilosEventStore {
  if (_store === null) _store = createDefaultStore();
  return _store;
}

/** Test helper — inject a store. Never call this from production code. */
export function _setPhilosEventStore(store: PhilosEventStore | null): void {
  _store = store;
}

/** The whole log, in canonical order. The read side of every Philos screen. */
export async function loadPhilosEvents(): Promise<PhilosEvent[]> {
  return philosEventStore().load();
}
