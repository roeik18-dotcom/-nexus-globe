"""JSON log consumer — first TraceBus subscriber.

Writes each TurnTrace as a single JSON line to the "nexus.observability" logger.
Wire it at startup:

    from app.trace_bus import trace_bus
    from app.observability.json_log import json_log_subscriber
    trace_bus.subscribe(json_log_subscriber)

Pipe the logger output to a file to get structured, grep-able turn history:

    NEXUS_TRACE_LOG=traces.jsonl python -m app.main
"""

import json
import logging
from dataclasses import asdict

from app.trace import TurnTrace

logger = logging.getLogger("nexus.observability")


def json_log_subscriber(trace: TurnTrace) -> None:
    """Serialize a TurnTrace to a single JSON line."""
    logger.info(json.dumps(asdict(trace), ensure_ascii=False))
