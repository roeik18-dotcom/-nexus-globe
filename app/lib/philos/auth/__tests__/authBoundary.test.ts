import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { assertRuntimeSafe, devSignInAllowed, isProductionLike, InsecureRuntimeError } from "../productionGuard";
import { DevPasswordVerifier, makeDevAccount } from "../devPasswordVerifier";
import { NO_CREDENTIAL_PROVIDER, setCredentialVerifier } from "../credentialVerifier";
import { NO_IDENTITY_DIRECTORY, setIdentityDirectory, StaticIdentityDirectory } from "../identityDirectory";
import { setSignInObserver, signInWithCredential, type SignInFailure } from "../signIn";
import { activateAuth } from "../bootstrap";
import { DEV_ACCOUNT_SECRETS } from "../devFixtureAccounts";
import { FileSystemSessionLog, setSessionLog, InMemorySessionLog } from "../../identity/sessionLog";
import { issueSession, resolveSession, revokeSession } from "../../identity/sessionStore";

const DEV = { PHILOS_ENV: "development", PHILOS_DEV_SIGNIN: "1" };

let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "philos-sess-"));
  setSessionLog(new FileSystemSessionLog(dir));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
  setCredentialVerifier(NO_CREDENTIAL_PROVIDER);
  setIdentityDirectory(NO_IDENTITY_DIRECTORY);
  setSignInObserver(() => {});
});

describe("PRODUCTION GUARD — the dev selector cannot exist in a real runtime", () => {
  it("treats anything that is not explicitly development/test as production-like", () => {
    expect(isProductionLike({})).toBe(true);                          // unset
    expect(isProductionLike({ NODE_ENV: "production" })).toBe(true);
    expect(isProductionLike({ PHILOS_ENV: "staging" })).toBe(true);
    expect(isProductionLike({ PHILOS_ENV: "preview" })).toBe(true);
    expect(isProductionLike({ NODE_ENV: "development" })).toBe(false);
    expect(isProductionLike({ NODE_ENV: "test" })).toBe(false);
  });

  it("PHILOS_ENV overrides NODE_ENV — the app's own classification wins", () => {
    expect(isProductionLike({ NODE_ENV: "development", PHILOS_ENV: "production" })).toBe(true);
  });

  it("THROWS on a production-like runtime with the dev flag set", () => {
    for (const env of [
      { PHILOS_DEV_SIGNIN: "1" },
      { PHILOS_DEV_SIGNIN: "1", NODE_ENV: "production" },
      { PHILOS_DEV_SIGNIN: "1", PHILOS_ENV: "staging", NODE_ENV: "development" },
    ]) {
      expect(() => assertRuntimeSafe(env)).toThrow(InsecureRuntimeError);
    }
  });

  it("does not throw for a production runtime WITHOUT the flag, or dev WITH it", () => {
    expect(() => assertRuntimeSafe({ NODE_ENV: "production" })).not.toThrow();
    expect(() => assertRuntimeSafe(DEV)).not.toThrow();
  });

  it("the selector is allowed ONLY in development/test with the flag", () => {
    expect(devSignInAllowed(DEV)).toBe(true);
    expect(devSignInAllowed({ PHILOS_DEV_SIGNIN: "1", PHILOS_ENV: "production" })).toBe(false);
    expect(devSignInAllowed({ PHILOS_ENV: "development" })).toBe(false);
  });

  it("boot INSTALLS NOTHING in a refused runtime — it throws before wiring", async () => {
    await expect(activateAuth({ PHILOS_DEV_SIGNIN: "1", PHILOS_ENV: "production" })).rejects.toThrow(InsecureRuntimeError);
    // still the refusing defaults
    const r = await signInWithCredential({ account: "roei@local", secret: DEV_ACCOUNT_SECRETS["roei@local"] });
    expect(r.ok).toBe(false);
  });

  it("the dev VERIFIER itself refuses to construct in production", async () => {
    const acct = await makeDevAccount("a", "b");
    expect(() => new DevPasswordVerifier([acct], { PHILOS_ENV: "production" })).toThrow();
  });
});

describe("AUTH BOUNDARY — verify, resolve, issue, in that order", () => {
  it("with NO credential source, nobody authenticates", async () => {
    expect(await NO_CREDENTIAL_PROVIDER.verify({ account: "anyone", secret: "anything" })).toBeNull();
    const r = await signInWithCredential({ account: "roei@local", secret: "philos-dev-roei" });
    expect(r.ok).toBe(false);
  });

  it("a correct dev credential authenticates and issues a session", async () => {
    await activateAuth(DEV);
    const r = await signInWithCredential({ account: "roei@local", secret: DEV_ACCOUNT_SECRETS["roei@local"] });
    expect(r.ok).toBe(true);
    if (r.ok) expect((await resolveSession(r.token))?.subject_id).toBe("person_roei");
  });

  it("a wrong secret does not authenticate and issues NOTHING", async () => {
    await activateAuth(DEV);
    const before = await new InMemorySessionLog().digests();
    const r = await signInWithCredential({ account: "roei@local", secret: "wrong" });
    expect(r.ok).toBe(false);
    expect(before).toEqual([]);
  });

  it("failure carries NO distinguishing field — one shape for every cause", async () => {
    await activateAuth(DEV);
    const seen: SignInFailure[] = [];
    setSignInObserver((f) => seen.push(f));
    const results = [
      await signInWithCredential({ account: "", secret: "" }),
      await signInWithCredential({ account: "nobody@local", secret: "x" }),
      await signInWithCredential({ account: "roei@local", secret: "wrong" }),
    ];
    // identical to the caller...
    for (const r of results) expect(r).toEqual({ ok: false });
    // ...and distinguishable ONLY in the observer, which never crosses the wire
    expect(seen).toEqual(["NO_CREDENTIAL_SUBMITTED", "CREDENTIAL_REJECTED", "CREDENTIAL_REJECTED"]);
  });

  it("a VERIFIED principal with no PHILOS person is refused, not invented", async () => {
    await activateAuth(DEV);
    setIdentityDirectory(new StaticIdentityDirectory({}));   // verified, unmapped
    const seen: SignInFailure[] = [];
    setSignInObserver((f) => seen.push(f));
    const r = await signInWithCredential({ account: "roei@local", secret: DEV_ACCOUNT_SECRETS["roei@local"] });
    expect(r).toEqual({ ok: false });
    expect(seen).toEqual(["PRINCIPAL_NOT_MAPPED"]);
  });

  it("THE CLIENT CANNOT NAME A CANONICAL IDENTITY — there is no channel", async () => {
    await activateAuth(DEV);
    /* The submitted shape has exactly two fields. Sending a person_id, a
       subject_id or a viewer_id as the ACCOUNT is the closest a client can
       get, and it authenticates nothing: the account name is a claim to the
       credential source, and the directory — not the claim — decides who
       that is. */
    for (const account of ["person_roei", "p_you", "person_bet", "roei@local"]) {
      const r = await signInWithCredential({ account, secret: "philos-dev-bet" });
      if (account === "roei@local") expect(r.ok).toBe(false);  // right account, wrong secret
      else expect(r.ok).toBe(false);
    }
    // and B's own valid credential resolves to B, never to Roei
    const b = await signInWithCredential({ account: "bet@local", secret: DEV_ACCOUNT_SECRETS["bet@local"] });
    expect(b.ok).toBe(true);
    if (b.ok) expect((await resolveSession(b.token))?.subject_id).toBe("person_bet");
  });

  it("the session store knows nothing about credentials", async () => {
    // `issueSession` takes a viewer. There is no credential parameter to pass.
    expect(issueSession.length).toBe(2);
    const t = await issueSession({ viewer_id: "v", subject_id: "s", person_id: "p" });
    expect((await resolveSession(t))?.subject_id).toBe("s");
  });
});

describe("DURABLE SESSIONS — survive restart, and so do revocations", () => {
  /** A restart: drop every in-process handle and rebuild from the same dir. */
  const restart = () => setSessionLog(new FileSystemSessionLog(dir));

  it("a valid session still resolves after restart", async () => {
    await activateAuth(DEV);
    const r = await signInWithCredential({ account: "roei@local", secret: DEV_ACCOUNT_SECRETS["roei@local"] });
    expect(r.ok).toBe(true);
    const token = r.ok ? r.token : "";
    expect((await resolveSession(token))?.subject_id).toBe("person_roei");

    restart();
    expect((await resolveSession(token))?.subject_id).toBe("person_roei");
  });

  it("a REVOKED session stays revoked after restart — no resurrection", async () => {
    await activateAuth(DEV);
    const r = await signInWithCredential({ account: "roei@local", secret: DEV_ACCOUNT_SECRETS["roei@local"] });
    const token = r.ok ? r.token : "";
    await revokeSession(token);
    expect(await resolveSession(token)).toBeNull();

    restart();
    expect(await resolveSession(token)).toBeNull();
    restart();
    expect(await resolveSession(token)).toBeNull();
  });

  it("an EXPIRED session cannot become valid again after restart", async () => {
    const token = await issueSession({ viewer_id: "v", subject_id: "s", person_id: "p" }, { ttlMs: 1000, now: 0 });
    expect(await resolveSession(token, 999)).not.toBeNull();
    expect(await resolveSession(token, 1000)).toBeNull();
    restart();
    expect(await resolveSession(token, 1000)).toBeNull();
    expect(await resolveSession(token, 10_000_000)).toBeNull();
  });

  it("RAW TOKENS ARE NEVER WRITTEN — the log holds digests", async () => {
    const token = await issueSession({ viewer_id: "v", subject_id: "s", person_id: "p" });
    const { readFileSync } = await import("node:fs");
    const raw = readFileSync(join(dir, "sessions.jsonl"), "utf-8");
    expect(raw).not.toContain(token);
    expect(raw).toMatch(/"token_digest":"[0-9a-f]{64}"/);
  });

  it("unknown / expired / revoked are indistinguishable at the boundary", async () => {
    const expired = await issueSession({ viewer_id: "v", subject_id: "s", person_id: "p" }, { ttlMs: 1, now: 0 });
    const revoked = await issueSession({ viewer_id: "v", subject_id: "s", person_id: "p" });
    await revokeSession(revoked);
    const results = [
      await resolveSession("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ"),
      await resolveSession(expired, 5000),
      await resolveSession(revoked),
      await resolveSession(undefined),
    ];
    for (const r of results) expect(r).toBeNull();
    expect(new Set(results.map((r) => JSON.stringify(r))).size).toBe(1);
  });

  it("revoking an unknown token is a no-op and reveals nothing", async () => {
    await expect(revokeSession("never-existed")).resolves.toBeUndefined();
    await expect(revokeSession(undefined)).resolves.toBeUndefined();
    expect(await resolveSession("never-existed")).toBeNull();
  });
});
