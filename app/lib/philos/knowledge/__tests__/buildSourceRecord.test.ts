import { describe, expect, it } from "vitest";
import { buildSourceRecord } from "../buildSourceRecord";
import { computeContentHash, deriveSourceId } from "../sourceRegistry";

describe("buildSourceRecord", () => {
  it("real hash/id, title from real markdown heading, defaults to RAW_SOURCE", () => {
    const record = buildSourceRecord({
      path: "/tmp/note.md",
      source_type: "markdown",
      content: "# Real Heading\nbody",
      origin: "internal_repo",
      ingested_at: "2026-08-15T10:00:00Z",
    });
    expect(record.content_hash).toBe(computeContentHash("# Real Heading\nbody"));
    expect(record.source_id).toBe(deriveSourceId(record.content_hash));
    expect(record.source_title).toBe("Real Heading");
    expect(record.status).toBe("RAW_SOURCE");
    expect(record.size_bytes).toBeGreaterThan(0);
  });

  it("falls back to the filename when the format has no extractable title", () => {
    const record = buildSourceRecord({
      path: "/tmp/plain.txt",
      source_type: "text",
      content: "no title here",
      origin: "internal_repo",
      ingested_at: "2026-08-15T10:00:00Z",
    });
    expect(record.source_title).toBe("plain");
  });

  it("a caller-supplied status/review_note is preserved, never overwritten to CANONICAL", () => {
    const record = buildSourceRecord({
      path: "/tmp/legacy.md",
      source_type: "markdown",
      content: "# Legacy Force Model",
      origin: "internal_repo",
      ingested_at: "2026-08-15T10:00:00Z",
      status: "REVIEW_REQUIRED",
      review_note: "legacy Nexus/Force ontology — not proven canonical",
    });
    expect(record.status).toBe("REVIEW_REQUIRED");
    expect(record.review_note).toBe("legacy Nexus/Force ontology — not proven canonical");
  });
});
