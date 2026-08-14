import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { acquireApplyLock } from '../../src/ingest/lock.ts';
import { ingestDir } from '../../src/ingest/session.ts';

const HOLDER = fileURLToPath(new URL('../fixtures/hold-apply-lock-at-root.ts', import.meta.url));

/** A bare `.my_context`-shaped root. `acquireApplyLock` needs nothing else. */
function root(): string {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-lockown-'));
  return path.join(base, '.my_context');
}

function cleanup(r: string): void {
  rmSync(path.dirname(r), { recursive: true, force: true });
}

function lockPath(r: string): string {
  return path.join(ingestDir(r), 'apply.lock');
}

function writeLock(r: string, payload: unknown): string {
  const file = lockPath(r);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(payload), 'utf8');
  return file;
}

/** Backdates a path's mtime by `ms`, so an mtime-based rule can be exercised
 * without waiting out `LOCK_STALE_MS` in real time. */
function backdate(file: string, ms: number): void {
  const when = new Date(Date.now() - ms);
  utimesSync(file, when, when);
}

/**
 * Spawns the holder fixture and exposes `ready` (resolves on its `ACQUIRED`
 * line, i.e. the instant it genuinely holds the lock) and `done`. Same
 * technique, and the same reason, as `test/cli/ingest-lock.test.ts`: only the
 * WHEN of an acquisition distinguishes a real wait from a steal, and a child
 * that steals still exits 0.
 */
function spawnHolder(r: string, holdMs: number): {
  ready: Promise<void>; done: Promise<{ gotAt: number; releasedAt: number }>;
} {
  const child = spawn(process.execPath, [HOLDER, r, String(holdMs)], { stdio: ['ignore', 'pipe', 'pipe'] });
  let buffer = '';
  let err = '';
  let resolveReady: () => void;
  const ready = new Promise<void>((resolve) => { resolveReady = resolve; });
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffer += chunk;
    if (buffer.includes('ACQUIRED\n')) resolveReady();
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

// --- I-14 (1): staleness is pid-authoritative, so a long-running holder is
// --- never robbed of a lock whose mtime it has no way to refresh.

test('a lock whose payload names a LIVE pid is not stale however old its mtime is', async () => {
  // The defect: the lock file's mtime is stamped once at creation and never
  // refreshed (a heartbeat is not implementable — the critical section is
  // synchronous and `sleepMs` blocks the thread), so its age measures how long
  // the holder has been WORKING. Under the old `LOCK_STALE_MS` mtime backstop
  // an apply that ran past five minutes had its lock declared stale and stolen
  // while it was still live — the exact double-hold the lock exists to
  // prevent, caused by the recovery path meant to protect it. The lock written
  // here names this test process, which is unambiguously alive, and is
  // backdated to twice `LOCK_STALE_MS`.
  const r = root();
  const file = writeLock(r, { pid: process.pid, at: Date.now(), nonce: 'held-by-a-live-process' });
  backdate(file, 10 * 60_000);

  const child = spawnHolder(r, 0);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const removedAt = Date.now();
  rmSync(file, { force: true });

  const result = await child.done;
  assert.ok(
    result.gotAt >= removedAt - 15,
    `the child acquired at ${result.gotAt}, before the live-pid lock was removed at ${removedAt} ` +
    `— a live holder's lock was stolen on age alone`,
  );
  cleanup(r);
});

test('a lock whose payload names a DEAD pid is still reclaimed immediately, however fresh its mtime', async () => {
  // The other half of pid-authoritative staleness, and the reason the mtime
  // backstop could be demoted rather than deleted: crash recovery does not
  // depend on age at all when the payload names a pid.
  const r = root();
  const dead = await new Promise<number>((resolve) => {
    const child = spawn(process.execPath, ['-e', 'process.exit(0)']);
    const pid = child.pid as number;
    child.on('close', () => resolve(pid));
  });
  writeLock(r, { pid: dead, at: Date.now(), nonce: 'left-behind-by-a-crash' });

  const startedAt = Date.now();
  const release = acquireApplyLock(r);
  const elapsed = Date.now() - startedAt;
  release();

  assert.ok(elapsed < 2000, `reclaiming a fresh dead-pid lock took ${elapsed}ms — should be near-instant`);
  cleanup(r);
});

test('an unparseable payload still falls through to the LOCK_STALE_MS mtime backstop', () => {
  // The backstop is now the answer ONLY when the pid question cannot be
  // asked. Deleting it would leave a corrupt lock file wedged forever, since
  // no pid can be read from it.
  const r = root();
  const file = lockPath(r);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, '{"pid":12', 'utf8');
  backdate(file, 10 * 60_000);

  const startedAt = Date.now();
  const release = acquireApplyLock(r);
  const elapsed = Date.now() - startedAt;
  release();

  assert.ok(elapsed < 2000, `an old unparseable lock took ${elapsed}ms to reclaim — the backstop is gone`);
  cleanup(r);
});

// --- I-14 (2): ownership is per-acquisition, not per-process ---------------

test('release() does not delete a lock taken by a DIFFERENT acquisition of the SAME process', () => {
  // `tempCounter`'s own doc comment says this module is built for overlapping
  // `acquireApplyLock` calls in one process (a host allowing concurrent tool
  // calls). A pid-granular ownership check cannot tell those two acquisitions
  // apart, so the first one's release() deletes the SECOND one's lock file and
  // a third acquirer walks in alongside a holder that believes it is alone.
  // Simulated directly: acquire, then overwrite the lock file with a payload
  // carrying this same pid but a different nonce — exactly what a second
  // acquisition by this process would have written — and release the first.
  const r = root();
  const release = acquireApplyLock(r);
  const file = lockPath(r);
  const mine = JSON.parse(readFileSync(file, 'utf8'));
  assert.equal(typeof mine.nonce, 'string');
  assert.notEqual(mine.nonce, '');

  const second = { pid: process.pid, at: Date.now(), nonce: `${mine.nonce}-second-acquisition` };
  writeFileSync(file, JSON.stringify(second), 'utf8');
  release();

  assert.ok(existsSync(file), 'release() deleted another acquisition of this same process');
  assert.equal(JSON.parse(readFileSync(file, 'utf8')).nonce, second.nonce);
  rmSync(file, { force: true });
  cleanup(r);
});

test('release() removes its own lock — the ownership check is not simply refusing everything', () => {
  const r = root();
  const release = acquireApplyLock(r);
  assert.ok(existsSync(lockPath(r)));
  release();
  assert.equal(existsSync(lockPath(r)), false);
  cleanup(r);
});

test('two acquisitions never share a nonce', () => {
  const r = root();
  const seen = new Set<string>();
  for (let i = 0; i < 5; i++) {
    const release = acquireApplyLock(r);
    seen.add(JSON.parse(readFileSync(lockPath(r), 'utf8')).nonce);
    release();
  }
  assert.equal(seen.size, 5);
  cleanup(r);
});

// --- The temp file: a unique name per acquisition, and reclaim of leaks ----

test('two acquisitions in one process never share a temp file name', () => {
  // `tempCounter`'s uniqueness was untested (recorded as a surviving mutant):
  // dropping the increment leaves two overlapping same-process acquisitions
  // writing their payloads to the SAME temp path, so one clobbers the other's
  // in-flight payload before either `linkSync` runs. Observed at the syscall
  // itself, since the temp name is internal.
  const r = root();
  const real = fs.linkSync;
  const temps: string[] = [];
  fs.linkSync = ((from: string, to: string) => {
    temps.push(from);
    return real(from, to);
  }) as typeof fs.linkSync;
  try {
    for (let i = 0; i < 3; i++) acquireApplyLock(r)();
  } finally {
    fs.linkSync = real;
  }

  assert.equal(temps.length, 3, `expected three linkSync calls, saw ${temps.length}`);
  assert.equal(new Set(temps).size, 3, `temp file names repeated: ${JSON.stringify(temps)}`);
  cleanup(r);
});

test('acquiring reclaims an abandoned temp file, and leaves a concurrent acquirer\'s fresh one alone', () => {
  // A process killed between `openSync(tmp)` and the `finally` that removes it
  // leaks a file nothing else knows the name of. The age threshold is
  // LOCK_STALE_MS, whose margin over the sub-millisecond window a temp file is
  // legitimately live for is what makes deleting a concurrent acquirer's
  // in-flight temp implausible rather than merely unlikely — asserted here in
  // both directions.
  const r = root();
  mkdirSync(ingestDir(r), { recursive: true });
  const abandoned = path.join(ingestDir(r), 'apply.lock.tmp-999999-0');
  const inFlight = path.join(ingestDir(r), 'apply.lock.tmp-999999-1');
  writeFileSync(abandoned, '{"pid":999999}', 'utf8');
  writeFileSync(inFlight, '{"pid":999999}', 'utf8');
  backdate(abandoned, 10 * 60_000);

  acquireApplyLock(r)();

  assert.equal(existsSync(abandoned), false, 'an abandoned temp file was not reclaimed');
  assert.equal(existsSync(inFlight), true, "a concurrent acquirer's in-flight temp file was deleted");
  cleanup(r);
});

test('acquiring leaves no temp file of its own behind', () => {
  const r = root();
  acquireApplyLock(r)();
  const strays = readdirSync(ingestDir(r)).filter((n) => n.includes('.tmp-'));
  assert.deepEqual(strays, []);
  cleanup(r);
});

// --- The .ingest/ directory is working state, not knowledge ----------------

test('acquiring the lock creates .ingest/ WITH a .gitignore, so lock files are never offered to git', () => {
  // `mycontext init` writes `.my_context/.gitignore`, `writeSnapshot` writes
  // one beside the ledger, and `saveSession` writes `*` into `.ingest/` — but
  // a workspace whose first ingest command was an APPLY reached `.ingest/`
  // through this lock's own `mkdirSync` instead, and got no .gitignore at all.
  const r = root();
  acquireApplyLock(r)();
  assert.equal(readFileSync(path.join(ingestDir(r), '.gitignore'), 'utf8'), '*\n');
  cleanup(r);
});
