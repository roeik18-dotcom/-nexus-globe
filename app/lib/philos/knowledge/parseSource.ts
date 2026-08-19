/**
 * PHILOS Knowledge — deterministic source parsers.
 *
 * Pure functions over a raw content STRING already read from disk (no I/O
 * here — the caller reads the file, this module never does). Each parser
 * extracts only what can be read deterministically from the format itself
 * (a heading, a word count, JSON validity) — none of them classify content
 * into PHILOS concepts (DEFINITION/PRINCIPLE/FORCE/…). That is atomic
 * extraction, explicitly Step 2, and explicitly deferred until a real
 * corpus exists to extract from.
 */
import type { SourceType } from "./sourceRegistry";

export interface ParsedSource {
  title: string;
  raw_text: string;
  word_count: number;
}

export const SUPPORTED_PARSE_EXTENSIONS = ["markdown", "text", "json"] as const satisfies readonly SourceType[];

function countWords(text: string): number {
  const trimmed = text.trim();
  if (trimmed === "") return 0;
  return trimmed.split(/\s+/).length;
}

/** Plain text: no structure to extract beyond the text itself. */
export function parseTextSource(content: string, fallbackTitle: string): ParsedSource {
  return { title: fallbackTitle, raw_text: content, word_count: countWords(content) };
}

/** Markdown: title is the first `# Heading` line if one exists, real and
 *  verbatim — never inferred from surrounding prose. Falls back to the
 *  caller-supplied title (typically the filename) when no heading exists. */
export function parseMarkdownSource(content: string, fallbackTitle: string): ParsedSource {
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const title = headingMatch ? headingMatch[1].trim() : fallbackTitle;
  return { title, raw_text: content, word_count: countWords(content) };
}

export interface ParsedJsonSource {
  title: string;
  valid: boolean;
  raw_text: string;
  /** Present only when `valid` is false — the real parse error, not hidden. */
  error?: string;
}

/** JSON: only validates well-formedness — does not interpret the shape.
 *  A malformed file is reported as `valid: false`, never silently skipped. */
export function parseJsonSource(content: string, fallbackTitle: string): ParsedJsonSource {
  try {
    JSON.parse(content);
    return { title: fallbackTitle, valid: true, raw_text: content };
  } catch (e) {
    return { title: fallbackTitle, valid: false, raw_text: content, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Dispatches to the right parser for a discovered file's `source_type`.
 *  `undefined` for a type this boundary cannot yet parse (`pdf`/`docx`/
 *  `other`) — the file is still real and discoverable/registrable, just not
 *  yet reducible to text by this pass. */
export function parseBySourceType(sourceType: SourceType, content: string, fallbackTitle: string): ParsedSource | ParsedJsonSource | undefined {
  switch (sourceType) {
    case "markdown":
      return parseMarkdownSource(content, fallbackTitle);
    case "text":
      return parseTextSource(content, fallbackTitle);
    case "json":
      return parseJsonSource(content, fallbackTitle);
    default:
      return undefined;
  }
}
