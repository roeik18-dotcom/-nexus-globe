/**
 * Philos Canon — CanonEventStore accessor (process-wide singleton).
 *
 * The smallest addition required for a real caller to reach the
 * already-tested `CanonEventStore` (`./canonEventStore.ts`) — modeled
 * structurally after `philosEventStore()`/`loadPhilosEvents()`/
 * `_setPhilosEventStore()` (`../../philos-event-store.ts:115-135`, re-read
 * this pass, quoted below where relevant) — **without merging the two
 * stores or making `CanonEvent` part of the legacy Value Group event
 * model.**
 *
 * **What was read first, this pass:**
 *   - `philosEventStore()`: a lazily-initialized module-level singleton
 *     (`let _store: PhilosEventStore | null = null`), constructed on first
 *     CALL, not at import time — `mkdirSync` (inside
 *     `FileSystemPhilosEventStore`'s constructor) only ever runs once a
 *     caller actually invokes `philosEventStore()`.
 *   - Path configuration: `PHILOS_DATA_DIR` env var, defaulting to
 *     `join(process.cwd(), ".philos-data")`. "Durable BY DEFAULT... nothing
 *     turns durability off" (`philos-event-store.ts:105-113`).
 *   - Test reset/injection: `_setPhilosEventStore(store | null)`, "Never
 *     call this from production code" — the sanctioned isolation seam.
 *   - Live callers: `app/hub/actions.ts` (calls `philosEventStore().append()`
 *     directly plus `loadPhilosEvents()`), `app/hub/page.tsx`,
 *     `app/hub/community/page.tsx`, `app/dynamics/page.tsx`,
 *     `app/planet/page.tsx` — all re-confirmed this pass, none of them
 *     import anything from `canon/` (still zero, re-checked).
 *
 * **This file mirrors that shape exactly, one-to-one**, over
 * `CanonEventStore` instead of `PhilosEventStore`:
 *   - `canonEventStore()` — lazy singleton, same laziness (no
 *     `mkdirSync`/disk touch until first call — "no import-time disk
 *     mutation," satisfied the same way the existing architecture already
 *     satisfies it, not a new rule invented for this file).
 *   - `_setCanonEventStore(store | null)` — same test-only contract, same
 *     "never call from production code" discipline.
 *   - `loadCanonEvents()` — same thin read-side wrapper shape as
 *     `loadPhilosEvents()`.
 *
 * **Deliberately NOT mirrored, by design — the separation points:**
 *   - **A different env var** (`CANON_DATA_DIR`, not `PHILOS_DATA_DIR`) and
 *     **a different default directory**
 *     (`.philos-canon-data`, a SIBLING of `.philos-data`, never nested
 *     inside it) — so the two stores are configurable independently and
 *     the filesystem layout itself states the separation, not just the
 *     filename (`canon-events.jsonl` vs. `philos-events.jsonl`, already
 *     established in `canonEventStore.ts`).
 *   - **A separate module-level `_canonStore` variable** — no shared
 *     mutable state with `philos-event-store.ts`'s `_store` at all; this
 *     file does not import from `philos-event-store.ts` or `eventStore.ts`.
 *   - **No wiring into any live route this pass.** `app/hub/actions.ts`,
 *     `app/hub/page.tsx`, `app/hub/community/page.tsx`,
 *     `app/dynamics/page.tsx`, `app/planet/page.tsx` are unchanged — this
 *     file exists and is reachable, but nothing calls it yet. "A real
 *     caller" reaching it is future, separately-approved work.
 *
 * **Scope, exactly as approved**: `Observation` remains the only supported
 * `canon_type` for live append (`CanonEventStore`/`CanonEvent` already
 * enforce this — `canonEventStoreAccessor.ts` adds no new capability there,
 * only reachability). No second `canon_type`. No projection, no Dynamics,
 * no UI, no Merlin, no n8n, no Nexus coordinator, no legacy `EventType`
 * change, no merging with legacy events. Domain/Transfer naming collisions
 * remain exactly as documented in `canonEvent.ts`/`canonEventStore.ts` —
 * untouched, not referenced by this file at all.
 */
import { join } from "node:path";

import { type CanonEventStore, FileSystemCanonEventStore } from "./canonEventStore";
import type { CanonEvent } from "./canonEvent";

/**
 * Durable by default, matching `philos-event-store.ts`'s own stated reason:
 * an appended canon event should survive a process restart, not silently
 * live only in memory. `CANON_DATA_DIR` overrides the location.
 */
function createDefaultCanonStore(): CanonEventStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemCanonEventStore(dir);
}

let _canonStore: CanonEventStore | null = null;

/**
 * The process-wide canon-event store. Lazily constructed on first call —
 * importing this module does not touch the filesystem; calling this
 * function does, exactly once, then returns the same instance on every
 * subsequent call until reset.
 */
export function canonEventStore(): CanonEventStore {
  if (_canonStore === null) _canonStore = createDefaultCanonStore();
  return _canonStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  this from production code — same contract as `_setPhilosEventStore`. */
export function _setCanonEventStore(store: CanonEventStore | null): void {
  _canonStore = store;
}

/** The whole canon-event log, in canonical order (`inCanonOrder`). */
export async function loadCanonEvents(): Promise<CanonEvent[]> {
  return canonEventStore().load();
}
