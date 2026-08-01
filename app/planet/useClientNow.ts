"use client";

import { useSyncExternalStore } from "react";

/**
 * The wall clock, read once on the client and never again.
 *
 * The planet views need "now" to place the Today marker and the forecast end of
 * the time axis. Calling `Date.now()` during render would produce a different
 * value on the server than in the hydration pass, so both files used to do:
 *
 *     const [nowMs, setNowMs] = useState(0);
 *     useEffect(() => { setNowMs(Date.now()); }, []);
 *
 * which is correct about hydration but is a setState synchronously inside an
 * effect — React 19 flags it because it forces a second render pass on every
 * mount, and the pattern is the seed of cascading renders once more state joins
 * it.
 *
 * `useSyncExternalStore` expresses the same thing without the extra render: the
 * server snapshot is 0, the client snapshot is the captured time, and React
 * reconciles the two itself.
 *
 * The capture is memoised at module scope because `getSnapshot` MUST be stable —
 * returning a fresh `Date.now()` each call would make React see an endlessly
 * changing store and re-render forever.
 */
let captured = 0;

/** Stable client snapshot: the first call fixes the value for the session. */
export function readClientNow(): number {
  if (captured === 0) captured = Date.now();
  return captured;
}

/** Server snapshot. 0 is falsy, and every caller already falls back on it. */
export const readServerNow = (): number => 0;

/** The value never changes after capture, so there is nothing to publish. */
const subscribe = () => () => {};

export function useClientNow(): number {
  return useSyncExternalStore(subscribe, readClientNow, readServerNow);
}

/** Test seam only — lets a test observe the memoisation from a clean slate. */
export function __resetClientNowForTests(): void {
  captured = 0;
}
