import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { acquireApplyLock } from '../../src/ingest/lock.ts';
import { ingestDir } from '../../src/ingest/session.ts';

/**
 * Its own file because it deliberately burns the real `LOCK_TIMEOUT_MS`
 * (15s): the message is what a human sees at the end of that wait, and the
 * only honest way to obtain it is to wait. `sleepMs` blocks the thread, so
 * this cannot be interleaved with anything else in the same file anyway.
 *
 * What is being pinned is the ESCAPE HATCH for the residual `isStaleLock`
 * documents and does not fix: a crashed holder whose pid the OS later reuses
 * for an unrelated live process wedges this lock permanently, with no
 * automatic recovery, because nothing portable can tell that process from the
 * original holder. The only thing standing between a user and an
 * unexplainable 15-second failure on every apply, forever, is that this
 * message names the lock file, the pid recorded in it and how long it has
 * been held — enough to check whether that pid is really a `mycontext` and to
 * delete the file if it is not.
 */
test('the acquire timeout names the lock file, the recorded pid and the lock\'s age', { timeout: 60_000 }, () => {
  const base = mkdtempSync(path.join(tmpdir(), 'myctx-locktmo-'));
  const root = path.join(base, '.my_context');
  const file = path.join(ingestDir(root), 'apply.lock');
  mkdirSync(path.dirname(file), { recursive: true });
  // A live pid (this very process) — never stale, by design — so the acquire
  // has no way out except the timeout.
  writeFileSync(file, JSON.stringify({ pid: process.pid, at: Date.now(), nonce: 'wedged' }), 'utf8');

  assert.throws(
    () => acquireApplyLock(root),
    (err: Error) => {
      assert.match(err.message, /could not acquire the ingest-apply lock/);
      assert.ok(err.message.includes(file), `the message does not name the lock file: ${err.message}`);
      assert.ok(
        err.message.includes(`pid ${process.pid}`),
        `the message does not name the recorded pid: ${err.message}`,
      );
      assert.match(err.message, /held for \d+s/);
      return true;
    },
  );

  rmSync(base, { recursive: true, force: true });
});
