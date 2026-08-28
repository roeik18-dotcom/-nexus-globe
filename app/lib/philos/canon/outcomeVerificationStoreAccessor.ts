/** The process-wide verification store. Same shape as every other accessor. */
import { join } from "node:path";

import { FileSystemVerificationStore, type VerificationStore } from "./outcomeVerificationStore";

let _store: VerificationStore | null = null;

export function verificationStore(): VerificationStore {
  if (_store === null) {
    const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
    _store = new FileSystemVerificationStore(dir);
  }
  return _store;
}

/** Test helper — inject a store, or clear to force re-creation. */
export function _setVerificationStore(store: VerificationStore | null): void { _store = store; }

export const loadVerifications = () => verificationStore().load();
