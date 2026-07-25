"""Sentence-boundary buffer — splits streaming text into TTS-ready chunks.

Instead of waiting for the full LLM response, _handle_turn feeds tokens here
and calls TTS as soon as a complete sentence (or large enough clause) is
available. This reduces time-to-first-audio from ~LLM_total to:
    ~LLM_TTFT + first_sentence_wait + TTS_first_chunk
"""

import re

_STRONG = re.compile(r'(?<=[.!?…！？])\s+')   # . ! ? … ！ ？ + space
_WEAK   = re.compile(r'(?<=[,;:—])\s+')               # , ; : — + space
_DBL_NL = re.compile(r'\n\n+')                              # paragraph break

MIN_CHARS      = 15   # never cut shorter than this (avoids choppy single-word TTS)
MAX_CHARS      = 250  # force cut when buffer grows beyond this
WEAK_THRESHOLD = 80   # use weak boundary only above this many chars


class SentenceBuffer:
    """
    Feed text chunks via push(); receive complete sentences ready for TTS.
    After the stream ends, call flush() for any remaining text.

    Parameters
    ----------
    min_chars       : int       — minimum chars before any boundary is honoured
    max_chars       : int       — force word-boundary cut above this length
    weak_threshold  : int       — honour comma/semicolon only above this length
    first_min_chars : int|None  — lower min_chars for the FIRST emission only;
                                  reverts to min_chars after the first chunk is sent
    """

    def __init__(
        self,
        min_chars: int = MIN_CHARS,
        max_chars: int = MAX_CHARS,
        weak_threshold: int = WEAK_THRESHOLD,
        first_min_chars: int | None = None,
    ) -> None:
        self._buf = ""
        self._min = min_chars
        self._max = max_chars
        self._weak = weak_threshold
        self._first_min = first_min_chars
        self._first_emitted = False

    def push(self, text: str) -> str | None:
        """Add *text*; return a speakable chunk if a boundary was found, else None."""
        self._buf += text
        return self._try_split()

    def flush(self) -> str:
        """Return (and clear) whatever text remains in the buffer."""
        result = self._buf.strip()
        self._buf = ""
        return result

    # ------------------------------------------------------------------
    def _effective_min(self) -> int:
        if not self._first_emitted and self._first_min is not None:
            return self._first_min
        return self._min

    def _try_split(self) -> str | None:
        buf = self._buf
        min_c = self._effective_min()

        if len(buf) < min_c:
            return None

        # Paragraph break — strongest natural pause
        m = _DBL_NL.search(buf)
        if m:
            return self._take(m.end())

        # Strong sentence-ending punctuation followed by whitespace
        m = _STRONG.search(buf)
        if m:
            return self._take(m.end())

        # Weak clause boundary — only when buffer is long enough
        if len(buf) >= self._weak:
            m = _WEAK.search(buf)
            if m and m.start() >= min_c:
                return self._take(m.end())

        # Force cut at MAX_CHARS at the last word boundary
        if len(buf) >= self._max:
            cut = buf.rfind(' ', min_c, self._max)
            if cut > 0:
                chunk = buf[:cut].strip()
                self._buf = buf[cut + 1:]
                if chunk:
                    self._first_emitted = True
                return chunk or None
            # No word boundary found — hard cut (very rare: e.g. huge single token)
            chunk = buf[:self._max].strip()
            self._buf = buf[self._max:]
            if chunk:
                self._first_emitted = True
            return chunk or None

        return None

    def _take(self, end: int) -> str | None:
        chunk = self._buf[:end].strip()
        self._buf = self._buf[end:]
        if chunk:
            self._first_emitted = True
        return chunk or None
