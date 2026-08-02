/**
 * The canonical event log for ONE value group: "אחריות קהילתית".
 *
 * PHILOS-SYSTEM-BLUEPRINT §19 names this as the single next milestone — build one
 * Value Group end-to-end from a real event log rather than fabricated numbers.
 * This file IS that log. Nothing downstream may invent a figure that is not
 * derivable from the events here.
 *
 * Scope of the slice: 1 group · 1 founder · 2 value leaders · 5 participants ·
 * today's activity · 1 budget · 2 allocation proposals · 1 approved transfer ·
 * 1 verified impact event.
 *
 * Timestamps are fixed, not generated, so every projection and test is
 * deterministic. "Today" is supplied to the projection, never read from a clock.
 */

import type { PhilosEvent } from "./events";

export const GROUP_ID = "vg_ahrayut_kehilatit";

/** The reference "today" for this seed. Callers may pass their own. */
export const SEED_TODAY = "2026-08-01";

const OPENED = "2026-07-18T09:00:00+03:00";

export const VALUE_GROUP_EVENTS: PhilosEvent[] = [
  // ── people ────────────────────────────────────────────────────────────────
  {
    event_id: "e001",
    actor_id: "p_dana",
    entity_type: "person",
    entity_id: "p_dana",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-17T18:12:00+03:00",
    visibility: "public",
    payload: { display_name: "דנה לוי" },
  },
  {
    event_id: "e002",
    actor_id: "p_omer",
    entity_type: "person",
    entity_id: "p_omer",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-18T11:40:00+03:00",
    visibility: "public",
    payload: { display_name: "עומר כהן" },
  },
  {
    event_id: "e003",
    actor_id: "p_yael",
    entity_type: "person",
    entity_id: "p_yael",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-19T08:05:00+03:00",
    visibility: "public",
    payload: { display_name: "יעל שמש" },
  },
  {
    event_id: "e004",
    actor_id: "p_maya",
    entity_type: "person",
    entity_id: "p_maya",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-20T14:22:00+03:00",
    visibility: "public",
    payload: { display_name: "מאיה רון" },
  },
  {
    event_id: "e005",
    actor_id: "p_noa",
    entity_type: "person",
    entity_id: "p_noa",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-21T09:10:00+03:00",
    visibility: "public",
    payload: { display_name: "נועה ברק" },
  },
  {
    event_id: "e006",
    actor_id: "p_itai",
    entity_type: "person",
    entity_id: "p_itai",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-23T16:48:00+03:00",
    visibility: "public",
    payload: { display_name: "איתי גל" },
  },
  {
    event_id: "e007",
    actor_id: "p_rina",
    entity_type: "person",
    entity_id: "p_rina",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-26T10:30:00+03:00",
    visibility: "public",
    payload: { display_name: "רינה כץ" },
  },
  {
    event_id: "e008",
    actor_id: "p_tomer",
    entity_type: "person",
    entity_id: "p_tomer",
    event_type: "person.registered",
    value_tags: [],
    timestamp: "2026-07-29T19:02:00+03:00",
    visibility: "public",
    payload: { display_name: "תומר אביב" },
  },

  // ── the group opens ───────────────────────────────────────────────────────
  {
    event_id: "e010",
    actor_id: "p_dana",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "group.opened",
    value_tags: ["אחריות"],
    timestamp: OPENED,
    visibility: "public",
    payload: {
      name: "אחריות קהילתית",
      central_value: "אחריות",
      creation_reason:
        "שלושה קשישים בשכונה נשארו בלי ליווי אחרי שהמתנדבת הקבועה עברה דירה. פתחתי את הקבוצה כדי שלא נחכה שמישהו אחר יטפל בזה.",
      goal: "ליווי קבוע לקשישים בשכונה",
      region: "תל אביב",
      visibility: "public",
      status: "active",
    },
  },

  // ── two value leaders appointed ───────────────────────────────────────────
  {
    event_id: "e011",
    actor_id: "p_dana",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "leader.appointed",
    value_tags: ["אחריות"],
    timestamp: "2026-07-18T12:15:00+03:00",
    visibility: "public",
    payload: {
      person_id: "p_omer",
      role: "resources",
      role_label: "אחראי כספים",
      area: "תקציב והקצאות",
      powers: ["approve_transfer_medium"],
    },
  },
  {
    event_id: "e012",
    actor_id: "p_dana",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "leader.appointed",
    value_tags: ["אחריות"],
    timestamp: "2026-07-19T09:30:00+03:00",
    visibility: "public",
    payload: {
      person_id: "p_yael",
      role: "activity",
      role_label: "אחראית פעילות",
      area: "משימות ואירועים",
      powers: ["open_request", "schedule_meeting"],
    },
  },

  // ── five participants join ────────────────────────────────────────────────
  {
    event_id: "e020",
    actor_id: "p_maya",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "member.joined",
    value_tags: ["אחריות"],
    timestamp: "2026-07-20T15:00:00+03:00",
    visibility: "public",
    payload: { person_id: "p_maya" },
  },
  {
    event_id: "e021",
    actor_id: "p_noa",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "member.joined",
    value_tags: ["אחריות"],
    timestamp: "2026-07-21T09:40:00+03:00",
    visibility: "public",
    payload: { person_id: "p_noa" },
  },
  {
    event_id: "e022",
    actor_id: "p_itai",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "member.joined",
    value_tags: ["אחריות"],
    timestamp: "2026-07-23T17:00:00+03:00",
    visibility: "public",
    payload: { person_id: "p_itai" },
  },
  {
    event_id: "e023",
    actor_id: "p_rina",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "member.joined",
    value_tags: ["אחריות"],
    timestamp: "2026-07-26T11:05:00+03:00",
    visibility: "public",
    payload: { person_id: "p_rina" },
  },
  {
    event_id: "e024",
    actor_id: "p_tomer",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "member.joined",
    value_tags: ["אחריות"],
    timestamp: "2026-07-29T19:20:00+03:00",
    visibility: "public",
    payload: { person_id: "p_tomer" },
  },

  // ── budget: money in ──────────────────────────────────────────────────────
  {
    event_id: "e030",
    actor_id: "p_omer",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "resource.received",
    value_tags: ["אחריות"],
    timestamp: "2026-07-24T10:00:00+03:00",
    visibility: "public",
    payload: { from: "קבוצת ׳חינוך שוויוני׳", reason: "העברה בין קבוצות ערך" },
    resource_delta: { kind: "money", amount: 12000, currency: "ILS" },
    evidence: ["ledger:tx_in_0001"],
    verification_status: "evidence",
  },
  {
    event_id: "e031",
    actor_id: "p_dana",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "resource.received",
    value_tags: ["אחריות"],
    timestamp: "2026-07-28T20:15:00+03:00",
    visibility: "public",
    payload: { from: "23 תרומות משתמשים", reason: "מימון קהילתי" },
    resource_delta: { kind: "money", amount: 6400, currency: "ILS" },
    evidence: ["ledger:tx_in_0002"],
    verification_status: "evidence",
  },

  // ── two allocation proposals ──────────────────────────────────────────────
  {
    event_id: "e040",
    actor_id: "p_omer",
    entity_type: "allocation",
    entity_id: "alloc_elder_support",
    event_type: "allocation.proposed",
    value_tags: ["אחריות"],
    timestamp: "2026-07-30T11:00:00+03:00",
    visibility: "public",
    // Dynamics flagship: the group's founding goal (ליווי קשישים) drove this proposal.
    caused_by: ["e010"],
    payload: {
      title: "ליווי שבועי ל-10 קשישים",
      amount: 5000,
      people_affected_estimate: 10,
      votes_required: 5,
    },
  },
  {
    event_id: "e041",
    actor_id: "p_yael",
    entity_type: "allocation",
    entity_id: "alloc_medical_kit",
    event_type: "allocation.proposed",
    value_tags: ["ביטחון"],
    timestamp: "2026-07-31T09:20:00+03:00",
    visibility: "public",
    payload: {
      title: "ערכות עזרה ראשונה לבתים",
      amount: 3200,
      people_affected_estimate: 24,
      votes_required: 5,
    },
  },

  // votes on the first proposal — reaches quorum
  { event_id: "e042", actor_id: "p_dana", entity_type: "allocation", entity_id: "alloc_elder_support", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-30T12:00:00+03:00", visibility: "public", payload: { in_favour: true } },
  { event_id: "e043", actor_id: "p_omer", entity_type: "allocation", entity_id: "alloc_elder_support", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-30T12:30:00+03:00", visibility: "public", payload: { in_favour: true } },
  { event_id: "e044", actor_id: "p_yael", entity_type: "allocation", entity_id: "alloc_elder_support", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-30T13:10:00+03:00", visibility: "public", payload: { in_favour: true } },
  { event_id: "e045", actor_id: "p_maya", entity_type: "allocation", entity_id: "alloc_elder_support", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-30T14:00:00+03:00", visibility: "public", payload: { in_favour: true } },
  { event_id: "e046", actor_id: "p_noa", entity_type: "allocation", entity_id: "alloc_elder_support", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-30T15:25:00+03:00", visibility: "public", payload: { in_favour: true } },
  {
    event_id: "e047",
    actor_id: "p_omer",
    entity_type: "allocation",
    entity_id: "alloc_elder_support",
    event_type: "allocation.approved",
    value_tags: ["אחריות"],
    timestamp: "2026-07-30T15:40:00+03:00",
    visibility: "public",
    // Dynamics flagship: the proposal led to its approval.
    caused_by: ["e040"],
  },

  // votes on the second proposal — still short of quorum
  { event_id: "e048", actor_id: "p_yael", entity_type: "allocation", entity_id: "alloc_medical_kit", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-31T10:00:00+03:00", visibility: "public", payload: { in_favour: true } },
  { event_id: "e049", actor_id: "p_itai", entity_type: "allocation", entity_id: "alloc_medical_kit", event_type: "allocation.voted", value_tags: [], timestamp: "2026-07-31T11:15:00+03:00", visibility: "public", payload: { in_favour: true } },

  // ── one approved transfer, executed ───────────────────────────────────────
  {
    event_id: "e050",
    actor_id: "p_omer",
    entity_type: "transfer",
    entity_id: "tr_elder_support_01",
    event_type: "transfer.approved",
    value_tags: ["אחריות"],
    timestamp: "2026-07-30T16:00:00+03:00",
    visibility: "public",
    // Dynamics flagship: the approved allocation authorized this transfer.
    caused_by: ["e047"],
    payload: {
      allocation_id: "alloc_elder_support",
      recipient: "פרויקט ליווי קשישים",
      purpose: "ליווי שבועי ל-10 קשישים",
      amount: 5000,
      approvals: [{ person_id: "p_omer", role: "resources", at: "2026-07-30T16:00:00+03:00" }],
      tier: "medium",
    },
  },
  {
    event_id: "e051",
    actor_id: "p_omer",
    entity_type: "transfer",
    entity_id: "tr_elder_support_01",
    event_type: "transfer.completed",
    value_tags: ["אחריות"],
    timestamp: "2026-07-31T13:45:00+03:00",
    visibility: "public",
    // Dynamics flagship: the approved transfer was executed here.
    caused_by: ["e050"],
    payload: { allocation_id: "alloc_elder_support" },
    resource_delta: { kind: "money", amount: -5000, currency: "ILS" },
    evidence: ["ledger:tx_out_0001", "receipt:rc_88213"],
    verification_status: "evidence",
  },

  // ── today's activity (2026-08-01) ─────────────────────────────────────────
  {
    event_id: "e060",
    actor_id: "p_yael",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "request.opened",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T09:20:00+03:00",
    visibility: "public",
    payload: { text: "נפתחה בקשת סיוע חדשה — קשישה ברחוב הרצל" },
  },
  {
    event_id: "e061",
    actor_id: "p_dana",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "update.posted",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T13:10:00+03:00",
    visibility: "public",
    payload: { text: "מובילת הערך פרסמה עדכון שבועי" },
  },
  {
    event_id: "e062",
    actor_id: "p_yael",
    entity_type: "value_group",
    entity_id: GROUP_ID,
    event_type: "meeting.scheduled",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T18:00:00+03:00",
    visibility: "public",
    payload: { text: "מפגש קהילה — סיכום החודש" },
  },

  // ── one reported impact, then the separate acts of verifying it ───────────
  // The report claims nothing beyond self_report. Everything above that rung is
  // conferred by the impact.verified events below — each with its own actor,
  // timestamp, method and evidence.
  {
    event_id: "e070",
    actor_id: "p_maya",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.recorded",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T08:00:00+03:00",
    visibility: "public",
    payload: {
      allocation_id: "alloc_elder_support",
      period: ["2026-07-31", "2026-08-01"],
    },
    impact_claim: {
      people_affected: 10,
      statement: "10 קשישים קיבלו ליווי שבועי קבוע; 8 מהם דיווחו על שיפור",
      resources_invested: 5000,
    },
    evidence: ["visit_log:vl_0731"],
    confidence: 0.7,
    verification_status: "self_report",
  },
  {
    event_id: "e0705",
    actor_id: "p_maya",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "verification.requested",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T08:20:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: "e070",
      reason: "דיווח עצמי — נדרש אימות בלתי תלוי לפני פרסום כהשפעה מאומתת",
      requested_verifier_role: "community",
    },
    evidence: [],
  },
  {
    event_id: "e071",
    actor_id: "p_dana",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T09:10:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: "e070",
      verification_method: "site_visit",
      result: "verified",
      notes: "ביקרתי אצל 4 מתוך 10; הליווי מתקיים כפי שדווח",
    },
    evidence: ["visit_log:vl_0801"],
    confidence: 0.85,
  },
  {
    event_id: "e072",
    actor_id: "p_itai",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T09:40:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: "e070",
      verification_method: "document_review",
      result: "verified",
      notes: "חתימות מול רשימת המשתתפים — תואם",
    },
    evidence: ["signatures:sg_0801"],
    confidence: 0.9,
  },
  {
    event_id: "e073",
    actor_id: "p_rina",
    entity_type: "impact",
    entity_id: "imp_elder_support_july",
    event_type: "impact.verified",
    value_tags: ["אחריות"],
    timestamp: "2026-08-01T10:15:00+03:00",
    visibility: "public",
    payload: {
      target_impact_event_id: "e070",
      verification_method: "community_attestation",
      result: "verified",
      notes: "שלושה חברי קהילה אישרו באופן עצמאי",
    },
    evidence: ["attestation:at_0801"],
    confidence: 0.9,
  },
];
