/**
 * The mutation harness: it commits nothing, and it refuses to run against a
 * tree that has anything uncommitted to lose.
 *
 * **Why this exists.** Mutation testing in this repository is done by editing a
 * source file to break a guard, running the test that should notice, and
 * putting the file back. The "putting it back" step has been done by hand with
 * `git checkout -- <file>` for the whole life of the project, and that command
 * restores the path from the index — it cannot tell a mutant from an
 * uncommitted fix sitting in the same file. Three separate agents lost work to
 * it, one of them a full pass of README edits; twice a probe was run against
 * this repository's own dogfooded corpus under `.my_context/`. Seven escapes by
 * the project's own count. "Commit before mutating" is in every brief and it
 * keeps failing, so it is written down here as a refusal instead of a rule.
 *
 * **What it actually guarantees**, stated narrowly:
 *
 * - It refuses to start if `git status --porcelain` reports any tracked change
 *   (untracked files are allowed through — nothing here writes to a path it was
 *   not given, so an untracked file is not at risk; a target that is itself
 *   untracked IS refused, because there would be no committed bytes to fall
 *   back to).
 * - It refuses to touch `.my_context/` or `.git/`.
 * - It restores from the bytes it read before mutating, held in memory and
 *   journalled to disk, and then VERIFIES with `git status` that the tree came
 *   back clean. `git checkout <HEAD> -- <path>` is the fallback if that
 *   verification fails, not the primary route.
 * - If the process is killed hard enough to skip both the `finally` and the
 *   signal handlers, the journal under the git directory survives, the next run
 *   refuses to start, and `--restore` puts the files back.
 *
 * It does NOT guarantee that the command you pass cannot itself write to your
 * tree. Nothing here sandboxes the command.
 *
 * Usage:
 *   node scripts/mutate.ts --file <path> --from <text> [--to <text>] [--all]
 *                          [--file ... --from ... --to ...]
 *                          -- <command> [args...]
 *   node scripts/mutate.ts --status
 *   node scripts/mutate.ts --restore
 *
 * Exit codes — the verdict is the exit code, so this composes in a shell:
 *   0  the mutant was KILLED (the command failed, which is what you wanted)
 *   1  the mutant SURVIVED (the command passed with the guard broken)
 *   2  refused to run, or the arguments were wrong — nothing was mutated
 *   3  mutated, and could not put the tree back. Read the message.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { canonicalizeNearestExisting } from '../src/core/paths.ts';

interface EditSpec {
  file: string;
  from: string;
  to: string;
  all: boolean;
}

interface JournalEntry {
  /** Repo-relative, POSIX separators. */
  path: string;
  original: string;
}

interface Journal {
  head: string;
  startedAt: string;
  pid: number;
  command: string[];
  files: JournalEntry[];
}

/** Paths this harness will not mutate under any argument. */
const PROTECTED = ['.my_context/', '.git/'];

const PROTECTED_REASON =
  '`.my_context/` is this repository\'s own dogfooded corpus and `.git/` is the thing that ' +
  'would put it back. A probe has reached the corpus twice already. Mutate a temp workspace ' +
  'instead — `runCli([\'init\'], mkdtempSync(...))` is what every test in this suite does.';

function fail(message: string, code = 2): never {
  process.stderr.write(`mutate: ${message}\n`);
  process.exit(code);
}

function git(root: string, args: string[]): { code: number; stdout: string; stderr: string } {
  const result = spawnSync('git', ['-C', root, ...args], { encoding: 'utf8' });
  if (result.error) fail(`could not run git: ${result.error.message}`);
  return {
    code: result.status ?? -1,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  };
}

function gitOrDie(root: string, args: string[]): string {
  const result = git(root, args);
  if (result.code !== 0) fail(`git ${args.join(' ')} failed: ${result.stderr.trim()}`);
  return result.stdout.trim();
}

function toPosix(p: string): string {
  return p.split(path.sep).join('/');
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

interface Parsed {
  mode: 'run' | 'status' | 'restore';
  edits: EditSpec[];
  command: string[];
}

/**
 * Repeated `--file/--from/--to` groups build one edit each: a `--file` opens a
 * new group, and `--from`/`--to`/`--all` attach to the group currently open.
 * Multi-file mutants are the normal shape here — a claim made on eight
 * surfaces needs eight edits reverted together or the revert is the new hazard.
 */
export function parseArgs(argv: string[]): Parsed {
  const edits: EditSpec[] = [];
  let command: string[] = [];
  let mode: 'run' | 'status' | 'restore' = 'run';

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--') { command = argv.slice(i + 1); break; }
    if (arg === '--status') { mode = 'status'; continue; }
    if (arg === '--restore') { mode = 'restore'; continue; }

    const needsValue = arg === '--file' || arg === '--from' || arg === '--to';
    if (needsValue && argv[i + 1] === undefined) {
      throw new Error(`${arg} needs a value.`);
    }

    if (arg === '--file') {
      edits.push({ file: argv[++i], from: '', to: '', all: false });
      continue;
    }
    if (edits.length === 0 && (arg === '--from' || arg === '--to' || arg === '--all')) {
      throw new Error(`${arg} must follow a --file.`);
    }
    const current = edits[edits.length - 1];
    if (arg === '--from') { current.from = argv[++i]; continue; }
    if (arg === '--to') { current.to = argv[++i]; continue; }
    if (arg === '--all') { current.all = true; continue; }

    throw new Error(
      `unknown argument "${arg}". Expected --file/--from/--to/--all, --status, --restore, ` +
      'or "--" followed by the command to run.',
    );
  }

  if (mode === 'run') {
    if (edits.length === 0) throw new Error('nothing to mutate — pass at least one --file with a --from.');
    for (const edit of edits) {
      if (edit.from === '') throw new Error(`--file ${edit.file} has no --from, so there is nothing to replace.`);
    }
    if (command.length === 0) {
      throw new Error(
        'no command to run. A mutation with nothing running against it proves nothing — pass ' +
        'the test that should kill it after a "--", e.g. -- node --test test/cli/query.test.ts',
      );
    }
  }

  return { mode, edits, command };
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

function journalPath(root: string): string {
  const gitDir = gitOrDie(root, ['rev-parse', '--absolute-git-dir']);
  return path.join(gitDir, 'mycontext-mutation.json');
}

function readJournal(file: string): Journal | null {
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Journal;
  } catch {
    fail(
      `the mutation journal at ${file} is unreadable. It records files a previous run mutated ` +
      'and could not put back. Restore them by hand from git, then delete that file.',
      3,
    );
  }
}

/**
 * Written with the ORIGINAL bytes before a single file is touched, and only
 * after that are the mutations applied. The order is the whole point: a crash
 * between the write and the first mutation leaves a journal describing files
 * that were never changed, which `--restore` handles as a no-op. A crash the
 * other way round would leave mutants with no record of what they replaced.
 */
function writeJournal(file: string, journal: Journal): void {
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(journal, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
// Refusals
// ---------------------------------------------------------------------------

/** Tracked changes only — `??` lines are untracked and nothing here writes to them. */
export function trackedChanges(porcelain: string): string[] {
  return porcelain
    .split('\n')
    .filter((line) => line.trim() !== '')
    .filter((line) => !line.startsWith('??'));
}

function refuseDirtyTree(root: string): void {
  const porcelain = git(root, ['status', '--porcelain']).stdout;
  const dirty = trackedChanges(porcelain);
  if (dirty.length === 0) return;
  fail(
    'refusing to mutate — the tree has uncommitted changes:\n' +
    dirty.map((line) => `    ${line}`).join('\n') +
    '\n\n  Commit them first. This harness restores the files it mutates, and a restore that ' +
    'runs over uncommitted work cannot tell your fix from the mutant — that is exactly how ' +
    'three agents lost work to `git checkout --` in this repository.',
  );
}

/** Repo-relative POSIX path, or a refusal. */
function resolveTarget(root: string, file: string): string {
  // Canonical, for the same reason `repoRootFor` is: `path.resolve` keeps the
  // spelling the caller's cwd happened to use, and on a machine whose %TEMP%
  // is an 8.3 short name (`C:\Users\RUNNER~1\…` on the GitHub Windows runner)
  // that spelling never string-prefixes the expanded root git reports — so
  // every in-repo target read as "outside the repository".
  const abs = canonicalizeNearestExisting(path.resolve(file));
  const rel = path.relative(root, abs);
  if (rel === '' || rel.startsWith('..') || path.isAbsolute(rel)) {
    fail(`refusing to mutate ${file} — it is outside the repository at ${root}.`);
  }
  const relPosix = toPosix(rel);
  for (const guarded of PROTECTED) {
    if (relPosix === guarded.replace(/\/$/, '') || relPosix.startsWith(guarded)) {
      fail(`refusing to mutate ${relPosix} — ${PROTECTED_REASON}`);
    }
  }
  if (!existsSync(abs)) fail(`refusing to mutate ${relPosix} — no such file.`);

  // `ls-files` prints the path when git tracks it and nothing when it does
  // not. An untracked target has no committed bytes to fall back to if the
  // in-memory restore fails, so it is refused rather than half-protected.
  if (git(root, ['ls-files', '--error-unmatch', '--', relPosix]).code !== 0) {
    fail(
      `refusing to mutate ${relPosix} — git does not track it, so there is no committed copy ` +
      'to fall back to. Commit it first, or mutate a file that is committed.',
    );
  }
  return relPosix;
}

// ---------------------------------------------------------------------------
// Restore
// ---------------------------------------------------------------------------

/**
 * Puts every journalled file back and proves it, in that order.
 *
 * The primary route writes the bytes read before the mutation — no git command
 * touches the working tree, so no path other than the ones named here can be
 * affected no matter what else is in the repository. `git checkout` appears
 * only as the fallback after the verification below has already failed.
 *
 * Returns the paths it could NOT restore; empty means the tree is back.
 */
function restore(root: string, journal: Journal): string[] {
  for (const entry of journal.files) {
    try {
      writeFileSync(path.join(root, entry.path), entry.original, 'utf8');
    } catch (err) {
      process.stderr.write(`mutate: could not rewrite ${entry.path}: ${String(err)}\n`);
    }
  }

  const paths = journal.files.map((f) => f.path);
  let stillDirty = pathsWithChanges(root, paths);
  if (stillDirty.length === 0) return [];

  process.stderr.write(
    `mutate: rewriting the original bytes did not bring ${stillDirty.join(', ')} back to ` +
    `${journal.head}; falling back to git.\n`,
  );
  for (const p of stillDirty) git(root, ['checkout', journal.head, '--', p]);
  stillDirty = pathsWithChanges(root, paths);
  return stillDirty;
}

function pathsWithChanges(root: string, paths: string[]): string[] {
  if (paths.length === 0) return [];
  const porcelain = git(root, ['status', '--porcelain', '--', ...paths]).stdout;
  return trackedChanges(porcelain).map((line) => line.slice(3).trim());
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function repoRootFor(file: string | undefined): string {
  const from = file === undefined ? process.cwd() : path.dirname(path.resolve(file));
  if (!existsSync(from)) fail(`no such directory: ${from}`);
  const result = spawnSync('git', ['-C', from, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (result.error) fail(`could not run git: ${result.error.message}`);
  if ((result.status ?? -1) !== 0) fail(`${from} is not inside a git repository, so nothing can restore it.`);
  // Canonical so it compares against canonicalized targets: git expands an
  // 8.3-spelled cwd when reporting the toplevel, and `resolveTarget` must
  // measure containment against the same spelling.
  return canonicalizeNearestExisting(path.resolve((result.stdout ?? '').trim()));
}

function main(argv: string[]): number {
  let parsed: Parsed;
  try {
    parsed = parseArgs(argv);
  } catch (err) {
    fail(err instanceof Error ? err.message : String(err));
  }

  const root = repoRootFor(parsed.edits[0]?.file);
  const journalFile = journalPath(root);

  if (parsed.mode === 'status') {
    const journal = readJournal(journalFile);
    if (!journal) { process.stdout.write('mutate: no mutation in flight.\n'); return 0; }
    process.stdout.write(
      `mutate: a mutation from pid ${journal.pid} started ${journal.startedAt} is still ` +
      `recorded as in flight:\n${journal.files.map((f) => `    ${f.path}`).join('\n')}\n` +
      'Run `node scripts/mutate.ts --restore` to put those files back.\n',
    );
    return 1;
  }

  if (parsed.mode === 'restore') {
    const journal = readJournal(journalFile);
    if (!journal) { process.stdout.write('mutate: nothing to restore.\n'); return 0; }
    const failed = restore(root, journal);
    if (failed.length > 0) {
      process.stderr.write(`mutate: still could not restore ${failed.join(', ')}. The journal is kept.\n`);
      return 3;
    }
    rmSync(journalFile, { force: true });
    process.stdout.write(`mutate: restored ${journal.files.length} file(s).\n`);
    return 0;
  }

  const stale = readJournal(journalFile);
  if (stale) {
    fail(
      `a previous run left a mutation in flight (pid ${stale.pid}, ${stale.startedAt}):\n` +
      stale.files.map((f) => `    ${f.path}`).join('\n') +
      '\n\n  Those files may still hold a mutant. Run `node scripts/mutate.ts --restore` first.',
    );
  }

  refuseDirtyTree(root);

  const head = gitOrDie(root, ['rev-parse', 'HEAD']);
  const targets = parsed.edits.map((edit) => resolveTarget(root, edit.file));

  // Read and check every edit BEFORE writing any of them: a `--from` that does
  // not appear is a typo in the probe, and finding out about it half-way
  // through a multi-file mutant means restoring a tree that is already mutated.
  const originals = new Map<string, string>();
  const mutated = new Map<string, string>();
  parsed.edits.forEach((edit, i) => {
    const rel = targets[i];
    const abs = path.join(root, rel);
    const before = mutated.get(rel) ?? readFileSync(abs, 'utf8');
    if (!originals.has(rel)) originals.set(rel, before);

    const occurrences = before.split(edit.from).length - 1;
    if (occurrences === 0) {
      fail(`--from was not found in ${rel}, so nothing was mutated:\n    ${edit.from}`);
    }
    if (occurrences > 1 && !edit.all) {
      fail(
        `--from appears ${occurrences} times in ${rel}. Refusing to guess which one you meant — ` +
        'narrow the text, or pass --all to replace every occurrence.',
      );
    }
    mutated.set(rel, edit.all ? before.split(edit.from).join(edit.to) : before.replace(edit.from, edit.to));
  });

  const journal: Journal = {
    head,
    startedAt: new Date().toISOString(),
    pid: process.pid,
    command: parsed.command,
    files: [...originals].map(([p, original]) => ({ path: p, original })),
  };
  writeJournal(journalFile, journal);

  let restored = false;
  const putBack = (): void => {
    if (restored) return;
    restored = true;
    const failedPaths = restore(root, journal);
    if (failedPaths.length > 0) {
      process.stderr.write(
        `mutate: THE TREE IS STILL MUTATED — ${failedPaths.join(', ')}. The journal at ` +
        `${journalFile} holds the original bytes; \`node scripts/mutate.ts --restore\` will ` +
        'retry. Do not commit until it is clean.\n',
      );
      return;
    }
    rmSync(journalFile, { force: true });
  };

  for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
    process.on(signal, () => { putBack(); process.exit(2); });
  }

  for (const [rel, text] of mutated) writeFileSync(path.join(root, rel), text, 'utf8');
  process.stdout.write(
    `mutate: mutated ${[...mutated.keys()].join(', ')} at ${head.slice(0, 7)}; ` +
    `running ${parsed.command.join(' ')}\n`,
  );

  let status: number;
  try {
    const result = spawnSync(parsed.command[0], parsed.command.slice(1), {
      cwd: root, stdio: 'inherit', shell: false,
    });
    if (result.error) {
      process.stderr.write(`mutate: could not run the command: ${result.error.message}\n`);
      status = -1;
    } else {
      status = result.status ?? -1;
    }
  } finally {
    putBack();
  }

  if (!restored || pathsWithChanges(root, [...mutated.keys()]).length > 0) return 3;

  if (status === 0) {
    process.stdout.write(
      '\nmutate: SURVIVED — the command passed with the mutation in place, so nothing in it ' +
      'depends on what you broke.\n',
    );
    return 1;
  }
  process.stdout.write(`\nmutate: KILLED — the command exited ${status} with the mutation in place.\n`);
  return 0;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  process.exit(main(process.argv.slice(2)));
}
