"""Rule engine for delegation decisions — v1 is keyword-based.

Returns the target agent name when a request warrants delegation,
or None when Jarvis should answer directly.

Replace with a model-based classifier once benchmark data shows
that the keyword approach misses important cases.
"""

_DEEP_KEYWORDS: frozenset[str] = frozenset({
    # English
    "analyze", "analyse", "explain why", "how does", "compare",
    "evaluate", "assess", "theory", "mechanism", "philosophy",
    "critically", "implications", "reasoning", "why does",
    "why is", "why do", "what are the implications",
    # Hebrew
    "לנתח", "להסביר", "למה", "כיצד", "להשוות",
    "להעריך", "תיאוריה", "מנגנון", "פילוסופיה", "ניתוח",
    "הסבר", "ביקורתי", "השלכות",
})


def should_delegate(text: str) -> str | None:
    """Return the target agent name if delegation is warranted, else None."""
    lower = text.lower()
    if any(kw in lower for kw in _DEEP_KEYWORDS):
        return "philos"
    return None
