/**
 * ONE BOX — asserted against the RENDERED OUTPUT, not against the source.
 *
 * The nav is a client component, so this renders it through
 * `react-dom/server` with `next/navigation` and `next/link` stubbed, and reads
 * the inline styles the browser would actually receive. It is not a
 * screenshot; it is the DOM the screenshot would be taken of.
 *
 * The failure it exists to catch: any member of the top green area acquiring a
 * border, a background or a radius of its own, which is what turns one control
 * into four pills.
 */
import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";

vi.mock("next/navigation", () => ({
  usePathname: () => "/world",
  useSearchParams: () => new URLSearchParams("group=vg_ahrayut_kehilatit"),
}));
vi.mock("next/link", () => ({
  default: ({ children, ...rest }: { children: React.ReactNode }) =>
    React.createElement("a", rest, children),
}));

const render = async () => {
  const { default: SocialScaleNav } = await import("../SocialScaleNav");
  return renderToStaticMarkup(React.createElement(SocialScaleNav, {}));
};

/** Every `style="…"` attribute in the emitted markup, in document order. */
const styles = (html: string): string[] =>
  [...html.matchAll(/style="([^"]*)"/g)].map((m) => m[1]);

describe("the top green area renders as ONE box", () => {
  it("the nav is the only element that carries a radius", async () => {
    const html = await render();
    const withRadius = styles(html).filter((s) => /border-radius:\s*(?!0)/.test(s));
    expect(withRadius).toHaveLength(1);
    expect(withRadius[0]).toMatch(/border:.*solid/);
  });

  it("no member carries a border, a background or a radius of its own", async () => {
    const html = await render();
    // Members are the anchors and the two label spans inside the nav.
    const members = [...html.matchAll(/<(?:a|span)[^>]*style="([^"]*)"/g)].map((m) => m[1]);
    expect(members.length).toBeGreaterThan(3);
    for (const s of members) {
      expect(s, s).not.toMatch(/border-radius:\s*(?!0)[0-9]/);
      expect(s, s).not.toMatch(/(?<!inset )border:\s*[0-9]/);
      // No member may carry ANY background — a tint is still a rectangle.
      const bg = /background(?:-color)?:\s*([^;"]+)/.exec(s)?.[1]?.trim();
      if (bg) expect(bg, s).toBe("transparent");
    }
  });

  it("there is no gap between members", async () => {
    const html = await render();
    const nav = /<nav[^>]*style="([^"]*)"/.exec(html)?.[1] ?? "";
    expect(nav).toMatch(/gap:\s*0/);
    expect(nav).toMatch(/overflow:\s*hidden/);
    expect(nav).toMatch(/padding:\s*0/);
  });

  it("the active member is marked without becoming a rectangle", async () => {
    const html = await render();
    const active = /<a[^>]*aria-current="page"[^>]*style="([^"]*)"/.exec(html)?.[1]
      ?? /<a[^>]*style="([^"]*)"[^>]*aria-current="page"/.exec(html)?.[1] ?? "";
    expect(active, "the active member must exist").not.toBe("");
    expect(active).toMatch(/box-shadow:\s*inset/);
    expect(active).not.toMatch(/border-radius:\s*(?!0)[0-9]/);
  });

  it("all five items stay INSIDE the one box", async () => {
    const html = await render();
    const inner = /<nav[^>]*>([\s\S]*)<\/nav>/.exec(html)?.[1] ?? "";
    for (const t of ["SOCIAL", "SYSTEM", "NETWORK", "GROUP", "הישות הנבחרת עוברת עם העדשה"]) {
      expect(inner, `${t} must be inside the nav`).toContain(t);
    }
    // Nothing may follow the closing </nav>.
    expect(html.trim().endsWith("</nav>")).toBe(true);
  });

  it("every member is still its own independent route", async () => {
    const html = await render();
    const hrefs = [...html.matchAll(/href="([^"]*)"/g)].map((m) => m[1]);
    expect(hrefs).toHaveLength(3);
    expect(hrefs.every((h) => h.includes("group=vg_ahrayut_kehilatit"))).toBe(true);
    expect(new Set(hrefs.map((h) => h.split("?")[0]))).toEqual(
      new Set(["/hub/community", "/planet", "/world"]));
  });
});
