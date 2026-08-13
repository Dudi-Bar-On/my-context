#!/usr/bin/env node
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../core/categories.ts';
import { renderItem } from '../core/item.ts';
import { rebuild, writeItem } from '../core/rebuild.ts';
import { makeId } from '../core/slug.ts';
import { Store } from '../core/store.ts';
import { DIR_NAME, resolveWorkspace, type Workspace } from '../core/workspace.ts';
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

function openStore(ws: Workspace): Store {
  const store = Store.open(ws.dbPath);
  rebuild(store, {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  return store;
}

function cmdInit(cwd: string, out: Emit): number {
  const root = path.join(cwd, DIR_NAME);
  if (existsSync(root)) { out(`my_context: ${root} already exists.`); return 1; }

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
  const store = openStore(ws);
  const filter = args[0];
  for (const item of store.all()) {
    if (filter && item.type !== filter) continue;
    out(`${item.id}  ${item.type}  ${item.status}  ${item.title}`);
  }
  store.close();
  return 0;
}

function cmdShow(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const id = args[0];
  if (!id) { out('usage: mycontext show <id>'); return 1; }

  const store = openStore(ws);
  const item = store.get(id);
  store.close();
  if (!item) { out(`my_context: no item with id "${id}".`); return 1; }
  out(renderItem(item));
  return 0;
}

function cmdRebuild(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = Store.open(ws.dbPath);
  const result = rebuild(store, {
    project: ws.projectRoot ?? undefined,
    global: existsSync(ws.globalRoot) ? ws.globalRoot : undefined,
  });
  store.close();
  out(`my_context: indexed ${result.loaded} item(s)`);
  for (const err of result.errors) out(`  error  ${err.file}: ${err.message}`);
  return result.errors.length ? 1 : 0;
}

function cmdStatus(ws: Workspace, out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  const store = openStore(ws);
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
  return 0;
}

export function runCli(argv: string[], cwd: string, out: Emit): number {
  const [command, ...args] = argv;
  if (!command || command === 'help' || command === '--help') { out(USAGE); return command ? 0 : 1; }
  if (command === 'init') return cmdInit(cwd, out);

  let ws: Workspace;
  try {
    ws = resolveWorkspace(cwd);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

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
}

if (import.meta.filename === process.argv[1]) {
  process.exitCode = runCli(process.argv.slice(2), process.cwd(), (s) => console.log(s));
}
