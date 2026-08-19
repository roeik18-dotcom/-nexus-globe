"use server";

/**
 * Nexus Globe — canon data bridge (systemic-integration-audit, Globe slice 1).
 *
 * Read-only. Reuses `projectCanonDynamics` (the same canon→Dynamics projection
 * from the prior integration slice) rather than writing a second canon reader —
 * one canon-projection function, two consumers (Dynamics, Nexus). No new truth
 * path, no new store, no `.append()` call anywhere in this file.
 *
 * Why a Server Action and not a direct import into a client component: this
 * repo's canon store reads Node `fs` (see `canonEventStore.ts`), so it can only
 * run server-side. `app/nexus/page.tsx` and its siblings are `"use client"`
 * (heavy local UI state), so this thin action is the bridge — same shape as
 * `app/hub/canonOrientationAction.ts`'s own "use server" wrapper, applied here
 * for the same reason.
 */
import { projectCanonDynamics, type CanonDynamicsGraph } from "@/app/lib/philos/canon/projectCanonDynamics";

export async function loadCanonForGlobeAction(): Promise<CanonDynamicsGraph> {
  return projectCanonDynamics();
}
