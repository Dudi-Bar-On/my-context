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
