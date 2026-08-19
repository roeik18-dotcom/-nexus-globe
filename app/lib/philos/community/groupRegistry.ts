/**
 * Canonical Value-Group Registry (ledger §40 — Community / Value Universe
 * pass). A pure fold over already-projected `ValueGroupView`s — no new
 * I/O, no new store.
 *
 * Real statuses this codebase's data actually supports today: REAL (1),
 * DEMO (2, `demoCommunities.ts`). ARCHIVED and FORMING are supported
 * TYPES (a real group whose own `status` field ever carries one of those
 * values would classify correctly) but 0 real records use them today —
 * `group.opened`'s real `status` payload has only ever been `"active"`
 * in this codebase, checked directly. Never fabricated to fill a bucket.
 *
 * POSSIBLE groups are NOT invented communities. The only real, checked
 * "possibility" signal this codebase's data supports is: a real PUDM
 * Value record (`data/values.json`, §39: MIGRATABLE) with ZERO real or
 * DEMO Value Group currently centered on it — a real, structural
 * "VALUE EXISTS — NO GROUP" fact, not a guess about who might form one.
 */
import type { ValueGroupView } from "./../projectValueGroup";
import type { GroupProvenance } from "./valueRegistry";

export type GroupRegistryStatus = "REAL" | "DEMO" | "ARCHIVED" | "FORMING";

export interface GroupRegistryEntry {
  group_id: string;
  name: string;
  status: GroupRegistryStatus;
  central_value: string;
  member_count: number;
  event_count: number;
  region: string;
  available: number;
  verified_effects: number;
}

export function buildGroupRegistry(groups: { view: ValueGroupView; provenance: GroupProvenance }[]): GroupRegistryEntry[] {
  return groups.map(({ view, provenance }) => ({
    group_id: view.group_id,
    name: view.name,
    // Real `status` field wins when it names a real archived/forming
    // state this codebase has never actually recorded (see header) —
    // falls back to the real REAL/DEMO provenance tag otherwise.
    status: (view.status === "archived" ? "ARCHIVED" : view.status === "forming" ? "FORMING" : provenance) as GroupRegistryStatus,
    central_value: view.central_value,
    member_count: view.members.length,
    event_count: view.event_count,
    region: view.region,
    available: view.budget.available,
    verified_effects: view.impact.filter((i) => i.verified).length,
  }));
}

export interface PossibleGroup {
  value_id: string;
  value_name: string;
  basis: "VALUE_EXISTS_NO_GROUP";
  evidence: string;
}

/** Real, computed possibility layer — see module header. `valueEntries`
 *  is whatever `valueRegistry.ts::buildValueRegistry` already produced;
 *  this never re-derives values on its own. */
export function buildPossibleGroups(valueEntries: { value_id: string; name: string; groups: string[] }[]): PossibleGroup[] {
  return valueEntries
    .filter((v) => v.groups.length === 0)
    .map((v) => ({
      value_id: v.value_id,
      value_name: v.name,
      basis: "VALUE_EXISTS_NO_GROUP",
      evidence: `real Value record, 0 real or DEMO Value Group centered on it`,
    }));
}
