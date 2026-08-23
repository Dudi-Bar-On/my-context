import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync, mkdtempSync, readdirSync, readFileSync, utimesSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireLock, reclaimStaleLock } from '../../src/core/lock.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The stale-lock reclaim path, asserted DIRECTLY.
 *
 * `acquireLock` reclaims a lock whose recorded holder is gone, so a process
 * killed without running its `finally` does not wedge a workspace. That
 * reclaim is a check followed by a removal, and the two are separated in time:
 * the check rules on a PAYLOAD, the removal deletes a PATH. What this file
 * guards is the case where the file at that path is no longer the one that was
 * checked — the reclaimer deletes a live holder's lock and then takes the lock
 * beside it, a double-hold produced by the recovery path meant to prevent one.
 *
 * That was not hypothetical. It was reproduced from separate real processes by
 * raising `test/core/session-names.test.ts`'s concurrent writers to 24 and 32:
 * with an unconditional removal, 11 of 20 rounds silently lost at least one of
 * 32 entries while every writer reported success. At six writers it shows up in
 * well under a tenth of runs, which is why these assertions are on the
 * primitive rather than on the odds — a probabilistic test of this is how the
 * defect survived five sightings against roughly twenty clean runs.
 */

function scratch(t: { after(fn: () => void): void }): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-lock-reclaim-'));
  t.after(() => removeTree(dir));
  return dir;
}

/** A pid that has certainly exited — a real child, waited on. */
function deadPid(): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['-e', '0'], { stdio: 'ignore' });
    const pid = child.pid as number;
    child.on('close', () => resolve(pid));
  });
}

/**
 * One dead pid for the whole file. Every "victim" payload below records it,
 * because `reclaimStaleLock` re-applies the staleness rule to its own re-read:
 * a payload naming a LIVE process is not abandoned and is refused outright,
 * whatever bytes the caller says it judged.
 */
const DEAD = await deadPid();

/** A lock payload as `acquireLock` writes one. Returned, not just written, so
 * a test can pass the EXACT bytes the judgement was made on. */
function lockPayload(nonce: string, pid = DEAD): string {
  return JSON.stringify({ pid, at: Date.now(), nonce });
}

/** The marker `reclaimStaleLock` uses to exclude other reclaimers of `raw`. */
function markerFor(file: string, raw: string): string {
  let key: string;
  try {
    const nonce = (JSON.parse(raw) as { nonce?: unknown }).nonce;
    key = typeof nonce === 'string' && nonce !== '' ? nonce : '';
  } catch {
    key = '';
  }
  if (key === '') key = `sha-${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
  return path.join(path.dirname(file), `${path.basename(file)}.tmp-reclaim-${key}`);
}

test('a reclaim removes the lock it judged', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  const judged = lockPayload('victim-nonce');
  writeFileSync(file, judged, 'utf8');

  assert.equal(reclaimStaleLock(file, judged), true);
  assert.equal(existsSync(file), false, 'the abandoned lock should be gone');
});

test('a reclaim does NOT remove a lock that was replaced after it was judged', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  // The judgement was about `judged`; by the time the removal runs, that
  // holder has released and a DIFFERENT, live acquirer owns the file. An
  // unconditional `rmSync` here deletes the live holder's lock, and the
  // reclaimer then enters the critical section beside it — which is exactly
  // the lost-entry failure `session-names.test.ts` sees from six processes.
  const judged = lockPayload('victim-nonce');
  writeFileSync(file, lockPayload('the-live-successor', process.pid), 'utf8');

  assert.equal(reclaimStaleLock(file, judged), false);
  assert.equal(existsSync(file), true, "a live successor's lock must not be deleted");
  assert.equal(
    (JSON.parse(readFileSync(file, 'utf8')) as { nonce: string }).nonce,
    'the-live-successor',
    "the successor's payload must be untouched",
  );
});

test('two reclaimers of one victim cannot both run — the second declines', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  const judged = lockPayload('victim-nonce');
  writeFileSync(file, judged, 'utf8');
  // Another reclaimer of this same victim is already inside its check-then-
  // remove. Without the exclusion both would delete, both would acquire, and
  // the second's removal would take the first's brand-new lock with it — the
  // same double-hold by another route.
  writeFileSync(markerFor(file, judged), '', 'utf8');

  assert.equal(reclaimStaleLock(file, judged), false);
  assert.equal(existsSync(file), true, 'the second reclaimer must leave the file alone');
});

test('an empty payload is reclaimable, but only once it is older than the backstop', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  // What the `openSync(file, 'wx')` fallback leaves if the process dies between
  // the create and the payload write: a lock naming nobody. It has no nonce, so
  // the marker is keyed on its bytes instead — and since two such files have
  // IDENTICAL bytes, byte equality alone would let an old one's reclaimer
  // delete a brand-new one. Staleness is re-checked to stop that.
  writeFileSync(file, '', 'utf8');
  assert.equal(reclaimStaleLock(file, ''), false, 'a fresh empty lock is not abandoned');
  assert.equal(existsSync(file), true);

  const longAgo = new Date(Date.now() - 10 * 60_000);
  utimesSync(file, longAgo, longAgo);
  assert.equal(reclaimStaleLock(file, ''), true, 'past the backstop it is abandoned');
  assert.equal(existsSync(file), false);
});

test('a reclaim refuses a payload whose recorded holder is still alive', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  // The bytes match what the caller judged, but the holder is this very
  // process. `reclaimStaleLock` re-applies the staleness rule to its re-read
  // rather than trusting the caller's verdict, so this is refused — the
  // identity check and the staleness check are both load-bearing.
  const judged = lockPayload('mine', process.pid);
  writeFileSync(file, judged, 'utf8');

  assert.equal(reclaimStaleLock(file, judged), false);
  assert.equal(existsSync(file), true, 'a live holder must never be reclaimed');
});

test('a reclaim leaves no marker behind, whether it removed the lock or declined', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');

  const first = lockPayload('a');
  writeFileSync(file, first, 'utf8');
  assert.equal(reclaimStaleLock(file, first), true);
  assert.deepEqual(readdirSync(dir), [], 'no marker after a successful reclaim');

  writeFileSync(file, lockPayload('b'), 'utf8');
  assert.equal(reclaimStaleLock(file, first), false);
  assert.deepEqual(readdirSync(dir).sort(), ['x.lock'], 'no marker after a declined reclaim');
});

test('a reclaim of a lock file that is already gone is not an error', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  const judged = lockPayload('a');
  assert.equal(reclaimStaleLock(file, judged), false);
  assert.deepEqual(readdirSync(dir), [], 'and leaves nothing behind');
});

test('a lock left by a dead process is still reclaimed — crash recovery survives the fix', (t) => {
  const dir = scratch(t);
  const file = path.join(dir, 'x.lock');
  // Exactly what a Ctrl-C'd holder leaves: a payload naming a pid that no
  // longer exists. Nothing will ever release it, so `acquireLock` has to take
  // it — and promptly, not after `LOCK_TIMEOUT_MS`.
  writeFileSync(file, lockPayload('crashed-holder'), 'utf8');

  const startedAt = Date.now();
  const release = acquireLock({ file, name: 'test', otherHolder: 'nothing is' });
  const elapsed = Date.now() - startedAt;
  t.after(() => { try { release(); } catch { /* already released */ } });

  assert.ok(elapsed < 2_000,
    `reclaim took ${elapsed}ms — crash recovery should not wait out the retry budget`);
  const owner = JSON.parse(readFileSync(file, 'utf8')) as { pid: number; nonce: string };
  assert.equal(owner.pid, process.pid, 'this process should now hold the lock');
  assert.notEqual(owner.nonce, 'crashed-holder');

  release();
  assert.equal(existsSync(file), false);
  assert.deepEqual(readdirSync(dir), [], 'no marker or temp left behind');
});
