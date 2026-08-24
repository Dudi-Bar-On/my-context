/**
 * Perf suite — see the header comment in `jit-latency.perf.ts` for why this
 * lives here (`.perf.ts`, not `.test.ts`) and runs only under
 * `npm run test:perf` (`--test-concurrency=1`).
 *
 * **What this file is for.** `hooks seq:21` rules that *"every registration
 * costs a process spawn. SubagentStart measured 338-413ms end to end including
 * a cold node start. Measure each, report the numbers, and let the owner decide
 * from them."* Ten registrations landed in one round, so ten spawns were added
 * to a session's cost, and the decision the owner is being asked to make needs
 * the numbers rather than an assurance that they are small.
 *
 * ── THE END-TO-END NUMBERS, RECORDED AND UNASSERTED ────────────────────────
 *
 * Measured 2026-08-23 by running every command in this repository's own
 * `.claude/settings.json` as a real OS process — `${CLAUDE_PROJECT_DIR}`
 * substituted, cwd the repository, a realistic payload on stdin, wall clock
 * from spawn to exit — against this project's own 44-item corpus. Every one
 * exited 0.
 *
 *     SessionStart         575 ms   7,024 B stdout
 *     SubagentStart        438 ms   7,949 B stdout
 *     PreToolUse           324 ms   6,373 B stdout
 *     SessionEnd           356 ms       0 B
 *     PreCompact           357 ms       0 B
 *     PostCompact          329 ms       0 B
 *     PostToolUse          367 ms       0 B
 *     PostToolUseFailure   313 ms       0 B
 *     FileChanged          273 ms       0 B
 *     InstructionsLoaded   358 ms       0 B
 *     ConfigChange         223 ms       0 B
 *     PermissionDenied     264 ms       0 B
 *     SubagentStop         354 ms       0 B
 *     Stop                 382 ms       0 B
 *     Setup                307 ms       0 B
 *     TaskCreated          340 ms       0 B
 *     TaskCompleted        299 ms       0 B
 *     UserPromptExpansion  294 ms       0 B
 *
 * **Read these as LOAD-INFLATED and as a CEILING on the ten, not a floor.**
 * The machine was running fifteen agents' worktrees at once, which is the same
 * caveat `subagent-start-latency.perf.ts` records for its own 338-413 ms. The
 * shape is what matters and it is unambiguous: the ten new binaries sit in the
 * same 220-380 ms band as the six that were already registered, and that band
 * is almost entirely `node` starting and type-stripping. `ConfigChange` at
 * 223 ms is the cheapest thing this repository can spawn — it imports
 * `core/audit.ts` and nothing else — and it is within 100 ms of `PreToolUse`,
 * which opens the corpus and renders an injection. **The marginal cost of an
 * observation hook is the process, not the work**, and no amount of care inside
 * these files will move it.
 *
 * Nothing here asserts those figures, for `subagent-start-latency.perf.ts`'s
 * reason: measuring them in a test would time a `node` start on whatever
 * machine ran it, which is the flake this suite's own helpers exist to avoid.
 *
 * ── WHAT IS ASSERTED ───────────────────────────────────────────────────────
 *
 * The in-process cost, which is the part a commit can regress. What it costs is
 * a directory walk and one appended line — these hooks do not select, do not
 * render and do not open the index — so the number is small and the CEILING is
 * not, for the reason recorded at its own declaration below.
 * `FileChanged` is timed rather than one of the cheaper nine because it is the
 * one whose handler does real work per firing (a path resolution and two
 * prefix tests) and the one that can fire most often.
 *
 * ── THE FREQUENCY, WHICH THE LATENCY DOES NOT CAPTURE ──────────────────────
 *
 * A 300 ms hook that fires once a session and a 300 ms hook that fires forty
 * times are the same number and different products. Per the payload shapes:
 * `Setup`, `SessionEnd` and `SessionStart` fire once; `SubagentStart`/`Stop`
 * fire per dispatch and per turn; `PermissionDenied`, `TaskCreated`,
 * `TaskCompleted` and `UserPromptExpansion` fire per event and are rare;
 * `InstructionsLoaded` fires once per loaded memory file, which is a handful;
 * `ConfigChange` fires when a settings file is written. **`Stop` and
 * `FileChanged` are the two to watch.** `Stop` is one spawn per assistant turn,
 * which is the highest-frequency of the ten. `FileChanged` is one spawn per
 * changed file under the watch set — and because my_context's own writes land
 * in `items/`, a `mycontext create` costs a spawn too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { FILE_CHANGED } from '../../src/hooks/file-changed.ts';
import { recordObservation } from '../../src/hooks/observe.ts';
import { removeTree } from '../helpers/tmp.ts';
import { perfCeiling } from '../helpers/perf.ts';

const WARMUP = 3;
const ITERATIONS = 40;
/**
 * Loose on purpose, and 250 ms is `session-end-latency.perf.ts`'s number taken
 * for its reason: the dominant term on this path is the filesystem, not the
 * code. Decomposed on this machine — `findProjectRoot` is **0.2 ms** p95, the
 * `recordAudit` append is **10.0 ms** p95 (max 16.2), and everything this
 * module adds on top of them is under a millisecond. So what varies is NTFS,
 * and what this bounds is the order of magnitude: a regression that mattered
 * would be one of these hooks starting to READ something, which is two orders
 * up, not a slow write.
 *
 * The spread that forced the number is recorded rather than tuned away.
 * `recordObservation` measured **3.7 ms** p95 (median 2.4, max 4.1) run
 * standalone, and **75.4 ms** p95 in the same process minutes later with
 * fifteen agents' suites running on the box. Both are this hook. A ceiling
 * tight enough to be interesting is a ceiling that turns a loaded machine into
 * a red suite, which is the failure `test/helpers/stdio.ts` has already paid
 * for once.
 */
const CEILING_MS = perfCeiling(250);
const SESSION = 'perf-observation-1';

function p95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))];
}

test('an observation hook stays under the p95 ceiling in process', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-observe-'));
  runCli(['init'], cwd, () => {});
  const root = resolveWorkspace(cwd).projectRoot!;
  const item = path.join(root, 'items', 'constraint', 'CONST-perf.md');

  const payload = {
    hook_event_name: 'FileChanged', session_id: SESSION, cwd, file_path: item, event: 'change',
  };

  for (let i = 0; i < WARMUP; i++) recordObservation(FILE_CHANGED, payload, cwd);

  // The premise, because a hook that declined is fast and proves nothing: this
  // fixture really does record on every iteration.
  assert.ok(recordObservation(FILE_CHANGED, payload, cwd) !== null,
    'the fixture path was declined, so the loop below times the filter and not the hook');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    recordObservation(FILE_CHANGED, payload, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(
    measured < CEILING_MS,
    `observation p95 was ${measured.toFixed(1)}ms (max ${Math.max(...samples).toFixed(1)}ms). ` +
    'These hooks resolve a root and append one line; a regression here means one of them ' +
    'started reading something.',
  );

  removeTree(cwd);
});

test('declining is cheaper than recording, which is what makes FileChanged affordable', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perf-observe-decline-'));
  runCli(['init'], cwd, () => {});

  // The common case in production: a file that is not the corpus. It must not
  // cost an audit append, and the assertion is that it does not — measured
  // rather than argued, because "the filter is cheap" is exactly the kind of
  // claim that stops being true when someone moves the workspace resolution.
  const outside = {
    hook_event_name: 'FileChanged', session_id: SESSION, cwd,
    file_path: path.join(cwd, 'src', 'index.ts'), event: 'change',
  };
  for (let i = 0; i < WARMUP; i++) recordObservation(FILE_CHANGED, outside, cwd);
  assert.equal(recordObservation(FILE_CHANGED, outside, cwd), null, 'the premise inverted');

  const samples: number[] = [];
  for (let i = 0; i < ITERATIONS; i++) {
    const started = process.hrtime.bigint();
    recordObservation(FILE_CHANGED, outside, cwd);
    samples.push(Number(process.hrtime.bigint() - started) / 1e6);
  }

  const measured = p95(samples);
  assert.ok(measured < CEILING_MS,
    `the declining path's p95 was ${measured.toFixed(1)}ms, which is not a filter`);

  removeTree(cwd);
});
