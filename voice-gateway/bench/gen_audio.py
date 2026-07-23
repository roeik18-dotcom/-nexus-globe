"""
Generate test WAV files for repeatable benchmarks.

Uses macOS `say` (no API cost) by default.
Falls back to a pure-Python sine-wave WAV if `say` is not available
(Whisper will likely transcribe it as noise — only useful for latency
measurement, not STT accuracy).

Usage:
    # Single file:
    python bench/gen_audio.py [--phrase "text to record"] [--out bench/test.wav]

    # All canonical sentences → bench/audio/sentence_NN.wav:
    python bench/gen_audio.py --all
"""

import argparse
import io
import math
import struct
import subprocess
import sys
import tempfile
from pathlib import Path


def _sine_wav(text: str, sample_rate: int = 16_000, duration: float = 3.0) -> bytes:
    """Fallback: 440 Hz tone encoded as 16-bit PCM WAV. Whisper-unfriendly."""
    n_samples = int(sample_rate * duration)
    samples = [int(32767 * math.sin(2 * math.pi * 440 * i / sample_rate)) for i in range(n_samples)]
    buf = io.BytesIO()
    # WAV header
    data_size = n_samples * 2
    buf.write(b"RIFF")
    buf.write(struct.pack("<I", 36 + data_size))
    buf.write(b"WAVE")
    buf.write(b"fmt ")
    buf.write(struct.pack("<I", 16))       # chunk size
    buf.write(struct.pack("<H", 1))        # PCM
    buf.write(struct.pack("<H", 1))        # mono
    buf.write(struct.pack("<I", sample_rate))
    buf.write(struct.pack("<I", sample_rate * 2))
    buf.write(struct.pack("<H", 2))        # block align
    buf.write(struct.pack("<H", 16))       # bits per sample
    buf.write(b"data")
    buf.write(struct.pack("<I", data_size))
    for s in samples:
        buf.write(struct.pack("<h", s))
    return buf.getvalue()


def gen_with_say(phrase: str, out: Path) -> bool:
    """Use macOS `say` to generate AIFF then convert to WAV with ffmpeg or afconvert."""
    with tempfile.NamedTemporaryFile(suffix=".aiff", delete=False) as f:
        aiff_path = Path(f.name)
    try:
        result = subprocess.run(
            ["say", "-o", str(aiff_path), phrase],
            capture_output=True,
        )
        if result.returncode != 0:
            return False

        # Try ffmpeg first (better quality resampling)
        try:
            r = subprocess.run(
                ["ffmpeg", "-y", "-i", str(aiff_path),
                 "-ar", "16000", "-ac", "1", "-sample_fmt", "s16", str(out)],
                capture_output=True,
            )
            if r.returncode == 0:
                return True
        except FileNotFoundError:
            pass  # ffmpeg not installed — fall through to afconvert

        # Fallback: afconvert (macOS built-in, always available on macOS)
        try:
            r = subprocess.run(
                ["afconvert", "-f", "WAVE", "-d", "LEI16@16000", str(aiff_path), str(out)],
                capture_output=True,
            )
            return r.returncode == 0
        except FileNotFoundError:
            return False
    finally:
        aiff_path.unlink(missing_ok=True)


def _gen_one(phrase: str, out: Path) -> None:
    if gen_with_say(phrase, out):
        print(f"  ok   {out.name}  [{out.stat().st_size:,} bytes]  {phrase[:50]!r}")
    else:
        out.write_bytes(_sine_wav(phrase))
        print(f"  sine {out.name}  (fallback — Whisper accuracy unreliable)  {phrase[:50]!r}")


def main():
    parser = argparse.ArgumentParser(description="Generate test audio for benchmark")
    parser.add_argument("--phrase", default="מה מצב הפרויקט? תסביר בקצרה.")
    parser.add_argument("--out", default="bench/test.wav")
    parser.add_argument("--all", action="store_true",
                        help="Generate all sentences from bench/sentences.py into bench/audio/")
    args = parser.parse_args()

    if args.all:
        sys.path.insert(0, str(Path(__file__).parent.parent))
        from bench.sentences import SENTENCES
        out_dir = Path("bench/audio")
        out_dir.mkdir(parents=True, exist_ok=True)
        print(f"Generating {len(SENTENCES)} audio files → {out_dir}/\n")
        for i, phrase in enumerate(SENTENCES):
            _gen_one(phrase, out_dir / f"sentence_{i:02d}.wav")
        print(f"\nDone. Run benchmark with:\n  python bench/direct_bench.py --mode all\n")
        return

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    _gen_one(args.phrase, out)
    if not out.exists() or out.stat().st_size == 0:
        print("WARNING: Whisper will not transcribe sine-wave correctly. STT accuracy test requires real speech.")


if __name__ == "__main__":
    main()
