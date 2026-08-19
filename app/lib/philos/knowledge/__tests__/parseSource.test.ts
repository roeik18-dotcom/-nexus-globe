import { describe, expect, it } from "vitest";
import { parseBySourceType, parseJsonSource, parseMarkdownSource, parseTextSource } from "../parseSource";

describe("parseTextSource", () => {
  it("uses the fallback title verbatim, counts words", () => {
    const p = parseTextSource("one two three", "fallback.txt");
    expect(p.title).toBe("fallback.txt");
    expect(p.word_count).toBe(3);
    expect(p.raw_text).toBe("one two three");
  });

  it("empty content has zero words", () => {
    expect(parseTextSource("   ", "x").word_count).toBe(0);
  });
});

describe("parseMarkdownSource", () => {
  it("real title extracted from the first # heading", () => {
    const p = parseMarkdownSource("# The Real Title\n\nBody text here.", "fallback");
    expect(p.title).toBe("The Real Title");
  });

  it("falls back to the caller-supplied title when no heading exists", () => {
    const p = parseMarkdownSource("no heading here, just prose", "fallback-name");
    expect(p.title).toBe("fallback-name");
  });

  it("never invents a heading that isn't literally in the text", () => {
    const p = parseMarkdownSource("## only a level-2 heading", "fallback");
    expect(p.title).toBe("fallback"); // # (level 1) only, by design — not a guess at intent
  });
});

describe("parseJsonSource", () => {
  it("valid JSON is reported valid, no error", () => {
    const p = parseJsonSource('{"a":1}', "data.json");
    expect(p.valid).toBe(true);
    expect(p.error).toBeUndefined();
  });

  it("malformed JSON is reported invalid with the real parse error, never silently skipped", () => {
    const p = parseJsonSource("{not json", "data.json");
    expect(p.valid).toBe(false);
    expect(p.error).toBeTruthy();
  });
});

describe("parseBySourceType", () => {
  it("dispatches markdown/text/json correctly", () => {
    expect(parseBySourceType("markdown", "# T", "f")?.title).toBe("T");
    expect(parseBySourceType("text", "hi", "f")?.title).toBe("f");
    expect((parseBySourceType("json", "{}", "f") as { valid: boolean }).valid).toBe(true);
  });

  it("returns undefined for types this boundary cannot yet parse — honest, not a fabricated empty parse", () => {
    expect(parseBySourceType("pdf", "binary-ish", "f")).toBeUndefined();
    expect(parseBySourceType("docx", "binary-ish", "f")).toBeUndefined();
    expect(parseBySourceType("other", "?", "f")).toBeUndefined();
  });
});
