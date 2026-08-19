"""Ensure the repo root (parent of agent_os/) is importable, regardless of the
pytest rootdir / cwd, so `import agent_os` resolves without depending on
voice-gateway being on the path."""

import pathlib
import sys

_ROOT = pathlib.Path(__file__).resolve().parents[2]  # tests -> agent_os -> repo root
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))
