import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { buildInjection } from '../../src/core/inject.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inject-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

function pin(cwd: string, id: string, title: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: constraint
title: ${title}
status: active
severity: hard
always: true
---

# ${title}

Body text.
`);
}

function ledgerRowCount(cwd: string): number {
  const db = new DatabaseSync(path.join(cwd, '.my_context', '.index.db'));
  try {
    db.exec(`CREATE TABLE IF NOT EXISTS ledger (
      session_id TEXT NOT NULL, item_id TEXT NOT NULL,
      tier TEXT NOT NULL, injected_at TEXT NOT NULL,
      PRIMARY KEY (session_id, item_id, tier))`);
    const row = db.prepare('SELECT COUNT(*) AS n FROM ledger').get() as { n: number };
    return Number(row.n);
  } finally {
    db.close();
  }
}

/**
 * One selection, one renderer, one output: the manual event exists so
 * `load_context` never grows a second answer to "what gets injected".
 */
test('a manual injection is identical to the session-start injection', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.match(buildInjection(cwd, { event: 'manual' }), /CONST-pool/);
  assert.equal(buildInjection(cwd, { event: 'manual' }), buildSessionStartOutput(cwd));
  removeTree(cwd);
});

test('a session-start injection with a session id does record in the ledger', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  buildSessionStartOutput(cwd, { source: 'startup', sessionId: 'abc-123' });
  assert.equal(ledgerRowCount(cwd), 1);
  removeTree(cwd);
});

/**
 * The guard that makes the "no fabricated session key" decision structural
 * rather than merely conventional: even if a caller hands the manual path a
 * session id, it is dropped. The ledger's keys come from hook payloads only,
 * because only those are the id the PreCompact snapshot and the compaction
 * restore agree on.
 */
test('a manual injection ignores a session id and records nothing', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  buildInjection(cwd, { event: 'manual', sessionId: 'abc-123' });
  assert.equal(ledgerRowCount(cwd), 0);
  removeTree(cwd);
});

/**
 * `compact` is a SessionStart source, not a manual one. A manual injection
 * must never take the restore branch — it has no snapshot to restore from and
 * no session to key one by.
 */
test('a manual injection ignores a compact source', () => {
  const cwd = sandbox();
  pin(cwd, 'CONST-pool', 'Pool capped at 20');
  assert.equal(
    buildInjection(cwd, { event: 'manual', source: 'compact', sessionId: 'abc-123' }),
    buildInjection(cwd, { event: 'manual' }),
  );
  assert.equal(ledgerRowCount(cwd), 0);
  removeTree(cwd);
});

test('a manual injection outside a workspace is empty, not a throw', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-inject-bare-'));
  assert.equal(buildInjection(cwd, { event: 'manual' }), '');
  removeTree(cwd);
});
