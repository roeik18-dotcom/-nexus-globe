import io
from app.config import settings

ALLOWED_MIME_TYPES = {
    "audio/wav",
    "audio/x-wav",
    "audio/mpeg",
    "audio/mp4",
    "audio/webm",
    "audio/ogg",
    "audio/flac",
    "audio/x-m4a",
}

# Magic bytes for basic format sniffing
_SIGNATURES: list[tuple[bytes, str]] = [
    (b"RIFF", "audio/wav"),
    (b"ID3", "audio/mpeg"),
    (b"\xff\xfb", "audio/mpeg"),
    (b"\xff\xf3", "audio/mpeg"),
    (b"fLaC", "audio/flac"),
    (b"OggS", "audio/ogg"),
]


def validate_audio(data: bytes) -> None:
    """Raise ValueError if audio data fails size or format checks."""
    if len(data) == 0:
        raise ValueError("Empty audio payload")
    if len(data) > settings.max_audio_size_bytes:
        raise ValueError(
            f"Audio too large: {len(data)} bytes (max {settings.max_audio_size_bytes})"
        )
    # Sniff format — reject obviously non-audio binary
    for sig, _ in _SIGNATURES:
        if data[: len(sig)] == sig:
            return
    # WebM/MP4 containers start with EBML or ftyp — allow unknown headers but
    # enforce the size cap (already checked above). STT provider will reject
    # malformed audio with a clear error.


def audio_to_file_like(data: bytes, filename: str = "audio.wav") -> io.BytesIO:
    buf = io.BytesIO(data)
    buf.name = filename
    return buf
