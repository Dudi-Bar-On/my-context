import type { Config } from './config.ts';
import { rebuildRoots } from './open-store.ts';
import { loadLayer, type LoadError } from './rebuild.ts';
import { injectableTypes, mergeLayers } from './select.ts';
import type { Item } from './types.ts';
import type { Workspace } from './workspace.ts';

/**
 * The inline disclosure for a fallback-served injection —
 * INV-nothing-is-dropped-silently, inverted: disclose HOW it was served,
 * not that it wasn't (design §3, Option C).
 */
export const FALLBACK_NOTE =
  'my_context: served from Markdown; the index was unavailable.';

/**
 * The whole corpus from files, both layers, global first — the same order
 * as rebuild's LAYER_ORDER, so `mergeLayers` in `activeInjectableFromItems`
 * below resolves colliding ids exactly as the index's last-write-wins
 * upsert does (project wins, spec §5.1). Warm-cache cost: 28.1 ms p95 at
 * 500 items, 597.7 at 5,000 [M1]; the cold-cache ceiling is ~10,000 items
 * at 9,903 ms [R5].
 */
export function loadCorpusItems(ws: Workspace, errors: LoadError[] = []): Item[] {
  const roots = rebuildRoots(ws);
  const items: Item[] = [];
  if (roots.global) items.push(...loadLayer(roots.global, 'global', errors, ws.config));
  if (roots.project) items.push(...loadLayer(roots.project, 'project', errors, ws.config));
  return items;
}

/**
 * The JS mirror of the whole DB candidate pipeline, in the DB path's ORDER:
 * merge layers FIRST, then filter the winner — because that is what the
 * index does (rebuild's last-write-wins upsert with LAYER_ORDER global →
 * project, spec §5.1's "on conflicting id, project wins", THEN
 * `store.activeInjectable`'s status/type filter over the surviving row).
 * Filtering before the merge was executed to diverge (review I-1, 3/3
 * shadow cases): it deletes a draft/retired/non-injectable project shadow
 * from the list, so the shadowed global copy survives and gets injected —
 * a rule the project explicitly overrode. `mergeLayers` here and the one
 * inside `select` compose idempotently.
 *
 * The filter is applied BEFORE select — not only to the tiers — so the
 * fallback's focus-report universe (buildFocusReport over eligibleAll,
 * select.ts) matches the DB path's pre-filtered one. A fallback that fed
 * select the unfiltered corpus would produce identical INJECTIONS [R1] but
 * different focus-disclosure COUNTS — the disclosure-consistency defect
 * review I3 caught.
 */
export function activeInjectableFromItems(items: Item[], config: Config): Item[] {
  const types = new Set(injectableTypes(config));
  return mergeLayers(items).filter((i) => i.status === 'active' && types.has(i.type));
}
