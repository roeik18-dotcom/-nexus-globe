"""DayOpeningRenderer — assembles the final spoken Hebrew text from a
DayOpeningReport, per the 12-section Master Day Opening spec. Pure string
assembly, no I/O, testable without hardware.

This is the ONLY place the final spoken text is built. It never calls an
LLM — every sentence is either a fixed template or a collector's/planner's
own pre-written field (summary_he/next_action_he/blocker_he/unfinished_he/
what_changed_he/imbalance.statement_he/priorities/final — nothing here is
generated or paraphrased by a model.

Rule (explicit, 2026-08-07 spec): no greeting, no "good morning", no
explanation that Day Opening is starting, no generic motivational speech —
begin immediately with content. No "how can I help?" or closing filler —
the text simply ends after the final orientation block.
"""

from __future__ import annotations

from service.day_opening_models import DayOpeningReport, DomainStatus, OpenLoopClass

OPENING_FRAME_HE = "היום מחולק בין בניית המערכת, בניית האדם ובניית היכולת המקצועית."

_OPEN_LOOP_ORDER = {
    OpenLoopClass.BLOCKED: 0,
    OpenLoopClass.UNFINISHED: 1,
    OpenLoopClass.WAITING: 2,
    OpenLoopClass.ACTIVE: 3,
    OpenLoopClass.COMPLETED: 4,
}
_OPEN_LOOP_LABEL_HE = {
    OpenLoopClass.BLOCKED: "חסום",
    OpenLoopClass.UNFINISHED: "לא גמור",
    OpenLoopClass.WAITING: "ממתין למקור נתונים",
    OpenLoopClass.ACTIVE: "פעיל",
    OpenLoopClass.COMPLETED: "הושלם",
}


def _render_domain(d: DomainStatus) -> str:
    if d.error:
        return f"{d.label_he}: לא ניתן היה לאסוף נתונים כרגע ({d.error})."
    parts = [f"{d.label_he}: {d.summary_he}"]
    if d.what_changed_he:
        parts.append(d.what_changed_he)
    if d.blocker_he:
        parts.append(f"חסם פעיל: {d.blocker_he}.")
    if d.unfinished_he:
        parts.append(f"לא גמור: {d.unfinished_he}")
    if d.next_action_he:
        parts.append(f"הצעד הבא בתחום הזה: {d.next_action_he}.")
    return " ".join(parts)


def _render_open_loops(domains: list[DomainStatus]) -> str:
    """Section 3 — never presents COMPLETED work as unfinished; surfaces the
    highest-value open loop first (same priority order as the planner)."""
    open_items = [d for d in domains if d.open_loop and d.open_loop != OpenLoopClass.COMPLETED]
    if not open_items:
        return "אין לולאות פתוחות מזוהות כרגע."
    ordered = sorted(open_items, key=lambda d: _OPEN_LOOP_ORDER[d.open_loop])
    parts = []
    for d in ordered:
        reason = d.unfinished_he or d.blocker_he or d.summary_he
        parts.append(f"{d.label_he} ({_OPEN_LOOP_LABEL_HE[d.open_loop]}): {reason}")
    return "עבודה לא גמורה, מהחשוב ביותר: " + "; ".join(parts) + "."


def render(report: DayOpeningReport, *, orientation_he: str = "") -> str:
    lines: list[str] = []

    lines.append(OPENING_FRAME_HE)
    if orientation_he:
        lines.append(orientation_he)

    for d in report.domains:
        lines.append(_render_domain(d))

    lines.append(_render_open_loops(report.domains))

    if report.synthesis_lines_he:
        lines.append("סיכום קצר: " + "; ".join(report.synthesis_lines_he) + ".")

    if report.imbalance:
        lines.append(f"איזון Philos: {report.imbalance.statement_he}")
        if report.imbalance.corrective_action_he:
            lines.append(f"פעולה מאזנת: {report.imbalance.corrective_action_he}")

    if report.priorities:
        pr = "; ".join(f"{p.label}: {p.text_he}" for p in report.priorities)
        lines.append(f"סדר עדיפויות להיום (מקסימום שלוש): {pr}.")

    if report.final:
        lines.append(f"כיוון היום: {report.final.main_direction_he}")
        lines.append(f"הלולאה הפתוחה המרכזית: {report.final.main_open_loop_he}")
        lines.append(f"הפעולה הבאה: {report.final.next_action_he}")
        lines.append(f"איזון Philos, סיכום: {report.final.philos_balance_he}")
    else:
        # legacy fallback — should not occur once plan() always sets .final,
        # kept only so a partially-built report never crashes the renderer.
        lines.append(f"הפעולה הראשונה שלך עכשיו היא: {report.next_action_he}")

    text = " ".join(l.strip() for l in lines if l and l.strip())
    report.full_text_he = text
    report.orientation_he = orientation_he
    return text
