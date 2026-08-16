import { existsSync } from 'node:fs';
import { withRetry } from './persist.ts';
import { rebuild, type LoadError } from './rebuild.ts';
import { Store } from './store.ts';
import type { Workspace } from './workspace.ts';

/**
 * What every open-rebuild caller gets back: the OPEN store, the number of
 * items indexed, and the rebuild's per-file load errors — returned, never
 * discarded, because a corrupt item file must not let a caller report success
 * while silently dropping authored knowledge (INV-nothing-is-dropped-silently).
 */
export interface OpenedStore {
  store: Store;
  loaded: number;
  errors: LoadError[];
}

export interface OpenStoreOptions {
  /**
   * Retry the rebuild through `withRetry` (persist.ts) when SQLite reports
   * busy/locked — the MCP server's policy, and ONLY its policy.
   *
   * The caller classes genuinely differ here, and the difference is kept
   * rather than flattened:
   *
   *  - The **MCP server** retries. It is a long-running process serving a
   *    model while the CLI and the hooks write the same database, and a
   *    transient `SQLITE_BUSY` surfaced to the model costs a whole tool call
   *    and invites a confused retry loop on the model's side. Every MCP
   *    surface passes `retryOnBusy: true`.
   *  - The **CLI** does not. A command is a single shot a human can rerun,
   *    `busy_timeout` (set in `Store.open`) already absorbs ordinary
   *    contention, and the exhaustion message names the lock anyway.
   *  - The **SessionStart/JIT hook path** (core/inject.ts) does not, and must
   *    not casually gain it: `buildInjection` fails open to an empty
   *    injection, and ROADMAP E4 records that inheriting the MCP policy there
   *    turns a ~3s fail-open into a potential multi-second session stall.
   *
   * Defaults to false, so a new caller that says nothing gets the
   * single-shot policy rather than silently inheriting the server's.
   */
  retryOnBusy?: boolean;
}

/**
 * Open the workspace's index and rebuild it from Markdown — the ONE
 * implementation of the open-rebuild sequence that used to exist as six
 * hand-rolled copies (`openStore` in cli/index.ts, `cmdRebuild`,
 * `openMutateContext` in cli/commands/context.ts, `withWorkspace` and
 * `focus_context`'s describe in mcp/tools.ts, `buildInjection` in
 * core/inject.ts, and `cmdQuery`'s writer pass).
 *
 * The rebuild is unconditional and per call by design: the CLI, the hooks,
 * the MCP server and other sessions all write the same Markdown files, and a
 * store handed out without a rebuild answers from a stale index — `createItem`
 * trusts `ctx.store` as its whole view of the corpus for dedupe/id-family
 * lookups, and a caller that skipped the rebuild reported "created" for items
 * that already existed on disk (see `openMutateContext`'s doc comment, where
 * that incident is recorded).
 *
 * If the rebuild throws (as opposed to recording per-file LoadErrors), the
 * store is closed before the exception propagates so no handle leaks — on
 * Windows a leaked handle keeps the workspace undeletable. On success the
 * store is returned OPEN; closing it is the caller's job.
 */
export function openRebuiltStore(ws: Workspace, options: OpenStoreOptions = {}): OpenedStore {
  const store = Store.open(ws.dbPath);
  try {
    const run = (): { loaded: number; errors: LoadError[] } =>
      rebuild(store, rebuildRoots(ws), ws.config);
    const { loaded, errors } = options.retryOnBusy === true ? withRetry(run) : run();
    return { store, loaded, errors };
  } catch (err) {
    store.close();
    throw err;
  }
}

/**
 * The `{ project, global }` roots `rebuild()` expects, derived one way for
 * every caller: the global layer participates only when its directory
 * actually exists, and a workspace with no project root (dbPath `:memory:`)
 * rebuilds nothing rather than throwing here — callers that require a
 * project root refuse before calling.
 */
export function rebuildRoots(ws: Workspace): { project?: string; global?: string } {
  return {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  };
}
