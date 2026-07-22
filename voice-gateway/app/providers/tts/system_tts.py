"""macOS `say` fallback TTS — no API key required."""

import asyncio
import io
import logging
import shutil
import subprocess
import tempfile
from pathlib import Path

logger = logging.getLogger(__name__)

_SAY_AVAILABLE = shutil.which("say") is not None


class SystemTTS:
    """Uses macOS `say` to speak text and captures the output as AIFF."""

    async def synthesize(self, text: str) -> bytes:
        if not text.strip():
            return b""
        if not _SAY_AVAILABLE:
            raise RuntimeError("`say` command not found — only available on macOS")

        # Prevent shell injection: pass text as a direct argument, never via shell=True
        with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as tmp:
            out_path = Path(tmp.name)

        try:
            proc = await asyncio.create_subprocess_exec(
                "say", "-o", str(out_path), text,
                stdout=asyncio.subprocess.DEVNULL,
                stderr=asyncio.subprocess.PIPE,
            )
            _, stderr = await proc.communicate()
            if proc.returncode != 0:
                raise RuntimeError(f"`say` exited {proc.returncode}: {stderr.decode()}")
            audio = out_path.read_bytes()
            logger.debug("system_tts synthesized %d chars → %d bytes", len(text), len(audio))
            return audio
        finally:
            out_path.unlink(missing_ok=True)
