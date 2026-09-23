// @basis TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  AUDIT_PROTOCOL, readAudit, recordAudit, type AuditOp, type AuditRecord,
} from '../../src/core/audit.ts';
import { openProjection, syncProjection, topItems } from '../../src/core/audit-db.ts';
import { contributions } from '../../src/core/contribution.ts';
import { writeSnapshot } from '../../src/core/ledger.ts';
import { payloadTrend } from '../../src/core/retire.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * **A restore disclosure is not a budget loss, and every counter downstream of
 * the audit log has to be able to tell** —
 * `TASK-the-restore-tier-drops-snapshot-ids-with-no-disclosure-where`.
 *
 * The selector marks the difference on the record (`Spill.neverOffered`): an id
 * the budget priced and could not afford, against one no budget was ever
 * offered — superseded, on a disabled category, hidden by a focus, already
 * delivered, or gone from the corpus entirely. The mark stopped at the copy
 * into `SpilledRef`, so the log recorded both as the same fact and four
 * readers of that log counted a superseded item as an item the budget cut:
 * `contributions` (`row.spilled`, which decides `alwaysSpilled` and therefore
 * retirement evidence), `payloadTrend` (the mean load a door spilled per
 * record), and the watch screen's spill ratios, which read
 * `audit_item.role = 'spilled'` out of the projection.
 *
 * Every fixture below plants ONE of each in one injection, so a counter that
 * cannot tell them apart answers 2 where the right answer is 1 — never 0,
 * which a filter bug could also produce.
 */

const BUDGET_SPILL = {
  id: 'CONST-too-big', tier: 'restored' as const,
  reason: 'budget exceeded (900 > 800 estimated tokens)',
};
const DISCLOSURE = {
  id: 'CONST-vanished', tier: 'restored' as const,
  reason: 'unknown id', neverOffered: true as const,
};

function injection(at: string, op: AuditOp = 'compact-restore'): AuditRecord {
  return {
    protocol: AUDIT_PROTOCOL,
    kind: 'injection', op, sessionId: 's1', hook: 'SessionStart', at,
    injected: [{ id: 'CONST-delivered', tier: 'pinned' }],
    tokens: 100,
    spilled: [BUDGET_SPILL, DISCLOSURE],
  };
}

function box(): { root: string; dispose(): void } {
  const root = mkdtempSync(path.join(tmpdir(), 'myctx-spill-mark-'));
  return { root, dispose: () => removeTree(root) };
}

// --- 1 · the wire: the mark reaches the log --------------------------------

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-spill-wire-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function projectRoot(cwd: string): string {
  return resolveWorkspace(cwd).projectRoot!;
}

function addItem(cwd: string, id: string, body: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${id} title
status: active
severity: hard
always: false
---

# ${id} title

${body}
`);
}

/**
 * A `restored` budget of 1 estimated token, so every real restore candidate
 * spills for budget — `itemCost`'s floor is above 1 from the block separator
 * alone. Written rather than picked, so no body length in this file has to
 * stay on one side of a number.
 */
function capRestoredToNothing(cwd: string): void {
  const file = path.join(projectRoot(cwd), 'config.json');
  const raw = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
  raw.budgets = { ...(raw.budgets ?? {}) as Record<string, number>, restored: 1 };
  writeFileSync(file, `${JSON.stringify(raw, null, 2)}
`);
}

test('the audit row carries the mark on the disclosure and nothing on the budget spill', () => {
  const cwd = sandbox();
  try {
    addItem(cwd, 'CONST-real', 'A real constraint that the restored budget cannot afford.');
    capRestoredToNothing(cwd);
    // One id that still resolves (it will spill for budget) and one the corpus
    // no longer has (it was never a candidate at all).
    writeSnapshot(projectRoot(cwd), 's1', ['CONST-real', 'CONST-vanished']);

    buildSessionStartOutput(cwd, { source: 'compact', sessionId: 's1' });

    const records = readAudit(projectRoot(cwd))
      .filter((r) => r.kind === 'injection' && (r.spilled ?? []).length > 0);
    assert.equal(records.length, 1, 'exactly one injection record to read');
    const spilled = records[0].spilled ?? [];

    const real = spilled.find((s) => s.id === 'CONST-real');
    assert.ok(real, 'the budget loss is recorded');
    assert.match(real!.reason, /budget exceeded/);
    assert.equal('neverOffered' in real!, false,
      'an ordinary spill record is byte-identical to what it always was');

    const gone = spilled.find((s) => s.id === 'CONST-vanished');
    assert.ok(gone, 'the disclosure is recorded');
    assert.equal(gone!.reason, 'unknown id');
    assert.equal(gone!.neverOffered, true, 'and it travels marked as what it is');
  } finally { removeTree(cwd); }
});

// --- 2 · the counters -------------------------------------------------------

test('contributions counts the budget loss as a spill and the disclosure as a disclosure', () => {
  const got = contributions([injection('2026-09-20T10:00:00.000Z')]);

  const real = got.get('CONST-too-big');
  assert.ok(real);
  assert.equal(real!.spilled, 1);
  assert.equal(real!.disclosed, 0);

  const gone = got.get('CONST-vanished');
  assert.ok(gone, 'the disclosed id still gets a row — it is not dropped from the tally');
  assert.equal(gone!.spilled, 0, 'a superseded or vanished id never lost to a budget');
  assert.equal(gone!.disclosed, 1);
});

test('payloadTrend measures the budget spill per record, not the disclosure', () => {
  const out = payloadTrend([
    injection('2026-09-20T10:00:00.000Z'),
    injection('2026-09-20T11:00:00.000Z'),
  ]);

  assert.equal(out.length, 1, 'one door, one day');
  assert.equal(out[0].spilled, 1, 'one budget loss per record, not two spills');
  assert.equal(out[0].disclosed, 1, 'and the disclosure is counted, under its own name');
  assert.equal(out[0].injected, 1);
});

test("the projection's spilled role is the budget losses, so the watch ratio is too", () => {
  const b = box();
  try {
    recordAudit(b.root, injection('2026-09-20T10:00:00.000Z'));
    const db = openProjection(b.root);
    try {
      syncProjection(b.root, db);
      // `topItems(db, 'spilled', …)` is exactly what `apiWatchRatio` and
      // `apiWatchSpills` count with (`ui/watch-model.ts`).
      const rows = topItems(db, 'spilled', 10).map((r) => r.label);
      assert.deepEqual(rows, ['CONST-too-big']);
      assert.deepEqual(topItems(db, 'injected', 10).map((r) => r.label), ['CONST-delivered'],
        'non-vacuity: the projection really did ingest this record');
    } finally { db.close(); }
  } finally { b.dispose(); }
});

test('a record written before the mark existed reads exactly as it did', () => {
  const old: AuditRecord = {
    protocol: AUDIT_PROTOCOL,
    kind: 'injection', op: 'session-start', sessionId: 's0', hook: 'SessionStart',
    at: '2026-08-15T11:00:00.000Z',
    injected: [{ id: 'RULE-a', tier: 'pinned' }],
    spilled: [{ id: 'RULE-d', tier: 'pinned', reason: 'budget exceeded (900 > 800)' }],
  };
  const got = contributions([old]);
  assert.equal(got.get('RULE-d')!.spilled, 1);
  assert.equal(got.get('RULE-d')!.disclosed, 0);
  assert.equal(payloadTrend([old])[0].spilled, 1);
  assert.equal(payloadTrend([old])[0].disclosed, 0);
});
