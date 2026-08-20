/**
 * THE CONTRACT TEST.
 *
 * `SocialPrimaryStage` exists so the three social scales stop authoring their
 * own primary grammar. That is only true while it stays true, and it was
 * broken once before by exactly this route: a shared BUILDER was already in
 * place (`loadSocialSystem`) and three call sites still produced three
 * answers, because a shared builder is not a shared authority as long as the
 * call sites can differ.
 *
 * So this asserts the properties that make the contract real, not that the
 * markup looks a certain way:
 *
 *   1. every scale renders the SAME four slots, in the same order;
 *   2. every scale renders the SAME six context cells, in the same fixed
 *      order and under the same labels;
 *   3. the only region that differs by scale is `representation`;
 *   4. figures the scales share come out identical, and figures that are
 *      genuinely per-scale do not;
 *   5. UNKNOWN is never rendered as 0.
 */
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import SocialPrimaryStage, { type SocialPrimaryContext } from "../SocialPrimaryStage";
import type { Scale } from "../../social/socialSystemProjection";

const VIEWER = { viewer_id: "v", subject_id: "s", person_id: "p", source: "LOCAL_SINGLE_USER" } as const;

function ctxFor(scale: Scale, over: Partial<SocialPrimaryContext> = {}): SocialPrimaryContext {
  return {
    scale,
    viewer: VIEWER as SocialPrimaryContext["viewer"],
    title: `${scale} title`,
    subtitle: "subtitle",
    headline: { n: scale === "GROUP" ? 51 : scale === "NETWORK" ? 11 : 0, unit: "RECORDS AT THIS SCALE" },
    selection: { status: "none" },
    inScope: 0,
    relations: { entity_links: 38, gated_relations: 38, drawn_arcs: scale === "NETWORK" ? 10 : 0, passed: 38, candidates: 38 },
    provenance: { real: 12, derived: 1, demo: 25 },
    ...over,
  };
}

const SCALES: Scale[] = ["GROUP", "NETWORK", "SYSTEM"];

/* The suite runs in the `node` environment (no DOM, no testing-library in
   this repo), so the markup is read as a string. That is enough — and
   arguably better: it asserts what actually ships to the browser rather than
   what a DOM shim reconstructs. */
function html(scale: Scale, over: Partial<SocialPrimaryContext> = {}) {
  return renderToStaticMarkup(
    <SocialPrimaryStage ctx={ctxFor(scale, over)}>
      <div>{scale} representation</div>
    </SocialPrimaryStage>,
  );
}

/** Slot names in document order. */
function slotsOf(markup: string): string[] {
  return [...markup.matchAll(/data-stage-slot="([a-z]+)"/g)].map((m) => m[1]);
}

/** The markup of one slot: from the `<` of the element that carries the
 *  attribute, up to the next slot marker. Enough for order-sensitive
 *  assertions without a DOM. */
function sliceSlot(markup: string, slot: string): string {
  const at = markup.indexOf(`data-stage-slot="${slot}"`);
  if (at < 0) return "";
  const open = markup.lastIndexOf("<", at);
  const rest = markup.slice(open);
  // Skip PAST this element's own opening tag before looking for the next slot
  // marker — otherwise the search finds this slot's own attribute and the
  // slice runs to the end of the document.
  const afterOwnTag = rest.indexOf(">");
  const next = rest.indexOf("data-stage-slot=", afterOwnTag);
  return next < 0 ? rest : rest.slice(0, rest.lastIndexOf("<", next));
}

function textOf(markup: string): string {
  return markup.replace(/^[^>]*>/, "").replace(/<[^>]*>/g, "").replace(/&#x27;/g, "'").trim();
}

/** Context-cell labels in document order — the six shared primitives.
 *  Read off `data-stage-cell`, which the component emits for exactly this
 *  purpose, rather than guessed at with a text regex (the first version of
 *  this helper matched the PROVENANCE tally's own REAL/DERIVED/DEMO labels
 *  too, and would have gone on passing while the contract rotted). */
function cellsOf(markup: string): string[] {
  return [...sliceSlot(markup, "context").matchAll(/data-stage-cell="([^"]+)"/g)].map((m) => m[1]);
}

function structureOf(scale: Scale, density?: "page" | "hud") {
  const markup = html(scale, density ? { density } : {});
  return {
    slots: slotsOf(markup),
    cells: cellsOf(markup),
    context: textOf(sliceSlot(markup, "context")),
    representation: textOf(sliceSlot(markup, "representation")),
  };
}

describe("SOCIAL PRIMARY COMPOSITION CONTRACT", () => {
  it("renders the same four slots in the same order at every scale", () => {
    const seen = SCALES.map((s) => structureOf(s).slots);
    for (const slots of seen) {
      expect(slots).toEqual(["header", "context", "representation", "audit"]);
    }
  });

  it("renders the same six context cells, in the same fixed order, at every scale", () => {
    const expected = ["OBJECT", "STATUS", "SCALE", "ROLES", "RELATIONS", "PROVENANCE"];
    for (const s of SCALES) expect(structureOf(s).cells).toEqual(expected);
  });

  it("changes ONLY the representation between scales, never the shared context", () => {
    const group = structureOf("GROUP");
    const system = structureOf("SYSTEM");
    // The per-scale region differs...
    expect(group.representation).not.toEqual(system.representation);
    // ...and the shared context, given the same facts, does not.
    /* The SCALE cell names the current scale, which is the one token in the
       rail that is SUPPOSED to differ — it is the cell's whole subject. It is
       normalised out so this asserts what it means to assert: given the same
       facts, no OTHER cell varies by scale. */
    const norm = (t: string) => t.replace(/GROUP|NETWORK|SYSTEM/g, "«scale»");
    const a = norm(textOf(sliceSlot(html("GROUP"), "context")));
    const b = norm(textOf(sliceSlot(html("SYSTEM", {
      headline: { n: 51, unit: "RECORDS AT THIS SCALE" },
      relations: { entity_links: 38, gated_relations: 38, drawn_arcs: 0, passed: 38, candidates: 38 },
    }), "context")));
    expect(a).toEqual(b);
  });

  it("hud density changes no primitive, no label and no order", () => {
    const page = structureOf("NETWORK", "page");
    const hud = structureOf("NETWORK", "hud");
    expect(hud.slots).toEqual(page.slots);
    expect(hud.cells).toEqual(page.cells);
    expect(hud.context).toEqual(page.context);
  });

  it("renders UNKNOWN as UNKNOWN, never as 0", () => {
    /* Asserted over the CELLS, not the whole stage: the rail carries a static
       note explaining that "0 records at this scale" beside a large relation
       count is not a contradiction, and that sentence legitimately contains a
       0. Matching the prose would have made this test fail on an editorial
       change and pass on a real regression. */
    const markup = html("SYSTEM", {
      headline: { n: null, unit: "RECORDS AT THIS SCALE" },
      relations: null,
      provenance: { real: null, derived: null, demo: null },
    });
    // Bounded at `data-stage-note`, the rail's own explanatory sentence, so
    // the last cell's slice does not swallow it.
    const rail = sliceSlot(markup, "context").split("data-stage-note")[0];
    const cells = [...rail.matchAll(/data-stage-cell="[^"]+"[\s\S]*?(?=data-stage-cell=|$)/g)]
      .map((m) => textOf(`<i ${m[0]}`));
    expect(cells.join(" ")).toContain("UNKNOWN");
    for (const cell of cells) expect(cell).not.toMatch(/\b0\b/);
  });

  it("states a reason whenever the selected object is absent at this scale", () => {
    const text = textOf(html("SYSTEM", {
        selection: {
          status: "resolved",
          record_id: "action_1",
          object: {
            record_id: "action_1", kind: "action", at: "2026-08-17T00:00:00.000Z",
            label: "a", source_record_ids: [], provenance: "REAL", verification: "CLAIMED",
            scales: {
              GROUP: { present: true }, NETWORK: { present: true },
              SYSTEM: { present: false, absent_because: "NO_SYSTEM_EVIDENCE" },
            },
          },
        },
      presence: { present: false, because: "אין ראיה מערכתית רחבה משלו" },
    }));
    expect(text).toContain("NOT_APPLICABLE");
    expect(text).toContain("אין ראיה מערכתית רחבה משלו");
  });
});
