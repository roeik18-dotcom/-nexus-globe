"""PRODUCT_COMPARE — pure attribute matrix across products/variants.

Hard rules (all tested):
  - every rendered cell carries a source + captured_at; an attribute value with
    no source is REJECTED (never rendered as fact, never synthesized);
  - absent data stays `unknown`;
  - different variants remain separate columns — never merged;
  - identity uncertainty is surfaced (`identity_confidence`, `not_comparable`);
  - no recommendation is produced unless explicit user `criteria` are supplied,
    and then only as a mechanical pass/fail derived from SOURCED cells.
"""

from __future__ import annotations

from typing import Any, Mapping, Optional

from app.capabilities._framework.models import (
    ActionSpec, ApprovalPolicy, Executor, Idempotency, InputField, SideEffect, ValidationError,
)
from app.capabilities.commerce import identity as ident

ACTION_TYPE = "PRODUCT_COMPARE"
_OPS = ("eq", "gte", "lte")


def _column_id(p: Mapping[str, Any]) -> str:
    return f'{p.get("canonical_product_id")}#{p.get("variant_key")}'


def compare(products: list, requested_attributes: list,
            criteria: Optional[list] = None) -> dict:
    columns, not_comparable, rejected_cells = [], [], []

    for i, p in enumerate(products):
        if not isinstance(p, Mapping):
            not_comparable.append({"index": i, "reason": "product is not an object"})
            continue
        cpid = ident._s(p.get("canonical_product_id"), 128)
        vkey = ident._s(p.get("variant_key"), 128)
        if not cpid:
            not_comparable.append({"index": i, "reason": "missing canonical_product_id — identity unknown"})
            continue
        conf = ident._s(p.get("identity_confidence"), 16) or ("medium" if vkey else "low")
        col = {"column_id": _column_id({"canonical_product_id": cpid, "variant_key": vkey}),
               "canonical_product_id": cpid, "variant_key": vkey,
               "title": ident._s(p.get("title")), "identity_confidence": conf, "cells": {}}
        if conf == "low" or not vkey:
            not_comparable.append({"column_id": col["column_id"],
                                   "reason": "identity_confidence low or variant_key absent — "
                                             "cannot guarantee same-variant comparison"})
        attrs = p.get("attributes")
        attrs = attrs if isinstance(attrs, Mapping) else {}
        for name in requested_attributes:
            entry = attrs.get(name)
            if not isinstance(entry, Mapping) or "value" not in entry:
                col["cells"][name] = ident.unknown("not provided")
                continue
            source = ident._s(entry.get("source"))
            if not source:
                rejected_cells.append({"column_id": col["column_id"], "attribute": name,
                                       "reason": "value supplied without source — rejected, not rendered"})
                col["cells"][name] = ident.unknown("value rejected: no source provenance")
                continue
            col["cells"][name] = {"value": entry["value"], "source": source,
                                  "captured_at": ident._s(entry.get("captured_at")), "unknown": False}
        columns.append(col)

    # Duplicate identities across columns would mean two rows for the same thing.
    seen: dict[str, int] = {}
    for c in columns:
        seen[c["column_id"]] = seen.get(c["column_id"], 0) + 1
    for cid, n in seen.items():
        if n > 1:
            not_comparable.append({"column_id": cid, "reason": f"{n} columns share one identity — ambiguous"})

    result = {
        "requested_attributes": list(requested_attributes),
        "columns": columns,
        "matrix": [{"attribute": a, "values": {c["column_id"]: c["cells"].get(a, ident.unknown())
                                               for c in columns}} for a in requested_attributes],
        "not_comparable": not_comparable,
        "rejected_cells": rejected_cells,
        "coverage": {"products": len(columns), "attributes": len(requested_attributes),
                     "rejected_cells": len(rejected_cells), "not_comparable": len(not_comparable)},
    }

    # Recommendation ONLY from explicit criteria, evaluated mechanically on sourced cells.
    if criteria:
        evals = []
        for c in criteria:
            if not isinstance(c, Mapping) or c.get("op") not in _OPS or "attribute" not in c:
                raise ValidationError(f"criterion must be {{attribute, op in {_OPS}, value}}")
            per_col = {}
            for col in columns:
                cell = col["cells"].get(c["attribute"])
                if cell is None or cell.get("unknown"):
                    per_col[col["column_id"]] = "cannot_evaluate_unknown"
                    continue
                v, target = cell["value"], c.get("value")
                try:
                    if c["op"] == "eq":
                        per_col[col["column_id"]] = "pass" if v == target else "fail"
                    elif c["op"] == "gte":
                        per_col[col["column_id"]] = "pass" if float(v) >= float(target) else "fail"
                    else:
                        per_col[col["column_id"]] = "pass" if float(v) <= float(target) else "fail"
                except (TypeError, ValueError):
                    per_col[col["column_id"]] = "cannot_evaluate_type"
            evals.append({"criterion": dict(c), "results": per_col})
        result["criteria_evaluation"] = {
            "evaluations": evals,
            "basis": "mechanical pass/fail over sourced cells only; unknown never counted as pass",
        }
    return result


def handler(inputs: Mapping[str, Any], request: Any = None) -> dict[str, Any]:
    products = inputs["products"]
    attrs = inputs["requested_attributes"]
    if not products:
        raise ValidationError("products must be a non-empty list")
    if not attrs or not all(isinstance(a, str) for a in attrs):
        raise ValidationError("requested_attributes must be a non-empty list of strings")
    criteria = inputs.get("criteria")
    if criteria is not None and not isinstance(criteria, list):
        raise ValidationError("criteria must be a list when provided")
    return compare(list(products), list(attrs), criteria)


def verify(inputs: Mapping[str, Any], result: Mapping[str, Any]) -> tuple[bool, str]:
    if not result.get("columns"):
        return False, "no identifiable products to compare"
    for row in result.get("matrix", []):
        for col_id, cell in row["values"].items():
            if not cell.get("unknown") and not cell.get("source"):
                return False, f"unsourced cell rendered for {col_id}/{row['attribute']}"
    nc = result.get("not_comparable") or []
    if nc:
        return True, f"partial: {len(nc)} identity/comparability issue(s) surfaced"
    return True, f"{len(result['columns'])} product(s) compared, all cells sourced or unknown"


def to_table_report_inputs(result: Mapping[str, Any], *, title: str, generated_at: str) -> dict:
    sources, seen = [], {}

    def sid(name):
        if name not in seen:
            s = f"s{len(seen) + 1}"
            seen[name] = s
            sources.append({"id": s, "name": name})
        return seen[name]

    col_ids = [c["column_id"] for c in result.get("columns", [])]
    rows = []
    for row in result.get("matrix", []):
        cells = [{"value": row["attribute"], "source": sid("comparison-request")}]
        for cid in col_ids:
            cell = row["values"].get(cid) or ident.unknown()
            if cell.get("unknown"):
                cells.append("unknown")
            else:
                cells.append({"value": cell["value"], "source": sid(cell["source"])})
        rows.append(cells)
    return {
        "title": title,
        "summary": (f'{len(col_ids)} product/variant column(s), '
                    f'{result["coverage"]["rejected_cells"]} unsourced cell(s) rejected, '
                    f'{result["coverage"]["not_comparable"]} comparability issue(s)'),
        "columns": ["attribute", *col_ids],
        "rows": rows, "sources": sources, "generated_at": generated_at,
    }


SPEC = ActionSpec(
    action_type=ACTION_TYPE, capability="product_compare", executor=Executor.LOCAL,
    side_effect=SideEffect.READ_ONLY, approval_policy=ApprovalPolicy.NONE,
    idempotency=Idempotency.PURE, timeout_s=2.0, max_retries=0,
    required_inputs=(
        InputField("products", (list,)),
        InputField("requested_attributes", (list,)),
        InputField("criteria", (list,), required=False),
    ),
    output_fields=("columns", "matrix", "not_comparable", "rejected_cells", "coverage"),
    verification="every_rendered_cell_sourced_and_identity_surfaced",
    provenance_requirements=("per_cell_source", "captured_at", "identity_confidence"),
    intent_patterns=("product compare", "compare products", "השוואת מוצרים"),
    handler=handler, verifier=verify,
)
