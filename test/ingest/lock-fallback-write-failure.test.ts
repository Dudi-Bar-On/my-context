/**
 * The no-hard-links fallback in `acquireApplyLock`, when its write FAILS.
 *
 * The fallback is `openSync(file, 'wx')` followed by a separate `writeSync`.
 * Its doc comment described the transient window between those two syscalls —
 * an acquirer can observe an empty payload — and said nothing about what
 * happens when the write itself fails (ENOSPC, EIO, a quota, a disconnected
 * mount). Two things did, and both were silent:
 *
 * 1. The descriptor leaked. `acquireApplyLock` loops until `LOCK_TIMEOUT_MS`,
 *    so one call could leak many.
 * 2. The zero-byte lock file stayed on disk. Nothing reclaims that quickly:
 *    `isStaleLock` cannot parse it, so it waits out the five-minute
 *    `LOCK_STALE_MS` backstop and wedges every acquirer — over a purely local
 *    write failure, with a message blaming another process.
 *
 * `hardLinksSupported` in lock.ts is a process-wide latch, so this file
 * deliberately holds nothing else: `node --test` gives each file its own
 * process.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { closeSync, existsSync, mkdtempSync, openSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireApplyLock } from '../../src/ingest/lock.ts';
import { ingestDir } from '../../src/ingest/session.ts';

const base = mkdtempSync(path.join(tmpdir(), 'myctx-lockfb-'));
const root = path.join(base, '.my_context');
const lockFile = path.join(ingestDir(root), 'apply.lock');

/** A file this test can open and close repeatedly to observe fd numbering. */
const probeFile = path.join(base, 'probe');
writeFileSync(probeFile, 'x', 'utf8');

/**
 * The lowest currently-free descriptor number, used as a leak detector. Both
 * POSIX and libuv's Windows fd table hand out the lowest free slot, so a leaked
 * descriptor makes this number grow and a balanced open/close leaves it put.
 * Verified by construction below: the number is stable across repeated calls.
 */
function nextFreeFd(): number {
  const fd = openSync(probeFile, 'r');
  closeSync(fd);
  return fd;
}

function failWith(code: string): never {
  const err = new Error(`${code}: forced by test, write`) as NodeJS.ErrnoException;
  err.code = code;
  throw err;
}

test('the no-hard-links fallback leaves neither a wedged lock file nor a leaked fd', () => {
  const realLinkSync = fs.linkSync;
  const realWriteSync = fs.writeSync;
  fs.linkSync = () => failWith('EPERM');
  try {
    // Latch `hardLinksSupported` to false through a real acquire/release, so
    // the failing acquisitions below genuinely take the fallback branch
    // rather than being asserted about hypothetically.
    acquireApplyLock(root)();
    assert.equal(existsSync(lockFile), false, 'the released lock must be gone before the probe');

    const baseline = nextFreeFd();
    assert.equal(nextFreeFd(), baseline, 'the fd probe itself must not leak, or it proves nothing');

    fs.writeSync = (() => failWith('ENOSPC')) as typeof fs.writeSync;
    const attempts = 5;
    for (let i = 0; i < attempts; i++) {
      assert.throws(
        () => acquireApplyLock(root),
        /ENOSPC/,
        'a local write failure must surface as itself, not as a lock timeout',
      );
      assert.equal(
        existsSync(lockFile), false,
        `attempt ${i + 1} left a zero-byte apply.lock behind: nothing can parse it, so every ` +
        'acquirer waits out the five-minute LOCK_STALE_MS backstop over a local write failure',
      );
    }
    fs.writeSync = realWriteSync;

    assert.equal(
      nextFreeFd(), baseline,
      `${attempts} failed acquisitions leaked descriptors — acquireApplyLock retries until ` +
      'LOCK_TIMEOUT_MS, so one call can leak many',
    );

    // And the lock is genuinely still usable, which is what "not wedged" means.
    const release = acquireApplyLock(root);
    assert.ok(existsSync(lockFile));
    release();
  } finally {
    fs.writeSync = realWriteSync;
    fs.linkSync = realLinkSync;
    rmSync(base, { recursive: true, force: true });
  }
});
