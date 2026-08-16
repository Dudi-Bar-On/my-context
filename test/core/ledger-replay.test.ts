import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { auditSegments, recordAudit } from '../../src/core/audit.ts';
import { Ledger } from '../../src/core/ledger.ts';
import { topUpLedger } from '../../src/core/ledger-replay.ts';
import { removeTree } from '../helpers/tmp.ts';

test('top-up projects audit injections into the ledger, position-tracked and idempotent', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-a', tier: 'jit' }],
  });
  recordAudit(root, {
    kind: 'injection', op: 'session-start', sessionId: 's1', hook: 'SessionStart',
    injected: [{ id: 'CONST-b', tier: 'pinned' }, { id: 'IDX-x', tier: 'index' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  const first = topUpLedger(root, ledger);
  assert.equal(first.applied, 2); // the index tier is filtered out by ledgerRows
  assert.deepEqual(ledger.seen('s1'), ['CONST-a', 'CONST-b']);
  // Idempotent: a second top-up consumes nothing new.
  assert.equal(topUpLedger(root, ledger).applied, 0);
  // Incremental: a new record is picked up from the stored offset.
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-c', tier: 'jit' }],
  });
  assert.equal(topUpLedger(root, ledger).applied, 1);
});

test('the restored tier replays with its identity marker (at from the record entry)', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay2-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'compact-restore', sessionId: 's1', hook: 'SessionStart',
    injected: [{ id: 'CONST-r', tier: 'restored', at: 'GEN-MARKER' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  topUpLedger(root, ledger);
  const entry = ledger.entries('s1').find((e) => e.itemId === 'CONST-r');
  assert.equal(entry?.injectedAt, 'GEN-MARKER');
});

test('a shrunken segment is a divergence: discard and full replay, never append-on-top', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay3-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-a', tier: 'jit' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  topUpLedger(root, ledger);
  // Simulate a moved-aside/shrunk segment by inflating the stored offset:
  const [file] = auditSegments(root);
  ledger.setSourceBytes(file, 10_000_000);
  const result = topUpLedger(root, ledger);
  assert.equal(result.diverged, true);
  assert.deepEqual(ledger.seen('s1'), ['CONST-a']); // rebuilt whole, not doubled
});

test('a consumed segment that VANISHED is a divergence too, not silently kept rows', (t) => {
  const root = mkdtempSync(join(tmpdir(), 'myctx-replay4-'));
  t.after(() => removeTree(root));
  recordAudit(root, {
    kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse',
    injected: [{ id: 'CONST-a', tier: 'jit' }],
  });
  const ledger = Ledger.open(':memory:');
  t.after(() => ledger.close());
  topUpLedger(root, ledger);
  assert.deepEqual(ledger.seen('s1'), ['CONST-a']);
  // The consumed segment disappears (moved aside, deleted). Its projected
  // rows can no longer be reconciled against the log by appending — the
  // projection must discard and rebuild from what remains, exactly as
  // `projectionState` (audit-db.ts) classifies the same state.
  const [file] = auditSegments(root);
  rmSync(file);
  const result = topUpLedger(root, ledger);
  assert.equal(result.diverged, true);
  assert.deepEqual(ledger.seen('s1'), []); // the log no longer records it
});
