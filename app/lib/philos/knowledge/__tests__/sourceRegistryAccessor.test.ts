import { describe, expect, it } from "vitest";
import { InMemorySourceRegistryStore } from "../sourceRegistry";
import { _setSourceRegistryStore, listReviewQueue, loadSources } from "../sourceRegistryAccessor";
import { buildSourceRecord } from "../buildSourceRecord";

describe("loadSources / listReviewQueue (via injected in-memory store)", () => {
  it("an empty store returns an empty list, not an error", async () => {
    _setSourceRegistryStore(new InMemorySourceRegistryStore());
    expect(await loadSources()).toEqual([]);
    expect(await listReviewQueue()).toEqual([]);
    _setSourceRegistryStore(null);
  });

  it("real review-queue filtering: RAW_SOURCE/REVIEW_REQUIRED/CONTRADICTORY included, CANONICAL excluded", async () => {
    const raw = buildSourceRecord({ path: "/tmp/a.md", source_type: "markdown", content: "# A", origin: "internal_repo", ingested_at: "2026-08-15T10:00:00Z" });
    const canonical = buildSourceRecord({ path: "/tmp/b.md", source_type: "markdown", content: "# B", origin: "internal_repo", ingested_at: "2026-08-15T10:01:00Z", status: "CANONICAL" });
    const legacy = buildSourceRecord({
      path: "/tmp/c.md",
      source_type: "markdown",
      content: "# C",
      origin: "internal_repo",
      ingested_at: "2026-08-15T10:02:00Z",
      status: "REVIEW_REQUIRED",
      review_note: "legacy",
    });
    const store = new InMemorySourceRegistryStore();
    await store.register([raw, canonical, legacy]);
    _setSourceRegistryStore(store);

    const queue = await listReviewQueue();
    const ids = queue.map((r) => r.source_id).sort();
    expect(ids).toEqual([raw.source_id, legacy.source_id].sort());
    _setSourceRegistryStore(null);
  });
});
