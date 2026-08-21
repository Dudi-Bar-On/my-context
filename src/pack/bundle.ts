/**
 * `buildBundle` — the one selection and the one allow-list walk, in memory.
 *
 * Four transport surfaces stand behind this function: `mycontext export`
 * writing a directory, the same command writing a ZIP, and both again under
 * `--as-pack`. They differ in how the bytes are *written*, never in which
 * bytes there are, so there is one builder and the writers take a `Bundle`.
 * A second packer behind `--as-pack` would be the fifth spelling of a concept
 * this project has already paid for four times.
 *
 * Nothing here touches the filesystem except through the item loader, and
 * nothing here writes. A refusal below is therefore always "nothing was
 * written" in the strongest sense available: nothing was even opened for
 * writing.
 *
 * ## What it walks, and what it has no way to widen
 *
 * It calls `loadLayer` for the PROJECT layer only — the global layer is
 * another workspace's corpus, read-only from here, and exporting it would put
 * a second repository's knowledge inside an artefact named after this one.
 * There is no directory walk in this module. The only paths it can produce
 * are one per selected item — taken from that item's own `filePath`, not
 * rebuilt from its `type` and `id`, so an artefact says where the item WAS —
 * plus `config.json`, `history.jsonl` when it travels, and `manifest.json`.
 * So the allow-list is not a filter over a wide walk that someone could
 * widen: the walk has nothing to widen.
 *
 * ## `refuseArtefactPaths`, plural, and why the singular the plan showed is
 * the one check that cannot see the problem
 *
 * A case collision is a property of the SET. `items/rule/RULE-a.md` and
 * `items/RULE/RULE-b.md` are each perfectly legal on their own; together they
 * are an artefact that verifies on Linux and fails on Windows, which is the
 * worst available outcome because the author is the one who cannot reproduce
 * it. `refuseArtefactPath` per file is blind to that by construction, so this
 * module calls the plural over the whole assembled set — root files included,
 * since a root file is a path in the same namespace as an item's.
 *
 * `buildManifest` checks the same set again, and that is not a reason to skip
 * it here. Two reasons, and the second is the load-bearing one:
 *
 *   - The set is ASSEMBLED here. `manifest.ts` states the rule in the other
 *     direction — a check enforced only in the caller that remembers to ask
 *     is not enforced — and the symmetric reading is that a check enforced
 *     only in the callee you happen to call today is not enforced by you.
 *   - A future path through this function that does not build a manifest —
 *     a preview, a count, a `--dry-run` that renders and stops — would lose
 *     the check silently. The refusal has to sit where the set is made.
 *
 * The refusal it raises is attributed: on the failure path only, the offending
 * path is looked up back to the item that owns it, so the author is told which
 * item to fix rather than which string was rejected. That attribution is why
 * this call is not a duplicate of `buildManifest`'s — the message is different
 * because it knows something `buildManifest` cannot.
 *
 * ## The pack projection, and the checksum that survives it
 *
 * `kind: 'pack'` sets `sourceFile`, `sourceAnchor` and `sourceChecksum` to
 * `null` before rendering, and counts each field it actually cleared. Left in,
 * they name documents in the AUTHOR's repository and make the importer's
 * `doctor` emit `source_missing` at level **error** for every imported item,
 * permanently, for files they can never resolve.
 *
 * The recorded frontmatter `checksum` is deliberately NOT recomputed, and that
 * is safe rather than lucky: `computeItemChecksum` (`core/item.ts`) hashes
 * thirteen fields and provenance is not among them, so an item whose
 * provenance was cleared still hashes to the value written in its own
 * frontmatter. Recomputing would have been the dangerous move — it would
 * change the recorded checksum of every exported item and destroy the
 * stale-checksum signal that is the only evidence a file was altered outside
 * my_context.
 *
 * Note what is NOT dropped: the fields are set to `null`, and `renderItem`
 * writes `source_file: null` rather than omitting the key. The frontmatter
 * shape is fixed by the renderer and an item that dropped keys would not be
 * the same format. What the pack withholds is the VALUE, which is the whole of
 * what leaked.
 *
 * ## Why every exclusion names its flag, and why the flag is not restated
 *
 * `INV-nothing-is-dropped-silently`: an item the filters withheld is named in
 * the report, with the flag that withheld it. Attribution asks `filterItems`
 * one filter at a time rather than re-implementing the predicate — the
 * corpus filter is one expression on purpose (`core/search.ts` says so in its
 * own comment), and a second copy here would agree with it only until someone
 * edited either. `FILTER_FLAGS` is a TOTAL table over `ItemFilters`, so a
 * seventh filter added to that interface fails to compile here instead of
 * quietly excluding items for a reason the report cannot name.
 *
 * ## `history.jsonl` present-and-empty is not the same as absent
 *
 * With `history: false` the file does not exist: history was withheld. With
 * `history: true` and nothing to say, a zero-byte `history.jsonl` is written:
 * history travelled and there was none. A receiver can tell those apart, and
 * collapsing them would make "this pack carries no history" unanswerable.
 *
 * ## What this module deliberately does NOT check
 *
 *   - **`kind`, `name` and `version`.** `buildManifest` validates the triple
 *     through `refuseMeta`, which also guards `parseManifest` on the way back
 *     in — one enforcement, reached from both directions. Pre-checking here
 *     would be a second spelling that could drift from the export/pack
 *     asymmetry (`name` and `version` are non-null for a pack and null for an
 *     export), and the only thing it would buy is skipping an in-memory walk
 *     that writes nothing.
 *   - **The Unicode screen.** `screenPackMeta` and `screenItem` belong to
 *     `screen.ts`, which owns that table. Restating any part of it here would
 *     produce two lists that drift.
 *   - **A category that no longer resolves.** `projectPackConfig` refuses an
 *     item whose `type` is not in the config, by name, with the reason. That
 *     refusal is `config-io.ts`'s and is left to fire: an item of a deleted
 *     category has no honest prefix or tier to invent, and excluding it
 *     instead would report it as filtered when it was not.
 */
import { Buffer } from 'node:buffer';
import type { Config } from '../core/config.ts';
import { renderItem } from '../core/item.ts';
import { loadLayer, type LoadError } from '../core/rebuild.ts';
import { filterItems, type ItemFilters } from '../core/search.ts';
import type { Item } from '../core/types.ts';
import { projectExportConfig, projectPackConfig } from './config-io.ts';
import { exportableHistory, renderHistory } from './history.ts';
import { buildManifest, renderManifest, type Manifest } from './manifest.ts';
import {
  comparePaths, refuseArtefactPath, refuseArtefactPaths,
  CONFIG_NAME, HISTORY_NAME, MANIFEST_NAME,
  type ArtefactKind, type ExportFile,
} from './layout.ts';

/** What the caller decided, before anything is read. */
export interface BundleOptions {
  kind: ArtefactKind;
  /** Required when `kind === 'pack'`, and refused otherwise — by `buildManifest`. */
  name: string | null;
  /** Required when `kind === 'pack'`, and refused otherwise — by `buildManifest`. */
  version: string | null;
  /** The corpus filter, reused rather than re-expressed. */
  filters: ItemFilters;
  /** False writes no `history.jsonl` at all. See the module comment. */
  history: boolean;
  /** Milliseconds since the epoch, injected — never read from the clock here. */
  now: number;
}

/** One provenance field the pack projection cleared, and on how many items. */
export interface DroppedField {
  field: string;
  items: number;
}

/** One item the filters withheld, and the flag that withheld it. */
export interface ExcludedItem {
  id: string;
  reason: string;
}

/** Everything a preview needs, so a caller never re-derives it from `files`. */
export interface BundleReport {
  items: number;
  byCategory: Record<string, number>;
  historyRecords: number;
  droppedFields: DroppedField[];
  excluded: ExcludedItem[];
}

/** An artefact, in memory. `files` is sorted and holds `manifest.json` too. */
export interface Bundle {
  files: ExportFile[];
  manifest: Manifest;
  report: BundleReport;
}

/**
 * The three provenance fields a pack withholds, paired with the frontmatter
 * spelling of each: the report names the field a reader would look for in the
 * file, not the camel-case property the type happens to use.
 */
const PROVENANCE: readonly {
  key: 'sourceFile' | 'sourceAnchor' | 'sourceChecksum';
  field: string;
}[] = [
  { key: 'sourceFile', field: 'source_file' },
  { key: 'sourceAnchor', field: 'source_anchor' },
  { key: 'sourceChecksum', field: 'source_checksum' },
];

/**
 * Every filter, and the flag a user typed to set it.
 *
 * `Record<keyof ItemFilters, string>` and not a partial map: a filter added to
 * `ItemFilters` stops this file compiling until someone says what flag names
 * it, instead of silently excluding items with a reason that cannot mention
 * the cause. The four beyond `--type`/`--status`/`--tag` are not offered by
 * `mycontext export` today; they are here because the type is what this
 * function accepts, and a caller passing one must get a report that can
 * explain itself.
 */
const FILTER_FLAGS: Record<keyof ItemFilters, string> = {
  type: '--type',
  status: '--status',
  tag: '--tag',
  text: '--text',
  path: '--path',
  relation: '--relation',
};

/** The keys of `FILTER_FLAGS`, in the order it declares them. */
const FILTER_KEYS = Object.keys(FILTER_FLAGS) as (keyof ItemFilters)[];

/**
 * Assign without going through `[[Set]]`, so a category literally named
 * `__proto__` becomes a member rather than the object's prototype. `type` is
 * read from an item's frontmatter and nothing in `core/` validates it against
 * a grammar, so it reaches this counter as whatever the file said.
 */
function bump(counts: Record<string, number>, key: string): void {
  const next = (Object.hasOwn(counts, key) ? counts[key] : 0) + 1;
  Object.defineProperty(counts, key, {
    value: next, writable: true, enumerable: true, configurable: true,
  });
}

/**
 * Which flag or flags withheld this item, asked of the corpus filter one
 * filter at a time.
 *
 * At least one clause always fires: `filterItems` is a conjunction of
 * predicates each of which reads only this item and the config, so an item the
 * whole conjunction rejected is rejected by at least one conjunct. There is no
 * empty-clause branch below for that reason — a branch that can never be the
 * one to decide is a branch no test could notice was gone.
 */
function exclusionReason(item: Item, filters: ItemFilters, config: Config): string {
  const clauses: string[] = [];
  for (const key of FILTER_KEYS) {
    const value = filters[key];
    // Truthiness, because that is exactly what `filterItems` tests: a filter
    // set to `''` filters nothing there, so it decided nothing here either
    // and naming it would name a flag that did not withhold the item.
    if (!value) continue;
    // The cast is TypeScript's widening of a computed key over a union, not a
    // claim about the value: `key` comes from `FILTER_FLAGS`, which is total
    // over `ItemFilters`, and `value` is read straight off `filters[key]`.
    const one = { [key]: value } as ItemFilters;
    if (filterItems([item], one, config).length === 0) {
      clauses.push(`${FILTER_FLAGS[key]} ${JSON.stringify(value)}`);
    }
  }
  return `excluded by ${clauses.join(' and ')}`;
}

/**
 * The item as it travels for this kind.
 *
 * An export is the author's own workspace travelling whole and is returned
 * untouched. A pack returns a copy with provenance cleared, and counts each
 * field it actually cleared — a field that was already `null` is not a drop,
 * and reporting it as one would inflate a count the preview prints.
 */
function forKind(
  item: Item, kind: ArtefactKind, dropped: Map<string, number>,
): Item {
  if (kind === 'export') return item;
  for (const { key, field } of PROVENANCE) {
    if (item[key] !== null) dropped.set(field, (dropped.get(field) ?? 0) + 1);
  }
  return { ...item, sourceFile: null, sourceAnchor: null, sourceChecksum: null };
}

/**
 * A set-level refusal from `layout.ts`, re-voiced as a refusal of THIS export
 * and attributed to the item that owns the offending path where there is one.
 *
 * The attribution runs only on the failure path, and it is the reason this
 * module refuses in its own voice rather than leaving the set to
 * `buildManifest`: "items/rule/2026/RULE-x.md is not items/<type>/<file>.md"
 * sends an author to a string, and "…and that path is item RULE-x" sends them
 * to the file they have to move.
 *
 * When no single path is illegal the set-level rule fired — two paths that are
 * one file on a case-insensitive filesystem — and there is no single item to
 * name, because the refusal already names both paths.
 */
function refuseFileSet(refusal: string, items: readonly Item[]): Error {
  const offender = items.find((i) => refuseArtefactPath(i.filePath) !== null);
  const whose = offender === undefined
    ? ''
    : ` That path is where item "${offender.id}" is stored.`;
  return new Error(
    `my_context: this export's file set is not one artefact's worth: `
    + `${refusal.replace(/^my_context:\s*/, '')}${whose} Nothing was written.`,
  );
}

/**
 * The bytes of `config.json`: two-space JSON, LF, exactly one trailing
 * newline — the spelling `init` uses and the one `renderManifest` uses, so an
 * artefact's two JSON files are written the same way.
 */
function renderConfig(raw: unknown): Buffer {
  return Buffer.from(`${JSON.stringify(raw, null, 2)}\n`, 'utf8');
}

/**
 * The artefact for this workspace and these options, in memory.
 *
 * `errors` is the loader's own array, threaded through with the same shape
 * `loadLayer` gives it, so a caller can report a duplicate id or an
 * unparseable item file. Without it those items are absent from the export
 * with nobody told, which is the one thing `INV-nothing-is-dropped-silently`
 * forbids — and they cannot be reported through `report.excluded`, because an
 * item file that failed to parse has no id to name.
 */
export function buildBundle(
  root: string, config: Config, options: BundleOptions, errors: LoadError[] = [],
): Bundle {
  const all = loadLayer(root, 'project', errors, config);
  const selected = filterItems(all, options.filters, config);
  const kept = new Set(selected);

  const excluded: ExcludedItem[] = [];
  for (const item of all) {
    if (kept.has(item)) continue;
    excluded.push({ id: item.id, reason: exclusionReason(item, options.filters, config) });
  }

  const dropped = new Map<string, number>();
  const byCategory: Record<string, number> = {};
  const files: ExportFile[] = [];
  for (const item of selected) {
    files.push({
      path: item.filePath,
      bytes: Buffer.from(renderItem(forKind(item, options.kind, dropped)), 'utf8'),
    });
    bump(byCategory, item.type);
  }

  const records = options.history
    ? exportableHistory(root, new Set(selected.map((i) => i.id)))
    : [];
  if (options.history) files.push({ path: HISTORY_NAME, bytes: renderHistory(records) });

  files.push({
    path: CONFIG_NAME,
    bytes: renderConfig(options.kind === 'pack'
      ? projectPackConfig(config, selected.map((i) => i.type))
      : projectExportConfig(config)),
  });

  const badPaths = refuseArtefactPaths(files.map((f) => f.path));
  if (badPaths !== null) throw refuseFileSet(badPaths, selected);

  const manifest = buildManifest(files, {
    kind: options.kind, name: options.name, version: options.version, now: options.now,
  });
  files.push({ path: MANIFEST_NAME, bytes: renderManifest(manifest) });
  // The ONE sort, after everything is in: `manifest.json` takes its place by
  // its own bytes rather than by being appended last, so the order of this
  // array is `comparePaths` and nothing else.
  files.sort((a, b) => comparePaths(a.path, b.path));

  const counted: Record<string, number> = {};
  for (const name of Object.keys(byCategory).toSorted(comparePaths)) {
    Object.defineProperty(counted, name, {
      value: byCategory[name], writable: true, enumerable: true, configurable: true,
    });
  }

  return {
    files,
    manifest,
    report: {
      items: selected.length,
      byCategory: counted,
      historyRecords: records.length,
      // Built from `PROVENANCE` rather than from the map's own iteration, so
      // the order is this module's fixed list and not an insertion order that
      // depends on which item happened to carry which field first.
      droppedFields: PROVENANCE
        .map(({ field }) => ({ field, items: dropped.get(field) ?? 0 }))
        .filter((d) => d.items > 0),
      excluded,
    },
  };
}
