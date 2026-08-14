import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import type { Item } from '../core/types.ts';
import { chunkDocument } from '../ingest/chunk.ts';
import { ingestDir, SESSION_PROTOCOL } from '../ingest/session.ts';

export interface Finding {
  level: 'error' | 'warn' | 'info';
  code: string;
  message: string;
  item?: string;
}

/**
 * Directories `listRepoFiles` never descends into, for its general "fast,
 * bounded scan of the repository" purpose. `checkDeadScopes` deliberately
 * does NOT use this list (see `SCOPE_SKIP_DIRS` below) — a scope glob is
 * allowed to target generated output (`dist/`, `coverage/`, ...) or the
 * workspace itself (`.my_context/`), and skipping those directories here
 * previously made `checkDeadScopes` report a live scope as dead.
 */
const SKIP_DIRS = new Set([
  '.git', '.my_context', '.my-context', 'node_modules', 'dist', 'build', 'out',
  '.venv', 'venv', '__pycache__', '.next', '.turbo', 'coverage',
]);

/**
 * Directories `checkDeadScopes` never descends into. Deliberately much
 * smaller than `SKIP_DIRS`: `.git` internals can never be a meaningful scope
 * target and are large, so they stay excluded; `node_modules` is vendor
 * code no first-party constraint should realistically scope into, and can be
 * enormous, so it stays excluded too. Every directory a real constraint might
 * legitimately scope into — `.my_context/` itself, `dist/`, `build/`,
 * `coverage/`, `.next/`, and so on — is walked.
 */
const SCOPE_SKIP_DIRS = new Set(['.git', 'node_modules']);

const FILE_LIMIT = 20_000;

function walkFiles(repoRoot: string, limit: number, skipDirs: ReadonlySet<string>): string[] {
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
        if (skipDirs.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }
      if (entry.isFile()) out.push(relPosix(repoRoot, path.join(dir, entry.name)));
    }
  };

  walk(repoRoot);
  return out;
}

/** Repo-relative POSIX paths of every tracked-looking file, bounded so doctor stays fast. */
export function listRepoFiles(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  return walkFiles(repoRoot, limit, SKIP_DIRS);
}

/**
 * Same walk as `listRepoFiles`, but for `checkDeadScopes` specifically: it
 * must see everything a scope glob could legitimately name, including
 * `.my_context/` and build output, so it uses the much smaller
 * `SCOPE_SKIP_DIRS` instead of `SKIP_DIRS`.
 */
function listFilesForScopeCheck(repoRoot: string, limit: number = FILE_LIMIT): string[] {
  return walkFiles(repoRoot, limit, SCOPE_SKIP_DIRS);
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

/**
 * Index freshness compares against `.md` mtimes under `root/items` AND
 * `root/config.json` (folded in below) — but it does NOT see edits to a
 * neighboring global layer. The absence of an `index_stale` finding is
 * therefore not proof the index reflects global-layer state, only that no
 * *project* item file or config outran it. A full fix needs the global
 * root threaded through from the caller; out of scope for this check's
 * current signature, but a real gap — recorded for Task 12/15.
 */
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

  let newest = newestMarkdownMtime(path.join(root, 'items'));
  try {
    newest = Math.max(newest, statSync(path.join(root, 'config.json')).mtimeMs);
  } catch {
    // No config.json, or it can't be stat'd: not a doctor finding on its own.
  }

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

/**
 * Note for the caller (Task 12): this compares every relation's target
 * against `items` as a flat set of ids. If `items` is only the project
 * layer, a relation pointing at a real global-layer item will be reported as
 * an orphan — a false positive, not a bug in this function. Pass the full,
 * merged cross-layer item set.
 */
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

/** Cap on how many current anchors get listed in a `source_anchor_missing`
 * message — an oversize PRD can have hundreds of sections, and dumping all
 * of them makes the finding unreadable rather than more useful. */
const MAX_LISTED_ANCHORS = 10;

export function checkSourceDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const cache = new Map<string, ReturnType<typeof chunkDocument> | null>();

  for (const item of items) {
    if (!item.sourceFile || !item.sourceAnchor || !item.sourceChecksum) continue;

    if (!cache.has(item.sourceFile)) {
      const absolute = path.resolve(repoRoot, ...item.sourceFile.split('/'));
      // A source_file that climbs out of repoRoot (e.g. "../../etc/passwd")
      // is never trusted, whether or not something happens to exist there:
      // doctor only ever reads inside the workspace it was pointed at.
      const rel = relPosix(repoRoot, absolute);
      if (rel === '..' || rel.startsWith('../')) {
        cache.set(item.sourceFile, null);
      } else {
        try {
          cache.set(item.sourceFile, chunkDocument(readFileSync(absolute, 'utf8')));
        } catch {
          cache.set(item.sourceFile, null);
        }
      }
    }

    const chunks = cache.get(item.sourceFile);
    if (chunks === null || chunks === undefined) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        message:
          `source document "${item.sourceFile}" could not be read (missing, unreadable, or outside the ` +
          `repository). The item still stands, but its provenance cannot be verified. Clear source_file, ` +
          `or restore the document.`,
      });
      continue;
    }

    const chunk = chunks.find((c) => c.anchor === item.sourceAnchor);
    if (!chunk) {
      const anchors = chunks.map((c) => c.anchor);
      const listed = anchors.slice(0, MAX_LISTED_ANCHORS).join(', ');
      const suffix = anchors.length > MAX_LISTED_ANCHORS ? `, and ${anchors.length - MAX_LISTED_ANCHORS} more` : '';
      findings.push({
        level: 'warn', code: 'source_anchor_missing', item: item.id,
        message:
          `"${item.sourceFile}" no longer has a section anchored "${item.sourceAnchor}" — it was probably ` +
          `renamed. Current anchors: ${listed}${suffix}.`,
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

  const files = listFilesForScopeCheck(repoRoot);
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

/**
 * Does gitignore `line` cover a file literally named `name` (e.g.
 * `.index.db`, `.index.db-wal`)? Handles the shapes doctor is actually
 * likely to see: a bare name, a trailing `*` (`.index.db*`), a leading `/`
 * (root-anchored — irrelevant to whether it covers the name, since the name
 * has no path segments of its own here), a leading double-star segment, and a bare `*` or
 * `**` that ignores everything. Not a full gitignore engine (no `!`
 * negation, no `[...]` character classes, no mid-pattern `**`) — deliberately
 * scoped to the patterns this specific check needs to stop false-positiving
 * on, not a general-purpose implementation.
 */
function gitignoreLineCoversName(line: string, name: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  let pattern = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (pattern === '*' || pattern === '**' || pattern === '**/*') return true;
  if (pattern.startsWith('**/')) pattern = pattern.slice(3);
  if (pattern.endsWith('/')) return false; // directory-only rule; handled by gitignoreLineCoversDir
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return re.test(name);
}

/** Does gitignore `line` ignore the whole directory named `dirName`
 * (e.g. a top-level `.gitignore` with `.my_context/`)? If so, everything
 * inside — including `.index.db` — is covered too. */
function gitignoreLineCoversDir(line: string, dirName: string): boolean {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith('#')) return false;
  let pattern = trimmed.startsWith('/') ? trimmed.slice(1) : trimmed;
  if (!pattern.endsWith('/')) return false;
  pattern = pattern.slice(0, -1);
  if (pattern.startsWith('**/')) pattern = pattern.slice(3);
  if (!pattern) return false;
  const re = new RegExp(
    '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
  );
  return re.test(dirName);
}

function indexCoveredByGitignore(gitignorePath: string, matchDir: boolean, dirName: string): boolean {
  let lines: string[];
  try {
    lines = readFileSync(gitignorePath, 'utf8').split(/\r?\n/);
  } catch {
    return false;
  }
  return lines.some((line) => (
    gitignoreLineCoversName(line, '.index.db')
    || gitignoreLineCoversName(line, '.index.db-wal')
    || gitignoreLineCoversName(line, '.index.db-shm')
    || (matchDir && gitignoreLineCoversDir(line, dirName))
  ));
}

export function checkPermissions(
  root: string,
  access: (target: string, mode?: number) => void = accessSync,
  repoRoot?: string,
): Finding[] {
  const findings: Finding[] = [];

  for (const target of [root, path.join(root, 'items')]) {
    try {
      access(target, constants.R_OK | constants.W_OK);
    } catch (err) {
      findings.push({
        level: 'error', code: 'not_writable',
        message: `${target} is not readable and writable: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  const ignore = path.join(root, '.gitignore');
  let ignored = indexCoveredByGitignore(ignore, false, '');
  if (!ignored && repoRoot) {
    const topIgnore = path.join(repoRoot, '.gitignore');
    ignored = indexCoveredByGitignore(topIgnore, true, path.basename(root));
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

/**
 * A sixth check, added in Task 12 (the `doctor` command task), not Task 11:
 * a gap Task 11's own review recorded but explicitly left unclosed because
 * it scoped itself to the five checks its brief named. This one is cheap —
 * a bounded directory listing plus a JSON parse per file, the same shape as
 * `listSessions` itself (src/ingest/session.ts) — and squarely in scope for
 * a corpus-health command.
 *
 * The actual failure mode this catches (verified against `session.ts`'s
 * real read/write paths, not assumed): `openIngestSession` computes its
 * lookup id deterministically from `sourceFile` + `sourceChecksum`, which
 * matches the ORIGINAL, correct filename — so a resume's applied-log read
 * is unaffected by a mismatched header id; nothing is silently skipped on
 * resume. The damage happens on the next SAVE: `openIngestSession` returns
 * `{ ...existing, applied }`, which keeps `existing.id` (the bogus header
 * value) on the returned session object. `saveSession`/`writeHeader` then
 * trust `session.id` for where to write, producing a SECOND header file
 * (and a second, empty-until-now applied log) under the bogus id, alongside
 * the original. `listSessions` then lists both files, and because both now
 * resolve to the same id, the same logical session is listed twice.
 *
 * The safe remediation is therefore to correct the header's `id` field back
 * to match the filename — NOT to rename the file to match the id.  Renaming
 * the file would make it stop matching what `openIngestSession` computes
 * from `sourceFile` + `sourceChecksum` on the next `ingest` of that
 * document, so the existing session would no longer be found at all: the
 * whole document would be re-chunked and re-extracted from scratch, and the
 * applied log recorded under the old filename would be orphaned — the exact
 * loss this finding exists to prevent, self-inflicted by "fixing" it the
 * wrong way.
 */
export function checkSessionIdMismatch(root: string): Finding[] {
  const dir = ingestDir(root);
  let names: string[];
  try {
    names = readdirSync(dir).filter((n) => n.endsWith('.json'));
  } catch {
    return [];
  }

  const findings: Finding[] = [];
  for (const name of names) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(path.join(dir, name), 'utf8'));
    } catch {
      // A corrupt session file is working state, not knowledge — the same
      // call `listSessions` makes for the identical reason.
      continue;
    }
    if (!parsed || typeof parsed !== 'object') continue;
    const obj = parsed as { protocol?: unknown; id?: unknown };
    // Only files `listSessions` itself would recognize as a session are in
    // scope — a stray, unrelated `.json` file dropped into `.ingest/` (or
    // one from a future/older protocol version) must never trip an
    // error-level finding just because it happens to have an `id` key.
    if (obj.protocol !== SESSION_PROTOCOL) continue;
    if (typeof obj.id !== 'string') continue;

    const expected = `${obj.id}.json`;
    if (expected !== name) {
      findings.push({
        level: 'error', code: 'session_id_mismatch',
        message:
          `ingest session file "${name}" has internal id "${obj.id}", which disagrees with its ` +
          `filename. Nothing is lost on the next resume — reads are keyed off the filename-derived ` +
          `id — but the NEXT SAVE will trust the internal id and write a duplicate header and ` +
          `applied log under "${expected}", and \`mycontext ingest-status\` will then list this ` +
          `session twice. Fix it by editing the file's "id" field back to match the filename ` +
          `(here, "${name.replace(/\.json$/, '')}"). Do NOT rename the file to match the id instead: ` +
          `the applied log is keyed by the filename, so renaming would orphan it and the next ` +
          `ingest of this document would re-extract it from scratch.`,
      });
    }
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
    () => checkPermissions(opts.root, accessSync, opts.repoRoot),
    () => checkSessionIdMismatch(opts.root),
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
