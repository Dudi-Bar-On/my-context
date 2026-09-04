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
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  allSpecFiles, failingSpecFiles, readReport, type JsonReport,
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
