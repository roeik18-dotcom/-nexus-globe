"""The concrete Action Registry instance — the single declarative table of the
capabilities that are live this pass. Adding a capability is one register() line;
no pipeline change is ever required."""

from __future__ import annotations

from app.capabilities import (
    automation_actions, automation_lifecycle, echo_test, email_draft, email_send,
    gov_il_research, market_data, monthly_payment, philos_observe, philos_orientation,
    philos_transfer_execute, table_report, web_research,
)
from app.capabilities._framework.registry import ActionRegistry
from app.capabilities.commerce import price_compare, product_compare, shop_search


def build_registry() -> ActionRegistry:
    reg = ActionRegistry()
    reg.register(monthly_payment.SPEC)
    reg.register(table_report.SPEC)
    reg.register(web_research.SPEC)
    reg.register(market_data.SPEC)
    reg.register(shop_search.SPEC)
    reg.register(price_compare.SPEC)
    reg.register(product_compare.SPEC)
    reg.register(email_draft.SPEC)
    reg.register(email_send.SPEC)
    reg.register(automation_actions.SCHEDULE_REPORT_SPEC)
    reg.register(automation_actions.CONDITION_WATCH_SPEC)
    reg.register(gov_il_research.SPEC)
    reg.register(automation_lifecycle.LIST_AUTOMATIONS_SPEC)
    reg.register(automation_lifecycle.PAUSE_AUTOMATION_SPEC)
    reg.register(automation_lifecycle.RESUME_AUTOMATION_SPEC)
    reg.register(automation_lifecycle.CANCEL_AUTOMATION_SPEC)
    reg.register(echo_test.SPEC)
    reg.register(philos_orientation.SPEC)
    reg.register(philos_transfer_execute.SPEC)
    reg.register(philos_observe.SPEC)
    return reg


REGISTRY = build_registry()
