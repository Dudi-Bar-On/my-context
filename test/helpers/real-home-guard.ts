/**
 * Fails the RUN when a test — or anything a test starts — writes outside the
 * sandbox, which here means inside the developer's real home directory.
 *
 * ── WHERE THE SANDBOX LINE IS DRAWN, AND WHY ────────────────────────────────
 *
 * "Outside the sandbox" was never written down before, and a boundary drawn by
 * accident is a boundary that moves. It is drawn here, explicitly, in three
 * parts:
 *
 * **Inside — never an offence.** The OS temp directory (every test's own
 * `mkdtemp` workspace) and the repository working tree. A temp workspace is
 * created by the test, swept by the test, and describes nothing that existed
 * before the run. The working tree is not sacred either, but it is VERSIONED:
 * a test that dirties it shows up in `git status`, is readable as a diff, and
 * is recoverable by the person who owns it. Neither can destroy state that
 * exists on exactly one machine and nowhere else, which is the property that
 * actually matters.
 *
 * **Outside — an offence.** The developer's real home directory, which is
 * where state exists on exactly one machine and nowhere else. Two places there
 * are reachable from this product, and both are watched:
 *
 *   - `~/.my-context` — `GLOBAL_DIR` (src/core/workspace.ts). Watched as a
 *     whole TREE, because anything under it is loaded into every sandboxed
 *     test (see the 2026-08-22 defect below).
 *   - `~/.claude/settings.json` — the file `statusline install` reads and
 *     rewrites (`claudeSettingsPath`, src/cli/commands/statusline-install.ts,
 *     honouring `CLAUDE_CONFIG_DIR` exactly as that function does). Watched as
 *     a single FILE, not as a tree: `~/.claude` also holds `history.jsonl`,
 *     `projects/`, caches and shell snapshots that a running Claude Code
 *     rewrites continuously and that no scan could tell from a test's write.
 *     `settings.json` is the one entry in it this product ever writes, and it
 *     is the one the 2026-08-30 escape actually rewrote — the half of that
 *     escape this guard could not see, because it was watching the other half.
 *
 * **Forgiven, inside the offence zone.** The files the SHIPPED product writes
 * into `~/.my-context` while a developer merely uses it — see
 * `PRODUCT_OWNED_ENTRIES`. Not a softening: the mechanism below is blind to
 * WHO wrote, and a `mycontext ui` running in another terminal is not this
 * suite. A guard that cries wolf on the developer's own product is a guard
 * that gets switched off.
 *
 * The line is deliberately NOT "anything under `homedir()`". Watching a whole
 * home would fire on every editor swap file, every browser cache and every
 * other tool the developer runs, which is the same cry-wolf failure one level
 * up. It is drawn at the reaches this product actually has, and it moves when
 * the product gains a new one — `test/core/real-home-guard-escape.test.ts`
 * fails if `src/` grows a home-directory reach that is not watched here.
 *
 * ── THE DEFECT, MEASURED ────────────────────────────────────────────────────
 *
 * On 2026-08-22 two fixture files,
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
 * actually had open. It is pinned in `pin-sessions-dir.ts` and `test/ui/helpers.ts`.
 *
 * **Why a guard and not a third pin.** Both of those fixes are conventions: a
 * test author has to know to redirect `HOME` first, or to pin a store's
 * directory. The convention is exactly what failed — twice in two days, in two
 * different shapes. This file makes the property structural instead, whether or
 * not anybody remembered anything.
 *
 * ── WHY IT FAILS THE RUN AND NOT ONLY THE TEST (2026-08-31) ─────────────────
 *
 * It used to check, report, RE-BASELINE, and carry on. That is a guard which
 * measures an escape instead of acting on it, and the cost was measured on
 * 2026-08-30. `mycontext statusline install --yes` reached the real home from
 * an approval-boundary probe. Every test PROCESS that was already alive
 * scanned the same directory, saw the same stray file, and blamed whichever of
 * its own tests happened to finish next — and then re-baselined and went on.
 * Two lanes saw shifting sets of 15 and then 19 failures over DIFFERENT tests,
 * and both read it as flakiness. One escape, spread thin enough over unrelated
 * tests to look like noise.
 *
 * The cure is not a quieter alarm — the reddening is the symptom of a real
 * escape. The cure is that the escape **fails fast and once**:
 *
 *   - the first offence TRIPS the run, and a trip is latched: the process that
 *     saw it cannot go green afterwards, whatever happens next;
 *   - the trip is recorded in a run-scoped file under the temp directory, so
 *     every OTHER test process in the same run — the ones already running and
 *     the ones not started yet — fails immediately with a short message naming
 *     the same path and the same test, instead of inventing its own story;
 *   - a stray file that was ALREADY there when the run started is an offence
 *     too (`preexistingOffences`), because a delta check is blind to it: the
 *     poison is in the baseline, the run goes green on the guard and red
 *     everywhere else. That is the state the 2026-08-30 escape left behind.
 *
 * Nothing here deletes anything. Cleaning up a stray file is worth doing and is
 * not a fix; a guard that tidied the evidence away would report the defect
 * fixed forever.
 *
 * ── WHY A BEFORE/AFTER COMPARISON OF THE DIRECTORY ITSELF ───────────────────
 *
 * The obvious alternative — patching `fs.writeFileSync` and friends to refuse a
 * path under the real home — cannot see the case that matters. This suite
 * spawns dozens of real child processes (`test/helpers/stdio.ts`,
 * `test/ui/helpers.ts`, every hook and MCP end-to-end test) with
 * `process.execPath` and no `--import`, so a child loads none of this and
 * inherits only the environment. That is precisely how the UI session store
 * would have escaped, and precisely how `statusline install` escaped. The
 * filesystem, by contrast, is shared by every process on the machine: a write
 * by a child, a grandchild or a detached straggler shows up in the parent's
 * next scan. The mechanism is blind to WHO wrote, which is the point — it is
 * why it cannot be evaded.
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
 * **Attribution.** `node --test` gives each test file its own process, so a
 * report already names the file. The per-test `afterEach` narrows it to the
 * test. The PATH is authoritative and the test name is the best available hint,
 * which the message says in as many words. That is still a day of confusion
 * collapsed into one line.
 */
import { createHash } from 'node:crypto';
import { mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir, userInfo } from 'node:os';
import path from 'node:path';
import { after, afterEach, before } from 'node:test';

/** What `src/core/workspace.ts` appends to the home directory. */
const GLOBAL_DIR_NAME = '.my-context';

/** What `claudeSettingsPath` appends to the home directory, and to it. */
const CLAUDE_DIR_NAME = '.claude';
const CLAUDE_SETTINGS_NAME = 'settings.json';

/** Above this size a file is fingerprinted by size and mtime alone. */
const HASH_SIZE_LIMIT = 1024n * 1024n;

/** Above this many entries the whole tree is fingerprinted without digests. */
const HASH_FILE_LIMIT = 64;

/**
 * A watched target and how much of it is watched.
 *
 * `tree` walks the whole directory; `file` fingerprints exactly one file and
 * ignores everything beside it. The distinction is not an optimization, it is
 * the sandbox line: `~/.my-context` is entirely this product's, while
 * `~/.claude` is Claude Code's own working directory and only `settings.json`
 * in it is ever written by anything here.
 */
export type WatchKind = 'tree' | 'file';

export interface WatchTarget {
  kind: WatchKind;
  /** The directory (kind `tree`) or the file (kind `file`) being watched. */
  path: string;
}

/**
 * The real home directories, resolved two independent ways and de-duplicated.
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
function realHomes(): string[] {
  const homes: unknown[] = [homedir()];
  try {
    homes.push(userInfo().homedir);
  } catch { /* no passwd entry for this uid; homedir() is all we get */ }
  const found = new Set<string>();
  for (const home of homes) {
    if (typeof home === 'string' && home !== '') found.add(home);
  }
  return [...found];
}

function realGlobalDirs(): string[] {
  return realHomes().map((home) => path.join(home, GLOBAL_DIR_NAME));
}

/**
 * The Claude Code settings files this guard defends, resolved the way
 * `claudeSettingsPath` (src/cli/commands/statusline-install.ts) resolves the
 * one it writes: `CLAUDE_CONFIG_DIR` when set and non-empty, else
 * `<home>/.claude`. An honoured override is watched IN ADDITION to the default
 * rather than instead of it — a test that points the variable somewhere
 * harmless must not be able to un-aim the guard from the real file by doing so.
 */
function realSettingsFiles(): string[] {
  const files = new Set<string>();
  const override = process.env['CLAUDE_CONFIG_DIR'];
  if (override !== undefined && override !== '') {
    files.add(path.join(override, CLAUDE_SETTINGS_NAME));
  }
  for (const home of realHomes()) {
    files.add(path.join(home, CLAUDE_DIR_NAME, CLAUDE_SETTINGS_NAME));
  }
  return [...files];
}

/** Everything this guard watches, frozen at module load. */
export const WATCHED_TARGETS: readonly WatchTarget[] = Object.freeze([
  ...realGlobalDirs().map((dir): WatchTarget => ({ kind: 'tree', path: dir })),
  ...realSettingsFiles().map((file): WatchTarget => ({ kind: 'file', path: file })),
]);

/** The directories watched whole. */
export const WATCHED_DIRS: readonly string[] = Object.freeze(
  WATCHED_TARGETS.filter((t) => t.kind === 'tree').map((t) => t.path),
);

/** The single files watched on their own. */
export const WATCHED_FILES: readonly string[] = Object.freeze(
  WATCHED_TARGETS.filter((t) => t.kind === 'file').map((t) => t.path),
);

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
 * `ui-sessions.json` and a `ui-server.json` and nothing else — ~1ms hashed —
 * while a tree big enough to lose the digest is a personal CORPUS, whose
 * defining symptom is a file APPEARING, which size and mtime report perfectly
 * well.
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
    snapshot.set(rel, fingerprint(full, hashing));
  }
  return snapshot;
}

/**
 * A fingerprint of ONE file, keyed by its basename so that the report reads the
 * same way a tree's does — `modified settings.json` under the directory the
 * report names. An absent file is an empty map, which makes its creation a
 * `created` change rather than an invisible one.
 *
 * Always hashed: it is one small JSON document, and a settings file rewritten
 * to the same length is exactly the shape of write this exists to catch.
 * Measured on this machine against the owner's real 13KB `settings.json`:
 * ~70us per fingerprint, so ~0.3s spread across the suite's 4384 tests.
 */
export function snapshotFile(file: string): Map<string, string> {
  const snapshot = new Map<string, string>();
  try {
    statSync(file);
  } catch {
    return snapshot;
  }
  snapshot.set(path.basename(file), fingerprint(file, true));
  return snapshot;
}

function fingerprint(file: string, hashing: boolean): string {
  try {
    const st = statSync(file, { bigint: true });
    const digest = hashing && st.size <= HASH_SIZE_LIMIT
      ? createHash('sha1').update(readFileSync(file)).digest('hex').slice(0, 16)
      : 'unhashed';
    return `${st.size}:${st.mtimeNs}:${digest}`;
  } catch {
    // Removed between readdir and stat: still a change, and a stable marker
    // so the next scan reports it exactly once.
    return 'vanished';
  }
}

/** Snapshots either shape of target. */
export function snapshotTarget(target: WatchTarget): Map<string, string> {
  return target.kind === 'tree' ? snapshotTree(target.path) : snapshotFile(target.path);
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
  for (const [entry, mark] of current) {
    const previous = before.get(entry);
    if (previous === undefined) changes.push({ kind: 'created', entry });
    else if (previous !== mark) changes.push({ kind: 'modified', entry });
  }
  for (const entry of before.keys()) {
    if (!current.has(entry)) changes.push({ kind: 'removed', entry });
  }
  return changes.sort((a, b) => a.entry.localeCompare(b.entry));
}

/**
 * The entries in `~/.my-context` the PRODUCT writes during a normal run, which
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
 * **What is on the list, and why nothing else is.**
 *
 *   - `ui-sessions.json` — the session store (`src/core/ui-sessions.ts`, whose
 *     store defaults to `GLOBAL_DIR`) — and `ui-sessions.json.tmp`, the
 *     fixed-name temp file its write renames from: visible to a scan that
 *     lands mid-write, and left behind outright by a writer that died between
 *     the two calls.
 *   - `ui-server.json` — the liveness record (`src/core/ui-server-record.ts`,
 *     whose `recordDir` also defaults to `GLOBAL_DIR`) — and its temp file,
 *     which is `ui-server.json.tmp-<pid>` rather than a fixed name, so it is
 *     matched by pattern (`PRODUCT_OWNED_PATTERNS`). Added 2026-08-31 for the
 *     same reason as `ui-sessions.json` and on the same evidence: a combined
 *     run on 2026-08-27 went red on `ui-server.json` being touched, traced to
 *     the owner's own UI server on port 58888 and to nothing in the diff.
 *
 * `statusline-replaced.json` is deliberately NOT on this list even though the
 * shipped product writes it, and that is the one entry where "the product
 * writes it" is not sufficient. `ui-sessions.json` and `ui-server.json` are
 * written by a server that RUNS IN THE BACKGROUND and genuinely races a suite;
 * `statusline-replaced.json` is only ever written by an explicit, consented,
 * interactive `mycontext statusline install --yes`, which nobody runs by
 * accident beside a test run — and it is the exact file the 2026-08-30 escape
 * created. Forgiving it would blind this guard to the escape it was rewritten
 * for.
 *
 * Items and `config.json` are absent for the original reason: they are the
 * shapes that turned 134 tests red on 2026-08-22, and
 * `test/core/real-home-guard.test.ts` writes them beside a forgiven file in ONE
 * test to prove the forgiveness did not widen into a hole.
 *
 * **The residual, stated rather than hidden.** A test that unpinned
 * `MYCONTEXT_UI_SESSIONS_DIR` and wrote the real store is not caught here. The
 * remedy for that is not to narrow this list — it is that the pin lives in one
 * module every minting test imports (`test/helpers/pin-sessions-dir.ts`) and
 * that `test/ui/sessions-pin.test.ts` fails when a new one does not.
 */
export const PRODUCT_OWNED_ENTRIES: ReadonlySet<string> = Object.freeze(new Set([
  'ui-sessions.json',
  'ui-sessions.json.tmp',
  'ui-server.json',
])) as ReadonlySet<string>;

/** Product-owned entries whose name carries a pid and so cannot be listed. */
const PRODUCT_OWNED_PATTERNS: readonly RegExp[] = Object.freeze([
  /^ui-server\.json\.tmp-\d+$/,
]);

/** Whether one entry name is one the shipped product legitimately writes. */
export function isProductOwned(entry: string): boolean {
  if (PRODUCT_OWNED_ENTRIES.has(entry)) return true;
  return PRODUCT_OWNED_PATTERNS.some((pattern) => pattern.test(entry));
}

/**
 * The changes that are actually offences: everything the product does not own.
 *
 * The filter is applied HERE and not inside `diffTrees`, which stays a pure
 * before/after diff — a forgiven change is still a change, the baseline still
 * has to move on it, and a test of the diff should not have to know what the
 * product writes.
 */
export function offendingChanges(changes: readonly TreeChange[]): TreeChange[] {
  const rest = changes.filter((change) => !isProductOwned(change.entry));
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
export function describeOffence(
  dir: string, changes: TreeChange[], seenAfter: string, kind: WatchKind = 'tree',
): string {
  const head = [
    kind === 'file'
      ? "A test run wrote the developer's REAL Claude Code settings file:"
      : "A test run wrote inside the developer's REAL global directory:",
    '',
    `  ${dir}`,
    '',
    ...changes.map((change) => `  ${change.kind.padEnd(8)} ${change.entry}`),
    '',
    `  seen after: ${seenAfter}`,
    '',
  ];
  const body = kind === 'file'
    ? [
      'Nothing in this suite may write there. That file is the one Claude Code',
      'itself reads, and `mycontext statusline install --yes` replaces the',
      'statusLine key in it (claudeSettingsPath, src/cli/commands/statusline-install.ts).',
      'On 2026-08-30 a probe ran exactly that against the real machine and the run',
      'carried on regardless. Restore it from your own backup before re-running.',
      '',
      'To exercise the installer, pass --settings <temp path> AND redirect HOME and',
      'USERPROFILE (and CLAUDE_CONFIG_DIR) for the spawn: --settings isolates which',
      'settings file is read and written, but it does not move ws.globalRoot, which',
      'is where the saved copy of the replaced setting is written.',
    ]
    : [
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
      'pin its directory the way test/helpers/pin-sessions-dir.ts pins',
      'MYCONTEXT_UI_SESSIONS_DIR — a spawned child inherits the environment and',
      'nothing else.',
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
    ];
  return [
    ...head,
    ...body,
    '',
    'This check compares the target before and after, so it catches a write made',
    'by a child process too. THIS RUN IS NOW FAILING AS A WHOLE: the escape is',
    'latched here and recorded for every other test process in the run, so a',
    'later red test elsewhere is this escape and not a flake. The PATH above is',
    'authoritative and the test name is the best available hint. If you were',
    'running mycontext yourself while the suite ran, that is the write you are',
    'looking at.',
    '',
    'See test/helpers/real-home-guard.ts for where the sandbox line is drawn.',
  ].join('\n');
}

/**
 * The report for contamination that was ALREADY there when the run started.
 *
 * A before/after check is blind to this by construction: the stray file is in
 * the baseline, so nothing "changes" and the guard passes while the corpus it
 * poisons turns unrelated tests red — the 2026-08-22 shape exactly, and the
 * state the 2026-08-30 escape left on disk for every later run. So the baseline
 * itself is an assertion, not just a starting point.
 */
export function describePreexisting(dir: string, entries: readonly string[]): string {
  return [
    "The developer's REAL global directory already holds files this suite did not",
    'put there, and the run cannot be trusted while they are there:',
    '',
    `  ${dir}`,
    '',
    ...entries.map((entry) => `  present  ${entry}`),
    '',
    'rebuildRoots (src/core/open-store.ts) admits the global layer whenever that',
    'directory merely exists, and loadLayer walks its items/ — so anything above is',
    'loaded into EVERY sandboxed test in this suite, which then reports a diff full',
    'of an item it never heard of. That is the 2026-08-22 failure: 134 tests red,',
    'and nothing in any message saying "home directory".',
    '',
    'This is refused rather than cleaned up: a guard that tidied the evidence away',
    'would report the defect fixed forever. Move the paths above aside yourself,',
    'then run again.',
    '',
    'The files the shipped product legitimately writes here are ignored:',
    '',
    `  ${[...PRODUCT_OWNED_ENTRIES].join(', ')}`,
    '',
    'See test/helpers/real-home-guard.ts for where the sandbox line is drawn.',
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

/**
 * Where a trip is recorded so the REST of the run sees it.
 *
 * ── WHY A FILE, AND WHY IT IS KEYED BY THE RUNNER'S PID ─────────────────────
 *
 * `node --test` gives every test FILE its own process, and a process has no
 * way to reach its siblings. The escape therefore has to be published
 * somewhere every process can read, and the only thing they all share is the
 * filesystem — the same argument that decided the detection mechanism.
 *
 * It is keyed by the RUN so that two runs on one machine cannot abort each
 * other, which matters here: several agents run this suite at the same time on
 * the developer's machine. A test process is a child of the runner root
 * (`NODE_TEST_CONTEXT` is set in a child and not in the root), so `ppid` in a
 * child and `pid` in the root name the SAME run and nothing else — no
 * environment plumbing, and it works under `--experimental-test-isolation=none`
 * too, where there is only the root.
 *
 * **The residual, stated:** an operating system may reuse a pid. A marker is
 * therefore honoured only while it is fresh (`TRIP_MAX_AGE_MS`), which needs a
 * pid to be recycled as a test-runner root within half an hour on the same
 * machine; and the consequence of the collision is a loud message quoting a
 * real escape that really happened, not a fabricated one. Markers older than
 * `TRIP_PRUNE_AGE_MS` are swept on the way past.
 *
 * The cost of asking is one `stat` of an absent file per test — measured at
 * ~30us here, ~0.13s across the whole suite.
 *
 * `MYCONTEXT_GUARD_TRIP_DIR` moves the directory, and exists for exactly one
 * caller: a test that drives this guard over a deliberately offending fixture
 * (`test/core/real-home-guard.test.ts`,
 * `test/core/real-home-guard-escape.test.ts`). Those runs TRIP on purpose, many
 * times per suite run, and their markers must not be left in the shared
 * directory where a later runner root that happens to be given the same pid
 * would honour one. It is not a switch that can turn the guard off: an unset or
 * empty value is the shared default, and no path makes the check skip.
 */
const TRIP_DIR = (() => {
  const override = process.env['MYCONTEXT_GUARD_TRIP_DIR'];
  return override !== undefined && override !== ''
    ? override
    : path.join(tmpdir(), 'mycontext-real-home-guard');
})();
const TRIP_MAX_AGE_MS = 30 * 60 * 1000;
const TRIP_PRUNE_AGE_MS = 24 * 60 * 60 * 1000;

function runId(): string {
  return process.env['NODE_TEST_CONTEXT'] !== undefined
    ? String(process.ppid)
    : String(process.pid);
}

const TRIP_FILE = path.join(TRIP_DIR, `${runId()}.trip.json`);

/** What one trip records: enough to name the escape without re-printing it. */
export interface TripRecord {
  at: string;
  target: string;
  entries: string[];
  seenAfter: string;
  report: string;
}

/**
 * The short message every OTHER test in the run fails with.
 *
 * Short deliberately. The full report belongs where it was seen; repeating it
 * across the thousands of tests a tripped run still has queued would bury the
 * one copy that has the context. What every copy DOES carry is the path, the
 * entries and the test that was running — the attribution, which is the whole
 * complaint against the version of this guard that reported and moved on.
 */
export function describeAbort(trip: TripRecord): string {
  return [
    'The test run was ABORTED: something in it wrote outside the sandbox.',
    '',
    `  ${trip.target}`,
    ...trip.entries.map((entry) => `  ${entry}`),
    `  seen after: ${trip.seenAfter}`,
    '',
    'This test is failing because the RUN is failing, not because of anything it',
    'did. Do not read it as a flake — one escape used to spread itself over',
    'whichever unrelated tests happened to be running (15 failures in one lane and',
    '19 in another, over different tests, on 2026-08-30), and that is what this',
    'message exists to stop.',
    '',
    'The full report was printed by the process that saw it, and is also in:',
    `  ${TRIP_FILE}`,
    '',
    'See test/helpers/real-home-guard.ts.',
  ].join('\n');
}

const baselines = new Map<string, Map<string, string>>();
const targetsByPath = new Map<string, WatchTarget>();
/** Watched targets small enough to re-scan after every single test. */
const perTestPaths = new Set<string>();
let installed = false;
/** The last test to finish in this process — the hint in a file-level report. */
let lastTest = '(no test had finished yet)';
/** Latched once this process has seen, or learnt of, an escape. */
let tripped: TripRecord | null = null;

/**
 * Records the escape for the rest of the run and latches it here. Every
 * filesystem step is best-effort: a guard that threw from its own bookkeeping
 * would take down runs it was supposed to protect, and the local latch and the
 * thrown report do not depend on the file being written.
 */
function trip(record: TripRecord): void {
  if (tripped === null) tripped = record;
  process.exitCode = 1;
  try {
    mkdirSync(TRIP_DIR, { recursive: true });
    writeFileSync(TRIP_FILE, JSON.stringify(record, null, 2), 'utf8');
  } catch { /* the local latch and the printed report still stand */ }
}

/** The trip recorded by any process in this run, if it is still fresh. */
function readTrip(): TripRecord | null {
  if (tripped !== null) return tripped;
  try {
    const st = statSync(TRIP_FILE);
    if (Date.now() - st.mtimeMs > TRIP_MAX_AGE_MS) return null;
    const parsed = JSON.parse(readFileSync(TRIP_FILE, 'utf8')) as TripRecord;
    if (typeof parsed?.target !== 'string') return null;
    tripped = parsed;
    process.exitCode = 1;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Sweeps markers left by runs that are over. Best-effort, never throws.
 *
 * A marker is swept when the runner root it names is no longer running —
 * `process.kill(pid, 0)` signals nothing and only reports whether the pid can
 * be signalled — or when it is older than `TRIP_PRUNE_AGE_MS` regardless. The
 * liveness half is what keeps the directory from accumulating markers whose
 * pid a later runner root could be given, which is the only way this mechanism
 * can lie; the age half covers a pid that has been recycled by something else
 * entirely and is therefore "alive" while meaning nothing.
 */
function pruneOldTrips(): void {
  try {
    for (const name of readdirSync(TRIP_DIR)) {
      const file = path.join(TRIP_DIR, name);
      if (file === TRIP_FILE) continue;
      const pid = Number.parseInt(name, 10);
      if (Number.isFinite(pid) && pid > 0 && !isAlive(pid)) {
        rmSync(file, { force: true });
        continue;
      }
      if (Date.now() - statSync(file).mtimeMs > TRIP_PRUNE_AGE_MS) {
        rmSync(file, { force: true });
      }
    }
  } catch { /* nothing to sweep, or someone else swept it */ }
}

/** Whether a pid can be signalled — EPERM means it exists and is not ours. */
function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

function tripFromOffence(target: WatchTarget, changes: TreeChange[], seenAfter: string): string {
  const report = describeOffence(
    target.kind === 'file' ? path.dirname(target.path) : target.path,
    changes, seenAfter, target.kind,
  );
  trip({
    at: new Date().toISOString(),
    target: target.path,
    entries: changes.map((change) => `${change.kind.padEnd(8)} ${change.entry}`),
    seenAfter,
    report,
  });
  return report;
}

/**
 * Compares every watched target against its baseline and returns one report
 * per offending target, re-baselining as it goes so that a single stray file
 * is reported once rather than by every check that runs after it.
 *
 * Re-baselining is what makes a SECOND, different escape visible; the run is
 * not let off by it, because the first offence has already latched `tripped`.
 */
export function checkWatchedDirs(
  seenAfter: string, targets: Iterable<string> = WATCHED_TARGETS.map((t) => t.path),
): string[] {
  const offences: string[] = [];
  for (const targetPath of targets) {
    const target = targetsByPath.get(targetPath);
    const before = baselines.get(targetPath);
    if (target === undefined || before === undefined) continue;
    const current = snapshotTarget(target);
    const changes = diffTrees(before, current);
    if (changes.length === 0) continue;
    // Re-baselined on ANY change, forgiven or not: a stray file is reported
    // once rather than by every check that runs after it, and a forgiven one is
    // not re-diffed by every remaining test in the file either.
    baselines.set(targetPath, current);
    // A watched FILE has no product-owned entries: nothing but this product
    // writes `settings.json`, and Claude Code rewriting its own settings while
    // the suite runs is a thing to be told about, not a thing to forgive.
    const offending = target.kind === 'file' ? changes : offendingChanges(changes);
    if (offending.length === 0) continue;
    offences.push(tripFromOffence(target, offending, seenAfter));
  }
  return offences;
}

/**
 * Contamination present in a watched TREE before the run began — see
 * `describePreexisting`. Only trees: a `settings.json` that merely EXISTS is
 * the normal state of a developer's machine and says nothing.
 */
function preexistingOffences(): string[] {
  const reports: string[] = [];
  for (const target of WATCHED_TARGETS) {
    if (target.kind !== 'tree') continue;
    const baseline = baselines.get(target.path);
    if (baseline === undefined) continue;
    const entries = [...baseline.keys()]
      .filter((entry) => entry !== '.' && !isProductOwned(entry))
      .sort((a, b) => a.localeCompare(b));
    if (entries.length === 0) continue;
    const report = describePreexisting(target.path, entries);
    trip({
      at: new Date().toISOString(),
      target: target.path,
      entries: entries.map((entry) => `present  ${entry}`),
      seenAfter: '(already there when the run started)',
      report,
    });
    reports.push(report);
  }
  return reports;
}

/**
 * Takes the baseline and registers the checks. Called once, from the `--import`
 * preload, so that it happens before any test file's top-level code runs.
 *
 * Four checks, narrowest to widest:
 *  - a root `before` refuses to run the file at all when the baseline is
 *    already contaminated, or when another process in this run has already
 *    tripped — the fail-fast half;
 *  - `afterEach` names the test, and covers the targets small enough to
 *    re-scan that often (see the limit above);
 *  - a root `after` covers EVERY watched target — including one too large
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

  for (const target of WATCHED_TARGETS) {
    targetsByPath.set(target.path, target);
    const baseline = snapshotTarget(target);
    baselines.set(target.path, baseline);
    if (baseline.size <= PER_TEST_ENTRY_LIMIT) perTestPaths.add(target.path);
  }
  pruneOldTrips();
  const preexisting = preexistingOffences();

  const where = (testName?: string): string => {
    const file = process.argv[1] ?? '(unknown file)';
    return testName === undefined
      ? `${file} (file-level check; last test to finish: ${lastTest})`
      : `${file} > ${testName}`;
  };

  before(() => {
    if (preexisting.length > 0) throw new Error(preexisting.join('\n\n'));
    const earlier = readTrip();
    if (earlier !== null) throw new Error(describeAbort(earlier));
  });

  afterEach((t) => {
    const named = typeof t?.name === 'string' ? `"${t.name}"` : undefined;
    if (named !== undefined) lastTest = named;
    const offences = perTestPaths.size === 0 ? [] : checkWatchedDirs(where(named), perTestPaths);
    if (offences.length > 0) throw new Error(offences.join('\n\n'));
    // No new escape here — but the run may have been tripped by this process
    // earlier, or by another one. A tripped run does not go green afterwards.
    const earlier = readTrip();
    if (earlier !== null) throw new Error(describeAbort(earlier));
  });

  after(() => {
    const offences = checkWatchedDirs(where());
    if (offences.length > 0) throw new Error(offences.join('\n\n'));
    const earlier = readTrip();
    if (earlier !== null) throw new Error(describeAbort(earlier));
  });

  process.on('exit', () => {
    const offences = checkWatchedDirs(where());
    if (offences.length === 0) {
      if (tripped !== null) process.exitCode = 1;
      return;
    }
    process.stderr.write(`\n${offences.join('\n\n')}\n`);
    process.exitCode = 1;
  });
}
