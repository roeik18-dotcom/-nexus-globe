"""Merlin OS · Calibration (v0, OPT-IN) — Learning → Cognition feedback.

Closes the learning feedback: priors nudge the INTENT confidence by *familiarity*
(an intent seen & handled before is slightly more trusted). This is an ENGINEERING
heuristic, deliberately trivial and transparent.

IMPORTANT (INV-9): this is NOT the Philos orientation calibration. Real calibration
(how orientation quality is scored/tuned) is locked theory owned by Roei. This is a
swappable pre-cognition confidence prior (INV-7), OFF by default so it never silently
changes committed behavior.
"""
from __future__ import annotations

from .learning import Priors


class Calibrator:
    version = "familiarity@0.0"

    def adjust(self, intent: str, raw_conf: float, priors: Priors) -> tuple[float, dict]:
        seen = priors.intents.get(intent, 0)
        boost = min(0.15, 0.03 * seen)          # capped familiarity boost
        adjusted = round(min(0.99, raw_conf + boost), 2)
        return adjusted, {"seen": seen, "boost": round(boost, 3),
                          "raw": raw_conf, "version": self.version}
