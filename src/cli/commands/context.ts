import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { rebuild, type LoadError } from '../../core/rebuild.ts';
import { Store } from '../../core/store.ts';
import type { MutationContext } from '../../core/mutate.ts';
import type { Workspace } from '../../core/workspace.ts';
import { flag, type Emit } from './registry.ts';

/**
 * The sole owner of the `my_context: error  <file>: ` prefix — moved here from
 * `src/cli/index.ts`, which now imports it, so the format has one definition
 * rather than two that can drift. `LoadError.message` is a bare sentence:
 * every producer (item.ts, frontmatter.ts, rebuild.ts) self-prefixes nothing.
 */
export function emitLoadErrors(errors: LoadError[], out: Emit): void {
  for (const err of errors) out(`my_context: error  ${err.file}: ${err.message}`);
}

/**
 * Formats any thrown value as a single `my_context:`-prefixed line, never a
 * raw stack trace. Moved here from `src/cli/index.ts` (which imports it back)
 * for the same one-owner reason as `emitLoadErrors`: `openMutateContext` can
 * surface a completely unprefixed, raw system error (e.g. SQLite's own
 * "unable to open database file", with no `my_context:` anywhere in it) —
 * every catch block that might see one of those, in every command module,
 * needs the identical normalization `runCli`'s top-level catch already
 * applies, not a second copy of the same one-line `startsWith` check.
 */
export function toCliMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.startsWith('my_context:') ? message : `my_context: ${message}`;
}

/**
 * A fully indexed MutationContext, plus the rebuild's load errors.
 *
 * There is no `caller` field on `MutationContext` — trust is decided per call
 * from `input.origin`, so every write from a CLI command passes
 * `origin: 'human'` at the call site (spec §7.1's "user, via command" row).
 * The MCP surface passes `origin: 'agent'`, and ingestion `origin: 'ingest'`.
 *
 * This ALWAYS rebuilds before returning the context — it is never handed a
 * pre-existing `ctx.store`. `withWorkspace` in `src/mcp/tools.ts` rebuilds
 * before every call, and the CLI's `openStore` (src/cli/index.ts) does too,
 * for the identical reason: a mutation function such as `createItem` trusts
 * `ctx.store` as its whole view of the corpus for dedupe/id-family lookups,
 * and nothing in `createItem` itself enforces that the store it is handed is
 * current. A caller that skipped the rebuild and passed a stale or empty
 * store got a confidently wrong answer in practice — `createItem` reported
 * "created" for three items that already existed on disk, because the store
 * it consulted did not yet know about them. `openMutateContext` closes that
 * gap at the one place every ingest/mutation command opens a context, rather
 * than trusting each of the nine call sites in this plan to remember it.
 *
 * The errors are RETURNED, never discarded, and mirror `openStore` in
 * `src/cli/index.ts` for the same reason: a corrupt item file must not let a
 * command report success while silently dropping authored knowledge. Every
 * caller ends with `emitLoadErrors(errors, out)`. Per the F2 ruling already
 * established for `add`/`list`/`show`/`rebuild` (see `src/cli/index.ts`), a
 * command that did what it was asked reports an unrelated load error as a
 * WARNING and still exits 0 — only `status` and `doctor`, whose whole job is
 * reporting corpus health, exit non-zero on one. `ingest-apply` follows the
 * same rule: a corrupt, unrelated item file elsewhere in the corpus does not
 * turn a successful apply into a failure. If the rebuild itself throws, the
 * store is closed before the exception propagates so no handle leaks.
 */
export function openMutateContext(ws: Workspace): { ctx: MutationContext; errors: LoadError[] } {
  if (!ws.projectRoot) {
    throw new Error('my_context: no workspace here. Run `mycontext init` to create one.');
  }
  const store = Store.open(ws.dbPath);
  try {
    const { errors } = rebuild(store, {
      project: ws.projectRoot,
      global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
    }, ws.config);
    return { ctx: { root: ws.projectRoot, store, config: ws.config }, errors };
  } catch (err) {
    store.close();
    throw err;
  }
}

/**
 * Read a JSON payload from `--file <path>` or stdin (fd 0). Reading fd 0
 * synchronously is how a `node --test` process and a piping shell both work
 * without an async CLI.
 */
export function readPayload(args: string[], cwd: string): unknown {
  const file = flag(args, 'file');
  const source = file
    ? readFileSync(path.resolve(cwd, file), 'utf8')
    : readFileSync(0, 'utf8');
  try {
    return JSON.parse(source);
  } catch (err) {
    throw new Error(
      `my_context: the candidates payload is not valid JSON: ` +
      `${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
