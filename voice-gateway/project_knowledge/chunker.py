"""CHUNKER — split a file into retrievable units WITH full provenance.

Every chunk keeps source_path, section, heading, line_start, line_end (1-indexed),
content, content_hash. Never loses line numbers. Never rewrites source content
(chunks are verbatim slices of the original lines).
"""
from __future__ import annotations
import hashlib
import re
from dataclasses import dataclass

MAX_CHUNK_LINES = 80          # hard cap so a huge section still splits with line numbers
MAX_CHUNK_CHARS = 1600
MD_HEADING = re.compile(r"^(#{1,6})\s+(.*)$")
CODE_DEF = re.compile(r"^\s*(?:export\s+)?(?:async\s+)?(?:def|class|function|interface|type|const|export default)\b.*")


@dataclass
class Chunk:
    section: str
    heading: str
    line_start: int
    line_end: int
    content: str


def _h(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def _emit(lines, start, end, section, heading, out):
    """Emit [start,end] (1-indexed inclusive), splitting if it exceeds caps."""
    seg = lines[start - 1:end]
    if not any(l.strip() for l in seg):
        return
    if len(seg) <= MAX_CHUNK_LINES and sum(len(l) for l in seg) <= MAX_CHUNK_CHARS:
        out.append(Chunk(section, heading, start, end, "\n".join(seg).rstrip()))
        return
    # split into windows, preserving true line numbers
    i = start
    while i <= end:
        j = min(i + MAX_CHUNK_LINES - 1, end)
        # also break early on char budget
        acc = 0
        k = i
        while k <= j:
            acc += len(lines[k - 1]) + 1
            if acc > MAX_CHUNK_CHARS and k > i:
                j = k - 1
                break
            k += 1
        sub = lines[i - 1:j]
        if any(l.strip() for l in sub):
            out.append(Chunk(section, heading, i, j, "\n".join(sub).rstrip()))
        i = j + 1


def chunk_markdown(text: str):
    lines = text.split("\n")
    out = []
    cur_start = 1
    cur_heading = "(preamble)"
    stack = []  # (level, title)
    for idx, line in enumerate(lines, 1):
        m = MD_HEADING.match(line)
        if m:
            if idx - 1 >= cur_start:
                _emit(lines, cur_start, idx - 1, " / ".join(t for _, t in stack) or "(preamble)", cur_heading, out)
            level = len(m.group(1)); title = m.group(2).strip()
            stack = [(lv, t) for lv, t in stack if lv < level] + [(level, title)]
            cur_heading = title
            cur_start = idx
    _emit(lines, cur_start, len(lines), " / ".join(t for _, t in stack) or "(preamble)", cur_heading, out)
    return out


def chunk_code(text: str):
    lines = text.split("\n")
    out = []
    # boundaries at top-level-ish def/class/function lines (indent 0-4)
    bounds = [1]
    names = {1: "(module top)"}
    for idx, line in enumerate(lines, 1):
        if CODE_DEF.match(line) and (len(line) - len(line.lstrip())) <= 4:
            bounds.append(idx)
            names[idx] = line.strip()[:80]
    bounds = sorted(set(bounds))
    for bi, start in enumerate(bounds):
        end = (bounds[bi + 1] - 1) if bi + 1 < len(bounds) else len(lines)
        _emit(lines, start, end, names.get(start, "block"), names.get(start, "block"), out)
    return out


def chunk_lines(text: str, window: int = 40):
    lines = text.split("\n")
    out = []
    i = 1
    while i <= len(lines):
        j = min(i + window - 1, len(lines))
        seg = lines[i - 1:j]
        first = next((l.strip() for l in seg if l.strip()), "")[:80]
        _emit(lines, i, j, first or "block", first or "block", out)
        i = j + 1
    return out


def chunk_file(text: str, ftype: str):
    if ftype == "markdown":
        chunks = chunk_markdown(text)
    elif ftype in ("python", "typescript"):
        chunks = chunk_code(text)
    elif ftype == "jsonl":
        chunks = chunk_lines(text, window=20)
    else:  # text, yaml, json
        chunks = chunk_lines(text, window=40)
    for c in chunks:
        yield c, _h(c.content)
