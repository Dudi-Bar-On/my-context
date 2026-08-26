import { accessSync, constants, existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { AUDIT_MAX_BYTES, AUDIT_REPORT_BYTES, auditDir, auditSize } from '../core/audit.ts';
import { scopePolicyFor, type Config } from '../core/config.ts';
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

export function runChecks(opts: {
  root: string; repoRoot: string; dbPath: string; items: Item[]; config: Config;
}): Finding[] {
  const checks: (() => Finding[])[] = [
    () => checkIndexFreshness(opts.root, opts.dbPath),
    () => checkOrphanRelations(opts.items),
    () => checkSourceDrift(opts.repoRoot, opts.items),
    () => checkDeadScopes(opts.repoRoot, opts.items, opts.config),
    () => checkScopePolicy(opts.items, opts.config),
    () => checkUnknownCategory(opts.items, opts.config),
    () => checkPermissions(opts.root, accessSync, opts.repoRoot),
    () => checkSessionIdMismatch(opts.root),
    () => checkAuditSize(opts.root),
    () => checkCorpusSize(opts.items),
    () => checkTagProjection(opts.items, opts.config),
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
