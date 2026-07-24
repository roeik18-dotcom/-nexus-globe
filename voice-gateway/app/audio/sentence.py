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
    min_chars      : int  — minimum chars before any boundary is honoured
    max_chars      : int  — force word-boundary cut above this length
    weak_threshold : int  — honour comma/semicolon only above this length
    """

    def __init__(
        self,
        min_chars: int = MIN_CHARS,
        max_chars: int = MAX_CHARS,
        weak_threshold: int = WEAK_THRESHOLD,
    ) -> None:
        self._buf = ""
        self._min = min_chars
        self._max = max_chars
        self._weak = weak_threshold

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
    def _try_split(self) -> str | None:
        buf = self._buf

        if len(buf) < self._min:
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
            if m and m.start() >= self._min:
                return self._take(m.end())

        # Force cut at MAX_CHARS at the last word boundary
        if len(buf) >= self._max:
            cut = buf.rfind(' ', self._min, self._max)
            if cut > 0:
                chunk = buf[:cut].strip()
                self._buf = buf[cut + 1:]
                return chunk or None
            # No word boundary found — hard cut (very rare: e.g. huge single token)
            chunk = buf[:self._max].strip()
            self._buf = buf[self._max:]
            return chunk or None

        return None

    def _take(self, end: int) -> str | None:
        chunk = self._buf[:end].strip()
        self._buf = self._buf[end:]
        return chunk or None
