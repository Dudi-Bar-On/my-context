import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const RACER = fileURLToPath(new URL('../fixtures/concurrent-ingest-apply.ts', import.meta.url));

const DOC = `# Password policy\n\nPasswords must be at least 12 characters.\n\n# Storage\n\nPostgres only, no MySQL.\n`;

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ing-lock-'));
  runCli(['init'], cwd, () => {});
  mkdirSync(path.join(cwd, 'docs'), { recursive: true });
  writeFileSync(path.join(cwd, 'docs', 'prd.md'), DOC, 'utf8');
  return cwd;
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function racer(
  cwd: string, sessionId: string, anchor: string, label: string,
  title: string, body: string, startAt: number,
): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [
      RACER, cwd, sessionId, anchor, label, title, body, String(startAt),
    ], { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { out += chunk; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { out += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

function itemsOnDisk(cwd: string): { id: string; body: string; status: string }[] {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  const items = store.all().map((i) => ({ id: i.id, body: i.body, status: i.status }));
  store.close();
  return items;
}

/**
 * Regression test for the hazard `acquireAnchorLock`
 * (src/cli/commands/ingest.ts) exists to close: two processes applying the
 * SAME anchor of the SAME session concurrently, both revising the same
 * predecessor with DIFFERENT bodies. Without a lock serializing the
 * read-decide-write sequence, both can compute the same next revision id
 * and one process's body silently overwrites the other's — both report
 * success, but only one body survives on disk.
 *
 * This test proves the opposite: with the lock in place, both racers report
 * success AND both bodies are present afterward, each under its own id, with
 * no candidate silently lost.
 */
test('two concurrent ingest-apply processes revising the same anchor both keep their content', async () => {
  const cwd = project();
  const first = run(['ingest', 'docs/prd.md'], cwd);
  const id = /ING-[a-z0-9-]+/.exec(first.out)![0];

  // Seed a predecessor at the anchor so both racers hit the supersede branch
  // (`byKey` match in applyCandidates), not the simpler create-only path.
  writeFileSync(path.join(cwd, 'seed.json'), JSON.stringify([{
    type: 'requirement',
    title: 'Passwords are at least 12 characters',
    body: 'Original wording.',
    quote: 'Passwords must be at least 12 characters.',
  }]), 'utf8');
  const seeded = run(['ingest-apply', id, '--anchor', 'password-policy', '--file', 'seed.json'], cwd);
  assert.equal(seeded.code, 0, seeded.out);

  const startAt = Date.now() + 400;
  const [a, b] = await Promise.all([
    racer(cwd, id, 'password-policy', 'a', 'Passwords are at least 12 characters', 'Reworded by racer A.', startAt),
    racer(cwd, id, 'password-policy', 'b', 'Passwords are at least 12 characters', 'Reworded by racer B.', startAt),
  ]);

  assert.equal(a.code, 0, `racer A failed: ${a.out}`);
  assert.equal(b.code, 0, `racer B failed: ${b.out}`);

  const items = itemsOnDisk(cwd);
  const bodies = items.map((i) => i.body);
  assert.ok(bodies.includes('Original wording.'), 'the seed item is still present');
  assert.ok(bodies.includes('Reworded by racer A.'), `racer A's content was lost. On disk: ${JSON.stringify(items)}`);
  assert.ok(bodies.includes('Reworded by racer B.'), `racer B's content was lost. On disk: ${JSON.stringify(items)}`);

  // No lock files left behind (release() ran in every path, including error paths).
  const ingestFiles = readdirSync(path.join(cwd, '.my_context', '.ingest'));
  assert.deepEqual(ingestFiles.filter((f) => f.endsWith('.lock')), []);

  rmSync(cwd, { recursive: true, force: true });
});
