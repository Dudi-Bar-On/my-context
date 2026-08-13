import path from 'node:path';
import { Ledger } from '../core/ledger.ts';
import { isMainEntry, managedSplit, matchesAnyGlob, relPosix, toPosix } from '../core/paths.ts';
import { renderSelection } from '../core/render.ts';
import { select } from '../core/select.ts';
import { Store } from '../core/store.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import {
  parseHookInput, preToolUseContext, preToolUseDeny, readStdin, type HookInput,
} from './io.ts';

const FILE_PATH_KEYS = ['file_path', 'path', 'notebook_path'];

export function extractFilePath(input: HookInput): string | null {
  const toolInput = input.tool_input;
  if (typeof toolInput !== 'object' || toolInput === null) return null;
  for (const key of FILE_PATH_KEYS) {
    const value = (toolInput as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') return value;
  }
  return null;
}

/**
 * The one deliberate exception to fail-open. The reason must name a runnable
 * command: it reaches the model at the exact moment it is wrong, which is the
 * cheapest possible moment to correct it.
 */
export function denyReason(absNative: string): string | null {
  const split = managedSplit(toPosix(absNative));
  if (!split) return null;
  const { rel } = split;

  if (matchesAnyGlob(rel, ['items/**'])) {
    return 'my_context: `.my_context/items/` is managed by my_context. Writing the file ' +
      'directly leaves the SQLite index and the item checksum stale. Create items with ' +
      '`mycontext add <category> "<title>"`, and read them with ' +
      '`mycontext show <id>`.';
  }

  if (matchesAnyGlob(rel, ['.index.db*', 'state/**'])) {
    return `my_context: \`.my_context/${rel}\` is generated state, not source. It is derived ` +
      'from the Markdown in `.my_context/items/` — run `mycontext rebuild` to ' +
      'regenerate it instead of editing it.';
  }

  return `my_context: \`.my_context/${rel}\` is managed by my_context and must not be written ` +
    'directly. Use `mycontext add <category> "<title>"` to create an item, ' +
    '`mycontext list` and `mycontext show <id>` to read, and ' +
    '`mycontext rebuild` to refresh the index. Configuration changes to ' +
    '`.my_context/config.json` are the user\'s to make — ask, do not edit.';
}

/**
 * Single indexed SQLite read, no rebuild, no LLM, no network (spec §6.5).
 * Returns '' — never throws — so a corrupt index means "no items today"
 * rather than a blocked edit.
 */
export function buildJitOutput(input: HookInput, cwd: string, filePath: string): string {
  let store: Store | null = null;
  let ledger: Ledger | null = null;
  try {
    const sessionId = input.session_id;
    if (!sessionId) return '';

    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // projectRoot is the `.my_context` directory; scope globs are repo-relative.
    const repoRoot = path.dirname(ws.projectRoot);
    const abs = path.resolve(cwd, filePath);
    // On win32, `path.relative` returns an ABSOLUTE path (not a `..`-prefixed
    // one) when the two paths resolve to different drives/roots — e.g. repo
    // on C:, target on D: or a UNC share. Left unchecked, that absolute
    // string would flow into `matchesScope` and a `**`-scoped item would
    // match a file that is nowhere near the repo. `path.isAbsolute` on the
    // native `path.relative` result (before POSIX conversion) catches this;
    // `relPosix` itself only re-derives the same relative string.
    if (path.isAbsolute(path.relative(repoRoot, abs))) return '';
    const target = relPosix(repoRoot, abs);
    if (target === '' || target === '..' || target.startsWith('../')) return '';

    // Store MUST be opened before Ledger: Store.open's corruption self-heal
    // (delete-and-recreate on a genuinely unreadable file) is the only
    // reason a corrupt .index.db is survivable for Ledger.open, which has no
    // self-heal of its own. See the comment on Ledger.open.
    store = Store.open(ws.dbPath);
    ledger = Ledger.open(ws.dbPath);

    const selection = select(
      store.activeScoped(),
      { event: 'tool', path: target, seen: ledger.seen(sessionId) },
      ws.config,
    );
    if (selection.full.length === 0 && selection.spilled.length === 0) return '';

    // Render before recording: rendering reads/walks item data and can in
    // principle throw. If it did after the ledger write, the outer catch
    // would return '' while the item was already marked seen — a silent,
    // permanent drop for the rest of the session. Rendering first bounds
    // that risk to the render step itself.
    //
    // The ledger write gets its OWN try/catch, separate from the outer one:
    // it is not inside the same try as the render above, so a `recordMany`
    // failure (e.g. SQLITE_BUSY from a concurrent `rebuild` holding the WAL
    // lock past `busy_timeout`) can never fall through to the outer catch
    // and discard `text`, which has already been computed and is safe to
    // return regardless. The only failure mode this leaves reachable is a
    // duplicate injection later in the session (safe) rather than a lost one
    // (not safe) — the render succeeding is what the injection actually
    // depends on; the record is bookkeeping for future dedupe.
    const text = renderSelection(selection);
    try {
      ledger.recordMany(sessionId, selection.full.map((e) => e.item.id), 'jit');
    } catch {
      // A failed record must never cost the already-rendered injection.
    }
    return text;
  } catch {
    return '';
  } finally {
    try { store?.close(); } catch { /* fail open */ }
    try { ledger?.close(); } catch { /* fail open */ }
  }
}

/** Returns the JSON to print on stdout, or '' for "no opinion". */
export function runPreToolUse(raw: string, fallbackCwd: string): string {
  try {
    const input = parseHookInput(raw);
    const cwd = input.cwd ?? fallbackCwd;
    const filePath = extractFilePath(input);
    if (!filePath) return '';

    if (/Edit|Write/.test(input.tool_name ?? '')) {
      const reason = denyReason(path.resolve(cwd, filePath));
      if (reason) return preToolUseDeny(reason);
    }

    const text = buildJitOutput(input, cwd, filePath);
    return text ? preToolUseContext(text) : '';
  } catch {
    return '';
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer here: runPreToolUse is fully synchronous, so a
  // timer set before calling it can only ever fire after that call already
  // returned — an unref'd setTimeout cannot preempt a synchronous
  // readFileSync/JSON.parse in between. The real bound is the `hooks.json`
  // timeout (10s); the latency budget is enforced by the performance test
  // in Task 10, not by a runtime cutoff.
  try {
    const output = runPreToolUse(readStdin(), process.cwd());
    if (output) process.stdout.write(output);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
