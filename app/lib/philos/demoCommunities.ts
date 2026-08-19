/**
 * DEMO Value-Group event logs — explicitly approved for product
 * demonstration (Community Command Terminal pass). Every rule from that
 * approval is held here structurally, not just by convention:
 *
 *   - DEMO, never REAL: every `group_id` is prefixed `demo_vg_`, every
 *     `name` is prefixed `[DEMO]`, and `DEMO_COMMUNITIES` (below) is a
 *     SEPARATE array from `valueGroupLog.ts::VALUE_GROUP_EVENTS` — never
 *     merged into the real group's log, never written to
 *     `philos-event-store.ts` (the durable store real usage writes to).
 *   - Real canonical mechanics, not a parallel schema: every event here is
 *     a literal `PhilosEvent`, same `EventType` union, same payload shapes
 *     `valueGroupLog.ts` itself uses — authored by hand in that file's own
 *     precedented style (no command-function layer exists yet for every
 *     event type, e.g. `resource.received`/`transfer.completed`/
 *     `impact.verified`, so hand-authoring literal events IS this
 *     codebase's own established pattern for seeding a Value-Group log).
 *     Projected through the SAME, unmodified `projectValueGroup()` pure
 *     function the real group uses — no second projection, no display-only
 *     shortcut struct.
 *   - No fabricated "quality groups": searched `app/`, this repo's docs,
 *     `PHILOS-MELTING-POT-CANON.md`, and the locally-inventoried external
 *     corpus manifest for any existing "quality group" taxonomy — found
 *     none. Building one here would be exactly the invented replacement
 *     taxonomy the approval forbids, so it is not built; `CommunityCommandTerminal.tsx`
 *     states this gap honestly instead.
 *
 * Two demo communities, deliberately different in scale/strategy from each
 * other AND from the one real seeded group (`valueGroupLog.ts`):
 *   `demo_vg_green_innovation` — large treasury, many members, MIXED
 *     allocation/impact outcomes (approved+transferred, still-voting,
 *     under-review, and one REJECTED verification — investment risk is
 *     real here, not uniformly rosy).
 *   `demo_vg_neighborhood_small` — small treasury, few members, one
 *     allocation, one verified impact — the opposite end of scale.
 */
import type { PhilosEvent } from "./events";

export const DEMO_GREEN_INNOVATION_ID = "demo_vg_green_innovation";
export const DEMO_NEIGHBORHOOD_SMALL_ID = "demo_vg_neighborhood_small";

export const DEMO_GREEN_INNOVATION_TODAY = "2026-08-10";
export const DEMO_NEIGHBORHOOD_SMALL_TODAY = "2026-07-15";

const GI = DEMO_GREEN_INNOVATION_ID;

export const DEMO_GREEN_INNOVATION_EVENTS: PhilosEvent[] = [
  // ── people (10) ─────────────────────────────────────────────────────────
  ...(["dg_avi", "dg_shira", "dg_lior", "dg_maayan", "dg_ronen", "dg_hila", "dg_uri", "dg_keren", "dg_gil", "dg_orly"] as const)
    .map((id, i) => ({
      event_id: `dgi_p${i}`,
      actor_id: id,
      entity_type: "person" as const,
      entity_id: id,
      event_type: "person.registered" as const,
      value_tags: [],
      timestamp: `2026-07-0${(i % 9) + 1}T0${9 + (i % 5)}:00:00+03:00`,
      visibility: "public" as const,
      payload: { display_name: `[DEMO] משתמש ${i + 1}` },
    })),

  // ── group opens ─────────────────────────────────────────────────────────
  {
    event_id: "dgi_open", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI,
    event_type: "group.opened", value_tags: ["חדשנות", "סביבה"], timestamp: "2026-07-01T08:00:00+03:00",
    visibility: "public",
    payload: {
      name: "[DEMO] קרן חדשנות ירוקה", central_value: "קיימות",
      creation_reason: "[DEMO] נתון הדגמה — קרן דמו לבחינת מסך פקודת קהילה בקנה מידה גדול, אינה קהילה אמיתית.",
      goal: "מימון פרויקטי חדשנות סביבתית בקנה מידה שכונתי",
      region: "צפון הארץ", visibility: "public", status: "active",
    },
  },
  {
    event_id: "dgi_leader1", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI,
    event_type: "leader.appointed", value_tags: ["חדשנות"], timestamp: "2026-07-01T09:00:00+03:00", visibility: "public",
    payload: { person_id: "dg_shira", role: "resources", role_label: "[DEMO] אחראית תקציב", area: "תקציב והשקעות", powers: ["approve_transfer_medium"] },
  },
  {
    event_id: "dgi_leader2", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI,
    event_type: "leader.appointed", value_tags: ["חדשנות"], timestamp: "2026-07-02T09:00:00+03:00", visibility: "public",
    payload: { person_id: "dg_lior", role: "activity", role_label: "[DEMO] אחראי פעילות", area: "פרויקטים", powers: ["open_request"] },
  },

  // ── members join ────────────────────────────────────────────────────────
  ...(["dg_maayan", "dg_ronen", "dg_hila", "dg_uri", "dg_keren", "dg_gil", "dg_orly"] as const)
    .map((id, i) => ({
      event_id: `dgi_join${i}`, actor_id: id, entity_type: "value_group" as const, entity_id: GI,
      event_type: "member.joined" as const, value_tags: ["חדשנות"], timestamp: `2026-07-0${3 + (i % 6)}T1${i % 9}:00:00+03:00`,
      visibility: "public" as const, payload: { person_id: id },
    })),

  // ── treasury: real money in (large) ────────────────────────────────────
  {
    event_id: "dgi_res1", actor_id: "dg_shira", entity_type: "value_group", entity_id: GI,
    event_type: "resource.received", value_tags: ["חדשנות"], timestamp: "2026-07-05T10:00:00+03:00", visibility: "public",
    payload: { from: "[DEMO] קרן חיצונית", reason: "מענק ייסוד" },
    resource_delta: { kind: "money", amount: 180000, currency: "ILS" }, evidence: ["ledger:demo_tx_in_01"], verification_status: "evidence",
  },
  {
    event_id: "dgi_res2", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI,
    event_type: "resource.received", value_tags: ["חדשנות"], timestamp: "2026-07-20T10:00:00+03:00", visibility: "public",
    payload: { from: "[DEMO] 140 תרומות משתמשים", reason: "מימון קהילתי" },
    resource_delta: { kind: "money", amount: 42000, currency: "ILS" }, evidence: ["ledger:demo_tx_in_02"], verification_status: "evidence",
  },

  // ── investment #1: proposed → voted → approved → transferred (success) ──
  {
    event_id: "dgi_a1", actor_id: "dg_shira", entity_type: "allocation", entity_id: "demo_alloc_solar",
    event_type: "allocation.proposed", value_tags: ["חדשנות"], timestamp: "2026-07-06T09:00:00+03:00", visibility: "public",
    caused_by: ["dgi_open"], payload: { title: "[DEMO] פאנלים סולאריים לבית קהילתי", amount: 60000, people_affected_estimate: 200, votes_required: 5 },
  },
  ...["dg_avi", "dg_shira", "dg_lior", "dg_maayan", "dg_ronen"].map((id, i) => ({
    event_id: `dgi_v1_${i}`, actor_id: id, entity_type: "allocation" as const, entity_id: "demo_alloc_solar",
    event_type: "allocation.voted" as const, value_tags: [], timestamp: `2026-07-06T1${i}:00:00+03:00`, visibility: "public" as const, payload: { in_favour: true },
  })),
  {
    event_id: "dgi_a1_approved", actor_id: "dg_shira", entity_type: "allocation", entity_id: "demo_alloc_solar",
    event_type: "allocation.approved", value_tags: ["חדשנות"], timestamp: "2026-07-06T16:00:00+03:00", visibility: "public", caused_by: ["dgi_a1"],
  },
  {
    event_id: "dgi_t1_approved", actor_id: "dg_shira", entity_type: "transfer", entity_id: "demo_tr_solar",
    event_type: "transfer.approved", value_tags: ["חדשנות"], timestamp: "2026-07-07T09:00:00+03:00", visibility: "public", caused_by: ["dgi_a1_approved"],
    payload: { allocation_id: "demo_alloc_solar", recipient: "[DEMO] פרויקט פאנלים סולאריים", purpose: "התקנת פאנלים", amount: 60000, approvals: [{ person_id: "dg_shira", role: "resources", at: "2026-07-07T09:00:00+03:00" }], tier: "large" },
  },
  {
    event_id: "dgi_t1_completed", actor_id: "dg_shira", entity_type: "transfer", entity_id: "demo_tr_solar",
    event_type: "transfer.completed", value_tags: ["חדשנות"], timestamp: "2026-07-10T13:00:00+03:00", visibility: "public", caused_by: ["dgi_t1_approved"],
    payload: { allocation_id: "demo_alloc_solar" }, resource_delta: { kind: "money", amount: -60000, currency: "ILS" },
    evidence: ["ledger:demo_tx_out_01", "receipt:demo_rc_01"], verification_status: "evidence",
  },
  // verified impact for investment #1
  {
    event_id: "dgi_i1", actor_id: "dg_lior", entity_type: "impact", entity_id: "demo_imp_solar",
    event_type: "impact.recorded", value_tags: ["חדשנות"], timestamp: "2026-07-25T08:00:00+03:00", visibility: "public",
    payload: { allocation_id: "demo_alloc_solar", period: ["2026-07-10", "2026-07-25"] },
    impact_claim: { people_affected: 200, statement: "[DEMO] הפאנלים מייצרים חשמל לבית הקהילתי; 200 נהנים משימוש שוטף", resources_invested: 60000 },
    evidence: ["visit_log:demo_vl_01"], confidence: 0.8, verification_status: "self_report",
  },
  {
    event_id: "dgi_i1_verified", actor_id: "dg_avi", entity_type: "impact", entity_id: "demo_imp_solar",
    event_type: "impact.verified", value_tags: ["חדשנות"], timestamp: "2026-07-26T09:00:00+03:00", visibility: "public",
    payload: { target_impact_event_id: "dgi_i1", verification_method: "site_visit", result: "verified", notes: "[DEMO] ביקור באתר — הפאנלים פעילים" },
    evidence: ["visit_log:demo_vl_02"], confidence: 0.85,
  },

  // ── investment #2: proposed, still voting (open loop — real, not fabricated) ──
  {
    event_id: "dgi_a2", actor_id: "dg_lior", entity_type: "allocation", entity_id: "demo_alloc_compost",
    event_type: "allocation.proposed", value_tags: ["חדשנות"], timestamp: "2026-08-01T09:00:00+03:00", visibility: "public",
    payload: { title: "[DEMO] מתקן קומפוסט שכונתי", amount: 15000, people_affected_estimate: 60, votes_required: 5 },
  },
  ...["dg_lior", "dg_hila"].map((id, i) => ({
    event_id: `dgi_v2_${i}`, actor_id: id, entity_type: "allocation" as const, entity_id: "demo_alloc_compost",
    event_type: "allocation.voted" as const, value_tags: [], timestamp: `2026-08-01T1${i}:30:00+03:00`, visibility: "public" as const, payload: { in_favour: true },
  })),

  // ── investment #3: transferred, but impact verification REJECTED (risk is real) ──
  {
    event_id: "dgi_a3", actor_id: "dg_shira", entity_type: "allocation", entity_id: "demo_alloc_bikes",
    event_type: "allocation.proposed", value_tags: ["חדשנות"], timestamp: "2026-07-12T09:00:00+03:00", visibility: "public",
    payload: { title: "[DEMO] תחנת אופניים חשמליים שיתופית", amount: 25000, people_affected_estimate: 80, votes_required: 5 },
  },
  ...["dg_avi", "dg_shira", "dg_lior", "dg_uri", "dg_keren"].map((id, i) => ({
    event_id: `dgi_v3_${i}`, actor_id: id, entity_type: "allocation" as const, entity_id: "demo_alloc_bikes",
    event_type: "allocation.voted" as const, value_tags: [], timestamp: `2026-07-12T1${i}:00:00+03:00`, visibility: "public" as const, payload: { in_favour: true },
  })),
  {
    event_id: "dgi_a3_approved", actor_id: "dg_shira", entity_type: "allocation", entity_id: "demo_alloc_bikes",
    event_type: "allocation.approved", value_tags: ["חדשנות"], timestamp: "2026-07-12T18:00:00+03:00", visibility: "public", caused_by: ["dgi_a3"],
  },
  {
    event_id: "dgi_t3_approved", actor_id: "dg_shira", entity_type: "transfer", entity_id: "demo_tr_bikes",
    event_type: "transfer.approved", value_tags: ["חדשנות"], timestamp: "2026-07-13T09:00:00+03:00", visibility: "public", caused_by: ["dgi_a3_approved"],
    payload: { allocation_id: "demo_alloc_bikes", recipient: "[DEMO] מפעיל תחנת אופניים", purpose: "רכש והתקנה", amount: 25000, approvals: [{ person_id: "dg_shira", role: "resources", at: "2026-07-13T09:00:00+03:00" }], tier: "medium" },
  },
  {
    event_id: "dgi_t3_completed", actor_id: "dg_shira", entity_type: "transfer", entity_id: "demo_tr_bikes",
    event_type: "transfer.completed", value_tags: ["חדשנות"], timestamp: "2026-07-15T13:00:00+03:00", visibility: "public", caused_by: ["dgi_t3_approved"],
    payload: { allocation_id: "demo_alloc_bikes" }, resource_delta: { kind: "money", amount: -25000, currency: "ILS" },
    evidence: ["ledger:demo_tx_out_02"], verification_status: "evidence",
  },
  {
    event_id: "dgi_i3", actor_id: "dg_uri", entity_type: "impact", entity_id: "demo_imp_bikes",
    event_type: "impact.recorded", value_tags: ["חדשנות"], timestamp: "2026-08-05T08:00:00+03:00", visibility: "public",
    payload: { allocation_id: "demo_alloc_bikes", period: ["2026-07-15", "2026-08-05"] },
    impact_claim: { people_affected: 80, statement: "[DEMO] דיווח ראשוני על שימוש נרחב בתחנה", resources_invested: 25000 },
    evidence: [], confidence: 0.4, verification_status: "self_report",
  },
  {
    event_id: "dgi_i3_rejected", actor_id: "dg_keren", entity_type: "impact", entity_id: "demo_imp_bikes",
    event_type: "impact.verified", value_tags: ["חדשנות"], timestamp: "2026-08-06T09:00:00+03:00", visibility: "public",
    payload: { target_impact_event_id: "dgi_i3", verification_method: "site_visit", result: "rejected", notes: "[DEMO] ביקור באתר — התחנה אינה פעילה, אין שימוש נצפה" },
    evidence: ["visit_log:demo_vl_03"], confidence: 0.75,
  },

  // ── today's activity, leading-contributor signal (dg_avi posts most) ────
  { event_id: "dgi_u1", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI, event_type: "update.posted", value_tags: [], timestamp: "2026-08-10T09:00:00+03:00", visibility: "public", payload: { text: "[DEMO] עדכון שבועי — התקדמות הפרויקטים" } },
  { event_id: "dgi_u2", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI, event_type: "update.posted", value_tags: [], timestamp: "2026-08-09T09:00:00+03:00", visibility: "public", payload: { text: "[DEMO] סיכום ביקור באתר הפאנלים" } },
  { event_id: "dgi_u3", actor_id: "dg_lior", entity_type: "value_group", entity_id: GI, event_type: "update.posted", value_tags: [], timestamp: "2026-08-08T09:00:00+03:00", visibility: "public", payload: { text: "[DEMO] עדכון על הצעת הקומפוסט" } },
  { event_id: "dgi_r1", actor_id: "dg_avi", entity_type: "value_group", entity_id: GI, event_type: "request.opened", value_tags: [], timestamp: "2026-08-10T10:00:00+03:00", visibility: "public", payload: { text: "[DEMO] בקשה חדשה — תחזוקת פאנלים" } },
];

const NB = DEMO_NEIGHBORHOOD_SMALL_ID;

export const DEMO_NEIGHBORHOOD_SMALL_EVENTS: PhilosEvent[] = [
  ...(["dn_ella", "dn_ben", "dn_tal", "dn_yuval"] as const).map((id, i) => ({
    event_id: `dns_p${i}`, actor_id: id, entity_type: "person" as const, entity_id: id,
    event_type: "person.registered" as const, value_tags: [], timestamp: `2026-06-2${i}T09:00:00+03:00`,
    visibility: "public" as const, payload: { display_name: `[DEMO] שכן ${i + 1}` },
  })),
  {
    event_id: "dns_open", actor_id: "dn_ella", entity_type: "value_group", entity_id: NB,
    event_type: "group.opened", value_tags: ["שכונה"], timestamp: "2026-06-24T08:00:00+03:00", visibility: "public",
    payload: {
      name: "[DEMO] רשת שכונתית קטנה", central_value: "שכנות טובה",
      creation_reason: "[DEMO] נתון הדגמה — קבוצה קטנה לבחינת מסך פקודת קהילה בקנה מידה מצומצם, אינה קהילה אמיתית.",
      goal: "עזרה הדדית קטנה בין שכנים", region: "רמת גן", visibility: "public", status: "active",
    },
  },
  ...(["dn_ben", "dn_tal", "dn_yuval"] as const).map((id, i) => ({
    event_id: `dns_join${i}`, actor_id: id, entity_type: "value_group" as const, entity_id: NB,
    event_type: "member.joined" as const, value_tags: [], timestamp: `2026-06-2${5 + i}T10:00:00+03:00`, visibility: "public" as const, payload: { person_id: id },
  })),
  {
    event_id: "dns_res1", actor_id: "dn_ella", entity_type: "value_group", entity_id: NB,
    event_type: "resource.received", value_tags: [], timestamp: "2026-06-28T10:00:00+03:00", visibility: "public",
    payload: { from: "[DEMO] 4 תרומות שכנים", reason: "קופה משותפת" },
    resource_delta: { kind: "money", amount: 1200, currency: "ILS" }, evidence: ["ledger:demo_tx_in_03"], verification_status: "evidence",
  },
  {
    event_id: "dns_a1", actor_id: "dn_ella", entity_type: "allocation", entity_id: "demo_alloc_toolshare",
    event_type: "allocation.proposed", value_tags: [], timestamp: "2026-06-29T09:00:00+03:00", visibility: "public",
    payload: { title: "[DEMO] ארגז כלים שיתופי", amount: 800, people_affected_estimate: 15, votes_required: 3 },
  },
  ...["dn_ella", "dn_ben", "dn_tal"].map((id, i) => ({
    event_id: `dns_v1_${i}`, actor_id: id, entity_type: "allocation" as const, entity_id: "demo_alloc_toolshare",
    event_type: "allocation.voted" as const, value_tags: [], timestamp: `2026-06-29T1${i}:00:00+03:00`, visibility: "public" as const, payload: { in_favour: true },
  })),
  { event_id: "dns_a1_approved", actor_id: "dn_ella", entity_type: "allocation", entity_id: "demo_alloc_toolshare", event_type: "allocation.approved", value_tags: [], timestamp: "2026-06-29T15:00:00+03:00", visibility: "public", caused_by: ["dns_a1"] },
  {
    event_id: "dns_t1_approved", actor_id: "dn_ella", entity_type: "transfer", entity_id: "demo_tr_toolshare",
    event_type: "transfer.approved", value_tags: [], timestamp: "2026-06-30T09:00:00+03:00", visibility: "public", caused_by: ["dns_a1_approved"],
    payload: { allocation_id: "demo_alloc_toolshare", recipient: "[DEMO] רכישת ארגז כלים", purpose: "כלים לשימוש משותף", amount: 800, approvals: [{ person_id: "dn_ella", role: "resources", at: "2026-06-30T09:00:00+03:00" }], tier: "small" },
  },
  {
    event_id: "dns_t1_completed", actor_id: "dn_ella", entity_type: "transfer", entity_id: "demo_tr_toolshare",
    event_type: "transfer.completed", value_tags: [], timestamp: "2026-07-01T13:00:00+03:00", visibility: "public", caused_by: ["dns_t1_approved"],
    payload: { allocation_id: "demo_alloc_toolshare" }, resource_delta: { kind: "money", amount: -800, currency: "ILS" },
    evidence: ["ledger:demo_tx_out_03"], verification_status: "evidence",
  },
  {
    event_id: "dns_i1", actor_id: "dn_ben", entity_type: "impact", entity_id: "demo_imp_toolshare",
    event_type: "impact.recorded", value_tags: [], timestamp: "2026-07-10T08:00:00+03:00", visibility: "public",
    payload: { allocation_id: "demo_alloc_toolshare", period: ["2026-07-01", "2026-07-10"] },
    impact_claim: { people_affected: 15, statement: "[DEMO] 15 שכנים השתמשו בארגז הכלים", resources_invested: 800 },
    evidence: ["visit_log:demo_vl_04"], confidence: 0.8, verification_status: "self_report",
  },
  {
    event_id: "dns_i1_verified", actor_id: "dn_tal", entity_type: "impact", entity_id: "demo_imp_toolshare",
    event_type: "impact.verified", value_tags: [], timestamp: "2026-07-11T09:00:00+03:00", visibility: "public",
    payload: { target_impact_event_id: "dns_i1", verification_method: "community_attestation", result: "verified", notes: "[DEMO] אושר על ידי שלושה שכנים" },
    evidence: ["attestation:demo_at_01"], confidence: 0.85,
  },
  { event_id: "dns_u1", actor_id: "dn_ella", entity_type: "value_group", entity_id: NB, event_type: "update.posted", value_tags: [], timestamp: "2026-07-15T09:00:00+03:00", visibility: "public", payload: { text: "[DEMO] עדכון — הארגז בשימוש פעיל" } },
];

export interface DemoCommunityMeta {
  group_id: string;
  events: PhilosEvent[];
  today: string;
}

/** Every demo community, for a listing/selector screen. Never includes the
 *  real seeded group (`valueGroupLog.ts::GROUP_ID`) — that one is REAL, not
 *  DEMO, and stays in its own separate list. */
export const DEMO_COMMUNITIES: DemoCommunityMeta[] = [
  { group_id: DEMO_GREEN_INNOVATION_ID, events: DEMO_GREEN_INNOVATION_EVENTS, today: DEMO_GREEN_INNOVATION_TODAY },
  { group_id: DEMO_NEIGHBORHOOD_SMALL_ID, events: DEMO_NEIGHBORHOOD_SMALL_EVENTS, today: DEMO_NEIGHBORHOOD_SMALL_TODAY },
];
