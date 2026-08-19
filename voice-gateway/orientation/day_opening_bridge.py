"""DAY-OPENING BRIDGE — represent existing day_opening collectors in the new model.

Read-only adapter: it maps a day_opening `DomainStatus` (duck-typed, so no audio
imports are pulled) onto an orientation `DomainState`. It does NOT modify the
collectors, the planner, the renderer, or any audio code. This proves the existing
Day-Opening domains can flow through the domain model unchanged.
"""
from __future__ import annotations

from .domains import day_opening_domain_map
from .state import DomainItem, DomainState, KnowledgeStatus


def _prov_to_status(prov) -> KnowledgeStatus:
    name = getattr(prov, "name", None) or str(prov)
    name = name.upper()
    if name in KnowledgeStatus.__members__:
        return KnowledgeStatus[name]
    return KnowledgeStatus.UNKNOWN


def status_to_state(ds) -> DomainState:
    """Map one day_opening DomainStatus-like object to a DomainState.

    Uses getattr with defaults so a real DomainStatus OR a lightweight stub both
    work. `ds` must expose at least `.domain` and `.provenance`.
    """
    src_domain = getattr(ds, "domain", "")
    mapped_id = day_opening_domain_map().get(src_domain, src_domain)
    status = _prov_to_status(getattr(ds, "provenance", None))

    items: list[DomainItem] = []
    summary = getattr(ds, "summary_he", "") or ""
    open_loop = getattr(ds, "open_loop", None)
    # a domain is an "open loop" unless the planner marked it COMPLETED
    is_open = True
    if open_loop is not None:
        is_open = getattr(open_loop, "name", str(open_loop)).upper() != "COMPLETED"
    if summary:
        items.append(DomainItem(text=summary, status=status, open=is_open,
                                source=getattr(ds, "source", "") or ""))
    blocker = getattr(ds, "blocker_he", "") or ""
    if blocker:
        items.append(DomainItem(text=blocker, status=status, open=True, is_blocker=True,
                                source=getattr(ds, "source", "") or ""))
    unfinished = getattr(ds, "unfinished_he", "") or ""
    if unfinished:
        items.append(DomainItem(text=unfinished, status=status, open=True,
                                source=getattr(ds, "source", "") or ""))
    nxt = getattr(ds, "next_action_he", "") or ""
    if nxt:
        items.append(DomainItem(text=nxt, status=status, open=True, is_next_action=True,
                                source=getattr(ds, "source", "") or ""))

    unknown_reason = ""
    if status is KnowledgeStatus.UNKNOWN:
        unknown_reason = getattr(ds, "error", "") or summary or "no supporting source available"

    return DomainState(
        domain_id=mapped_id,
        status=status,
        items=items,
        confidence=getattr(ds, "confidence", None),
        source=getattr(ds, "source", "") or "",
        last_updated=getattr(ds, "timestamp", None),
        unknown_reason=unknown_reason,
    )


def day_opening_to_states(domains) -> dict[str, DomainState]:
    """Map a list of day_opening DomainStatus -> {orientation_domain_id: DomainState}."""
    out: dict[str, DomainState] = {}
    for ds in domains:
        st = status_to_state(ds)
        out[st.domain_id] = st
    return out
