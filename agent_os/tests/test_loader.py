"""Loader: the real agents/*.yaml files load, and agent #2 registers with ZERO
infrastructure change (same registry, same code path, one extra file)."""

from agent_os import (
    Authority, Domain, Status, AgentClass,
    AgentRegistry, load_dir, load_manifest,
)
from agent_os.loader import DEFAULT_AGENTS_DIR


def test_merlin_yaml_loads():
    m = load_manifest(DEFAULT_AGENTS_DIR / "merlin.yaml")
    assert m.agent_id == "merlin"
    assert m.persona == "merlin"
    assert m.status is Status.ENABLED


def test_merlin_is_interface_not_system():
    m = load_manifest(DEFAULT_AGENTS_DIR / "merlin.yaml")
    assert m.agent_class is AgentClass.INTERFACE
    assert m.authority is not Authority.SYSTEM            # INTERFACE ROLE != SYSTEM AUTHORITY
    assert Domain.SYSTEM not in m.allowed_domains
    assert Domain.STUDIO not in m.allowed_domains         # not granted
    assert m.allowed_domains == frozenset(
        {Domain.GENERAL, Domain.MUSIC, Domain.HUMAN_CONFIG, Domain.PHILOS}
    )
    assert m.capabilities == frozenset()                  # no tools/side-effects


def test_echo_probe_is_inert_and_deny_all():
    m = load_manifest(DEFAULT_AGENTS_DIR / "echo_probe.yaml")
    assert m.agent_id == "echo_probe"
    assert m.status is Status.DISABLED
    assert m.allowed_domains == frozenset({Domain.GENERAL})   # one domain only
    assert m.capabilities == frozenset()
    assert m.memory_scope.read == frozenset() and m.memory_scope.write == frozenset()
    assert m.allowed_tools == frozenset()


def test_agent_2_registers_with_zero_infra_change():
    # load_dir picks up BOTH real manifests; the SAME registry/code registers agent #2.
    reg = AgentRegistry()
    reg.load_and_register(load_dir())
    # deterministic: load_dir sorts by filename -> echo_probe.yaml before merlin.yaml
    assert reg.ids() == ["echo_probe", "merlin"]
    assert reg.get("echo_probe") and reg.get("merlin")


def test_second_agent_is_manifest_only_zero_code_change(tmp_path):
    """Rigorous factory proof: with the loader+registry code UNCHANGED, adding one
    manifest FILE to a directory increases the agent count by exactly one."""
    def _write(name, aid, primary="GENERAL"):
        (tmp_path / name).write_text(
            f"agent_id: {aid}\nagent_class: specialist\nname: {aid}\n"
            f"role: worker\nprimary_domain: {primary}\nstatus: disabled\n",
            encoding="utf-8",
        )

    _write("aaa.yaml", "a1")
    reg1 = AgentRegistry()
    reg1.load_and_register(load_dir(tmp_path))
    assert reg1.ids() == ["a1"]                      # one file -> one agent

    _write("bbb.yaml", "a2")                          # add a SECOND file only — no code touched
    reg2 = AgentRegistry()
    reg2.load_and_register(load_dir(tmp_path))
    assert reg2.ids() == ["a1", "a2"]                 # sorted filenames aaa,bbb -> a1,a2
    assert len(reg2) == 2                             # exactly one more agent, manifest-only
