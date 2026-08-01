/**
 * Event Log → Value Group projection.
 *
 * The ONLY reader of the event log. Every field the group screen renders comes
 * out of here, and every figure carries Provenance so the screen can state its
 * source, sample size and verification status — PHILOS-SYSTEM-BLUEPRINT §0.
 *
 * Pure and deterministic: same events + same `today` → same view. No clock, no
 * randomness, no I/O. `today` is a parameter precisely so "today's activity" is
 * testable and does not drift.
 */

import {
  inOrder,
  isImpactVerifiedEvent,
  isVerified,
  statusForMethod,
  type ImpactVerificationPayload,
  type PhilosEvent,
  type Provenance,
  type VerificationMethod,
  type VerificationResult,
  type VerificationStatus,
} from "./events";

// ── view model ───────────────────────────────────────────────────────────────

export interface PersonView {
  person_id: string;
  display_name: string;
}

export interface LeaderView extends PersonView {
  role: string;
  role_label: string;
  area: string;
  appointed_by: string;
  appointed_by_name: string;
  since: string;
}

export interface ActivityItem {
  event_id: string;
  time: string; // HH:MM, local to the event's own offset
  kind: string;
  text: string;
  actor_name: string;
}

export interface BudgetView {
  received: number;
  spent: number;
  committed: number;
  available: number;
  currency: string;
  provenance: Provenance;
}

export type AllocationState = "voting" | "approved" | "transferred";

export interface AllocationView {
  allocation_id: string;
  title: string;
  amount: number;
  proposed_by: string;
  proposed_by_name: string;
  value_tag: string;
  people_affected_estimate: number;
  votes_for: number;
  votes_required: number;
  state: AllocationState;
  provenance: Provenance;
}

export type TransferState = "proposed" | "approved" | "executing" | "completed" | "reversed";

export interface TransferView {
  transfer_id: string;
  amount: number;
  recipient: string;
  purpose: string;
  tier: string;
  approvals: { person_id: string; role: string; at: string }[];
  state: TransferState;
  completed_at?: string;
  evidence: string[];
  provenance: Provenance;
}

/**
 * Where one impact sits, as an explicit state rather than a boolean.
 *
 * `partial` is deliberately its own level and NOT a weaker kind of `verified`:
 * folding it in would let "Verified Impact" mix fully-checked outcomes with ones
 * only partly supported, which is precisely how a truth table stops being true.
 * `inferred` is separate for the same reason — a machine's conclusion is not a
 * second party's verification.
 */
export type VerificationLevel =
  | "unverified"
  | "verified"
  | "partial"
  | "inferred"
  | "rejected"
  | "inconclusive";

/** Impact counted per level. Nothing is summed across levels. */
export interface ImpactBucket {
  count: number;
  people_affected: number;
  resources_invested: number;
}

export type ImpactTotals = Record<VerificationLevel, ImpactBucket>;

/** One completed act of checking, surfaced so the screen can name the verifier. */
export interface ImpactVerificationView {
  event_id: string;
  verifier_id: string;
  verifier_name: string;
  verified_at: string;
  method: VerificationMethod;
  result: VerificationResult;
  notes?: string;
  evidence: string[];
  confidence?: number;
  /** Present only when the verifier stated one. Never derived. */
  verified_fraction?: number;
}

export interface ImpactView {
  impact_id: string;
  /** event_id of the impact.recorded event — what verifications point at. */
  impact_event_id: string;
  statement: string;
  people_affected: number;
  resources_invested: number;
  /**
   * The level the REPORTER asserted. Never confers verification on its own —
   * a claim cannot verify itself, so any verified status written here is
   * downgraded to self_report.
   */
  reported_status: VerificationStatus;
  /** Derived from the latest valid verification, else the reported status. */
  verification_status: VerificationStatus;
  /** True ONLY for a full verification by a second party. */
  verified: boolean;
  /** Explicit state. `partial` is its own level, never a shade of verified. */
  verification_level: VerificationLevel;
  /** Stated by the verifier, or undefined. Never inferred from the level. */
  verified_fraction?: number;
  /** Checked and found false — distinct from never checked. */
  rejected: boolean;
  /** The latest valid verification, or null while the impact is only reported. */
  verification: ImpactVerificationView | null;
  /** Every valid verification aimed at this impact, oldest first. */
  verification_count: number;
  verified_by_count: number;
  confidence?: number;
  evidence: string[];
  provenance: Provenance;
}

export interface ValueGroupView {
  group_id: string;
  name: string;
  central_value: string;
  goal: string;
  region: string;
  visibility: string;
  status: string;
  opened_at: string;
  founder: PersonView;
  creation_reason: string;
  leaders: LeaderView[];
  members: PersonView[];
  today: ActivityItem[];
  budget: BudgetView;
  allocations: AllocationView[];
  transfers: TransferView[];
  impact: ImpactView[];
  /** Impact counted per verification level; never summed across levels. */
  impact_totals: ImpactTotals;
  /** Total events the projection consumed — the screen's honesty anchor. */
  event_count: number;
}

// ── helpers ──────────────────────────────────────────────────────────────────

const str = (v: unknown, fallback = ""): string => (typeof v === "string" ? v : fallback);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" ? v : fallback);

/** HH:MM as written in the event's own offset — no timezone re-interpretation. */
function hhmm(timestamp: string): string {
  const m = /T(\d{2}:\d{2})/.exec(timestamp);
  return m ? m[1] : "";
}

/** Date part as written, so "today" compares without a timezone shift. */
function datePart(timestamp: string): string {
  return timestamp.slice(0, 10);
}

const ACTIVITY_KINDS: Record<string, string> = {
  "request.opened": "need",
  "update.posted": "post",
  "meeting.scheduled": "event",
  "member.joined": "join",
  "resource.received": "money",
  "allocation.proposed": "vote",
  "allocation.approved": "vote",
  "transfer.completed": "money",
  "impact.recorded": "impact",
};

// ── projection ───────────────────────────────────────────────────────────────

export function projectValueGroup(
  events: readonly PhilosEvent[],
  groupId: string,
  today: string,
): ValueGroupView | null {
  const log = inOrder(events);

  const names = new Map<string, string>();
  for (const e of log) {
    if (e.event_type === "person.registered") {
      names.set(e.entity_id, str(e.payload?.display_name, e.entity_id));
    }
  }
  const nameOf = (id: string) => names.get(id) ?? id;

  const opened = log.find(
    (e) => e.event_type === "group.opened" && e.entity_id === groupId,
  );
  if (!opened) return null;

  // ── leaders ────────────────────────────────────────────────────────────────
  const leaders: LeaderView[] = log
    .filter((e) => e.event_type === "leader.appointed" && e.entity_id === groupId)
    .map((e) => {
      const pid = str(e.payload?.person_id);
      return {
        person_id: pid,
        display_name: nameOf(pid),
        role: str(e.payload?.role),
        role_label: str(e.payload?.role_label),
        area: str(e.payload?.area),
        appointed_by: e.actor_id,
        appointed_by_name: nameOf(e.actor_id),
        since: datePart(e.timestamp),
      };
    });

  // ── members: joiners, plus founder and leaders who are members by definition ─
  const memberIds: string[] = [];
  const seen = new Set<string>();
  const push = (id: string) => {
    if (id && !seen.has(id)) {
      seen.add(id);
      memberIds.push(id);
    }
  };
  push(opened.actor_id);
  for (const l of leaders) push(l.person_id);
  for (const e of log) {
    if (e.event_type === "member.joined" && e.entity_id === groupId) {
      push(str(e.payload?.person_id, e.actor_id));
    }
  }
  const members: PersonView[] = memberIds.map((id) => ({
    person_id: id,
    display_name: nameOf(id),
  }));

  // ── today's activity ───────────────────────────────────────────────────────
  const todayEvents = log.filter(
    (e) =>
      datePart(e.timestamp) === today &&
      (e.entity_id === groupId || e.value_tags.length > 0) &&
      e.event_type in ACTIVITY_KINDS,
  );
  const todayItems: ActivityItem[] = todayEvents.map((e) => ({
    event_id: e.event_id,
    time: hhmm(e.timestamp),
    kind: ACTIVITY_KINDS[e.event_type] ?? "post",
    text: str(e.payload?.text, e.impact_claim?.statement ?? e.event_type),
    actor_name: nameOf(e.actor_id),
  }));

  // ── budget ─────────────────────────────────────────────────────────────────
  const moneyEvents = log.filter(
    (e) => e.resource_delta?.kind === "money" && e.resource_delta.amount !== 0,
  );
  const received = moneyEvents
    .filter((e) => (e.resource_delta?.amount ?? 0) > 0)
    .reduce((s, e) => s + (e.resource_delta?.amount ?? 0), 0);
  const spent = moneyEvents
    .filter((e) => (e.resource_delta?.amount ?? 0) < 0)
    .reduce((s, e) => s - (e.resource_delta?.amount ?? 0), 0);

  // ── allocations ────────────────────────────────────────────────────────────
  const proposals = log.filter((e) => e.event_type === "allocation.proposed");
  const allocations: AllocationView[] = proposals.map((p) => {
    const id = p.entity_id;
    const related = log.filter((e) => e.entity_id === id);
    const votes = related.filter(
      (e) => e.event_type === "allocation.voted" && e.payload?.in_favour === true,
    );
    const approved = related.some((e) => e.event_type === "allocation.approved");
    const transferred = log.some(
      (e) =>
        e.event_type === "transfer.completed" && str(e.payload?.allocation_id) === id,
    );
    const state: AllocationState = transferred
      ? "transferred"
      : approved
        ? "approved"
        : "voting";
    return {
      allocation_id: id,
      title: str(p.payload?.title),
      amount: num(p.payload?.amount),
      proposed_by: p.actor_id,
      proposed_by_name: nameOf(p.actor_id),
      value_tag: p.value_tags[0] ?? "",
      people_affected_estimate: num(p.payload?.people_affected_estimate),
      votes_for: votes.length,
      votes_required: num(p.payload?.votes_required, 5),
      state,
      provenance: {
        source_events: related.map((e) => e.event_id),
        sample_size: related.length,
        verification_status: "evidence",
      },
    };
  });

  /** Approved but not yet transferred out = money committed, not free. */
  const committed = allocations
    .filter((a) => a.state === "approved")
    .reduce((s, a) => s + a.amount, 0);

  const budget: BudgetView = {
    received,
    spent,
    committed,
    available: received - spent - committed,
    currency: "ILS",
    provenance: {
      source_events: moneyEvents.map((e) => e.event_id),
      sample_size: moneyEvents.length,
      verification_status: "evidence",
      time_range: [datePart(opened.timestamp), today],
    },
  };

  // ── transfers ──────────────────────────────────────────────────────────────
  const transferIds = Array.from(
    new Set(log.filter((e) => e.entity_type === "transfer").map((e) => e.entity_id)),
  );
  const transfers: TransferView[] = transferIds.map((id) => {
    const related = log.filter((e) => e.entity_id === id);
    const approvedEv = related.find((e) => e.event_type === "transfer.approved");
    const completedEv = related.find((e) => e.event_type === "transfer.completed");
    const state: TransferState = completedEv ? "completed" : approvedEv ? "approved" : "proposed";
    return {
      transfer_id: id,
      amount: num(approvedEv?.payload?.amount),
      recipient: str(approvedEv?.payload?.recipient),
      purpose: str(approvedEv?.payload?.purpose),
      tier: str(approvedEv?.payload?.tier),
      approvals: Array.isArray(approvedEv?.payload?.approvals)
        ? (approvedEv?.payload?.approvals as TransferView["approvals"])
        : [],
      state,
      completed_at: completedEv ? datePart(completedEv.timestamp) : undefined,
      evidence: completedEv?.evidence ?? [],
      provenance: {
        source_events: related.map((e) => e.event_id),
        sample_size: related.length,
        verification_status: completedEv?.verification_status ?? "claim",
      },
    };
  });

  // ── impact ─────────────────────────────────────────────────────────────────
  // Verification is a separate act, not a self-declared field. `impact.recorded`
  // states a claim; `impact.verified` is someone checking it. A claim therefore
  // stays REPORTED until a valid verification event points at it.
  const verifications = log.filter(isImpactVerifiedEvent);

  const impact: ImpactView[] = log
    .filter((e) => e.event_type === "impact.recorded")
    .map((e) => {
      // A claim cannot verify itself: a verified status written on the report is
      // downgraded, so only an impact.verified event can lift the rung.
      const raw: VerificationStatus = e.verification_status ?? "claim";
      const reported: VerificationStatus = isVerified(raw) ? "self_report" : raw;

      // valid = points at THIS impact event. A verification naming an unknown
      // impact is ignored entirely rather than applied to something else.
      const mine = verifications.filter(
        (v) => (v.payload as ImpactVerificationPayload).target_impact_event_id === e.event_id,
      );
      // `log` is already inOrder, so the last element is the latest by
      // (timestamp, event_id) — deterministic when several land together.
      const latest = mine.length ? mine[mine.length - 1] : null;
      const p = latest?.payload as ImpactVerificationPayload | undefined;

      let status = reported;
      let rejected = false;
      let level: VerificationLevel = "unverified";
      if (p) {
        if (p.result === "verified") {
          status = statusForMethod(p.verification_method);
          // a machine's conclusion is not a second party's verification
          level = isVerified(status) ? "verified" : "inferred";
        } else if (p.result === "partially_verified") {
          // partial checking produced evidence, but not a verified fact
          status = "evidence";
          level = "partial";
        } else if (p.result === "rejected") {
          rejected = true;
          level = "rejected";
        } else {
          level = "inconclusive";
        }
        // "rejected" and "inconclusive" leave the claim at its reported level:
        // being checked and failing must never read as being verified.
      }

      const affirming = mine.filter((v) => {
        const r = (v.payload as ImpactVerificationPayload).result;
        return r === "verified" || r === "partially_verified";
      });

      const confidence = latest?.confidence ?? e.confidence;
      const sourceEvents = [e.event_id, ...mine.map((v) => v.event_id)];

      return {
        impact_id: e.entity_id,
        impact_event_id: e.event_id,
        statement: e.impact_claim?.statement ?? "",
        people_affected: e.impact_claim?.people_affected ?? 0,
        resources_invested: e.impact_claim?.resources_invested ?? 0,
        reported_status: reported,
        verification_status: status,
        // full verification only — partial has its own level and its own bucket
        verified: level === "verified",
        verification_level: level,
        verified_fraction: typeof p?.verified_fraction === "number"
          ? p.verified_fraction
          : undefined,
        rejected,
        verification: latest && p
          ? {
            event_id: latest.event_id,
            verifier_id: latest.actor_id,
            verifier_name: nameOf(latest.actor_id),
            verified_at: latest.timestamp,
            method: p.verification_method,
            result: p.result,
            notes: p.notes,
            evidence: latest.evidence ?? [],
            confidence: latest.confidence,
            verified_fraction: typeof p.verified_fraction === "number"
              ? p.verified_fraction
              : undefined,
          }
          : null,
        verification_count: mine.length,
        verified_by_count: new Set(affirming.map((v) => v.actor_id)).size,
        confidence,
        evidence: [...(e.evidence ?? []), ...mine.flatMap((v) => v.evidence ?? [])],
        provenance: {
          source_events: sourceEvents,
          sample_size: e.impact_claim?.people_affected ?? 0,
          verification_status: status,
          confidence,
          time_range: Array.isArray(e.payload?.period)
            ? (e.payload?.period as [string, string])
            : undefined,
        },
      };
    });

  // Per-level totals. Deliberately NOT summed across levels: there is no single
  // "total impact" figure, because adding a rejected claim to a verified one
  // would produce a number that means nothing.
  const emptyBucket = (): ImpactBucket => ({
    count: 0,
    people_affected: 0,
    resources_invested: 0,
  });
  const impact_totals: ImpactTotals = {
    unverified: emptyBucket(),
    verified: emptyBucket(),
    partial: emptyBucket(),
    inferred: emptyBucket(),
    rejected: emptyBucket(),
    inconclusive: emptyBucket(),
  };
  for (const i of impact) {
    const b = impact_totals[i.verification_level];
    b.count += 1;
    b.people_affected += i.people_affected;
    b.resources_invested += i.resources_invested;
  }

  return {
    group_id: groupId,
    name: str(opened.payload?.name),
    central_value: str(opened.payload?.central_value),
    goal: str(opened.payload?.goal),
    region: str(opened.payload?.region),
    visibility: str(opened.payload?.visibility),
    status: str(opened.payload?.status),
    opened_at: datePart(opened.timestamp),
    founder: { person_id: opened.actor_id, display_name: nameOf(opened.actor_id) },
    creation_reason: str(opened.payload?.creation_reason),
    leaders,
    members,
    today: todayItems,
    budget,
    allocations,
    transfers,
    impact,
    impact_totals,
    event_count: log.length,
  };
}

/** A membership event a caller can append to the log (the beginner journey's "join"). */
export function joinEvent(
  groupId: string,
  personId: string,
  displayName: string,
  timestamp: string,
): PhilosEvent[] {
  return [
    {
      event_id: `e_join_${personId}`,
      actor_id: personId,
      entity_type: "person",
      entity_id: personId,
      event_type: "person.registered",
      value_tags: [],
      timestamp,
      visibility: "public",
      payload: { display_name: displayName },
    },
    {
      event_id: `e_member_${personId}`,
      actor_id: personId,
      entity_type: "value_group",
      entity_id: groupId,
      event_type: "member.joined",
      value_tags: ["אחריות"],
      timestamp,
      visibility: "public",
      payload: { person_id: personId },
    },
  ];
}
