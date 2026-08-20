import WorldPage from "@/app/world/page";
import type { ScaleProps } from "./types";

/** SYSTEM scale — observed system state and the reference architecture.
 *  Delegates to the existing implementation; see `GroupScale`. */
export default async function SystemScale({ params }: ScaleProps) {
  return <WorldPage searchParams={Promise.resolve(params)} />;
}
