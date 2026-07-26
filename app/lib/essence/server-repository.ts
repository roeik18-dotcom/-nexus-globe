/**
 * Essence · Shared Server Repository Singleton (M0-8C)
 *
 * Single source of truth for the in-memory Essence repository in the Next.js
 * process. All server-side routes (summary, observe, …) share this instance so
 * reads from the summary route see writes from the observe route.
 *
 * _setRepository() is a test helper — never call it in production code.
 */

import { InMemoryEssenceRepository } from './in-memory-repository';

let _repo = new InMemoryEssenceRepository();

export function getRepository(): InMemoryEssenceRepository {
  return _repo;
}

/** Test helper — inject a pre-seeded repository. Not for production use. */
export function _setRepository(r: InMemoryEssenceRepository): void {
  _repo = r;
}
