"""ORIENTATION LAYER — the single prompt-injection layer (compose, not duplicate).

Drop-in superset of app.context_builder.DomainRoutedLayer: it renders the SAME
routed content, but first passes it through orientation policy (the `enabled` gate).
With default policies (all enabled) its output is byte-identical to DomainRoutedLayer,
so wiring it in place of DomainRoutedLayer changes nothing until an operator disables
a domain. It implements the ContextLayer protocol (`render() -> str`).
"""
from __future__ import annotations

import logging

from .context_selector import ContextSelector, OrientationSlice
from .policy import DomainPolicy

_log = logging.getLogger("merlin.orientation")


class OrientationLayer:
    def __init__(self, slice_: OrientationSlice | None) -> None:
        self._slice = slice_

    @classmethod
    def for_query(cls, query: str, *, policies: dict[str, DomainPolicy] | None = None,
                  route_fn=None) -> "OrientationLayer":
        sl = ContextSelector().select_for_query(query, policies=policies, route_fn=route_fn)
        return cls(sl)

    @classmethod
    def from_route(cls, route_result, *, policies: dict[str, DomainPolicy] | None = None) -> "OrientationLayer":
        return cls(ContextSelector().select_from_route(route_result, policies=policies))

    @property
    def slice(self) -> OrientationSlice | None:
        return self._slice

    def render(self) -> str:
        sl = self._slice
        if sl is None or not sl.policy_allowed:
            return ""                       # GENERAL or policy-disabled -> inject nothing
        content = (sl.context_text or "").strip()
        dom = (sl.domain_id or "general").upper()
        src_names = []
        for s in (sl.sources or []):
            p = getattr(s, "path", "") or (s.get("path", "") if isinstance(s, dict) else "")
            b = str(p).split("/")[-1]
            if b and b not in src_names:
                src_names.append(b)
        # PHASE 5 diagnostics — char counts + source names only, never workbook content.
        _log.info("DOMAIN_SELECTED domain=%s", sl.domain_id)
        _log.info("DOMAIN_CONTEXT_COUNT count=%d", len(sl.sources or []))
        _log.info("DOMAIN_CONTEXT_CHARS chars=%d", len(content))
        _log.info("DOMAIN_CONTEXT_SOURCE_IDS ids=%s", src_names[:6])
        if not content:
            _log.info("FINAL_PROMPT_DOMAIN_CONTEXT_CHARS chars=0")
            return ""
        # PHASE 5: make the domain content the AUTHORITATIVE section so the answer
        # follows it instead of the generic persona bio / stale Philos memory.
        header = (
            f"[ACTIVE DOMAIN: {dom}]\n"
            "The block below is the AUTHORITATIVE source material for the user's CURRENT question, "
            "retrieved from this domain's master. Answer the current question using THIS content as the "
            "primary source. Do NOT substitute any other project, persona, progress report, or unrelated "
            "memory for it. If this content does not cover the question, say explicitly what is missing "
            "— do not switch to another domain.\n\n"
        )
        final = header + content
        _log.info("FINAL_PROMPT_DOMAIN_CONTEXT_CHARS chars=%d", len(final))
        return final
