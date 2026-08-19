/**
 * PersonCommunityLinkStore accessor (process-wide singleton). Mirrors
 * `canon/needStoreAccessor.ts` exactly in shape. Deliberately reuses the
 * SAME `CANON_DATA_DIR` directory as the canon Need/Observation stores —
 * this is canon-adjacent identity data, same real deployment concern — but
 * writes to a DIFFERENT FILE (`person-community-links.jsonl`), via a
 * completely separate store instance, so the logs never share a byte of
 * live state.
 */
import { join } from "node:path";

import { type PersonCommunityLink, resolvePersonCommunityLink, type ResolvedLink } from "./personCommunityLink";
import { FileSystemPersonCommunityLinkStore, type PersonCommunityLinkStore } from "./personCommunityLinkStore";

function createDefaultLinkStore(): PersonCommunityLinkStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemPersonCommunityLinkStore(dir);
}

let _linkStore: PersonCommunityLinkStore | null = null;

export function personCommunityLinkStore(): PersonCommunityLinkStore {
  if (_linkStore === null) _linkStore = createDefaultLinkStore();
  return _linkStore;
}

/** Test helper — inject a store (or clear to force re-creation). Never call
 *  this from production code. */
export function _setPersonCommunityLinkStore(store: PersonCommunityLinkStore | null): void {
  _linkStore = store;
}

/** The whole link log, in canonical order. */
export async function loadPersonCommunityLinks(): Promise<PersonCommunityLink[]> {
  return personCommunityLinkStore().load();
}

/**
 * The real read path every surface (Hub/Community/Brain/Dynamics/Planet/
 * Marketplace/Human Config) uses to answer "what is the link status for
 * this person/community-member/community triple" — one function, one
 * store read, never re-derived per surface.
 */
export async function resolveRealPersonCommunityLink(
  person_id: string,
  community_member_id: string,
  community_id: string,
): Promise<ResolvedLink> {
  const all = await loadPersonCommunityLinks();
  return resolvePersonCommunityLink(all, person_id, community_member_id, community_id);
}
