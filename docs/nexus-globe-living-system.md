# Nexus Globe — Living System (Experience Layer · v0)

**Status: Candidate** — design principles, not implementation. Builds on the locked
engine; the globe is a *view onto existing computation*, not new theory.

Reference stimulus: **Starport.im** (a 3D satellite-tracking globe). What is worth
taking is not the subject (satellites) but *how it turns a complex system into an
intuitive experience.* Philos adopts the product principles and diverges on
content — and on the one thing Starport structurally cannot show: **change over
time / meaning.**

---

## Principles adopted (content-agnostic, from Starport)

1. **The globe IS the UI**, not decoration. Every interaction starts from a
   person/community on the globe — not a menu.
2. **Living system** — continuous motion, real-time flows (trust, tension,
   collaboration). Never a static map.
3. **Progressive disclosure** — the big picture first (the network); detail opens
   only on zoom into a node.
4. **Performance** — smooth transitions between overview and node, even with many
   objects.

## What Philos shows differently

Starport shows **physical objects**:
```
Earth └── Satellites (orbit · speed · operator · position)
```
Philos shows a **social–value system**:
```
Globe
 └── People / Communities
      ├── Orientation
      ├── Trust
      ├── Relationships
      ├── Values
      ├── Dynamics (tensions, flows)
      └── Potential
```

## The differentiator — meaning over time

Starport shows **WHERE**. Philos shows **WHERE + HOW IT CHANGES + WHO IT AFFECTS +
WHERE IT EVOLVES.** Selecting a node must NOT just open an info panel — it shows:

- the node's **development trajectory** (over time),
- how its **trust flow** changed,
- which **events** shaped it,
- which **nodes** it is connected to,
- its **future Potential** per the model.

This temporal/meaning dimension is exactly the C3→C4 axis defined this session
(Potential → Development). Starport has no equivalent.

## Product philosophy — "Apple Maps of human systems"

Not "make it like Starport" (that maps satellites) — **the globe itself is alive.**
- **Globe dominates** the screen (~60–70%+). Not widgets around a small globe.
- **Density = truth** — thousands of nodes so it reads as "the whole world is
  alive", not a 20–30-point demo.
- **Scale** — zoom out = the whole system; zoom in = still thousands.
- **Depth** — atmosphere glow, orbit/flow layers, deep starfield.
- **Delete ~70% of the UI** — keep a giant Globe, a small HUD, Search, and a Node
  Detail that opens only on click. Everything else is an *overlay* on the globe.
- The globe maps **people · communities · trust · conflict · potential · value
  streams** — that is the differentiator, not the graphics.

## Node layers → existing engine (buildable, not new theory)

| Node layer | Existing engine output |
| --- | --- |
| **Orientation** | `orientationScore` (0–100, validated summary) |
| **Trust** | Value Network — trust basis + helpers |
| **Relationships** | Network Formation — `assessConnection` · `formNetwork` · `analyzeNetworkIntersection` · `formCommunity` |
| **Values** | 5 core values (Truth · Justice · Protection · Responsibility · Dignity) + affinity |
| **Dynamics** | tensions (`collapseMap` / base tension fields) + flows (`harmonicFlow` / `energyLeakage` / `loadModel`) |
| **Potential** | C3 Potential (ontology) → Detection (P1/P3) → Validation (P2 trajectory) → C4 Development |
| **Suggested Action** | `firstMove` — stabilize · support · clarify · distribute · amplify |

So the Living Globe is the **primary interface onto computation that already
exists** — the work is the view + the temporal reads, not the theory.

## Integration points

- **Context Engine:** a node's detail is the *same* context the LLM sees
  (relationship memory, recall, orientation) — one source of truth, no divergence.
- **Merlin:** voice becomes a way to navigate/query the globe — "show me X",
  "what changed for Y", "who is Y connected to".
- **Philos Experience Layer:** this and the proactive **daily brief** vision are
  two faces of one layer — the brief is a *temporal read* of the same living
  system (what changed since yesterday, risks, opportunities).

## Scope / status

Design principles only. No implementation started. The current `nexus-globe`
visual system (globe + solar-system atmosphere) is the canvas; this document
redefines what the globe *shows* (people/values/dynamics), not how it is drawn.
Consistent with [[philos-architecture-directive]] (build on the locked model) and
[[evidence-discipline]]. Candidate v0, 2026-07-31.

## Current screen → target (review of the running app · :3010)

What already works: globe centered with orbits (living feel) · right-side **Live
Feed** reads as a *state stream*, not a menu · top **Last Action** card makes the
system narrative ("what just happened", not only "what is").

Gaps to close (turn the principles into the layout):
1. **Globe too small** — it holds ~¼ of the screen but it is the primary
   interface. Target: **60–70%**, centered; details reveal *around* it.
2. **Too many co-equal panels** — decide the 5-second job (**select a Node**) and
   make everything else visually secondary.
3. **Node Detail too thin** — today a name+percent tooltip. Target: the six layers
   (Orientation · Trust · Relationships · Values · Dynamics · Potential) +
   Suggested Action — so a click explains *why*, not just *what*.
4. **No Timeline** — the Evolution dimension is missing from the screen. Add
   snapshot navigation (**Yesterday → Today → Projection**) so the globe shows
   *change*, not only current state.
5. **Tighter Merlin coupling** — "Merlin, show me Roei" → globe focuses the node →
   Node Detail opens → Merlin narrates the Evolution by voice. (Two interfaces,
   one Engine.)

Guiding rule: the globe is primary; every other component exists to *explain what
the globe already shows*.

## Out of Scope

This document defines **Experience-Layer principles only**. It does NOT define:
- The **engine computations** (orientationScore, network formation, collapse/load)
  — those live in the engine + `nexus-ontology-v1.md`; the globe only *views* them.
- The **concept definitions** (Potential, Development, Trust) — see their own docs.
- **Rendering / graphics technology** (three.js, shaders, performance budget).
- The **Context Engine internals** (recall, memory tiers) — referenced, not defined.
- **Merlin's dialogue behaviour** — voice is named as one interface, not specified.
