/**
 * transfer.completed → globe arc.
 *
 * A money line is the one arc where a wrong number is worse than no line: a
 * viewer who sees "5,000 ₪" on the globe will believe it. So these tests pin
 * that the amount, currency, endpoints and event id come from the event and
 * nowhere else — and that a transfer with no recorded amount produces an arc
 * with NO amount rather than a fabricated one.
 */

import { describe, expect, it } from "vitest";

import type { PhilosEvent } from "../events";
import { projectGlobeGraph, type GlobeArc } from "../projectGlobeGraph";
import { GROUP_ID, VALUE_GROUP_EVENTS } from "../valueGroupLog";

const graph = (events: readonly PhilosEvent[] = VALUE_GROUP_EVENTS) =>
  projectGlobeGraph(events, GROUP_ID);

const transfers = (events?: readonly PhilosEvent[]): GlobeArc[] =>
  graph(events).arcs.filter((a) => a.relation === "transfer.completed");

const TRANSFER_EVENT = "e051";
const APPROVAL_EVENT = "e050";

describe("transfer.completed produces exactly one arc", () => {
  it("the seed log's single completed transfer yields one arc", () => {
    const completed = VALUE_GROUP_EVENTS.filter((e) => e.event_type === "transfer.completed");
    expect(completed).toHaveLength(1);
    expect(transfers()).toHaveLength(1);
  });

  it("removing the event removes the arc", () => {
    const without = VALUE_GROUP_EVENTS.filter((e) => e.event_id !== TRANSFER_EVENT);
    expect(transfers(without)).toHaveLength(0);
  });

  it("unrelated event types never produce a transfer arc", () => {
    for (const a of graph().arcs) {
      if (a.relation !== "transfer.completed") {
        expect(a.amount).toBeUndefined();
        expect(a.currency).toBeUndefined();
        expect(a.transfer_status).toBeUndefined();
      }
    }
  });

  it("an approved-but-not-completed transfer draws nothing", () => {
    // approval alone is authorisation, not movement
    const noCompletion = VALUE_GROUP_EVENTS.filter((e) => e.event_id !== TRANSFER_EVENT);
    expect(noCompletion.some((e) => e.event_id === APPROVAL_EVENT)).toBe(true);
    expect(transfers(noCompletion)).toHaveLength(0);
  });
});

describe("financial semantics come from the event", () => {
  it("amount and currency match the resource_delta exactly", () => {
    const src = VALUE_GROUP_EVENTS.find((e) => e.event_id === TRANSFER_EVENT)!;
    const arc = transfers()[0];
    expect(arc.amount).toBe(Math.abs(src.resource_delta!.amount));
    expect(arc.amount).toBe(5000);
    expect(arc.currency).toBe(src.resource_delta!.currency);
    expect(arc.currency).toBe("ILS");
    expect(arc.resource_type).toBe("money");
  });

  it("magnitude is absolute — direction is carried by source → target", () => {
    const src = VALUE_GROUP_EVENTS.find((e) => e.event_id === TRANSFER_EVENT)!;
    expect(src.resource_delta!.amount).toBeLessThan(0); // money LEAVING the group
    expect(transfers()[0].amount).toBeGreaterThan(0);
  });

  it("source is the group and the recipient comes from the approving event", () => {
    const approval = VALUE_GROUP_EVENTS.find((e) => e.event_id === APPROVAL_EVENT)!;
    const arc = transfers()[0];
    expect(arc.source_id).toBe(GROUP_ID);
    expect(arc.target_id).toBe("recipient:tr_elder_support_01");
    const node = graph().nodes.find((n) => n.id === arc.target_id);
    expect(node?.type).toBe("recipient");
    expect(node?.label).toBe(approval.payload!.recipient);
  });

  it("preserves the event id, timestamp and verification status", () => {
    const src = VALUE_GROUP_EVENTS.find((e) => e.event_id === TRANSFER_EVENT)!;
    const arc = transfers()[0];
    expect(arc.event_id).toBe(TRANSFER_EVENT);
    expect(arc.timestamp).toBe(src.timestamp);
    expect(arc.verification_status).toBe("evidence");
    expect(arc.transfer_status).toBe("completed");
  });

  it("carries the event's value tags", () => {
    expect(transfers()[0].value_tags).toEqual(["אחריות"]);
  });
});

describe("nothing is fabricated", () => {
  it("a completed transfer with no resource_delta has NO amount", () => {
    const stripped: PhilosEvent[] = VALUE_GROUP_EVENTS.map((e) =>
      e.event_id === TRANSFER_EVENT ? { ...e, resource_delta: undefined } : e,
    );
    const arc = transfers(stripped)[0];
    // the transfer happened, so the line exists…
    expect(arc).toBeDefined();
    // …but an amount nobody recorded must not appear
    expect(arc.amount).toBeUndefined();
    expect(arc.currency).toBeUndefined();
    expect(arc.resource_type).toBeUndefined();
  });

  it("currency is never defaulted when the delta omits it", () => {
    const noCurrency: PhilosEvent[] = VALUE_GROUP_EVENTS.map((e) =>
      e.event_id === TRANSFER_EVENT
        ? { ...e, resource_delta: { kind: "money" as const, amount: -5000 } }
        : e,
    );
    const arc = transfers(noCurrency)[0];
    expect(arc.amount).toBe(5000);
    expect(arc.currency).toBeUndefined();
  });

  it("a completion with no approving event draws no line at all", () => {
    // without the approval there is no named recipient; inventing one would be
    // exactly the guessed endpoint this module refuses to draw
    const noApproval = VALUE_GROUP_EVENTS.filter((e) => e.event_id !== APPROVAL_EVENT);
    expect(transfers(noApproval)).toHaveLength(0);
  });

  it("does not add a recipient node when the arc is dropped", () => {
    const noApproval = VALUE_GROUP_EVENTS.filter((e) => e.event_id !== APPROVAL_EVENT);
    expect(graph(noApproval).nodes.some((n) => n.type === "recipient")).toBe(false);
  });
});
