"""TABLE_REPORT — a pure transform from provided data into the reusable report
artifact. It never fabricates a cell: every non-unknown cell must carry a source
that exists in `sources`; an unsourced value is rejected, and `unknown` stays
`unknown`. Deterministic given its inputs (no clock, no network)."""

from __future__ import annotations

from typing import Any, Mapping

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField,
    SideEffect, ValidationError,
)

ACTION_TYPE = "TABLE_REPORT"
_ALLOWED_VS = frozenset({"verified", "partial", "unverified"})


def _is_unknown(cell: Any) -> bool:
    if cell == "unknown":
        return True
    return isinstance(cell, Mapping) and cell.get("unknown") is True


def _normalize_cell(cell: Any, source_ids: set[str], where: str) -> dict:
    if _is_unknown(cell):
        return {"value": None, "unknown": True}
    if not isinstance(cell, Mapping) or "value" not in cell or "source" not in cell:
        raise ValidationError(f"{where}: cell must be {{value, source}} or unknown "
                              f"(no fabricated/unsourced cells)")
    sid = cell["source"]
    if sid not in source_ids:
        raise ValidationError(f"{where}: cell source {sid!r} is not in sources[]")
    return {"value": cell["value"], "source": sid, "unknown": False}


def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    """Pure transform: `request` is accepted for the generic handler signature and
    deliberately unused."""
    title = inputs["title"]
    summary = inputs["summary"]
    columns = inputs["columns"]
    rows = inputs["rows"]
    sources = inputs["sources"]
    generated_at = inputs["generated_at"]
    artifact_ref = inputs.get("artifact_ref")  # optional passthrough

    if not isinstance(title, str) or not isinstance(summary, str):
        raise ValidationError("title and summary must be strings")
    if not isinstance(generated_at, str) or not generated_at.strip():
        raise ValidationError("generated_at must be a non-empty ISO string (not fabricated)")
    if not isinstance(columns, list) or not all(isinstance(c, str) for c in columns):
        raise ValidationError("columns must be a list of strings")
    if not isinstance(rows, list):
        raise ValidationError("rows must be a list")
    if not isinstance(sources, list):
        raise ValidationError("sources must be a list")

    source_ids: set[str] = set()
    for i, s in enumerate(sources):
        if not isinstance(s, Mapping) or "id" not in s:
            raise ValidationError(f"sources[{i}] must be an object with an id")
        sid = s["id"]
        if sid in source_ids:
            raise ValidationError(f"duplicate source id: {sid!r}")
        source_ids.add(sid)

    ncols = len(columns)
    norm_rows: list[list[dict]] = []
    has_unknown = False
    for r, row in enumerate(rows):
        if not isinstance(row, list) or len(row) != ncols:
            raise ValidationError(f"rows[{r}] must have exactly {ncols} cells")
        norm_row = []
        for c, cell in enumerate(row):
            nc = _normalize_cell(cell, source_ids, f"rows[{r}][{c}]")
            has_unknown = has_unknown or nc["unknown"]
            norm_row.append(nc)
        norm_rows.append(norm_row)

    verification_status = "partial" if has_unknown else "verified"

    report = {
        "title": title,
        "summary": summary,
        "columns": list(columns),
        "rows": norm_rows,
        "sources": list(sources),
        "generated_at": generated_at,
        "verification_status": verification_status,
        "cell_count": ncols * len(norm_rows),
        "unknown_cells": sum(1 for row in norm_rows for cell in row if cell["unknown"]),
    }
    if artifact_ref is not None:
        report["artifact_ref"] = artifact_ref
    return report


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    """Re-check the invariants: rectangular table, every non-unknown cell sourced,
    verification_status consistent with the presence of unknowns."""
    try:
        columns = result["columns"]
        rows = result["rows"]
        source_ids = {s["id"] for s in result["sources"]}
    except (KeyError, TypeError):
        return False, "report missing structural fields"
    ncols = len(columns)
    unknowns = 0
    for row in rows:
        if len(row) != ncols:
            return False, "non-rectangular table"
        for cell in row:
            if cell.get("unknown"):
                unknowns += 1
            elif cell.get("source") not in source_ids:
                return False, "unsourced (fabricated) cell present"
    expected = "partial" if unknowns else "verified"
    if result.get("verification_status") != expected:
        return False, "verification_status inconsistent with unknown cells"
    return True, "table sourced and rectangular"


SPEC = ActionSpec(
    action_type=ACTION_TYPE,
    capability="table_report",
    executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY,
    approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE,
    timeout_s=1.0,
    max_retries=0,
    required_inputs=(
        InputField("title", (str,)),
        InputField("summary", (str,)),
        InputField("columns", (list,)),
        InputField("rows", (list,)),
        InputField("sources", (list,)),
        InputField("generated_at", (str,)),
    ),
    output_fields=("title", "summary", "columns", "rows", "sources", "generated_at", "verification_status"),
    verification="schema_and_sourcing_recheck",
    provenance_requirements=("every_cell_sourced_or_unknown",),
    intent_patterns=("table report", "דוח טבלה", "build a report"),
    handler=handler,
    verifier=verify,
)
