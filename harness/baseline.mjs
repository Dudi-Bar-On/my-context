/**
 * **The plugin suite against its pinned known-red set.**
 *
 *     node harness/baseline.mjs                 # run `npm test` and diff
 *     node harness/baseline.mjs --from-file f   # diff a suite log captured earlier
 *
 * ── THE DEFECT THIS FILE WAS, MEASURED 2026-09-14 ───────────────────────────
 *
 * The spawn was `execFileAsync('npm', ['test'], { cwd: REPO })
 * .catch((e) => ({ stdout: e.stdout ?? '' }))`. A suite that NEVER SPAWNED
 * therefore arrived here as the empty string, which parses to zero failures,
 * which matches nothing in `KNOWN_RED`, which prints
 * *"baseline matches the pin"* and exits 0.
 *
 * That was not hypothetical. `REPO` resolved to `<repo>/my-context` — a
 * directory that does not exist, left over from a layout where `harness/` sat
 * BESIDE the clone rather than inside it — so every run of this file for as
 * long as that has been true printed `failed: 0  known-red: 11`, listed all
 * eleven pinned tests as "no longer failing", said the baseline matched, and
 * exited 0 in under a second without running one test. The campaign handover
 * tells its reader to run this and expect `failed: 11  known-red: 11`.
 *
 * Both halves are repaired here: `REPO` is the repository this file lives in,
 * and a run that produced no recognisable suite output is REFUSED rather than
 * summarised. A checker that cannot tell "nothing went wrong" from "nothing
 * happened" is not a checker — `INV-nothing-is-dropped-silently` at the gate
 * layer, and the same floor `scripts/check-basis.ts` and
 * `scripts/check-needs-cycles.ts` already carry.
 */
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { promisify } from 'node:util';
import { REPO } from './lib/workspace.mjs';

const execFileAsync = promisify(execFile);

/** The 11 failures caused by node:sqlite's ExperimentalWarning reaching stderr. */
export const KNOWN_RED = new Set([
  'session-start exits 0 and says nothing when stdin is garbage',
  'session-start exits 0 and says nothing when stdin is empty',
  'pre-tool-use exits 0 and says nothing when stdin is garbage',
  'pre-tool-use exits 0 and says nothing when stdin is empty',
  'pre-compact exits 0 and says nothing when stdin is garbage',
  'pre-compact exits 0 and says nothing when stdin is empty',
  'session-start writes the injected context on stdout for a real payload',
  'pre-tool-use emits the deny envelope for a write into the managed directory',
  'pre-compact writes a restore snapshot and keeps stdout clean',
  'nothing but MCP messages reaches stdout',
  'load_context runs over stdio without a byte of stray stdout',
]);

/**
 * Did this output come from a test suite that actually ran?
 *
 * Node's runner always closes with a `ℹ tests <n>` summary line, and prints a
 * `✔`/`✖` mark per test. Requiring one of those is the floor: an empty string,
 * a shell error, an npm usage message and a crashed spawn all fail it, and
 * every one of them used to parse to "zero failures".
 *
 * Deliberately a SHAPE and never a count: pinning "at least N tests" here
 * would be a second baseline to keep, and it is the existence of the run that
 * is in question, not its size.
 */
export function looksLikeASuiteRun(stdout) {
  return /^\s*ℹ tests \d+/m.test(stdout) || /^\s*[✔✖] /m.test(stdout);
}

/** The distinct failing test names in a suite log. */
export function failedTests(stdout) {
  // Node's test runner prints each failing test name TWICE: once inline where
  // it fails, and again in the "failing tests:" summary block at the end.
  // Deduping here is required — without it `failed.length` is roughly double
  // the true number of distinct failures, and would never agree with
  // `KNOWN_RED`, which pins distinct test names.
  return [...new Set([...stdout.matchAll(/^\s*✖ (.+?) \(\d/gm)].map((m) => m[1]))];
}

/**
 * The verdict, as data. `code` is what the process should exit with.
 *
 * Pure, and exported, so `test/scripts/baseline-harness.test.ts` can drive it
 * over captured logs in both directions instead of over a twelve-minute suite.
 */
export function verdict(stdout, spawnError) {
  if (!looksLikeASuiteRun(stdout)) {
    return {
      code: 1,
      lines: [
        'REFUSED: the suite produced no recognisable test-runner output, so nothing was ' +
          'measured — which is not the same as nothing being wrong.',
        spawnError ? `the run failed to start or died: ${spawnError}` : 'the output was empty.',
        `the suite was run in ${REPO}.`,
        'Fix the run before reading this number: a zero here means "no test reported a ' +
          'failure", and no test reported anything at all.',
      ],
    };
  }
  const failed = failedTests(stdout);
  const unexpected = failed.filter((n) => !KNOWN_RED.has(n));
  const fixed = [...KNOWN_RED].filter((n) => !failed.includes(n));
  const lines = [`failed: ${failed.length}  known-red: ${KNOWN_RED.size}`];
  if (fixed.length) lines.push(`no longer failing:\n  ${fixed.join('\n  ')}`);
  if (unexpected.length) {
    lines.push(`NEW FAILURES:\n  ${unexpected.join('\n  ')}`);
    return { code: 1, lines };
  }
  lines.push('baseline matches the pin');
  return { code: 0, lines };
}

/* ── THE RUN ────────────────────────────────────────────────────────────── */

const fromFile = process.argv.indexOf('--from-file');
let stdout = '';
let spawnError = null;
if (fromFile !== -1) {
  stdout = readFileSync(process.argv[fromFile + 1], 'utf8');
} else {
  const result = await execFileAsync('npm', ['test'], { cwd: REPO, shell: true })
    .catch((e) => {
      // The error is CARRIED, never flattened to an empty string: it is the
      // one fact that distinguishes "the suite ran and failed" — which puts
      // the failures on `e.stdout` — from "the suite never started".
      spawnError = e.message ?? String(e);
      return { stdout: e.stdout ?? '' };
    });
  stdout = result.stdout;
}

const { code, lines } = verdict(stdout, spawnError);
for (const line of lines) (code === 0 ? console.log : console.error)(line);
process.exit(code);
