/** Process-wide accessor, mirroring `needGroupLinkStoreAccessor.ts`. */
import { join } from "node:path";

import type { ValueDeclaration } from "./valueDeclaration";
import { FileSystemValueDeclarationStore, type ValueDeclarationStore } from "./valueDeclarationStore";

function createDefaultStore(): ValueDeclarationStore {
  const dir = process.env.CANON_DATA_DIR ?? join(process.cwd(), ".philos-canon-data");
  return new FileSystemValueDeclarationStore(dir);
}

let _store: ValueDeclarationStore | null = null;

export function valueDeclarationStore(): ValueDeclarationStore {
  if (_store === null) _store = createDefaultStore();
  return _store;
}

/** Test helper — never call from production code. */
export function _setValueDeclarationStore(store: ValueDeclarationStore | null): void { _store = store; }

export async function loadValueDeclarations(): Promise<ValueDeclaration[]> {
  return valueDeclarationStore().load();
}
