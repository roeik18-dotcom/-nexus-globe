"""DayOpeningPlanner — turns collected DomainStatus objects into the
12-section Master Day Opening's synthesis: open-loop classification (A-E),
the prioritized top-3 outcomes (whole-day, not per-domain), the Philos
imbalance assessment, and the final closing block. Pure logic, no I/O, no
LLM calls anywhere — testable without a microphone, TTS, or any collector
actually running.
"""

from __future__ import annotations

from service.day_opening_models import (
    DayOpeningReport,
    DomainStatus,
    FinalOrientation,
    ImbalanceAssessment,
    Lifecycle,
    OpenLoopClass,
    OutcomeCandidate,
    PriorityItem,
    Provenance,
)

# Section 2's canonical domain order for the synthesis line — matches the
# spec's System Status list (World, Human, Music, Studio, Nexus, Course,
# Professional Readiness, Philos, Merlin, Personal Orientation, Behavior).
_SYNTHESIS_ORDER = [
    ("world_external", "עולם"),
    ("human_config", "אדם"),
    ("music_config", "מוזיקה"),
    ("studio", "אולפן"),
    ("nexus_globe", "נקסוס"),
    ("course", "קורס"),
    ("professional_readiness", "מקצועיות"),
    ("philos", "Philos"),
    ("merlin", "Merlin"),
    ("personal_orientation", "אוריינטציה אישית"),
    ("behavior_physical", "מציאות פיזית"),
]

MAX_OUTCOMES = 3

# Section 3's open-loop priority — used both to pick the single "surface
# first" headline open loop (section 12) and to order the open-loops list
# (section 3). Lower number = higher priority to surface.
_OPEN_LOOP_ORDER = {
    OpenLoopClass.BLOCKED: 0,
    OpenLoopClass.UNFINISHED: 1,
    OpenLoopClass.WAITING: 2,
    OpenLoopClass.ACTIVE: 3,
    OpenLoopClass.COMPLETED: 4,
}


def build_synthesis_lines(domains: list[DomainStatus]) -> list[str]:
    by_id = {d.domain: d for d in domains}
    lines = []
    for domain_id, label in _SYNTHESIS_ORDER:
        d = by_id.get(domain_id)
        if d is None:
            lines.append(f"{label} — UNKNOWN")
            continue
        state = d.summary_he if d.provenance != Provenance.UNKNOWN else "UNKNOWN"
        lines.append(f"{label} — {state}")
    return lines


def classify_open_loop(d: DomainStatus) -> OpenLoopClass:
    """Section 3's A-E classification, derived only from fields the domain
    itself already reported — never set arbitrarily by the planner or a
    collector.

    BLOCKED:    a real, specific blocker or a collector error exists.
    WAITING:    no trustworthy data source exists at all (UNKNOWN) — this is
                passively pending on infrastructure that doesn't exist yet,
                distinct from an active obstruction.
    COMPLETED:  lifecycle explicitly reached MASTER_FINAL, or the domain has
                verified data with no next action and nothing unfinished.
    UNFINISHED: a known DRAFT/MAPPING/VALIDATION lifecycle, or an explicit
                unfinished_he note, with no active blocker.
    ACTIVE:     a real next action exists with no blocker and no unfinished
                marker — genuinely in progress, not stuck.
    """
    if d.error or d.blocker_he:
        return OpenLoopClass.BLOCKED
    if d.provenance == Provenance.UNKNOWN:
        return OpenLoopClass.WAITING
    if d.lifecycle == Lifecycle.MASTER_FINAL:
        return OpenLoopClass.COMPLETED
    if d.lifecycle in (Lifecycle.DRAFT, Lifecycle.MAPPING, Lifecycle.VALIDATION) or d.unfinished_he:
        return OpenLoopClass.UNFINISHED
    if d.next_action_he:
        return OpenLoopClass.ACTIVE
    return OpenLoopClass.COMPLETED


def build_open_loops(domains: list[DomainStatus]) -> list[DomainStatus]:
    """Classifies every domain in place (sets `.open_loop`) and returns a
    NEW list ordered so the highest-value open loop surfaces first (section
    3's explicit requirement) — `domains` itself keeps its original
    collection order for section 2's System Status presentation."""
    for d in domains:
        d.open_loop = classify_open_loop(d)
    return sorted(
        domains,
        key=lambda d: (_OPEN_LOOP_ORDER[d.open_loop], 0 if (d.next_action_he or d.blocker_he) else 1),
    )


def apply_what_changed(domains: list[DomainStatus], previous_domains: list[dict] | None) -> None:
    """Mutates domains in place. Only ever states WHETHER something changed
    since the last persisted run — never WHAT changed in specific terms, since
    no LLM is used anywhere in this pipeline to summarize a diff, and
    inventing specifics the data doesn't support would violate the no-
    fabrication rule. `previous_domains` is the previous run's already-
    persisted `report.to_dict()["domains"]` list, or None for "no prior run"."""
    if previous_domains is None:
        return
    prev_by_domain = {p.get("domain"): p for p in previous_domains}
    for d in domains:
        prev = prev_by_domain.get(d.domain)
        if prev is None:
            d.what_changed_he = "תחום חדש שלא נאסף בפתיחה הקודמת."
        elif prev.get("summary_he") != d.summary_he:
            d.what_changed_he = "המצב בתחום השתנה מאז הפתיחה הקודמת."
        else:
            d.what_changed_he = ""


def assess_imbalance(
    personal: DomainStatus | None, behavior: DomainStatus | None,
) -> ImbalanceAssessment:
    """Section 9 — only ever states a real imbalance when BOTH the personal-
    orientation and behavioral-evidence domains are themselves FACT/DERIVED.
    Today that's never true (see collect_philos_personal_orientation /
    collect_behavior_physical — no data source exists for either), so this
    always returns UNKNOWN in practice. That is the correct, spec-mandated
    behavior, not a bug: 'insufficient data' rather than a fabricated
    imbalance statement."""
    if (
        personal is None or behavior is None
        or personal.provenance == Provenance.UNKNOWN
        or behavior.provenance == Provenance.UNKNOWN
    ):
        return ImbalanceAssessment(
            provenance=Provenance.UNKNOWN,
            statement_he=(
                "אין מספיק נתונים כדי לקבוע חוסר איזון בין פעילות שכלית/פנימית "
                "לפעילות גופנית/חיצונית."
            ),
        )
    # No real evidence-derivation model exists yet even when both inputs are
    # verified — unreachable today (both are always UNKNOWN), a placeholder
    # for when a real personal/behavioral data source is wired in.
    return ImbalanceAssessment(
        provenance=Provenance.DERIVED,
        statement_he="נתונים זמינים, אך לא קיים עדיין מודל השוואה — לא מדווח חוסר איזון ספציפי.",
    )


def _score(candidate: OutcomeCandidate) -> tuple:
    """Higher tuple sorts first. Priority order per section 4:
    1. blocker removal, 2. dependency, 3. strategic value, 4. continuity, 5. executable today."""
    return (
        1 if candidate.blocker_removal else 0,
        1 if candidate.is_dependency else 0,
        candidate.strategic_value,
        1 if candidate.continuity_from_yesterday else 0,
        1 if candidate.executable_today else 0,
    )


def select_top_outcomes(candidates: list[OutcomeCandidate], *, max_outcomes: int = MAX_OUTCOMES) -> list[str]:
    """Whole-day cap, NOT per-domain — the whole point of the max-3 rule."""
    ranked = sorted(candidates, key=_score, reverse=True)
    return [c.text_he for c in ranked[:max_outcomes]]


def choose_next_action(top_outcomes: list[str], candidates: list[OutcomeCandidate]) -> str:
    """Exactly one NEXT ACTION NOW — the single highest-ranked outcome, if
    any real (executable, non-empty) candidate exists. UNKNOWN-only days
    produce an honest fallback rather than a fabricated action."""
    if not candidates:
        return "אין מספיק מידע אמין כדי לקבוע פעולה הבאה — יש להשלים את איסוף הנתונים תחילה."
    ranked = sorted(candidates, key=_score, reverse=True)
    return ranked[0].text_he


def build_priorities(
    candidates: list[OutcomeCandidate], imbalance: ImbalanceAssessment,
) -> list[PriorityItem]:
    """Section 11 — a fixed 3-slot stack. PRIORITY 1/2 are the top work
    objectives (existing blocker/dependency/value ranking). PRIORITY 3 is
    reserved for the physical/personal balancing objective and is the honest
    'insufficient data' sentence when no verified imbalance exists (see
    assess_imbalance), never a padded or invented objective."""
    ranked = sorted(candidates, key=_score, reverse=True)
    work_items = [c.text_he for c in ranked[:2]]
    items = [PriorityItem(label=f"PRIORITY {i + 1}", text_he=t) for i, t in enumerate(work_items)]
    while len(items) < 2:
        items.append(PriorityItem(label=f"PRIORITY {len(items) + 1}", text_he="אין יעד עבודה מזוהה כרגע."))
    balance_text = imbalance.corrective_action_he or imbalance.statement_he
    items.append(PriorityItem(label="PRIORITY 3", text_he=balance_text))
    return items


def build_final_orientation(
    open_loops: list[DomainStatus], next_action_he: str, priorities: list[PriorityItem],
    imbalance: ImbalanceAssessment,
) -> FinalOrientation:
    """Section 12's fixed closing block."""
    main_open_loop = next(
        (d for d in open_loops if d.open_loop in (OpenLoopClass.BLOCKED, OpenLoopClass.UNFINISHED)),
        open_loops[0] if open_loops else None,
    )
    main_open_loop_he = (
        f"{main_open_loop.label_he}: "
        f"{main_open_loop.unfinished_he or main_open_loop.blocker_he or main_open_loop.summary_he}"
        if main_open_loop else "לא זוהה open loop."
    )
    main_direction_he = (
        priorities[0].text_he if priorities and priorities[0].text_he
        else "אין כיוון עבודה מזוהה כרגע — יש להשלים איסוף נתונים."
    )
    return FinalOrientation(
        main_direction_he=main_direction_he,
        main_open_loop_he=main_open_loop_he,
        next_action_he=next_action_he,
        philos_balance_he=imbalance.statement_he,
    )


def plan(
    domains: list[DomainStatus], candidates: list[OutcomeCandidate],
    *, previous_domains: list[dict] | None = None,
) -> DayOpeningReport:
    apply_what_changed(domains, previous_domains)
    open_loops = build_open_loops(domains)   # mutates .open_loop on each domain in place

    by_domain = {d.domain: d for d in domains}
    imbalance = assess_imbalance(
        by_domain.get("personal_orientation"), by_domain.get("behavior_physical"),
    )

    report = DayOpeningReport()
    report.domains = domains
    report.synthesis_lines_he = build_synthesis_lines(domains)
    report.top_outcomes_he = select_top_outcomes(candidates)          # legacy, kept for compat
    report.next_action_he = choose_next_action(report.top_outcomes_he, candidates)   # legacy, kept
    report.imbalance = imbalance
    report.priorities = build_priorities(candidates, imbalance)
    report.final = build_final_orientation(
        open_loops, report.next_action_he, report.priorities, imbalance,
    )
    return report
