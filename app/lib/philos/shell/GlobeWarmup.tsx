"use client";

/**
 * Warm the globe while the user is on another social scale.
 *
 * WHAT THIS IS AND IS NOT FOR. It was added chasing a "1s globe rebuild" that
 * turned out to be a measurement artifact: the probe polled with setInterval
 * in a hidden tab, where browsers clamp timers to 1000ms. Re-measured with a
 * MutationObserver the transition is ~161ms, and there is no 1s problem.
 *
 * It is kept for the reason that survives that correction: `WorldGlobe`
 * fetches its Earth texture from unpkg.com at runtime, so the first paint
 * depends on a CROSS-ORIGIN request. On a cold or slow network that is the
 * one part of the mount nobody local can speed up. Warming it while the user
 * reads another scale costs nothing once warm, and the dynamic
 * `import("react-globe.gl")` rides along.
 *
 * It is NOT load-bearing. Remove it and /planet behaves exactly as it does
 * today, only with a colder cache on a cold network.
 *
 * WHY NOT KEEP THE CANVAS ALIVE INSTEAD. The obvious alternative is to mount
 * the globe permanently and hide it on the other scales. That was rejected:
 * a hidden WebGL scene keeps rendering, so Community and World would pay GPU
 * and battery continuously for something nobody is looking at, and the globe
 * would have to live in the root layout — where it would also load on Hub,
 * Brain, Dynamics and Marketplace, which have nothing to do with it.
 * Warming a cache costs nothing once it is warm.
 *
 * This issues no request the globe would not make anyway. It makes the same
 * two requests EARLIER, while the user is reading something else, so the
 * browser cache already holds them when the scale changes. It runs at idle,
 * never on the critical path, and is a no-op on repeat visits because both
 * the module registry and the HTTP cache already have what it wants.
 *
 * Deliberately not a `<link rel=preload>`: that competes with the current
 * page's own resources. Idle time does not.
 */
import { useEffect } from "react";

/** Must stay identical to `WorldGlobe`'s `globeImageUrl`. */
const GLOBE_TEXTURE = "https://unpkg.com/three-globe/example/img/earth-night.jpg";

export default function GlobeWarmup() {
  useEffect(() => {
    let cancelled = false;

    const warm = () => {
      if (cancelled) return;
      // The heavier of the two: the globe module and its three.js dependency.
      import("react-globe.gl").catch(() => {
        /* Warming is best-effort. A failure here changes nothing — /planet
           still imports it on mount exactly as before. */
      });
      // The texture, into the ordinary image cache.
      const img = new Image();
      img.decoding = "async";
      img.src = GLOBE_TEXTURE;
    };

    const ric = (window as unknown as {
      requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number;
    }).requestIdleCallback;

    const id = ric ? ric(warm, { timeout: 3000 }) : window.setTimeout(warm, 1200);
    return () => {
      cancelled = true;
      const cic = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (ric && cic) cic(id);
      else window.clearTimeout(id);
    };
  }, []);

  return null;
}
