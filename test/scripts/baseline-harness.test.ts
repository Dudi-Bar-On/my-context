// @basis TASK-four-gates-cannot-tell-nothing-went-wrong-from-nothing, INV-nothing-is-dropped-silently, RULE-harness-cases-must-reach-the-behaviour-they-name, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`harness/baseline.mjs` — the gate that said "baseline matches the pin"
 * without running a test.**
 *
 * Measured 2026-09-14, on the tree as committed: `node harness/baseline.mjs`
 * printed `failed: 0  known-red: 11`, listed all eleven pinned tests as "no
 * longer failing", said the baseline matched, and exited 0 — in under a
 * second, having spawned `npm test` into a directory that does not exist.
 * `REF-campaign-handover-read-this-before-acting-on-any-finding` tells its
 * reader to run this and expect `failed: 11  known-red: 11`.
 *
 * Two things made that possible and both are repaired:
 * `harness/lib/workspace.mjs`'s `REPO` pointed at `<repo>/my-context`, and the
 * spawn's `.catch` flattened "never started" into an empty string that parses
 * to zero failures.
 *
 * ── WHY THIS TEST IS HERE AND NOT IN `harness/self-test/` ───────────────────
 *
 * `package.json`'s `test` script globs `test/**​/*.test.ts`. Nothing runs
 * `harness/self-test/`, so a case written there would be a second gate wired
 * to nothing — which is the defect one level up. It lives here so `npm test`
 * reaches it.
 *
 * ── WHY IT SPAWNS RATHER THAN IMPORTS ───────────────────────────────────────
 *
 * `harness/` is outside `tsconfig.json`'s `include`, so a `.ts` file importing
 * `baseline.mjs` would have to carry a hand-written declaration for it. The
 * script takes `--from-file`, which is a real affordance (diff a suite log
 * captured earlier) and not test-only machinery, so the verdict is driven over
 * planted logs through the same door a person uses.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { removeTree } from '../helpers/tmp.ts';

const REPO = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const SCRIPT = path.join(REPO, 'harness', 'baseline.mjs');

/** The pinned names, read out of the script rather than copied beside it. */
function knownRed(): string[] {
  const src = readFileSync(SCRIPT, 'utf8');
  const block = /export const KNOWN_RED = new Set\(\[([\s\S]*?)\]\);/.exec(src);
  assert.notEqual(block, null, 'KNOWN_RED is no longer a literal Set this test can read');
  return [...block![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

/** Run the script over a planted suite log. */
function run(log: string): { code: number; out: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-baseline-'));
  const file = path.join(dir, 'suite.log');
  try {
    writeFileSync(file, log, 'utf8');
    try {
      const out = execFileSync(process.execPath, [SCRIPT, '--from-file', file], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
      });
      return { code: 0, out };
    } catch (e) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      return { code: err.status ?? -1, out: (err.stdout ?? '') + (err.stderr ?? '') };
    }
  } finally {
    removeTree(dir);
  }
}

/** A Node test-runner log in which exactly `names` failed. */
function suiteLog(names: string[], passes = 3): string {
  const lines: string[] = [];
  for (let i = 0; i < passes; i++) lines.push(`✔ a test that passed ${i} (1.2ms)`);
  for (const n of names) lines.push(`✖ ${n} (1.2ms)`);
  lines.push('ℹ tests ' + String(passes + names.length));
  lines.push('failing tests:');
  // The runner prints every failure a second time in its summary block, which
  // is the thing `failedTests` has to dedupe. Planting it keeps that clause
  // honest instead of assumed.
  for (const n of names) lines.push(`✖ ${n} (1.2ms)`);
  return lines.join('\n') + '\n';
}

/* ── THE FLOOR: NOTHING HAPPENED IS NOT NOTHING WENT WRONG ─────────────────── */

test('an EMPTY suite log is refused, not summarised as zero failures', () => {
  // The exact defect. Before the repair this printed `failed: 0` and
  // `baseline matches the pin`, and exited 0.
  const r = run('');
  assert.equal(r.code, 1, `an empty log must not read as a clean run. Output:\n${r.out}`);
  assert.match(r.out, /REFUSED/);
  assert.match(r.out, /nothing was measured/);
  assert.doesNotMatch(r.out, /baseline matches the pin/);
});

test('output that is not a test run at all is refused the same way', () => {
  for (const junk of [
    'npm ERR! Missing script: "test"\n',
    "node:internal/modules/cjs/loader:1459\nError: Cannot find module\n",
    '   \n\n',
  ]) {
    const r = run(junk);
    assert.equal(r.code, 1, `this is not a suite run and must be refused:\n${junk}`);
    assert.match(r.out, /REFUSED/);
  }
});

test('the floor is a SHAPE, not a count — one passing test is a run', () => {
  // A floor that demanded "at least N tests" would be a second baseline to
  // keep. What is in question is whether the suite ran, not how big it is.
  const r = run('✔ one test (1ms)\nℹ tests 1\n');
  assert.doesNotMatch(r.out, /REFUSED/, 'a real run with one test was refused');
});

/* ── THE VERDICT, IN BOTH DIRECTIONS ───────────────────────────────────────── */

test('exactly the pinned set failing is GREEN, and says so', () => {
  const r = run(suiteLog(knownRed()));
  assert.equal(r.code, 0, `the pinned set is the expected state. Output:\n${r.out}`);
  assert.match(r.out, /baseline matches the pin/);
  assert.match(r.out, new RegExp(`failed: ${knownRed().length}\\s+known-red: ${knownRed().length}`));
  assert.doesNotMatch(r.out, /NEW FAILURES/);
  assert.doesNotMatch(r.out, /no longer failing/);
});

test('one failure outside the pinned set is RED and names only that one', () => {
  const pinned = knownRed();
  const r = run(suiteLog([...pinned, 'a test nobody pinned']));
  assert.equal(r.code, 1, `a new failure must fail the run. Output:\n${r.out}`);
  assert.match(r.out, /NEW FAILURES/);
  assert.match(r.out, /a test nobody pinned/);
  for (const name of pinned) {
    assert.ok(
      !new RegExp(`NEW FAILURES[\\s\\S]*${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(r.out),
      `${name} is pinned and must not be reported as new`,
    );
  }
});

test('a pinned test that stopped failing is reported, and does not fail the run', () => {
  const pinned = knownRed();
  const r = run(suiteLog(pinned.slice(1)));
  assert.equal(r.code, 0, 'a test that started passing is news, not a failure');
  assert.match(r.out, /no longer failing/);
  assert.match(r.out, new RegExp(pinned[0]!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('the duplicate name Node prints in its summary block is counted once', () => {
  // `suiteLog` plants each failure twice, exactly as the runner does. Without
  // the dedupe the count is roughly double and can never agree with the pin.
  const r = run(suiteLog(knownRed()));
  assert.match(r.out, new RegExp(`failed: ${knownRed().length}\\b`));
});

/* ── THE PATH EVERYTHING ELSE IN THE HARNESS RESTS ON ──────────────────────── */

test('the harness points at a real clone, which is what made all of this silent', () => {
  // `REPO` resolved to `<repo>/my-context` — never a directory — so every
  // harness case spawned into nothing and every one of them reported a result
  // it had not measured. Asserted against the filesystem rather than against
  // the string, so a future relayout fails here rather than everywhere.
  const src = readFileSync(path.join(REPO, 'harness', 'lib', 'workspace.mjs'), 'utf8');
  assert.match(src, /export const REPO = /, 'the harness no longer exports a clone path');
  const out = execFileSync(process.execPath, [
    '--input-type=module', '-e',
    "import { REPO, CLI } from './harness/lib/workspace.mjs';\nprocess.stdout.write(REPO + '\\n' + CLI);",
  ], { cwd: REPO, encoding: 'utf8' });
  const [repo, cli] = out.split('\n');
  assert.ok(existsSync(path.join(repo!, 'package.json')), `${repo} holds no package.json`);
  assert.ok(existsSync(cli!), `the harness CLI path ${cli} does not exist`);
});
