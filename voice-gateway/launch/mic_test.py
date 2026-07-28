#!/usr/bin/env python3
"""
Minimal LaunchAgent mic sanity test.

Runs sounddevice.InputStream with default parameters, logs
np.max(np.abs(indata)) on every callback, then exits.
No Merlin code, no VAD, no queue, no Whisper, no resampling.

Usage (manual):
    python3 launch/mic_test.py

Usage (via minimal LaunchAgent):
    launch/mic_test_install.sh
"""

import logging
import os
import sys
import threading
from pathlib import Path

# allow running from repo root or from voice-gateway/
sys.path.insert(0, str(Path(__file__).parent.parent))

import numpy as np
import sounddevice as sd

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)-7s — %(message)s",
    stream=sys.stdout,
)
logger = logging.getLogger("mic_test")


def main() -> None:
    logger.info("=== mic_test environment ===")
    logger.info("pid          = %d", os.getpid())
    logger.info("uid          = %d", os.getuid())
    logger.info("sys.executable = %s", sys.executable)
    logger.info("cwd          = %s", os.getcwd())
    logger.info("sounddevice  = %s", sd.__version__)
    logger.info("portaudio    = %s", sd.get_portaudio_version())
    logger.info("callback_thread = %s (will be PortAudio thread)", threading.current_thread().name)
    logger.info("XPC_SERVICE_NAME = %s", os.environ.get("XPC_SERVICE_NAME", "<unset>"))
    logger.info("TERM_PROGRAM     = %s", os.environ.get("TERM_PROGRAM", "<unset>"))
    logger.info("LAUNCHD_SOCKET   = %s", os.environ.get("LAUNCHD_SOCKET", "<unset>"))

    logger.info("=== devices ===")
    logger.info("%s", sd.query_devices())
    logger.info("default device = %s", sd.default.device)

    def _cb(indata, frames, t, status) -> None:
        if status:
            logger.warning("stream status: %s", status)
        logger.info("max=%.6f  shape=%s", float(np.max(np.abs(indata))), indata.shape)

    logger.info("=== opening sd.InputStream(callback=_cb) — 30 s ===")
    with sd.InputStream(callback=_cb):
        sd.sleep(30_000)

    logger.info("=== mic_test done ===")


if __name__ == "__main__":
    main()
