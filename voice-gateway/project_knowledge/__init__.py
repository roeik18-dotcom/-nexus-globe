"""Project Knowledge Layer for Merlin.

Read-only retrieval over local project files with full provenance (path + line range),
freshness by content hash, and a strict SOURCE_FACT / INFERENCE / UNKNOWN truth contract.

Public API:
    from project_knowledge import api
    api.search(query, project=None, limit=8)
    api.read_source(path, line_start=None, line_end=None)
    api.projects(); api.sources(project)
    api.answer_context(query)            # retrieval envelope for the LLM

    from project_knowledge.indexer import reindex
    from project_knowledge import integration, observability
"""
from . import api, retrieval, indexer, integration, observability, config  # noqa: F401

__all__ = ["api", "retrieval", "indexer", "integration", "observability", "config"]
