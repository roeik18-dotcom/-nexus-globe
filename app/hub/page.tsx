import PhilosToday, { type TodayFigures } from "./PhilosToday";
import { projectValueGroup } from "@/app/lib/philos/projectValueGroup";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

export const metadata = { title: "Philos — היום" };

export default function HubPage() {
  const g = projectValueGroup(VALUE_GROUP_EVENTS, GROUP_ID, SEED_TODAY);

  // Every headline figure is a projection of the log. Nothing on the screen is
  // authored here; if the log cannot supply it, the screen says so instead.
  const completed = g?.transfers.filter((t) => t.state === "completed") ?? [];
  const verified = g?.impact.filter((i) => i.verified) ?? [];

  const figures: TodayFigures = {
    group_name: g?.name ?? "",
    groups: g ? 1 : 0,
    members: g?.members.length ?? 0,
    events_total: g?.event_count ?? 0,
    events_today: g?.today.length ?? 0,
    money_received: g?.budget.received ?? 0,
    money_transferred: completed.reduce((s, t) => s + t.amount, 0),
    people_affected_verified: verified.reduce((s, i) => s + i.people_affected, 0),
    transfer: completed[0]
      ? {
          amount: completed[0].amount,
          from_value: g?.central_value ?? "",
          to: completed[0].recipient,
        }
      : undefined,
  };

  return <PhilosToday figures={figures} />;
}
