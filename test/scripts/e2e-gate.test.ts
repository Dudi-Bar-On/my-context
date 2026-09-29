// @basis TASK-release-phase-1-the-repository-tells-the-truth, RULE-do-not-accept-a-test-that-passes-in-isolation-and-fails
/**
 * **`scripts/e2e-gate.ts`'s pure parsing — RULING 2, 2026-09-04.**
 *
 * The gate itself spawns real Playwright processes and cannot be driven from
 * a unit test the way `test/e2e/*.spec.ts` (which the gate ORCHESTRATES) is
 * driven from a browser. What CAN be pinned here, without a browser, is the
 * one part a wrong answer would make dishonest: reading Playwright's own JSON
 * reporter output back into "which specs failed" and "which specs were
 * retried" — the two facts the gate's own report is built from. `main()` is
 * guarded (`isMain()`) so importing this module for these tests does not
 * itself launch a suite.
 *
 * **The cleanup contract, below** — TASK-release-phase-1-the-repository-tells-
 * the-truth. `runGate` is the orchestration with `runPhase` taken as a
 * parameter, so it can be driven here with a stub that never spawns
 * Playwright, the same way the gate's own comment on `runGate` explains. Two
 * cases exercise the bug that was actually fixed — every `process.exit()`
 * used to run INSIDE the `try`, which skips `finally`, which leaked the
 * `mkdtempSync` scratch directory on every run — GREEN (phase 1 passes
 * outright) and RED (a spec still fails after the serial retry), because a
 * fix proved on only the path that already worked would have missed the
 * defect: the real bug was on the paths that end the process early, and a
 * RED verdict is exactly one of those.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  allSpecFiles, failingSpecFiles, readReport, runGate, stopAfterPhaseOne,
  type JsonReport, type RunPhase,
} from '../../scripts/e2e-gate.ts';

/** A JSON report shaped the way `@playwright/test`'s built-in `json`
 * reporter actually serialises one (see `_serializeSuite`/`_serializeTestSpec`
 * in `@playwright/test`'s runner): nested `suites`, each carrying `specs`
 * with a `file` and an `ok` boolean. */
function report(...specs: { file: string; ok: boolean }[]): JsonReport {
  return {
    suites: [{
      // A real report nests one level per describe block / project; a single
      // flat suite plus one nested child below is enough to prove the walk
      // recurses rather than only reading the top level.
      specs: specs.slice(0, 1),
      suites: [{ specs: specs.slice(1) }],
    }],
  };
}

test('allSpecFiles collects every spec file, passing or failing, deduplicated', () => {
  const r = report(
    { file: 'a.spec.ts', ok: true },
    { file: 'b.spec.ts', ok: false },
    { file: 'a.spec.ts', ok: true }, // the second browser project's run of the same spec
  );
  assert.deepEqual([...allSpecFiles(r)].sort(), ['a.spec.ts', 'b.spec.ts']);
});

test('failingSpecFiles collects only the specs carrying an unpassed test', () => {
  const r = report(
    { file: 'a.spec.ts', ok: true },
    { file: 'b.spec.ts', ok: false },
    { file: 'c.spec.ts', ok: false },
  );
  assert.deepEqual([...failingSpecFiles(r)].sort(), ['b.spec.ts', 'c.spec.ts']);
});

test('a spec that fails on one browser project and passes on the other is still failing', () => {
  // `ok` is per (spec, project) entry — the walk must not let a passing
  // chromium run paper over a failing chrome run of the identical file.
  const r = report(
    { file: 'a.spec.ts', ok: false },
    { file: 'a.spec.ts', ok: true },
  );
  assert.deepEqual([...failingSpecFiles(r)], ['a.spec.ts']);
  assert.deepEqual([...allSpecFiles(r)], ['a.spec.ts']);
});

test('an empty report names nothing, for either question', () => {
  const empty: JsonReport = { suites: [] };
  assert.equal(allSpecFiles(empty).size, 0);
  assert.equal(failingSpecFiles(empty).size, 0);
  // And a report entirely absent (`{}` — `suites` itself omitted) must not
  // throw: a malformed or half-written JSON reporter output is exactly the
  // shape a killed phase would leave, and the gate treats it as "nothing ran"
  // rather than crashing the whole gate script over it.
  assert.equal(allSpecFiles({}).size, 0);
  assert.equal(failingSpecFiles({}).size, 0);
});

test('a spec entry with no ok field is not counted as failing', () => {
  // `spec.ok === false` is the exact test, not `!spec.ok` — an entry the
  // reporter did not finish writing must not be silently read as a failure
  // OR silently read as clean; it is simply not in either set.
  const r: JsonReport = { suites: [{ specs: [{ file: 'a.spec.ts' }] }] };
  assert.equal(failingSpecFiles(r).size, 0);
  assert.deepEqual([...allSpecFiles(r)], ['a.spec.ts']);
});

/* -------------------------------------------------------------------------- *
 * readReport — the file-system boundary.
 * -------------------------------------------------------------------------- */

test('readReport returns null for a path that does not exist, rather than throwing', () => {
  assert.equal(readReport('/definitely/not/a/real/path/report.json'), null);
});

test('readReport returns null for unparseable JSON, the same way an absent file does', () => {
  // A phase killed mid-write leaves a truncated file on disk; the gate must
  // treat that identically to "no report", not crash trying to parse it.
  const file = path.join(tmpdir(), `e2e-gate-test-${Date.now()}.json`);
  writeFileSync(file, '{ "suites": [ not json');
  try {
    assert.equal(readReport(file), null);
  } finally {
    unlinkSync(file);
  }
});

/* ── THE DECISION, NOT ONLY THE PARSING ───────────────────────────────────────
 *
 * `report 3 (reports/2026-09-12-silent-failures-reviewed.md)` found the gate
 * guarding on `total1 === 0` — "did anything run" — where the question it
 * needs answered is "is there a failing set to retry". The two come apart on
 * the one run that matters: phase 1 ran, marked nothing failed, and exited
 * non-zero anyway. `--last-failed` then reruns a STALE `.last-run.json` from
 * an earlier invocation and the gate prints GREEN over a red run.
 *
 * `stopAfterPhaseOne` is that decision, extracted so it can be asked directly.
 * `main()` itself spawns real Playwright processes and cannot be.
 */

test('a green phase 1 never stops the gate — there is nothing to stop for', () => {
  assert.equal(stopAfterPhaseOne(0, report({ file: 'a.spec.ts', ok: true }), []), null);
});

test('a red phase 1 with a failing set proceeds to phase 2', () => {
  const r = report({ file: 'a.spec.ts', ok: false }, { file: 'b.spec.ts', ok: true });
  assert.equal(stopAfterPhaseOne(1, r, ['a.spec.ts']), null);
});

test('THE DEFECT: phase 1 ran, failed nothing, and exited non-zero — the gate must STOP', () => {
  // `total1` is 2 here, so the old `total1 === 0` guard let this through to
  // `--last-failed` against a stale `.last-run.json`. Every spec in the report
  // passed; the exit code did not.
  const r = report({ file: 'a.spec.ts', ok: true }, { file: 'b.spec.ts', ok: true });
  const stop = stopAfterPhaseOne(1, r, []);
  assert.notEqual(stop, null, 'a red phase 1 with an empty failing set must not reach phase 2');
  assert.match(stop!, /marked NONE of them failed/);
  assert.match(stop!, /no failing set/);
});

test('a red phase 1 with no report at all still stops, as it always did', () => {
  const stop = stopAfterPhaseOne(1, null, []);
  assert.notEqual(stop, null);
  assert.match(stop!, /no readable spec report/);
});

test('a red phase 1 whose report names no spec stops, and says which of the two it was', () => {
  // A report that parsed but is empty — a global-setup crash after the file
  // was created. Distinct wording from "marked none failed", because the
  // repair is different: one is a setup failure, the other is a failure
  // outside the specs.
  const stop = stopAfterPhaseOne(1, { suites: [] }, []);
  assert.notEqual(stop, null);
  assert.match(stop!, /naming no spec at all/);
});

/* ── THE CLEANUP CONTRACT ──────────────────────────────────────────────────
 *
 * `runGate` creates its own `mkdtempSync` scratch directory and is the only
 * thing that knows its path — it is never passed in and never returned. Each
 * stub below reads it back out of the `jsonPath` argument `runPhase` is
 * called with (`path.dirname(jsonPath)`, since `runGate` always writes the
 * per-phase report inside its scratch directory), so the assertion is against
 * the exact directory `runGate` made, not a directory the test invented.
 */

test('runGate: GREEN — phase 1 passing outright still removes the scratch directory', () => {
  let scratchDir: string | null = null;
  let calls = 0;
  const stub: RunPhase = (_label, _extraArgs, jsonPath) => {
    calls += 1;
    scratchDir = path.dirname(jsonPath);
    assert.ok(existsSync(scratchDir), 'the scratch directory must exist while runPhase runs');
    return 0; // phase 1 green — phase 2 must never run
  };

  const code = runGate([], stub);

  assert.equal(calls, 1, 'a green phase 1 must not trigger phase 2');
  assert.equal(code, 0);
  assert.ok(scratchDir !== null);
  assert.equal(
    existsSync(scratchDir!), false,
    'the scratch directory must be gone once runGate has returned',
  );
});

test('runGate: RED — a spec still failing after the serial retry still removes the scratch directory', () => {
  let scratchDir: string | null = null;
  let calls = 0;
  const failingReport: JsonReport = {
    suites: [{ specs: [{ file: 'broken.spec.ts', ok: false }] }],
  };
  const stub: RunPhase = (_label, _extraArgs, jsonPath) => {
    calls += 1;
    scratchDir = path.dirname(jsonPath);
    // A real phase writes its own JSON report to this exact path as a side
    // effect of the spawned `playwright test` process; the stub does the
    // same so `runGate`'s own `readReport` call exercises the real reading
    // path instead of being told what it found.
    writeFileSync(jsonPath, JSON.stringify(failingReport));
    return 1; // still failing on both the default-worker pass and the serial retry
  };

  const code = runGate([], stub);

  assert.equal(calls, 2, 'a failing set from phase 1 must be retried by phase 2');
  assert.equal(code, 1, 'a spec still failing after the serial retry must end the gate RED');
  assert.ok(scratchDir !== null);
  assert.equal(
    existsSync(scratchDir!), false,
    'the scratch directory must be gone even on a RED verdict',
  );
});
