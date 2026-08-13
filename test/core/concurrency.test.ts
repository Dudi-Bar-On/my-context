import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const WRITER = fileURLToPath(new URL('../fixtures/concurrent-writer.ts', import.meta.url));
const OPENER = fileURLToPath(new URL('../fixtures/concurrent-opener.ts', import.meta.url));

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-conc-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function writer(cwd: string, label: string, count: number): Promise<{ code: number; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [WRITER, cwd, label, String(count)], {
      cwd, stdio: ['ignore', 'ignore', 'pipe'],
    });
    let err = '';
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { err += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, err }));
  });
}

/** Read the corpus from Markdown — the source of truth, not the index. */
function itemsOnDisk(cwd: string): string[] {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  const ids = store.all().map((i) => i.id);
  store.close();
  return ids;
}

function strayTempFiles(cwd: string): string[] {
  const dir = path.join(cwd, '.my_context', 'items', 'lesson');
  try {
    return readdirSync(dir).filter((name) => name.includes('.tmp-'));
  } catch {
    return [];
  }
}

test('eight concurrent writers all land, none lost', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 8 }, (_unused, i) => writer(cwd, `w${i}`, 5)),
  );

  for (const [i, result] of results.entries()) {
    assert.equal(result.code, 0, `writer ${i} failed: ${result.err}`);
  }
  assert.equal(itemsOnDisk(cwd).length, 40);
  assert.deepEqual(strayTempFiles(cwd), []);

  rmSync(cwd, { recursive: true, force: true });
});

test('the index agrees with the files after concurrent writes', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 6 }, (_unused, i) => writer(cwd, `x${i}`, 4)),
  );

  // A writer that failed to start (e.g. died before writing anything) would
  // leave both sides of the comparison below empty and still equal — the
  // deepEqual assertion alone cannot tell "everyone wrote successfully"
  // apart from "everyone silently failed". Both checks are required.
  for (const [i, result] of results.entries()) {
    assert.equal(result.code, 0, `writer ${i} failed: ${result.err}`);
  }

  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  const indexed = store.all().map((i) => i.id).sort();
  store.close();

  assert.equal(indexed.length, 24);
  assert.deepEqual(indexed, itemsOnDisk(cwd).sort());
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * The regression test for commit c6f0706 ("close schema-init race that
 * dropped items under a live rebuild"), which had none: mutating
 * `Store.tryOpen`'s `BEGIN IMMEDIATE` to a plain `BEGIN`, or removing the
 * transaction outright, left the whole suite green. The retry layers mask the
 * damage from every assertion that existed, and nothing looked at
 * `schema_version` at all.
 *
 * `schema_version` has no primary key, so two processes that each see "no
 * recorded version" both INSERT, leaving two rows forever — and
 * `SELECT ... LIMIT 1` hides that from every other reader. The row count is
 * therefore the honest witness: exactly one, or the transaction is not doing
 * its job.
 *
 * Mutation-verified: deleting the `BEGIN IMMEDIATE`/`COMMIT` pair around the
 * read-then-DDL makes this go RED. Weakening it to a plain deferred `BEGIN`
 * does NOT, and that turns out to be correct rather than a gap in this test:
 * a deferred transaction that has already read cannot upgrade to a write
 * lock behind a committed writer, so SQLite refuses the second `INSERT` with
 * a busy error, `tryOpen` rolls back, and `openWithBusyRetry` reopens and
 * reads the committed row. `BEGIN IMMEDIATE` takes the write lock before the
 * read, so the check-then-act cannot interleave with another opener's DDL —
 * that is what prevents the duplicate rows, and what this asserts. It is
 * NOT a measured performance win over a plain deferred `BEGIN`: retry counts
 * for both forms vary run to run under this same 8-way concurrent-open load,
 * and neither reliably beats the other — `IMMEDIATE`'s value here is the
 * atomicity above, not fewer retries.
 */
test('concurrent first-openers of a fresh database leave exactly one schema_version row', async () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-open-'));
  const dbPath = path.join(dir, '.index.db');
  const startAt = Date.now() + 1500;

  const results = await Promise.all(
    Array.from({ length: 8 }, () => new Promise<{ code: number; err: string }>((resolve) => {
      const child = spawn(process.execPath, [OPENER, dbPath, String(startAt)], {
        cwd: dir, stdio: ['ignore', 'ignore', 'pipe'],
      });
      let err = '';
      child.stderr.setEncoding('utf8');
      child.stderr.on('data', (chunk: string) => { err += chunk; });
      child.on('close', (code) => resolve({ code: code ?? 1, err }));
    })),
  );

  // A process that lost the race sees `no such table: items` — not a lock
  // error, so it gets no bounded wait and fails outright. Checking exit codes
  // as well as the row count keeps both halves of the failure visible.
  for (const [i, result] of results.entries()) {
    assert.equal(result.code, 0, `opener ${i} failed: ${result.err}`);
  }

  const db = new DatabaseSync(dbPath);
  const rows = db.prepare('SELECT version FROM schema_version').all() as { version: number }[];
  db.close();
  assert.equal(rows.length, 1, `expected one schema_version row, found ${rows.length}`);

  rmSync(dir, { recursive: true, force: true });
});

test('concurrent writers racing on identical content produce one item', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => writer(cwd, 'same', 3)),
  );

  for (const result of results) assert.equal(result.code, 0, result.err);
  assert.deepEqual(itemsOnDisk(cwd), ['LESSON-a-contended-lesson']);
  assert.deepEqual(strayTempFiles(cwd), []);

  rmSync(cwd, { recursive: true, force: true });
});
