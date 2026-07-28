import type { EssenceSnapshotRepository, EssenceProfileSnapshot } from './snapshot';

export class InMemoryEssenceSnapshotRepository implements EssenceSnapshotRepository {
  private readonly store = new Map<string, EssenceProfileSnapshot[]>();

  async save(snapshot: EssenceProfileSnapshot): Promise<void> {
    const existing = this.store.get(snapshot.profileId) ?? [];
    this.store.set(snapshot.profileId, [...existing, snapshot]);
  }

  async loadLatest(profileId: string): Promise<EssenceProfileSnapshot | null> {
    const snapshots = this.store.get(profileId) ?? [];
    return snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  }
}
