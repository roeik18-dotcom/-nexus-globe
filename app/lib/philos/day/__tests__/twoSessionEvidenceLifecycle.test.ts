/**
 * TWO REAL SESSIONS, TWO IDENTITIES, ONE CLOSED DAY.
 *
 * This drives the whole Evidence → Learning lifecycle the way it will actually
 * happen: one person recorded the day and cannot verify their own outcome, and
 * a second person signs in with their own session and does. Both identities
 * come from REAL session tokens minted through `issueSession` and resolved by
 * the REAL `SESSION_VIEWER` provider — not a stub viewer, because a stub is
 * exactly the thing that would hide an identity bug.
 *
 * ISOLATION. Every store variable points into a temp directory seeded with a
 * COPY of the real day chain. Nothing here reads or writes the real stores, and
 * the copy is made once, read-only, from files this test never opens for
 * writing.
 *
 * WHAT IS BEING PROVEN, IN ORDER:
 *   9/11  — the day as it stands: evidence and learning both unmet.
 *   10/11 — after a DIFFERENT person verifies the Effect.
 *   11/11 — after the subject records a Learning on that evidence.
 * And, throughout: the day is never reopened, and the closing record is never
 * touched. A gate that closes by editing the day it is gating proves nothing.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: () => {}, revalidateTag: () => {} }));

import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { issueSession } from "../../identity/sessionStore";
import { setSessionReader, SESSION_VIEWER } from "../../identity/sessionViewer";
import { setViewerProvider, LOCAL_SINGLE_USER, resolveViewerContext } from "../../identity/viewerContext";
import { verifyEffectCore } from "../../canon/verifyEffectAction";
import { createLearningForCurrentUserCore } from "../../canon/learningFormAction";
import { loadDaySession } from "../loadDaySession";
import { _setActionStore } from "../../canon/actionStoreAccessor";
import { _setEffectStore } from "../../canon/effectStoreAccessor";
import { _setLearningStore } from "../../canon/learningStoreAccessor";
import { _setVerificationStore } from "../../canon/outcomeVerificationStoreAccessor";
import { _setCanonEventStore } from "../../canon/canonEventStoreAccessor";
import { _setDomainStateStore } from "../../canon/domainStateStoreAccessor";
import { _setPhilosEventStore } from "@/app/lib/philos-event-store";

const REPO = process.cwd();
const DAY = "2026-08-27";
const SUBJECT = "person_roei";
const VERIFIER = "person_second_reviewer";
const EFFECT = "effect_mtc3v90m_000001";
/** The Observation the day's Action was taken from — the Learning's prior state. */
const OBSERVATION = "26b866a3-91e4-4c10-9caf-751b71030e2f";

let dir: string;
const saved: Record<string, string | undefined> = {};
let roeiToken = "", verifierToken = "";

/** Copy one real store file in, if it exists. Read-only on the source. */
function seed(from: string, toDir: string, name: string) {
  const src = join(REPO, from, name);
  if (existsSync(src)) copyFileSync(src, join(toDir, name));
}

/** Point every accessor at the freshly-seeded temp directory. */
function resetStores() {
  _setActionStore(null); _setEffectStore(null); _setLearningStore(null);
  _setVerificationStore(null); _setCanonEventStore(null);
  _setDomainStateStore(null); _setPhilosEventStore(null);
}

/** Become one of the two people, through a real token and the real provider. */
function actAs(token: string) {
  setSessionReader(async () => token);
}

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), "philos-two-session-"));
  const canon = join(dir, "canon"), philos = join(dir, "philos"), session = join(dir, "session");
  for (const d of [canon, philos, session]) mkdirSync(d, { recursive: true });

  for (const k of ["CANON_DATA_DIR", "PHILOS_DATA_DIR", "PHILOS_SESSION_DIR", "PHILOS_CANON_DIR", "PHILOS_VIEWER_MODE"]) {
    saved[k] = process.env[k];
  }
  process.env.CANON_DATA_DIR = canon;
  process.env.PHILOS_DATA_DIR = philos;
  process.env.PHILOS_SESSION_DIR = session;
  process.env.PHILOS_CANON_DIR = canon;
  /* SESSION, not LOCAL_DEV — LOCAL_DEV collapses every viewer to one person,
     which is precisely the condition this test exists to rule out. */
  delete process.env.PHILOS_VIEWER_MODE;

  /* The whole canon directory, not a hand-picked subset: IdentityLinked is
     resolved from the identity-link records, and seeding only the chain files
     would have left the day one gate short for a reason that has nothing to
     do with what this test is about. */
  for (const f of readdirSync(join(REPO, ".philos-canon-data"))) seed(".philos-canon-data", canon, f);
  seed(".philos-data", philos, "philos-events.jsonl");
  resetStores();

  setViewerProvider(SESSION_VIEWER);
  roeiToken = await issueSession({ viewer_id: SUBJECT, subject_id: SUBJECT, person_id: "p_you" });
  verifierToken = await issueSession({ viewer_id: VERIFIER, subject_id: VERIFIER, person_id: "p_reviewer" });
});

afterAll(() => {
  for (const [k, v] of Object.entries(saved)) {
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  resetStores();
  setViewerProvider(LOCAL_SINGLE_USER);
  rmSync(dir, { recursive: true, force: true });
});

beforeEach(() => resetStores());

const gates = async () => {
  const s = await loadDaySession({ date: DAY });
  return {
    met: s.gates.filter((g) => g.met).length,
    total: s.gates.length,
    unmet: s.gates.filter((g) => !g.met).map((g) => g.gate),
    session: s,
  };
};

const verificationForm = () => {
  const f = new FormData();
  f.set("effect_id", EFFECT);
  f.set("verifier_type", "third_party");
  f.set("statement", "אישרתי שהתוצאה שדווחה אכן התרחשה");
  f.set("method", "בדיקה עצמאית של מה שנרשם");
  f.set("provenance", "third_party_review");
  f.set("confidence", "0.85");
  return f;
};

const learningForm = () => {
  const f = new FormData();
  f.set("effect_ref", EFFECT);
  f.set("canon_event_id", OBSERVATION);
  f.set("update_method", "עדכון הערכה לאחר אימות עצמאי");
  f.set("provenance", "self_reported");
  f.set("context", "מסקנה שנרשמה אחרי שאדם אחר אימת את התוצאה");
  f.set("confidence", "0.8");
  f.set("candidate_level", "-1");
  f.set("candidate_stability", "0.5");
  return f;
};

describe("two real sessions close EvidencePresent and LearningSupported on a closed day", () => {
  it("the two tokens resolve to two DIFFERENT people through the real provider", async () => {
    actAs(roeiToken);
    expect((await resolveViewerContext()).subject_id).toBe(SUBJECT);
    actAs(verifierToken);
    expect((await resolveViewerContext()).subject_id).toBe(VERIFIER);
    expect(SUBJECT).not.toBe(VERIFIER);
  });

  it("starts at 9/11 with exactly EvidencePresent and LearningSupported unmet", async () => {
    actAs(roeiToken);
    const g = await gates();
    expect(g.total).toBe(11);
    expect(g.unmet.sort()).toEqual(["EvidencePresent", "LearningSupported"]);
    expect(g.met).toBe(9);
  });

  it("refuses the subject's own attempt to verify — and the day stays at 9/11", async () => {
    actAs(roeiToken);
    const r = await verifyEffectCore(verificationForm());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("verifier_is_subject");
    expect((await gates()).met).toBe(9);
  });

  it("refuses a Learning while no evidence exists — the order cannot be inverted", async () => {
    actAs(roeiToken);
    const r = await createLearningForCurrentUserCore(learningForm());
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.refusal).toBe("evidence_missing");
    expect((await gates()).met).toBe(9);
  });

  it("9/11 → 10/11 when the SECOND person verifies the Effect", async () => {
    actAs(verifierToken);
    const r = await verifyEffectCore(verificationForm());
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.verifier_id).toBe(VERIFIER);

    actAs(roeiToken);
    const g = await gates();
    expect(g.met).toBe(10);
    expect(g.unmet).toEqual(["LearningSupported"]);
    expect(g.session.evidence_refs.value).toEqual([EFFECT]);
    expect(g.session.evidence_refs.status).toBe("VERIFIED");
  });

  it("10/11 → 11/11 when the subject records a Learning on that evidence", async () => {
    actAs(roeiToken);
    const r = await createLearningForCurrentUserCore(learningForm());
    expect(r.ok).toBe(true);

    const g = await gates();
    expect(g.met).toBe(11);
    expect(g.unmet).toEqual([]);
    expect(g.session.learning_refs.status).toBe("SUPPORTED");
    expect(g.session.learning_refs.value?.length).toBe(1);
  });

  it("never reopened the day and never touched the closing record", async () => {
    const events = readFileSync(join(dir, "philos", "philos-events.jsonl"), "utf8")
      .split("\n").filter(Boolean).map((l) => JSON.parse(l));
    expect(events.filter((e) => e.event_type === "day.opened")).toHaveLength(1);
    const closings = events.filter((e) => e.event_type === "day.closing_recorded");
    expect(closings).toHaveLength(1);

    // Byte-identical to the record this test started from.
    const original = readFileSync(join(REPO, ".philos-data", "philos-events.jsonl"), "utf8");
    expect(original).toContain(JSON.stringify(closings[0].payload.day_id));
    expect(readFileSync(join(dir, "philos", "philos-events.jsonl"), "utf8")).toBe(original);

    const s = await loadDaySession({ date: DAY });
    expect(s.closing_status).not.toBe("OPEN");
  });
});
