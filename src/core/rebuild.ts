import fs from 'node:fs';
import {
  readdirSync, readFileSync, mkdirSync, writeFileSync, renameSync, rmSync, realpathSync, statSync,
  closeSync, existsSync, openSync,
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
    //
    // `Object.hasOwn`, not a bare index — the prototype hazard this codebase
    // has now hit five separate times (`resolveCategory` and `tierOf` in
    // mutate.ts, `ingest/schema.ts`, `help/index.ts`, `cmdAdd`). Here it
    // flipped the outcome to the WRONG side rather than merely producing a
    // confusing message: `config.categories['constructor']` resolves to
    // `Object.prototype.constructor`, which is truthy, so an item declaring
    // `type: constructor` — a type no config defines, and one `isEligible`
    // (select.ts) correctly treats as ineligible — was indexed with NO
    // integrity error at all. Silently invisible, which is the one failure
    // mode this check exists to prevent.
    if (config && !Object.hasOwn(config.categories, item.type)) {
      errors.push({
        file: rel,
        message: `item "${item.id}" declares type "${item.type}", which is not defined in ` +
          `config.categories — a typo, or a category removed or renamed since this item was ` +
          `captured. It stays indexed, listed and queryable, and it will never be injected. ` +
          `"type" is fixed at creation, so it cannot be re-filed in place: run ` +
          `\`mycontext doctor\`, which names this item and both routes out of the state.`,
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

export interface WriteItemOptions {
  /**
   * Refuse to write if the target file already exists, instead of
   * overwriting it — see `createExclusive` and `ITEM_EXISTS_CODE`. Only the
   * CREATE path wants this; `updateItem`/`supersedeItem`/`linkItems`
   * legitimately overwrite the file of an item they just read.
   */
  exclusive?: boolean;
}

/**
 * The `code` on the error `writeItem(..., { exclusive: true })` throws when
 * the target file already exists. A distinguishable marker rather than a
 * message match: `createItem` retries on exactly this and nothing else, and
 * matching on message text is how that kind of check silently stops firing.
 */
export const ITEM_EXISTS_CODE = 'MYCONTEXT_ITEM_EXISTS';

export function isItemExistsError(err: unknown): boolean {
  return (err as NodeJS.ErrnoException | null)?.code === ITEM_EXISTS_CODE;
}

function itemExistsError(file: string): Error {
  const err = new Error(`my_context: ${file} already exists.`) as NodeJS.ErrnoException;
  err.code = ITEM_EXISTS_CODE;
  return err;
}

/**
 * Whether this process should still attempt the `linkSync` construction
 * below. Latched to `false` the first time `linkSync` fails for a reason
 * that is NOT contention — see `createExclusive`. Deliberately a copy of the
 * same latch `src/ingest/lock.ts` keeps rather than an import: the two
 * modules must not be able to make each other fall back, and a shared latch
 * would mean one `linkSync` failure in the lock path silently downgrades
 * every item write for the rest of the process's life (and vice versa).
 */
let hardLinksSupported = true;

/**
 * Create `target` holding `content`, failing with `ITEM_EXISTS_CODE` if
 * something is already there — never overwriting. This is the whole of
 * `createItem`'s protection against a concurrent process that computed the
 * same id from the same stale index snapshot: the check and the write are
 * ONE filesystem operation, so there is no read-decide-write window for
 * another process to land in. A store-based "does this id exist" check
 * cannot do that no matter where it is placed, because the store snapshot is
 * already stale when it is read.
 *
 * The construction is deliberately the same one `acquireApplyLock`
 * (src/ingest/lock.ts) uses and documents: write the full content to a
 * uniquely-named temp file (pid + a per-process counter, because two
 * concurrent writes from ONE process must not share a temp path), then
 * `linkSync` that temp file into place. `linkSync` only ever creates a new
 * directory entry pointing at an inode that is already completely written,
 * and fails `EEXIST` cleanly when the name is taken — so unlike
 * `openSync(target, 'wx')` + a separate write, there is no window in which
 * the target exists but is empty or partial for a losing racer to read back
 * and mistake for a corrupt item.
 *
 * `linkSync` is not universally available (exFAT/FAT32, some SMB/NFS mounts,
 * some container volumes). Mirroring lock.ts: a failure whose code is not
 * `EEXIST` and after which the target still does not exist means this
 * filesystem cannot do the operation at all, so the process latches to the
 * `openSync(target, 'wx')` + `writeSync` fallback for the rest of its life.
 * That fallback IS still exclusive — `wx` fails `EEXIST` if the name is taken
 * — but it opens TWO windows the `linkSync` construction has neither of, and
 * both are named here because the comment previously covered only the first:
 *
 * 1. **Transient.** Between the `openSync` and the `writeSync` the target
 *    exists and is empty. A concurrent `createItem` that gets `EEXIST` inside
 *    that window and then reads the file sees an empty file and fails to
 *    parse it; `createItem` reports that as an error rather than guessing,
 *    which is a visible failure rather than a silent one, but it is a real
 *    cost of the fallback and is not claimed to be absent.
 * 2. **Persistent.** If the `writeSync` itself fails — ENOSPC, EIO, a quota,
 *    a disconnected network mount — the zero-byte target stays on disk after
 *    the error propagates. That is strictly worse than the transient window:
 *    the id is burned for good (every later `createItem` for it gets
 *    `EEXIST`, re-reads the empty file, and fails to parse it), and the
 *    message a human then sees blames a concurrent process for what was a
 *    purely local write failure. The `linkSync` path has no equivalent — its
 *    `finally` removes the temp file whether the link succeeded or not — so
 *    this asymmetry was the fallback's alone. It is now closed the same way:
 *    the target is removed on a failed write, before the error propagates.
 *    The removal is best-effort, so the window is not claimed to be gone in
 *    the case where the cleanup ITSELF fails (a read-only or full filesystem
 *    can fail both); what is claimed is that a failed write no longer leaves
 *    the target behind by construction rather than by luck.
 *
 * `fs.writeSync`, not the named import, for the same reason as `fs.linkSync`
 * below: a property read at call time is what lets a test force this exact
 * failure, and window 2 is otherwise unreachable on any filesystem CI has.
 */
function createExclusive(target: string, content: string): string {
  for (;;) {
    if (hardLinksSupported) {
      const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
      try {
        writeFileSync(tmp, content, 'utf8');
        try {
          // Called as `fs.linkSync`, not a destructured import, for the same
          // reason lock.ts does: a test can force this exact call to fail by
          // reassigning the property on the `node:fs` default export, which a
          // named-import binding resolved at import time would not observe.
          fs.linkSync(tmp, target);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException)?.code;
          if (code !== 'EEXIST' && !existsSync(target)) {
            hardLinksSupported = false;
            continue; // not contention — this filesystem has no hard links
          }
          throw itemExistsError(target);
        }
      } finally {
        // The temp file's directory entry is never the item — only `target`
        // is. Removed whether the link succeeded or not: nothing else in this
        // module knows this name, so a stray `.tmp-*` would never be cleaned.
        try { rmSync(tmp, { force: true }); } catch { /* best-effort cleanup */ }
      }
      return target;
    }

    // Fallback for a filesystem without hard links — see the doc comment.
    let fd: number;
    try {
      fd = openSync(target, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code === 'EEXIST') throw itemExistsError(target);
      throw err;
    }
    let written = false;
    try {
      fs.writeSync(fd, content);
      written = true;
    } finally {
      try {
        closeSync(fd);
      } finally {
        // Window 2 in the doc comment above. Only on failure: a successful
        // write must obviously keep its file.
        if (!written) {
          try { rmSync(target, { force: true }); } catch { /* best-effort cleanup */ }
        }
      }
    }
    return target;
  }
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
export function writeItem(root: string, item: Item, options?: WriteItemOptions): string {
  const target = path.join(root, ...item.filePath.split('/'));
  const withChecksum: Item = { ...item, checksum: computeItemChecksum(item) };

  let resolved: string;
  try {
    resolved = realpathSync(target);
  } catch {
    resolved = target;
  }

  mkdirSync(path.dirname(resolved), { recursive: true });
  const content = renderItem(withChecksum);

  if (options?.exclusive) return createExclusive(resolved, content);

  const tmp = `${resolved}.tmp-${process.pid}-${writeCounter++}`;
  try {
    writeFileSync(tmp, content, 'utf8');
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
  preloaded?: Partial<Record<Layer, Item[]>>,
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
      // `preloaded` lets SessionStart parse the corpus ONCE (design §4.3 /
      // §0.4): the caller already ran loadLayer for the selection and owns
      // its LoadErrors, so re-running it here would both re-pay the parse
      // and double-report every parse error. The cross-layer collision
      // check below still runs either way.
      const items = preloaded?.[layer] ?? loadLayer(root, layer, errors, config);
      for (const item of items) {
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
  errors.push(...crossLayerCollisions(filesById.get('global'), filesById.get('project')));

  return { loaded, errors };
}

/**
 * The cross-layer duplicate-id check, extracted so it can run WITHOUT a
 * database: `buildInjection` runs it over the freshly-parsed layers on the
 * injection-critical path (review C1, tasks 5-6 — discarding `rebuild`'s
 * returned copy of these errors removed the disclosure from every injection,
 * and a copy computed only inside the best-effort refresh vanishes exactly
 * when a held lock drops the refresh). `rebuild` calls it with the ids that
 * actually reached the index, preserving its original semantics: an item
 * whose upsert failed is not claimed to have won or lost anything.
 *
 * Either side missing means no cross-layer question exists: `[]`.
 *
 * Each entry is a `LoadError` plus the colliding `id`, so a caller can name
 * the ids in a scope-only surface (the audit note) without re-deriving them
 * from the message text.
 */
export interface CrossLayerCollision extends LoadError { id: string }

export function crossLayerCollisions(
  globalFiles: ReadonlyMap<string, string> | undefined,
  projectFiles: ReadonlyMap<string, string> | undefined,
): CrossLayerCollision[] {
  const errors: CrossLayerCollision[] = [];
  if (!globalFiles || !projectFiles) return errors;
  for (const [id, projectFile] of projectFiles) {
    const globalFile = globalFiles.get(id);
    if (globalFile === undefined) continue;
    errors.push({
      id,
      file: projectFile,
      message: `duplicate id "${id}" declared in both the global layer (${globalFile}) and ` +
        `the project layer (${projectFile}); the project copy wins and the global one is ` +
        `not indexed. Rename one of them.`,
    });
  }
  return errors;
}
