"""Isolation + zero-side-effect proofs.

1. `import agent_os` must pull in NOTHING from voice-gateway (service/app/mos) and
   NOT the top-level `kernel` substrate. Proven in a clean subprocess.
2. Loading manifests has no runtime side effect: manifests are frozen and loading
   creates no files.
"""

import dataclasses
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parents[2]


def test_no_voice_gateway_or_kernel_imports():
    # Forbid the SOURCE packages (service/app/mos = voice-gateway source; kernel =
    # the unselected substrate). Third-party deps that merely live inside the
    # voice-gateway venv (e.g. PyYAML under .venv/site-packages) are NOT a leak.
    code = (
        "import agent_os, sys\n"
        "FORBIDDEN = {'service', 'app', 'mos', 'kernel'}\n"
        "by_name = sorted(n for n in sys.modules if n.split('.')[0] in FORBIDDEN)\n"
        "def _src(m):\n"
        "    f = getattr(m, '__file__', None) or ''\n"
        "    return ('voice-gateway' in f) and ('site-packages' not in f) and ('/.venv/' not in f)\n"
        "by_file = sorted(n for n, m in sys.modules.items() if _src(m))\n"
        "print('BY_NAME=' + repr(by_name))\n"
        "print('BY_FILE=' + repr(by_file))\n"
        "assert not by_name, ('forbidden source package imported', by_name)\n"
        "assert not by_file, ('voice-gateway source imported', by_file)\n"
    )
    r = subprocess.run([sys.executable, "-c", code], cwd=str(ROOT),
                       capture_output=True, text=True)
    assert r.returncode == 0, r.stdout + "\n" + r.stderr


def test_loading_creates_no_files(tmp_path, monkeypatch):
    from agent_os import load_dir
    from agent_os.loader import DEFAULT_AGENTS_DIR
    # run from an empty cwd; load the real manifests; assert nothing was written there
    monkeypatch.chdir(tmp_path)
    before = set(p.name for p in tmp_path.iterdir())
    load_dir(DEFAULT_AGENTS_DIR)
    after = set(p.name for p in tmp_path.iterdir())
    assert before == after == set()  # zero files created


def test_manifest_immutable():
    from agent_os import load_dir
    m = load_dir()[0]
    with pytest.raises(dataclasses.FrozenInstanceError):
        m.status = None  # type: ignore[misc]
