import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AUDIT_MAX_BYTES, AUDIT_REPORT_BYTES, auditDir, auditSize } from '../core/audit.ts';
import { scopePolicyFor, skippedKeyNotice, type Config } from '../core/config.ts';
import { isEligible, itemCost } from '../core/select.ts';
import {
  BLOCKED_STATE, buildTaskIndex, NEEDS_FIELD, readNeeds, workItems,
} from '../core/needs.ts';
import { droppedBodyText } from '../core/item.ts';
import { matchesAnyGlob, relPosix } from '../core/paths.ts';
import { isSnapshot, snapshotText } from '../core/reference.ts';
import { RATIONALE_NOT_INJECTED } from '../core/render-item.ts';
import { checksum } from '../core/slug.ts';
import { projectionMismatches } from '../core/tag-projection.ts';
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

/**
 * The drift check for a WHOLE-FILE SNAPSHOT — a `reference`-shaped item, whose
 * body is a copy of a file rather than an assertion extracted from a section
 * of one (`isSnapshot`, core/reference.ts, carries that distinction).
 *
 * It is a separate function from the anchored check below rather than a branch
 * inside it, because almost nothing is shared: there is no anchor to find, no
 * document to chunk, and — decisively — the remedy is different. An anchored
 * item's source changed under an assertion a human wrote, so the route is
 * "read it and judge it". A snapshot's source changed under a copy, so the
 * route is mechanical and has a command: `mycontext refresh <id>`. The
 * message names it, which is the requirement spec §2 states in as many words.
 *
 * `source_missing` is shared, and deliberately worded the same way: a file
 * that cannot be read is the same failure whichever shape pointed at it.
 */
function checkSnapshotDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];

  for (const item of items) {
    if (!isSnapshot(item)) continue;
    // Narrowing for the type checker; `isSnapshot` has already established it.
    const sourceFile = item.sourceFile as string;

    const absolute = path.resolve(repoRoot, ...sourceFile.split('/'));
    // Same rule as the anchored check: doctor only ever reads inside the
    // workspace it was pointed at, whether or not something exists outside it.
    const rel = relPosix(repoRoot, absolute);
    let live: string | null = null;
    if (rel !== '..' && !rel.startsWith('../')) {
      try {
        live = snapshotText(readFileSync(absolute, 'utf8'));
      } catch {
        live = null;
      }
    }

    if (live === null) {
      findings.push({
        level: 'error', code: 'source_missing', item: item.id,
        message:
          `source document "${sourceFile}" could not be read (missing, unreadable, or outside the ` +
          `repository). ${item.id} still holds the snapshot taken when it was captured, and that ` +
          `text is unchanged — what cannot be checked is whether it is still current. Restore the ` +
          `file, or retire ${item.id} with \`mycontext supersede\`.`,
      });
      continue;
    }

    const liveChecksum = checksum(live);
    if (liveChecksum === item.sourceChecksum) continue;

    findings.push({
      level: 'warn', code: 'source_drift', item: item.id,
      message:
        `"${sourceFile}" has changed since ${item.id} snapshotted it ` +
        `(${item.sourceChecksum} → ${liveChecksum}). The item still holds the OLD text, and that ` +
        `is what any session reading it gets. Nothing was auto-resolved: run ` +
        `\`mycontext refresh ${item.id}\` to take a fresh snapshot, which shows you the size ` +
        `change and asks before it writes.`,
    });
  }

  return findings;
}

export function checkSourceDrift(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = checkSnapshotDrift(repoRoot, items);
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

/**
 * What deleting a dead glob would actually do — which depends on the
 * category's TIER and then on its `scopePolicy`, not on a constant. This
 * sentence used to end "an item left with no globs at all is unrestricted and
 * injects on every file" unconditionally, which is true on neither axis: under
 * `inert` the item would stop being injected altogether, under `required` the
 * deletion is refused outright (`scopeRequirementError`, mutate.ts), and on
 * the rationale tier the item is injected on no file whatever its scope says.
 * Advice a reader can act on has to know which project — and which category —
 * it is talking about.
 */
function deletingTheGlob(config: Config, type: string): string {
  // Tier FIRST, mirroring `select`'s own order — `eligible.filter((i) =>
  // isNormative(i, config))` runs before anything reads `always` or `scope` —
  // and the same order `mycontext supersede`'s preview and `review promote`'s
  // completion line were already written in. Every `scopePolicy` branch below
  // makes a claim about injection, and not one of them is true on the
  // rationale tier: this sentence used to end "an item left with no globs at
  // all is unrestricted and injects on every file" for a `decision`, which is
  // injected on no file whatever its scope says.
  //
  // `RATIONALE_NOT_INJECTED` (core/render-item.ts) is the existing spelling
  // and is reused rather than reworded — an eighth wording for one fact is
  // this project's recurring defect class.
  //
  // The scope is still worth fixing on a rationale item, so the advice does
  // not stop at "it changes nothing": `matchesScope` is what
  // `query_items({path})` and `mycontext query` filter on, and those are the
  // surfaces through which a rationale item is actually reached.
  //
  // Same `isNormative` shape as select.ts, `Object.hasOwn`-guarded: a type of
  // "constructor" would otherwise resolve through `Object.prototype`. A
  // category absent from config resolves as NOT normative, which agrees with
  // `isNormative` — such an item is admitted to no full-text tier at all.
  const normative = Object.hasOwn(config.categories, type) &&
    config.categories[type].tier === 'normative';
  if (!normative) {
    return ` Deleting it would not widen what is injected: "${type}" is a rationale-tier ` +
      `category in this project — ${RATIONALE_NOT_INJECTED} — so an item of it reaches no ` +
      'file through its scope in the first place. The globs still decide what ' +
      '`query_items({path})` and `mycontext query` return for a path, which is what makes ' +
      're-scoping worth doing here.';
  }
  switch (scopePolicyFor(config, type)) {
    case 'required':
      return ' Deleting it is not an option here: categories.' + type +
        '.scopePolicy is "required", so an item must keep at least one glob.';
    case 'inert':
      return ' Deleting it would not widen the item: categories.' + type +
        '.scopePolicy is "inert", so an item with no globs is injected on no file at all.';
    default:
      return ' Deleting the glob is only right if the item should apply everywhere: scope ' +
        'restricts, so an item left with no globs at all is unrestricted and injects on every file.';
  }
}

export function checkDeadScopes(repoRoot: string, items: Item[], config: Config): Finding[] {
  const scoped = items.filter((i) => i.status === 'active' && i.scope.length > 0);
  if (scoped.length === 0) return [];

  const files = listFilesForScopeCheck(repoRoot);
  const findings: Finding[] = [];

  for (const item of scoped) {
    for (const glob of item.scope) {
      if (files.some((f) => matchesAnyGlob(f, [glob]))) continue;
      findings.push({
        level: 'warn', code: 'dead_scope', item: item.id,
        // The item is NOT named again inside the sentence. It used to be, and
        // it was the widest line `doctor` printed: every surface that renders
        // this finding already carries `item` beside the message — the text
        // report prefixes the line with it, `--full` puts it on its own
        // labelled line, `--json` has the field — so the second mention was
        // the same id twice on one line. Unlike `source_drift` below, which
        // names the id as the argument of a command the reader is being told
        // to run, nothing here needs it inline: the finding is about this one
        // item's own glob, and the remediation ("re-scope it") is about the
        // glob.
        message:
          `scope glob "${glob}" matches no file in the repository. The item will never activate ` +
          `through it — the clearest rot signal after a refactor. Re-scope it to the path that ` +
          `replaced it.${deletingTheGlob(config, item.type)}`,
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

/**
 * Spec §4b's third hazard, made visible: **changing `scopePolicy` does not
 * rewrite existing items.** An item captured while its category was `global`
 * and later read under `inert` stops being injected on any file, and its
 * Markdown never changed — nothing in the corpus records the difference,
 * because the difference is not in the corpus. That is legitimate (policy is
 * configuration, not content) but it is invisible, and an invisible behaviour
 * change is what this whole check family exists to surface.
 *
 * `info`, not `warn`: nothing here is wrong. `doctor`'s exit code is driven by
 * errors, and a note must not turn a correctly-configured project red.
 *
 * One finding per category rather than per item: on a corpus where a whole
 * category is unscoped this would otherwise be the longest section of the
 * report, saying the same sentence once per item.
 */
export function checkScopePolicy(items: Item[], config: Config): Finding[] {
  const unscoped = new Map<string, number>();
  for (const item of items) {
    if (item.status !== 'active' || item.scope.length > 0) continue;
    unscoped.set(item.type, (unscoped.get(item.type) ?? 0) + 1);
  }

  const findings: Finding[] = [];
  for (const [type, count] of [...unscoped].sort((a, b) => a[0].localeCompare(b[0]))) {
    const policy = scopePolicyFor(config, type);
    if (policy === 'inert') {
      findings.push({
        level: 'info', code: 'scope_policy_inert',
        message:
          `${count} active "${type}" item(s) declare no scope, and categories.${type}.scopePolicy ` +
          `is "inert" — so they match no path: they are not JIT-injected on any file and ` +
          `query_items({path}) does not return them. They still appear in the session index, and ` +
          `an item with always: true is still pinned at session start, which scope never governs. ` +
          `Their files are unchanged and nothing needs fixing: the policy is configuration, not ` +
          `content, so setting it back to "global" makes the same items apply everywhere again ` +
          `with no edit to any item.`,
      });
    } else if (policy === 'required') {
      findings.push({
        level: 'info', code: 'scope_policy_required',
        message:
          `${count} active "${type}" item(s) declare no scope, although ` +
          `categories.${type}.scopePolicy is "required". Changing the policy does not rewrite ` +
          `existing items, so these predate it. They are still injected on every file — ` +
          `"required" refuses at capture, never at injection — and a new ${type} without a scope ` +
          `is refused from now on.`,
      });
    }
  }
  return findings;
}

/**
 * Items whose category is absent from config entirely — the state a project
 * lands in when a category is REMOVED from the catalogue (Phase 3 removed
 * `policy`, `postmortem` and `taxonomy`) or renamed in config after its items
 * were captured.
 *
 * `loadLayer` (rebuild.ts) deliberately indexes such items rather than
 * dropping them, and reports one load error per file. That is the safety net;
 * this is the route. A load error is keyed to a FILE and says what is wrong
 * with it; a doctor finding is keyed to an ITEM, carries a code a script can
 * match on, survives `--json`, and is where this project puts "here is what to
 * do about it". Removing a category with no finding here would leave a user
 * whose corpus has ten `policy` items reading the same sentence ten times with
 * no named migration.
 *
 * One finding per item, not per category, deliberately — the opposite choice
 * from `checkScopePolicy` above. There the message is identical for every item
 * and the count is the information; here the answer is "supersede THIS item
 * onto a replacement", which has to name the item to be actionable.
 *
 * `warn`, not `error`: the item is not lost and the corpus is not corrupt —
 * it is indexed, listed, shown and queryable, and only injection is closed to
 * it. `doctor`'s exit code is already 1 on such a corpus, driven by the load
 * error `loadLayer` raises for the same file, so making this an error would
 * count one problem twice in the summary line.
 */
/**
 * **The continuity tier's overflow, reported where a person looks rather than
 * only where a session reads.**
 *
 * R3 of the task that built the tier: overflow must be LOUD, in the injected
 * block AND as a doctor finding. The reason is the defect the tier exists to
 * end — `REF-v2-handover-read-before-discussing-the-web-ui` cost 37,831
 * estimated tokens against a largest budget of 24,000, was delivered on no
 * event, and nothing anywhere said so. A tier that quietly drops its payload
 * reproduces that with a longer fuse, so this check exists even though the
 * tier's content is meant to be a pointer plus a bounded digest and should
 * never approach the budget: "should never happen" is not a behaviour.
 *
 * **A total is enough, and no event has to be simulated.** `fitToBudget`
 * admits first-fit, so what it admits can never exceed the budget — therefore
 * a candidate set whose TOTAL exceeds the budget must spill at least one item,
 * whatever order it considers them in.
 *
 * The other finding is the other silence on this axis: an item that carries the
 * marker and can never be delivered, because it is retired or its category is
 * off. `warn` rather than `error` for `checkUnknownCategory`'s reason — nothing
 * is lost and nothing is corrupt — but said, because "the continuity guarantee
 * is switched off" is exactly the fact this feature exists to stop being
 * invisible.
 */
export function checkContinuity(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  const marked = items.filter((i) => i.continuity);
  if (marked.length === 0) return findings;

  for (const item of marked.filter((i) => !isEligible(i, config))) {
    const enabled = config.categories[item.type]?.enabled === true;
    findings.push({
      level: 'warn', code: 'continuity_inert', item: item.id,
      message:
        `${item.id} carries continuity: true and cannot be delivered: its status is `
        + `"${item.status}" and its category "${item.type}" is `
        + `${enabled ? 'enabled' : 'disabled or unknown to this config'}. The continuity `
        + 'tier admits active items in enabled categories only, so the guarantee this item '
        + 'is supposed to carry is in force for no session. Set the status back to active, '
        + 'enable the category, or clear the flag with `mycontext edit '
        + `${item.id} --continuity=false\` so that nothing claims a guarantee nothing keeps.`,
    });
  }

  const live = marked.filter((i) => isEligible(i, config));
  if (live.length === 0) return findings;
  const cost = live.reduce((sum, i) => sum + itemCost(i), 0);
  const budget = config.budgets.continuity;
  if (cost <= budget) return findings;

  findings.push({
    level: 'error', code: 'continuity_overflow',
    message:
      `the continuity tier costs ${cost} estimated tokens and budgets.continuity is `
      + `${budget}, so at least one continuity item reaches no session: `
      + `${live.map((i) => i.id).sort().join(', ')}. The project-continuity guarantee is NOT `
      + 'in force. The tier is meant to carry a POINTER PLUS A BOUNDED DIGEST — the document '
      + 'named, the current state summarised — and never the document itself, so the first '
      + 'answer is to shorten it: raising budgets.continuity relocates the spill rather than '
      + 'removing it, and a budget chosen against a document that keeps growing expires.',
  });
  return findings;
}

export function checkUnknownCategory(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (Object.hasOwn(config.categories, item.type)) continue;
    findings.push({
      level: 'warn', code: 'unknown_category', item: item.id,
      message:
        `declares type "${item.type}", which this project's config does not define — a ` +
        `category removed or renamed since this item was captured. Nothing has been dropped: ` +
        `it is still indexed, listed, shown and queryable. What it cannot do is govern, ` +
        `because no tier admits an item whose category is unknown, so the session index ` +
        `counts it rather than naming it. There is no retype — "type" is fixed at creation ` +
        `and decides where the file lives — so there are two routes. Keep the category: ` +
        `declare "${item.type}" in .my_context/config.json with a "tier" and a "description", ` +
        `and it is a first-class category of this project again. Or migrate the item: capture ` +
        `a replacement under a live category, then \`mycontext supersede ${item.id} --by ` +
        `<replacement id>\`, which retires this one and records the link between them.`,
    });
  }
  return findings;
}

/**
 * **The top-level config keys this build did not read, disclosed to the
 * person who wrote them.**
 *
 * `resolveConfig` accepts an unknown top-level key, leaves it out of the
 * resolved config, and carries it on `skippedKeys` (`config.ts` ·
 * `  skippedKeys: string[];` · ~529). That field's own docblock states the
 * consequence as a duty rather than a convenience: *"a surface that shows
 * config to a human and does not print this notice has re-created the silent
 * drop this field exists to end."* Until this check existed, the only caller
 * of `skippedKeyNotice` (`config.ts` ·
 * `export function skippedKeyNotice(config: Config): string {` · ~1637) was
 * the web UI's `/api/config` — so a `"uiu"` one transposed letter from
 * `"ui"` made `doctor` report `0 error(s), 0 warning(s), 0 note(s)` and the
 * user believed the setting they wrote was in force. The person most likely
 * to have hand-edited `config.json` is at a terminal, which is the surface
 * that was silent.
 *
 * The message is `skippedKeyNotice(config)` VERBATIM. Nothing here composes a
 * sentence of its own, and nothing here should: two spellings of one
 * disclosure drift apart, which is the same failure — a fact worded in one
 * place and not carried to another — that this check exists to end. That
 * function also names the KEY, which is what makes this a disclosure rather
 * than an alarm: "some key was skipped" tells the reader nothing they can act
 * on, and a test asserting merely that output is non-empty would pass on it.
 *
 * **`warn`, and the argument, because both neighbours are defensible.**
 *
 *  - **Not `error`.** An `error` fails this command's exit code (`doctor.ts` ·
 *    `export function exitCode(` · ~58), and nothing here is broken: the
 *    config PARSED, every key this build understands is in force, and the
 *    corpus is healthy. The skip is also deliberate forward compatibility — a
 *    config written for a newer my_context is MEANT to load on this one — so
 *    `error` would turn a perfectly correct file red and fail CI on the day
 *    somebody runs an older build. That is the same line the `warn`/`error`
 *    split was already drawn on for `dead_scope`: worth surfacing, must not
 *    break someone's CI. Disclosure is what this task asked for; enforcement
 *    is not, and an unknown key is deliberately not a hard refusal.
 *  - **Not `info`.** `info` in this file is the level for a fact that is the
 *    feature working — `checkAuditSize`: *"a large audit log in a busy project
 *    is the feature working."* A skipped key is the opposite. Whatever the
 *    user wrote there is NOT in force, and under the misspelling reading —
 *    the likelier one at a terminal, where the file is hand-edited — their
 *    intent was discarded without their knowing. A fact that means a setting
 *    silently does not apply outranks a note, and at `--summary` the note
 *    count is the one a reader skims past.
 *
 * `warn` is therefore what is left, and it is the right shape rather than
 * merely the residue: counted in the summary line at every detail level,
 * printed with its key at the default and `--full` levels, and never the
 * reason a build goes red.
 *
 * **One finding, not one per key.** `skippedKeyNotice` names every skipped key
 * in a single sentence; emitting it per key would print that same sentence N
 * times over. (`read-model-config.ts` maps it per key instead because its
 * consumer is a table with a `where` column — a different shape, same words.)
 */
export function checkSkippedConfigKeys(config: Config): Finding[] {
  const notice = skippedKeyNotice(config);
  if (notice === '') return [];
  return [{ level: 'warn', code: 'config_key_skipped', message: notice }];
}

/**
 * **The growth check the revision log never got.**
 *
 * `.my_context/.revisions/` shipped in Phase 1 with no compaction and no
 * `doctor` check at all, and the phase review recorded that as an undisclosed
 * liability. The audit log is written on every tool call, so the same silence
 * would be worse here.
 *
 * What it reports, and what it deliberately does not do:
 *
 *  - Rotation bounds the size of any ONE segment (`AUDIT_MAX_BYTES`), so the
 *    read path never has to parse an unbounded file. It does NOT delete
 *    anything: rotation renames, and every record ever written is still on
 *    disk. Total growth is therefore unbounded, and this finding is where that
 *    is disclosed rather than left to be discovered.
 *  - Nothing here removes a segment, and nothing ever will. Deleting audit
 *    records is a decision for the person being audited, not for the thing
 *    doing the auditing — so the finding names the files and says they are the
 *    user's to archive, and stops there.
 *
 * `info`, not `warn`: a large audit log in a busy project is the feature
 * working. `doctor`'s exit code is driven by errors, and a correctly-behaving
 * project must not go red for having a history.
 */
export function checkAuditSize(root: string): Finding[] {
  const { files, bytes } = auditSize(root);
  if (bytes < AUDIT_REPORT_BYTES) return [];
  const rotated = files.length - 1;
  return [{
    level: 'info', code: 'audit_log_size',
    message:
      `the run-time audit log is ${(bytes / 1024 / 1024).toFixed(1)} MiB across ` +
      `${files.length} file(s) under ${auditDir(root)}. Nothing is wrong: the live log ` +
      `rotates at ${(AUDIT_MAX_BYTES / 1024 / 1024).toFixed(0)} MiB so no single file grows ` +
      `without bound, and my_context never deletes a rotated segment — which is why the TOTAL ` +
      `keeps growing. ${rotated === 0 ? 'There are no rotated segments yet' : `The ${rotated} ` +
      `rotated segment(s) are yours to archive or delete`}; removing one removes that stretch ` +
      `of history for good, and no command will do it for you. \`audit.db\` beside them is a ` +
      `derived query index and is always safe to delete — it rebuilds on the next ` +
      `\`mycontext audit\`. See \`mycontext audit --files\`.`,
  }];
}

/**
 * The low edge of the fallback mitigation band (~5–10k, never-miss design
 * §6 risk 3). 5,000 is the largest size the warm-cache fallback was priced
 * at (597.7 ms, design measurement M1) and half the measured cold-cache
 * ceiling (9,903 ms at 10,000 items, review probe R5).
 */
export const FALLBACK_CEILING_WARN_ITEMS = 5000;

/**
 * `warn`, not `error`: the corpus works today; what shrinks is the margin on
 * a CONDITIONAL guarantee, and the condition is stated in the same sentence
 * as the claim (STD-guarantee-claims-carry-their-condition-in-the-same-sentence).
 */
export function checkCorpusSize(items: Item[]): Finding[] {
  if (items.length < FALLBACK_CEILING_WARN_ITEMS) return [];
  return [{
    level: 'warn', code: 'corpus_size_fallback_ceiling',
    message:
      `the corpus holds ${items.length} items. my_context's never-miss injection guarantee is ` +
      `conditional on corpus size: when the index is unavailable, hooks serve the injection ` +
      `straight from the Markdown, and that fallback was measured at 9,903 ms for 10,000 items ` +
      `on a cold file cache (review probe R5, 2026-08-16, this class of machine) against the ` +
      `10 s hook kill — and cold cache is the first run after a reboot, exactly when the ` +
      `fallback fires. Past ~10,000 items a fallback-served injection can be killed and ` +
      `degrades to a disclosed miss. \`mycontext decay\` is the lever for retiring unused ` +
      `items; splitting the corpus across layers does not help (both layers are parsed).`,
  }];
}

/**
 * **A field and the tag projected from it, disagreeing — the defect this
 * check's absence let run for the life of the corpus.**
 *
 * Measured on 2026-08-23 over this project's own items with the real parser:
 * 293 `task` items, all 293 carrying a `state:` TAG, 213 also carrying a
 * `state` FIELD, and fifteen of those disagreeing — `done` as a tag against
 * `todo`, `doing` or `blocked` as a field. Nothing synced them and, until this
 * function, nothing looked: no code anywhere read the `plan:`/`seq:`/`state:`
 * prefixes at all, so a `state:donee` typo removed a task from every progress
 * view and no gate noticed. The corpus was clean by discipline, not by
 * enforcement, and fifteen items are what discipline missed.
 *
 * `projectionMismatch` (core/tag-projection.ts) owns the classification, not
 * this file: `doctor`, the seq-19 migration and any future caller have to read
 * the same corpus the same way, and a second hand-written predicate here is how
 * two readings of one rule come to disagree — which is the very failure being
 * reported.
 *
 * **Two codes, not one, because a doctor code carries exactly one level.** The
 * grouped report prints `bucket[0].level` as the heading for the whole group
 * (doctor.ts), so a code with mixed levels would label its own findings wrong.
 *
 *  - `tag_projection_drift` is an **error**: the index gives a WRONG answer.
 *    A stale, duplicated, absent or out-of-vocabulary projection means
 *    `mycontext focus state:todo` and `search --tag state:todo` return a set
 *    that is not the set of items whose `state` is `todo` — silently, and in
 *    both directions. Unlike a dead scope glob, nothing here is cosmetic and
 *    nothing is a false alarm on the day someone renames a directory.
 *  - `tag_projection_unprojected` is **info**: a projected tag with no field
 *    behind it. Nothing is wrong with the filtering — the tag is there and
 *    resolves — the value simply lives only in the index and has not been
 *    adopted into the field that can hold it. That is the ordinary state of
 *    every item captured before a projection was declared (eighty `task` items
 *    here on the day this shipped), and turning a whole corpus red for not yet
 *    having been migrated would make the exit code useless on the one day it
 *    matters. The migration is plan:categories seq 19; this is its worklist.
 */
export function checkTagProjection(items: Item[], config: Config): Finding[] {
  return projectionMismatches(items, config).map((m) => {
    const { field, prefix, command, values } = m.projection;
    const tag = m.tagValues.map((v) => `"${prefix}:${v}"`).join(', ');
    const vocabulary = values === undefined ? '' : ` Declared values: ${values.join(', ')}.`;
    const fix =
      ` The field is the store and the tag is the index generated from it, so the fix is to ` +
      `set the field and let my_context rewrite the tag: \`${command}\`. Do not edit the tag ` +
      `by hand — update is not a legal operation on a tag, and a remove-then-add done by a ` +
      `person is exactly how this item got here.`;

    if (m.kind === 'unprojected') {
      return {
        level: 'info' as const, code: 'tag_projection_unprojected', item: m.itemId,
        message:
          `carries the projected tag ${tag} but no "${field}" field, so the value lives only in ` +
          `the index. Filtering is unaffected — the tag is there and \`mycontext focus ` +
          `${prefix}:${m.tagValues[0]}\` still finds this item — but nothing can UPDATE it: a ` +
          `tag is a membership, and changing one by hand is a remove plus an add that can ` +
          `half-fail. Adopting the value into the field makes the tag generated from then on.` +
          `${vocabulary}`,
      };
    }

    const said =
      m.kind === 'duplicate'
        ? `carries ${m.tagValues.length} tags under "${prefix}:" — ${tag} — where a projection ` +
          `permits exactly one. That is the silent third membership a hand-written ` +
          `remove-then-add produces: this item is now returned by two different ` +
          `\`--tag ${prefix}:…\` filters at once, and its "${field}" field says ` +
          `${m.field === null ? 'nothing at all' : `"${m.field}"`}.`
        : m.kind === 'absent'
          ? `has "${field}": "${m.field}" and no "${prefix}:" tag projected from it, so it is ` +
            `invisible to \`mycontext focus ${prefix}:${m.field}\`, to ` +
            `\`search --tag ${prefix}:${m.field}\` and to every progress view that groups by ` +
            `"${field}" — the field is right and the item is in no answer.`
          : m.kind === 'unknown_value'
            ? `carries a "${field}" value outside the declared vocabulary — field ` +
              `${m.field === null ? '(absent)' : `"${m.field}"`}, tag ${tag || '(none)'}. This ` +
              `is the \`${prefix}:donee\` case: a value nothing reads back, filed under a group ` +
              `no filter names, removing the item from every view that groups by "${field}".` +
              `${vocabulary}`
            : `says "${field}": "${m.field}" in its field and ${tag} in its tag. The two ` +
              `disagree, so one of \`--tag ${prefix}:${m.field}\` and \`--tag ${tag.replace(/"/g, '')}\` ` +
              `returns this item wrongly and the other misses it. Nothing syncs them by hand.`;

    return {
      level: 'error' as const, code: 'tag_projection_drift', item: m.itemId,
      message: `${said}${fix}`,
    };
  });
}

/**
 * How to set `needs` on this item, in the spelling that actually works TODAY.
 *
 * Two spellings, because there are two states of the world and printing the
 * wrong one costs a reader an attempt at a command that is refused by name.
 * `--extra needs=…` reaches `unknownExtraFieldError` (core/trust.ts) and is
 * refused unless the item's own category DECLARES the field, so the remedy is
 * read off the resolved config rather than assumed — the same reason
 * `cmdTodo` looks its tier up instead of asserting one.
 */
function needsRemedy(config: Config, item: Item): string {
  const declared = Object.hasOwn(config.categories, item.type)
    && config.categories[item.type].extraFields.includes(NEEDS_FIELD);
  return declared
    ? `Set it: \`mycontext edit ${item.id} --extra ${NEEDS_FIELD}="plan/seq, plan/seq"\`.`
    : `"${NEEDS_FIELD}" is not yet declared by "${item.type}" in this project, so ` +
      `\`--extra ${NEEDS_FIELD}=…\` is refused by name. Add "${NEEDS_FIELD}" to ` +
      `categories.${item.type}.extraFields in .my_context/config.json — that list ADDS to what ` +
      `the category already declares, so nothing it has now is lost — and the command above ` +
      `starts working.`;
}

/**
 * **`needs`: a blocker with no target, and a blocker that has already
 * cleared.**
 *
 * This is the check that turns `needs` from documentation into a gate, and it
 * exists because of one measured incident rather than a theory. `plan:walk
 * seq:8` carried the sentence "Blocked on plan:walk seq:7". `seq:7` landed and
 * went green. `seq:8` stayed at `state: blocked` until a human drawing a
 * progress table noticed by hand — and two further tasks, `plan:port seq:6`
 * and `plan:walk seq:14`, were freed by the same landing with nothing
 * announcing either. Nothing could have noticed, because `state: blocked` was
 * a flag with no target: five tasks said they were blocked and not one said by
 * what.
 *
 * Four findings, and the split between them is the point:
 *
 *  - **`blocked_needs_met`** — `state: blocked`, every reference satisfied.
 *    The `seq:8` case, and the one that pays for the field. `warn`.
 *  - **`blocked_without_needs`** — `state: blocked`, nothing named. The state
 *    that made `seq:8` invisible. `warn`.
 *  - **`needs_malformed`** — an entry that is not `plan/seq`. `warn`, because
 *    the author said something is holding this task and nothing can read it.
 *  - **`needs_unresolved`** — well-shaped, and nothing answers to it. `info`,
 *    deliberately and by ruling: plans are written before the tasks in them
 *    are, so a forward reference is LEGITIMATE and stays legitimate. Refusing
 *    one would make the field unusable exactly when it is most useful, and the
 *    regex that produced `the/45` out of the middle of a sentence is the
 *    evidence that a machine cannot tell a forward reference from a typo.
 *
 * None is an `error`, so none moves `doctor`'s exit code. A stale blocker is a
 * planning fact about people, not a corrupt corpus, and failing someone's CI
 * over the ordering of their work would be the "must not break someone's CI on
 * the day they rename a directory" line drawn one column over.
 *
 * `STD-the-progress-table-has-one-format-and-this-is-it` already makes
 * reconciling states a human obligation before counting, and names what it
 * prevents: a table drawn over stale states is "precise about the wrong
 * corpus, and precise in the flattering direction." A cleared-but-unmoved
 * blocker is that same failure in the other column. This check is the part of
 * that obligation a machine can carry.
 */
export function checkTaskNeeds(items: Item[], config: Config): Finding[] {
  const findings: Finding[] = [];
  const index = buildTaskIndex(items, config);

  for (const item of workItems(items, config)) {
    const reading = readNeeds(item, index);

    if (reading.malformed.length > 0) {
      findings.push({
        level: 'warn', code: 'needs_malformed', item: item.id,
        message:
          `declares "${NEEDS_FIELD}" entries that are not \`plan/seq\` references — ` +
          `${reading.malformed.map((m) => JSON.stringify(m)).join(', ')} — so nothing reads them ` +
          `back and this task's dependency on whatever they meant is invisible to ` +
          `\`mycontext ready\` and to this check. The field is a comma-separated list of ` +
          `\`plan/seq\`, lowercase, e.g. "walk/7, port/6". Whether the reference EXISTS is not ` +
          `checked and is not an error; only its shape is.`,
      });
    }

    if (reading.unresolved.length > 0) {
      findings.push({
        level: 'info', code: 'needs_unresolved', item: item.id,
        message:
          `waits on ${reading.unresolved.join(', ')}, which no task in this corpus answers to. ` +
          `That is NOT a defect on its own: plans are routinely written before the tasks in them ` +
          `exist, and a forward reference is how a dependency gets recorded at the moment it is ` +
          `known. It is reported because the other reading is a typo — a plan name that never ` +
          `existed, or a sequence that moved — and only a person can tell the two apart. ` +
          `Nothing is hidden by it: a task holding an unresolved reference is listed as held ` +
          `rather than ready, with this reason.`,
      });
    }

    if (reading.state !== BLOCKED_STATE) continue;

    if (reading.satisfied.length + reading.pending.length + reading.unresolved.length === 0
      && reading.malformed.length === 0) {
      findings.push({
        level: 'warn', code: 'blocked_without_needs', item: item.id,
        message:
          `is at state "${BLOCKED_STATE}" and names nothing in "${NEEDS_FIELD}", so it is a ` +
          `blocker with no target: nothing can say what would free it, and nothing will notice ` +
          `when that thing lands. This is the state that let a task sit blocked for days after ` +
          `its blocker had shipped. If the blocker is another task, name it. If it is a person, ` +
          `a decision or an answer rather than a task, this field cannot hold it — say so in the ` +
          `body and leave the state honest. ${needsRemedy(config, item)}`,
      });
      continue;
    }

    if (reading.pending.length === 0 && reading.unresolved.length === 0
      && reading.malformed.length === 0 && reading.satisfied.length > 0) {
      findings.push({
        level: 'warn', code: 'blocked_needs_met', item: item.id,
        message:
          `is at state "${BLOCKED_STATE}", and everything it waits on has landed: ` +
          `${reading.satisfied.join(', ')} ${reading.satisfied.length === 1 ? 'is' : 'are'} done. ` +
          `It should have moved and did not. Nothing here changes the state — a task's state is ` +
          `the owner's to set — so confirm the ground is finished ground and then ` +
          `\`mycontext edit ${item.id} --extra state=todo\`. Until it moves, every count of ` +
          `blocked work overstates the trouble this project is in, which is the same defect as a ` +
          `stale "todo" understating its progress.`,
      });
    }
  }

  return findings;
}

/**
 * **A second `.my_context` below this one, which would shadow it.**
 *
 * `findProjectRoot` walks UP from the session's working directory and stops at
 * the FIRST `.my_context` it finds. So a corpus nested inside the repository
 * captures every session started at or below it — silently, and with a
 * different corpus than the one the repository is about.
 *
 * **This project is its own example.** `my-context/.my_context` holds 44 items
 * and ZERO tasks, on a different category set (`adr`, `invariant`, `non_goal`);
 * the repository root holds 510 items and 361 tasks. A session started one
 * directory in gets the small one and a board that looks empty.
 *
 * **It is `info`, not a defect.** A nested workspace is a legitimate thing —
 * a plugin that carries its own design corpus, a fixture, a vendored project —
 * and the notice exists so a reader learns it HERE rather than from a surprise,
 * which is the register `foreign_store` is drawn in for the same reason.
 *
 * Written on 2026-08-26, the day a session spent nine days outside the
 * workspace with nothing on any surface reporting it. That failure was a cwd
 * ABOVE the corpus; this is the same failure with the cwd BELOW it, and it is
 * the one variant the fixes that day do not cover: resolving from the file
 * still finds the nearest root, and the nearest root is the nested one.
 *
 * The walk is bounded the way every other scan here is — `SKIP_DIRS` minus
 * `.my_context` itself, since that is precisely what is being looked for.
 */
export function checkNestedCorpus(root: string, repoRoot: string): Finding[] {
  // `SKIP_DIRS` minus `.my_context` itself — that is what is being looked for —
  // plus the places a corpus is a FIXTURE rather than somewhere anyone works.
  // Measured on this repository the first time it ran: four hits, of which one
  // was the real hazard (`my-context/.my_context`, 44 items and no tasks) and
  // three were a test fixture, a generated demo corpus and a harness scratch
  // directory. A check whose true positives are outnumbered three to one is a
  // check people learn to scroll past, which is worse than not having it.
  const FIXTURE_DIRS = ['test', 'tests', 'fixtures', 'harness', '.scratch', '.demo-corpus'];
  const skip = new Set([
    ...[...SKIP_DIRS].filter((d) => d !== '.my_context'),
    ...FIXTURE_DIRS,
  ]);
  const found: string[] = [];
  const walk = (dir: string, depth: number): void => {
    if (depth > 4 || found.length >= 8) return;
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return; // unreadable is not this check's problem
    }
    for (const name of entries) {
      if (skip.has(name)) continue;
      const full = path.join(dir, name);
      try {
        if (!statSync(full).isDirectory()) continue;
      } catch {
        continue;
      }
      if (name === '.my_context') {
        // The workspace's own root is the thing every session is meant to
        // find. Only a DIFFERENT one shadows it.
        if (path.resolve(full) !== path.resolve(root)) found.push(relPosix(repoRoot, full));
        continue; // never descend into a corpus
      }
      walk(full, depth + 1);
    }
  };
  walk(repoRoot, 0);

  return found.sort().map((where) => ({
    level: 'info' as const,
    code: 'nested_corpus',
    message:
      `a second corpus is nested at "${where}". \`findProjectRoot\` stops at the FIRST ` +
      '`.my_context` above the working directory, so any session started at or below that path ' +
      'gets THAT corpus instead of this one — a different board, silently. Nothing is wrong with ' +
      'it existing; start sessions at the repository root, or cd out of it before you do.',
  }));
}

/**
 * Directories inside the repository where ANOTHER tool keeps durable knowledge
 * of the same kind my_context keeps. One entry today; a second is one line.
 *
 * `docs/solutions/` is the compound-engineering plugin's learnings store — a
 * directory of Markdown files, written by an agent when it finishes a problem,
 * describing what must hold next time. That is a `lesson` by any other name,
 * spelled differently and with no ids either side can resolve.
 *
 * The list is HARD-CODED and repository-relative on purpose. The alternative
 * shapes were weighed in
 * `open_question/OPENQ-where-may-foreign-store-look-given-it-reads-outside-the.md`:
 * a configured list is honest and needs someone to write it, and a filesystem
 * scan is thorough and is the one that surprises people. A short named list
 * goes stale, which is a cost paid by editing one line here.
 */
const FOREIGN_STORE_DIRS = ['docs/solutions'];

/**
 * **Another tool is keeping durable learnings inside this repository.**
 *
 * my_context exists to be the place durable knowledge lives. A second store in
 * the same tree quietly defeats that: the learnings written there are real,
 * they are the same KIND as a `lesson`, and my_context will never inject one of
 * them — not because anything failed, but because it does not know they exist.
 *
 * **It is `info`, the same register as `checkNestedCorpus` above and for the
 * same reason.** Two knowledge stores in one repository is a legitimate state —
 * two plugins installed, each doing its own job — so this is a fact to learn
 * HERE rather than from a surprise, not a defect to fix. `info` informs and
 * does not nag, which is why `decision/DEC-foreign-store-becomes-a-real-check-at-notice-level.md`
 * put it at notice level in the design.
 *
 * **What this check deliberately does NOT do: leave the repository.** The
 * mockup's notice card draws TWO `foreign_store` rows, and the second one names
 * `~/.gsd/knowledge/` — a path in the user's HOME directory. The owner dropped
 * that row on 2026-08-26: it was a guess at one specific other plugin, no
 * requirement or incident sits behind it, and a diagnostic that reads a home
 * directory is a different KIND of thing from one that reads `.my_context/` —
 * it can be slow, and on a shared machine it can see paths that are not the
 * user's business. With that row gone this check never reads outside the
 * repository, which DISSOLVES the open question rather than answering it, and
 * means `test/core/real-home-guard.test.ts` has nothing here to guard against.
 *
 * The read is a single `statSync` per named directory rather than the bounded
 * walk `checkNestedCorpus` needs — the paths are known, so there is nothing to
 * search for.
 */
export function checkForeignStore(repoRoot: string): Finding[] {
  const findings: Finding[] = [];
  for (const where of FOREIGN_STORE_DIRS) {
    // `FOREIGN_STORE_DIRS` is written POSIX and reported POSIX; only the join
    // is native, per INV-posix-normalized-paths — a backslash must never reach
    // a message a reader is meant to paste back at a shell.
    const full = path.join(repoRoot, ...where.split('/'));
    try {
      if (!statSync(full).isDirectory()) continue;
    } catch {
      continue; // absent, or unreadable — either way there is nothing to report
    }
    findings.push({
      level: 'info' as const,
      code: 'foreign_store',
      message:
        `another plugin writes durable learnings in "${where}/" inside this repository — the ` +
        'same KIND of knowledge as a `lesson`, in a second spelling, with no ids either store ' +
        'can resolve in the other. my_context never reads that directory and never writes to ' +
        'it: nothing there is indexed, and nothing there is ever injected into a session. It ' +
        'is reported so you learn it HERE rather than from a surprise — what is written there ' +
        'is knowledge this tool will not carry for you.',
    });
  }
  return findings;
}

/**
 * **The word every documented command begins with, checked against what this
 * machine's shell would actually do with it.**
 *
 * `package.json` names `mycontext` as this project's `bin`, and from that one
 * fact every README, the skill, and all 24 UI palette entries treat the word
 * as something a shell can run — 262 documented invocations of it, by the
 * count in `KNOWN-every-command-the-product-tells-a-user-to-run-begins-with-a`.
 * That was false on the owner's own machine for the whole life of this
 * project: the package was never linked, so `mycontext` resolved to nothing,
 * and nothing anywhere said so. It was found by a person typing one and
 * reading `command not found`. This check exists so the NEXT machine where
 * that is true hears it from `doctor`, not from a failed command.
 *
 * There are three answers, not two, and they are not the same finding:
 *
 *  - **Resolves to this workspace's own CLI.** Healthy — the word runs the
 *    code sitting in this checkout, exactly as every doc assumes. No finding,
 *    the same silence `checkDeadScopes` and `checkIndexFreshness` return on a
 *    clean corpus.
 *  - **Does not resolve at all.** Loud and self-evident — the same
 *    `command not found` the owner hit — so every documented command is
 *    wrong, but a person finds out on the first one they try. `warn`: nothing
 *    about the CORPUS is broken, and CI commonly runs this very command via
 *    `node src/cli/index.ts doctor` without ever linking `mycontext` onto
 *    PATH at all — making this `error` would fail a healthy corpus on an
 *    unrelated environment fact, the same reasoning `index_not_ignored` and
 *    `corpus_size_fallback_ceiling` are `warn` rather than `error` for.
 *  - **Resolves to something else** — a different checkout, a different
 *    version, or a stale link left over from one. `error`, and the one this
 *    check exists to catch: `src/ui/execute.ts`'s `CLI_ENTRY` comment names
 *    exactly this as "the case that matters — not this project at all", and
 *    it is SILENT. A person runs `mycontext review` believing it reads this
 *    corpus and it reads a different one, with nothing on screen to say so —
 *    the same shape of harm `tag_projection_drift` is `error` for: not a
 *    corpus defect, but a WRONG ANSWER given with no error attached. Reported
 *    as healthy, this would be worse than not having the check at all.
 *
 * A fourth outcome — **cannot tell** — is not a defect either, and must never
 * be silence or a crash (`runChecks`'s own `check_failed` catch-all exists
 * for exactly the failure mode of a check finding out the hard way). It fires
 * when the platform's own lookup tool can't be run at all, or when something
 * resolves on PATH but doctor cannot see through it to a target — `info`,
 * the same register `index_missing` uses for "this cannot be answered right
 * now", not for "something is wrong".
 *
 * **Why the platform's own lookup, not a hand-rolled `PATH` walk:** a
 * reimplementation can disagree with the shell asking the same question —
 * different rules for extensions, different rules for which directory wins a
 * tie — and a disagreement there is indistinguishable from a bug in this
 * check. `where` (Windows) and `which -a` (POSIX) are what `cmd.exe`,
 * PowerShell and a POSIX shell are themselves built on; this defers to them
 * rather than re-deriving their answer.
 *
 * **Resolving a shim to what it actually runs — the part that only exists on
 * Windows.** On POSIX, `mycontext` on PATH can be a real symlink straight to
 * `src/cli/index.ts`, and `realpathSync` alone resolves it. On Windows the
 * target is never the file itself: `npm link` writes a `.cmd` (and a `.ps1`,
 * and a POSIX-shaped shell script for Git Bash) that WRAPS `node` and a
 * relative path — verified by reading this machine's own linked shim, which
 * launches `node "%dp0%\node_modules\mycontext\src\cli\index.ts" %*`.
 * `realpathSync` cannot see through that text to the file it names, so this
 * reads the shim itself and pulls out the `node_modules/<pkg>/<path>`
 * segment every npm-generated shim embeds (the `.cmd`, `.ps1`, and POSIX
 * templates all carry it, in that literal shape, regardless of npm version),
 * resolves it relative to the shim's own directory, and `realpathSync`s the
 * result — which is also what collapses the `npm link` symlink at
 * `node_modules/mycontext` back to this checkout, the same symlink verified
 * by hand while building this check (`node_modules/mycontext -> …/my-context`).
 *
 * **What this cannot establish:** a candidate too large to be a text shim
 * (`SHIM_MAX_BYTES`, comfortably above every real npm-generated shim's
 * actual size) or one that has vanished between the platform lookup
 * reporting it and this check reading it is reported as "found, target
 * unverifiable", never guessed at as either healthy or a mismatch — this
 * check trades "some candidates are opaque to it" for "never asserts a fact
 * about a target it never actually looked at". A SMALL file with no
 * `node_modules/…` marker in it (an unrelated program small enough to read,
 * or a genuine POSIX symlink straight to a CLI file with no wrapper at all)
 * is instead compared BY PATH directly — its own resolved location either
 * matches this checkout's CLI or it does not, and either answer is a real
 * fact about a real file this check actually read, not a guess.
 */

/** The `bin` name `package.json` declares — see the module comment above. */
export const CLI_BIN_NAME = 'mycontext';

/**
 * This checkout's own CLI entry, resolved from THIS FILE rather than looked
 * up — the same non-negotiable `src/ui/execute.ts` states for its own
 * `CLI_ENTRY`: "Never a `mycontext` found on PATH: what is on PATH is
 * whatever the user last installed... Resolved from `import.meta.url` so it
 * moves with the file and cannot drift into a string somebody has to
 * remember to update." `checks.ts` lives one level deeper than `execute.ts`
 * does (`src/doctor/` vs `src/ui/`), and the relative path is identical
 * either way — both are one `..` below `src/`.
 */
const OWN_CLI_ENTRY = fileURLToPath(new URL('../cli/index.ts', import.meta.url));

/** Longest shim `readShimTarget` will read whole. Every shim actually seen —
 * npm's `.cmd`, `.ps1`, and POSIX templates — is a few hundred bytes; a
 * `mycontext` on PATH bigger than this is almost certainly a compiled binary,
 * not a text wrapper, and reading it in full would be pure waste. */
const SHIM_MAX_BYTES = 8_192;

/**
 * Resolves `candidate` (a path `defaultCliLookup` returned) as far toward its
 * real target as this check can establish, in two steps:
 *
 *  1. `realpathSync` — resolves ordinary symlinks, which is the whole answer
 *     on a POSIX box where `mycontext` links straight to the CLI file.
 *  2. If step 1 didn't land on something ending in the CLI's own basename,
 *     the result is read as TEXT and searched for an embedded
 *     `node_modules/<pkg>/<path>` segment — the shape every npm-generated
 *     shim (`.cmd`, `.ps1`, POSIX) carries, verified against this machine's
 *     own linked shim while this check was built. Found, it is resolved
 *     relative to the shim's own directory and `realpathSync`d in turn,
 *     which is also what collapses an `npm link` symlink sitting inside
 *     `node_modules`.
 *
 * Returns `null` when neither step lands on a readable target — a candidate
 * that IS on PATH but that this cannot see through, reported by the caller as
 * "found, but unverifiable" rather than guessed at either way.
 */
export function readShimTarget(
  candidate: string,
  readFile: (p: string, enc: 'utf8') => string = (p, enc) => readFileSync(p, enc),
  realpath: (p: string) => string = realpathSync,
): string | null {
  let real: string;
  try {
    real = realpath(candidate);
  } catch {
    real = candidate;
  }

  let size = 0;
  try {
    size = statSync(real).size;
  } catch {
    return null; // the candidate does not exist to be read — nothing to resolve
  }
  if (size > SHIM_MAX_BYTES) return null; // almost certainly a binary, not a text shim

  let text: string;
  try {
    text = readFile(real, 'utf8');
  } catch {
    return null;
  }

  const at = text.search(/node_modules[\\/]/);
  if (at === -1) return real; // not a wrapper shape — `real` itself is the answer

  const rest = text.slice(at);
  const stop = rest.search(/["'\r\n]/);
  const segment = (stop === -1 ? rest : rest.slice(0, stop)).trim();
  if (!segment) return real;

  const parts = segment.split(/[\\/]/).filter(Boolean);
  const absolute = path.join(path.dirname(real), ...parts);
  try {
    return realpath(absolute);
  } catch {
    return absolute; // could not confirm it exists; still the best available answer
  }
}

/** What the platform's own lookup reports for `name`: every path on PATH a
 * shell could resolve it to, in the order the platform itself returns them.
 * Injected by `checkCliOnPath`'s caller in tests so no test has to touch the
 * real `PATH` environment variable to exercise this check. */
export type CliLookup = (name: string) => string[];

/**
 * The real lookup: `where` on Windows, `which -a` on POSIX — see the module
 * comment on why a platform tool rather than a hand-rolled `PATH` walk. A
 * nonzero exit with no output is a normal, DETERMINATE "not found" (both
 * tools do this) and is returned as `[]`, not thrown. Only `result.error` —
 * the lookup tool itself could not be started at all — is thrown, so the
 * caller can tell "asked and the answer is no" apart from "could not ask".
 */
export function defaultCliLookup(name: string): string[] {
  const result = process.platform === 'win32'
    ? spawnSync('where', [name], { encoding: 'utf8', windowsHide: true })
    : spawnSync('which', ['-a', name], { encoding: 'utf8' });
  if (result.error) throw result.error;
  return (result.stdout ?? '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
}

/** Windows paths are case-insensitive and `realpathSync` does not normalize
 * drive-letter casing; POSIX paths are compared verbatim. This is a native
 * filesystem-path comparison, not a stored corpus path, so it deliberately
 * does not go through `relPosix` (INV-posix-normalized-paths governs paths
 * that cross into the database or a glob match — this crosses into neither). */
function samePath(a: string, b: string): boolean {
  return process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
}

/** Walks up from `fromFile` looking for the nearest `package.json`, so the
 * "not on PATH" remedy can name the directory `npm link` should be run from
 * without assuming a fixed number of directories between the CLI entry and
 * the package root. Bounded the way every other walk in this file is; falls
 * back to `fromFile`'s own directory if none is found within the bound, which
 * only degrades the remedy's wording, never throws. */
function nearestPackageRoot(fromFile: string): string {
  let dir = path.dirname(fromFile);
  for (let i = 0; i < 6; i++) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.dirname(fromFile);
}

export function checkCliOnPath(
  ownCliEntry: string = OWN_CLI_ENTRY,
  lookup: CliLookup = defaultCliLookup,
): Finding[] {
  let candidates: string[];
  try {
    candidates = lookup(CLI_BIN_NAME);
  } catch (err) {
    return [{
      level: 'info', code: 'cli_lookup_failed',
      message:
        `could not determine whether \`${CLI_BIN_NAME}\` resolves on this machine's PATH: the ` +
        `platform lookup itself could not be run (${err instanceof Error ? err.message : String(err)}). ` +
        `This is a gap in what doctor could check, not a corpus problem — it means doctor cannot ` +
        `tell you whether the commands this project prints would actually run here.`,
    }];
  }

  if (candidates.length === 0) {
    const packageRoot = nearestPackageRoot(ownCliEntry);
    return [{
      level: 'warn', code: 'cli_not_on_path',
      message:
        `\`${CLI_BIN_NAME}\` — the word every documented command in this project's READMEs and ` +
        `skill begins with, and what every UI palette entry composes — does not resolve on this ` +
        `machine's PATH. Exactly as typed, every one of those commands, and the UI's Copy button, ` +
        `would fail with "command not found". Run \`npm link\` from ${packageRoot} to provide it, ` +
        `or use \`node ${ownCliEntry} <args>\` until then — the fallback the README already documents.`,
    }];
  }

  const ownReal = (() => {
    try { return realpathSync(ownCliEntry); } catch { return ownCliEntry; }
  })();

  // Every candidate ends up in exactly one of three buckets: `matched` (its
  // target IS this checkout), `mismatch` (readable, and a DIFFERENT target —
  // the worst state, so its presence short-circuits below regardless of
  // what any other candidate said), or neither, which can only mean
  // `readShimTarget` returned `null` for every one of them — "found on
  // PATH, target unverifiable" is exactly that leftover case, not a third
  // flag tracked alongside these two.
  let matched = false;
  let mismatch: { candidate: string; target: string } | undefined;

  for (const candidate of candidates) {
    const target = readShimTarget(candidate);
    if (target === null) continue;
    if (samePath(target, ownReal)) matched = true;
    else mismatch ??= { candidate, target };
  }

  if (mismatch) {
    return [{
      level: 'error', code: 'cli_path_mismatch',
      message:
        `\`${CLI_BIN_NAME}\` on this machine's PATH — "${mismatch.candidate}" — resolves to ` +
        `"${mismatch.target}", NOT this workspace's own CLI ("${ownReal}"). This is worse than ` +
        `not resolving at all: every documented command a person runs as \`${CLI_BIN_NAME} …\` ` +
        `silently drives a DIFFERENT checkout or version, with nothing on screen to say so. Run ` +
        `\`npm link\` from ${nearestPackageRoot(ownCliEntry)} to point it back at this checkout, ` +
        `after confirming what the other target is and that overwriting its link is intended.`,
    }];
  }

  if (matched) return [];

  return [{
    level: 'info', code: 'cli_path_unverifiable',
    message:
      `\`${CLI_BIN_NAME}\` resolves on PATH to ${candidates.map((c) => `"${c}"`).join(', ')}, but ` +
      `doctor could not read through ${candidates.length === 1 ? 'it' : 'any of them'} to the CLI ` +
      `script it actually runs — not shaped like an npm-generated shim, and not a symlink to a ` +
      `readable target. It may be this workspace's own CLI behind a wrapper doctor does not ` +
      `recognize, or a completely different program; this check cannot tell which.`,
  }];
}

/**
 * `checkCliOnPath` deliberately is NOT one of the checks below, even though
 * it returns the same `Finding[]` shape every other one does — see its own
 * doc comment for the three-state, "resolves to something else is the worst
 * outcome" reasoning; this comment is only about why it is wired in
 * DIFFERENTLY from its dozen siblings.
 *
 * Every check below answers a question about the FILES in `root`/`repoRoot`
 * — the same corpus on every machine that clones it. `checkCliOnPath`
 * answers a question about THIS MACHINE'S PATH, which two clones of the
 * identical corpus can answer differently. Folding it into `findings` would
 * make `counts.warnings` — and the "N finding(s)" this project's own test
 * suite and its generated documentation assert is exactly the printed count
 * — depend on whether the box asking happens to have `npm link`ed this
 * package. That is precisely the silent, environment-dependent divergence
 * this check exists to catch; making the check ITSELF introduce it into
 * every existing "this fixture is clean" assertion would defeat it before
 * it shipped.
 *
 * `mycontext doctor` (`src/cli/commands/doctor.ts`) calls `checkCliOnPath`
 * directly, the same way it already calls `openMutateContext` for corpus
 * LOAD errors — a second category of thing this command reports and folds
 * into its exit code without folding into `findings`/`counts`, for the same
 * reason: a load error is not a property of the item that failed to load
 * either, it is a property of whether the file could be read at all. Every
 * OTHER caller of `runChecks` — `status`, and the UI's health widget in
 * `read-model.ts` — therefore never runs this check and never could, for
 * the same reason they never see corpus load errors flow through `findings`
 * either — that is `doctor`'s own reporting surface, not `runChecks`'s.
 */
/**
 * A body's last non-blank line, ending in a way that reads as cut off.
 *
 * Measured on this repository's own corpus before it was written: 655 of 656
 * non-empty bodies end with a full stop and the 656th with a `*`. Ending
 * mid-sentence, or on a colon whose list is not there, is therefore not a
 * style this corpus has — which is what makes it worth reporting at all, and
 * also exactly how little it proves. See `checkBodyTruncation`.
 */
const UNFINISHED_TAIL = /(?::|[^.!?)\]"'*_|\u00bb\u201d\u2019\u2026])$/u;

/**
 * **Text an item's file holds that no future write will keep — and bodies that
 * read as though that already happened.**
 *
 * Two findings, and the difference between them is the whole point.
 *
 * `body_truncation` is EXACT. `droppedBodyText` (core/item.ts) partitions the
 * file the way `parseItem` does and reports what falls out: a `## ` section
 * that is not a field of an item, the earlier of two same-named sections, a
 * second `# ` line, a line inside `## Observations`/`## Relations` that the
 * section's grammar does not match. Every one of those is deleted, silently,
 * by the next command that writes the item — `renderItem` writes back what was
 * parsed, and what was parsed is missing them. Nothing reported this before,
 * which is how two task bodies in this corpus lost roughly two-thirds of
 * themselves (3,918 -> 1,272 bytes and 5,507 -> 1,535) in a commit that
 * hand-edited them and then ran `mycontext repair`. `repair` now refuses those
 * items (cli/commands/repair.ts); this is where they are reported before
 * anybody runs it.
 *
 * `body_ends_unfinished` is a HEURISTIC, and is `info` for that reason. Once a
 * truncation has been written back, the file is internally consistent and its
 * checksum agrees with the shortened content — the deleted text leaves no
 * trace whatsoever. The only residue is prose that stops in the middle, so
 * that is what this looks for, and the message says plainly that a truncation
 * which happened to land after a full stop is invisible to it. A check that
 * implied otherwise would be the same failure this whole pair exists to fix.
 *
 * PROJECT items only, exactly as `needsRestamp` (repair.ts) is: `item.filePath`
 * is relative to its own layer's root, and `root` here is the project's.
 *
 * COST, measured rather than assumed: this is the only check that reads every
 * item file, and it has to — the loss is a property of the FILE, and the
 * parsed item in memory is precisely the thing with the text already missing.
 * Reading this repository's own 661 item files takes 23-27ms, which `doctor`
 * and `status` can afford; a corpus large enough for that to matter is one
 * `checkCorpusSize` is already complaining about.
 */
/**
 * A `file.ts:123` pointer in an item body, with or without backticks around it
 * and with or without a `-129` / `,95` tail. The file part is captured so it
 * can be checked against the repository before anything is reported.
 */
const BARE_POINTER = /`?([A-Za-z0-9_.\-/@]+\.(?:ts|js|mjs|cjs|md|json|html|css)):\d+(?:[-,]\d+)*`?/g;

/**
 * **A line number is not a citation, and this is the only place that says so
 * where the writing happens.**
 *
 * `scripts/verify-citations.ts` resolves citations BY FRAGMENT — a verbatim
 * quotation of the cited text, which survives a refactor moving it and fails
 * loudly when the text is rewritten. Its docblock records why it will never
 * learn `file:line` instead: a bare line number carries no fragment, so the
 * check can only prove the line EXISTS. Measured over this corpus on
 * 2026-08-29 that proved the line existed for 161 of 165 pointers while
 * proving nothing about what any of them said.
 *
 * That is why the gate does not walk `.my_context/`: **it walks what it can
 * resolve by fragment**, and a tree whose citations carry no fragment is out of
 * scope until they do. Normalising the corpus once would not keep it — agents
 * and the owner write `file:line` constantly, and the count comes back. So the
 * form is stated in the corpus (a `standard`, which is injected and therefore
 * read before the writing) and counted here, which is where a claim that the
 * writing changed can be checked instead of believed.
 *
 * **`info`, deliberately.** A bare pointer is not a defect in the project; it
 * is a citation that cannot be checked. It costs nothing until someone follows
 * it, so it is a note that stays visible and countable until the corpus is
 * converted, rather than a warning that makes `doctor` look broken over
 * prose.
 *
 * **One finding per ITEM, not per pointer**, and the file part must name a
 * file this repository actually has. Both are for the same reason: the fault
 * being reported is "this item's citations are unresolvable", which is one
 * fact per item — and a pointer whose file does not exist here is far more
 * often an EXAMPLE of the form (`file.ts:123`, written to describe it) than a
 * citation of anything. Reporting the example as the fault it documents is how
 * a check earns itself a permanent finding nobody can clear.
 */
export function checkCitationForm(repoRoot: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  const known = new Set<string>();
  for (const rel of listRepoFiles(repoRoot)) {
    known.add(rel);
    known.add(rel.slice(rel.lastIndexOf('/') + 1));
  }
  for (const item of items) {
    if (item.layer !== 'project') continue;
    const found: string[] = [];
    BARE_POINTER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = BARE_POINTER.exec(item.body)) !== null) {
      const cited = m[1]!;
      if (!known.has(cited) && !known.has(cited.slice(cited.lastIndexOf('/') + 1))) continue;
      found.push(m[0].replace(/`/g, ''));
    }
    if (found.length === 0) continue;
    const shown = found.slice(0, 3).join(', ');
    findings.push({
      level: 'info', code: 'citation_form', item: item.id,
      message:
        `${found.length} citation(s) point by line number and carry no fragment — ${shown}` +
        `${found.length > 3 ? ', …' : ''}. A line number proves only that the line exists; it ` +
        `cannot say whether the code it named is still there, and a plausible wrong number ` +
        `sends a reader somewhere real. Write the form \`verify:citations\` resolves instead: ` +
        `the cited file in backticks, then a middle dot, then a VERBATIM fragment of the cited ` +
        `text in backticks, then optionally a middle dot and a ~line hint. (It is not spelled ` +
        `out here: a real citation in this string would be read as one, and a mangled example ` +
        `is exactly what the gate exists to catch. \`scripts/verify-citations.ts\` opens with ` +
        `the form written properly.) The fragment is the identity and ` +
        `the ~line is a convenience allowed to be stale. Anchor on a KEY or an identifier, ` +
        `never on user-facing copy. Where the fragment itself contains backticks, use a ` +
        `double-backtick span, or the span ends early and the rest of the citation is read as ` +
        `prose. If the cited code is gone, say so — do not repoint to something plausible.`,
    });
  }
  return findings;
}

export function checkBodyTruncation(root: string, items: Item[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) {
    if (item.layer !== 'project') continue;

    let text: string | null = null;
    try {
      text = readFileSync(path.join(root, ...item.filePath.split('/')), 'utf8');
    } catch {
      // Unreadable is `loadLayer`'s report to make, not this check's.
      text = null;
    }
    const loss = text === null ? null : droppedBodyText(text);
    if (loss !== null) {
      findings.push({
        level: 'error', code: 'body_truncation', item: item.id,
        message:
          `${item.filePath} holds ${loss.lines} line(s) (${loss.bytes} bytes) that are not part ` +
          `of any field of an item, starting at ${JSON.stringify(loss.line)}. An item's body is ` +
          `the prose BEFORE its first "## " section, so the next command that writes this item — ` +
          `\`mycontext repair\`, or any \`mycontext edit\` — re-renders it WITHOUT that text and ` +
          `reports success, and nothing recovers it afterwards. Write the heading as bold ` +
          `("**Name**"), or move the content into "## Observations": both survive being read ` +
          `back. \`mycontext repair\` holds this item back until one of those is done.`,
      });
      // One finding per item: the exact report already names the first dropped
      // line, and adding a guess beside a measurement would only dilute it.
      continue;
    }

    const body = item.body.trim();
    if (body === '') continue;
    const lines = body.split('\n').filter((l) => l.trim() !== '');
    const last = lines[lines.length - 1]!.trimEnd();
    if (!UNFINISHED_TAIL.test(last)) continue;
    findings.push({
      level: 'info', code: 'body_ends_unfinished', item: item.id,
      message:
        `this item's body ends ${JSON.stringify(last.slice(-60))} — mid-sentence, or on a colon ` +
        `whose list is not there. That is what a body cut short at a "## " heading looks like ` +
        `once the cut has been written back to disk. It is a heuristic and nothing more: a ` +
        `performed truncation leaves no other trace (the file is self-consistent and its ` +
        `checksum agrees with the shortened text), and one that happened to land after a full ` +
        `stop leaves none at all. Compare the item against git history if the text reads ` +
        `unfinished; otherwise ignore this.`,
    });
  }
  return findings;
}

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[]; config: Config;
}): Finding[] {
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkBodyTruncation(opts.root, opts.items),
    () => checkCitationForm(opts.repoRoot, opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items, opts.config),
    () => checkScopePolicy(opts.items, opts.config),
    () => checkUnknownCategory(opts.items, opts.config),
    () => checkSkippedConfigKeys(opts.config),
    () => checkContinuity(opts.items, opts.config),
    () => checkPermissions(opts.root, accessSync, opts.repoRoot),
    () => checkSessionIdMismatch(opts.root),
    () => checkAuditSize(opts.root),
    () => checkCorpusSize(opts.items),
    () => checkTagProjection(opts.items, opts.config),
    () => checkTaskNeeds(opts.items, opts.config),
    () => checkNestedCorpus(opts.root, opts.repoRoot),
    () => checkForeignStore(opts.repoRoot),
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
