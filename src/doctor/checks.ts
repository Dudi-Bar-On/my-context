import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import type { Item } from '../core/types.ts';
import { chunkDocument } from '../ingest/chunk.ts';

export interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
}

const SKIP_DIRS = new Set([
  '.git', '.my_context', '.my-context', 'node_modules', 'dist', 'build', 'out',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
]);

const FILE_LIMIT = 20_000;

/** Repo-relative POSIX paths of every tracked-looking file, bounded so doctor stays fast. */
export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  const out: string[] = [];

  const walk = (dir: string): void => {
    if (out.length >= limit) return;
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (out.length >= limit) return;
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));
    }
  };

  walk(repoRoot);
  return out;
}

function newestMarkdownMtime(dir: string): number {
  let newest = 0;
  const walk = (current: string): void => {
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.name.endsWith('.md')) continue;
      try {
        newest = Math.max(newest, statSync(full).mtimeMs);
      } catch {
        // A file deleted mid-walk is not a doctor finding.
      }
    }
  };
  walk(dir);
  return newest;
}

export function checkIndexFreshness(root: string, dbPath: string): Finding[] {
  if (!existsSync(dbPath)) {
    return [{
      level: 'info', code: 'index_missing',
      message: `no index at ${dbPath}. It is disposable and will be built on the next command.`,
    }];
  }

  let indexMtime: number;
  try {
    indexMtime = statSync(dbPath).mtimeMs;
  } catch (err) {
    return [{
      level: 'error', code: 'index_unreadable',
      message: `cannot stat ${dbPath}: ${err instanceof Error ? err.message : String(err)}`,
    }];
  }

  const newest = newestMarkdownMtime(path.join(root, 'items'));
  if (newest > indexMtime) {
    return [{
      level: 'warn', code: 'index_stale',
      message:
        `the index is older than the newest item file ` +
        `(${new Date(indexMtime).toISOString()} vs ${new Date(newest).toISOString()}). ` +
        `Run \`mycontext rebuild\`.`,
    }];
  }
  return [];
}

export function checkOrphanRelations(items: Item[]): Finding[] {
  const known = new Set(items.map((i) => i.id));
  const findings: Finding[] = [];

  for (const item of items) {
    for (const relation of item.relations) {
      if (known.has(relation.target)) continue;
      findings.push({
        level: 'warn', code: 'orphan_relation', item: item.id,
        message:
          `relation "${relation.type} [[${relation.target}]]" points at an item that does not exist. ` +
          `Create it, or remove the line from ${item.filePath}.`,
      });
    }
  }
  return findings;
}

export function checkSourceDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const cache = new Map<string, ReturnType<typeof chunkDocument> | null>();

  for (const item of items) {
    if (!item.sourceFile || !item.sourceAnchor || !item.sourceChecksum) continue;

    if (!cache.has(item.sourceFile)) {
      const absolute = path.resolve(repoRoot, ...item.sourceFile.split('/'));
      try {
        cache.set(item.sourceFile, chunkDocument(readFileSync(absolute, 'utf8')));
      } catch {
        cache.set(item.sourceFile, null);
      }
    }

    const chunks = cache.get(item.sourceFile);
    if (chunks === null || chunks === undefined) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        message:
          `source document "${item.sourceFile}" is gone. The item still stands, but its provenance ` +
          `cannot be verified. Clear source_file, or restore the document.`,
      });
      continue;
    }

    const chunk = chunks.find((c) => c.anchor === item.sourceAnchor);
    if (!chunk) {
      findings.push({
        level: 'warn', code: 'source_anchor_missing', item: item.id,
        message:
          `"${item.sourceFile}" no longer has a section anchored "${item.sourceAnchor}" — it was probably ` +
          `renamed. Current anchors: ${chunks.map((c) => c.anchor).join(', ')}.`,
      });
      continue;
    }

    if (chunk.checksum !== item.sourceChecksum) {
      findings.push({
        level: 'warn', code: 'source_drift', item: item.id,
        message:
          `"${item.sourceFile}" § ${item.sourceAnchor} has changed since this item was captured ` +
          `(${item.sourceChecksum} → ${chunk.checksum}). Nothing was auto-resolved: read the section and ` +
          `update or supersede ${item.id} yourself.`,
      });
    }
  }

  return findings;
}

export function checkDeadScopes(repoRoot: string, items: Item[]): Finding[] {
  const scoped = items.filter((i) => i.status === 'active' && i.scope.length > 0);
  if (scoped.length === 0) return [];

  const files = listRepoFiles(repoRoot);
  const findings: Finding[] = [];

  for (const item of scoped) {
    for (const glob of item.scope) {
      if (files.some((f) => matchesAnyGlob(f, [glob]))) continue;
      findings.push({
        level: 'warn', code: 'dead_scope', item: item.id,
        message:
          `scope glob "${glob}" matches no file in the repository. ${item.id} will never activate ` +
          `through it — the clearest rot signal after a refactor. Re-scope it or drop the glob.`,
      });
    }
  }
  return findings;
}

export function checkPermissions(root: string): Finding[] {
  const findings: Finding[] = [];

  for (const target of [root, path.join(root, 'items')]) {
    try {
      accessSync(target, constants.R_OK | constants.W_OK);
    } catch (err) {
      findings.push({
        level: 'error', code: 'not_writable',
        message: `${target} is not readable and writable: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const ignore = path.join(root, '.gitignore');
  let ignored = false;
  try {
    ignored = readFileSync(ignore, 'utf8').split(/\r?\n/).some((line) => line.trim() === '.index.db');
  } catch {
    ignored = false;
  }
  if (!ignored) {
    findings.push({
      level: 'warn', code: 'index_not_ignored',
      message:
        `${ignore} does not ignore .index.db. The index is disposable and machine-specific; ` +
        `committing it produces binary merge conflicts. Add ".index.db" and ".index.db-*".`,
    });
  }

  return findings;
}

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[];
}): Finding[] {
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items),
    () => checkPermissions(opts.root),
  ];

  const findings: Finding[] = [];
  for (const check of checks) {
    try {
      findings.push(...check());
    } catch (err) {
      // A check that throws must never suppress the others.
      findings.push({
        level: 'error', code: 'check_failed',
        message: `a doctor check threw: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
  return findings;
}
