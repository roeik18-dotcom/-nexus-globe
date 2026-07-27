/**
 * Essence · Shared Server Repository Singleton (M0-8C, updated M0-12)
 *
 * Single source of truth for the Essence repository in the Next.js process.
 * All server-side routes (summary, observe, profiles) share this instance so
 * writes from the observe route are visible to reads from the summary route.
 *
 * Backend selection (evaluated once at module load):
 *   ESSENCE_DATA_DIR set → FileSystemEssenceRepository (durable, survives restart)
 *   ESSENCE_DATA_DIR unset → InMemoryEssenceRepository (development/test only)
 *
 * _setRepository() is a test helper — never call it in production code.
 */

import { InMemoryEssenceRepository } from './in-memory-repository';
import { FileSystemEssenceRepository } from '../essence-fs-repository';
import type { EssenceRepository } from './repository';

function createDefaultRepository(): EssenceRepository {
  const dir = process.env.ESSENCE_DATA_DIR;
  if (dir) return new FileSystemEssenceRepository(dir);
  return new InMemoryEssenceRepository();
}

let _repo: EssenceRepository = createDefaultRepository();

export function getRepository(): EssenceRepository {
  return _repo;
}

/** Test helper — inject a pre-seeded repository. Not for production use. */
export function _setRepository(r: EssenceRepository): void {
  _repo = r;
}
