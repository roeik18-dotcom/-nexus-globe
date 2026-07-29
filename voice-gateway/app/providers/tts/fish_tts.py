"""Fish Audio TTS provider.

Returns raw int16 PCM at 24 kHz — same wire format as OpenAI PCM output,
so AudioPlayer in merlin_service.py needs no changes.

Config (in .env):
    TTS_PROVIDER=fish_audio
    FISH_AUDIO_API_KEY=<bearer token from fish.audio>
    FISH_AUDIO_VOICE_ID=<model_id from the voice URL on fish.audio>
"""

import io
import logging
from math import gcd

import httpx
import numpy as np
from scipy.io import wavfile
from scipy.signal import resample_poly

from app.config import settings

logger = logging.getLogger(__name__)

_TARGET_SR = 24_000   # must match merlin_service._TTS_SR
_API_URL   = "https://api.fish.audio/v1/tts"


class FishAudioTTS:
    def __init__(self) -> None:
        self._api_key  = settings.fish_audio_api_key
        self._voice_id = settings.fish_audio_voice_id

    async def synthesize(self, text: str) -> bytes:
        if not text.strip():
            return b""

        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.post(
                _API_URL,
                headers={"Authorization": f"Bearer {self._api_key}"},
                json={
                    "text": text,
                    "reference_id": self._voice_id,
                    "format": "wav",
                    "normalize": True,
                    "latency": "normal",
                },
            )
            resp.raise_for_status()
            wav_bytes = resp.content

        sr, audio = wavfile.read(io.BytesIO(wav_bytes))

        if audio.dtype == np.int16:
            audio = audio.astype(np.float32) / 32768.0
        elif audio.dtype == np.int32:
            audio = audio.astype(np.float32) / 2_147_483_648.0
        else:
            audio = audio.astype(np.float32)

        if audio.ndim == 2:
            audio = audio.mean(axis=1)

        if sr != _TARGET_SR:
            g     = gcd(sr, _TARGET_SR)
            audio = resample_poly(audio, _TARGET_SR // g, sr // g).astype(np.float32)

        pcm = (np.clip(audio, -1.0, 1.0) * 32767).astype(np.int16)
        logger.info(
            "fish_audio voice=%s %d chars → %d samples at %d Hz (%d bytes)",
            self._voice_id, len(text), len(pcm), _TARGET_SR, pcm.nbytes,
        )
        return pcm.tobytes()
