import ValueHub from "../ValueHub";
import { GROUP_ID, SEED_TODAY, VALUE_GROUP_EVENTS } from "@/app/lib/philos/valueGroupLog";

export const metadata = { title: "Philos — קבוצת ערך" };

export default function CommunityPage() {
  // The log is the source; the screen only renders its projection.
  return <ValueHub seedEvents={VALUE_GROUP_EVENTS} groupId={GROUP_ID} today={SEED_TODAY} />;
}
