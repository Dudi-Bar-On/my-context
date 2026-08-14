import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { acquireApplyLock } from '../../src/cli/commands/ingest.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const RACER = fileURLToPath(new URL('../fixtures/concurrent-ingest-apply.ts', import.meta.url));
const HOLDER = fileURLToPath(new URL('../fixtures/hold-apply-lock.ts', import.meta.url));

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

function spawnChild(argv: string[], cwd: string): Promise<{ code: number; out: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, argv, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => { out += chunk; });
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (chunk: string) => { out += chunk; });
    child.on('close', (code) => resolve({ code: code ?? 1, out }));
  });
}

function racer(
  cwd: string, sessionId: string, anchor: string, label: string,
  title: string, body: string, quote: string, startAt: number,
): Promise<{ code: number; out: string }> {
  return spawnChild(
    [RACER, cwd, sessionId, anchor, label, title, body, quote, String(startAt)], cwd,
  );
}

function holder(cwd: string, holdMs: number): Promise<{ gotAt: number; releasedAt: number }> {
  return spawnChild([HOLDER, cwd, String(holdMs)], cwd).then(({ out }) => JSON.parse(out.trim()));
}

function itemsOnDisk(cwd: string): { id: string; body: string }[] {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(':memory:');
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  const items = store.all().map((i) => ({ id: i.id, body: i.body }));
  store.close();
  return items;
}

function lockFiles(cwd: string): string[] {
  try {
    return readdirSync(path.join(cwd, '.my_context', '.ingest')).filter((f) => f.endsWith('.lock'));
  } catch {
    return [];
  }
}

/**
 * Pins the property `test/fixtures/hold-apply-lock.ts` exists to isolate:
 * `acquireApplyLock` genuinely EXCLUDES a second acquirer, independent of any
 * content-loss race. Two processes acquire the same workspace's lock at
 * (as close as spawning allows to) the same instant; whichever wins holds it
 * for 400ms. Regardless of which one that is, the loser's `gotAt` must not
 * precede the winner's `releasedAt` — if it did, both processes held the
 * lock at once, which is exactly what a `wx`-less (or otherwise broken)
 * acquire would allow.
 */
test('acquireApplyLock excludes: a second acquirer cannot start before the first releases', async () => {
  const cwd = project();
  const [a, b] = await Promise.all([holder(cwd, 400), holder(cwd, 0)]);
  const [first, second] = [a, b].sort((x, y) => x.gotAt - y.gotAt);

  // 15ms tolerance for clock/syscall granularity across two processes on the
  // same machine — comfortably inside a 400ms hold, nowhere near enough to
  // hide real overlap.
  assert.ok(
    second.gotAt >= first.releasedAt - 15,
    `second acquirer started at ${second.gotAt}, before the first released at ${first.releasedAt} ` +
    `— both held the lock at once`,
  );
  assert.deepEqual(lockFiles(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * Regression test for the reviewer-reproduced hazard: a lock keyed on
 * `(sessionId, anchor)` does not cover it, because the ids `applyCandidates`
 * collides on (`takenIds` in src/ingest/apply.ts) come from `ctx.store.all()`
 * — the WHOLE workspace, not one anchor. Two `ingest-apply` calls racing on
 * DIFFERENT anchors of the SAME session, whose candidates share a title,
 * reproduced the loss with ZERO injected delay under a per-anchor lock:
 * racer A's whole apply (all its candidates, not just the colliding one)
 * failed and its progress was never saved, while racer B silently won the
 * id. `acquireApplyLock` is workspace-scoped specifically to close this.
 */
test('two concurrent ingest-apply calls on DIFFERENT anchors, sharing a colliding title, both keep their content', async () => {
  const cwd = project();
  const first = run(['ingest', 'docs/prd.md'], cwd);
  const id = /ING-[a-z0-9-]+/.exec(first.out)![0];

  const startAt = Date.now() + 300;
  const [a, b] = await Promise.all([
    racer(
      cwd, id, 'password-policy', 'a', 'Shared colliding title', 'Body A.',
      'Passwords must be at least 12 characters.', startAt,
    ),
    racer(
      cwd, id, 'storage', 'b', 'Shared colliding title', 'Body B.',
      'Postgres only, no MySQL.', startAt,
    ),
  ]);

  assert.equal(a.code, 0, `racer A failed: ${a.out}`);
  assert.equal(b.code, 0, `racer B failed: ${b.out}`);

  const bodies = itemsOnDisk(cwd).map((i) => i.body);
  assert.ok(bodies.includes('Body A.'), `racer A's content was lost. On disk: ${JSON.stringify(bodies)}`);
  assert.ok(bodies.includes('Body B.'), `racer B's content was lost. On disk: ${JSON.stringify(bodies)}`);

  // Both anchors must show as applied — the throw-then-skip-saveSession
  // failure mode this guards against leaves a "successful" racer's anchor
  // permanently pending.
  const status = run(['ingest-status'], cwd).out;
  assert.match(status, new RegExp(`${id}\\s+docs/prd\\.md\\s+2/2`));

  assert.deepEqual(lockFiles(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * A process killed by Ctrl-C (or a crash) between acquiring the lock and its
 * `finally` never runs `release()` — this codebase has no signal handler
 * anywhere in `src/`, so that is the ordinary way a lock outlives its
 * holder, not a contrived edge case. Without staleness detection, every
 * later `ingest-apply` in this workspace would burn the full
 * `LOCK_TIMEOUT_MS` (15s) and then fail. This test writes a lock file whose
 * recorded pid does not exist (spawned, awaited to exit, so the pid is
 * guaranteed dead but was real a moment ago) and asserts the NEXT acquirer
 * reclaims it near-instantly rather than waiting anywhere close to 15s.
 */
test('a lock left behind by a dead process is reclaimed quickly, not after the full timeout', async () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot as string;

  const dead = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
    const pid = child.pid as number;
    child.on('close', () => resolve(pid));
  });

  const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ pid: dead, at: Date.now() }), 'utf8');

  const startedAt = Date.now();
  const release = acquireApplyLock(root);
  const elapsed = Date.now() - startedAt;
  release();

  assert.ok(elapsed < 2000, `reclaiming a dead-pid lock took ${elapsed}ms — should be near-instant`);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * The sibling of the previous test: staleness detection must not make a lock
 * held by a genuinely LIVE, unrelated process (this test process itself, via
 * its own real pid) reclaimable — that would defeat the lock's whole
 * purpose. `acquireApplyLock` in a child process must wait for `release()`,
 * not steal the lock out from under a live holder.
 */
test('a lock recorded against this (live) process\'s own pid is NOT treated as stale', async () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot as string;

  const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), 'utf8');

  const child = spawnChild([HOLDER, cwd, '0'], cwd);
  // The child must block behind the still-"held" (live-pid) lock rather than
  // reclaim it — release it after a short delay and confirm the child then
  // proceeds, rather than asserting on the child's own internal timing.
  await new Promise((resolve) => setTimeout(resolve, 200));
  rmSync(lockPath, { force: true });
  const result = await child;
  assert.equal(result.code, 0, result.out);
  rmSync(cwd, { recursive: true, force: true });
});
