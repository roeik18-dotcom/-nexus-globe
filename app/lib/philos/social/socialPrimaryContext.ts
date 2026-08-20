/**
 * ONE BUILDER for the shared primary context.
 *
 * `SocialPrimaryStage` is the shared SHAPE; this is the shared DERIVATION.
 * Having only the first would have re-created the original defect one level
 * down: three routes filling one interface from three different expressions,
 * disagreeing about numbers they both display — exactly what
 * `loadSocialSystem` was written to stop.
 *
 * So every figure on the stage is computed HERE, once, from the shared social
 * state. A scale supplies only what is genuinely its own: its title, how many
 * arcs IT draws, and its audit node.
 *
 * Nothing here loads, filters or derives truth. Provenance and gate figures
 * come straight from `buildNetworkAccounting`, which is already the single
 * authority for relation accounting; this module does not re-count them.
 */
import type { ReactNode } from "react";

import type { EntityLink } from "../bridge/entityLink";
import type { ViewerContext } from "../identity/viewerContext";
import type { SocialPrimaryContext } from "../shell/SocialPrimaryStage";
import { buildNetworkAccounting } from "./networkAccounting";
import type { SocialSelection } from "./socialSelection";
import { ABSENCE_TEXT, type Scale, type SocialObject } from "./socialSystemProjection";

export interface PrimaryContextInput {
  scale: Scale;
  viewer: ViewerContext;
  title: string;
  subtitle: string;
  /** Straight from `loadSocialSystem(viewer)` — never re-derived per surface. */
  objects: readonly SocialObject[];
  bridgeLinks: readonly EntityLink[];
  selection: SocialSelection;
  /** Arcs THIS scale actually draws. GROUP and SYSTEM draw none, and 0 here is
   *  a measured fact about the drawing, not an absence of relations. */
  arcs?: readonly { relation: string; event_id: string; verification_status?: string }[];
  audit?: ReactNode;
  density?: "page" | "hud";
}

export function buildSocialPrimaryContext(i: PrimaryContextInput): SocialPrimaryContext {
  const accounting = buildNetworkAccounting(i.bridgeLinks, i.arcs ?? []);

  // Presence of the SELECTED object at THIS scale, read off the object's own
  // scale record. Absence always carries the projection's own reason; no
  // surface writes one of its own.
  const presence = i.selection.status === "resolved"
    ? {
        present: i.selection.object.scales[i.scale].present,
        because: (() => {
          const at = i.selection.object.scales[i.scale];
          return at.present
            ? (at.as ?? "")
            : (at.absent_because ? ABSENCE_TEXT[at.absent_because] : "");
        })(),
      }
    : undefined;

  return {
    scale: i.scale,
    viewer: i.viewer,
    title: i.title,
    subtitle: i.subtitle,
    headline: {
      n: i.objects.filter((o) => o.scales[i.scale].present).length,
      unit: "RECORDS AT THIS SCALE",
    },
    selection: i.selection,
    presence,
    inScope: i.objects.filter((o) => o.scales[i.scale].present).length,
    relations: {
      entity_links: accounting.totals.entity_links,
      gated_relations: accounting.totals.gated_relations,
      drawn_arcs: accounting.totals.drawn_arcs,
      passed: accounting.gate.passed.length,
      candidates: accounting.gate.passed.length + accounting.gate.rejected.length,
    },
    provenance: {
      real: accounting.totals.real_relations,
      derived: accounting.totals.derived_relations,
      demo: accounting.totals.demo_relations,
    },
    audit: i.audit,
    density: i.density,
  };
}
