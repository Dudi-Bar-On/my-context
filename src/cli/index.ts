#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import type { Config } from '../core/config.ts';
import { renderItem } from '../core/item.ts';
import { createItem, type MutationContext } from '../core/mutate.ts';
import { isMainEntry } from '../core/paths.ts';
import { pruneSnapshots } from '../core/ledger.ts';
import { rebuild, type LoadError } from '../core/rebuild.ts';
import { Store } from '../core/store.ts';
import { DIR_NAME, findProjectRoot, resolveWorkspace, type Workspace } from '../core/workspace.ts';
import { HELP_TOPICS, exampleItem, helpTopic } from '../help/index.ts';
import './commands/index.ts';
import { emitLoadErrors, toCliMessage } from './commands/context.ts';
import { COMMANDS } from './commands/registry.ts';

type Emit = (s: string) => void;

/**
 * The `categories:` line has to list only what `mycontext add` will actually
 * accept. `CATEGORIES` (the built-in catalog) includes `policy`,
 * `postmortem` and `taxonomy`, which are disabled by default and refused by
 * `resolveCategory` — so the banner is a function of the *resolved*,
 * per-workspace config, not the static catalog, the same source
 * `mycontext_help("categories")` already renders its table from.
 */
// Every line of the shipped block below is retained verbatim, `help` and
// `examples` included: they are still real `case` arms, and dropping them
// from usage would hide two working commands. Only Task 15 removes a line
// here, when `status` genuinely moves into the registry.
function usage(config: Config): string {
  const enabled = Object.values(config.categories)
    .filter((c) => c.enabled)
    .map((c) => c.name);
  const registered = [...COMMANDS.values()]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((c) => `  ${c.usage.padEnd(28)}${c.summary}`)
    .join('\n');
  return `usage: mycontext <command> [args]

  init                        create .my_context in the current directory
  add <category> <title>      create a new item
  list [category]             list items
  show <id>                   print an item
  rebuild                     rebuild the index from Markdown
  status                      report counts, budgets and health
  help [topic]                guidance: ${HELP_TOPICS.join(', ')}
  examples <category>         print a complete example item
${registered}

categories: ${enabled.join(', ')}`;
}

function requireWorkspace(ws: Workspace, out: Emit): string | null {
  if (ws.projectRoot) return ws.projectRoot;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return null;
}

/** The `{ project, global }` roots rebuild() expects, derived once per workspace. */
function rebuildRoots(ws: Workspace): { project?: string; global?: string } {
  return {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  };
}

/**
 * Opens the store and rebuilds the index from Markdown. The rebuild errors
 * are returned, never discarded: a corrupt item file must not let a caller
 * report success while silently dropping authored knowledge. If the rebuild
 * itself throws (as opposed to recording a per-file LoadError), the store is
 * closed before the exception propagates so no handle leaks.
 */
export function openStore(ws: Workspace): { store: Store; errors: LoadError[] } {
  const store = Store.open(ws.dbPath);
  try {
    const result = rebuild(store, rebuildRoots(ws), ws.config);
    return { store, errors: result.errors };
  } catch (err) {
    store.close();
    throw err;
  }
}

function cmdInit(cwd: string, out: Emit): number {
  const root = path.join(cwd, DIR_NAME);
  if (existsSync(root)) { out(`my_context: ${root} already exists.`); return 1; }

  const ancestor = findProjectRoot(cwd);
  if (ancestor) {
    out(
      `my_context: warning: an existing workspace was found at ${ancestor}. ` +
      `Its items will not be visible from ${root} once this workspace is created, ` +
      `because the nearer workspace shadows it.`,
    );
  }

  mkdirSync(path.join(root, 'items'), { recursive: true });
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ profile: 'standard', categories: {}, budgets: {} }, null, 2) + '\n',
  );
  writeFileSync(path.join(root, '.gitignore'), '.index.db\n.index.db-*\n');
  out(`my_context: initialized ${root}`);
  return 0;
}

/**
 * F3 fix: this used to hardcode `origin: 'human'`/`status: 'active'` and
 * call `writeItem` directly, bypassing `mutate.ts` entirely — and with it
 * the trust model, idempotency/id-family dedup, `extra`-key validation, enum
 * validation, and the `validateBody`/`validateObservationText` round-trip
 * guards. Routing through `createItem` closes all of that in one place
 * instead of a second, divergent copy of it living here. `origin: 'human'`
 * is still passed explicitly — `mycontext add` is a human-facing CLI
 * command, and `trustedStatus` demotes every non-`human` origin, so a
 * human's item still lands `active`, same as before.
 */
function cmdAdd(ws: Workspace, args: string[], out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;

  const [category, ...titleParts] = args;
  const title = titleParts.join(' ');
  if (!category || !title) { out('usage: mycontext add <category> <title>'); return 1; }

  const { store, errors } = openStore(ws);
  try {
    const ctx: MutationContext = { root, store, config: ws.config };
    const result = createItem(ctx, { type: category, title, origin: 'human' });
    out(result.message);
    // F2: `add` did what it was asked — the item exists on disk and in the
    // index. A load error elsewhere in the corpus is still reported (never
    // silenced — INV-nothing-is-dropped-silently), but it does not turn a
    // successful command into a failure. Only `status` and `doctor`, whose
    // whole job is reporting corpus health, exit non-zero on it.
    emitLoadErrors(errors, out);
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    store.close();
  }
}

function cmdList(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const { store, errors } = openStore(ws);
  const filter = args[0];
  for (const item of store.all()) {
    if (filter && item.type !== filter) continue;
    out(`${item.id}  ${item.type}  ${item.status}  ${item.title}`);
  }
  store.close();
  // F2: see the comment in cmdAdd — `list` succeeded at listing, so a load
  // error elsewhere is a warning, not a failure.
  emitLoadErrors(errors, out);
  return 0;
}

function cmdShow(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const id = args[0];
  if (!id) { out('usage: mycontext show <id>'); return 1; }

  const { store, errors } = openStore(ws);
  const item = store.get(id);
  store.close();
  if (!item) {
    out(`my_context: no item with id "${id}".`);
    emitLoadErrors(errors, out);
    return 1;
  }
  out(renderItem(item));
  // F2: `show` found and printed the item it was asked for; an unrelated
  // load error is a warning, not a failure — see the comment in cmdAdd.
  emitLoadErrors(errors, out);
  return 0;
}

function cmdRebuild(ws: Workspace, out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;
  const store = Store.open(ws.dbPath);
  let result;
  try {
    result = rebuild(store, rebuildRoots(ws), ws.config);
  } finally {
    store.close();
  }
  out(`my_context: indexed ${result.loaded} item(s)`);

  // `state/` holds one restore snapshot per session and never prunes itself
  // otherwise; sweep entries older than the retention window (30 days — see
  // SNAPSHOT_MAX_AGE_MS) here so a project used daily doesn't accumulate
  // them without bound. Best-effort: pruneSnapshots never throws.
  const pruned = pruneSnapshots(root);
  if (pruned > 0) out(`my_context: pruned ${pruned} stale snapshot file(s) from state/`);

  // F2: `rebuild` did its job — it indexed everything it could parse — so
  // an unparseable item elsewhere is a warning, not a failure; see the
  // comment in cmdAdd. `status`/`doctor` remain the commands that fail their
  // exit code on a load error.
  emitLoadErrors(result.errors, out);
  return 0;
}

function cmdStatus(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const { store, errors } = openStore(ws);
  const items = store.all();
  store.close();

  const byType = new Map<string, number>();
  const byStatus = new Map<string, number>();
  for (const item of items) {
    byType.set(item.type, (byType.get(item.type) ?? 0) + 1);
    byStatus.set(item.status, (byStatus.get(item.status) ?? 0) + 1);
  }

  out(`my_context: ${items.length} item(s), profile "${ws.config.profile}"`);
  out('');
  out('by category');
  for (const [type, n] of [...byType].sort()) out(`  ${type.padEnd(16)}${n}`);
  out('');
  out('by status');
  for (const [status, n] of [...byStatus].sort()) out(`  ${status.padEnd(16)}${n}`);

  const deadScopes = items.filter((i) => i.scope.length === 0 && i.status === 'active');
  if (deadScopes.length) {
    out('');
    out(`${deadScopes.length} active item(s) have no scope and will never JIT-activate.`);
  }
  emitLoadErrors(errors, out);
  return errors.length ? 1 : 0;
}

function cmdHelp(ws: Workspace, args: string[], out: Emit): number {
  const topic = args[0];
  if (!topic) {
    out(usage(ws.config));
    out('');
    out(`help topics: ${HELP_TOPICS.join(', ')}`);
    out('  e.g. mycontext help scope');
    return 0;
  }
  try {
    out(helpTopic(topic, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

function cmdExamples(ws: Workspace, args: string[], out: Emit): number {
  const type = args[0];
  if (!type) { out(`usage: mycontext examples <category>`); return 1; }
  try {
    out(exampleItem(type, ws.config));
    return 0;
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }
}

export function runCli(argv: string[], cwd: string, out: Emit): number {
  const [command, ...args] = argv;

  try {
    if (command === 'init') return cmdInit(cwd, out);

    const ws: Workspace = resolveWorkspace(cwd);

    // The banner's `categories:` line is a function of the resolved,
    // per-workspace config (see `usage()`), so it can only be built once the
    // workspace is known — which is also true for every other command, so
    // this no longer needs to short-circuit ahead of `resolveWorkspace`.
    if (!command || command === '--help') { out(usage(ws.config)); return command ? 0 : 1; }

    switch (command) {
      case 'add':     return cmdAdd(ws, args, out);
      case 'list':    return cmdList(ws, args, out);
      case 'show':    return cmdShow(ws, args, out);
      case 'rebuild': return cmdRebuild(ws, out);
      case 'status':  return cmdStatus(ws, out);
      case 'help':     return cmdHelp(ws, args, out);
      case 'examples': return cmdExamples(ws, args, out);
      default: {
        const registered = COMMANDS.get(command);
        if (registered) return registered.run(ws, args, out, cwd);
        out(`my_context: unknown command "${command}".\n\n${usage(ws.config)}`);
        return 1;
      }
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
