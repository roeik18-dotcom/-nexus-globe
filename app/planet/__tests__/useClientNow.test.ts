/**
 * The client-clock snapshot behind the planet time axis.
 *
 * Replaces a `setState` inside an effect, which React 19 flags because it forces
 * a second render on every mount. `useSyncExternalStore` needs a STABLE
 * `getSnapshot`: returning a fresh `Date.now()` per call would make React see an
 * endlessly changing store and re-render forever. That stability is the whole
 * correctness argument, so it is what these tests pin.
 */
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  __resetClientNowForTests,
  readClientNow,
  readServerNow,
} from "../useClientNow";

afterEach(() => {
  __resetClientNowForTests();
  vi.useRealTimers();
});

describe("client snapshot", () => {
  it("is stable across calls — the loop-prevention invariant", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T12:00:00Z"));
    const first = readClientNow();

    vi.setSystemTime(new Date("2026-08-01T12:05:00Z"));
    expect(readClientNow()).toBe(first);
    expect(readClientNow()).toBe(first);
  });

  it("captures the wall clock at first read", () => {
    vi.useFakeTimers();
    const at = new Date("2026-08-01T12:00:00Z");
    vi.setSystemTime(at);
    expect(readClientNow()).toBe(at.getTime());
  });

  it("does not read the clock before it is asked", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-01T09:00:00Z"));
    // nothing captured yet — the first call decides the value
    vi.setSystemTime(new Date("2026-08-01T10:00:00Z"));
    expect(readClientNow()).toBe(new Date("2026-08-01T10:00:00Z").getTime());
  });
});

describe("server snapshot", () => {
  it("is 0 so server and hydration render identically", () => {
    expect(readServerNow()).toBe(0);
  });

  it("is falsy, which every caller already falls back on", () => {
    // both planet views compute `(nowMs || maxBorn)` — a 0 snapshot must route
    // to the maxBorn fallback rather than to an epoch date
    const maxBorn = 1_750_000_000_000;
    expect(readServerNow() || maxBorn).toBe(maxBorn);
  });

  it("differs from the client snapshot, which is what triggers the update", () => {
    expect(readServerNow()).not.toBe(readClientNow());
  });
});
