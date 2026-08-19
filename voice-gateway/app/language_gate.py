"""Output-language gate for the Merlin Control Center.

Script-based heuristic — NOT a semantic language identifier. Counts Hebrew-range
vs. Latin-alphabet letters, ignoring digits/punctuation/whitespace, and tolerates a
small number of embedded Latin letters (technical terms, filenames, API names) so a
sentence like "פתח את VSCode ותריץ git status" is not flagged as English.

This intentionally does NOT touch STT/transcript handling (out of scope) — it only
looks at the LLM's *output* text, after generation.
"""

from __future__ import annotations

import re

_HEBREW_RANGE = re.compile(r"[֐-׿]")
_LATIN_WORD = re.compile(r"[A-Za-z]{3,}")  # 3+ letter runs — excludes short tech tokens like "he"/"AI"/"UI"

# A response is flagged as "not the target language" when it has essentially no
# target-language letters AND a meaningful amount of the other script's *words*
# (not just isolated short tokens like a filename or acronym).
_MIN_FLAGGED_LATIN_WORDS = 4
_MIN_FLAGGED_LATIN_CHARS = 20


def looks_non_target_language(text: str, allowed_output_languages: list[str]) -> bool:
    """True when `text` looks like it is NOT written in any of allowed_output_languages.

    Only meaningfully implemented for allowed_output_languages == ["he"] (the MVP's
    only shipped case). Returns False (never flags) for any other policy — a stricter
    gate for allowed == ["en"] or multi-language policies is out of scope here.
    """
    if allowed_output_languages != ["he"]:
        return False
    if not text or not text.strip():
        return False

    hebrew_chars = len(_HEBREW_RANGE.findall(text))
    latin_words = _LATIN_WORD.findall(text)
    latin_chars = sum(len(w) for w in latin_words)

    if hebrew_chars > 0:
        # Any real Hebrew content present at all → treat as Hebrew (technical terms
        # in English are explicitly allowed alongside it, per policy).
        return False

    return len(latin_words) >= _MIN_FLAGGED_LATIN_WORDS and latin_chars >= _MIN_FLAGGED_LATIN_CHARS


HEBREW_FALLBACK_MESSAGE = "לא הצלחתי לענות בעברית כרגע — נסה שוב, או בקש מפורשות לעבור לאנגלית."

RETRY_CORRECTION_SUFFIX = (
    "\n\n## Language correction (Merlin Control Center)\n"
    "Your previous draft was not in Hebrew. Policy requires Hebrew-only output. "
    "Rewrite the SAME answer in natural Hebrew. Technical terms/code/filenames may "
    "stay in English inside the Hebrew sentence."
)
