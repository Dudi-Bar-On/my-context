/**
 * Fails the suite when a test — or anything a test starts — writes inside the
 * developer's REAL `~/.my-context`.
 *
 * **The defect, measured.** On 2026-08-22 two fixture files,
 * `~/.my-context/items/constraint/CONST-global-one.md` and `CONST-global-two.md`,
 * were left in the real home directory by an interrupted run of
 * `test/cli/edit-global-layer.test.ts` / `supersede-global-layer.test.ts`.
 * `GLOBAL_DIR` (src/core/workspace.ts) is `path.join(homedir(), '.my-context')`
 * and `rebuildRoots` (src/core/open-store.ts) admits the global layer whenever
 * that directory merely EXISTS, so every sandboxed test that asserts "nothing
 * was created" saw two items it had never heard of: 134 unrelated tests red,
 * every one of them reporting `no item may be created by a refused invocation`
 * with a diff naming a constraint from someone's personal corpus. Nothing in
 * any message said "home directory". Diagnosing it took a day, precisely
 * because the failures were confident and pointed nowhere near the cause.
 *
 * A second instance of the same class was headed off by hand the next day: the
 * UI session store defaults to `GLOBAL_DIR`, is CAPPED at eight entries, and an
 * unpinned suite run would have evicted the digests of the tabs the developer
 * actually had open. It is pinned in `pin-rendering.ts` and `test/ui/helpers.ts`.
 *
 * **Why a guard and not a third pin.** Both of those fixes are conventions: a
 * test author has to know to redirect `HOME` first, or to pin a store's
 * directory. The convention is exactly what failed — twice in two days, in two
 * different shapes. This file makes the property structural instead: the suite
 * REPORTS the write, names the path, and goes red at the test that did it,
 * whether or not anybody remembered anything.
 *
 * **Why a before/after comparison of the directory itself.** The obvious
 * alternative — patching `fs.writeFileSync` and friends to refuse a path under
 * the real home — cannot see the case that matters. This suite spawns dozens of
 * real child processes (`test/helpers/stdio.ts`, `test/ui/helpers.ts`, every
 * hook and MCP end-to-end test) with `process.execPath` and no `--import`, so a
 * child loads none of this and inherits only the environment. That is precisely
 * how the UI session store would have escaped. The filesystem, by contrast, is
 * shared by every process on the machine: a write by a child, a grandchild or a
 * detached straggler shows up in the parent's next scan. The mechanism is blind
 * to WHO wrote, which is the point — it is why it cannot be evaded.
 *
 * **Why it does not fire for the tests that legitimately use that directory.**
 * `test/cli/edit-global-layer.test.ts`, `supersede-global-layer.test.ts`,
 * `test/core/draft-queue.test.ts`, `inject-cross-layer.test.ts` and
 * `markdown-fallback.test.ts` point `HOME`/`USERPROFILE` at a temp directory at
 * the top of the file and only then import the module graph, so their
 * `GLOBAL_DIR` is under `%TEMP%` and the real one never changes. This module is
 * loaded by `--import` (see `pin-rendering.ts`), which runs BEFORE any test
 * file's top-level code, so the path it watches is captured while `HOME` is
 * still real — a redirect afterwards cannot move the guard's aim.
 *
 * **And why it does not fire for the developer's own product.** The mechanism
 * is blind to WHO wrote, which is what makes it un-evadable — and it is why a
 * `mycontext ui` running in another terminal, writing `ui-sessions.json` into
 * this very directory, was reported as contamination 17 times in one loaded
 * run. The files the shipped product writes here are forgiven by name; see
 * `PRODUCT_OWNED_ENTRIES` below for the whole argument and the residual it
 * accepts. Items and `config.json` are not on that list and never will be.
 * * **Attribution.** `node --test` gives each test file its own process, so a
 * report already names the file. The per-test `afterEach` narrows it to the
 * test. With several test files running at once more than one process can
 * observe the same stray path and report it; the PATH is authoritative and the
 * test name is the best available hint, which the message says in as many
 * words. That is still a day of confusion collapsed into one line.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir, userInfo } from 'node:os';
import path from 'node:path';
import { after, afterEach } from 'node:test';

/** What `src/core/workspace.ts` appends to the home directory. */
const GLOBAL_DIR_NAME = '.my-context';

/** Above this size a file is fingerprinted by size and mtime alone. */
const HASH_SIZE_LIMIT = 1024n * 1024n;

/** Above this many entries the whole tree is fingerprinted without digests. */
const HASH_FILE_LIMIT = 64;

/**
 * The real global directories, resolved two independent ways and de-duplicated.
 *
 * `homedir()` is what `workspace.ts` itself calls, so it is the value the code
 * under test would use — but it reads `HOME`/`USERPROFILE`, which a test file
 * may already have moved. `userInfo().homedir` comes from the OS account (the
 * Windows token, `getpwuid` elsewhere) and ignores the environment entirely —
 * measured: with both variables set to a fake path, `homedir()` returns the
 * fake and `userInfo().homedir` still returns the real profile directory.
 * Watching the union keeps the guard aimed at the real directory even in a
 * process that was somehow started with `HOME` already redirected.
 *
 * `userInfo()` can throw where the running uid has no passwd entry (some
 * containers), which is not a reason to lose the half that does work.
 */
function realGlobalDirs(): string[] {
  const homes: unknown[] = [homedir()];
  try {
    homes.push(userInfo().homedir);
  } catch { /* no passwd entry for this uid; homedir() is all we get */ }
  const dirs = new Set<string>();
  for (const home of homes) {
    if (typeof home === 'string' && home !== '') dirs.add(path.join(home, GLOBAL_DIR_NAME));
  }
  return [...dirs];
}

/** The directories this guard watches, frozen at module load. */
export const WATCHED_DIRS: readonly string[] = Object.freeze(realGlobalDirs());

/**
 * A fingerprint of every entry under `root`, or an empty map if `root` does not
 * exist — absent and empty are both acceptable states, and a test that CREATES
 * the directory is caught by the `.` entry appearing.
 *
 * A file is fingerprinted by size, nanosecond mtime AND a digest of its
 * contents. **The digest is not belt-and-braces; without it the check misses
 * the very defect that prompted it.** `ui-sessions.json` is capped at eight
 * entries, so an unpinned run EVICTS a digest and rewrites the file at very
 * nearly the same length — and Windows stamps file times from the system
 * clock, whose default granularity is ~15.6ms, not from the 100ns NTFS field.
 * Measured on this machine: of 20 same-length rewrites performed back to back,
 * **4 carried an identical `mtimeNs`**. Size and mtime alone would have shrugged
 * at 1 in 5 evictions.
 *
 * **Hashing is affordable exactly where it is needed, and is dropped where it
 * is not.** Measured here, on the machine this defect happened on: reading and
 * hashing 500 two-kilobyte files costs ~3.3s (~6.5ms each — Defender inspects
 * every open), against ~100ms for `stat` alone. So a tree of more than
 * `HASH_FILE_LIMIT` files, or a file larger than `HASH_SIZE_LIMIT`, is
 * fingerprinted by size and mtime only. The directory this is aimed at holds a
 * `ui-sessions.json` and nothing else — 2 entries, ~1ms hashed — while a tree
 * big enough to lose the digest is a personal CORPUS, whose defining symptom is
 * a file APPEARING, which size and mtime report perfectly well.
 *
 * Directories are recorded as a constant. A directory's own mtime moves
 * whenever a child is added or removed, which the child's own entry already
 * reports; fingerprinting it too would double every message.
 */
export function snapshotTree(root: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  let entries;
  try {
    entries = readdirSync(root, { recursive: true, withFileTypes: true });
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Absent is the common case on CI and a perfectly good baseline.
    if (code === 'ENOENT') return snapshot;
    // Anything else (EACCES on a locked-down home) must not be swallowed into
    // "unchanged" — record it, so that a later scan which CAN read the tree
    // reports a difference rather than a silent pass.
    snapshot.set('<unreadable>', String(code ?? 'unknown'));
    return snapshot;
  }
  const hashing = entries.length <= HASH_FILE_LIMIT;
  snapshot.set('.', 'dir');
  for (const entry of entries) {
    const full = path.join(entry.parentPath, entry.name);
    const rel = path.relative(root, full);
    if (entry.isDirectory()) {
      snapshot.set(rel, 'dir');
      continue;
    }
    try {
      const st = statSync(full, { bigint: true });
      const digest = hashing && st.size <= HASH_SIZE_LIMIT
        ? createHash('sha1').update(readFileSync(full)).digest('hex').slice(0, 16)
        : 'unhashed';
      snapshot.set(rel, `${st.size}:${st.mtimeNs}:${digest}`);
    } catch {
      // Removed between readdir and stat: still a change, and a stable marker
      // so the next scan reports it exactly once.
      snapshot.set(rel, 'vanished');
    }
  }
  return snapshot;
}

export interface TreeChange {
  kind: 'created' | 'modified' | 'removed';
  /** Path relative to the watched directory; `.` is the directory itself. */
  entry: string;
}

/** Every entry that appeared, changed or disappeared between two snapshots. */
export function diffTrees(
  before: ReadonlyMap<string, string>, current: ReadonlyMap<string, string>,
): TreeChange[] {
  const changes: TreeChange[] = [];
  for (const [entry, fingerprint] of current) {
    const previous = before.get(entry);
    if (previous === undefined) changes.push({ kind: 'created', entry });
    else if (previous !== fingerprint) changes.push({ kind: 'modified', entry });
  }
  for (const entry of before.keys()) {
    if (!current.has(entry)) changes.push({ kind: 'removed', entry });
  }
  return changes.sort((a, b) => a.entry.localeCompare(b.entry));
}

/**
 * The entries in that directory the PRODUCT writes during a normal run, which
 * this check forgives.
 *
 * **Why a guard needs an ignore list at all.** The mechanism above is blind to
 * WHO wrote — that is the property that makes it un-evadable by a spawned
 * child, and it is the same property seen from the other side: the filesystem
 * is shared by every process on the machine. A developer running `mycontext
 * ui` in another terminal writes `ui-sessions.json` into this exact directory,
 * which is correct, intended production behaviour, and a suite running at the
 * same time reported it as contamination against whichever test happened to be
 * running. **Measured 2026-08-23: one loaded run produced 17 such failures**
 * while a UI server served the demo corpus in another window, and the agent
 * who hit them spent time deciding whether the defect was its own.
 *
 * A guard that cries wolf on the developer's own product is a guard that gets
 * switched off — which is precisely how the convention this file replaced
 * failed. So the narrowest possible remedy: forgive the files the product
 * legitimately writes here, keep the reach over everything else, and SAY in
 * the report that the list exists (`describeOffence`) so the next reader does
 * not rediscover this from scratch.
 *
 * **What is on the list, and why nothing else is.** `ui-sessions.json` is the
 * only file the product writes into the global directory today
 * (`src/core/ui-sessions.ts`, whose store defaults to `GLOBAL_DIR`), and
 * `ui-sessions.json.tmp` is the fixed-name temp file its write renames from —
 * visible to a scan that lands mid-write, and left behind outright by a writer
 * that died between the two calls. Items and `config.json` are deliberately
 * absent: they are the shapes that turned 134 tests red on 2026-08-22, and
 * `test/core/real-home-guard.test.ts` writes all three in ONE test to prove the
 * forgiveness did not widen into a hole.
 *
 * **The residual, stated rather than hidden.** A test that unpinned
 * `MYCONTEXT_UI_SESSIONS_DIR` and wrote the real store is no longer caught
 * here. That is the cost of remedy (1) over remedy (2) — comparing CONTENT
 * identity for these files rather than presence — and it is affordable because
 * the pin lives in the preload every test file loads
 * (`test/helpers/pin-rendering.ts`) and because what such a test would destroy
 * is a list of token DIGESTS the developer's browser can re-obtain, not a
 * corpus. An item or a config is neither.
 */
export const PRODUCT_OWNED_ENTRIES: ReadonlySet<string> = Object.freeze(new Set([
  'ui-sessions.json',
  'ui-sessions.json.tmp',
])) as ReadonlySet<string>;

/**
 * The changes that are actually offences: everything the product does not own.
 *
 * The filter is applied HERE and not inside `diffTrees`, which stays a pure
 * before/after diff — a forgiven change is still a change, the baseline still
 * has to move on it, and a test of the diff should not have to know what the
 * product writes.
 */
export function offendingChanges(changes: readonly TreeChange[]): TreeChange[] {
  const rest = changes.filter((change) => !PRODUCT_OWNED_ENTRIES.has(change.entry));
  // Nothing was forgiven, so nothing below applies.
  if (rest.length === changes.length) return rest;
  // The directory's own creation is the PRODUCT's when it arrived carrying
  // nothing but the product's files: `mycontext ui` on a machine that has never
  // run mycontext creates `~/.my-context` and writes one file into it, and
  // reporting that is the same cry-wolf one level up. `.` on its own, with
  // nothing forgiven beside it, is a test creating the directory and is still
  // reported — an empty global directory is enough to switch the global layer
  // on (`rebuildRoots`).
  if (rest.length === 1 && rest[0]?.entry === '.' && rest[0]?.kind === 'created') return [];
  return rest;
}
/**
 * The report. Written for whoever is staring at a red suite with no idea why,
 * which is the entire audience for this file: it names the directory, every
 * path that moved, where it was seen, what it costs if it is left there, and
 * the two ways a test is allowed to touch that directory at all.
 */
export function describeOffence(dir: string, changes: TreeChange[], seenAfter: string): string {
  return [
    "A test run wrote inside the developer's REAL global directory:",
    '',
    `  ${dir}`,
    '',
    ...changes.map((change) => `  ${change.kind.padEnd(8)} ${change.entry}`),
    '',
    `  seen after: ${seenAfter}`,
    '',
    'Nothing in this suite may write there. GLOBAL_DIR (src/core/workspace.ts) is',
    "path.join(homedir(), '.my-context'), resolved ONCE at module load, and",
    'rebuildRoots (src/core/open-store.ts) admits the global layer whenever that',
    'directory merely exists — so an item left there is loaded by EVERY sandboxed',
    'test. On 2026-08-22 two such files turned 134 unrelated tests red, each one',
    'reporting "no item may be created by a refused invocation" against an item it',
    'had never heard of. Delete the paths above before re-running, or the next run',
    'lies in the same way.',
    '',
    'To exercise the global layer, do what test/cli/edit-global-layer.test.ts and',
    'test/cli/supersede-global-layer.test.ts do: point HOME and USERPROFILE at a',
    'temp directory at the TOP of the file, await import() the module graph only',
    'afterwards, and assert the redirect took effect. To keep a STORE out of it,',
    'pin its directory the way test/helpers/pin-rendering.ts pins',
    'MYCONTEXT_UI_SESSIONS_DIR — a spawned child inherits the environment and',
    'nothing else.',
    '',
    'This check compares the directory before and after, so it catches a write made',
    'by a child process too. With several test files running at once more than one',
    'may report the same path: the PATH is authoritative, the test name above is a',
    'hint. If you were running mycontext yourself while the suite ran, that is the',
    'write you are looking at.',
    '',
    'The files the PRODUCT itself writes here during a normal run are IGNORED by',
    'this check, so a `mycontext ui` in another terminal cannot turn the suite red',
    '(it did, 17 times in one loaded run). That list is:',
    '',
    `  ${[...PRODUCT_OWNED_ENTRIES].join(', ')}`,
    '',
    'Nothing above is on it. To widen it, add to PRODUCT_OWNED_ENTRIES in',
    'test/helpers/real-home-guard.ts — and only for a file the SHIPPED product',
    'writes there, never to quieten a test.',
    '',
    'See test/helpers/real-home-guard.ts.',
  ].join('\n');
}

/**
 * How many entries a directory may hold before it is checked once per test FILE
 * instead of once per test.
 *
 * The scan is one recursive `readdir`, one `stat` per file, and a digest for a
 * small tree. Measured: ~0.2ms against an absent directory, ~1ms against the
 * two entries a developer's `~/.my-context` actually holds, ~100ms against a
 * 500-item corpus. The first two are nothing across the suite's 4384 tests; the
 * third would be minutes. Above the limit the guard keeps the per-FILE check,
 * which costs one scan per test process (263 of them) and still names the
 * offending path; only the per-test attribution is given up.
 *
 * **This was an elapsed-time budget first, and that was wrong — measured.** Run
 * alone, the baseline scan took ~1ms and per-test attribution was on; run inside
 * a full `npm test` with the machine loaded, the same scan blew a 20ms budget
 * and the guard silently degraded to file-level attribution, which failed this
 * file's own probe (`test/core/real-home-guard.test.ts`). A guard whose
 * precision varies with load is a guard that reports differently on the machine
 * nobody watches. Entry count is the thing the cost actually scales with, it is
 * the same on every machine, and it does not move while the suite runs.
 *
 * The same number as `HASH_FILE_LIMIT` and for the same reason — both mean
 * "small enough that a scan is free" — but a separate constant deliberately:
 * that one bounds the cost of ONE scan, this one bounds how OFTEN a scan runs.
 */
const PER_TEST_ENTRY_LIMIT = 64;

const baselines = new Map<string, Map<string, string>>();
/** Watched directories small enough to re-scan after every single test. */
const perTestDirs = new Set<string>();
let installed = false;
/** The last test to finish in this process — the hint in a file-level report. */
let lastTest = '(no test had finished yet)';

/**
 * Compares every watched directory against its baseline and returns one report
 * per offending directory, re-baselining as it goes so that a single stray file
 * is reported once rather than by every check that runs after it.
 */
export function checkWatchedDirs(
  seenAfter: string, dirs: Iterable<string> = WATCHED_DIRS,
): string[] {
  const offences: string[] = [];
  for (const dir of dirs) {
    const before = baselines.get(dir);
    if (before === undefined) continue;
    const current = snapshotTree(dir);
    const changes = diffTrees(before, current);
    if (changes.length === 0) continue;
    // Re-baselined on ANY change, forgiven or not: a stray file is reported
    // once rather than by every check that runs after it, and a forgiven one is
    // not re-diffed by every remaining test in the file either.
    baselines.set(dir, current);
    const offending = offendingChanges(changes);
    if (offending.length === 0) continue;
    offences.push(describeOffence(dir, offending, seenAfter));
  }
  return offences;
}

/**
 * Takes the baseline and registers the checks. Called once, from the `--import`
 * preload, so that it happens before any test file's top-level code runs.
 *
 * Three checks, narrowest to widest:
 *  - `afterEach` names the test, and covers the directories small enough to
 *    re-scan that often (see the limit above);
 *  - a root `after` covers EVERY watched directory — including one too large
 *    for the per-test check — and writes from module top-level code, and fails
 *    the file;
 *  - `process.on('exit')` is the backstop for anything written after the runner
 *    has finished — a child reaped late, say. It cannot throw usefully at that
 *    point, so it prints the report and sets `process.exitCode`, which
 *    `node --test` reports as a failed file (measured, not assumed).
 */
export function installRealHomeGuard(): void {
  if (installed) return;
  installed = true;

  for (const dir of WATCHED_DIRS) {
    const baseline = snapshotTree(dir);
    baselines.set(dir, baseline);
    if (baseline.size <= PER_TEST_ENTRY_LIMIT) perTestDirs.add(dir);
  }

  const where = (testName?: string): string => {
    const file = process.argv[1] ?? '(unknown file)';
    return testName === undefined
      ? `${file} (file-level check; last test to finish: ${lastTest})`
      : `${file} > ${testName}`;
  };

  afterEach((t) => {
    const named = typeof t?.name === 'string' ? `"${t.name}"` : undefined;
    if (named !== undefined) lastTest = named;
    if (perTestDirs.size === 0) return;
    const offences = checkWatchedDirs(where(named), perTestDirs);
    if (offences.length > 0) throw new Error(offences.join('\n\n'));
  });

  after(() => {
    const offences = checkWatchedDirs(where());
    if (offences.length > 0) throw new Error(offences.join('\n\n'));
  });

  process.on('exit', () => {
    const offences = checkWatchedDirs(where());
    if (offences.length === 0) return;
    process.stderr.write(`\n${offences.join('\n\n')}\n`);
    process.exitCode = 1;
  });
}
