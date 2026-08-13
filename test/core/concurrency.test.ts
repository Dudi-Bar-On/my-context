import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const WRITER = fileURLToPath(new URL('../fixtures/concurrent-writer.ts', import.meta.url));

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
