// PHILOS · Verifiable Human-Systems Engine
// ----------------------------------------------------------------------------
// Converts Philos from a PRESENTATION causality chain (an ordered array) into a
// FORMALLY VERIFIABLE causal graph. Causality is now a typed link graph that is
// machine-checked for: acyclicity, resource provenance, declared dependencies,
// Wellbeing state-machine legality + continuity, and the consent-gate invariant.
//
// Preserved Philos primitives: Burden / Capacity / Gap, Value Affinity,
// Consent-Gated Disclosure. None of the engine depends on the DOM or the app.

/* ───────────────────────── Wellbeing State Machine ─────────────────────────
   Destroyed → Damaged → Fragile → Stable → Recovered  (adjacent steps only;
   recovery climbs up, harm drops down — no teleporting between non-adjacent
   states). This is what turns "Trust = 22 → Trust = 48" into an auditable
   transition Destroyed → Damaged → Fragile → Stable → Recovered.            */
export type Wellbeing = "Destroyed" | "Damaged" | "Fragile" | "Stable" | "Recovered";
export const WELLBEING_STATES: Wellbeing[] = ["Destroyed", "Damaged", "Fragile", "Stable", "Recovered"];
const WB_INDEX: Record<Wellbeing, number> = { Destroyed: 0, Damaged: 1, Fragile: 2, Stable: 3, Recovered: 4 };

/** A transition is legal iff it moves exactly one step (up or down) on the spine. */
export function isLegalTransition(from: Wellbeing, to: Wellbeing): boolean {
  return Math.abs(WB_INDEX[from] - WB_INDEX[to]) === 1;
}

/* ───────────────────────── Quantities: Burden / Capacity / Gap ───────────── */
export interface Quantity { load: number; capacity: number; }
export const gap = (q: Quantity): number => Math.max(0, q.load - q.capacity);
export const isCovered = (q: Quantity): boolean => gap(q) === 0;

/* ───────────────────────── Value Affinity ─────────────────────────────────
   Two people are connected by the values they share; that shared value is what
   makes one able to carry burden for the other. Not OPM aggregation/is-a — a
   weighted relational primitive.                                             */
export type Value =
  | "Dignity" | "Autonomy" | "PersonalSecurity" | "Trust"
  | "Truth" | "Justice" | "Protection" | "Responsibility";
export interface Person { id: string; values: Value[]; capacity: number; }
export interface Carrier { person: Person; affinity: number; }

export function affinity(a: Person, b: Person): number {
  const bv = new Set<Value>(b.values);
  return a.values.reduce((n, v) => n + (bv.has(v) ? 1 : 0), 0);
}
/** Rank who can carry the victim's burden, by shared-value affinity then capacity. */
export function rankCarriers(victim: Person, pool: Person[]): Carrier[] {
  return pool
    .map((p): Carrier => ({ person: p, affinity: affinity(victim, p) }))
    .filter((c) => c.affinity > 0 && c.person.capacity > 0)
    .sort((a, b) => b.affinity - a.affinity || b.person.capacity - a.person.capacity);
}

/* ───────────────────────── Consent-Gated Disclosure ───────────────────────
   Authority is the subject's. With consent the classified type is revealed;
   without it the representation stays privacy-safe and the type is never typed
   into the artifact.                                                          */
export type Consent = "withheld" | "granted";
export interface Classification { typeHe: string; typeEn: string; }
export interface Disclosure {
  classified: boolean;
  labelHe: string; labelEn: string;
  statusHe: string | null; statusEn: string | null;
}
export function disclose(c: Classification, consent: Consent): Disclosure {
  if (consent === "granted") {
    return {
      classified: true, labelHe: c.typeHe, labelEn: c.typeEn,
      statusHe: "אושר לפרסום קהילתי", statusEn: "Approved for community publication",
    };
  }
  return { classified: false, labelHe: "אירוע חמור", labelEn: "A severe violation", statusHe: null, statusEn: null };
}

/* ───────────────────────── Typed Causal Graph ─────────────────────────────
   A stage = a CausalNode that DECLARES inputs, outputs, state transitions, and
   causal dependencies. Edges are typed; sequence is proven, not assumed.     */
export type ResourceId = string;
export type LinkType =
  | "consumes"    // input that the stage requires AND uses up (creates a real dependency)
  | "produces"    // output resource the stage yields
  | "transforms"  // output: changes a resource's state
  | "enables"     // input enabler that must exist but is not consumed (instrument/agent)
  | "gates";      // input condition: a state must hold or the stage cannot run

export interface CausalLink { type: LinkType; resource: ResourceId; state?: string; }
export interface StateTransition { subject: ResourceId; from: Wellbeing; to: Wellbeing; }

export interface CausalNode {
  id: string;
  title: string;
  inputs: CausalLink[];            // consumes | enables | gates
  outputs: CausalLink[];           // produces | transforms
  transitions: StateTransition[];  // state-machine moves this stage performs
  dependsOn: string[];             // explicit upstream causal dependencies (node ids)
}

export interface CausalGraph {
  nodes: CausalNode[];
  sources: ResourceId[];                        // externally-provided resources
  initialStates: Record<ResourceId, Wellbeing>; // starting state of each stateful subject
}

/* ───────────────────────── Verification ───────────────────────────────────
   The whole point: prove the chain rather than draw it.                      */
export interface VerifyError { code: string; node?: string; detail: string; }
export interface VerifyReport { ok: boolean; errors: VerifyError[]; order: string[] | null; }

export function verifyCausalGraph(g: CausalGraph): VerifyReport {
  const errors: VerifyError[] = [];
  const byId = new Map<string, CausalNode>(g.nodes.map((n) => [n.id, n]));
  const ids = new Set<string>(byId.keys());

  // (1) Referential integrity of declared dependencies.
  for (const n of g.nodes)
    for (const d of n.dependsOn)
      if (!ids.has(d)) errors.push({ code: "DEP_MISSING", node: n.id, detail: `depends on unknown node '${d}'` });

  // (2) Acyclicity — topological sort (Kahn) over dependsOn.
  const order = topoSort(g.nodes, errors);

  // (3) Resource provenance: every consumed/transformed input must be a source
  //     or produced upstream, and that producer must be a declared dependency.
  const producer = new Map<ResourceId, string>();
  for (const n of g.nodes)
    for (const o of n.outputs)
      if (o.type === "produces") producer.set(o.resource, n.id);
  const sources = new Set<ResourceId>(g.sources);
  const ancestors = transitiveDeps(g.nodes);

  for (const n of g.nodes)
    for (const i of n.inputs) {
      if (i.type === "enables" || i.type === "gates") {
        if (!sources.has(i.resource) && !producer.has(i.resource))
          errors.push({ code: "ENABLER_MISSING", node: n.id, detail: `${i.type} '${i.resource}' is neither source nor produced` });
        continue;
      }
      if (sources.has(i.resource)) continue;
      const p = producer.get(i.resource);
      if (!p) { errors.push({ code: "INPUT_UNPRODUCED", node: n.id, detail: `input '${i.resource}' is neither source nor produced` }); continue; }
      if (!ancestors.get(n.id)?.has(p))
        errors.push({ code: "DEP_NOT_DECLARED", node: n.id, detail: `consumes '${i.resource}' from '${p}' but does not depend on it` });
    }

  // (4) State-machine legality + continuity along the causal order.
  if (order) checkContinuity(g, order, byId, errors);

  // (5) Domain invariant: publishing the classified type REQUIRES a consent gate.
  for (const n of g.nodes) {
    const publishes = n.outputs.some((o) => o.type === "produces" && o.resource === "EventType.published");
    const gated = n.inputs.some((i) => i.type === "gates" && i.resource === "PublicationConsent" && i.state === "granted");
    if (publishes && !gated)
      errors.push({ code: "CONSENT_UNGATED", node: n.id, detail: "publishes classification without a consent=granted gate" });
  }

  return { ok: errors.length === 0, errors, order };
}

function topoSort(nodes: CausalNode[], errors: VerifyError[]): string[] | null {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const n of nodes) { indeg.set(n.id, 0); adj.set(n.id, []); }
  for (const n of nodes)
    for (const d of n.dependsOn) {
      if (!adj.has(d)) continue; // unknown dep already reported in (1)
      adj.get(d)!.push(n.id);
      indeg.set(n.id, (indeg.get(n.id) ?? 0) + 1);
    }
  const queue: string[] = [];
  for (const [id, d] of indeg) if (d === 0) queue.push(id);
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const m of adj.get(id) ?? []) {
      const d = (indeg.get(m) ?? 0) - 1;
      indeg.set(m, d);
      if (d === 0) queue.push(m);
    }
  }
  if (order.length !== nodes.length) { errors.push({ code: "CYCLE", detail: "causal graph contains a cycle (not a DAG)" }); return null; }
  return order;
}

function transitiveDeps(nodes: CausalNode[]): Map<string, Set<string>> {
  const direct = new Map<string, Set<string>>(nodes.map((n) => [n.id, new Set(n.dependsOn)]));
  const memo = new Map<string, Set<string>>();
  const visit = (id: string, stack: Set<string>): Set<string> => {
    const cached = memo.get(id);
    if (cached) return cached;
    const acc = new Set<string>();
    for (const d of direct.get(id) ?? []) {
      if (stack.has(d)) continue; // cycle guard
      acc.add(d);
      for (const x of visit(d, new Set(stack).add(d))) acc.add(x);
    }
    memo.set(id, acc);
    return acc;
  };
  for (const n of nodes) visit(n.id, new Set([n.id]));
  return memo;
}

function checkContinuity(g: CausalGraph, order: string[], byId: Map<string, CausalNode>, errors: VerifyError[]): void {
  const running = new Map<ResourceId, Wellbeing>(Object.entries(g.initialStates) as [ResourceId, Wellbeing][]);
  for (const id of order) {
    const n = byId.get(id);
    if (!n) continue;
    for (const t of n.transitions) {
      const cur = running.get(t.subject);
      if (cur === undefined) { errors.push({ code: "NO_INITIAL_STATE", node: id, detail: `transition on '${t.subject}' which has no initial state` }); continue; }
      if (cur !== t.from) { errors.push({ code: "STATE_DISCONTINUITY", node: id, detail: `expects ${t.subject}='${t.from}' but running state is '${cur}'` }); continue; }
      if (!isLegalTransition(t.from, t.to)) { errors.push({ code: "ILLEGAL_TRANSITION", node: id, detail: `${t.from} → ${t.to} is not an adjacent Wellbeing edge` }); continue; }
      running.set(t.subject, t.to);
    }
  }
}

/* ───────────────────────── Presentation projection ────────────────────────
   The ordered "spine" the UI renders is now a PROJECTION of the verified graph
   — derived, not the source of truth.                                        */
export interface CausalStageView {
  id: string; title: string;
  inputs: CausalLink[]; outputs: CausalLink[];
  transitions: StateTransition[]; dependsOn: string[];
}
export function projectToCausalSpine(g: CausalGraph): CausalStageView[] {
  const report = verifyCausalGraph(g);
  const order = report.order ?? g.nodes.map((n) => n.id);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  return order
    .map((id) => byId.get(id))
    .filter((n): n is CausalNode => !!n)
    .map((n) => ({ id: n.id, title: n.title, inputs: n.inputs, outputs: n.outputs, transitions: n.transitions, dependsOn: n.dependsOn }));
}

/* ───────────────────────── Case Zero — Noa (instance) ─────────────────────
   The 5-stage spine as a verified graph. Wellbeing starts Stable (baseline),
   collapses through Harming, and is climbed back by Responding + Recovering. */
export const PHILOS_CASE_ZERO: CausalGraph = {
  initialStates: { "Survivor.Wellbeing": "Stable" },
  sources: ["Event", "PublicationConsent", "Community"],
  nodes: [
    {
      id: "classifying", title: "Event Classification",
      inputs: [
        { type: "gates", resource: "PublicationConsent", state: "granted" },
        { type: "enables", resource: "Community" },
      ],
      outputs: [{ type: "produces", resource: "EventType.published" }],
      transitions: [],
      dependsOn: [],
    },
    {
      id: "harming", title: "Values Harmed",
      inputs: [{ type: "enables", resource: "Event" }],
      outputs: [{ type: "produces", resource: "AffectedValues.harmed" }],
      transitions: [
        { subject: "Survivor.Wellbeing", from: "Stable", to: "Fragile" },
        { subject: "Survivor.Wellbeing", from: "Fragile", to: "Damaged" },
        { subject: "Survivor.Wellbeing", from: "Damaged", to: "Destroyed" },
      ],
      dependsOn: [],
    },
    {
      id: "impacting", title: "Impact",
      inputs: [{ type: "consumes", resource: "AffectedValues.harmed" }],
      outputs: [{ type: "produces", resource: "Impact" }],
      transitions: [],
      dependsOn: ["harming"],
    },
    {
      id: "responding", title: "Community Response",
      inputs: [
        { type: "consumes", resource: "Impact" },
        { type: "enables", resource: "Community" },
      ],
      outputs: [{ type: "produces", resource: "CommunityResponse" }],
      transitions: [
        { subject: "Survivor.Wellbeing", from: "Destroyed", to: "Damaged" },
        { subject: "Survivor.Wellbeing", from: "Damaged", to: "Fragile" },
      ],
      dependsOn: ["impacting"],
    },
    {
      id: "recovering", title: "Recovery",
      inputs: [{ type: "consumes", resource: "CommunityResponse" }],
      outputs: [{ type: "produces", resource: "Recovery" }],
      transitions: [
        { subject: "Survivor.Wellbeing", from: "Fragile", to: "Stable" },
        { subject: "Survivor.Wellbeing", from: "Stable", to: "Recovered" },
      ],
      dependsOn: ["responding"],
    },
  ],
};

/** Verify the canonical Case Zero graph. */
export function verifyPhilos(): VerifyReport {
  return verifyCausalGraph(PHILOS_CASE_ZERO);
}
