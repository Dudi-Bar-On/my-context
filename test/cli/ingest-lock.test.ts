import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { acquireApplyLock, isRetryableLockError } from '../../src/ingest/lock.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const RACER = fileURLToPath(new URL('../fixtures/concurrent-ingest-apply.ts', import.meta.url));
const HOLDER = fileURLToPath(new URL('../fixtures/hold-apply-lock.ts', import.meta.url));
const HAMMER = fileURLToPath(new URL('../fixtures/hammer-apply-lock.ts', import.meta.url));

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

/**
 * Spawns `test/fixtures/hold-apply-lock.ts` and returns two handles: `ready`,
 * which resolves the instant the child's stdout carries the `ACQUIRED` line
 * (i.e. it genuinely holds the lock — see that fixture's doc comment for why
 * this beats sorting by observed timestamps), and `done`, which resolves with
 * `{ gotAt, releasedAt }` once the child exits.
 */
function spawnHolder(cwd: string, holdMs: number): {
  ready: Promise<void>;
  done: Promise<{ gotAt: number; releasedAt: number }>;
} {
  const child = spawn(
    process.execPath, [HOLDER, cwd, String(holdMs)], { cwd, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  let buffer = '';
  let err = '';
  let resolveReady: () => void;
  let sawReady = false;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    if (!sawReady && buffer.includes('ACQUIRED\n')) {
      sawReady = true;
      resolveReady();
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { err += chunk; });

  const done = new Promise<{ gotAt: number; releasedAt: number }>((resolve, reject) => {
    child.on('close', (code) => {
      if (code !== 0) { reject(new Error(`holder exited ${code}: ${err}${buffer}`)); return; }
      const lines = buffer.trim().split('\n');
      resolve(JSON.parse(lines[lines.length - 1]));
    });
  });

  return { ready, done };
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
 * content-loss race. DETERMINISTIC by construction, not by luck: the first
 * holder's `ready` signal (its `ACQUIRED` stdout line) is awaited BEFORE the
 * second is even spawned, so the second always genuinely contends against an
 * already-held lock — every run, not on whichever run happens to overlap.
 *
 * An earlier version of this test spawned both racers together and sorted by
 * OBSERVED acquisition time; measured directly, that version only caught the
 * "every lock file is stealable" mutant (the `writeSync` payload line
 * deleted) on roughly half of runs, and a full-file run of the mutant
 * survived outright. This version is written specifically to close that gap.
 */
test('acquireApplyLock excludes: a second acquirer cannot start before the first releases', async () => {
  const cwd = project();
  const first = spawnHolder(cwd, 400);
  await first.ready;
  const second = spawnHolder(cwd, 0);

  const [a, b] = await Promise.all([first.done, second.done]);

  // 15ms tolerance for clock/syscall granularity across two processes on the
  // same machine — comfortably inside a 400ms hold, nowhere near enough to
  // hide real overlap.
  assert.ok(
    b.gotAt >= a.releasedAt - 15,
    `second acquirer started at ${b.gotAt}, before the first released at ${a.releasedAt} ` +
    `— both held the lock at once`,
  );
  assert.deepEqual(lockFiles(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * The sibling of the previous test, at a longer hold duration. Construction
 * is now `linkSync`-based (see src/ingest/lock.ts): the temp file carrying
 * the payload is fully written before it is ever linked into place, so there
 * is no window — long hold or short — in which the lock file exists but is
 * empty or partial for a concurrent acquirer to observe. This is kept as a
 * separate case from the 400ms test above because it is still useful
 * mutation coverage for the exclusion property at a different hold shape,
 * even though the specific write-race window it used to target no longer
 * exists.
 */
test('acquireApplyLock excludes across a longer hold', async () => {
  const cwd = project();
  const first = spawnHolder(cwd, 700);
  await first.ready;
  const second = spawnHolder(cwd, 0);

  const [a, b] = await Promise.all([first.done, second.done]);

  assert.ok(
    b.gotAt >= a.releasedAt - 15,
    `second acquirer started at ${b.gotAt}, before the first released at ${a.releasedAt} ` +
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
 * reproduced the loss with ZERO injected delay under a per-anchor lock —
 * measured at roughly a 50% hit rate across 8 runs of the reverted key, since
 * it depends on genuine process-scheduling overlap; with the workspace-scoped
 * lock in place this test is deterministic (8/8 measured).
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
 * purpose. This asserts TIMING, not just exit code: mutating
 * `!isProcessAlive(payload.pid)` to always return `true` (every live holder
 * declared stale) left an earlier, exit-code-only version of this test
 * passing, since stealing the lock instantly and waiting for it both end
 * with the child exiting 0 — only the WHEN distinguishes a real wait from a
 * steal. The `ready`/`ACQUIRED` signal (see `spawnHolder`) is what makes
 * `gotAt` observable at all here, since a plain `holder()` call only returns
 * once the process has already exited.
 */
test('a lock recorded against this (live) process\'s own pid is NOT treated as stale', async () => {
  const cwd = project();

  const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
  mkdirSync(path.dirname(lockPath), { recursive: true });
  writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: Date.now() }), 'utf8');

  const child = spawnHolder(cwd, 0);
  // The child must block behind the still-"held" (live-pid) lock, i.e. its
  // `ready` promise must not settle until AFTER the fake lock is removed —
  // release it after a real delay and check the child's own reported
  // `gotAt` against that removal time, not merely that it eventually exits.
  await new Promise((resolve) => setTimeout(resolve, 250));
  const removedAt = Date.now();
  rmSync(lockPath, { force: true });

  const result = await child.done;
  assert.ok(
    result.gotAt >= removedAt - 15,
    `child acquired at ${result.gotAt}, before the live-pid lock was removed at ${removedAt} ` +
    `— it stole a lock its own liveness check should have refused to touch`,
  );
  rmSync(cwd, { recursive: true, force: true });
});

/**
 * `acquireApplyLock`'s construction is now `linkSync`-based (src/ingest/lock.ts):
 * the payload is fully written to a temp file before that temp file is
 * linked into place, so a concurrent acquirer can never observe the lock
 * file mid-write — the empty/truncated-payload race the OLD `openSync(file,
 * 'wx')` + separate `writeSync` construction was exposed to no longer
 * exists. What CAN still happen is genuine corruption of an already-created
 * lock file (disk corruption, hand-editing, a bug elsewhere) — and that must
 * NOT be treated as instantly stale either, for the same reason a merely
 * unparseable payload never was: `isStaleLock` now falls through a corrupt
 * payload to the ordinary mtime backstop (`LOCK_STALE_MS`) instead of a
 * dedicated grace period. These two tests pin both halves of that: an old
 * (backdated) corrupt lock is reclaimed near-instantly, and a fresh corrupt
 * lock is not reclaimed at all until it is genuinely removed.
 */
const BAD_PAYLOADS: Record<string, string> = { empty: '', truncated: '{"pid":12', null: 'null' };
for (const label of Object.keys(BAD_PAYLOADS)) {
  const bad = BAD_PAYLOADS[label];

  test(`a ${label} lock payload older than LOCK_STALE_MS is reclaimed via the mtime backstop`, () => {
    const cwd = project();
    const ws = resolveWorkspace(cwd);
    const root = ws.projectRoot as string;

    const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, bad, 'utf8');
    // Backdate the mtime well past LOCK_STALE_MS (5 minutes) instead of
    // actually waiting — a real `statSync().mtimeMs`-based backstop, exercised
    // without a 5-minute-long test.
    const old = new Date(Date.now() - 10 * 60_000);
    utimesSync(lockPath, old, old);

    const startedAt = Date.now();
    const release = acquireApplyLock(root);
    const elapsed = Date.now() - startedAt;
    release();

    assert.ok(elapsed < 2000, `a stale ${label} lock took ${elapsed}ms to reclaim — should be near-instant`);
    rmSync(cwd, { recursive: true, force: true });
  });

  test(`a ${label} lock payload with a fresh mtime is NOT treated as stale`, async () => {
    const cwd = project();

    const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
    mkdirSync(path.dirname(lockPath), { recursive: true });
    writeFileSync(lockPath, bad, 'utf8');

    const child = spawnHolder(cwd, 0);
    // Same technique as "a lock recorded against this (live) process's own
    // pid is NOT treated as stale" above: the child must still be blocked
    // after a real delay, and must only acquire once the corrupt lock is
    // actually removed.
    await new Promise((resolve) => setTimeout(resolve, 250));
    const removedAt = Date.now();
    rmSync(lockPath, { force: true });

    const result = await child.done;
    assert.ok(
      result.gotAt >= removedAt - 15,
      `child acquired at ${result.gotAt}, before the corrupt lock was removed at ${removedAt} ` +
      `— a ${label} payload with a fresh mtime was wrongly treated as stale`,
    );
    rmSync(cwd, { recursive: true, force: true });
  });
}

/**
 * Two DIFFERENT workspaces (separate `.my_context` roots) must not block
 * each other — the lock is per-workspace, not global to the machine. Without
 * this, an unrelated `ingest-apply` in a colleague's repo could stall this
 * one for no reason.
 */
test('ingest-apply locks in two different workspaces do not block each other', async () => {
  const cwdA = project();
  const cwdB = project();

  const first = spawnHolder(cwdA, 1500);
  await first.ready;

  const spawnedSecondAt = Date.now();
  const second = spawnHolder(cwdB, 0);
  const b = await second.done;

  const waitedMs = b.gotAt - spawnedSecondAt;
  assert.ok(
    waitedMs < 300,
    `workspace B's acquire took ${waitedMs}ms while workspace A held its own lock for 1500ms — looks blocked`,
  );
  await first.done;
  rmSync(cwdA, { recursive: true, force: true });
  rmSync(cwdB, { recursive: true, force: true });
});

/**
 * Regression test for the cascade `release()`'s ownership check exists to
 * close: an UNCONDITIONAL `rmSync` in `release()` deletes whatever file
 * currently sits at the lock path, regardless of who put it there. If this
 * process's own lock is ever wrongly judged stale and reclaimed by a new,
 * genuinely live holder (e.g. a bug elsewhere in staleness detection, or a
 * future change to `LOCK_STALE_MS`), this process's stale `release()` call
 * — still pending in a `finally` — would then delete the NEW holder's lock
 * file instead of its own, letting a third acquirer double-hold alongside
 * the second. This simulates exactly that sequence directly against the
 * lock file (no need to actually trigger a staleness misjudgment): acquire
 * normally, then simulate an external reclaim by overwriting the lock file
 * with a different pid's payload, then call the original `release()` and
 * assert the file — now representing someone else's live lock — survives.
 */
test('release() does not delete a lock file that no longer names this process as the holder', () => {
  const cwd = project();
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot as string;

  const release = acquireApplyLock(root);

  const lockPath = path.join(cwd, '.my_context', '.ingest', 'apply.lock');
  const otherPid = process.pid + 1; // need not be a real live process for this check
  writeFileSync(lockPath, JSON.stringify({ pid: otherPid, at: Date.now() }), 'utf8');

  release();

  assert.ok(
    existsSync(lockPath),
    'release() deleted a lock file recorded against a different pid — the cascade hazard is back',
  );
  const survivor = JSON.parse(readFileSync(lockPath, 'utf8'));
  assert.equal(survivor.pid, otherPid);

  rmSync(lockPath, { force: true }); // manual cleanup — this test never legitimately released
  rmSync(cwd, { recursive: true, force: true });
});

test('isRetryableLockError treats EEXIST and EPERM as retryable, nothing else', () => {
  assert.equal(isRetryableLockError('EEXIST'), true);
  // Windows returns EPERM (not EEXIST or EBUSY) for open(path, 'wx') against
  // a file that is delete-pending — see acquireApplyLock's doc comment.
  assert.equal(isRetryableLockError('EPERM'), true);
  assert.equal(isRetryableLockError('EACCES'), false);
  assert.equal(isRetryableLockError('ENOENT'), false);
  assert.equal(isRetryableLockError(undefined), false);
});

/**
 * Real-world robustness check for the EPERM fix: several processes rapidly
 * acquiring and releasing the SAME lock with no hold in between is exactly
 * the create/delete-pending timing that produced a raw, uncaught EPERM on
 * Windows before `isRetryableLockError` treated it as retryable (measured:
 * 5 of 8 racers died this way under this same shape of load). Every racer
 * must exit 0 — a thrown EPERM here means a legitimate caller got a hard
 * failure for doing nothing wrong.
 */
test('a tight multi-process acquire/release hammer never throws an uncaught lock error', async () => {
  const cwd = project();
  const results = await Promise.all(
    Array.from({ length: 8 }, () => spawnChild([HAMMER, cwd, '25'], cwd)),
  );
  for (const [i, r] of results.entries()) assert.equal(r.code, 0, `hammer ${i} failed: ${r.out}`);
  assert.deepEqual(lockFiles(cwd), []);
  rmSync(cwd, { recursive: true, force: true });
});
