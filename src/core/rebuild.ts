import {
  readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync, realpathSync, statSync,
} from 'node:fs';
import path from 'node:path';
import type { Config } from './config.ts';
import { computeItemChecksum, parseItem, renderItem } from './item.ts';
import { relPosix } from './paths.ts';
import { sleepMs } from './sleep.ts';
import type { Store } from './store.ts';
import type { Item, Layer } from './types.ts';

export interface LoadError { file: string; message: string }

/**
 * The one line appended to a caller's output when the rebuild that preceded
 * it found unparseable Markdown — never on the clean path, and never more
 * than this one line however many files were affected.
 *
 * Lives here, beside `rebuild`, because BOTH callers of `rebuild` need it and
 * they had already diverged: the MCP surface reported load errors (Task 7)
 * while the SessionStart hook silently discarded the same array, on the
 * product's highest-traffic path. Sharing the function is what stops the next
 * caller from forgetting again. Without it a broken item file simply vanishes
 * from every query and every injection with no signal at all, breaking the
 * "nothing is dropped silently" invariant in the one place it matters most:
 * the source of truth failed to parse.
 */
export function loadErrorNote(errors: LoadError[]): string {
  if (errors.length === 0) return '';
  const first = errors[0];
  const suffix = errors.length > 1 ? ` and ${errors.length - 1} more` : '';
  return `\n\nmy_context: ${errors.length} item file${errors.length === 1 ? '' : 's'} could not be ` +
    `read during rebuild (starting with ${first.file}: ${first.message})${suffix}. ` +
    `Fix the file or see mycontext_help("capture").`;
}

/**
 * Recursively collects `.md` file paths under `dir`. Symlinks are resolved
 * and followed (both symlinked files and symlinked directory subtrees) —
 * `readdirSync`'s dirent flags (`isFile`/`isDirectory`) are both false for a
 * symlink, so treating only those as authoritative would silently skip a
 * symlinked item file or an entire symlinked `items/` subtree. A broken or
 * unreadable symlink is reported as a `LoadError`, never skipped in silence.
 *
 * `visitedRealDirs` is seeded on *every* directory visited, not just
 * symlinked ones: a symlink pointing at an already-walked ORDINARY ancestor
 * (`items/link -> items`) would otherwise not be recognised as a repeat —
 * only symlink-to-symlink cycles were guarded — so every file beneath it
 * would be enumerated twice, producing spurious `duplicate id` errors that
 * blame the user for a problem the walker created.
 */
function walk(
  dir: string, root: string, out: string[], errors: LoadError[],
  visitedRealDirs: Set<string>,
): string[] {
  let real: string;
  try {
    real = realpathSync(dir);
  } catch {
    return out;
  }
  if (visitedRealDirs.has(real)) return out;
  visitedRealDirs.add(real);

  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);

    if (entry.isSymbolicLink()) {
      let realTarget: string;
      let stat;
      try {
        realTarget = realpathSync(full);
        stat = statSync(realTarget);
      } catch (err) {
        errors.push({
          file: relPosix(root, full),
          message: `symlink could not be resolved: ${err instanceof Error ? err.message : String(err)}.`,
        });
        continue;
      }
      if (stat.isDirectory()) {
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
            `to ${expected}. What is known is only that the file's content no longer matches ` +
            `the checksum recorded in it — an edit outside my_context is one cause, but so is ` +
            `content my_context itself could not round-trip, in which case part of this item's ` +
            `text may already have been lost. Compare it against git history before rewriting it.`,
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

/** The filesystem error codes that are transient on Windows rename-over-existing:
 * another handle (a virus scanner, the search indexer, a concurrent process or
 * test) holds the destination open in a conflicting share mode for a moment,
 * then lets go. POSIX rename doesn't have this failure mode at all, but the
 * retry is harmless there too since these codes simply won't occur. */
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

/**
 * Retry `fn` when it fails with one of `TRANSIENT_RENAME_CODES`, backing off
 * between attempts; any other error rethrows immediately, unchanged. After
 * the final attempt fails, the original error is rethrown as-is (not wrapped)
 * so the caller still sees the real reason.
 *
 * Extracted as its own exported function, taking the operation as a
 * parameter, specifically so the retry/backoff/give-up behaviour can be
 * exercised directly in tests with a fake operation — a genuine Windows
 * `EPERM` from a real competing file handle cannot be manufactured reliably
 * in a unit test on any platform.
 */
export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return fn();
    } catch (err) {
      const code = (err as NodeJS.ErrnoException)?.code;
      if (!code || !TRANSIENT_RENAME_CODES.has(code) || attempt === attempts - 1) throw err;
      sleepMs(20 * (attempt + 1));
    }
  }
  // Unreachable: the loop above always either returns or throws.
  throw new Error('my_context: retryOnTransientFsError exhausted without throwing.');
}

/**
 * Write an item atomically: temp file, then rename. Returns the absolute
 * path actually written.
 *
 * The temp name carries both the pid and a per-process counter. The pid alone
 * is not enough — two concurrent writes to the same target from one process
 * would share a temp path and corrupt each other.
 *
 * The checksum is (re)computed here, over the semantic content actually
 * being written, so every write path — `add`, and any future edit path —
 * keeps it accurate rather than leaving it stale or permanently empty.
 *
 * If `target` is a symlink (an item loaded through one), a plain
 * rename-over would replace the link itself rather than writing through it.
 * `realpathSync` resolves through any symlink first, so the rename lands on
 * the file the link points at and the link itself is left intact. When
 * resolution fails — the target doesn't exist yet, the common `add` case —
 * the literal path is used as-is. The temp file is placed beside the
 * resolved target (not the literal one) so the final rename stays on a
 * single filesystem, preserving atomicity.
 *
 * The rename itself goes through `retryOnTransientFsError`: on POSIX,
 * rename-over-an-existing-file is atomic and indifferent to open handles,
 * but on Windows `renameSync` maps to `MoveFileEx`, which fails with
 * `EPERM`/`EACCES`/`EBUSY` if anything else (a virus scanner, the search
 * indexer, a concurrent process) holds the destination open at that instant.
 * That instant is usually over within milliseconds, so a short bounded
 * retry clears it without masking a genuine failure — see
 * `retryOnTransientFsError` above.
 */
export function writeItem(root: string, item: Item): string {
  const target = path.join(root, ...item.filePath.split('/'));
  const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) };

  let resolved: string;
  try {
    resolved = realpathSync(target);
  } catch {
    resolved = target;
  }

  mkdirSync(path.dirname(resolved), { recursive: true });
  const tmp = `${resolved}.tmp-${process.pid}-${writeCounter++}`;
  try {
    writeFileSync(tmp, renderItem(withChecksum), 'utf8');
    retryOnTransientFsError(() => renameSync(tmp, resolved));
  } catch (err) {
    rmSync(tmp, { force: true });
    throw err;
  }
  return resolved;
}

/**
 * Layer load order, and it is load-bearing rather than incidental. `upsert`
 * is last-write-wins on the `id` primary key, so whichever layer is loaded
 * LAST wins a colliding id — and spec §5.1 says "On conflicting id, project
 * wins". Iterating `Object.entries(roots)` instead put `global` last (object
 * insertion order), so the global copy silently overwrote the project's.
 * Written out as an explicit constant so the precedence cannot be changed
 * again by reordering a caller's object literal.
 */
const LAYER_ORDER: Layer[] = ['global', 'project'];

export function rebuild(
  store: Store, roots: { project?: string; global?: string }, config: Config,
): { loaded: number; errors: LoadError[] } {
  const errors: LoadError[] = [];
  let loaded = 0;
  // Kept per layer so the cross-layer collision check below can name both
  // sides. `loadLayer`'s own duplicate-id check is per-layer by construction
  // — it starts a fresh map for each call — so a project item and a global
  // item sharing an id produced no error anywhere before this.
  const filesById = new Map<Layer, Map<string, string>>();

  // Batched in one transaction: per-statement commits (each WAL-flushed
  // individually) dominate rebuild time once the corpus reaches hundreds of
  // items — see Store.transaction.
  store.transaction(() => {
    for (const layer of LAYER_ORDER) {
      const root = roots[layer];
      if (!root) continue;
      const seen = new Map<string, string>();
      filesById.set(layer, seen);
      store.deleteByLayer(layer);
      for (const item of loadLayer(root, layer, errors, config)) {
        try {
          store.upsert(item);
          seen.set(item.id, item.filePath);
          loaded++;
        } catch (err) {
          errors.push({ file: item.filePath, message: err instanceof Error ? err.message : String(err) });
        }
      }
    }
  });

  // Project wins (above), but silently winning is still a data-integrity
  // problem: the global item vanished from the index and the user has no way
  // to know which of the two they are actually governed by.
  const globalFiles = filesById.get('global');
  const projectFiles = filesById.get('project');
  if (globalFiles && projectFiles) {
    for (const [id, projectFile] of projectFiles) {
      const globalFile = globalFiles.get(id);
      if (globalFile === undefined) continue;
      errors.push({
        file: projectFile,
        message: `duplicate id "${id}" declared in both the global layer (${globalFile}) and ` +
          `the project layer (${projectFile}); the project copy wins and the global one is ` +
          `not indexed. Rename one of them.`,
      });
    }
  }

  return { loaded, errors };
}
