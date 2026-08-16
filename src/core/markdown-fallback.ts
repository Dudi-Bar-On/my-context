import type { Config } from './config.ts';
import { rebuildRoots } from './open-store.ts';
import { loadLayer, type LoadError } from './rebuild.ts';
import { injectableTypes } from './select.ts';
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
 * The whole corpus from files, both layers, global first — precedence is
 * select's mergeLayers job, and items.id PRIMARY KEY on the DB path resolves
 * identically (verified by execution: IDENTICAL selections 5/5 [R1]).
 * Warm-cache cost: 28.1 ms p95 at 500 items, 597.7 at 5,000 [M1]; the
 * cold-cache ceiling is ~10,000 items at 9,903 ms [R5].
 */
export function loadCorpusItems(ws: Workspace, errors: LoadError[] = []): Item[] {
  const roots = rebuildRoots(ws);
  const items: Item[] = [];
  if (roots.global) items.push(...loadLayer(roots.global, 'global', errors, ws.config));
  if (roots.project) items.push(...loadLayer(roots.project, 'project', errors, ws.config));
  return items;
}

/**
 * The JS mirror of `store.activeInjectable` (store.ts): active status,
 * enabled-normative type. Applied BEFORE select — not only to the tiers —
 * so the fallback's focus-report universe (buildFocusReport over
 * eligibleAll, select.ts) matches the DB path's pre-filtered one. A
 * fallback that fed select the unfiltered corpus would produce identical
 * INJECTIONS [R1] but different focus-disclosure COUNTS — the
 * disclosure-consistency defect the review caught (I3).
 */
export function activeInjectableFromItems(items: Item[], config: Config): Item[] {
  const types = new Set(injectableTypes(config));
  return items.filter((i) => i.status === 'active' && types.has(i.type));
}
