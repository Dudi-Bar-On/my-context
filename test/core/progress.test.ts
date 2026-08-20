/**
 * Step progress, replayed from the audit log.
 *
 * The property under test is that progress is DERIVED, never stored: there is
 * no "3" anywhere in the corpus, in the index, or in the item file. The number
 * is counted from records, exactly as the drafts count in the session banner is
 * counted from `reviewQueue` rather than kept as a tally.
 *
 * What this cannot check: that two terminals in one workspace get a sensible
 * answer. Progress is workspace-scoped because no CLI surface has a session id
 * (`core/focus.ts` measured exactly that and conceded it), and the concurrent
 * case is unmeasured — the CLI says so in its own output rather than this test
 * pretending to cover it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { procedureProgress, progressLine, unreadableProgress } from '../../src/core/progress.ts';
import { AUDIT_PROTOCOL, type AuditRecord } from '../../src/core/audit.ts';

const rec = (at: string, op: string, note: string): AuditRecord =>
  ({
    protocol: AUDIT_PROTOCOL, at, kind: 'progress', op, itemId: 'PROC-x',
    origin: 'human', note,
  }) as AuditRecord;

test('done ticks accumulate, in log order', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'step 3'),
  ], 'PROC-x');
  assert.deepEqual([...done].sort(), [1, 3]);
  assert.equal(progressLine(done, 5), '2 of 5');
});

test('step-undone removes exactly one step', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'step 2'),
    rec('2026-08-20T10:03:00Z', 'step-undone', 'step 1'),
  ], 'PROC-x');
  assert.deepEqual([...done], [2]);
});

test('step-undone for a step that was never done changes nothing', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-undone', 'step 4'),
  ], 'PROC-x');
  assert.deepEqual([...done], []);
});

test('a step ticked again after being un-ticked is done — the log is replayed in order', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 2'),
    rec('2026-08-20T10:02:00Z', 'step-undone', 'step 2'),
    rec('2026-08-20T10:03:00Z', 'step-done', 'step 2'),
  ], 'PROC-x');
  assert.deepEqual([...done], [2]);
});

test('step-reset is the replay anchor — a second activation starts clean', () => {
  const done = procedureProgress([
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'step 2'),
    rec('2026-08-21T09:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-21T09:05:00Z', 'step-done', 'step 1'),
  ], 'PROC-x');
  assert.deepEqual([...done], [1]);
});

test('records for another procedure are not counted', () => {
  const other = { ...rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'), itemId: 'PROC-y' };
  assert.deepEqual([...procedureProgress([other], 'PROC-x')], []);
});

test('a record of another KIND is not counted, however its note reads', () => {
  const mutation = {
    ...rec('2026-08-20T10:01:00Z', 'update', 'step 1'), kind: 'mutation',
  } as AuditRecord;
  assert.deepEqual([...procedureProgress([mutation], 'PROC-x')], []);
});

test('no records at all is zero of N — never "unknown" and never a crash', () => {
  assert.equal(progressLine(procedureProgress([], 'PROC-x'), 5), '0 of 5');
});

test('a note this build cannot parse is skipped in the count, and counted as unreadable', () => {
  const records = [
    rec('2026-08-20T10:00:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:01:00Z', 'step-done', 'step 1'),
    rec('2026-08-20T10:02:00Z', 'step-done', 'the second one'),
    rec('2026-08-20T10:03:00Z', 'step-done', 'step 0'),
  ];
  // Counting an unreadable record as done, or as not done, would both be
  // claims. The count says how many it could not read; the caller says so.
  assert.deepEqual([...procedureProgress(records, 'PROC-x')], [1]);
  assert.equal(unreadableProgress(records, 'PROC-x'), 2);
});

test('a reset clears the unreadable count too — it is the anchor for both', () => {
  const records = [
    rec('2026-08-20T10:01:00Z', 'step-done', 'nonsense'),
    rec('2026-08-20T10:02:00Z', 'step-reset', 'activated'),
    rec('2026-08-20T10:03:00Z', 'step-done', 'step 1'),
  ];
  assert.deepEqual([...procedureProgress(records, 'PROC-x')], [1]);
  assert.equal(unreadableProgress(records, 'PROC-x'), 0);
});

test('a step-reset needs no readable note, and is never itself unreadable', () => {
  const records = [{ ...rec('2026-08-20T10:00:00Z', 'step-reset', 'activated') }];
  assert.equal(unreadableProgress(records, 'PROC-x'), 0);
});

test('progressLine is computed, never stored — it reads the set it is handed', () => {
  assert.equal(progressLine(new Set([1, 2, 3]), 3), '3 of 3');
  assert.equal(progressLine(new Set(), 0), '0 of 0');
});
