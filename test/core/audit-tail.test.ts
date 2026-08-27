import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, renameSync, appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { AuditTail } from '../../src/core/audit-tail.ts';
import { recordAudit, auditLogPath, auditDir } from '../../src/core/audit.ts';

function root(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-tail-'));
}

test('records before construction are not emitted; records after are, in order', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-old', fields: ['body'] });
    const tail = new AuditTail(dir);
    assert.deepEqual(tail.poll(), { records: [], resync: false });

    recordAudit(dir, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], spilled: [{ id: 'RULE-b', tier: 'jit', reason: 'budget exceeded' }], tokens: 55 });
    recordAudit(dir, { kind: 'focus', op: 'focus-set', origin: 'agent', note: 'scope=src/**' });
    const result = tail.poll();
    assert.equal(result.resync, false);
    assert.deepEqual(result.records.map((r) => r.op), ['jit', 'focus-set']);
    assert.equal(result.records[0].spilled?.[0].reason, 'budget exceeded');
    assert.equal(result.records[0].tokens, 55);
    assert.deepEqual(tail.poll(), { records: [], resync: false });
  } finally { removeTree(dir); }
});

test('a torn tail is not emitted until the line completes', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    recordAudit(dir, { kind: 'hook', op: 'deny', sessionId: 's1', hook: 'PreToolUse' });
    const file = auditLogPath(dir);
    const whole = readFileSync(file, 'utf8');
    const line = whole.trimEnd();
    writeFileSync(file, whole + line.slice(0, 20)); // a second record, torn mid-append
    const first = tail.poll();
    assert.deepEqual(first.records.map((r) => r.op), ['deny']); // the whole line only
    appendFileSync(file, line.slice(20) + '\n');
    const second = tail.poll();
    assert.deepEqual(second.records.map((r) => r.op), ['deny']); // now complete
  } finally { removeTree(dir); }
});

test('a rotation is a resync, never a replay', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    const tail = new AuditTail(dir);
    // Simulate what rotateIfFull does: rename the live log, start a fresh one.
    renameSync(auditLogPath(dir), path.join(auditDir(dir), 'audit.20260816T000000000Z-1.jsonl'));
    recordAudit(dir, { kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a', fields: ['title'] });
    const result = tail.poll();
    assert.equal(result.resync, true);
    assert.deepEqual(result.records, []); // nothing replayed — the client refetches its backlog
    // After the resync, tailing continues from the new EOFs.
    recordAudit(dir, { kind: 'mutation', op: 'link', origin: 'human', itemId: 'RULE-a', fields: ['relations'] });
    const next = tail.poll();
    assert.equal(next.resync, false);
    assert.deepEqual(next.records.map((r) => r.op), ['link']);
  } finally { removeTree(dir); }
});

test('a damaged complete line throws — the tail refuses rather than skips', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    recordAudit(dir, { kind: 'hook', op: 'deny', sessionId: 's1', hook: 'PreToolUse' });
    appendFileSync(auditLogPath(dir), 'not json\n');
    assert.throws(() => tail.poll(), /cannot be trusted/);
  } finally { removeTree(dir); }
});

test('an empty workspace (no .audit yet) polls quietly until the first record', () => {
  const dir = root();
  try {
    const tail = new AuditTail(dir);
    assert.deepEqual(tail.poll(), { records: [], resync: false });
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    assert.deepEqual(tail.poll().records.map((r) => r.op), ['create']);
  } finally { removeTree(dir); }
});

// --- The bounded backlog (plan:walk seq:52) ---------------------------------
//
// The owner's report was *"the audit stream is blank without records"*, over a
// corpus holding 2,076 of them. A live tail that starts at the current EOFs is
// UNMEASURED when it is empty — it means "nothing since you opened this", not
// "no records" — and `STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is`
// is the standard that reading broke.
//
// The backlog is therefore OPT-IN and every test above still asserts the
// default: `AuditTail` is constructed by the stream route AND by
// `test/ui/server-e2e.test.ts`'s "not what was already there" contract, so a
// changed default would silently start replaying history to a caller that
// asked for a tail. What the option adds is a bound, a boundary, and a claim
// about what it held back.

test('the backlog is opt-in: a default tail measures nothing and replays nothing', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    const tail = new AuditTail(dir);
    const opening = tail.backlog();
    assert.deepEqual(opening.records, []);
    assert.equal(opening.cap, 0);
    // NOT `true`. A tail that was never asked to look did not measure an empty
    // log, and saying `complete` here would let a screen draw "all 0 records"
    // over a corpus with 2,076 in it — the defect, restated one layer down.
    assert.equal(opening.complete, false);
  } finally { removeTree(dir); }
});

test('a backlog replays the last N records, oldest first, and declares that it held more back', () => {
  const dir = root();
  try {
    for (const id of ['a', 'b', 'c', 'd', 'e']) {
      recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: `RULE-${id}`, fields: ['body'] });
    }
    const tail = new AuditTail(dir, { backlog: 3 });
    const opening = tail.backlog();
    assert.deepEqual(opening.records.map((r) => r.itemId), ['RULE-c', 'RULE-d', 'RULE-e']);
    assert.equal(opening.cap, 3);
    // The whole of requirement 2: a surface that truncates and says nothing
    // cannot be told apart from one showing everything.
    assert.equal(opening.complete, false);
  } finally { removeTree(dir); }
});

test('a log shorter than the cap is COMPLETE — nothing was held back and it says so', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    recordAudit(dir, { kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a', fields: ['title'] });
    const opening = new AuditTail(dir, { backlog: 20 }).backlog();
    assert.deepEqual(opening.records.map((r) => r.op), ['create', 'update']);
    assert.equal(opening.complete, true);
  } finally { removeTree(dir); }
});

test('an empty log is a MEASURED zero: no records, and complete says the scan reached the start', () => {
  const dir = root();
  try {
    const opening = new AuditTail(dir, { backlog: 20 }).backlog();
    assert.deepEqual(opening.records, []);
    // This is the fact the screen needs to say "this corpus has no audit log at
    // all" rather than "nothing since you opened this". Without it the two
    // empties are one blank.
    assert.equal(opening.complete, true);
  } finally { removeTree(dir); }
});

test('the backlog is not re-emitted by poll: history and live never overlap', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    const tail = new AuditTail(dir, { backlog: 20 });
    assert.deepEqual(tail.backlog().records.map((r) => r.op), ['create']);
    assert.deepEqual(tail.poll(), { records: [], resync: false });
    recordAudit(dir, { kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a', fields: ['title'] });
    assert.deepEqual(tail.poll().records.map((r) => r.op), ['update']);
  } finally { removeTree(dir); }
});

test('the backlog reads across a rotated segment, oldest first', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    renameSync(auditLogPath(dir), path.join(auditDir(dir), 'audit.20260816T000000000Z-1.jsonl'));
    recordAudit(dir, { kind: 'mutation', op: 'update', origin: 'human', itemId: 'RULE-a', fields: ['title'] });
    const opening = new AuditTail(dir, { backlog: 20 }).backlog();
    assert.deepEqual(opening.records.map((r) => r.op), ['create', 'update']);
    assert.equal(opening.complete, true);
  } finally { removeTree(dir); }
});

test('a damaged line inside the backlog window refuses, exactly as poll does', () => {
  const dir = root();
  try {
    recordAudit(dir, { kind: 'hook', op: 'deny', sessionId: 's1', hook: 'PreToolUse' });
    appendFileSync(auditLogPath(dir), 'not json\n');
    const tail = new AuditTail(dir, { backlog: 20 });
    assert.throws(() => tail.backlog(), /cannot be trusted/);
  } finally { removeTree(dir); }
});

test('the backlog bounds the bytes it will scan, and an exhausted bound is never called complete', () => {
  const dir = root();
  try {
    // One record is ~200 bytes; a 1-byte scan window cannot reach the start of
    // any log that has one, which is the condition `complete` exists to
    // distinguish from "the log really is that short".
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-a', fields: ['body'] });
    const opening = new AuditTail(dir, { backlog: 20, scanBytes: 1 }).backlog();
    assert.equal(opening.complete, false);
    assert.equal(opening.scanBytes, 1);
  } finally { removeTree(dir); }
});
