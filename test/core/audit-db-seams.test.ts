import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, appendFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { readCompleteLines, filterSelect, openProjection, syncProjection, queryProjection } from '../../src/core/audit-db.ts';
import { recordAudit } from '../../src/core/audit.ts';

test('readCompleteLines returns whole lines only and leaves a torn tail unconsumed', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    const file = path.join(dir, 'log.jsonl');
    writeFileSync(file, 'one\ntwo\n');
    const first = readCompleteLines(file, 0);
    assert.equal(first.text, 'one\ntwo\n');
    assert.equal(first.consumed, 8);

    appendFileSync(file, 'torn');           // no newline — a writer mid-append
    const second = readCompleteLines(file, first.consumed);
    assert.equal(second.text, '');
    assert.equal(second.consumed, first.consumed);  // not advanced past the tear

    appendFileSync(file, '-done\n');
    const third = readCompleteLines(file, second.consumed);
    assert.equal(third.text, 'torn-done\n');
  } finally { removeTree(dir); }
});

test('filterSelect is the SQL queryProjection runs — pinned by executing both against one projection', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    recordAudit(dir, { kind: 'injection', op: 'jit', sessionId: 's1', hook: 'PreToolUse', path: 'src/a.ts', injected: [{ id: 'RULE-a', tier: 'jit' }], tokens: 40 });
    recordAudit(dir, { kind: 'mutation', op: 'create', origin: 'human', itemId: 'RULE-b', fields: ['body'] });
    const db = openProjection(dir);
    try {
      syncProjection(dir, db);
      const filter = { sessionId: 's1', kind: 'injection' as const };
      const { sql, params } = filterSelect(filter);
      const direct = (db.prepare(sql).all(...params) as { rec: string }[]).map((r) => JSON.parse(r.rec));
      assert.deepEqual(direct, queryProjection(db, filter));
      assert.equal(direct.length, 1);
      assert.match(sql, /SELECT json\(rec\)/);
    } finally { db.close(); }
  } finally { removeTree(dir); }
});

test('filterSelect with a limit keeps the newest n, oldest-first — same as queryProjection', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-seams-'));
  try {
    for (let i = 0; i < 5; i++) {
      recordAudit(dir, { kind: 'hook', op: 'post-tool-use', sessionId: `s${i}`, hook: 'PostToolUse' });
    }
    const db = openProjection(dir);
    try {
      syncProjection(dir, db);
      const { sql, params } = filterSelect({ limit: 2 });
      const direct = (db.prepare(sql).all(...params) as { rec: string }[]).map((r) => JSON.parse(r.rec));
      assert.deepEqual(direct, queryProjection(db, { limit: 2 }));
      assert.deepEqual(direct.map((r) => r.sessionId), ['s3', 's4']);
    } finally { db.close(); }
  } finally { removeTree(dir); }
});
