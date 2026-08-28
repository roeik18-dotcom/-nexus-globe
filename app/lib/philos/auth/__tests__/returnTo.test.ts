/**
 * THE COLD PATH: a signed-out person follows a verification link.
 *
 * Before this existed, the middleware sent them to `/signin` with no memory of
 * where they were going, and `signInAction` ended at a hardcoded page. The
 * link they were sent — the only reason they signed in — was gone, and the
 * verification never happened. These tests pin the whole path.
 *
 * `returnTo` arrives in a URL, so it is attacker-controlled. Most of what
 * follows is the list of ways a string can look internal and not be.
 */
import { describe, expect, it } from "vitest";

import { isSafeReturnTo, resolveReturnTo, DEFAULT_AFTER_SIGN_IN } from "../returnTo";

const VERIFY = "/verify/effect_fixture_000001";
/** Built from char codes so no literal control byte sits in the source. */
const CRLF = String.fromCharCode(13, 10);
const BACKSLASH = String.fromCharCode(92);

describe("isSafeReturnTo — accepts only same-origin paths", () => {
  it("accepts the verification link this whole feature exists for", () => {
    expect(isSafeReturnTo(VERIFY)).toBe(true);
  });

  it("accepts an internal path carrying a query string", () => {
    expect(isSafeReturnTo("/hub?date=2026-08-27")).toBe(true);
  });

  it("accepts a percent-encoded segment inside an internal path", () => {
    expect(isSafeReturnTo("/verify/%65ffect")).toBe(true);
  });

  // ── THE WAYS A STRING CAN LOOK INTERNAL AND NOT BE ──────────────────────

  it("rejects a protocol-relative URL — the browser reads it as absolute", () => {
    expect(isSafeReturnTo("//evil.example")).toBe(false);
    expect(isSafeReturnTo("//evil.example/path")).toBe(false);
  });

  it("rejects a second slash smuggled in as percent-encoding", () => {
    expect(isSafeReturnTo("/%2fevil.example")).toBe(false);
    expect(isSafeReturnTo("%2f%2fevil.example")).toBe(false);
  });

  it("rejects a backslash, which browsers normalise to a slash", () => {
    expect(isSafeReturnTo("/" + BACKSLASH + "evil.example")).toBe(false);
    expect(isSafeReturnTo(BACKSLASH + BACKSLASH + "evil.example")).toBe(false);
  });

  it("rejects a plainly absolute URL", () => {
    expect(isSafeReturnTo("https://evil.example/x")).toBe(false);
    expect(isSafeReturnTo("http://evil.example")).toBe(false);
  });

  it("rejects /signin — it would bounce sign-in back to itself forever", () => {
    expect(isSafeReturnTo("/signin")).toBe(false);
    expect(isSafeReturnTo("/signin?returnTo=/hub")).toBe(false);
  });

  it("rejects control characters that could split a header", () => {
    expect(isSafeReturnTo("/hub" + CRLF + "Set-Cookie: x=1")).toBe(false);
  });

  it("rejects a malformed percent-escape rather than throwing", () => {
    expect(() => isSafeReturnTo("/hub%")).not.toThrow();
    expect(isSafeReturnTo("/hub%")).toBe(false);
  });

  it("rejects non-strings and the empty string", () => {
    for (const bad of [undefined, null, "", 0, {}, []]) {
      expect(isSafeReturnTo(bad)).toBe(false);
    }
  });
});

describe("resolveReturnTo — never throws, always yields a usable path", () => {
  it("returns the verification link when it is safe", () => {
    expect(resolveReturnTo(VERIFY)).toBe(VERIFY);
  });

  it("falls back to the default for every rejected value", () => {
    for (const bad of ["//evil.example", "https://evil.example", "/signin", "/hub%", undefined, ""]) {
      expect(resolveReturnTo(bad)).toBe(DEFAULT_AFTER_SIGN_IN);
    }
  });

  it("decodes what it returns, so the caller redirects to a real path", () => {
    expect(resolveReturnTo("/verify/%65ffect_1")).toBe("/verify/effect_1");
  });
});
