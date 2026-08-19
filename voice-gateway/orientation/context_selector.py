"""CONTEXT SELECTOR — the composition seam.

Reactive path (a user question that domain_router classified into a domain):
    query -> domain_router.route() [BACKEND retrieval]
          -> map to orientation domain -> apply DomainPolicy (enabled gate)
          -> a small, provenance-tagged OrientationSlice for the prompt.

There is exactly ONE retriever (domain_router). Orientation only GATES and TAGS —
it never fetches source content itself, so no second knowledge path is created.

`enabled` is the only gate on reactive content: if domain_router routed the query
INTO a domain, the user asked about it, so proactivity/cooldown/inclusion (which
govern PROACTIVE surfacing via TopicSelector) do not suppress a direct answer.
"""
from __future__ import annotations

from dataclasses import dataclass, field

from .domains import default_policies
from .domain_router_bridge import orientation_id_for, route_domain_value, status_from_sources
from .policy import DomainPolicy
from .state import KnowledgeStatus


@dataclass
class OrientationSlice:
    domain_id: str | None                 # orientation domain id, or None for GENERAL
    route_domain: str = "general"
    context_text: str = ""                # the retrieved backend content (verbatim), gated
    status: KnowledgeStatus = KnowledgeStatus.UNKNOWN
    sources: list = field(default_factory=list)   # provenance (RouteResult.sources)
    policy_allowed: bool = True
    suppressed_reason: str = ""
    reason: str = ""


def _route(query: str, route_fn):
    if route_fn is not None:
        return route_fn(query)
    from app.domain_router import route as _r   # lazy: keeps orientation core import-light
    return _r(query)


class ContextSelector:
    """Composes the reactive retrieval backend with orientation policy."""

    def select_for_query(
        self,
        query: str,
        *,
        policies: dict[str, DomainPolicy] | None = None,
        route_fn=None,
    ) -> OrientationSlice:
        return self.select_from_route(_route(query, route_fn), policies=policies)

    def select_from_route(
        self,
        rr,
        *,
        policies: dict[str, DomainPolicy] | None = None,
    ) -> OrientationSlice:
        """Same policy gating as select_for_query, but from a PRE-COMPUTED route
        result — so callers that already routed once (e.g. to also gate memory by
        domain) do not route twice."""
        policies = policies or default_policies()
        dr_domain = route_domain_value(rr)
        oid = orientation_id_for(rr)

        if oid is None:  # GENERAL — no config dump for plain conversation (unchanged behavior)
            return OrientationSlice(domain_id=None, route_domain=dr_domain, context_text="",
                                    policy_allowed=True, suppressed_reason="general",
                                    reason="general conversation — no domain content injected")

        policy = policies.get(oid) or DomainPolicy()
        sources = list(getattr(rr, "sources", []) or [])
        status = status_from_sources(sources)

        if not policy.enabled:
            return OrientationSlice(
                domain_id=oid, route_domain=dr_domain, context_text="", status=status,
                sources=sources, policy_allowed=False, suppressed_reason="domain_disabled",
                reason=f"domain '{oid}' is disabled by policy — content withheld",
            )

        # allowed reactive answer: pass the backend content through, tagged with provenance/status.
        return OrientationSlice(
            domain_id=oid, route_domain=dr_domain,
            context_text=(getattr(rr, "context_text", "") or ""),
            status=status, sources=sources, policy_allowed=True,
            reason=f"routed to '{oid}' (reactive); enabled; status={status.value}",
        )
