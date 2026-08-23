/**
 * GROUP RELATIONS FROM THE EVENT SPINE — edges that appear because activity
 * appeared, each carrying the event ids that justify it.
 *
 * `groupRelations.ts` derives what the STATIC registry supports (shared
 * members, shared sub-value). This module derives what only a HISTORY can
 * show: two groups needing the same thing, one group's resource answering
 * another's need, money that actually moved between them, an action that
 * consumed another group's object. Those are the edges that make Network
 * meaningful, and none of them is computable from a roster.
 *
 * EVERY EDGE NAMES ITS EVIDENCE. `justifying_event_ids` is not decoration: an
 * edge a reader cannot trace back to recorded events is an assertion, and the
 * Network is supposed to be the one place assertions cannot hide. No events →
 * no edge, and that is the honest current answer.
 */
import type { GroupOperationalState } from "./groupOperationalState";
import type { GroupRelation, GroupRelationType } from "./groupRelations";
import type { CandidateMatch } from "./needResourceBridge";
import type { BudgetPayload } from "./groupEvent";

export interface EventRelation extends GroupRelation {
  justifying_event_ids: string[];
}

export function deriveEventRelations(
  states: ReadonlyMap<string, GroupOperationalState>,
  crossGroupCandidates: readonly CandidateMatch[] = [],
): EventRelation[] {
  const out: EventRelation[] = [];
  const ids = [...states.keys()].sort();
  const add = (
    from: string, to: string, type: GroupRelationType,
    evidence: string, event_ids: string[], shared?: string[], strength = 1,
  ) => out.push({ from_group_id: from, to_group_id: to, type, evidence, shared, strength, justifying_event_ids: event_ids });

  // 1 · RESOURCE_FLOW — money that actually moved, named counterparty.
  for (const [gid, s] of states) {
    for (const e of s.history) {
      if (e.event_type !== "BUDGET_SPENT" && e.event_type !== "BUDGET_RECEIVED") continue;
      const pay = e.payload as unknown as BudgetPayload | undefined;
      const cp = pay?.counterparty_group_id;
      if (!cp || !states.has(cp) || cp === gid) continue;
      const [from, to] = e.event_type === "BUDGET_SPENT" ? [gid, cp] : [cp, gid];
      add(from, to, "RESOURCE_FLOW",
        `אירוע תקציב עם קבוצת נגד רשומה (${pay?.amount} ${pay?.currency})`,
        [e.event_id]);
    }
  }

  // 2 · SHARED_NEED / SHARED_RESOURCE — the same canonical sub-value, from
  //     two groups' own recorded declarations.
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const a = states.get(ids[i])!, b = states.get(ids[j])!;

      const needSv = a.needs.filter((n) => n.subvalue_id && b.needs.some((m) => m.subvalue_id === n.subvalue_id));
      if (needSv.length) {
        const partners = b.needs.filter((m) => needSv.some((n) => n.subvalue_id === m.subvalue_id));
        add(ids[i], ids[j], "SHARED_NEED", `שתי הקבוצות הצהירו צורך באותו תת-ערך`,
          [...needSv.map((n) => n.last_event_id), ...partners.map((m) => m.last_event_id)],
          [...new Set(needSv.map((n) => n.subvalue_id!))], needSv.length);
      }

      const resSv = a.resources.filter((r) => r.subvalue_id && b.resources.some((q) => q.subvalue_id === r.subvalue_id));
      if (resSv.length) {
        const partners = b.resources.filter((q) => resSv.some((r) => r.subvalue_id === q.subvalue_id));
        add(ids[i], ids[j], "SHARED_RESOURCE", `שתי הקבוצות מציעות משאב באותו תת-ערך`,
          [...resSv.map((r) => r.last_event_id), ...partners.map((q) => q.last_event_id)],
          [...new Set(resSv.map((r) => r.subvalue_id!))], resSv.length);
      }

      // 3 · MEMBER_OVERLAP — active rosters, from join/leave events.
      const am = new Set(a.members.filter((m) => m.active).map((m) => m.person_id));
      const shared = b.members.filter((m) => m.active && am.has(m.person_id));
      if (shared.length) {
        add(ids[i], ids[j], "OVERLAPPING_MEMBERS", `${shared.length} אנשים פעילים בשתי הקבוצות`,
          shared.flatMap((m) => m.event_ids), shared.map((m) => m.person_id), shared.length);
      }
    }
  }

  // 4 · COOPERATION — a cross-group candidate a person ACCEPTED. A candidate
  //     alone is not cooperation; someone has to have agreed.
  for (const [gid, s] of states) {
    for (const m of s.matches) {
      if (m.status !== "ACCEPTED") continue;
      const other = crossGroupCandidates.find((c) => c.need_ref === m.need_ref && c.resource_ref === m.resource_ref);
      if (!other || !other.cross_group) continue;
      const partner = other.need_group_id === gid ? other.resource_group_id : other.need_group_id;
      if (!states.has(partner) || partner === gid) continue;
      add(gid, partner, "COOPERATION", `התאמה בין־קבוצתית שאושרה: ${m.basis ?? m.match_id}`, [m.last_event_id]);
    }
  }

  // 5 · ACTION_DEPENDENCY — an action whose recorded inputs include another
  //     group's need or resource id.
  for (const [gid, s] of states) {
    for (const act of s.actions) {
      for (const input of act.inputs ?? []) {
        for (const [other, os] of states) {
          if (other === gid) continue;
          if (os.needs.some((n) => n.need_id === input) || os.resources.some((r) => r.resource_id === input)) {
            add(gid, other, "ACTION_DEPENDENCY", `פעולה שקלט שלה שייך לקבוצה אחרת (${input})`, [act.last_event_id], [input]);
          }
        }
      }
    }
  }

  // 6 · CONFLICT — a recorded tension naming another registry group as a pole.
  //     Never derived from two groups holding different values.
  for (const [gid, s] of states) {
    for (const t of s.tensions) {
      for (const pole of [t.pole_a, t.pole_b]) {
        if (pole && states.has(pole) && pole !== gid) {
          add(gid, pole, "CONFLICT", `מתח מתועד שמנקב בקבוצה השנייה: ${t.description ?? t.tension_id}`, [t.event_id]);
        }
      }
    }
  }

  return out;
}
