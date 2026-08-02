# Personal Config — schema index

Two schema versions exist. This file says which is which and which one the code
actually reads; the versions themselves are documented separately.

| version | status | document | loader |
|---|---|---|---|
| **v1** | **currently implemented** — every profile file on disk uses it | [`SCHEMA-V1.md`](./SCHEMA-V1.md) | `mos/personal_config.py`, `SCHEMA_VERSION = 1` |
| **v2** | **frozen design, not implemented** | [`SCHEMA-V2.md`](./SCHEMA-V2.md) | none |

## Loader support today

`mos/personal_config.py` supports **schema_version 1 only**. A file declaring any
other version is refused with an explicit `unsupported version N` validation error
rather than being read on a guess — its entries are not loaded, and the refusal is
reported rather than being silent.

A v2 file placed in this directory today therefore does **not** load. That is
intended: v2 is frozen design awaiting a loader, not a format in use.

## Files here

| file | tracked | notes |
|---|---|---|
| `SCHEMA.md` | ✅ | this index |
| `SCHEMA-V1.md` | ✅ | the implemented schema |
| `SCHEMA-V2.md` | ✅ | frozen design |
| `person.example.yaml` · `music.example.yaml` | ✅ | synthetic, and load through the real validator |
| `person.yaml` · `music.yaml` | ❌ **git-ignored** | Roei's own data — local only, never committed |

The real profiles are excluded by `.gitignore` and enforced by
`scripts/hooks/profile_guard.py`; see that guard for why `.gitignore` alone is not
sufficient.

## The one rule that outranks both versions

**`usage.philos_core` is always `false`.** A personal statement never becomes a
universal Philos rule directly; `founder_principle_candidate: true` marks a candidate
for an explicit human distillation step, which is automated nowhere.

Enforced in `mos/personal_config.py` — the `philos_core` check inside
`_validate_entry` — and covered by
`tests/test_personal_config.py::test_philos_core_true_is_rejected`.

*Earlier revisions of this file attributed that check to a function named
`assert_philos_core_clean`. No such function exists: the rule is real and enforced,
the name was not.*
