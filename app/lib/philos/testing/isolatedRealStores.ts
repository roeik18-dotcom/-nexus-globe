/**
 * ISOLATED STORES FOR TESTS THAT LOAD THE SOCIAL SYSTEM.
 *
 * WHY THIS EXISTS. `loadSocialSystem` reads ten stores through the process-wide
 * accessors, and those accessors fall back to `.philos-canon-data` /
 * `.philos-data` under `process.cwd()` when their environment variables are
 * unset. Two suites isolated the SESSION log with `mkdtempSync` and then, one
 * line later, loaded the social system straight out of the developer's REAL
 * data — and pinned a hand-counted constant (`GROUP: 34`) to whatever happened
 * to be on disk the day it was written.
 *
 * That constant was not a specification. It was a snapshot. The moment a
 * person used the product for its intended purpose and appended two authorized
 * REAL records, three tests went red — not because anything regressed, but
 * because the tests were reading mutable production data. Raising 34 to 36
 * would have repaired the symptom and preserved the defect, so the fix is to
 * stop reading REAL at all.
 *
 * WHAT IT DOES. Points all three store variables at one temporary directory,
 * writes an EXPLICIT fixture into it, and clears every accessor singleton so
 * the next call reconstructs against the isolation. Teardown restores the
 * previous environment exactly — including variables that were previously
 * UNSET, which must be deleted rather than set to "".
 */
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { _setCanonEventStore } from "../canon/canonEventStoreAccessor";
import { _setActionStore } from "../canon/actionStoreAccessor";
import { _setEffectStore } from "../canon/effectStoreAccessor";
import { _setNeedStore } from "../canon/needStoreAccessor";
import { _setOfferStore } from "../canon/offerStoreAccessor";
import { _setLearningStore } from "../canon/learningStoreAccessor";
import { _setDomainStateStore } from "../canon/domainStateStoreAccessor";
import { _setNeedGroupLinkStore } from "../community/needGroupLinkStoreAccessor";
import { _setValueDeclarationStore } from "../community/valueDeclarationStoreAccessor";
import { _setPersonCommunityLinkStore } from "../community/personCommunityLinkStoreAccessor";
import { _setPhilosEventStore } from "@/app/lib/philos-event-store";

/** Every variable that can redirect a store away from the REAL default. */
const VARS = ["CANON_DATA_DIR", "PHILOS_DATA_DIR", "PHILOS_CANON_DIR"] as const;

/** Clear every process-wide singleton so it rebuilds against the new dir. */
function resetStores(): void {
  _setCanonEventStore(null); _setActionStore(null); _setEffectStore(null);
  _setNeedStore(null); _setOfferStore(null); _setLearningStore(null);
  _setDomainStateStore(null); _setNeedGroupLinkStore(null);
  _setValueDeclarationStore(null); _setPersonCommunityLinkStore(null);
  _setPhilosEventStore(null);
}

export interface IsolatedStores {
  dir: string;
  /** Restore the previous environment and singletons. Always call in afterEach. */
  restore(): void;
}

/**
 * `files` is written verbatim into the isolated directory, so a test states
 * its own world explicitly. Omit a file and it is genuinely absent — which is
 * a different, and legitimate, thing to test than an empty one.
 */
export function useIsolatedRealStores(files: Record<string, string> = {}): IsolatedStores {
  const dir = mkdtempSync(join(tmpdir(), "philos-iso-"));
  const previous = new Map<string, string | undefined>();
  for (const v of VARS) { previous.set(v, process.env[v]); process.env[v] = dir; }
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body, "utf8");
  resetStores();
  return {
    dir,
    restore() {
      for (const v of VARS) {
        const p = previous.get(v);
        /* An unset variable must be DELETED. Assigning "" would point the
           accessors at the process's working directory, which on a developer
           machine is the REAL store — the exact bug being closed. */
        if (p === undefined) delete process.env[v]; else process.env[v] = p;
      }
      resetStores();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/**
 * ONE REAL GROUP, TWO MEMBERS, NOTHING ELSE. Small enough to reason about by
 * hand and fixed forever: no count derived from it can drift with REAL data.
 */
export const MINIMAL_SOCIAL_FIXTURE: Record<string, string> = {
  "memberships.jsonl": [
    JSON.stringify({ membership_id: "m_fix_1", group_id: "vg_fixture", person_id: "p_you",
      role: "member", status: "active", provenance: "REAL", since: "2026-01-01", evidence: "fixture" }),
    JSON.stringify({ membership_id: "m_fix_2", group_id: "vg_fixture", person_id: "p_other",
      role: "member", status: "active", provenance: "REAL", since: "2026-01-01", evidence: "fixture" }),
  ].join("\n") + "\n",
  "philos-events.jsonl": JSON.stringify({
    event_id: "ev_fix_join", actor_id: "p_you", entity_type: "value_group",
    entity_id: "vg_fixture", event_type: "member.joined", value_tags: [],
    timestamp: "2026-01-01T00:00:00.000Z", visibility: "private", caused_by: [],
    payload: { group_id: "vg_fixture", person_id: "p_you" },
  }) + "\n",
};
