/**
 * Essence · Shared Server Timeline Repository Singleton (M1-1B)
 *
 * Single source of truth for the Timeline repository in the Next.js process.
 * All server-side routes and services share this instance.
 *
 * Backend selection (evaluated once at module load):
 *   ESSENCE_DATA_DIR set → FileSystemEssenceTimelineRepository (durable)
 *   ESSENCE_DATA_DIR unset → InMemoryEssenceTimelineRepository (dev/test only)
 *
 * _setTimelineRepository() is a test helper — never call it in production code.
 */

import { InMemoryEssenceTimelineRepository } from './in-memory-timeline-repository';
import { FileSystemEssenceTimelineRepository } from '../essence-timeline-fs-repository';
import type { EssenceTimelineRepository } from './api';

function createDefaultTimelineRepository(): EssenceTimelineRepository {
  const dir = process.env.ESSENCE_DATA_DIR;
  if (dir) return new FileSystemEssenceTimelineRepository(dir);
  return new InMemoryEssenceTimelineRepository();
}

let _repo: EssenceTimelineRepository = createDefaultTimelineRepository();

export function getTimelineRepository(): EssenceTimelineRepository {
  return _repo;
}

/** Test helper — inject a pre-seeded repository. Not for production use. */
export function _setTimelineRepository(r: EssenceTimelineRepository): void {
  _repo = r;
}
