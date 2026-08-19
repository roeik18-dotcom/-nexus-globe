"""Offline unit tests for app.capabilities.bookmark_audit — synthetic
fixtures only, no network, no dependency on this machine's real bookmark
files. Live end-to-end proof (real n8n, real Chrome/Safari files) lives in
app/capabilities/bookmark_audit/proof_live_audit.py.
"""

import json

from app.capabilities.bookmark_audit.classify import (
    classify, detect_duplicates, extract_domain,
)
from app.capabilities.bookmark_audit.deadlinks import _ACCESS_RESTRICTED_STATUSES
from app.capabilities.bookmark_audit.models import CanonicalBookmark, Classification, DeadLinkResult
from app.capabilities.bookmark_audit.parsers import parse_chrome_bookmarks, parse_safari_bookmarks
from app.capabilities.bookmark_audit.recommend import recommend
from app.capabilities.bookmark_audit.snapshot import (
    bookmark_id_for, build_canonical_snapshot, normalize_url,
)

# ── parsers ──────────────────────────────────────────────────────────────────

def test_parse_chrome_bookmarks_basic():
    fixture = {
        "roots": {
            "bookmark_bar": {
                "name": "Bookmarks Bar",
                "children": [
                    {"type": "url", "name": "GitHub", "url": "https://github.com", "date_added": "13430664438626011"},
                    {"type": "folder", "name": "Music", "children": [
                        {"type": "url", "name": "Ableton", "url": "https://ableton.com"},
                    ]},
                ],
            },
            "other": {"name": "Other Bookmarks", "children": []},
        }
    }
    out = parse_chrome_bookmarks(json.dumps(fixture).encode("utf-8"))
    assert len(out) == 2
    assert out[0].url == "https://github.com"
    assert out[0].folder_path == ("Bookmarks Bar",)
    assert out[0].date_added is not None
    assert out[1].folder_path == ("Bookmarks Bar", "Music")


def test_parse_chrome_bookmarks_malformed_input_never_raises():
    assert parse_chrome_bookmarks(b"not json at all") == []
    assert parse_chrome_bookmarks(b'{"no_roots_key": true}') == []


def test_parse_safari_bookmarks_basic():
    import plistlib
    fixture = {
        "Children": [
            {"WebBookmarkType": "WebBookmarkTypeList", "Title": "BookmarksBar", "Children": [
                {"WebBookmarkType": "WebBookmarkTypeLeaf", "URLString": "https://example.com",
                 "URIDictionary": {"title": "Example"}},
            ]},
            {"WebBookmarkType": "WebBookmarkTypeProxy", "Title": "History"},  # must be skipped
        ]
    }
    out = parse_safari_bookmarks(plistlib.dumps(fixture))
    assert len(out) == 1
    assert out[0].url == "https://example.com"
    assert out[0].title == "Example"
    assert out[0].folder_path == ("BookmarksBar",)


def test_parse_safari_bookmarks_malformed_input_never_raises():
    assert parse_safari_bookmarks(b"not a plist") == []


# ── snapshot / normalization ────────────────────────────────────────────────

def test_normalize_url_strips_trailing_slash_and_lowercases_host():
    assert normalize_url("HTTPS://Example.com/Path/") == "https://example.com/Path"
    assert normalize_url("https://example.com/") == "https://example.com"


def test_normalize_url_preserves_query_and_fragment():
    assert normalize_url("https://x.com/a?b=1#c") == "https://x.com/a?b=1#c"


def test_bookmark_id_is_stable_for_same_normalized_url():
    a = bookmark_id_for(normalize_url("https://example.com/"))
    b = bookmark_id_for(normalize_url("https://example.com"))
    assert a == b


def test_build_canonical_snapshot_new_vs_existing():
    from app.capabilities.bookmark_audit.models import RawBookmark

    raw = [RawBookmark(url="https://a.com", title="A", folder_path=("F",), browser="chrome", date_added=None)]
    fresh = build_canonical_snapshot(raw, previous={})
    assert fresh[0].status == "new"

    prev = {fresh[0].bookmark_id: fresh[0]}
    second = build_canonical_snapshot(raw, previous=prev)
    assert second[0].status == "existing"
    assert second[0].first_seen == fresh[0].first_seen


def test_build_canonical_snapshot_duplicated_url_never_falsely_flags_moved():
    # Regression test: a bookmark_id with 2 occurrences in BOTH runs must
    # never get a spurious moved_candidate — see snapshot.py docstring.
    from app.capabilities.bookmark_audit.models import RawBookmark

    raw = [
        RawBookmark(url="https://dup.com", title="D1", folder_path=("F1",), browser="chrome", date_added=None),
        RawBookmark(url="https://dup.com", title="D2", folder_path=("F2",), browser="chrome", date_added=None),
    ]
    first_run = build_canonical_snapshot(raw, previous={})
    prev = {}
    for cb in first_run:
        prev[cb.bookmark_id] = cb  # simulates load_previous_snapshot's last-write-wins

    second_run = build_canonical_snapshot(raw, previous=prev)
    assert all(cb.previous_folder_path is None for cb in second_run)


def test_detect_duplicates_first_occurrence_not_flagged():
    a = CanonicalBookmark(
        bookmark_id="x", url="https://a.com", normalized_url="https://a.com", title="A",
        folder_path=(), browser="chrome", date_added=None, first_seen="t", last_seen="t", status="new",
    )
    b = CanonicalBookmark(
        bookmark_id="x", url="https://a.com", normalized_url="https://a.com", title="A2",
        folder_path=(), browser="safari", date_added=None, first_seen="t", last_seen="t", status="new",
    )
    flags = detect_duplicates([a, b])
    assert flags == {0: False, 1: True}


# ── classify ─────────────────────────────────────────────────────────────────

def test_extract_domain_handles_port_and_userinfo():
    assert extract_domain("https://user@github.com:443/repo") == "github.com"


def test_classify_source_type_and_project():
    b = CanonicalBookmark(
        bookmark_id="1", url="https://github.com/foo/bar", normalized_url="https://github.com/foo/bar",
        title="My repo", folder_path=("Bookmarks Bar", "Coding Projects"), browser="chrome",
        date_added=None, first_seen="t", last_seen="t", status="new",
    )
    cls = classify(b)
    assert cls.source_type == "code_repo"
    assert cls.project == "Coding Projects"


def test_classify_unfiled_when_only_generic_folder():
    b = CanonicalBookmark(
        bookmark_id="1", url="https://example.com", normalized_url="https://example.com",
        title="Nothing special", folder_path=("Bookmarks Bar",), browser="chrome",
        date_added=None, first_seen="t", last_seen="t", status="new",
    )
    cls = classify(b)
    assert cls.project == "unfiled"


# ── recommend ────────────────────────────────────────────────────────────────

def _cls(**overrides):
    base = dict(project="unfiled", topic="general", domain="x.com", source_type="general", priority="medium")
    base.update(overrides)
    return Classification(**base)


def test_recommend_dead_link_wins_over_everything():
    rec, reason = recommend(
        classification=_cls(project="Music"),
        dead_link=DeadLinkResult(checked=True, dead=True, http_status=404, reason="http_error"),
        is_duplicate=True,
    )
    assert rec == "delete_candidate"


def test_recommend_duplicate_when_not_dead():
    rec, _ = recommend(
        classification=_cls(project="Music"),
        dead_link=DeadLinkResult(checked=True, dead=False, http_status=200, reason="ok"),
        is_duplicate=True,
    )
    assert rec == "merge_duplicate"


def test_recommend_review_when_unfiled_and_no_signal():
    rec, _ = recommend(
        classification=_cls(project="unfiled", topic="general", source_type="general"),
        dead_link=DeadLinkResult(checked=True, dead=False, http_status=200, reason="ok"),
        is_duplicate=False,
    )
    assert rec == "review"


def test_recommend_move_when_unfiled_but_has_signal():
    rec, _ = recommend(
        classification=_cls(project="unfiled", topic="music", source_type="general"),
        dead_link=DeadLinkResult(checked=True, dead=False, http_status=200, reason="ok"),
        is_duplicate=False,
    )
    assert rec == "move"


def test_recommend_archive_when_filed_but_low_priority():
    rec, _ = recommend(
        classification=_cls(project="Old Project", priority="low"),
        dead_link=DeadLinkResult(checked=True, dead=False, http_status=200, reason="ok"),
        is_duplicate=False,
    )
    assert rec == "archive"


def test_recommend_keep_when_filed_and_relevant():
    rec, _ = recommend(
        classification=_cls(project="Active Project", priority="high"),
        dead_link=DeadLinkResult(checked=True, dead=False, http_status=200, reason="ok"),
        is_duplicate=False,
    )
    assert rec == "keep"


def test_all_six_recommendation_types_are_reachable():
    cases = [
        (_cls(), DeadLinkResult(True, True, 500, "http_error"), False, "delete_candidate"),
        (_cls(), DeadLinkResult(True, False, 200, "ok"), True, "merge_duplicate"),
        (_cls(project="unfiled", topic="general", source_type="general"), DeadLinkResult(True, False, 200, "ok"), False, "review"),
        (_cls(project="unfiled", topic="ai"), DeadLinkResult(True, False, 200, "ok"), False, "move"),
        (_cls(project="P", priority="low"), DeadLinkResult(True, False, 200, "ok"), False, "archive"),
        (_cls(project="P", priority="high"), DeadLinkResult(True, False, 200, "ok"), False, "keep"),
    ]
    for cls, dl, dup, expected in cases:
        rec, _ = recommend(classification=cls, dead_link=dl, is_duplicate=dup)
        assert rec == expected, f"expected {expected}, got {rec} for {cls}"


# ── deadlinks status classification ─────────────────────────────────────────

def test_auth_gated_statuses_are_not_treated_as_dead():
    # Regression test: a live proof run initially flagged claude.ai/openai
    # billing pages (403, because the check has no session cookie) as dead.
    assert _ACCESS_RESTRICTED_STATUSES == frozenset({401, 403, 429})
