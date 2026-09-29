// @basis TASK-release-phase-3-the-defects,
// TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// TASK-make-the-queue-workable-and-impossible-to-rot-unseen, INV-nothing-is-dropped-silently
//
// B9: a PRESENT `--ceiling 0` must mean a ceiling of zero, not the no-ceiling
// sentinel. `Math.max(0, Number(flag(argv, '--ceiling') ?? 0) || NO_QUEUE_CEILING)`
// turned a present `0` into `NO_QUEUE_CEILING`, because `Number('0') || X` is
// `X` — `0` is falsy, so the boundary could not tell "absent" from "present
// and zero" apart, the exact defect `queueCeiling`'s own doc comment
// (`core/config.ts`) calls out about a cap that silently changes what a pass
// does. `ration.test.ts` already proves `propose()` itself honours
// `queueCeiling: 0` correctly in-process — the bug lived ONLY in this file's
// own argv parsing, so it is tested THROUGH THE CHILD PATH, spawning
// `pass.ts` the way `spawnPass` does, rather than by calling `runPass`
// in-process where the buggy line is never reached the way a real detached
// child reaches it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { passReportPath, spawnPass, type PassReport } from '../../src/review/pass.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * An observation the deterministic (lexical) proposer reliably turns into
 * exactly one ranked candidate — checked against the real
 * `gather` → `classify` → `propose` pipeline (not assumed): with
 * `queueCeiling: NO_QUEUE_CEILING` it produces one draft and `held: null`;
 * with `queueCeiling: 0` the same candidate is held and `held` reads
 * `{ pending: 0, ceiling: 0 }`. That is the signal these tests read off the
 * report — `held.ceiling` is the one place `queueCeiling`'s parsed value
 * becomes observable from outside the process.
 */
const OBSERVED =
  'The owner ruling is that the pass must never be awaited on Stop, and src/review/pass.ts ' +
  'asserts it: node scripts/check-basis.ts exits non-zero when a test names nothing, so the ' +
  'gate fails the build rather than warning.';

function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

function project(): { cwd: string; root: string; transcript: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ceiling-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ profile: 'standard', review: { enabled: true } }, null, 2) + '\n',
  );
  const transcript = path.join(cwd, 'transcript.jsonl');
  writeFileSync(transcript, `${record(OBSERVED, '2026-09-13T01:00:00Z')}\n`, 'utf8');
  return { cwd, root, transcript };
}

/**
 * Spawns the child the way `spawnPass` composes it — same executable, same
 * `--disable-warning` flag, same entry file — and waits for it. A real
 * process boundary, not a paraphrase of one: the bug under test is in what
 * `pass.ts`'s own `isMainEntry` branch does with `process.argv`, which
 * calling `runPass` in-process never exercises.
 */
function runChild(root: string, transcript: string, extraArgs: string[]): void {
  const passEntry = path.resolve(import.meta.dirname, '../../src/review/pass.ts');
  const result = spawnSync(process.execPath, [
    '--disable-warning=ExperimentalWarning',
    passEntry,
    '--workspace', root,
    '--transcript', transcript,
    '--session', 's-1',
    '--no-subagents',
    '--max', '5',
    ...extraArgs,
    '--dry-run',
  ], { encoding: 'utf8', timeout: 20_000 });
  assert.equal(result.status, 0, `child exited ${result.status}: ${result.stderr}`);
}

function readReport(root: string): PassReport {
  return JSON.parse(readFileSync(passReportPath(root), 'utf8')) as PassReport;
}

test('a present --ceiling 0 crosses the child boundary as a ceiling of zero, not "no ceiling"', () => {
  const { cwd, root, transcript } = project();
  try {
    runChild(root, transcript, ['--ceiling', '0']);
    const report = readReport(root);
    assert.deepEqual(
      report.proposed?.held, { pending: 0, ceiling: 0 },
      'a present --ceiling 0 must hold at a ceiling of zero — reading NO_QUEUE_CEILING instead ' +
      'would leave held null, the same as if no ceiling had ever been given',
    );
  } finally { removeTree(cwd); }
});

test('an absent --ceiling still means no ceiling, through the same child path', () => {
  const { cwd, root, transcript } = project();
  try {
    runChild(root, transcript, []);
    const report = readReport(root);
    assert.equal(
      report.proposed?.held, null,
      'this is the complement the fix must not break: ABSENT still means no ceiling',
    );
  } finally { removeTree(cwd); }
});

// ── THE PARENT'S HALF OF THE SAME BOUNDARY ─────────────────────────────────
//
// `spawnPass` composes `'--ceiling', String(Math.max(0, options.queueCeiling))`
// — no `||` in that expression, so `options.queueCeiling: 0` was never at risk
// of the falsy-coercion this file's other two tests are about. Asserted
// anyway, the same way `model.test.ts` asserts `--model` crosses or does not:
// a configured ceiling of zero must show up in the child's argv as the literal
// string `'0'`, not be dropped or substituted the way `Math.max(0, x) || y`
// would have dropped it.
test('a configured queueCeiling of 0 crosses to the child as --ceiling 0, never dropped as falsy', () => {
  const { cwd, root, transcript } = project();
  try {
    const calls: string[][] = [];
    const fn: any = (_cmd: string, args: string[]) => {
      calls.push(args);
      return { pid: 1, on: () => {}, unref: () => {} };
    };
    spawnPass({
      workspace: root, transcript, sessionId: 's-1', subagentDir: null, includeSubagents: false,
      dryRun: true, maxProposals: 0, queueCeiling: 0, model: null,
    }, fn);
    assert.equal(calls.length, 1);
    const at = calls[0]?.indexOf('--ceiling') ?? -1;
    assert.ok(at !== -1, 'a configured ceiling of 0 must still cross as --ceiling');
    assert.equal(calls[0]?.[at + 1], '0', 'the value itself must survive as the string "0"');
  } finally { removeTree(cwd); }
});
