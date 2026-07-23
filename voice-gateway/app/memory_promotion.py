"""Atomic promotion of a key–value pair into a persona's persistent memory JSON."""

import json
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_MEMORY_DIR = Path(__file__).parent.parent / "memory" / "persistent"


def promote(persona: str, key: str, value) -> None:
    """Set data[key] = value in memory/persistent/{persona}.json.

    Creates the file (and directory) if absent. Writes atomically via a
    sibling .tmp file so a crash mid-write never produces a corrupt JSON.
    """
    if not key or not key.strip():
        raise ValueError("key must be non-empty")

    _MEMORY_DIR.mkdir(parents=True, exist_ok=True)
    path = _MEMORY_DIR / f"{persona}.json"

    data: dict = {}
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))

    data[key.strip()] = value

    tmp = path.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    os.replace(tmp, path)

    logger.info("memory[%s] promoted key=%r", persona, key)
