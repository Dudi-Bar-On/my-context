import { readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync } from 'node:fs';
import path from 'node:path';
import { parseItem, renderItem } from './item.ts';
import { relPosix } from './paths.ts';
import type { Store } from './store.ts';
import type { Item, Layer } from './types.ts';

function walk(dir: string, out: string[] = []): string[] {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.isFile() && entry.name.endsWith('.md')) out.push(full);
  }
  return out;
}

export interface LoadError { file: string; message: string }

export function loadLayer(
  root: string, layer: Layer, errors: LoadError[] = [],
): Item[] {
  const items: Item[] = [];
  for (const file of walk(path.join(root, 'items'))) {
    const rel = relPosix(root, file);
    try {
      items.push(parseItem(readFileSync(file, 'utf8'), rel, layer));
    } catch (err) {
      errors.push({ file: rel, message: err instanceof Error ? err.message : String(err) });
    }
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
 */
export function writeItem(root: string, item: Item): string {
  const target = path.join(root, ...item.filePath.split('/'));
  mkdirSync(path.dirname(target), { recursive: true });
  const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
  try {
    writeFileSync(tmp, renderItem(item), 'utf8');
    renameSync(tmp, target);
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return target;
}

export function rebuild(
  store: Store, roots: { project?: string; global?: string },
): { loaded: number; errors: LoadError[] } {
  const errors: LoadError[] = [];
  let loaded = 0;

  for (const [layer, root] of Object.entries(roots) as [Layer, string | undefined][]) {
    if (!root) continue;
    store.deleteByLayer(layer);
    for (const item of loadLayer(root, layer, errors)) {
      store.upsert(item);
      loaded++;
    }
  }

  return { loaded, errors };
}
