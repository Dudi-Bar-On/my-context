#!/usr/bin/env node
/**
 * **The two-phase e2e gate — OWNER RULING 2026-09-04, on
 * `TASK-decide-whether-e2e-goes-green-on-a-two-phase-default-workers`.**
 *
 * `npm run test:e2e` runs this file instead of calling `playwright test`
 * directly, so the two-phase policy is something the suite DOES rather than
 * something a person remembers to do by hand — the ruling's own words: "a
 * gate that a known flake can block is a gate people learn to override."
 *
 * ── WHAT SETTLED THIS, AND WHY IT IS NOT THE THING
 *    `RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails` FORBIDS ──
 *
 * That rule refuses the VERDICT "flaky" without a measurement — it does not
 * forbid acting on one once it exists. `plan:port seq:96` (see
 * `NOTE-the-default-worker-e2e-baseline-plan-port-seq-96-asked-for`) IS that
 * measurement: four full default-worker runs, 39 failures total, 0 of them
 * reproducing alone, 39 of 39 passing at `--workers=1` — the exact
 * "vary something" this project's own postmortem
 * (`KNOWN-four-timing-sensitive-tests-each-went-red-once-under-load`) says the
 * rule requires and a first pass at it missed. This gate is built on that
 * result, not instead of it: phase 2 does not GUESS a test is contention, it
 * RE-RUNS it serially and reports what actually happened. A spec that fails
 * phase 2 is named as a real defect (see "WHAT STILL COUNTS AS RED" below),
 * never quietly re-labelled.
 *
 * ── THE TWO PHASES ──────────────────────────────────────────────────────
 *
 *  1. `playwright test` at the config's own worker count (`workers: '20%'`,
 *     `e2e/playwright.config.ts`). If this is green, the gate is green and
 *     phase 2 never runs — this is the common case and costs nothing extra.
 *  2. Only on a red phase 1: `playwright test --last-failed --workers=1`,
 *     serial, over exactly the specs phase 1 failed. Green here makes the
 *     gate green. Anything still failing makes the gate RED — see below.
 *
 * Both phases run with `--reporter=list,json`: `list` is what a person
 * watches (this suite is headed by owner ruling — `playwright.config.ts` —
 * and CI still gets the same reporter), `json` is written to a scratch file
 * this script reads to name specs by FILE rather than by trusting an exit
 * code alone. `PLAYWRIGHT_JSON_OUTPUT_FILE` redirects it there instead of
 * stdout, so the two reporters do not interleave.
 *
 * ── THE SUITE MUST NOT BE ABLE TO HIDE A GROWING SET OF LOAD-SENSITIVE
 *    SPECS, AND THIS IS THE PART THAT MAKES IT A GATE AND NOT A CONVENIENCE ─
 *
 * Every spec that needed phase 2 is NAMED in the output whether the gate ends
 * green or red — never folded into a bare "42 passed". A spec that only ever
 * passes on the second, serial attempt is a defect in that spec (a missing
 * barrier, contention it does not isolate itself from) even on a run this
 * gate calls green, and hiding that list is exactly the "hand-kept
 * contention list" `plan:port seq:96` measured and closed out — the same
 * failure mode reappearing one layer up if this script swallowed it instead.
 *
 * ── WHAT STILL COUNTS AS RED ────────────────────────────────────────────
 *
 *  - Phase 1 fails to produce a report at all (e.g. `global-setup.ts` throws
 *    before a single test runs) — there is nothing for phase 2 to retry, so
 *    this is reported and failed immediately, not silently handed to phase 2
 *    against a stale `.last-run.json` from some earlier invocation.
 *  - Phase 2 itself fails — i.e. at least one spec that failed at the
 *    default worker count ALSO fails serially, alone, with nothing else
 *    running. That is exactly the shape `RULE-do-not-accept-a-test-that-
 *    passes-in-isolation-and-fails` calls a real defect rather than
 *    contention, and this gate calls it RED and names the spec(s).
 *  - Anything phase 1 or phase 2 could not run at all (a fatal error, a
 *    crashed worker process) — `spawnSync`'s own exit code is trusted for
 *    this, not just the JSON report's per-test outcomes.
 *
 * "Green" therefore means: every spec passed outright, OR every spec that
 * did not passed on exactly one serial retry with nothing else contending
 * for the machine — never "most of them passed" and never a second try this
 * script did not disclose.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLAYWRIGHT_CLI = path.join(REPO_ROOT, 'node_modules', '@playwright', 'test', 'cli.js');
const CONFIG = path.join(REPO_ROOT, 'e2e', 'playwright.config.ts');

export interface JsonSpec {
  file?: string;
  ok?: boolean;
}
export interface JsonSuite {
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
export interface JsonReport {
  suites?: JsonSuite[];
}

export function readReport(jsonPath: string): JsonReport | null {
  if (!existsSync(jsonPath)) return null;
  try {
    return JSON.parse(readFileSync(jsonPath, 'utf8')) as JsonReport;
  } catch {
    // A report that did not finish writing (the process was killed mid-run)
    // is not a report this script can trust — treated the same as absent.
    return null;
  }
}

/** Every spec FILE the report mentions at all, regardless of outcome — on a
 * `--last-failed` run this is exactly "the specs that needed a second pass",
 * because nothing else was scheduled. */
export function allSpecFiles(report: JsonReport): Set<string> {
  const files = new Set<string>();
  const walk = (suite: JsonSuite): void => {
    for (const spec of suite.specs ?? []) {
      if (typeof spec.file === 'string' && spec.file !== '') files.add(spec.file);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return files;
}

/** Spec files carrying at least one test that did not pass. */
export function failingSpecFiles(report: JsonReport): Set<string> {
  const files = new Set<string>();
  const walk = (suite: JsonSuite): void => {
    for (const spec of suite.specs ?? []) {
      if (spec.ok === false && typeof spec.file === 'string' && spec.file !== '') files.add(spec.file);
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const suite of report.suites ?? []) walk(suite);
  return files;
}

function listBlock(files: string[]): string {
  return files.map((f) => `  - ${f}`).join('\n');
}

/**
 * Why phase 2 must NOT run, or `null` when it may.
 *
 * ── THE DEFECT THIS FUNCTION EXISTS TO NAME ─────────────────────────────────
 *
 * The guard here used to read `report1 === null || total1 === 0` — is there a
 * report, and did it mention any spec at all. That answers "did anything run",
 * and it is the wrong question. The question is **"is there a failing set for
 * `--last-failed` to retry"**, and the two come apart exactly where it matters:
 * a phase 1 that RAN a hundred specs, marked none of them failed and still
 * exited non-zero — a `globalTeardown` that threw, a worker killed after its
 * last test passed, a Playwright fatal after the run — produced
 * `total1 = 100`, `failed1 = []`, and was handed to phase 2.
 *
 * `--last-failed` then reads `.last-run.json`, which THIS run did not write a
 * failing set into, so it reruns whatever some EARLIER invocation left there —
 * possibly nothing at all. That run exits 0, `stillFailing` is empty, and the
 * gate prints *"GREEN on phase 2. Every retried spec passed serially."* over a
 * red phase 1. The hazard is the one the guard's own comment already named;
 * the guard just tested for the wrong half of it.
 *
 * So the condition is `failed1.length === 0`, which subsumes the old one: no
 * report and no specs both produce an empty failing set.
 */
export function stopAfterPhaseOne(
  phase1Code: number, report1: JsonReport | null, failed1: string[],
): string | null {
  if (phase1Code === 0) return null;
  if (report1 === null) {
    return 'produced no readable spec report — nothing ran to completion';
  }
  if (failed1.length === 0) {
    return allSpecFiles(report1).size === 0
      ? 'produced a report naming no spec at all — nothing ran'
      : `ran ${allSpecFiles(report1).size} spec(s) and marked NONE of them failed, yet exited `
        + 'non-zero — the failure is outside the specs (a fatal error, a crashed worker, a '
        + 'global teardown), so there is no failing set for `--last-failed` to retry';
  }
  return null;
}

export type RunPhase = (label: string, extraArgs: string[], jsonPath: string) => number;

const runPhase: RunPhase = (label, extraArgs, jsonPath) => {
  console.log(`\nmy_context e2e gate: ${label}\n`);
  const result = spawnSync(process.execPath, [
    PLAYWRIGHT_CLI, 'test', '--config', CONFIG, '--reporter=list,json', ...extraArgs,
  ], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonPath },
  });
  if (result.error) throw result.error;
  // A signal (killed process) has `status === null`; treated as a failure
  // rather than coerced to 0, which `?? 1` would get wrong the other way if
  // `status` were legitimately falsy-but-defined (it never is: 0 is success).
  return result.status === null ? 1 : result.status;
};

/**
 * The gate's orchestration, with `runPhase` taken as an argument rather than
 * called directly — the same shape `core/needs.ts` uses for its input, and
 * for the same reason: a function that reads its dependency from a parameter
 * can be driven by `test/scripts/e2e-gate.test.ts` with a stub that never
 * spawns Playwright, where `main()` itself (a real `spawnSync`) cannot be.
 *
 * **Every verdict here used to end in `process.exit()`, called from inside
 * the `try` — TASK-release-phase-1-the-repository-tells-the-truth.** `finally`
 * never runs once `process.exit()` has already torn the process down, so
 * `rmSync(scratch, ...)` below was dead code on every one of the four exit
 * paths: the gate leaked its `mkdtempSync` scratch directory on every single
 * run, green or red. The fix is the one `finally` always needed: this
 * function RETURNS the exit code instead of calling `process.exit()` itself,
 * so `finally` runs on every path, and only `main()` — after `runGate` has
 * already returned, which means after cleanup has already happened — calls
 * `process.exit(code)`.
 */
export function runGate(passthrough: string[], runPhase: RunPhase): number {
  const scratch = mkdtempSync(path.join(tmpdir(), 'mycontext-e2e-gate-'));
  try {
    const phase1Json = path.join(scratch, 'phase1.json');
    const phase1Code = runPhase('phase 1 (default workers)', passthrough, phase1Json);

    if (phase1Code === 0) {
      console.log('\nmy_context e2e gate: GREEN — phase 1 (default workers) passed outright.\n');
      return 0;
    }

    const report1 = readReport(phase1Json);
    const failed1 = report1 === null ? [] : [...failingSpecFiles(report1)].sort();
    const stop = stopAfterPhaseOne(phase1Code, report1, failed1);
    if (stop !== null) {
      // There is no failing SET for phase 2 to retry, and running
      // `--last-failed` here would rerun whatever `.last-run.json` some
      // EARLIER invocation left behind, which is not this run's failure at
      // all. RED, immediately. See `stopAfterPhaseOne` for why the condition
      // is the failing set and not the spec total.
      console.log(
        `\nmy_context e2e gate: RED. Phase 1 exited ${phase1Code} and ${stop}. ` +
        `See the output above for what phase 1 actually reported.\n`,
      );
      return phase1Code;
    }
    console.log(
      `\nmy_context e2e gate: phase 1 (default workers) failed (exit ${phase1Code}), ` +
      `${failed1.length} spec(s):\n${listBlock(failed1)}\n\n` +
      `Running phase 2 — \`--last-failed --workers=1\`, serial — before calling this RED.\n`,
    );

    const phase2Json = path.join(scratch, 'phase2.json');
    const phase2Code = runPhase(
      'phase 2 (--last-failed --workers=1)',
      [...passthrough, '--last-failed', '--workers=1'], phase2Json,
    );
    const report2 = readReport(phase2Json);
    // Every spec phase 2 touched: by construction (`--last-failed`) this is
    // exactly the set that needed a second pass, pass or fail. Printed
    // UNCONDITIONALLY, before the verdict and regardless of which way the
    // verdict goes — a spec that recovered on the retry is exactly as
    // reportable as one that did not, and folding it silently into an
    // otherwise-RED run is the same hiding this gate exists to stop, one
    // level up: measured live, `preview-picks.spec.ts` and
    // `refusal-stale.spec.ts` both cleared on retry in a run that stayed RED
    // overall (`screen-parity.spec.ts`, `strip-fields.spec.ts` did not) — a
    // verdict-gated report would have named neither of the two that cleared.
    const retried = report2 ? [...allSpecFiles(report2)].sort() : failed1;
    const stillFailing = report2 ? [...failingSpecFiles(report2)].sort() : retried;
    const clearedOnRetry = retried.filter((f) => !stillFailing.includes(f));

    console.log(
      `\nmy_context e2e gate: ${retried.length} spec(s) needed the second, serial pass — named ` +
      `here so this set cannot grow without being seen:\n${listBlock(retried)}\n`,
    );

    if (phase2Code === 0 && stillFailing.length === 0) {
      console.log(`my_context e2e gate: GREEN on phase 2. Every retried spec passed serially.\n`);
      return 0;
    }

    console.log(
      `my_context e2e gate: RED. Phase 1 failed, and phase 2 (\`--last-failed --workers=1\`, ` +
      `serial, nothing else contending for the machine) did not clear every failure. ` +
      (clearedOnRetry.length > 0
        ? `${clearedOnRetry.length} of the retried spec(s) DID clear (contention, not a defect): ` +
          `${clearedOnRetry.join(', ')}. `
        : '') +
      `Still failing after a serial retry — this project's own rule ` +
      `(RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails) is exactly why that is a ` +
      `real defect and not contention, so it is not retried again:\n${listBlock(stillFailing)}\n`,
    );
    return phase2Code === 0 ? 1 : phase2Code;
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

function main(): void {
  // Passed through to BOTH phases, unchanged — the same narrowing
  // `playwright test <args>` always accepted (a file filter, a `-g` title
  // pattern), so `npm run test:e2e -- app-layout.spec.ts` keeps working
  // exactly as it did before this script existed. `--last-failed` in phase 2
  // narrows the SAME way a second filter would: to the intersection.
  const passthrough = process.argv.slice(2);
  process.exit(runGate(passthrough, runPhase));
}

// Guarded so `test/scripts/e2e-gate.test.ts` can import the pure parsing
// functions above (`allSpecFiles`, `failingSpecFiles`, `readReport`) and the
// injectable `runGate` without this module spawning a real Playwright run as
// a side effect of import — the same reason `core/needs.ts` and
// `core/progress.ts` stay pure and take their input as an argument rather
// than reading it themselves.
const isMain = (): boolean => {
  const invoked = process.argv[1];
  return typeof invoked === 'string' && fileURLToPath(import.meta.url) === path.resolve(invoked);
};
if (isMain()) main();
