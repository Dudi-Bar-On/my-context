import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';
import {
  WATCHED_DIRS, WATCHED_FILES, WATCHED_TARGETS, isProductOwned,
} from '../helpers/real-home-guard.ts';

/**
 * **The guard has to be watched failing, or it is the next thing measuring
 * nothing.** `test/core/real-home-guard.test.ts` proves it fires on a write
 * into `~/.my-context` and names the test. This file proves the three things
 * that were still missing on 2026-08-30, when a probe ran
 * `mycontext statusline install --yes` against the developer's real machine:
 *
 *  1. the escape that actually happened is now SEEN. It rewrote
 *     `~/.claude/settings.json`, which the guard was not watching at all — it
 *     was watching the other half of the same write;
 *  2. the escape fails the RUN and not one arbitrary test. One escape used to
 *     spread itself across whichever unrelated tests happened to be running
 *     next — 15 failures in one lane and 19 in another, over different tests,
 *     on the same day, and both lanes read it as flakiness;
 *  3. a stray file left behind by a previous run is refused rather than
 *     absorbed into the baseline, which is what made the escape invisible on
 *     every run after the one that caused it.
 *
 * And, because a boundary drawn by accident moves: the last three tests assert
 * where the sandbox line IS — that the rest of `~/.claude` is not watched, that
 * nothing inside this repository is watched, and that `src/` has not grown a
 * reach into the home directory that the line does not cover.
 *
 * Every run below points `HOME`/`USERPROFILE` at a throwaway directory and
 * every fixture refuses to write unless it can see that the redirect took
 * effect, so this file cannot become the defect it is testing.
 */

const PRELOAD = fileURLToPath(new URL('../helpers/pin-rendering.ts', import.meta.url));
const REPO = path.resolve(fileURLToPath(new URL('../..', import.meta.url)));

/**
 * Refuses to run unless the throwaway home took effect. Prepended to every
 * fixture below: a probe for a defect whose whole nature is writing where it
 * should not must fail loudly rather than quietly do the damage.
 */
const GUARDED_PREAMBLE = `
import { homedir } from 'node:os';
if (homedir() !== process.env.PROBE_HOME) {
  throw new Error('PROBE_HOME did not take effect; refusing to write: ' + homedir());
}
`;

/**
 * The 2026-08-30 escape, reduced to its filesystem effect: the settings file
 * Claude Code itself reads, rewritten from a SPAWNED CHILD — which is how it
 * happened, and the case no in-process `fs` patch could see.
 *
 * `statusline install --yes` writes the whole document back
 * (`src/cli/commands/statusline-install.ts`), so the fixture does too.
 */
const SETTINGS_OFFENDER = `${GUARDED_PREAMBLE}
import { test } from 'node:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(homedir(), '.claude');
const settings = path.join(dir, 'settings.json');

test('a statusLine installed into the real settings file', () => {
  mkdirSync(dir, { recursive: true });
  const body = JSON.stringify({ statusLine: { type: 'command', command: 'mycontext statusline' } });
  const script =
    'const fs = require("node:fs");' +
    'fs.writeFileSync(' + JSON.stringify(settings) + ', ' + JSON.stringify(body) + ');';
  const result = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error('probe child failed: ' + result.stderr);
});

test('and a second test in the same file, which did nothing wrong', () => {
  // Reached only because the guard does NOT abort the offending file: the file
  // that is escaping is where the attribution lives, and stopping it early
  // would throw away the report for a second, different escape.
});
`;

/**
 * The rest of `~/.claude`, which is Claude Code's own working directory and not
 * this product's: a running session appends to `history.jsonl` and rewrites
 * caches continuously, and no scan could tell that from a test's write. The
 * line is drawn at `settings.json`, the one entry anything here writes.
 */
const CLAUDE_NEIGHBOURS = `${GUARDED_PREAMBLE}
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(homedir(), '.claude');

test('Claude Code writes its own history and caches while the suite runs', () => {
  mkdirSync(path.join(dir, 'projects', 'some-project'), { recursive: true });
  writeFileSync(path.join(dir, 'history.jsonl'), '{"one":1}\\n', 'utf8');
  writeFileSync(path.join(dir, 'projects', 'some-project', 'a.jsonl'), '{}\\n', 'utf8');
});
`;

/** The product's liveness record and its pid-suffixed temp file. */
const UI_SERVER_WRITER = `${GUARDED_PREAMBLE}
import { test } from 'node:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const dir = path.join(homedir(), '.my-context');

test('a mycontext ui in another terminal records that it is alive', () => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, 'ui-server.json.tmp-4242'), '{}', 'utf8');
  writeFileSync(path.join(dir, 'ui-server.json'), '{"port":58888}', 'utf8');
});
`;

/**
 * A file that does nothing at all, and writes a sentinel so a run can be told
 * apart from a run whose tests never started.
 */
function innocent(sentinel: string): string {
  return `
import { test } from 'node:test';
import { writeFileSync } from 'node:fs';

test('an unrelated test in an unrelated file', () => {
  writeFileSync(${JSON.stringify(sentinel)}, 'ran', 'utf8');
});
`;
}

interface GuardedRun { code: number | null; output: string }

/**
 * Runs fixtures through the suite's own `--import` preload — the real one the
 * `test` script uses, so what is under test is the guard as it ships.
 *
 * `--test-concurrency=1` because the point of the two-file runs below is
 * ORDER: the offender must finish before the innocent file starts, which is
 * exactly the case the old guard was blind to (a process that starts after the
 * stray file exists takes it into its own baseline and never mentions it).
 * The runner takes the files in NAME order rather than argument order —
 * measured, by running the same pair named the other way round — which is why
 * the fixtures below are called `a-offender` and `b-innocent`.
 */
function runGuarded(fixtures: string[], env: Record<string, string>): GuardedRun {
  // A test process is itself running under `node --test`, and the runner marks
  // that with `NODE_TEST_CONTEXT`. Inherited, it makes the nested runner print
  // "run() is being called recursively" and run NOTHING — a silent exit 0 that
  // would make every assertion below vacuous.
  const first = fixtures[0] ?? '';
  const childEnv: Record<string, string | undefined> = {
    ...process.env,
    // These runs trip on purpose. Their markers belong to the throwaway
    // workspace, never to the shared directory a real run reads.
    MYCONTEXT_GUARD_TRIP_DIR: path.join(path.dirname(first), 'guard-trips'),
    ...env,
  };
  delete childEnv['NODE_TEST_CONTEXT'];
  // The guard resolves the settings file the way `claudeSettingsPath` does, so
  // an inherited CLAUDE_CONFIG_DIR would aim it away from the throwaway home.
  delete childEnv['CLAUDE_CONFIG_DIR'];
  const result = spawnSync(
    process.execPath,
    [
      '--disable-warning=ExperimentalWarning',
      '--import', pathToFileURL(PRELOAD).href,
      '--test', '--test-concurrency=1', ...fixtures,
    ],
    { cwd: path.dirname(first), encoding: 'utf8', env: childEnv },
  );
  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

function writeFixture(dir: string, name: string, source: string): string {
  const file = path.join(dir, name);
  writeFileSync(file, source, 'utf8');
  return file;
}

interface Workspace { root: string; home: string }

function makeWorkspace(label: string): Workspace {
  const root = mkdtempSync(path.join(tmpdir(), `myctx-${label}-`));
  const home = path.join(root, 'home');
  mkdirSync(home);
  return { root, home };
}

test('a deliberate escape into the real Claude Code settings file fails the run', () => {
  const { root, home } = makeWorkspace('guard-settings');
  try {
    const fixture = writeFixture(root, 'settings-offender.test.mjs', SETTINGS_OFFENDER);
    const { code, output } = runGuarded(
      [fixture], { HOME: home, USERPROFILE: home, PROBE_HOME: home },
    );

    // The escape happened — a probe that quietly wrote nothing proves nothing.
    assert.equal(
      existsSync(path.join(home, '.claude', 'settings.json')), true,
      'the fixture never wrote the settings file, so this run tests nothing',
    );

    assert.notEqual(code, 0, `the run should have gone red:\n${output}`);
    assert.match(output, /REAL Claude Code settings file/, output);
    assert.ok(
      output.includes(path.join(home, '.claude')),
      `the report must name the directory it is defending:\n${output}`,
    );
    assert.match(output, /created\s+settings\.json/, output);

    // Attributable: the path is not enough on its own, and "something wrote
    // outside the sandbox" with no test name is barely better than a report.
    assert.match(
      output,
      /seen after: .*settings-offender\.test\.mjs > "a statusLine installed into the real settings file"/,
      `the report must name the test that did it:\n${output}`,
    );

    // Usable by someone who has never read the guard: what to do instead.
    assert.match(output, /--settings/, output);
    assert.match(output, /globalRoot/, output);

    // The file that escaped does not go green afterwards. Its second test did
    // nothing wrong and still fails, because the RUN is failing.
    assert.match(
      output, /The test run was ABORTED/,
      `a tripped process must not report a clean tail:\n${output}`,
    );
  } finally {
    removeTree(root);
  }
});

test('and every OTHER file in the same run fails on that escape, naming it', () => {
  const { root, home } = makeWorkspace('guard-spread');
  try {
    const sentinel = path.join(root, 'innocent-ran.txt');
    const offender = writeFixture(root, 'a-offender.test.mjs', SETTINGS_OFFENDER);
    const bystander = writeFixture(root, 'b-innocent.test.mjs', innocent(sentinel));
    const { code, output } = runGuarded(
      [offender, bystander], { HOME: home, USERPROFILE: home, PROBE_HOME: home },
    );

    assert.notEqual(code, 0, `the run should have gone red:\n${output}`);

    // The bystander is refused before its body runs. This is the whole
    // deliverable: an escape stops the run instead of being absorbed by every
    // process that starts afterwards.
    assert.equal(
      existsSync(sentinel), false,
      `a file that started after the escape must not run its tests:\n${output}`,
    );
    assert.match(output, /The test run was ABORTED/, output);

    // And it fails ATTRIBUTABLY: the same path and the same test as the
    // original report, so nobody reads it as a flake in an unrelated file.
    assert.ok(
      output.includes(path.join(home, '.claude', 'settings.json')),
      `the abort must name the path that escaped:\n${output}`,
    );
    assert.match(
      output, /seen after: .*a-offender\.test\.mjs > "a statusLine installed into the real settings file"/,
      `the abort must name the test that escaped:\n${output}`,
    );

    // The abort says so in as many words, because the failure it replaces was
    // read as flakiness twice on one day.
    assert.match(output, /Do not read it as a flake/, output);

    // One full report, not one per bystander: the copy with the context is the
    // one the reader has to find.
    const fullReports = output.match(/REAL Claude Code settings file/g) ?? [];
    assert.equal(fullReports.length, 1, `the full report should appear once:\n${output}`);
  } finally {
    removeTree(root);
  }
});

test('a stray file already there when the run starts is refused, not absorbed', () => {
  const { root, home } = makeWorkspace('guard-preexisting');
  try {
    // Exactly what the 2026-08-30 escape left on disk. A before/after check is
    // blind to it — it is in the baseline — so every later run went green on
    // the guard and red on whatever the stray file poisoned.
    const stray = path.join(home, '.my-context', 'items', 'constraint', 'CONST-left-behind.md');
    mkdirSync(path.dirname(stray), { recursive: true });
    writeFileSync(stray, 'x', 'utf8');

    const sentinel = path.join(root, 'innocent-ran.txt');
    const fixture = writeFixture(root, 'innocent.test.mjs', innocent(sentinel));
    const { code, output } = runGuarded([fixture], { HOME: home, USERPROFILE: home });

    assert.notEqual(code, 0, `a contaminated baseline must fail the run:\n${output}`);
    assert.match(output, /already holds files this suite did not/, output);
    assert.match(output, /present\s+items[\\/]constraint[\\/]CONST-left-behind\.md/, output);
    assert.equal(
      existsSync(sentinel), false,
      `no test may run against a contaminated global directory:\n${output}`,
    );

    // Refused, not tidied away. A guard that deleted the evidence would report
    // the defect fixed forever, and the stray file is what a person has to see.
    assert.equal(existsSync(stray), true, 'the guard must not delete the evidence');
    assert.match(output, /Move the paths above aside yourself/, output);
  } finally {
    removeTree(root);
  }
});

test('the rest of ~/.claude is not watched — the line is settings.json', () => {
  const { root, home } = makeWorkspace('guard-claude-rest');
  try {
    const fixture = writeFixture(root, 'neighbours.test.mjs', CLAUDE_NEIGHBOURS);
    const { code, output } = runGuarded(
      [fixture], { HOME: home, USERPROFILE: home, PROBE_HOME: home },
    );

    assert.equal(
      existsSync(path.join(home, '.claude', 'history.jsonl')), true,
      'the fixture wrote nothing, so it proves nothing',
    );
    assert.equal(code, 0, `Claude Code's own working files must not turn the suite red:\n${output}`);
    assert.doesNotMatch(output, /REAL Claude Code settings file/, output);
  } finally {
    removeTree(root);
  }
});

test('and the product recording that its UI server is alive is forgiven', () => {
  const { root, home } = makeWorkspace('guard-ui-server');
  try {
    const fixture = writeFixture(root, 'ui-server.test.mjs', UI_SERVER_WRITER);
    const { code, output } = runGuarded(
      [fixture], { HOME: home, USERPROFILE: home, PROBE_HOME: home },
    );

    assert.equal(
      existsSync(path.join(home, '.my-context', 'ui-server.json')), true,
      'the fixture wrote nothing, so it proves nothing',
    );
    assert.equal(code, 0, `a mycontext ui in another terminal must not turn the suite red:\n${output}`);
    assert.doesNotMatch(output, /REAL global directory/, output);

    // The temp file carries the writer's pid (`core/ui-server-record.ts`), so a
    // fixed name could not cover it and the forgiveness is by pattern.
    assert.equal(isProductOwned('ui-server.json.tmp-4242'), true);
    assert.equal(isProductOwned('ui-server.json.tmp-'), false);
    assert.equal(isProductOwned('statusline-replaced.json'), false,
      'the file the 2026-08-30 escape created is never forgiven');
  } finally {
    removeTree(root);
  }
});

test('nothing inside this repository is watched — a working tree is not an escape', () => {
  // The other half of the sandbox line, and the half a guard gets wrong by
  // widening: a test that dirties the checkout is visible in `git status`,
  // readable as a diff and recoverable by the person who owns it. What is
  // watched is the state that exists on exactly one machine and nowhere else.
  for (const target of WATCHED_TARGETS) {
    const rel = path.relative(REPO, target.path);
    assert.ok(
      rel.startsWith('..') || path.isAbsolute(rel),
      `${target.path} is inside the repository, which is not what this guard defends`,
    );
  }
  assert.ok(WATCHED_DIRS.length > 0 && WATCHED_FILES.length > 0,
    `the guard must watch both shapes: ${JSON.stringify(WATCHED_TARGETS)}`);
});

test('src/ has not grown a home-directory reach the sandbox line does not cover', () => {
  // A silence audit for the boundary itself. The line covers the reaches this
  // product HAS; a new one added in `src/` would be outside it and unwatched,
  // which is exactly the state `~/.claude/settings.json` was in on 2026-08-30.
  const reaches = new Map<string, string>([
    [path.join('src', 'core', 'workspace.ts'), "path.join(homedir(), '.my-context')"],
    [path.join('src', 'cli', 'commands', 'statusline-install.ts'), "path.join(homedir(), '.claude')"],
  ]);
  for (const [file, expression] of reaches) {
    assert.ok(
      readFileSync(path.join(REPO, file), 'utf8').includes(expression),
      `${file} no longer reaches the home directory with ${expression}; the guard's ` +
      `watch list was built from that expression and has to be rebuilt from the new one`,
    );
  }

  const found = spawnSync(
    process.execPath,
    ['-e', `
      const { readdirSync, readFileSync } = require('node:fs');
      const path = require('node:path');
      const hits = [];
      const walk = (dir) => {
        for (const e of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, e.name);
          if (e.isDirectory()) { walk(full); continue; }
          if (!full.endsWith('.ts')) continue;
          const text = readFileSync(full, 'utf8');
          text.split('\\n').forEach((line, i) => {
            if (/^\\s*(\\/\\/|\\*|\\/\\*)/.test(line)) return;
            if (line.includes('homedir()')) hits.push(path.relative(process.argv[1], full) + ':' + (i + 1));
          });
        }
      };
      walk(path.join(process.argv[1], 'src'));
      process.stdout.write(hits.join('\\n'));
    `, REPO],
    { encoding: 'utf8' },
  );
  assert.equal(found.status, 0, found.stderr);
  const sites = found.stdout.split('\n').filter((line) => line !== '');
  assert.equal(
    sites.length, reaches.size,
    `src/ calls homedir() at ${sites.length} places and the guard's sandbox line was ` +
    `drawn around ${reaches.size} of them. Widen WATCHED_TARGETS in ` +
    `test/helpers/real-home-guard.ts, and say in the doc block why the new reach is ` +
    `watched whole or watched as one file. Sites:\n${sites.join('\n')}`,
  );
});
