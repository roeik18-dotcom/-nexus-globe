# REAL_ESTATE_MASTER (תיווך+) — design, 2026-08-13

New, isolated domain track — parallel to HUMAN_CONFIG / MUSIC_CONFIG / PHILOS,
**not wired into shared routing yet**. Nothing in `app/domain_router.py` or
`app/master_config.py` was touched to produce this. Code lives in
`voice_gateway/real_estate/` (standalone package); tests in
`tests/test_real_estate_master.py`.

## Phase 1 — source inventory (read-only)

No prior REAL_ESTATE_MASTER, brokerage index, or gov.il-integration code
exists anywhere in the repo (`grep`-checked: zero non-noise hits for
נדלן/תיווך/גוש חלקה/טאבו/שמאות/parcel/zoning/appraisal outside this pass).
There IS prior, real, on-disk material — found via the existing
`docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md` (a prior session's file/
Dropbox-metadata scan) and by directly listing (path/metadata only) the
folders it named.

| SOURCE_PATH | TYPE | AUTHORITY | FRESHNESS | PERSONAL_DATA | PUBLIC_DATA | PROVENANCE | INDEXABLE | DUPLICATE_RISK |
|---|---|---|---|---|---|---|---|---|
| `…/—קונפינג אישי—/תיווך/הכנה לבחינת מתווכים.docx` | docx | personal record | 2020-04-17 | yes | no | filename only, not opened | **no** | none |
| `…/תיווך/מדריך קנית דירה.rtf` | rtf | personal record | 2022-01-28 | yes | no | filename only | **no** | 2 more copies exist elsewhere (`1.rtfd/`, `תזכוות אייפון…`) |
| `…/תיווך/תיווך סוגי פירסומים.txt` | txt | personal record | 2022-02-02 | yes | no | filename only | **no** | none |
| `…/תיווך/תיווך ומשימות להיום.txt` | txt | personal record | 2021-11-16 | yes | no | filename only | **no** | none |
| `…/תיווך/כניסה לקבוצות רכישה.webloc` | bookmark pointer | 3rd-party public | 2022-03-16 | no | yes | pointer only, target not fetched | no (unconfirmed target) | none |
| `…/תיווך/תיווך תמונות/` (5 address-named subfolders) | photo folders | personal record | 2024-06-12 | **yes (real addresses)** | no | folder names only | **no** | none |
| `…/—קונפינג אישי—/חוזים הסכמים/` | 5 docx/pdf/rtf | personal record | 2021–2022 | yes | no | filenames only | **no** | 2 near-dup pairs |
| `…/—קונפינג אישי—/חשבוניות/` | ~40 pdf/jpg/png | personal record | 2021–2023 | yes | no | filenames only | **no** | not reviewed; relevance to real-estate specifically unconfirmed |
| `voice-gateway/state/bookmark_audit_snapshot.json` (folder=`תיווך`, 31 entries) | json, already in-repo | 3rd-party public | file's own `generated_at` | yes (browsing history) | **yes (public listing URLs)** | machine-readable, in-repo | **yes, in principle** | low |
| `docs/knowledge-inventory/KNOWLEDGE-INVENTORY.md` + `raw/harvest-other.json` | md/json, already in-repo | personal record (meta) | prior session | no | no | this IS the provenance for the seal decision below | yes (it's a doc, not the sealed data) | none |

Full per-entry detail (including notes) lives in code as the source of truth:
`real_estate/source_manifest.py`.

**Method note:** every folder/file above was listed with `ls`/`find`
(names, sizes, dates) — **no file content was opened, read, or OCR'd.**

## Sensitivity decision — why nothing was opened

`docs/knowledge-inventory/raw/harvest-other.json` records, from a prior,
independent inventory pass, an explicit decision already made about this
exact material: *"Sensitive subfolders (חוזים הסכמים, חשבוניות, תיווך, בשמים,
תמונות\*, Camera) were excluded from the find and never opened."*
`KNOWLEDGE-INVENTORY.md` itself classifies it as **"Finance / Legal —
path-classified, not read"** and recommends it be a **"sealed sub-archive:
never rendered to Merlin."**

This pass **continues that decision rather than re-deciding it**: every
personal-data source in the manifest has `indexable=False`. The strongest
signal found — `הכנה לבחינת מתווכים.docx` ("broker licensing exam prep") plus
`תיווך ומשימות להיום.txt` ("brokerage + today's tasks") plus five
address-named photo folders — makes it fairly likely this is a real,
lived professional track (Roei studying for / working as a real-estate
broker), which if anything raises the sensitivity bar (potential third-party
client/seller data), not lowers it. **Turning any specific source
`indexable=True` is Roei's decision to make per-source, not something this
pass does unilaterally** — this is the one place PHASE 1's instructions and
the repo's existing privacy discipline (see `PERSONAL-CONFIG-DESIGN.md` §11:
"Never copy the whole profile into a prompt"; the `profiles/*.yaml`
`.gitignore` + `profile_guard.py` enforcement) both point the same direction.

## Phase 2 — master structure

No canonical REAL_ESTATE_MASTER structure existed, so the 13-section
structure from the task brief was built as-is (`real_estate/schema.py`,
`RECategory` enum) — it doesn't collide with anything: `HUMAN_CONFIG` uses
`profiles/person.yaml` + a Dropbox xlsx; `MUSIC_CONFIG` likewise; `PHILOS`
uses `project_knowledge`. None of those own a `01_PROPERTIES`-shaped
namespace. Per the brief: **no files were copied** into a new structure —
`real_estate/source_manifest.py` is an **index of real paths**, exactly the
"index, don't move/copy" pattern `KNOWLEDGE-INVENTORY.md`'s own migration
plan (Deliverable 6, step 2) already recommended for this same tree.

Where this domain would sit in the existing 6-level Personal-Config
abstraction (`PERSONAL-CONFIG-DESIGN.md` §1): a real-estate/brokerage
practice is an **L2 life domain** alongside Music/Business/Health, with its
own L3 "domain Config" (Identity·Philosophy·Practice·Clients·Listings·…) —
that document doesn't currently name Real Estate as one of its L2 examples;
this is worth a one-line addition by whoever owns that file, not done here.

## Phase 3 — retrieval model

`real_estate/retrieval.py`: `classify(query) -> (RECategory | None, confidence)`
(substring keyword-cue scoring, tie/no-match → `None` — the same honest-tie
pattern `app.domain_router.classify()` already uses, reimplemented locally
rather than imported, to keep this package import-free of `app.*`), then
`retrieve(query) -> StructuredResult` looks up `source_manifest.entries_for(category)`.

Because **every** personal-data source is `indexable=False` today, `retrieve()`
structurally cannot fabricate a fact: `context_text` is `""` in 100% of cases
this pass; status is `SEALED` (sources exist, deliberately withheld) or
`UNKNOWN` (no source catalogued, or catalogued-but-not-yet-content-indexed) —
**never** `LOADED`. This is verified by a test, not just documented
(`test_retrieve_never_returns_loaded_status_today`).

## Phase 4 — gov.il / public-source contract

`real_estate/gov_il_contract.py` defines `ResearchIntent` records per category
(`intent_id`, candidate gov.il-suffix domains, an example question) — the
exact input shape `app.capabilities.gov_il_research.handler({"urls": [...],
"question": ...})` already accepts. **Not imported, not duplicated** — a
future routing owner wires `RECategory -> ResearchIntent -> gov_il_research`
call; this pass only specifies the mapping.

Live-checked this pass (via `WebFetch`, not the capability itself, so this
touches no repo file):

| Domain | Result | Confirmation |
|---|---|---|
| `data.gov.il` (CKAN API) | real, well-formed JSON `package_search` response | **CONFIRMED_REACHABLE** |
| `nadlan.gov.il` | page fragment titled "אתר הנדל\"ן הממשלתי" | PARTIAL (on-topic, not fully verified) |
| `gov.il/he/departments/topics/israel_land_registry` | HTTP 403 | UNCONFIRMED (bot-mitigation, matches `gov_il_research.py`'s own documented finding) |
| `mavat.iplan.gov.il` | connection reset | UNCONFIRMED |

All four candidates are already within `gov_il_research.py`'s structural
`*.gov.il` allowlist and GET-only/no-login/no-forms guarantee, so nothing
here requires a change to that module — only for a routing owner to actually
pass these URLs through it (Phase 6).

## Phase 5 — domain tests

`tests/test_real_estate_master.py`, 17 tests, all passing:
- All 7 representative queries from the task brief classify correctly, with
  the meta-question ("מה ידוע ומה עדיין לא ידוע?") deliberately proven to
  resolve to **no category** — an honest non-guess, not a gap.
- `retrieve()` never returns `LOADED`/fabricated content today (structural,
  not just observed).
- A sealed-source query exposes path + reason, never content.
- Manifest integrity: `SourceEntry` has no field that could hold extracted
  text (a structural guarantee); every personal-only source is `indexable=False`.
- Structural isolation: no module under `real_estate/` imports
  `app.domain_router` / `app.master_config` / `app.context_builder` /
  `app.capabilities` (parsed via `ast`, not substring match — a docstring
  merely mentioning a forbidden module name doesn't false-positive);
  `RECategory` values are disjoint from `Domain` values; `gov_il_contract.py`
  makes no network call structurally (no `httpx`/`requests` import).

## Phase 6 — future routing handoff

**Not applied in this pass.** For a routing owner to expose `REAL_ESTATE_MASTER`
alongside `HUMAN_CONFIG`/`MUSIC_CONFIG`/`PHILOS`:

1. Add `Domain.REAL_ESTATE = "real_estate"` to `app/domain_router.Domain`.
2. Add a `Domain.REAL_ESTATE` entry to `app/domain_router._CUES` — can start
   from `real_estate.retrieval._CUES`, translated from `RECategory` (13-way)
   down to one domain-level cue set (this module's category granularity is
   intentionally finer than domain_router's domain granularity; category
   stays internal to this package post-wiring).
3. Add a `_retrieve_real_estate(query)` in `domain_router.py` that calls
   `real_estate.retrieval.retrieve(query)` and adapts `StructuredResult` →
   `RouteResult`/`SourceRef` (shapes were kept deliberately parallel for
   exactly this).
4. Add `"real_estate"` to `orientation/domain_router_bridge.DR_TO_ORIENTATION`
   and a `Domain("real_estate", …)` registry entry in `orientation/domains.py`
   (default `enabled=True` only after Roei reviews what, if anything, is
   `indexable=True` at that point).
5. Add a `"real_estate_master"` bucket to `app/context_builder._domain_bucket`
   / `_emit_domain_audit` (mirrors the existing `human_config`/`music_config`
   branches) so a future leak-scan protects this domain the same way.
6. Wire `real_estate.gov_il_contract.RESEARCH_INTENTS` to actual
   `gov_il_research` calls where a category's intent is `CONFIRMED_REACHABLE`
   or `PARTIAL` (not `UNCONFIRMED`) — behind the same `ApprovalPolicy`/
   `DataTrust.EXTERNAL_UNTRUSTED` conventions `gov_il_research.py` already uses.
7. **Before step 4 goes live**, Roei reviews `source_manifest.MANIFEST` and
   explicitly flips specific entries to `indexable=True` (or provides new,
   already-reviewed source material) — the pipe is built; filling it with the
   sealed folder's actual content is a separate, explicit decision.

None of steps 1–6 were done here (`domain_router.py`/`master_config.py`/
`context_builder.py` untouched — verified below).

## Self-critique

- The 13-category split is a reasonable first cut but two categories
  (`CLIENTS_LEADS`, `MARKETING`) currently have zero catalogued sources with
  real content signal beyond a task-notes file and a listings-types file —
  thin, honestly reflected as `SEALED`/`UNKNOWN`, not padded out.
- `gov_il_contract.py`'s domain guesses (`nadlan.gov.il`,
  `mavat.iplan.gov.il`) are informed but not exhaustively verified — flagged
  `PARTIAL`/`UNCONFIRMED` rather than asserted, on purpose.
- The `חוזים הסכמים` folder's relevance to real-estate specifically (vs. an
  unrelated event-venue rental agreement) is genuinely uncertain from
  filenames alone — catalogued conservatively rather than excluded, and
  flagged as such rather than silently assumed.
- `PERSONAL-CONFIG-DESIGN.md`'s L2 life-domain list doesn't yet name Real
  Estate — a one-line addition for that file's owner, not made here (shared
  file, not this track's to edit).
