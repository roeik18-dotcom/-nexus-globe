/**
 * Essence · Shared Server Proposal Repository Singleton (M0-13B)
 *
 * Single source of truth for the proposal repository in the Next.js process.
 * All server-side routes share this instance so proposal state written by the
 * observe route is visible to the Philos consumer in the same request cycle.
 *
 * Backend selection (evaluated once at module load):
 *   ESSENCE_DATA_DIR set → FileSystemEssenceProposalRepository (durable, survives restart)
 *   ESSENCE_DATA_DIR unset → InMemoryEssenceProposalRepository (development/test only)
 *
 * _setProposalRepository() is a test helper — never call it in production code.
 */

import { InMemoryEssenceProposalRepository } from './in-memory-proposal-repository';
import { FileSystemEssenceProposalRepository } from '../essence-proposal-fs-repository';
import type { EssenceProposalRepository } from './api';

function createDefaultProposalRepository(): EssenceProposalRepository {
  const dir = process.env.ESSENCE_DATA_DIR;
  if (dir) return new FileSystemEssenceProposalRepository(dir);
  return new InMemoryEssenceProposalRepository();
}

let _repo: EssenceProposalRepository = createDefaultProposalRepository();

export function getProposalRepository(): EssenceProposalRepository {
  return _repo;
}

/** Test helper — inject a pre-seeded repository. Not for production use. */
export function _setProposalRepository(r: EssenceProposalRepository): void {
  _repo = r;
}
