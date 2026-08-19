"""Explicit voice COMMAND intents — deliberately separate from domain_router.

A command intent TRIGGERS an action (the Day Opening ceremony via the existing
run_day_opening); a knowledge route ANSWERS a question from a master. They must
not be merged. Classification here is from the CURRENT finalized utterance only
— never history, memory, or persona.

Day Opening start is recognized from an explicit, curated set of canonical
Hebrew command forms. A QUESTION about the day opening ("מה כתוב בפתיחת היום",
"תראה לי את נתוני פתיחת היום") must NEVER start the ceremony, so any utterance
carrying a question marker is rejected outright.
"""
import re
import unicodedata

# Explicit Day-Opening command phrases (indefinite/construct forms). These are
# matched as a SUBSTRING so a natural sentence — "תן לי פתיח יום", "תעשה פתיח
# יום", "שלום מה קורה פתיח יום" — still starts the ceremony. Note the QUESTIONS
# about the day opening use the DEFINITE form "פתיחת היום" (with ה), which is a
# different string and never matches these — a natural disambiguator.
_DAY_OPENING_PHRASES = (
    "פתיח יום", "פתיחת יום", "פתח יום",
    "פתיח הבוקר", "פתיחת הבוקר", "פתיח בוקר",
    "תתחיל את היום",
)

# Greeting that starts the day opening ONLY when it is essentially the whole
# utterance (so "בוקר טוב מה שלומך" stays a normal greeting).
_GREETING_EXACT = ("בוקר טוב",)

# Content-question markers: the user is asking ABOUT the day opening's content,
# not commanding it to start. Any of these present → never a start command.
_CONTENT_MARKERS = ("כתוב", "נתוני", "תראה", "הראה", "מה יש", "מה היה", "היה ב", "מה היה")

_ADDRESS_PREFIXES = ("מרלין", "מרלין,")


def _norm(text: str) -> str:
    s = unicodedata.normalize("NFC", text or "")
    s = "".join(ch for ch in s if not (0x0591 <= ord(ch) <= 0x05C7))  # strip niqqud
    s = re.sub(r"\s+", " ", s).strip()
    return s


def is_day_opening_start_command(text: str) -> bool:
    """True when the current utterance COMMANDS the Day Opening to start —
    recognized even inside a natural sentence — while a QUESTION about the day
    opening's content is rejected. Classifies from the current utterance alone,
    never history/memory/persona."""
    if not text:
        return False
    t = _norm(text)
    low = t.lower()
    if any(m in low for m in _CONTENT_MARKERS):
        return False                                    # asking about content, not a command
    if any(p in t for p in _DAY_OPENING_PHRASES):
        return True                                     # explicit day-opening phrase in the utterance
    # bare greeting: only when it is (essentially) the entire utterance
    stripped = t
    for pre in _ADDRESS_PREFIXES:
        if stripped.startswith(pre):
            stripped = stripped[len(pre):].strip()
            break
    stripped = stripped.strip(" .,!?־–—\t\n")
    return stripped in _GREETING_EXACT
