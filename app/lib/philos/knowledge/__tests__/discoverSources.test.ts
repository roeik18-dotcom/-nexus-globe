/**
 * discoverSourceFiles — real filesystem discovery, synthetic temp dirs only.
 * Proves: a missing root is reported honestly (never confused with "found
 * nothing"), nested files are found, skip-dirs are skipped, extensions map
 * to the right source_type.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { discoverSourceFiles } from "../discoverSources";

describe("discoverSourceFiles — real repo directory (read-only proof, no registration)", () => {
  it("finds real .md files under docs/architecture — proves the boundary works on real content, not just synthetic fixtures", () => {
    const result = discoverSourceFiles(join(process.cwd(), "docs", "architecture"));
    expect(result.root_exists).toBe(true);
    expect(result.files.length).toBeGreaterThan(0);
    expect(result.files.every((f) => f.source_type === "markdown")).toBe(true);
    expect(result.files.some((f) => f.path.endsWith("rfc-020-orientation-engine.md"))).toBe(true);
  });
});

describe("discoverSourceFiles", () => {
  let dir: string;
  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("a directory that does not exist is reported honestly — not an empty-but-real result", () => {
    const result = discoverSourceFiles("/definitely/does/not/exist/philos-corpus");
    expect(result.root_exists).toBe(false);
    expect(result.files).toEqual([]);
    expect(result.reason).toBeTruthy();
  });

  it("a real empty directory reports root_exists: true, files: []", () => {
    dir = mkdtempSync(join(tmpdir(), "philos-corpus-test-"));
    const result = discoverSourceFiles(dir);
    expect(result.root_exists).toBe(true);
    expect(result.files).toEqual([]);
  });

  it("finds real files, nested, with the right source_type per extension", () => {
    dir = mkdtempSync(join(tmpdir(), "philos-corpus-test-"));
    writeFileSync(join(dir, "note.md"), "# A note\nsome text");
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "data.json"), "{}");
    writeFileSync(join(dir, "sub", "plain.txt"), "plain text");

    const result = discoverSourceFiles(dir);
    expect(result.root_exists).toBe(true);
    const byName = Object.fromEntries(result.files.map((f) => [f.path.split("/").pop(), f]));
    expect(byName["note.md"].source_type).toBe("markdown");
    expect(byName["data.json"].source_type).toBe("json");
    expect(byName["plain.txt"].source_type).toBe("text");
    expect(byName["note.md"].size_bytes).toBeGreaterThan(0);
  });

  it("skips node_modules/.git even if present under the corpus root", () => {
    dir = mkdtempSync(join(tmpdir(), "philos-corpus-test-"));
    mkdirSync(join(dir, "node_modules"));
    writeFileSync(join(dir, "node_modules", "junk.md"), "not corpus content");
    writeFileSync(join(dir, "real.md"), "# Real");

    const result = discoverSourceFiles(dir);
    const names = result.files.map((f) => f.path.split("/").pop());
    expect(names).toEqual(["real.md"]);
  });

  it("an unrecognized extension is still discovered, typed 'other'", () => {
    dir = mkdtempSync(join(tmpdir(), "philos-corpus-test-"));
    writeFileSync(join(dir, "weird.xyz"), "content");
    const result = discoverSourceFiles(dir);
    expect(result.files[0].source_type).toBe("other");
  });
});
