"use client";

/**
 * Globe ↔ OPM shared selection (visualization only).
 *
 * A tiny external store so the globe (in page.tsx) and the OPM view (deep in
 * NoaOpmGraph) can share one selection without prop-drilling or a provider.
 * The shared key is the VALUE — the only identity the two populations share
 * (globe nodes carry a value via FORCE_VALUE; OPM agents via ROLE_VALUE). No
 * engine, verifier, or calculation is involved; this only coordinates highlight.
 */

import { useSyncExternalStore } from "react";

export type SyncSource = "globe" | "opm";
export interface SyncSelection {
  value: string | null;   // the bridged value (Truth/Justice/Protection/Responsibility/Dignity)
  source: SyncSource | null;
  id: string | null;      // originating node id / agent role (for reference only)
}

const EMPTY: SyncSelection = { value: null, source: null, id: null };
let state: SyncSelection = EMPTY;
const listeners = new Set<() => void>();

function emit() { listeners.forEach((l) => l()); }

/** Select a value from a source. Re-selecting the same value+source clears it. */
export function selectSync(value: string, source: SyncSource, id: string | null = null): void {
  state = state.value === value && state.source === source ? EMPTY : { value, source, id };
  emit();
}

export function clearSync(): void {
  if (state !== EMPTY) { state = EMPTY; emit(); }
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
function getSnapshot(): SyncSelection { return state; }
function getServerSnapshot(): SyncSelection { return EMPTY; }

export function useSyncSelection(): SyncSelection {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// The bridge: network role → value. Mirrors ROLE_VALUE used across the chain
// (burdenNarrative.ts / noa/index.ts) — kept here for the UI layer only.
export const ROLE_VALUE: Record<string, string> = {
  lawyer: "Justice", therapist: "Protection", journalist: "Truth",
  donor: "Responsibility", peer_survivor: "Dignity",
};
