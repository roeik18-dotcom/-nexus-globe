"""Merlin OS · Intent bridge (Voice Track → Platform Track).

Turns an STT transcript into an `intent.classified` event on the platform bus. This
is the seam between the two tracks: an intent can originate from voice STT *or* from
anywhere else — the platform only sees `intent.classified`.

SCOPE / honesty:
- This is a v0 **keyword classifier**, NOT the STT and NOT a solution to the
  Command-STT reliability blocker (that is the separate Voice Track). It maps whatever
  text STT produced → an intent. If STT delivers wrong/empty text, this correctly
  yields `unknown` at low confidence (I-4) rather than fabricating.
- Not wired into the live launchd service yet — that hot-patch is a separate,
  approved step. This module is built + tested in isolation first.
"""
from __future__ import annotations

from typing import Optional

from .events import Event, EventBus, new_event

# intent -> trigger keywords (Hebrew + English). v0, deliberately simple + transparent.
_KEYWORDS: dict[str, list[str]] = {
    "stop":        ["שקט", "עצור", "די", "stop", "quiet", "enough"],
    "ask_time":    ["מה השעה", "השעה", "שעה", "time", "clock", "what time"],
    "ask_status":  ["סטטוס", "מה קורה", "מה המצב", "status", "what's going on"],
    "ask_weather": ["מזג", "מזג האוויר", "גשם", "weather", "rain", "forecast"],
    "day_opener":  ["פתיח יום", "בוקר טוב", "תדרוך", "morning", "day opener", "brief"],
    "open_app":    ["פתח", "תפתח", "open", "launch"],
}


# app targets for open_app (Hebrew + English). Ableton AND Pro Tools, plus common apps.
_APPS: dict[str, list[str]] = {
    "ableton":   ["ableton", "אבלטון"],
    "pro_tools": ["pro tools", "protools", "פרו טולס", "פרוטולס"],
    "chrome":    ["chrome", "כרום"],
    "vscode":    ["vscode", "vs code", "קוד"],
    "terminal":  ["terminal", "טרמינל"],
}


def detect_app(text: str) -> Optional[str]:
    t = (text or "").lower()
    for app, kws in _APPS.items():
        if any(k.lower() in t for k in kws):
            return app
    return None


def classify(text: str) -> tuple[str, float]:
    """Return (intent, confidence in [0,1]). Unknown → ('unknown', low)."""
    if not text or not text.strip():
        return "unknown", 0.0
    t = text.strip().lower()
    best_intent, best_score = "unknown", 0.2
    for intent, kws in _KEYWORDS.items():
        hits = [k for k in kws if k.lower() in t]
        if not hits:
            continue
        # longer keyword match = stronger signal; multiple hits raise confidence
        strength = max(len(k) for k in hits)
        score = min(0.95, 0.6 + 0.05 * len(hits) + 0.01 * strength)
        if score > best_score:
            best_intent, best_score = intent, score
    return best_intent, round(best_score, 2)


def to_bus(bus: EventBus, text: str, *, actor: str = "mos.intent",
           correlation_id: Optional[str] = None) -> Event:
    """Classify a transcript and emit intent.classified on the bus."""
    intent, conf = classify(text)
    payload = {"intent": intent, "confidence": conf, "transcript": text}
    if intent == "open_app":
        payload["target"] = detect_app(text)      # which app: ableton / pro_tools / …
    return bus.publish(new_event(
        "intent.classified", actor, f"intent:{intent}",
        payload, correlation_id=correlation_id or f"turn::{intent}"))


def _demo() -> None:
    samples = ["מרלין מה השעה עכשיו", "שקט", "בוקר טוב מרלין תעשה תדרוך",
               "open ableton", "", "בלה בלה משהו לא ברור"]
    for s in samples:
        intent, conf = classify(s)
        print(f"{conf:.2f}  {intent:<11}  ← {s!r}")


if __name__ == "__main__":
    _demo()
