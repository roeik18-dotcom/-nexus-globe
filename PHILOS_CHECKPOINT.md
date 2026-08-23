# PHILOS CHECKPOINT — 2026-08-22 21:36

## Branch / HEAD
```
branch: claude/orientation-dimensions-model-ku26yg
head:   0655146 Multi-group architecture: remove the single-GROUP_ID assumption
```

## git diff --stat (tracked, uncommitted)
```
 app/dynamics/DynamicsView.tsx                      |  28 +-
 app/dynamics/page.tsx                              |  94 ++++++-
 app/hub/CreateObservationForm.tsx                  |  13 +-
 app/hub/community/ValueUniversePanel.tsx           | 189 -------------
 app/hub/community/page.tsx                         | 219 ++++++++++-----
 app/hub/page.tsx                                   |   2 +-
 app/lib/philos-viewer.ts                           |  15 +-
 app/lib/philos/__tests__/sharedContext.test.ts     |   6 +-
 .../canon/__tests__/projectCanonDynamics.test.ts   |  76 ++++-
 app/lib/philos/canon/projectCanonDynamics.ts       |  65 ++++-
 app/lib/philos/community/canonicalValueGroup.ts    |   9 +-
 app/lib/philos/community/loadValueGroupWorld.ts    |  39 ++-
 app/lib/philos/community/valueGroupUniverse.ts     |   9 +-
 .../philos/identity/__tests__/isolation.test.ts    |   4 +-
 app/lib/philos/sharedContext.ts                    |  10 +-
 app/lib/philos/shell/SocialFrame.tsx               |  50 ++--
 app/lib/philos/shell/SocialScaleNav.tsx            |  81 +++++-
 app/lib/philos/shell/SystemShell.tsx               |  56 +++-
 .../__tests__/socialSystemProjection.test.ts       |  22 +-
 app/lib/philos/social/loadSocialSystem.ts          |  36 ++-
 app/lib/philos/social/socialSystemProjection.ts    |  11 +-
 app/lib/philos/viewer.ts                           |  13 +-
 app/marketplace/page.tsx                           |  53 +++-
 app/planet/WorldGlobe.tsx                          |  11 +-
 app/planet/__tests__/globeHonesty.test.ts          |  13 +-
 app/planet/page.tsx                                | 308 ++++++++++-----------
 app/world/MissionTimeline.tsx                      |  12 +-
 app/world/page.tsx                                 | 151 ++++++++--
 28 files changed, 1054 insertions(+), 541 deletions(-)
```

## Untracked (new work, not committed)
```
?? PHILOS_CHECKPOINT.md
?? app/dynamics/GroupTrajectory.tsx
?? app/dynamics/__tests__/tensionWiring.test.ts
?? app/hub/community/CommunityDiscovery.tsx
?? app/hub/community/DataQualityPanel.tsx
?? app/hub/community/GroupDeepView.tsx
?? app/hub/community/GroupNetworkView.tsx
?? app/hub/community/ValueSpectrumMap.tsx
?? app/lib/philos/canon/__tests__/viewerScopedCanon.test.ts
?? app/lib/philos/canon/viewerScopedCanon.ts
?? app/lib/philos/community/__tests__/groupEventSpine.test.ts
?? app/lib/philos/community/__tests__/spectrumLayout.test.ts
?? app/lib/philos/community/eventGroupRelations.ts
?? app/lib/philos/community/groupEvent.ts
?? app/lib/philos/community/groupEventStore.ts
?? app/lib/philos/community/groupOperationalState.ts
?? app/lib/philos/community/needResourceBridge.ts
?? app/lib/philos/community/spectrumLayout.ts
?? app/lib/philos/community/valuePackage.ts
?? app/lib/philos/crossTerminal/
?? app/lib/philos/geo/
?? app/lib/philos/person/personLabel.ts
?? app/lib/philos/shell/__tests__/socialScaleNavOneBox.test.tsx
?? app/lib/philos/shell/visualGrammar.ts
?? app/lib/philos/world/
?? app/marketplace/GroupSpineMarket.tsx
?? app/planet/WorldExplorer.tsx
?? app/planet/explore/
?? app/world/WorldNow.tsx
?? docs/CHILD-HUMAN-FOUNDATION-REQUIREMENT.md
?? docs/GROUP-EVENT-INGEST.md
?? docs/PARLIAMENTARY-ADVISOR-REQUIREMENT.md
?? public/globe/ne_110m_admin_0_countries.geojson
```

## PHILOS runtime status
```
canonical mirrors: color.master.json human.master.json music.master.json
canon event log:   canon-events.jsonl 2583b
legacy event log:  1380b
canon modules:     49 files
tests:             Tests  2926 passed (2926)
```

## 7 terminal routes (files present)
```
/hub  -> 25 component(s)
/brain  -> 3 component(s)
/dynamics  -> 6 component(s)
/hub/community  -> 23 component(s)
/marketplace  -> 12 component(s)
/planet  -> 3 component(s)
/world  -> 9 component(s)
```

## Merlin status (READ-ONLY — frozen)
```
pid:     1038
launchd: 1038 0 com.merlin.voice
port:    1 listener on 8802
mic:     peak ~0.0006 vs VAD threshold 0.003 -> NO live mic signal (physical, unresolved)
```

## Frozen source locks (READ-ONLY)
```
```

## NOT committed / NOT stashed — no git state was altered.
