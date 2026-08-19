"""Reusable Merlin -> (local | n8n) capability framework.

One declarative Action Registry + one generic execution pipeline. Capabilities
register an ActionSpec; the pipeline is generic and reads the spec — there are
no per-capability ad-hoc dispatch paths.

Isolation / collision boundaries (2026-08-12):
  - This package OWNS: app/capabilities/_framework/* and app/capabilities/registry.py
    and per-capability modules it registers (monthly_payment, table_report, ...).
  - It IMPORTS but never modifies the proven contract type
    app.integrations.n8n.client.StructuredResult (read-only dependency).
  - It must NEVER import or edit: app/capabilities/bookmark_audit/*, the n8n
    bookmark workflow, app/action_intent/{gate,dispatch}.py, service/*, Philos.
"""
