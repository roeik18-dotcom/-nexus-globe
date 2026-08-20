import PlanetPage from "@/app/planet/page";
import type { ScaleProps } from "./types";

/** NETWORK scale — the sphere. Delegates to the existing implementation; see
 *  `GroupScale` for what is and is not yet hoisted. */
export default async function NetworkScale({ params }: ScaleProps) {
  return <PlanetPage searchParams={Promise.resolve(params)} />;
}
