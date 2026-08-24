import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir, userInfo } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import { WATCHED_DIRS, describeOffence, diffTrees, snapshotTree } from '../helpers/real-home-guard.ts';

/**
 * The proof for `test/helpers/real-home-guard.ts`, which fails the suite when
 * anything writes inside the developer's real `~/.my-context`.
 *
 * **A guard nobody has watched fire is a guard that reports the defect fixed
 * forever**, so the centre of this file is not the unit tests of the diff — it
 * is the pair of runs below, which drive the REAL preload (`pin-rendering.ts`,
 * the `--import` the `test` script uses) over a deliberately offending test
 * file and assert the run goes red, then over a well-behaved one and assert it
 * goes green. Both fixtures write the SAME item file; the only difference is
 * whether `HOME` was redirected before the guard took its baseline. That is
 * exactly the difference between a leak and `edit-global-layer.test.ts`.
 *
 * Both runs point `HOME`/`USERPROFILE` at a temp directory, so the offender
 * offends against a throwaway home and this file cannot itself become the
 * defect it is testing. Each fixture refuses to write at all unless it can see
 * that the redirect took effect.
 */

const PRELOAD = fileURLToPath(new URL('../helpers/pin-rendering.ts', import.meta.url));

/**
 * The offending fixture: an item written into `homedir()/.my-context` the way
 * a global-layer test's fixture writes one — once from the test process, once
 * from a spawned child, which is the case no `fs` patch inside the test process
 * could ever see.
 */
const OFFENDER = `
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

// Refuse to write anywhere but the throwaway home this fixture was handed. If
// the redirect ever stops working, this file must fail LOUDLY rather than
// quietly do the damage it exists to demonstrate.
if (homedir() !== process.env.PROBE_HOME) {
  throw new Error('PROBE_HOME did not take effect; refusing to write: ' + homedir());
}
const dir = path.join(homedir(), '.my-context', 'items', 'constraint');

test('a fixture written straight into the home directory', () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-guard-probe-inprocess.md'), 'x', 'utf8');
});

test('a fixture written by a spawned child', () => {
  const file = path.join(dir, 'CONST-guard-probe-child.md');
  const script =
    'const fs = require("node:fs");' +
    'fs.mkdirSync(' + JSON.stringify(dir) + ', { recursive: true });' +
    'fs.writeFileSync(' + JSON.stringify(file) + ', "x");';
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('probe child failed: ' + result.stderr);
});
`;

/**
 * The control, and the reason the offender above proves anything: the same
 * write, from a file that did what `test/cli/edit-global-layer.test.ts` does —
 * point `HOME`/`USERPROFILE` at a temp directory at the TOP of the file, before
 * anything resolves a global directory from it.
 */
const REDIRECTOR = `
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

process.env.HOME = process.env.PROBE_REDIRECT_HOME;
process.env.USERPROFILE = process.env.PROBE_REDIRECT_HOME;

test('a global-layer fixture written under a redirected HOME', () => {
  if (homedir() !== process.env.PROBE_REDIRECT_HOME) {
    throw new Error('the redirect did not take effect; refusing to write: ' + homedir());
  }
  const dir = path.join(homedir(), '.my-context', 'items', 'constraint');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'CONST-redirected.md'), 'x', 'utf8');
});
`;

/**
 * **The product's own writes, which are not the suite's.** A developer running
 * `mycontext ui` in another terminal writes `ui-sessions.json` into that exact
 * directory — correct, intended behaviour — and one loaded run reported it as
 * contamination 17 times. This fixture is that developer: it creates the store,
 * rewrites it at the same length the way an eviction does, has a CHILD rewrite it
 * the way a second server would, and leaves behind the temp file a writer that
 * died mid-rename leaves (`core/ui-sessions.ts` · `const tmp = ...target}.tmp`; · ~206).
 *
 * No backslash escape appears anywhere below: this string is a template literal,
 * so every escape in it is consumed HERE rather than reaching the fixture, and a
 * newline escape written inside a fixture's single-quoted string would become a
 * real newline there and a syntax error. Nested quoting goes through
 * `JSON.stringify` for the same reason.
 */
const PRODUCT_WRITER = `
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

if (homedir() !== process.env.PROBE_HOME) {
  throw new Error('PROBE_HOME did not take effect; refusing to write: ' + homedir());
}
const dir = path.join(homedir(), '.my-context');
const store = path.join(dir, 'ui-sessions.json');

test('the product creates its session store, directory and all', () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(store, JSON.stringify({ version: 1, sessions: ['aaaa'] }), 'utf8');
});

test('and rewrites it at the same length when a digest is evicted', () => {
  writeFileSync(store, JSON.stringify({ version: 1, sessions: ['bbbb'] }), 'utf8');
});

test('and a UI server in another terminal rewrites it from its own process', () => {
  const tmp = store + '.tmp';
  const body = JSON.stringify({ version: 1, sessions: [] });
  const script =
    'const fs = require("node:fs");' +
    'fs.writeFileSync(' + JSON.stringify(tmp) + ', ' + JSON.stringify(body) + ');' +
    'fs.renameSync(' + JSON.stringify(tmp) + ', ' + JSON.stringify(store) + ');';
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('probe child failed: ' + result.stderr);
});

test('and a writer that died mid-rename leaves its temp file behind', () => {
  writeFileSync(store + '.tmp', JSON.stringify({ version: 1, sessions: [] }), 'utf8');
});
`;

/**
 * **The offender that proves the ignore list did not become a blindfold**: one
 * test, writing the product's own store AND a config AND an item in the same
 * scan. The store has to be forgiven and its two neighbours must not be.
 */
const MIXED_OFFENDER = `
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

if (homedir() !== process.env.PROBE_HOME) {
  throw new Error('PROBE_HOME did not take effect; refusing to write: ' + homedir());
}
const dir = path.join(homedir(), '.my-context');

test('a fixture writing a config and an item beside the product store', () => {
  mkdirSync(path.join(dir, 'items', 'constraint'), { recursive: true });
  writeFileSync(path.join(dir, 'ui-sessions.json'), '{}', 'utf8');
  writeFileSync(path.join(dir, 'config.json'), '{}', 'utf8');
  writeFileSync(path.join(dir, 'items', 'constraint', 'CONST-mixed-probe.md'), 'x', 'utf8');
});
`;

interface GuardedRun { code: number | null; output: string }

/** Runs one fixture through the suite's own `--import` preload. */
function runGuarded(fixture: string, env: Record<string, string>): GuardedRun {
  // A test process is itself running under `node --test`, and the runner marks
  // that with `NODE_TEST_CONTEXT`. Inherited, it makes the nested runner print
  // "run() is being called recursively" and run NOTHING — a silent exit 0 that
  // would have made both assertions below vacuous. Removed, not overridden:
  // the value is a protocol version the child must not see at all.
  const childEnv: Record<string, string | undefined> = { ...process.env, ...env };
  delete childEnv['NODE_TEST_CONTEXT'];
  const result = spawnSync(
    process.execPath,
    [
      '--disable-warning=ExperimentalWarning',
      '--import', pathToFileURL(PRELOAD).href,
      '--test', fixture,
    ],
    { cwd: path.dirname(fixture), encoding: 'utf8', env: childEnv },
  );
  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function writeFixture(dir: string, name: string, source: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, source, 'utf8');
  return file;
}

test('the guard fires on a write into the home directory, and names the file and the test', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'myctx-guard-probe-'));
  try {
    // An EMPTY home, which is what makes the per-test attribution asserted
    // below deterministic: the guard decides how often to re-scan a directory
    // from that directory's entry count, so a throwaway home is always checked
    // after every test no matter how loaded the machine is. It was an
    // elapsed-time decision first, and this assertion is what caught it —
    // green run alone, red inside a full `npm test`.
    const home = path.join(workspace, 'home');
    mkdirSync(home);
    const fixture = writeFixture(workspace, 'offender.test.mjs', OFFENDER);
    const { code, output } = runGuarded(fixture, { HOME: home, USERPROFILE: home, PROBE_HOME: home });

    assert.notEqual(code, 0, `the run should have gone red:\n${output}`);
    assert.match(output, /REAL global directory/, output);
    assert.ok(
      output.includes(path.join(home, '.my-context')),
      `the report must name the directory it is defending:\n${output}`,
    );

    // The write made in the test process.
    assert.match(output, /created\s+items[\\/]constraint[\\/]CONST-guard-probe-inprocess\.md/, output);
    assert.match(
      output, /seen after: .*offender\.test\.mjs > "a fixture written straight into the home directory"/,
      `the report must name the test that did it:\n${output}`,
    );

    // And the write made by a CHILD process, which is the property that decided
    // the mechanism: a child inherits the environment and nothing else, so no
    // in-process interception could have seen this one.
    assert.match(output, /created\s+items[\\/]constraint[\\/]CONST-guard-probe-child\.md/, output);
    assert.match(
      output, /seen after: .*offender\.test\.mjs > "a fixture written by a spawned child"/,
      `a child's write must be attributed to the test that spawned it:\n${output}`,
    );

    // The report has to be usable by someone who has never read the guard.
    assert.match(output, /edit-global-layer\.test\.ts/, output);
    assert.match(output, /134 unrelated tests red/, output);
  } finally {
    removeTree(workspace);
  }
});

test('and does not fire for a test that redirects HOME first, which is the whole point', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'myctx-guard-control-'));
  try {
    const home = path.join(workspace, 'home');
    const redirected = path.join(workspace, 'redirected-home');
    mkdirSync(home);
    mkdirSync(redirected);
    const fixture = writeFixture(workspace, 'redirector.test.mjs', REDIRECTOR);
    const { code, output } = runGuarded(
      fixture, { HOME: home, USERPROFILE: home, PROBE_REDIRECT_HOME: redirected },
    );

    assert.equal(code, 0, `a redirected write must stay green:\n${output}`);
    assert.doesNotMatch(output, /REAL global directory/, output);
    // The control is only a control if the write actually happened.
    assert.ok(
      existsSync(path.join(redirected, '.my-context', 'items', 'constraint', 'CONST-redirected.md')),
      'the control fixture wrote nothing, so it proves nothing',
    );
    assert.equal(existsSync(path.join(home, '.my-context')), false);
  } finally {
    removeTree(workspace);
  }
});

/**
 * **The blind spot, and the remedy for it.** The mechanism is deliberately
 * blind to WHO wrote — that is why a spawned child cannot evade it — and the
 * same property means it cannot tell this suite from the developer's own copy
 * of the product running in another terminal. Measured on 2026-08-23: one
 * loaded run produced 17 guard failures from `ui-sessions.json` being written
 * while a UI server served the demo corpus in another window, and the agent
 * who hit them spent time deciding whether the defect was its own.
 *
 * A guard that cries wolf on the developer's own product is a guard that gets
 * switched off, which is exactly how the convention it replaced failed. So the
 * files the PRODUCT legitimately writes there during a normal run are ignored
 * — see `PRODUCT_OWNED_ENTRIES` — and this run is the proof that the ignore is
 * real rather than intended.
 */
test('the guard forgives the product writing its own session store there', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'myctx-guard-product-'));
  try {
    const home = path.join(workspace, 'home');
    mkdirSync(home);
    const fixture = writeFixture(workspace, 'product.test.mjs', PRODUCT_WRITER);
    const { code, output } = runGuarded(fixture, { HOME: home, USERPROFILE: home, PROBE_HOME: home });

    assert.equal(code, 0, `the developer's own product must not turn the suite red:\n${output}`);
    assert.doesNotMatch(output, /REAL global directory/, output);

    // The forgiveness is only forgiveness if the writes actually happened —
    // all four of them, including the directory the first test CREATED.
    const store = path.join(home, '.my-context', 'ui-sessions.json');
    assert.equal(readFileSync(store, 'utf8'), JSON.stringify({ version: 1, sessions: [] }),
      'the last write through the fixture was the child rename; the store does not hold it');
    assert.equal(existsSync(`${store}.tmp`), true,
      'the abandoned temp file is part of what has to be forgiven, and it was never written');
  } finally {
    removeTree(workspace);
  }
});

/**
 * And the half that matters more: the ignore is a NAMED SET, not a hole around
 * the whole directory. One test writes the product's store and, in the same
 * scan, a config and an item — the two shapes that turned 134 tests red. The
 * store is forgiven; its neighbours are reported, by name, in the same report.
 */
test('and still fires on a config or an item written beside it, in the same scan', () => {
  const workspace = mkdtempSync(path.join(tmpdir(), 'myctx-guard-mixed-'));
  try {
    const home = path.join(workspace, 'home');
    mkdirSync(home);
    const fixture = writeFixture(workspace, 'mixed.test.mjs', MIXED_OFFENDER);
    const { code, output } = runGuarded(fixture, { HOME: home, USERPROFILE: home, PROBE_HOME: home });

    assert.notEqual(code, 0, `an item and a config in the real home are still offences:\n${output}`);
    assert.match(output, /created\s+config\.json/, output);
    assert.match(output, /created\s+items[\\/]constraint[\\/]CONST-mixed-probe\.md/, output);

    // And the forgiven file is not among the paths it names. Asserted against
    // the CHANGE LINES rather than the whole report, because the report also
    // has to SAY the ignore list exists — see the next assertion.
    assert.doesNotMatch(output, /(created|modified|removed)\s+ui-sessions\.json/,
      `a forgiven file must not be listed as an offence:\n${output}`);

    // The reason this reader is not staring at a mystery: the report says the
    // ignore list exists and names it, so the next person does not rediscover
    // the item this remedy came from.
    assert.match(output, /ui-sessions\.json/, `the report must say what it ignores:\n${output}`);
    assert.match(output, /PRODUCT_OWNED_ENTRIES/, output);
  } finally {
    removeTree(workspace);
  }
});

test('the real global directory holds no corpus — one that does makes 134 tests lie', () => {
  // The check the task record asked for, stated as the suite's own precondition
  // rather than as a hope. `rebuildRoots` (src/core/open-store.ts) admits the
  // global layer whenever `~/.my-context` merely EXISTS, and `loadLayer` walks
  // its `items/` directory, so ANY item there is loaded by every sandboxed test
  // in this suite — which is how two stray files produced 134 failures that
  // each named an item the test had never heard of.
  //
  // `ui-sessions.json` is not a corpus and is deliberately not covered: it is
  // a real thing a real developer has, and the suite is pinned away from it in
  // `pin-rendering.ts` and `test/ui/helpers.ts`.
  for (const dir of WATCHED_DIRS) {
    const items = path.join(dir, 'items');
    if (!existsSync(items)) continue;
    const stray = readdirSync(items, { recursive: true })
      .map(String)
      .filter((entry) => entry.endsWith('.md'));
    assert.deepEqual(
      stray, [],
      `${items} holds items that this suite did not create. Every sandboxed test ` +
      `loads them and will report a diff full of an item it never heard of — the ` +
      `2026-08-22 failure, 134 tests red, in which nothing named the home directory. ` +
      `Move the directory aside before running the suite. The tests that legitimately ` +
      `exercise the global layer (test/cli/edit-global-layer.test.ts, ` +
      `test/cli/supersede-global-layer.test.ts) never write here: they redirect HOME ` +
      `first. Stray files:\n${stray.join('\n')}`,
    );
  }
});

test('the guard watches the OS account home, not whatever HOME currently says', () => {
  // `homedir()` reads HOME/USERPROFILE and several test files move them.
  // `userInfo().homedir` comes from the OS account and ignores the environment,
  // so watching it too keeps the guard aimed at the real directory even in a
  // process that was started with HOME already redirected.
  assert.ok(
    WATCHED_DIRS.includes(path.join(userInfo().homedir, '.my-context')),
    `WATCHED_DIRS must cover the OS account's own home: ${WATCHED_DIRS.join(', ')}`,
  );
});

test('a snapshot reports a created file, a deleted one, and a same-length rewrite', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-guard-diff-'));
  const dir = path.join(root, 'watched');
  try {
    // Absent and empty are both acceptable baselines, and creating the
    // directory is itself a change.
    assert.equal(snapshotTree(dir).size, 0);
    mkdirSync(path.join(dir, 'items', 'constraint'), { recursive: true });
    const kept = path.join(dir, 'ui-sessions.json');
    const doomed = path.join(dir, 'items', 'constraint', 'CONST-doomed.md');
    writeFileSync(kept, 'aaaa', 'utf8');
    writeFileSync(doomed, 'x', 'utf8');
    const before = snapshotTree(dir);
    assert.ok(before.has('.'), 'the directory itself must be recorded, or its creation is invisible');

    writeFileSync(path.join(dir, 'items', 'constraint', 'CONST-new.md'), 'x', 'utf8');
    // A same-LENGTH rewrite, which is the shape an evicted `ui-sessions.json`
    // takes. Windows stamps mtimes from a ~15.6ms clock, so size and mtime
    // alone miss this one about 1 time in 5 — measured. The digest is what
    // makes it deterministic.
    writeFileSync(kept, 'bbbb', 'utf8');
    removeTree(doomed);

    assert.deepEqual(diffTrees(before, snapshotTree(dir)), [
      { kind: 'removed', entry: path.join('items', 'constraint', 'CONST-doomed.md') },
      { kind: 'created', entry: path.join('items', 'constraint', 'CONST-new.md') },
      { kind: 'modified', entry: 'ui-sessions.json' },
    ]);

    // And nothing is reported when nothing moved, or the guard is a nuisance
    // rather than a signal.
    assert.deepEqual(diffTrees(snapshotTree(dir), snapshotTree(dir)), []);
  } finally {
    removeTree(root);
  }
});

test('the report names the directory, every path, and where it was seen', () => {
  const report = describeOffence(
    path.join('C:', 'Users', 'someone', '.my-context'),
    [{ kind: 'created', entry: path.join('items', 'constraint', 'CONST-global-one.md') }],
    'test/cli/some.test.ts > "a test"',
  );
  assert.match(report, /CONST-global-one\.md/);
  assert.match(report, /seen after: test\/cli\/some\.test\.ts > "a test"/);
  assert.match(report, /MYCONTEXT_UI_SESSIONS_DIR/);
  assert.match(report, /child process/);
});

test('the guard is wired into the way the project runs its tests', () => {
  // A guard reachable only from a helper nobody imports is not a guard. These
  // two assertions are what stop it being silently unhooked: the `--import`
  // preload in package.json, and the preload actually installing it.
  const repo = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));
  const pkg = JSON.parse(readFileSync(path.join(repo, 'package.json'), 'utf8')) as
    { scripts?: Record<string, string> };
  for (const [name, script] of Object.entries(pkg.scripts ?? {})) {
    if (!script.includes('--test')) continue;
    assert.match(
      script, /--import \.\/test\/helpers\/pin-rendering\.ts/,
      `the "${name}" script runs tests without the preload that installs the ` +
      `real-home guard (and pins the rendering): ${script}`,
    );
  }
  assert.match(
    readFileSync(path.join(repo, 'test', 'helpers', 'pin-rendering.ts'), 'utf8'),
    /installRealHomeGuard\(\)/,
    'the preload no longer installs the real-home guard',
  );
});
