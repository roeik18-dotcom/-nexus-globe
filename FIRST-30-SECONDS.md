# Nexus — First 30 Seconds (canonical spec)

> A user does not arrive asking _"What is my orientation score?"_ — they arrive
> asking _"Why do I feel this way?"_. Therefore the experience **begins with
> resistance, not with measurement.**

**Psychological flow:** Pain → Explanation → Support → Action → Position
(never Position → Pain).

**Tracker** (fills one marker per beat; all five complete by 0:30 — the user feels
progression, not information overload):
`Resistance · Leakage · Support · Action · Orientation`

## Beats

| # | Time | Question | Visual | Data | Color |
| --- | --- | --- | --- | --- | --- |
| 1 | 0:00–0:06 | **What is hurting me?** | Six tension fields; the strongest pulses | Connection ↔ Disconnection · **90** | Red |
| 2 | 0:06–0:12 | **What is this causing?** | Energy-leakage meter | **78** | Red → Orange |
| 3 | 0:12–0:20 | **What helps?** | Helpers illuminate around Noa; load bar 100 → 35 | 5 helpers · **65%** community load | Orange → Cyan |
| 4 | 0:20–0:27 | **What should I do now?** | Single action card | Stabilize → Physical · +16 E / −11 L / +9 O | Cyan |
| 5 | 0:27–0:30 | **Where am I now?** | Orientation score settles | **45 / 100** · First Stabilization | Green |

**Copy (verbatim):**
1. "The strongest resistance detected: Connection ↔ Disconnection. Pressure level: 90. This is where most of the tension accumulates."
2. "Your energy is leaking here. A large portion of your attention is being consumed by this resistance. Current leakage: 78."
3. "People who share your values can absorb part of the burden. Current support capacity: 65%. Load reduced: 100 → 35."
4. "Recommended action: Stabilize → Physical. Expected outcome: +16 Energy, −11 Load, +9 Orientation."
5. "You are here: 45 / 100. First Stabilization. Not collapse. Not recovery. The first stable grip."

## Final screen

```
Private Burden → Shared Responsibility

Nexus does not begin by measuring people.
Nexus begins by locating resistance.

Resistance → Leakage → Support → Action → Orientation
```

**CTA:** "Continue" · **Subtext:** "This was Noa. Next, Nexus will map you."

---

## Implementation (fidelity)

Implemented in [`app/nexus/NoaTransformation.tsx`](app/nexus/NoaTransformation.tsx),
surfaced as the default **journey** tab of the Noa profile panel
([`app/nexus/NoaPanel.tsx`](app/nexus/NoaPanel.tsx)). Every datum is read from the
locked deterministic chain `computeNoaChain()` (`app/lib/noa`) — nothing invented;
no engine, core, or data changes. Auto-play with pause / next / skip / replay.

| Beat | Data source (computeNoaChain) |
| --- | --- |
| 1 Resistance | `tension.strongest` (name + intensity) over `tension.fields` |
| 2 Leakage | `leakage.totalLeakage` |
| 3 Support | `load.helpers`, `load.communityPct`, `load.beforePct → afterPct` |
| 4 Action | `action` (recommendedAction, targetDimension, expected gains) |
| 5 Orientation | `orientation.score` + band |

Visual only. `tsc --noEmit` + `npm run build` pass; `/nexus` loads, beats render,
no console errors. Shipped in PR #1.
