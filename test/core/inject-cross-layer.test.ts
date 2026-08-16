import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A throwaway HOME, installed BEFORE any `src/` module is imported —
 * `core/workspace.ts` computes `GLOBAL_DIR = homedir()/.my-context` once at
 * import time, so the only way to give `buildInjection` a real global layer
 * is a home this test owns (the established pattern of draft-queue.test.ts).
 * `node --test` runs each test file in its own process, so nothing leaks.
 */
const HOME = mkdtempSync(path.join(tmpdir(), 'myctx-xlayer-home-'));
process.env.HOME = HOME;
process.env.USERPROFILE = HOME;
const GLOBAL_ROOT = path.join(HOME, '.my-context');
process.on('exit', () => { removeTree(HOME); });

const { runCli } = await import('../../src/cli/index.ts');
const { buildInjection } = await import('../../src/core/inject.ts');
const { readAudit } = await import('../../src/core/audit.ts');
const { Store } = await import('../../src/core/store.ts');
const { resolveWorkspace } = await import('../../src/core/workspace.ts');

function itemFile(root: string, id: string, title: string): void {
  const file = path.join(root, 'items', 'constraint', `${id}.md`);
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
`, 'utf8');
}

function sandbox(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-xlayer-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  return cwd;
}

/**
 * Review C1 (tasks 5-6): before the Markdown-first selection, the cross-layer
 * duplicate-id disclosure — produced only by `rebuild` — was appended to EVERY
 * injection. Task 5's plan text discarded `rebuild`'s returned errors, so a
 * user governed by the project copy was no longer told the global copy
 * silently vanished: `INV-nothing-is-dropped-silently`, on the product's
 * highest-traffic surface. The check needs no database, so it now runs on the
 * injection-critical path and lands in the injected block — the one surface
 * the model actually reads mid-task.
 */
test('a cross-layer duplicate id is disclosed in the injected block on every injection', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  itemFile(path.join(cwd, '.my_context'), 'CONST-dup', 'The project copy');
  itemFile(GLOBAL_ROOT, 'CONST-dup', 'The global copy');

  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-x1' });
  assert.match(output, /duplicate id "CONST-dup"/);
  assert.match(output, /the project copy wins/);

  // The audit note names the colliding id too (scope, not content), so the
  // log's answer to "what governed this session" carries the ambiguity.
  const note = readAudit(resolveWorkspace(cwd).projectRoot!)
    .filter((r) => r.op === 'session-start').at(-1)?.note ?? '';
  assert.match(note, /cross-layer duplicate id\(s\): CONST-dup/);
  // The refresh RAN here and recomputed the same collision — already
  // disclosed inline, it must not be repeated as a refresh error:
  assert.doesNotMatch(note, /index refresh error/);
});

/**
 * The disclosure must not depend on the best-effort index refresh: under a
 * held write lock the refresh is dropped and `rebuild` never runs, so a
 * disclosure computed only there would vanish exactly when the index is
 * least trustworthy.
 */
test('the duplicate-id disclosure survives a held write lock (the refresh never ran)', (t) => {
  const cwd = sandbox();
  itemFile(path.join(cwd, '.my_context'), 'CONST-dup', 'The project copy');
  itemFile(GLOBAL_ROOT, 'CONST-dup', 'The global copy');
  const ws = resolveWorkspace(cwd);
  Store.open(ws.dbPath).close();
  const holder = new DatabaseSync(ws.dbPath);
  holder.exec('BEGIN IMMEDIATE');
  t.after(() => {
    try { holder.exec('ROLLBACK'); } catch { /* done */ }
    holder.close();
    removeTree(cwd);
  });

  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-x2' });
  assert.match(output, /duplicate id "CONST-dup"/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'session-start').at(-1)?.note ?? '';
  assert.match(note, /index refresh dropped/);
  assert.match(note, /cross-layer duplicate id\(s\): CONST-dup/);
});

/**
 * The refresh's OTHER errors — upsert failures, which exist only when the
 * refresh actually ran — must not be discarded either. They do not touch the
 * injected text (the injection was computed from Markdown and delivered), so
 * their surface is the audit note: an index-side degradation, disclosed where
 * index state is answered.
 */
test('an index refresh that ran but failed to upsert is disclosed in the audit note', (t) => {
  const cwd = sandbox();
  t.after(() => removeTree(cwd));
  itemFile(path.join(cwd, '.my_context'), 'CONST-pool', 'Pool capped at 20');
  const ws = resolveWorkspace(cwd);
  // A real schema first (correct schema_version), then a hostile `items`
  // table with the same columns plus a CHECK no real id passes: Store.open
  // takes the "already current" branch and leaves it, deleteByLayer works,
  // and every upsert fails — the shape of a refresh that ran and degraded.
  Store.open(ws.dbPath).close();
  const db = new DatabaseSync(ws.dbPath);
  db.exec('DROP TABLE items');
  db.exec(`CREATE TABLE items (
    id          TEXT PRIMARY KEY CHECK (id = 'no-id-has-this-shape'),
    type        TEXT NOT NULL,
    title       TEXT NOT NULL,
    status      TEXT NOT NULL,
    always      INTEGER NOT NULL,
    has_scope   INTEGER NOT NULL DEFAULT 0,
    layer       TEXT NOT NULL,
    file_path   TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    data        TEXT NOT NULL
  )`);
  db.close();

  const output = buildInjection(cwd, { event: 'session-start', sessionId: 'sess-x3' });
  // The injection itself is unharmed — it never needed the index:
  assert.match(output, /CONST-pool/);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'session-start').at(-1)?.note ?? '';
  assert.match(note, /index refresh error/);
  assert.match(note, /CONST-pool\.md|CHECK/);
});
