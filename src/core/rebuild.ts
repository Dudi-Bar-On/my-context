import {
  readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync, realpathSync, statSync,
} from 'node:fs';
import path from 'node:path';
import type { Config } from './config.ts';
import { computeItemChecksum, parseItem, renderItem } from './item.ts';
import { relPosix } from './paths.ts';
import type { Store } from './store.ts';
import type { Item, Layer } from './types.ts';

export interface LoadError { file: string; message: string }

/**
 * Recursively collects `.md` file paths under `dir`. Symlinks are resolved
 * and followed (both symlinked files and symlinked directory subtrees) —
 * `readdirSync`'s dirent flags (`isFile`/`isDirectory`) are both false for a
 * symlink, so treating only those as authoritative would silently skip a
 * symlinked item file or an entire symlinked `items/` subtree. A broken or
 * unreadable symlink is reported as a `LoadError`, never skipped in silence.
 * `visitedRealDirs` guards against symlink cycles.
 */
function walk(
  dir: string, root: string, out: string[], errors: LoadError[],
  visitedRealDirs: Set<string>,
): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      let real: string;
      let stat;
      try {
        real = realpathSync(full);
        stat = statSync(real);
      } catch (err) {
        errors.push({
          file: relPosix(root, full),
          message: `symlink could not be resolved: ${err instanceof Error ? err.message : String(err)}.`,
        });
        continue;
      }
      if (stat.isDirectory()) {
        if (visitedRealDirs.has(real)) continue; // symlink cycle guard
        visitedRealDirs.add(real);
        walk(full, root, out, errors, visitedRealDirs);
      } else if (stat.isFile() && entry.name.endsWith('.md')) {
        out.push(full);
      }
      continue;
    }

    if (entry.isDirectory()) walk(full, root, out, errors, visitedRealDirs);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export function loadLayer(
  root: string, layer: Layer, errors: LoadError[] = [], config?: Config,
): Item[] {
  const items: Item[] = [];
  // Sort by root-relative POSIX path so that duplicate-id resolution (below)
  // does not depend on filesystem enumeration order, which is not
  // guaranteed to be stable across platforms.
  const files = walk(path.join(root, 'items'), root, [], errors, new Set())
    .map((file) => ({ file, rel: relPosix(root, file) }))
    .sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0));

  const firstFileById = new Map<string, string>();

  for (const { file, rel } of files) {
    let item: Item;
    try {
      item = parseItem(readFileSync(file, 'utf8'), rel, layer);
    } catch (err) {
      errors.push({ file: rel, message: err instanceof Error ? err.message : String(err) });
      continue;
    }

    // An unknown type is a data-integrity signal (typo, or a category
    // removed from config), not a preference — report it, but still index
    // the item: dropping it here would defeat the whole point of surfacing
    // it as `ineligible` at selection time instead of losing it silently.
    if (config && !config.categories[item.type]) {
      errors.push({
        file: rel,
        message: `item "${item.id}" declares type "${item.type}", which is not defined in ` +
          `config.categories. It will not be selected; add the category or fix the typo.`,
      });
    }

    // A checksum is only meaningful once it has actually been computed and
    // written (writeItem does this on every write path). An item with no
    // checksum recorded — e.g. hand-authored, or written before this
    // feature — has nothing to verify against. Report, never throw: a
    // tampered file must be visible, not made unreadable.
    if (item.checksum) {
      const expected = computeItemChecksum(item);
      if (expected !== item.checksum) {
        errors.push({
          file: rel,
          message: `checksum mismatch for "${item.id}": recorded ${item.checksum}, content hashes ` +
            `to ${expected}. This file may have been edited outside my_context.`,
        });
      }
    }

    const first = firstFileById.get(item.id);
    if (first !== undefined) {
      errors.push({
        file: rel,
        message: `duplicate id "${item.id}" declared in both ${first} and ${rel}; keeping ${first}, skipping ${rel}.`,
      });
      continue;
    }
    firstFileById.set(item.id, rel);
    items.push(item);
  }
  return items;
}

let writeCounter = 0;

/**
 * Write an item atomically: temp file, then rename. Returns the absolute path.
 *
 * The temp name carries both the pid and a per-process counter. The pid alone
 * is not enough — two concurrent writes to the same target from one process
 * would share a temp path and corrupt each other.
 *
 * The checksum is (re)computed here, over the semantic content actually
 * being written, so every write path — `add`, and any future edit path —
 * keeps it accurate rather than leaving it stale or permanently empty.
 */
export function writeItem(root: string, item: Item): string {
  const target = path.join(root, ...item.filePath.split('/'));
  const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) };
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
  try {
    writeFileSync(tmp, renderItem(withChecksum), 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function rebuild(
  store: Store, roots: { project?: string; global?: string }, config: Config,
): { loaded: number; errors: LoadError[] } {
  const errors: LoadError[] = [];
  let loaded = 0;

  // Batched in one transaction: per-statement commits (each WAL-flushed
  // individually) dominate rebuild time once the corpus reaches hundreds of
  // items — see Store.transaction.
  store.transaction(() => {
    for (const [layer, root] of Object.entries(roots) as [Layer, string | undefined][]) {
      if (!root) continue;
      store.deleteByLayer(layer);
      for (const item of loadLayer(root, layer, errors, config)) {
        try {
          store.upsert(item);
          loaded++;
        } catch (err) {
          errors.push({ file: item.filePath, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  });

  return { loaded, errors };
}
