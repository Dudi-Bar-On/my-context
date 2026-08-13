#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../core/categories.ts';
import { renderItem } from '../core/item.ts';
import { isMainEntry } from '../core/paths.ts';
import { rebuild, writeItem, type LoadError } from '../core/rebuild.ts';
import { makeId } from '../core/slug.ts';
import { Store } from '../core/store.ts';
import { DIR_NAME, findProjectRoot, resolveWorkspace, type Workspace } from '../core/workspace.ts';
import type { Item } from '../core/types.ts';

type Emit = (s: string) => void;

const USAGE = `usage: mycontext <command> [args]

  init                        create .my_context in the current directory
  add <category> <title>      create a new item
  list [category]             list items
  show <id>                   print an item
  rebuild                     rebuild the index from Markdown
  status                      report counts, budgets and health

categories: ${Object.keys(CATEGORIES).join(', ')}`;

function closest(name: string, candidates: string[]): string | null {
  const hit = candidates.find((c) => c.startsWith(name) || name.startsWith(c));
  return hit ?? null;
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

function emitLoadErrors(errors: LoadError[], out: Emit): void {
  for (const err of errors) out(`my_context: error  ${err.file}: ${err.message}`);
}

/**
 * Opens the store and rebuilds the index from Markdown. The rebuild errors
 * are returned, never discarded: a corrupt item file must not let a caller
 * report success while silently dropping authored knowledge. If the rebuild
 * itself throws (as opposed to recording a per-file LoadError), the store is
 * closed before the exception propagates so no handle leaks.
 */
function openStore(ws: Workspace): { store: Store; errors: LoadError[] } {
  const store = Store.open(ws.dbPath);
  try {
    const result = rebuild(store, rebuildRoots(ws));
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

function cmdAdd(ws: Workspace, args: string[], out: Emit): number {
  const root = requireWorkspace(ws, out);
  if (!root) return 1;

  const [category, ...titleParts] = args;
  const title = titleParts.join(' ');
  if (!category || !title) { out('usage: mycontext add <category> <title>'); return 1; }

  const resolved = ws.config.categories[category];
  if (!resolved) {
    const suggestion = closest(category, Object.keys(ws.config.categories));
    out(
      `my_context: unknown category "${category}".` +
      (suggestion ? ` Did you mean "${suggestion}"?` : '') +
      ` Known: ${Object.keys(ws.config.categories).join(', ')}`,
    );
    return 1;
  }
  if (!resolved.enabled) {
    out(
      `my_context: category "${category}" is not enabled in this project. ` +
      `Enable it in .my_context/config.json under categories.${category}.enabled.`,
    );
    return 1;
  }

  const id = makeId(resolved.prefix, title);
  const filePath = `items/${category}/${id}.md`;
  const target = path.join(root, ...filePath.split('/'));
  if (existsSync(target)) { out(`my_context: ${id} already exists at ${filePath}`); return 1; }

  const item: Item = {
    id, type: category, title, status: 'active', severity: 'soft', always: false,
    scope: [], tags: [], origin: 'human',
    sourceFile: null, sourceAnchor: null, sourceChecksum: null,
    validFrom: new Date().toISOString().slice(0, 10), validUntil: null,
    checksum: '', extra: {}, body: '', observations: [], relations: [],
    layer: 'project', filePath,
  };

  writeItem(root, item);
  out(`my_context: created ${id} at ${filePath}`);
  return 0;
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
  emitLoadErrors(errors, out);
  return errors.length ? 1 : 0;
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
  emitLoadErrors(errors, out);
  return errors.length ? 1 : 0;
}

function cmdRebuild(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = Store.open(ws.dbPath);
  let result;
  try {
    result = rebuild(store, rebuildRoots(ws));
  } finally {
    store.close();
  }
  out(`my_context: indexed ${result.loaded} item(s)`);
  emitLoadErrors(result.errors, out);
  return result.errors.length ? 1 : 0;
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

/** Formats any thrown value as a single `my_context:`-prefixed line, never a raw stack trace. */
function toCliMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  return message.startsWith('my_context:') ? message : `my_context: ${message}`;
}

export function runCli(argv: string[], cwd: string, out: Emit): number {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') { out(USAGE); return command ? 0 : 1; }

  try {
    if (command === 'init') return cmdInit(cwd, out);

    const ws: Workspace = resolveWorkspace(cwd);
    switch (command) {
      case 'add':     return cmdAdd(ws, args, out);
      case 'list':    return cmdList(ws, args, out);
      case 'show':    return cmdShow(ws, args, out);
      case 'rebuild': return cmdRebuild(ws, out);
      case 'status':  return cmdStatus(ws, out);
      default:
        out(`my_context: unknown command "${command}".\n\n${USAGE}`);
        return 1;
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
