"""Parse raw bookmark-store bytes (as extracted by n8n) into RawBookmark
records. Input bytes are untrusted — parsing is defensive throughout:
malformed nodes are skipped, not raised on, so one bad entry can't abort the
whole audit.

Formats, confirmed by direct inspection of the real files on this Mac
(2026-08-12), not assumed from documentation:
  - Chrome: plain JSON. roots.{bookmark_bar,other,synced}, each a tree of
    {"type": "url"|"folder", "name", "url"?, "children"?, "date_added"?}.
    date_added is a WebKit/Chrome timestamp: microseconds since 1601-01-01.
  - Safari: Apple binary/XML plist. Tree of dicts with
    WebBookmarkType == "WebBookmarkTypeLeaf" (a bookmark: "URLString",
    title under URIDictionary.title) or "WebBookmarkTypeList" (a folder:
    "Title", "Children"). "WebBookmarkTypeProxy" nodes (History, smart
    folders) are skipped — they are not real user bookmarks.
"""

from __future__ import annotations

import json
import logging
import plistlib
from datetime import datetime, timezone

from app.capabilities.bookmark_audit.models import RawBookmark

logger = logging.getLogger("merlin.bookmark_audit")

_CHROME_EPOCH_OFFSET_SECONDS = 11_644_473_600  # 1601-01-01 -> 1970-01-01


def _chrome_timestamp_to_iso(raw: object) -> str | None:
    try:
        micros = int(raw)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
    if micros <= 0:
        return None
    unix_seconds = micros / 1_000_000 - _CHROME_EPOCH_OFFSET_SECONDS
    try:
        return datetime.fromtimestamp(unix_seconds, tz=timezone.utc).isoformat().replace("+00:00", "Z")
    except (OverflowError, OSError, ValueError):
        return None


def parse_chrome_bookmarks(raw_bytes: bytes) -> list[RawBookmark]:
    try:
        data = json.loads(raw_bytes)
    except (json.JSONDecodeError, UnicodeDecodeError):
        logger.warning("bookmark_audit: Chrome bookmarks file was not valid JSON")
        return []

    roots = data.get("roots")
    if not isinstance(roots, dict):
        return []

    out: list[RawBookmark] = []

    def walk(node: object, path: tuple[str, ...]) -> None:
        if not isinstance(node, dict):
            return
        node_type = node.get("type")
        if node_type == "url":
            url = node.get("url")
            if isinstance(url, str) and url:
                title = node.get("name")
                out.append(RawBookmark(
                    url=url,
                    title=title if isinstance(title, str) else url,
                    folder_path=path,
                    browser="chrome",
                    date_added=_chrome_timestamp_to_iso(node.get("date_added")),
                ))
        elif node_type == "folder":
            name = node.get("name")
            child_path = path + (name,) if isinstance(name, str) and name else path
            for child in node.get("children", []) or []:
                walk(child, child_path)

    for root_key, root_node in roots.items():
        if not isinstance(root_node, dict):
            continue
        root_name = root_node.get("name") if isinstance(root_node.get("name"), str) else root_key
        for child in root_node.get("children", []) or []:
            walk(child, (root_name,))

    return out


def parse_safari_bookmarks(raw_bytes: bytes) -> list[RawBookmark]:
    try:
        data = plistlib.loads(raw_bytes)
    except Exception:
        logger.warning("bookmark_audit: Safari bookmarks file was not a valid plist")
        return []

    out: list[RawBookmark] = []

    def walk(node: object, path: tuple[str, ...]) -> None:
        if not isinstance(node, dict):
            return
        node_type = node.get("WebBookmarkType")
        if node_type == "WebBookmarkTypeProxy":
            return  # smart folders (History, etc.) — not real user bookmarks
        if node_type == "WebBookmarkTypeLeaf":
            url = node.get("URLString")
            if isinstance(url, str) and url:
                uri_dict = node.get("URIDictionary")
                title = uri_dict.get("title") if isinstance(uri_dict, dict) else None
                if not isinstance(title, str) or not title:
                    title = node.get("Title") if isinstance(node.get("Title"), str) else url
                date_added = None
                reading_list = node.get("ReadingList")
                if isinstance(reading_list, dict):
                    da = reading_list.get("DateAdded")
                    if hasattr(da, "isoformat"):
                        # plistlib decodes plist <date> as a naive datetime
                        # that represents UTC (Apple's plist format has no
                        # timezone field) — attach tzinfo explicitly so this
                        # is never silently treated as local time downstream.
                        if da.tzinfo is None:
                            da = da.replace(tzinfo=timezone.utc)
                        date_added = da.isoformat().replace("+00:00", "Z")
                out.append(RawBookmark(
                    url=url, title=title, folder_path=path, browser="safari", date_added=date_added,
                ))
        elif node_type == "WebBookmarkTypeList":
            title = node.get("Title")
            child_path = path + (title,) if isinstance(title, str) and title else path
            for child in node.get("Children", []) or []:
                walk(child, child_path)

    for child in data.get("Children", []) or []:
        walk(child, ())

    return out
