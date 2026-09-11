// @basis INSTR-testing-happens-against-the-current-corpus-and-an-exception, TASK-pixel-parity-render-app-and-mockup-at-one-viewport-and-diff, TASK-the-fixture-mirrors-the-mockup-s-own-scene-so-the-two-are, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none, CONST-zero-runtime-dependencies, CONST-node-24-no-build-step
/**
 * **A BOUNDED CORE SAMPLE OF THE REAL CORPUS — the SCALE half of a throwaway
 * twin, for the one instrument that cannot read a screen at full scale.**
 *
 * ── THE GAP THIS CLOSES, AND WHOSE GAP IT IS ───────────────────────────────
 *
 * `plan:port seq:93` (pixel parity) `needs` `plan:port seq:94`, and seq:94 is
 * marked **done**. Its deliverable was `.demo-corpus` — a fixture sized to the
 * mockup's own scene — and
 * `INSTR-testing-happens-against-the-current-corpus-and-an-exception` retired
 * that on 2026-09-07. So seq:93 inherited a satisfied dependency whose
 * deliverable does not exist, and the instrument that landed on 2026-09-11
 * measured the consequence exactly: **7 of 21 screens comparable, 14 refused,
 * 11 of those refusals purely because the two sides draw different AMOUNTS.**
 *
 * `e2e/seeds.ts` — the owner's 2026-09-11 exception, spelled as functions —
 * replaced `.demo-corpus` for STATE and not for SCALE. It can make a draft
 * exist or a selection spill. It cannot make the coverage screen draw 122
 * nodes where it draws 19,215.
 *
 * ── WHY THIS IS NOT `.demo-corpus` RETURNING ───────────────────────────────
 *
 * `.demo-corpus` was **authored beside** the real corpus: someone wrote items
 * into it so that each screen had something to draw, and then it rotted — four
 * specs spent 30 seconds each waiting on `src/api/handler.ts`, a file that
 * only ever existed there.
 *
 * Nothing here is authored. This is a **SUBSET**, computed by code from the
 * corpus as it stands at the moment the twin is built:
 *
 *   - every item that survives is the owner's, byte-identical, in its own
 *     file, with its own id, its own relations and its own scope;
 *   - every repository file that survives is the owner's, byte-identical;
 *   - nothing is added, rewritten, renamed or invented;
 *   - the choice of what survives is a pure function of the corpus, so the
 *     same corpus reduces to the same sample every time;
 *   - and it lives for the length of one test, inside a `mkdtemp` copy, and
 *     is deleted with it.
 *
 * It therefore cannot rot in the way a fixture rots: there is nothing to keep
 * up to date. An item the owner writes tomorrow is a candidate tomorrow; an
 * item he deletes is gone from the sample the next time a twin is built.
 *
 * ── THE ONE THING THIS IS NOT COVERED BY, SAID OUT LOUD ────────────────────
 *
 * The approved exception's own words are *"The copy is of THIS corpus — the
 * same items, the same ids, the same scale"*. **The same scale is the half
 * this file changes**, and that is a widening of the exception rather than a
 * use of it. It is confined to the pixel-parity walk, it is derived rather
 * than authored, and the corpus-untouched assertion in
 * `e2e/scratch-seeds.spec.ts` covers it — but it is the owner's call, and this
 * paragraph exists so that the next reader does not mistake it for something
 * he already said yes to.
 *
 * ── HOW THE SAMPLE IS CHOSEN, AND THE TWO PROPERTIES IT PRESERVES ──────────
 *
 * **1. Whole relation components, never a slice of one.** `checkOrphanRelation`
 * (doctor, `orphan_relation`) reports a relation whose target is not in the
 * corpus. A sample that kept an item and dropped its `supersedes` target would
 * manufacture a finding that does not exist in the owner's corpus — the
 * instrument would then be measuring its own reduction. So items are grouped
 * into connected components over their relations and a component is kept
 * ENTIRE or not at all. Most of this corpus is singletons (105 of 1,097 files
 * carry a `## Relations` section at all), so this costs almost nothing and
 * buys the graph screen real edges to draw.
 *
 * **2. One live file per surviving scope glob.** `checkDeadScopes`
 * (`dead_scope`) reports a `scope:` pattern matching no file in the
 * repository. Deleting the repository around a kept item would turn every one
 * of its globs dead. So the file reduction keeps, for each glob of each kept
 * item, the first file that glob really matches — using `globToRegExp`, the
 * product's own matcher, over `coverageFiles`, the product's own walk. What
 * the coverage screen then draws is a real subtree of the owner's repository,
 * governed by his real items.
 *
 * ── AND WHAT IT DELETES, WHICH IS LESS THAN IT SOUNDS ──────────────────────
 *
 * FILES ONLY, never directories. `driftedSource` writes `docs/seeded-drifting-
 * source.md` after this runs, and a seed that had to `mkdir` its own way back
 * would be a seed coupled to this one. An empty directory contributes no row
 * to any screen — `coverageFiles` returns paths of FILES — so leaving the
 * skeleton standing costs nothing and removes a whole class of ordering bug.
 */
import { readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';
import { parseItem } from '../src/core/item.ts';
import { globToRegExp, normalizePosix } from '../src/core/paths.ts';
import { NEEDS_FIELD, parseNeeds, taskKey } from '../src/core/needs.ts';
import { coverageFiles } from '../src/ui/read-model.ts';
import { DIR_NAME } from '../src/core/workspace.ts';
import type { Item } from '../src/core/types.ts';
import type { Seed } from './seeds.ts';

/**
 * How much of the corpus a reduced twin keeps.
 *
 * `items` is a CEILING and not a target: a relation component is kept whole,
 * so the last one taken can carry the total a little past it. The number is
 * reported by `describeTwin` rather than assumed anywhere.
 */
export interface ScaleBudget {
  /** Roughly how many items survive. A ceiling, overshot only by a component. */
  readonly items: number;
  /** How many real files to keep alive per surviving `scope` glob. */
  readonly filesPerGlob: number;
}

/**
 * **The scale the mockup itself draws at**, and the reason it is this number
 * rather than a rounder one.
 *
 * The design's twenty-one sections range from 22 nodes (`capture`) to 546
 * (`decay`), and `bodyComparable` accepts a 0.5x–2x band. There is therefore
 * no single corpus size at which every screen is comparable, and pretending
 * otherwise is how a screen gets made to LOOK comparable. This budget is
 * chosen for the eleven screens the walk refuses on scale, and the walk
 * measures every screen at BOTH scales and reports which one it used — see
 * `e2e/pixel-parity.spec.ts`.
 */
export const MOCKUP_SCALE: ScaleBudget = { items: 36, filesPerGlob: 1 };

/**
 * Files that survive whatever the sample says, because a check reads them by
 * name and their absence would be a finding the owner's corpus does not have.
 *
 *   `.gitignore`                   `checkIndexIgnored` (`index_not_ignored`)
 *                                  reads the repository root's own file.
 *   `package.json`                 the workspace's identity to every reader
 *                                  that asks what project this is.
 *   `docs/tutorials/manifest.json` `checkTutorialRoster`
 *                                  (`tutorial_roster_unreadable`) reads it.
 */
const ALWAYS_KEEP = ['.gitignore', 'package.json', 'docs/tutorials/manifest.json'] as const;

/** What a twin actually holds — counted, never assumed. */
export interface TwinScale {
  /** Item Markdown files under `.my_context/items/`. */
  readonly items: number;
  /** Distinct category directories those items live in. */
  readonly categories: number;
  /** What `coverageFiles` — the coverage screen's own walk — finds. */
  readonly files: number;
  /** Relations whose target is also present. What the graph screen can draw. */
  readonly liveRelations: number;
}

/**
 * Read every item in a twin with the product's own parser.
 *
 * **A file that will not parse is KEPT**, and that is deliberate rather than
 * lenient: an unparseable item is a corpus load error the owner's corpus
 * really has, and silently dropping it would make the twin healthier than the
 * thing it is a sample of.
 */
function loadItemFiles(root: string): { items: Item[]; unparseable: string[] } {
  const itemsDir = path.join(root, DIR_NAME, 'items');
  const items: Item[] = [];
  const unparseable: string[] = [];
  for (const category of readdirSync(itemsDir, { withFileTypes: true }).sort(byName)) {
    if (!category.isDirectory()) continue;
    const dir = path.join(itemsDir, category.name);
    for (const file of readdirSync(dir).sort()) {
      if (!file.endsWith('.md')) continue;
      const full = path.join(dir, file);
      try {
        items.push(parseItem(readFileSync(full, 'utf8'), full, 'project'));
      } catch {
        unparseable.push(full);
      }
    }
  }
  return { items, unparseable };
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * **Connected components over BOTH kinds of dependency a sample can break —
 * relations, and `needs`.**
 *
 * Undirected, because each finding is about a LINE in one file and the line
 * lives on one side: keeping the target and dropping the source is safe,
 * keeping the source and dropping the target is the finding. Treating the edge
 * as undirected keeps both ends and needs no case analysis.
 *
 * **`needs` is here because leaving it out was MEASURED.** A first version
 * grouped over relations alone; the reduced twin it produced answered two
 * `needs_unresolved` findings — `archive/47` and `builder/1b` — that the
 * owner's own corpus does not have at all (81 findings on 2026-09-11, not one
 * of them `needs_unresolved`). The reduction was manufacturing the defect the
 * instrument would then have reported. `needs` names a `plan/seq`, not an id,
 * so the edge is drawn through `taskKey` — the same key `buildTaskIndex` uses
 * and therefore the same key `checkNeeds` resolves against.
 *
 * Exported because it is the one piece of judgement in this file, and
 * `test/e2e/reduce.test.ts` drives it directly rather than through a twin.
 */
export function dependencyComponents(items: readonly Item[]): string[][] {
  const present = new Set(items.map((i) => i.id));
  const parent = new Map<string, string>();
  const find = (id: string): string => {
    let root = id;
    while (parent.get(root) !== undefined && parent.get(root) !== root) root = parent.get(root)!;
    return root;
  };
  for (const item of items) parent.set(item.id, item.id);
  const join = (left: string, right: string): void => {
    const a = find(left);
    const b = find(right);
    if (a !== b) parent.set(a, b);
  };
  // `plan/seq` → the items answering to it, superseded excluded exactly as
  // `workItems` excludes them: a replaced task is not an unmet dependency.
  const answering = new Map<string, string[]>();
  for (const item of items) {
    if (item.status === 'superseded') continue;
    const key = taskKey(item);
    if (key === null) continue;
    answering.set(key, [...(answering.get(key) ?? []), item.id]);
  }
  for (const item of items) {
    for (const relation of item.relations) {
      if (!present.has(relation.target)) continue;
      join(item.id, relation.target);
    }
    for (const ref of parseNeeds(item.extra[NEEDS_FIELD]).refs) {
      for (const target of answering.get(ref) ?? []) join(item.id, target);
    }
  }
  const groups = new Map<string, string[]>();
  for (const item of items) {
    const root = find(item.id);
    const list = groups.get(root) ?? [];
    list.push(item.id);
    groups.set(root, list);
  }
  return [...groups.values()].map((g) => [...g].sort());
}

/**
 * **Which items survive — a pure function of the corpus, so the same corpus
 * always reduces to the same sample.**
 *
 * Three things it guarantees, each because something downstream breaks
 * without it:
 *
 *   1. **Every category that has an item keeps one.** The palette, coverage
 *      and capture screens all draw the category vocabulary, and a sample
 *      missing a category would report an absence as a parity finding.
 *   2. **At least one multi-item relation component.** The graph screen draws
 *      an ego graph; with no live relation it draws one node and a legend, and
 *      `KNOWN-the-demo-corpus-has-no-relations-at-all-so-the-graph-screen`
 *      is the record of that exact failure on the retired fixture.
 *   3. **Pinned and normative items first inside a category.** `pinnableItem`
 *      and `pendingRevision` both need an active `rule` to exist, the pinned
 *      tier needs something to deliver, and a sample that happened to take
 *      three retired notes would starve all of them.
 */
export function chooseItems(items: readonly Item[], budget: ScaleBudget): Set<string> {
  const byId = new Map(items.map((i) => [i.id, i]));
  const components = dependencyComponents(items);
  const keep = new Set<string>();
  const take = (ids: readonly string[]): void => { for (const id of ids) keep.add(id); };

  // 1 · ONE multi-item component — the one carrying the most RELATIONS that
  // still fits a quarter of the budget. Whole, or not at all.
  //
  // **Relations rather than size, and the difference is measurable.** A
  // component is connected by relations AND by `needs`, and `needs` draws no
  // edge on the graph screen: the largest component that fits at
  // `MOCKUP_SCALE` is eight items held together by `needs` and contributes
  // TWO relation edges, where a five-item component of `supersedes` lines
  // contributes five. The graph screen's whole subject is edges, so the
  // ranking is edges.
  const relationEdges = (component: readonly string[]): number => {
    const inside = new Set(component);
    return component.reduce((n, id) => {
      const item = byId.get(id);
      if (item === undefined) return n;
      return n + item.relations.filter((r) => inside.has(r.target)).length;
    }, 0);
  };
  const linked = components
    .filter((c) => c.length >= 3 && c.length <= Math.max(3, Math.floor(budget.items / 4)))
    .map((c) => ({ ids: c, edges: relationEdges(c) }))
    .sort((a, b) => b.edges - a.edges || a.ids.length - b.ids.length
      || (a.ids[0]! < b.ids[0]! ? -1 : 1));
  if (linked.length > 0) take(linked[0]!.ids);

  // 2 · Then singletons, category by category, round robin, so a small budget
  // spends itself on VARIETY rather than on whichever category sorts first.
  const singles = new Map<string, string[]>();
  for (const component of components) {
    if (component.length !== 1) continue;
    const item = byId.get(component[0]!)!;
    const list = singles.get(item.type) ?? [];
    list.push(item.id);
    singles.set(item.type, list);
  }
  const rank = (id: string): string => {
    const item = byId.get(id)!;
    // Pinned first, then active, then by id: deterministic, and it puts the
    // items every other seed needs at the front of every category's queue.
    return `${item.always ? '0' : '1'}${item.status === 'active' ? '0' : '1'}${id}`;
  };
  for (const list of singles.values()) list.sort((a, b) => (rank(a) < rank(b) ? -1 : 1));
  const categories = [...singles.keys()].sort();
  for (let round = 0; keep.size < budget.items; round += 1) {
    let placed = false;
    for (const category of categories) {
      const list = singles.get(category)!;
      if (round >= list.length) continue;
      placed = true;
      keep.add(list[round]!);
      if (keep.size >= budget.items) break;
    }
    if (!placed) break;
  }
  return keep;
}

/**
 * **Which repository files survive: the ones the surviving items really
 * govern, by the product's own matcher, over the product's own walk.**
 *
 * Exported for the same reason as `relationComponents` — it is judgement, and
 * a node test can drive it without paying for a twin.
 */
export function chooseFiles(
  walked: readonly string[], kept: readonly Item[], budget: ScaleBudget,
): Set<string> {
  const keep = new Set<string>();
  for (const name of ALWAYS_KEEP) if (walked.includes(name)) keep.add(name);
  for (const item of kept) {
    if (item.sourceFile !== null) {
      const rel = normalizePosix(item.sourceFile);
      if (walked.includes(rel)) keep.add(rel);
    }
    for (const glob of item.scope) {
      const re = globToRegExp(glob);
      let taken = 0;
      for (const file of walked) {
        if (!re.test(file)) continue;
        keep.add(file);
        taken += 1;
        if (taken >= budget.filesPerGlob) break;
      }
    }
  }
  return keep;
}

/** What a twin holds right now, counted off its own disk. */
export function describeTwin(root: string): TwinScale {
  const { items } = loadItemFiles(root);
  const present = new Set(items.map((i) => i.id));
  return {
    items: items.length,
    categories: new Set(items.map((i) => i.type)).size,
    files: coverageFiles(root).files.length,
    liveRelations: items.reduce(
      (n, i) => n + i.relations.filter((r) => present.has(r.target)).length, 0),
  };
}

/**
 * **The seed: reduce this twin to a bounded core sample of itself.**
 *
 * Runs FIRST in a `seeds(...)` list — every other seed adds one state, and a
 * state added before this ran would be reduced away again. `e2e/seeds.ts`'
 * `procedures`, `draftInQueue`, `driftedSource` and `pinnableItem` all create
 * items, and all of them must come after.
 *
 * `env` is unused here and kept for the `Seed` shape: this reduction runs
 * entirely in process, on files, and starts no child. The rebuild that makes
 * it visible is `scratchCorpus`' own, which runs after every seed.
 */
export function coreSample(budget: ScaleBudget = MOCKUP_SCALE): Seed {
  return (root) => {
    const { items, unparseable } = loadItemFiles(root);
    const keptIds = chooseItems(items, budget);
    const kept = items.filter((i) => keptIds.has(i.id));

    // The repository first, while the items that name it are still on disk.
    const walked = coverageFiles(root).files;
    const keepFiles = chooseFiles(walked, kept, budget);
    for (const rel of walked) {
      if (keepFiles.has(rel)) continue;
      rmSync(path.join(root, ...rel.split('/')), { force: true });
    }

    // Then the corpus. `unparseable` is kept — see `loadItemFiles`.
    const spared = new Set(unparseable);
    for (const item of items) {
      if (keptIds.has(item.id) || spared.has(item.filePath)) continue;
      rmSync(item.filePath, { force: true });
    }

    // **A reduction that reduced nothing is a silent pass**, and this file's
    // whole value is that the twin is SMALLER than the corpus it came from.
    // Thrown rather than warned: a walk that ran at full scale believing it
    // ran at mockup scale would file every difference as a defect.
    const after = describeTwin(root);
    if (after.items > budget.items * 3 || after.files > walked.length) {
      throw new Error(
        `e2e/reduce.ts: the core sample did not reduce this twin — ${after.items} items and `
        + `${after.files} files survive against a budget of ${budget.items}. The twin is at full `
        + 'scale and every pixel finding taken on it would be a measurement of the corpus.',
      );
    }
  };
}

/** Kept beside `coreSample` so a caller can count a twin before reducing it. */
export function walkedFileCount(root: string): number {
  return statSync(root).isDirectory() ? coverageFiles(root).files.length : 0;
}
