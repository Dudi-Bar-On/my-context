// @basis TASK-two-read-endpoints-block-the-whole-server-for-about-four, TASK-three-slow-read-endpoints-exhaust-the-browser-connection, STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is
/**
 * **The memo in front of `runChecks`, and the proof that stands behind a
 * reuse.**
 *
 * `/api/status` and `/api/doctor` each ran the whole 32-check doctor sweep.
 * Measured against the owner's corpus on 2026-09-14 (1,239 items, 4,739 files),
 * in-process: `runChecks` is 3,121 ms of a 3,150 ms endpoint, and a page load
 * asked for it twice. `ui/read-model-health.ts` runs it once and reuses the
 * answer while a fingerprint of everything the checks read says nothing moved.
 *
 * ## What this file proves, and what it deliberately does not
 *
 * **It proves the MECHANISM: when a reading is reused, when it is not, and
 * what the response says about which.** It does NOT prove the speed, and no
 * assertion here times anything. That is deliberate and it is the trap this
 * plan was warned about: a fixture corpus runs the whole sweep in
 * milliseconds, so a timing assertion over one would pass whether or not the
 * memo existed — the fixture, not the subject, would be carrying the proof.
 * The speed is a measurement against the owner's real corpus, recorded with
 * its method in `read-model-health.ts`' header and in the lane's report, and
 * it is not restated here as a number a test could make look proved.
 *
 * What a small fixture CAN carry honestly is the behaviour: identity of the
 * answer across a reuse, invalidation on every class of input the checks read,
 * and the disclosure riding on both response bodies. Those are what follow.
 *
 * ## Why the disclosure is under test at all
 *
 * `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is` is the
 * standard a cache in front of a health report runs straight into: findings are
 * a measurement of a corpus at a moment, and serving an older moment without
 * naming it is the defect that standard exists to refuse. So `reading` is
 * asserted as hard as the findings are — a reuse that forgot to say it was a
 * reuse must be as red as a reuse that was wrong.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, utimesSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { resolveWorkspace, type Workspace } from '../../src/core/workspace.ts';
import { apiDoctor, apiStatus, type DoctorBody, type StatusBody } from '../../src/ui/read-model.ts';
import { resetHealthMemo, type HealthReading } from '../../src/ui/read-model-health.ts';

interface Fixture { dir: string; ws: Workspace; done: () => void }

/**
 * A real workspace in a temporary directory, built by the CLI.
 *
 * It is the repository root as far as these endpoints are concerned —
 * `projectRoot` is `<dir>/.my_context` and `repoRoot` is `path.dirname` of it,
 * so `<dir>` is exactly the tree the freshness walk covers. That is what lets a
 * test write a file OUTSIDE `.my_context` and still expect an invalidation.
 *
 * `resetHealthMemo` before every fixture because the memo is process-local: two
 * fixtures in one run live in different directories and so key differently, but
 * a test that means to prove the COMPUTE path should say so rather than lean on
 * that.
 */
function fixture(): Fixture {
  resetHealthMemo();
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-ui-health-'));
  const run = (args: string[]): void => {
    assert.equal(runCli(args, dir, () => {}), 0, `fixture command failed: ${args.join(' ')}`);
  };
  run(['init']);
  run(['add', '--summary-omitted', 'rule', 'Always use POSIX paths', '--scope', 'src/**',
    '--body', 'Use POSIX separators everywhere. '.repeat(10), '--yes']);
  run(['add', '--summary-omitted', 'decision', 'We chose sqlite', '--body', 'Rationale body.', '--yes']);
  const ws = resolveWorkspace(dir);
  assert.ok(ws.projectRoot !== null, 'the fixture must resolve to a project root');
  return { dir, ws, done: () => removeTree(dir) };
}

const statusUrl = (): URL => new URL('http://127.0.0.1:1/api/status');
const doctorUrl = (): URL => new URL('http://127.0.0.1:1/api/doctor');

const statusOf = (ws: Workspace): StatusBody => {
  const result = apiStatus(ws, statusUrl());
  assert.equal(result.status, 200);
  return result.body as StatusBody;
};

const doctorOf = (ws: Workspace): DoctorBody => {
  const result = apiDoctor(ws, doctorUrl());
  assert.equal(result.status, 200);
  return result.body as DoctorBody;
};

/** Every field `HealthReading` promises, present and of the right kind. */
function assertWellFormed(reading: HealthReading, where: string): void {
  assert.ok(
    reading.source === 'computed' || reading.source === 'reused',
    `${where}: source must be computed or reused, got ${String(reading.source)}`,
  );
  assert.ok(
    !Number.isNaN(Date.parse(reading.computedAt)),
    `${where}: computedAt must be a parseable instant, got ${String(reading.computedAt)}`,
  );
  assert.equal(typeof reading.ageMs, 'number', `${where}: ageMs must be a number`);
  assert.ok(reading.ageMs >= 0, `${where}: ageMs must not be negative`);
  assert.ok(
    reading.basis === 'workspace-fingerprint' || reading.basis === 'none',
    `${where}: basis must name a proof or say there was none`,
  );
  assert.equal(typeof reading.proofMs, 'number', `${where}: proofMs must be a number`);
}

// --- 1 - a reading is reused only while nothing the checks read has moved ---

test('a second call with the workspace untouched reuses the first reading, and says so', () => {
  const f = fixture();
  try {
    const first = doctorOf(f.ws);
    assert.equal(first.reading.source, 'computed',
      'the first call in a fresh process must compute, or this test proves nothing about reuse');
    assert.equal(first.reading.ageMs, 0, 'a freshly computed reading is zero old');
    assert.equal(first.reading.basis, 'workspace-fingerprint');

    const second = doctorOf(f.ws);
    assert.equal(second.reading.source, 'reused',
      'nothing moved between the two calls, so the second must not have re-run the sweep');
    assert.equal(second.reading.computedAt, first.reading.computedAt,
      'a reuse carries the instant the findings were COMPUTED, never the instant it was served');
    assert.equal(second.reading.basis, 'workspace-fingerprint',
      'a reuse must name what proved it current');
    assert.deepEqual(
      JSON.parse(JSON.stringify(second.findings)),
      JSON.parse(JSON.stringify(first.findings)),
      'a reuse must be the same answer, not a similar one',
    );
    assertWellFormed(second.reading, 'reused doctor reading');
  } finally { f.done(); }
});

test('an item added under .my_context invalidates the reading', () => {
  const f = fixture();
  try {
    const before = doctorOf(f.ws);
    assert.equal(doctorOf(f.ws).reading.source, 'reused',
      'the memo must be warm before the change, or the recompute below proves nothing');

    assert.equal(
      runCli(['add', '--summary-omitted', 'note', 'A third item', '--body', 'Body.', '--yes'],
        f.dir, () => {}),
      0, 'the fixture must actually gain an item');

    const after = doctorOf(resolveWorkspace(f.dir));
    assert.equal(after.reading.source, 'computed',
      'a corpus that gained an item must not be answered from the reading taken before it');
    assert.notEqual(after.reading.computedAt, before.reading.computedAt,
      'a recompute must carry its own instant');
  } finally { f.done(); }
});

test('a file changed OUTSIDE .my_context invalidates the reading', () => {
  const f = fixture();
  try {
    doctorOf(f.ws);
    assert.equal(doctorOf(f.ws).reading.source, 'reused',
      'the memo must be warm before the change, or the recompute below proves nothing');

    // Source, not corpus. `checkCitationForm`, `checkDeadScopes`,
    // `checkSourceDrift` and `checkNestedCorpus` all read the tree beside
    // `.my_context`, so a fingerprint that stopped at the corpus would answer
    // a source edit with findings taken before it.
    mkdirSync(path.join(f.dir, 'src'), { recursive: true });
    writeFileSync(path.join(f.dir, 'src', 'app.ts'), 'export const x = 1;\n');

    assert.equal(doctorOf(f.ws).reading.source, 'computed',
      'the freshness walk must cover the repository, not only the corpus inside it');
  } finally { f.done(); }
});

test('an appended audit record invalidates the reading', () => {
  const f = fixture();
  try {
    doctorOf(f.ws);
    assert.equal(doctorOf(f.ws).reading.source, 'reused',
      'the memo must be warm before the change, or the recompute below proves nothing');

    // `checkAuditSize`, `checkStateUnaudited`, `checkTaskUnverified` and
    // `checkSessionIdMismatch` all read `.audit/`. This is the change a live
    // session makes constantly, and it is the one the memo must NOT survive.
    const auditDir = path.join(f.ws.projectRoot!, '.audit');
    mkdirSync(auditDir, { recursive: true });
    writeFileSync(path.join(auditDir, 'audit.jsonl'), '{"kind":"mutation"}\n', { flag: 'a' });

    assert.equal(doctorOf(f.ws).reading.source, 'computed',
      'an audit append is an input to four checks and must invalidate the reading');
  } finally { f.done(); }
});

test('a SQLite -shm sidecar touched by the act of reading does NOT invalidate', () => {
  const f = fixture();
  try {
    doctorOf(f.ws);
    assert.equal(doctorOf(f.ws).reading.source, 'reused', 'the memo must be warm first');

    // The measured reason the memo hit zero times on its first build: opening
    // the index read-only rewrites `.index.db-shm`, so every call looked like a
    // changed workspace. The exclusion is by suffix and it is the ONLY
    // exclusion by name — this asserts it holds, and the test above asserts the
    // `-wal` beside it is still watched by watching the corpus that writes it.
    const shm = path.join(f.ws.projectRoot!, '.index.db-shm');
    writeFileSync(shm, 'x');
    const future = new Date(Date.now() + 60_000);
    utimesSync(shm, future, future);

    assert.equal(doctorOf(f.ws).reading.source, 'reused',
      'the WAL index carries no corpus content; a bumped -shm mtime is this server having READ');
  } finally { f.done(); }
});

// --- 2 - the two endpoints share one reading -------------------------------

test('/api/status and /api/doctor share one sweep, and the second says it reused the first', () => {
  const f = fixture();
  try {
    const status = statusOf(f.ws);
    assert.equal(status.reading.source, 'computed',
      'the first endpoint touched in a fresh process must compute');

    const doctor = doctorOf(f.ws);
    assert.equal(doctor.reading.source, 'reused',
      'the page loads both; the sweep is the cost, and it must be paid once');
    assert.equal(doctor.reading.computedAt, status.reading.computedAt,
      'the two endpoints must be reading the SAME sweep, not two sweeps taken a moment apart');
  } finally { f.done(); }
});

test('the status tally and the doctor findings are the same sweep counted two ways', () => {
  const f = fixture();
  try {
    const status = statusOf(f.ws);
    const doctor = doctorOf(f.ws);
    const open = (level: string): number => doctor.findings.filter(
      (finding) => finding.level === level && finding.acknowledged !== true
        && finding.about === undefined,
    ).length;
    assert.equal(status.health.errors, open('error'));
    assert.equal(status.health.warnings, open('warn'));
    assert.equal(status.health.infos, open('info'));
    assert.ok(
      doctor.findings.length > 0,
      'the fixture must produce SOME finding, or the three equalities above hold vacuously',
    );
  } finally { f.done(); }
});

// --- 3 - the disclosure itself --------------------------------------------

test('both bodies carry a well-formed reading, computed and reused alike', () => {
  const f = fixture();
  try {
    const computedStatus = statusOf(f.ws);
    assertWellFormed(computedStatus.reading, 'computed status reading');
    assert.equal(computedStatus.reading.unprovable, null,
      'a workspace that fingerprinted has nothing unprovable to report');

    const reusedDoctor = doctorOf(f.ws);
    assertWellFormed(reusedDoctor.reading, 'reused doctor reading');
    assert.equal(reusedDoctor.reading.source, 'reused',
      'the reuse path must be the one under test here, not a second compute');
  } finally { f.done(); }
});

test('a reused reading reports an age, and a computed one reports zero', () => {
  const f = fixture();
  try {
    assert.equal(statusOf(f.ws).reading.ageMs, 0, 'computed now is zero old');
    /**
     * **The age is BRACKETED rather than equated, and that is a repair, not a
     * weakening.** This assertion used to read `reused.ageMs === Date.now() -
     * Date.parse(reused.computedAt)`, taking a SECOND `Date.now()` here in the
     * test after the module had already taken its own at
     * `read-model-health.ts` · `ageMs: Date.now() - memo.computedAt`. One
     * millisecond between those two readings turns it red for a reason that
     * has nothing to do with its subject — measured 2026-09-14: green alone,
     * red inside the full suite, on a contended machine.
     *
     * The bracket keeps every bit of the discriminating power. An age counted
     * SEPARATELY — from a tick counter, a second clock, or any instant other
     * than the recorded one — falls outside [before, after], which is the
     * whole thing this test exists to catch. Proved by mutation below.
     */
    // A REAL GAP, because without one the bracket cannot discriminate. With
    // the reuse happening a millisecond after the compute, [before-recorded,
    // after-recorded] is about [0, 5] and a wrong CONSTANT of 5 sits inside
    // it — measured 2026-09-14, the first version of this repair passed its
    // own mutation. A 40 ms wait puts the bracket around [40, 42], where any
    // age not derived from the recorded instant falls outside. Synchronous on
    // purpose: a timer would hand the gap to the event loop the memo shares.
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 40);
    const before = Date.now();
    const reused = doctorOf(f.ws).reading;
    const after = Date.now();
    assert.equal(reused.source, 'reused');
    assert.ok(reused.ageMs >= 0,
      'a reuse must report how old the findings it is serving are');
    const recorded = Date.parse(reused.computedAt);
    assert.ok(
      reused.ageMs >= before - recorded && reused.ageMs <= after - recorded,
      `the age must be derived from the recorded instant, not counted `
      + `separately from it (ageMs ${reused.ageMs} outside `
      + `[${before - recorded}, ${after - recorded}])`,
    );
  } finally { f.done(); }
});
