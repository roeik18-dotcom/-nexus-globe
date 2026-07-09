# Philos — Transition Engine v0

**Layer 1 (OPM Extension) | Evidence status: D — Hypothesis**

*This document defines the Transition Laws governing energy flow between departments in the
Human Reality Engine (Layer 2). Without these laws, OPM is a static graph. With them, OPM
becomes a dynamic engine: given initial conditions, it produces a trajectory.*

*These laws are domain-agnostic. They apply equally to a case involving relationships,
organizations, health, law, or any other domain. The content changes; the laws do not.*

---

## §1 What This Adds

The Reality Flow Model (Layer 0) established:
- Three primitives: Matter, Space (Gap), Time
- Five laws: Gap → Interpretation → Scarcity → Force → Energy → reduces gap → new gap
- Six departments: Personal, Social, Cognitive, Emotional, Behavioral, Learning

What was missing: **when** and **how** energy crosses department boundaries.

Without transition laws:
- OPM lists which departments exist and which connections are possible
- Given a situation, you can draw a diagram but cannot predict what happens next

With transition laws:
- Each connection has: activation conditions, transfer function, blocking conditions
- Given a situation and initial energy state, the model produces the trajectory
- The trajectory can be compared against observed behavior (HPE data)

---

## §2 Department Graph

Six departments, eighteen directed channels (not all department pairs are connected in both
directions; specific channel table in §7).

```
     ┌─────────────────────────────────┐
     │                                 │
     P (Personal)  ←──────────────  L (Learning)
     │         ↖                      ↑
     │           \                    │
     ↓            \                   │
     S (Social)   C (Cognitive)     B (Behavioral)
     │    ↑         ↑    │            ↑
     │    │         │    ↓            │
     └──→ └─────── E (Emotional) ────┘
```

Each department is a node:

| Field | Type | Description |
|---|---|---|
| `energy` | float ≥ 0 | Current energy level |
| `capacity` | float | Maximum energy (saturation ceiling) |
| `activation_threshold` | float | Minimum energy needed to generate outgoing transfers |

Each directed edge is a channel:

| Field | Type | Description |
|---|---|---|
| `source` | DeptID | Originating department |
| `target` | DeptID | Receiving department |
| `transfer_fn` | TransferType | How energy transforms in transit (§4) |
| `activation_threshold` | float | Source energy needed to open this channel |
| `blockers` | list\<BlockerCondition\> | Conditions that suppress or halt transfer (§5) |
| `delay` | int | Time steps before energy arrives at target |

---

## §3 Transfer Conditions

For energy to transfer from department X to department Y, three conditions must hold
simultaneously:

**Condition 1 — Intensity threshold:**
```
energy(X) ≥ activation_threshold(channel X→Y)
```
Below-threshold energy does not cross department boundaries. It dissipates within the source.

**Condition 2 — Channel open:**
```
no active hard blocker on channel X→Y
```
A hard blocker unconditionally suppresses transfer (see §5.1).

**Condition 3 — Receptor available:**
```
energy(Y) < capacity(Y)
```
A saturated department cannot receive new energy. Incoming energy is deflected (leakage).

All three must hold. If any fails, the transfer does not occur.

---

## §4 Transfer Functions (Transformation Types)

Each channel applies one transfer function. The function determines how energy changes in
transit — its intensity, direction, and type.

| Type | Formula | Meaning |
|---|---|---|
| **Amplify** | E_out = E_in × k, k > 1 | Target receives more energy than source emitted |
| **Attenuate** | E_out = E_in × k, 0 < k < 1 | Target receives less; remainder is leakage |
| **Invert** | E_out = −E_in | Energy reverses direction (approach → avoidance) |
| **Convert** | E_out = f(E_in), type changes | Emotional energy → analytical problem; anxiety → question |
| **Delay-and-compress** | E_out = Σ E_in(t₋ₙ) | Multiple inputs compress into one update (used in Learning) |
| **Split** | E_out = E_in/k to each of k targets | Single source activates multiple channels simultaneously |

Transfer functions are not free parameters: each channel has one assigned function
based on the known relationship between the departments (§7).

---

## §5 Blocking Conditions

Blockers suppress or halt energy transfer. Four types:

### §5.1 Hard blocker (Value constraint)

**Definition:** Active unconditionally. Cannot be overridden by energy intensity.

**Trigger:** The proposed transfer would produce an action or state that violates a hard
Value Office constraint.

**Effect:** Transfer = 0. Blocked energy does not dissipate — it remains in the source
department and amplifies internal pressure (see Recursive Pressure Law, §6.6).

**Example:** Behavioral department would produce an action that violates the Justice constraint.
Channel Emotional→Behavioral is hard-blocked regardless of emotional energy level.

### §5.2 Soft blocker (Preference or habit)

**Definition:** Active under conditions; can be overcome by sufficient energy intensity.

**Trigger:** Specific state conditions (fear, low confidence, social norm).

**Effect:** Transfer reduced by blocker_strength ∈ (0, 1). High-intensity energy may
partially or fully overcome a soft blocker.

**Example:** Social shame softly blocks Personal→Social (reluctance to speak). If Personal
energy is high enough, transfer still occurs but attenuated.

### §5.3 Saturation blocker

**Definition:** Active when target department is at capacity.

**Trigger:** energy(Y) ≥ capacity(Y)

**Effect:** Transfer rejected. Energy leaks (is lost). No energy increase at target.

**Example:** Cognitive department overwhelmed — cannot receive new analytical tasks. Incoming
problem-formulations are lost until cognitive energy decreases.

### §5.4 Temporal blocker

**Definition:** Active for a specified duration, then deactivates.

**Trigger:** A specific event starts the timer.

**Effect:** Transfer suppressed for duration. Does not prevent energy from accumulating in
source during the blocked period.

**Example:** Grief or recovery period temporarily blocks certain Learning→Personal integrations
(new beliefs cannot form during acute phase).

---

## §6 Seven General Transition Laws

These laws are universal: they apply to every case regardless of domain (relationships,
organizations, health, law, education, economy, etc.).

---

### Law T1 — Threshold law

> **Energy transfer requires minimum intensity. Sub-threshold energy dissipates locally.**

Energy that does not reach the activation threshold of any outgoing channel remains in the
source department and attenuates over time. It does not accumulate indefinitely.

Implication: weak signals die without propagating. This is why mild discontent does not
always produce behavioral change.

---

### Law T2 — Transformation conservation

> **Energy is conserved in transfer, but its form changes.**

No energy is created or destroyed in a transfer. The total energy in the system is the
same before and after, minus leakage.

Form changes are the rule: emotional energy becomes cognitive problem formulation; cognitive
output becomes motivational signal for the behavioral department; behavioral outcomes compress
into beliefs in the learning department.

---

### Law T3 — Blocker hierarchy

> **Hard blockers are unconditional. Soft blockers are intensity-dependent.**

A hard blocker (value constraint) cannot be overridden by any energy level. A soft blocker
can be overcome if source energy exceeds a blocker-specific override threshold.

This law formalizes the deontological structure: sacred value constraints hold regardless
of the pressure applied. Ordinary preferences are soft — high enough pressure overcomes them.

---

### Law T4 — Cycle amplification

> **Energy that completes a full cycle returns amplified.**

A full cycle: Personal → Social → Cognitive → Emotional → Behavioral → Learning → Personal.

Each traversal through the cycle amplifies the energy by a cycle gain factor g:

```
E_cycle_n = E_cycle_0 × g^n
```

If g > 1: escalating spiral (rumination, anxiety loops, obsession).
If g < 1: damping spiral (natural resolution without intervention).
If g = 1: stable limit cycle (maintained state without change).

Intervention changes g. Reducing g below 1 in a damaging cycle is the goal of therapeutic
intervention. The HPE counterfactual data identifies which interventions reduced g in similar cases.

---

### Law T5 — Channel directionality

> **Not all department pairs have bidirectional channels. Directionality is determined by
> the causal structure, not by convention.**

Some channels are unidirectional by structure:
- Learning → Personal (always): experience always flows into updated beliefs
- Behavioral → Learning (always): outcomes always produce learning opportunities
- Personal → Emotional (always): personal energy always activates emotional response

Some channels are conditionally bidirectional:
- Social ↔ Personal: social can shape personal (normative pressure) and personal can reshape social (boundary-setting, influence)
- Cognitive ↔ Emotional: cognitive can regulate emotion; high emotion can also override cognitive analysis

---

### Law T6 — Saturation deflection

> **A saturated department deflects incoming energy. Deflected energy does not disappear —
> it reroutes to adjacent channels or becomes leakage.**

When a department reaches capacity, it stops receiving. Incoming energy does one of:
1. Leaks (is lost from the system)
2. Reroutes to the next available channel from the source
3. Amplifies pressure in the source department

Saturation is the mechanism behind: cognitive overload, emotional flooding, behavioral
paralysis. The department is not "broken" — it is at capacity and cannot receive new input
until current energy decreases.

---

### Law T6.R — Recursive pressure law

> **Blocked energy amplifies pressure within the source department.**

When a hard or soft blocker prevents transfer, the energy that was queued for transfer
remains in the source. It does not dissipate passively — it amplifies:

```
pressure(source, t+1) = energy(source, t) × pressure_factor
```

This is why suppression fails: blocking Emotional→Behavioral does not reduce emotional energy.
It increases it. Eventually either:
- The blocker is overcome (breakdown)
- The energy reroutes to another channel (displacement)
- The department reaches saturation (shutdown)

---

### Law T7 — Interpretation dependency

> **The transfer function of any channel is modulated by the interpretation applied to the
> energy at the source.**

Same energy level, different interpretation → different transfer function.

Example: A gap interpretation of "threat" routes energy to Emotional with an amplifying
function. A gap interpretation of "challenge" routes the same energy to Cognitive with a
convert function.

This law connects the Transition Engine to the Reality Flow Model's Interpretation Principle:
interpretation determines not only whether energy flows but how it transforms in transit.

---

## §7 Channel Table

All eighteen directed channels with their default transfer functions and primary blockers.

| Channel | Transfer function | Primary blocker type | Notes |
|---|---|---|---|
| P → S | Attenuate (k=0.7) | Soft (shame, isolation) | Personal energy leaks into social at reduced level |
| P → C | Convert | Soft (overload) | Personal gap → cognitive problem formulation |
| P → E | Amplify (k=1.4) | None (always active) | Personal energy amplifies in emotional department |
| S → P | Attenuate (k=0.5) | Soft (identity rigidity) | Social signals partially absorbed by personal |
| S → C | Convert | Soft (overload) | Social pressure → comparative analysis |
| S → E | Amplify (k=1.2) | None | Social signals amplify emotional response |
| C → E | Attenuate (k=0.6) | Soft (rationalization loop) | Cognitive output reduces (or increases) emotional energy |
| C → B | Convert | Hard (value constraint) | Cognitive analysis produces behavioral plan |
| E → B | Amplify (k=1.3) | Hard (value constraint), Soft (fear) | Emotional energy drives action |
| E → C | Convert | Soft (emotional flooding at high energy) | Emotion triggers re-analysis at moderate levels |
| B → L | Delay-and-compress | Temporal (acute phase) | Outcomes compress into experience over time |
| B → S | Attenuate (k=0.8) | Soft | Actions change social environment |
| L → P | Delay-and-compress | Soft (identity rigidity) | Experience revises beliefs and values |
| L → C | Attenuate (k=0.5) | None | Learning updates cognitive priors |
| L → E | Attenuate (k=0.4) | None | Experience moderates emotional baseline |
| C → S | Attenuate (k=0.6) | Soft | Cognitive reframing influences social perception |
| S → B | Invert or Amplify | Soft | Social can facilitate or block action (depends on alignment) |
| E → S | Attenuate (k=0.5) | Soft (shame) | Emotional state influences social expression |

Transfer function multipliers (k values) are initial estimates. They are hypotheses, not
calibrated parameters. Real calibration requires HPE data.

---

## §8 OPM Graph Representation

An OPM implementation of the Transition Engine represents the six-department system as a
directed attributed graph.

### Node attributes (per department)

```
{
  id:                   DeptID,
  energy:               float,         // current level
  capacity:             float,         // saturation ceiling
  activation_threshold: float,         // outgoing transfer minimum
  active_blockers:      list[BlockerID] // currently active blockers
}
```

### Edge attributes (per channel)

```
{
  source:               DeptID,
  target:               DeptID,
  transfer_fn:          {type, params},  // amplify/attenuate/invert/convert/etc.
  activation_threshold: float,
  blockers:             list[BlockerCondition],
  delay:                int              // time steps
}
```

### Step function (one time step)

```
for each channel (X → Y):
  if energy[X] >= channel.activation_threshold:
    if no active hard_blocker on (X → Y):
      soft_reduction = Σ soft_blocker.strength for active soft blockers
      effective_E    = energy[X] × (1 - soft_reduction)
      arriving_E     = transfer_fn(effective_E)
      if energy[Y] < capacity[Y]:
        energy[Y] += arriving_E × (1 - leakage_rate)
      else:
        // saturation: reroute or leak
  else:
    energy[X] *= attenuation_rate   // sub-threshold energy decays

// Apply recursive pressure law
for each blocked channel (X → Y) with hard_blocker:
  energy[X] *= pressure_factor      // blocked energy amplifies in source
```

This step function is deterministic given initial conditions and active blockers. It is
the core of the Transition Engine.

---

## §9 Connection to HPE

The HPE (Human Pattern Engine) stores cases. Each case encodes what happened.
The Transition Engine explains why it happened.

| HPE field | Transition Engine interpretation |
|---|---|
| `gap` | Source of initial energy in Personal department |
| `interpretation` | Determines which channels activate and which transfer functions apply (Law T7) |
| `pressure` | Active soft blockers on channels entering Behavioral |
| `action` | Output of Behavioral department (channel B→L activated) |
| `outcome` | State of all departments after N cycles |
| `paths_not_taken` | Channels that were available but blocked (hard or soft) |
| `values_not_activated` | Hard blockers that were available but not invoked |
| `outcomes_not_realized` | Terminal states reachable from this initial condition if different channels had activated |

The HPE counterfactual field maps directly to Transition Engine block conditions. An HPE
dataset of 1,000 cases is also a dataset of 1,000 observed channel activations and blockages —
from which transfer function parameters and blocker strengths can be estimated.

---

## §10 Open Questions

| Question | Blocker for |
|---|---|
| How are transfer function parameters (k values) calibrated? | Quantitative prediction |
| Is the step function synchronous (all channels at once) or sequential? | Simulation design |
| Does energy decay at rest, or is the system conservative? | Energy accounting |
| How does a new "matter" entering the system (new person, new event) inject energy? | Initial conditions |
| Can a department's capacity change over time (growth, trauma)? | Dynamic modeling |
| How is the cycle gain factor g measured in practice? | Law T4 |
| Do hard blockers ever change state (can a sacred value become non-sacred)? | Boundary conditions for Law T3 and Law T6.R |

---

*Version 0.1 | Layer 1 (OPM Extension) | Evidence: D — Hypothesis*
*No transition functions have been validated empirically.*
*The step function (§8) is the formal target for simulation in a future stage.*
