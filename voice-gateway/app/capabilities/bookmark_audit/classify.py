"""Rule-based classification + duplicate detection. Deterministic and
auditable, same reasoning as app/domain_router.py for being rule-based
rather than model-based (see that module's docstring) — no added latency,
no network/model dependency, fully unit-testable. Not imported by, and does
not import, app.domain_router: this tags bookmark CONTENT/topic, unrelated
to Merlin's live conversational routing.

Domain extraction uses the full hostname, not an eTLD+1 reduction — there is
no public-suffix-list dependency here, and a naive "last two labels"
heuristic would misclassify .co.il/.org.il domains (common in this
bookmark set) by truncating "example.co.il" down to "co.il". Full hostname
is always correct; it's just occasionally more specific than strictly needed.
"""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urlsplit

from app.capabilities.bookmark_audit.models import CanonicalBookmark, Classification

_GENERIC_ROOT_FOLDERS = frozenset({
    "Bookmarks Bar", "BookmarksBar", "BookmarksMenu", "Other Bookmarks",
    "Mobile Bookmarks", "Bookmarks Menu", "com.apple.ReadingList", "Reading List",
    "סרגל הסימניות", "תפריט הסימניות",
})

_SOURCE_TYPE_DOMAIN_CUES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("video", ("youtube.com", "youtu.be", "vimeo.com")),
    ("code_repo", ("github.com", "gitlab.com", "bitbucket.org")),
    ("ai_tool", ("openai.com", "anthropic.com", "claude.ai", "chatgpt.com", "perplexity.ai")),
    ("music", ("spotify.com", "soundcloud.com", "bandcamp.com", "ableton.com", "splice.com", "voloco.co")),
    ("productivity_tool", ("notion.so", "drive.google.com", "docs.google.com", "airtable.com", "trello.com", "asana.com")),
    ("social", ("twitter.com", "x.com", "reddit.com", "linkedin.com", "facebook.com", "instagram.com")),
    ("shopping", ("amazon.", "ebay.", "etsy.com", "aliexpress.")),
    ("docs_reference", ("wikipedia.org", "stackoverflow.com", "developer.mozilla.org", "docs.")),
    ("news_article", ("medium.com", "substack.com")),
)

_TOPIC_KEYWORD_CUES: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("music", ("מוזיקה", "מיקס", "מאסטרינג", "פלאגין", "synth", "mixing", "mastering", "ableton", "music", "sound design", "vocal")),
    ("ai", ("בינה מלאכותית", "ai", "gpt", "claude", "llm", "prompt", "chatbot")),
    ("coding", ("קוד", "github", "programming", "code", "api", "developer", "dev ")),
    ("shopping", ("קנייה", "shop", "buy", "order", "cart", "מחיר")),
    ("documents", ("מסמך", "doc", "pdf", "spreadsheet", "גיליון")),
)


def extract_domain(url: str) -> str:
    try:
        host = urlsplit(url).netloc.lower()
    except ValueError:
        return ""
    if "@" in host:
        host = host.rsplit("@", 1)[-1]
    if ":" in host:
        host = host.split(":", 1)[0]
    return host


def _classify_source_type(domain: str) -> str:
    for label, cues in _SOURCE_TYPE_DOMAIN_CUES:
        if any(cue in domain for cue in cues):
            return label
    return "general"


def _classify_topic(title: str) -> str:
    lower = title.lower()
    for label, cues in _TOPIC_KEYWORD_CUES:
        if any(cue.lower() in lower for cue in cues):
            return label
    return "general"


def _classify_project(folder_path: tuple[str, ...]) -> str:
    for segment in folder_path:
        if segment not in _GENERIC_ROOT_FOLDERS:
            return segment
    return "unfiled"


def _classify_priority(date_added: str | None, project: str) -> str:
    days_since_added: int | None = None
    if date_added:
        try:
            added = datetime.fromisoformat(date_added.replace("Z", "+00:00"))
            if added.tzinfo is None:
                added = added.replace(tzinfo=timezone.utc)
            days_since_added = (datetime.now(timezone.utc) - added).days
        except ValueError:
            days_since_added = None

    has_project_signal = project != "unfiled"

    if has_project_signal and (days_since_added is None or days_since_added < 180):
        return "high"
    if days_since_added is not None and days_since_added < 400:
        return "medium"
    return "low"


def classify(bookmark: CanonicalBookmark) -> Classification:
    domain = extract_domain(bookmark.url)
    project = _classify_project(bookmark.folder_path)
    return Classification(
        project=project,
        topic=_classify_topic(bookmark.title),
        domain=domain,
        source_type=_classify_source_type(domain),
        priority=_classify_priority(bookmark.date_added, project),
    )


def detect_duplicates(bookmarks: list[CanonicalBookmark]) -> dict[int, bool]:
    """Returns {index_in_list: is_duplicate}. The first occurrence of a
    bookmark_id in `bookmarks` is never a duplicate; every later occurrence
    of the same bookmark_id is."""
    seen: Counter[str] = Counter()
    result: dict[int, bool] = {}
    for i, b in enumerate(bookmarks):
        seen[b.bookmark_id] += 1
        result[i] = seen[b.bookmark_id] > 1
    return result
