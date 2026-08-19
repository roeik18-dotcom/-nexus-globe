/**
 * RELATION MAP (Mission B, B4) — a navigable list of every REAL,
 * evidenced edge this codebase currently has, grouped by edge type.
 * Deliberately text/list-based, not a canvas graph: every other view in
 * this file uses the same real-list convention (§B13 visual convergence
 * — one product, one grammar), and a graph-drawing library would be new
 * infrastructure this pass doesn't need to introduce to show real edges
 * honestly.
 *
 * Edge types actually backed by real data today: VALUE↔VALUE (source
 * corpus extraction), VALUE↔GROUP (central_value), GROUP↔PERSON
 * (membership), ACTION→EFFECT (`effect.action_ref`), EFFECT→EVIDENCE
 * (`effect.verified_outcome`, canon's own evidence record — no separate
 * Evidence entity exists), and — found on a second pass over this same
 * mission — GROUP↔NEED/GROUP↔ACTION/NEED↔OFFER/EFFECT↔PERSON via the
 * Canonical Cross-Entity Link Registry (`linkRegistry.ts`), which this
 * view had not been wired to yet even though `page.tsx` already computes
 * it for the group-detail terminal. Every one of those is real (REAL or
 * clearly-labeled DEMO provenance, per `EntityLink.provenance` — never
 * fabricated to fill a section) — see that module's own header: "no new
 * fact, no new store, no new coordinate."
 * EVIDENCE→IMPACT still has NO real link in this codebase (no canon
 * "Impact" entity exists distinct from a verified Effect) — stated
 * plainly below, never fabricated.
 */
import type { ValueEntry } from "@/app/lib/philos/community/valueRegistry";
import type { GroupRegistryEntry } from "@/app/lib/philos/community/groupRegistry";
import type { SourceValueRelation } from "@/app/lib/philos/community/sourceValueModel";
import type { ActionRecord } from "@/app/lib/philos/canon/actionStore";
import type { EffectRecord } from "@/app/lib/philos/canon/effectStore";
import { isEffectVerified } from "@/app/lib/philos/canon/effect";
import type { EntityLink } from "@/app/lib/philos/bridge/entityLink";
import type { PersonRow } from "./CommunityUniverse";
import { S } from "./CommunityUniverse";

const RELATION_TYPE_COLOR: Record<string, string> = {
  TENSION: "#f2635c", OPPOSITION: "#f2635c", CONTINUUM: "#5aa6ff", SOCIAL_RELATION: "#a78bfa",
};

const RELATION_LABEL: Record<string, string> = {
  COMMUNITY_HAS_NEED: "GROUP ↔ NEED",
  ACTION_AFFECTS_COMMUNITY: "GROUP ↔ ACTION",
  NEED_MATCHED_TO_OFFER: "NEED ↔ OFFER (RESOURCE)",
  PROVIDER_OFFERS_RESOURCE: "PROVIDER ↔ RESOURCE",
  EFFECT_AFFECTS_PERSON: "EFFECT ↔ PERSON",
  EFFECT_AFFECTS_COMMUNITY: "EFFECT ↔ GROUP",
};
const BRIDGE_RELATIONS = Object.keys(RELATION_LABEL);

export default function RelationMapView({
  valueRegistry, groupRegistry, people, sourceValueRelations, runtimeValueRelations, canonActions, canonEffects, bridgeLinks,
}: {
  valueRegistry: ValueEntry[];
  groupRegistry: GroupRegistryEntry[];
  people: PersonRow[];
  sourceValueRelations: SourceValueRelation[];
  runtimeValueRelations: SourceValueRelation[];
  canonActions: ActionRecord[];
  canonEffects: EffectRecord[];
  /** Mission B, continuation — the Canonical Cross-Entity Link Registry
   *  `page.tsx` already builds for the group-detail terminal
   *  (`buildDefaultLinkRegistry`), reused here rather than re-derived —
   *  the real source of GROUP↔NEED/GROUP↔ACTION/NEED↔OFFER/EFFECT↔PERSON
   *  edges this view was missing. */
  bridgeLinks: EntityLink[];
}) {
  const bridgeEdges = bridgeLinks.filter((l) => BRIDGE_RELATIONS.includes(l.relation));
  const runtimeIds = new Set(runtimeValueRelations.map((r) => r.relation_id));

  const valueGroupEdges = valueRegistry.flatMap((v) =>
    v.groups.map((gid) => ({ value: v.name, group: groupRegistry.find((g) => g.group_id === gid)?.name ?? gid })),
  );

  const groupPersonEdges = people.flatMap((p) => p.memberships.map((m) => ({ person: p.person.person_id, group: m.group_name })));

  const actionEffectEdges = canonEffects.map((e) => ({
    effect: e,
    action: canonActions.find((a) => a.action.action_id === e.effect.action_ref),
  }));

  return (
    <>
      <Section title={`מפת יחסים · RELATION MAP — ${sourceValueRelations.length + valueGroupEdges.length + groupPersonEdges.length + actionEffectEdges.length} קשתות ממשיות`}>
        <div style={S.note}>רק קשתות עם ראיה ממשית מוצגות. אין קשתות דמיון-לשוני, אין קשתות מומצאות.</div>
      </Section>

      <Section title={`VALUE ↔ VALUE (source corpus, ${sourceValueRelations.length})`}>
        {sourceValueRelations.length === 0 ? <Empty>0</Empty> : (
          <div style={S.list}>
            {sourceValueRelations.map((r) => (
              <div key={r.relation_id} style={S.listRow}>
                <span style={S.listTitle}>{r.pole_a} ↔ {r.pole_b}</span>
                <span style={S.listMeta}>
                  <span style={{ color: RELATION_TYPE_COLOR[r.relation_type] ?? "#8fa3c9" }}>{r.relation_type}</span> ·{" "}
                  {runtimeIds.has(r.relation_id) ? "CANONICAL_RUNTIME" : "REFERENCE_ONLY"} · {r.confidence}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`VALUE ↔ GROUP (central_value, ${valueGroupEdges.length})`}>
        {valueGroupEdges.length === 0 ? <Empty>0</Empty> : (
          <div style={S.list}>
            {valueGroupEdges.map((e, i) => (
              <div key={i} style={S.listRow}>
                <span style={S.listTitle}>{e.value} ↔ {e.group}</span>
                <span style={S.listMeta}>central_value</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`GROUP ↔ PERSON (membership, ${groupPersonEdges.length})`}>
        {groupPersonEdges.length === 0 ? <Empty>0</Empty> : (
          <div style={S.list}>
            {groupPersonEdges.map((e, i) => (
              <div key={i} style={S.listRow}>
                <span style={S.listTitle}>{e.person} ↔ {e.group}</span>
                <span style={S.listMeta}>member</span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`ACTION → EFFECT → EVIDENCE (${actionEffectEdges.length})`}>
        {actionEffectEdges.length === 0 ? <Empty>0 — אין Effect קנוני רשום עדיין.</Empty> : (
          <div style={S.list}>
            {actionEffectEdges.map(({ effect, action }) => (
              <div key={effect.effect.effect_id} style={S.listRow}>
                <span style={S.listTitle}>
                  {action ? `${action.action.type} (${action.action.action_id.slice(0, 8)}…)` : `action_ref ${effect.effect.action_ref.slice(0, 8)}… (not found)`}
                  {" → "}{effect.effect.claimed_outcome.statement}
                </span>
                <span style={S.listMeta}>
                  {isEffectVerified(effect.effect)
                    ? <span style={{ color: "#34d399" }}>EVIDENCE: {effect.effect.verified_outcome!.verifier_type} · {effect.effect.verified_outcome!.method}</span>
                    : <span style={{ color: "#a78bfa" }}>claimed only — no verified_outcome yet</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </Section>

      <Section title={`GROUP ↔ NEED · GROUP ↔ ACTION · NEED ↔ OFFER · EFFECT ↔ PERSON/GROUP (Canonical Cross-Entity Link Registry, ${bridgeEdges.length})`}>
        {bridgeEdges.length === 0 ? (
          <Empty>0</Empty>
        ) : (
          <div style={S.list}>
            {bridgeEdges.map((l) => (
              <div key={l.link_id} style={S.listRow}>
                <span style={S.listTitle}>{RELATION_LABEL[l.relation]}: {l.source.canonical_id.slice(0, 16)} → {l.target.canonical_id.slice(0, 16)}</span>
                <span style={{ ...S.listMeta, color: l.provenance === "REAL" ? "#34d399" : "#fbbf24" }}>{l.provenance}{l.note ? ` · ${l.note}` : ""}</span>
              </div>
            ))}
          </div>
        )}
      </Section>
      <Section title="EVIDENCE → IMPACT">
        <Empty>0 — אין ישות Impact קנונית נפרדת מ-Effect מאומת. פער מתועד, לא בדוי.</Empty>
      </Section>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={S.section}>
      <div style={S.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function Empty({ children }: { children: React.ReactNode }) {
  return <div style={S.empty}>{children}</div>;
}
