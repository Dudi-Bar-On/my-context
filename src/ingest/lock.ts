import fs from 'node:fs';
import {
  closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { sleepMs } from '../core/sleep.ts';
import { ingestDir } from './session.ts';

// --- The ingest-apply lock --------------------------------------------------
//
// `applyCandidates` (src/ingest/apply.ts) documents, but does not itself
// guard against, a real hazard proven with two live processes on one
// workspace, ZERO artificial delay: two concurrent applies whose candidates
// share a title can both read `ctx.store.all()` before either has written,
// both compute the SAME id from `makeId`/`nextCollisionId`/`nextRevisionId`
// (src/ingest/apply.ts) for candidates with DIFFERENT bodies, and both call
// `createItem` with that id — one process's write silently overwrites the
// other's, or the second process's own `createItem` throws "already exists
// with different content" and its whole apply is lost (its OTHER, unrelated
// candidates included, since `saveSession` never runs on the throw path,
// leaving the anchor pending and due to re-extract on resume).
//
// The critical section that must be serialized is "open the mutation
// context (which reads `ctx.store.all()` internally, inside
// `applyCandidates`) through `saveSession`" — read, decide, write, record.
// What's serialized on MATTERS: the ids this hazard collides on come from
// `takenIds = new Set(everything.map(i => i.id))` in apply.ts, built from
// `ctx.store.all()` — i.e. EVERY item in the WORKSPACE, not just this
// session or this anchor. A lock keyed on `(sessionId, anchor)` was tried
// first and found insufficient: two DIFFERENT anchors of the same session,
// or two DIFFERENT sessions entirely, whose candidates happen to share a
// title, still race on the exact same `takenIds` set and can still collide
// — a per-anchor key does not cover the scope of the thing it is meant to
// protect. The lock is therefore per-WORKSPACE: one file,
// `<root>/.ingest/apply.lock`, held for the whole duration of any apply call
// in this workspace, regardless of which session or anchor it targets. This
// does mean two unrelated apply calls on two unrelated documents wait on
// each other; that is the accepted cost of matching the actual shared-state
// boundary rather than a narrower, unsound one.
//
// This module is the ONE implementation of that lock. Both entry points
// that reach the critical section — the CLI's `ingest-apply` command
// (src/cli/commands/ingest.ts) and the MCP `ingest_document` tool's second
// phase (src/mcp/tools/ingest.ts) — import `acquireApplyLock` from here
// rather than each carrying its own copy. This codebase has four recorded
// cases of a concurrency hazard being fixed at one call site and
// reappearing at another because the fix was not reachable from both; this
// module exists so a fifth is structurally impossible for this lock
// specifically.
const LOCK_RETRY_MS = 25;
const LOCK_MAX_RETRY_MS = 250;
const LOCK_TIMEOUT_MS = 15_000;

// How old (by the lock file's own mtime) or how conclusively dead (by its
// recorded pid) a lock must be before a NEW acquirer is allowed to break it.
// Set well above any realistic single apply call: this is a crash-recovery
// backstop, not a normal-path timing knob — a legitimate holder finishes in
// well under a second even for a large chunk.
const LOCK_STALE_MS = 5 * 60_000;

interface LockPayload { pid: number; at: number }

function applyLockPath(root: string): string {
  return path.join(ingestDir(root), 'apply.lock');
}

/**
 * `process.kill(pid, 0)` sends no signal — it only asks the OS "does a
 * process with this pid exist and am I allowed to signal it" — and works
 * this way on Windows as well as POSIX. `ESRCH` means no such process;
 * anything else (most commonly `EPERM`, a live process owned by another
 * user) means it is still alive as far as this check is concerned.
 */
function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException)?.code !== 'ESRCH';
  }
}

/**
 * A lock left behind by a process that Ctrl-C (or a crash) killed without
 * running its `finally` — this codebase has no signal handler anywhere in
 * `src/`, so that is the normal way a lock outlives its holder, not an edge
 * case. Staleness is PID-first when the payload parses (exact: the recorded
 * holder either still exists or it doesn't), but the mtime backstop below is
 * an OR, not an else: a pid that still belongs to a LIVE process is not
 * necessarily the ORIGINAL holder — a long-dead holder's pid can be reused by
 * an unrelated later process, and `isProcessAlive` would then say "alive"
 * forever, wedging the lock past `LOCK_TIMEOUT_MS` on every later acquirer
 * with no recovery. The mtime check applies regardless of whether the pid
 * parsed at all.
 *
 * An UNPARSEABLE payload (empty, truncated, corrupt) is no longer a case
 * `acquireApplyLock` can produce as a byproduct of its own construction:
 * see that function's doc comment for why the lock file is now created by
 * `linkSync`-ing a fully-written temp file into place, which makes creation
 * atomic WITH its payload. A file that exists at all therefore always
 * carries a complete, valid payload unless something outside this module
 * corrupted it after the fact — genuine corruption, not a race this
 * function needs to tolerate with a grace period. An unparseable payload
 * here falls straight through to the ordinary mtime backstop below, the
 * same as a parseable payload with no usable `pid`.
 */
function isStaleLock(file: string): boolean {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return false; // vanished between our EEXIST and this stat — its owner just released it
  }

  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return false; // vanished between stat and read — as above
  }

  try {
    const payload = JSON.parse(raw) as Partial<LockPayload>;
    if (typeof payload.pid === 'number' && !isProcessAlive(payload.pid)) return true;
  } catch {
    // Genuine corruption, not a mid-write race — see the doc comment above.
    // Fall through to the mtime backstop below, same as a parseable payload
    // with no usable pid.
  }

  return Date.now() - mtimeMs > LOCK_STALE_MS;
}

/**
 * Errors worth retrying against, rather than rethrowing immediately.
 * `EEXIST` is the expected "someone else holds it" case from `linkSync`
 * against an existing target. `EPERM` is included because Windows — this
 * project's primary platform — returns `EPERM`, not `EEXIST` or `EBUSY`,
 * for a link/open against a file that is delete-pending (another process
 * has unlinked it but the OS has not yet actually removed the directory
 * entry, a real window around every `release()`/reclaim `rmSync` in this
 * module). Measured directly: under a synthetic hammer of rapid concurrent
 * acquire/release cycles, 5 of 8 racers died with a raw `EPERM` thrown
 * straight out of the acquire loop before this was added — a hard exit 1
 * for a caller that did nothing wrong, on the one platform this matters
 * most on.
 */
export function isRetryableLockError(code: string | undefined): boolean {
  return code === 'EEXIST' || code === 'EPERM';
}

/** Monotonic per-process counter, folded into the temp file name below so
 * two concurrent `acquireApplyLock` calls IN THE SAME PROCESS (a host that
 * allows overlapping tool calls) never share a temp path and clobber each
 * other's in-flight payload before either's `linkSync` runs. */
let tempCounter = 0;

/**
 * Whether this process should still attempt the `linkSync` construction.
 * Starts `true` and is latched to `false` the first time `linkSync` fails
 * for a STRUCTURAL reason (see `acquireApplyLock`) rather than contention —
 * some filesystems (exFAT/FAT32 removable media, some SMB/NFS mounts, some
 * container volume drivers) do not support hard links at all, and Node
 * commonly surfaces that as `EPERM`, a code `isRetryableLockError` already
 * treats as "someone else holds it" for the Windows delete-pending case.
 * Without detecting this, that misclassification made every acquire on such
 * a filesystem burn the full `LOCK_TIMEOUT_MS` retry budget and then throw a
 * message blaming a process that does not exist — measured at just over
 * 15s, on every call, forever. Module-level (not per-call) because the
 * filesystem backing a given workspace does not change mid-process, so
 * re-discovering this on every single `acquireApplyLock` call would mean
 * paying one guaranteed-to-fail `linkSync` attempt (plus its temp-file
 * create/delete) every time for no benefit.
 */
let hardLinksSupported = true;

/**
 * Shared handling for a failed lock-file creation attempt, from EITHER
 * construction path below: rethrows anything `isRetryableLockError` does not
 * cover, reclaims and retries immediately on a stale lock, throws the
 * user-facing timeout message once `deadline` has passed, and otherwise
 * sleeps a backing-off interval before the next attempt. Returns the
 * incremented attempt count for the caller to carry forward — a `for(;;)`
 * loop this is inlined into cannot receive an out-parameter, so state
 * threads through the return value instead of a shared mutable closure.
 */
function retryOrThrow(err: unknown, file: string, deadline: number, attempt: number): number {
  if (!isRetryableLockError((err as NodeJS.ErrnoException)?.code)) throw err;
  if (isStaleLock(file)) {
    try { rmSync(file, { force: true }); } catch { /* someone else reclaimed it first; fine */ }
    return attempt; // retry immediately — no reason to wait out a stale lock
  }
  if (Date.now() >= deadline) {
    throw new Error(
      `my_context: could not acquire the ingest-apply lock (${file}) after ${LOCK_TIMEOUT_MS}ms. ` +
      `Another process may be applying candidates in this workspace — try again shortly.`,
    );
  }
  const next = attempt + 1;
  sleepMs(Math.min(LOCK_RETRY_MS * next, LOCK_MAX_RETRY_MS));
  return next;
}

/** The release closure shared by both construction paths below. */
function releaseFnFor(file: string): () => void {
  return () => {
    // Ownership check before removal: an unconditional `rmSync` here is
    // what let a stolen-from holder's release() delete the THIEF's lock in
    // the hazard `isStaleLock`'s doc comment describes — this process may
    // no longer be the one holding `file` by the time `release()` runs
    // (e.g. a bug elsewhere wrongly judged this holder's lock stale and
    // reclaimed it while this process was still working). Only remove the
    // file if it still names THIS process as the holder; an unreadable
    // file at release time is treated as "not verifiably ours" and left
    // alone rather than guessed at.
    try {
      const owner = JSON.parse(readFileSync(file, 'utf8')) as Partial<LockPayload>;
      if (owner.pid !== process.pid) return;
    } catch {
      return;
    }
    try { rmSync(file, { force: true }); } catch { /* best-effort cleanup */ }
  };
}

/**
 * Blocks (via a bounded, backing-off poll — `sleepMs` blocks the thread
 * without a dependency, see core/sleep.ts) until this process holds the
 * workspace's ingest-apply lock, then returns a function that releases it.
 * A lock found stale (`isStaleLock`) is reclaimed immediately, without
 * waiting out the rest of the poll budget. Throws a `my_context:`-prefixed
 * message if the lock is still legitimately held by someone else after
 * `LOCK_TIMEOUT_MS`.
 *
 * Construction is `linkSync` where available, not `openSync(file, 'wx')`
 * followed by a separate `writeSync`. The two-step version creates the lock
 * file EMPTY, with the pid payload arriving on a second, non-atomic syscall
 * — a window a concurrent acquirer's `EEXIST` can land inside, observing an
 * empty or truncated payload. An earlier version of this module tolerated
 * that with a short grace period before treating an unparseable payload as
 * stale; forcing a 700ms stall inside that window collapsed exclusion
 * completely (12 of 12 acquisitions double-held), because the grace period
 * was a TIMING ASSUMPTION, not a structural guarantee — a holder that
 * legitimately stalls past the grace period looks identical to an abandoned
 * write. Writing the full payload to a uniquely-named temp file first, then
 * `linkSync`-ing that temp file into place, makes creation atomic WITH its
 * content: `linkSync` only ever creates a new directory entry pointing at an
 * inode that is already completely written, and fails `EEXIST` cleanly if
 * the target already exists. There is no window in which the target exists
 * but is empty or partial, so there is nothing left for a grace period to
 * protect against — see `isStaleLock`'s doc comment for the other half of
 * this.
 *
 * `linkSync` itself is not universally available: see `hardLinksSupported`'s
 * doc comment. When it fails for a reason that turns out NOT to be
 * contention — the retryable-looking error arrives but `file` was never
 * actually created — this function falls back, for the rest of this process's
 * lifetime, to the plain `openSync(file, 'wx')` + `writeSync` construction,
 * which has no hard-link dependency. That construction reintroduces the
 * empty/truncated-payload window the `linkSync` path closes, but not a new
 * hazard beyond what this codebase already tolerates for any OTHER corrupt
 * payload: `isStaleLock` treats an unparseable payload the same way
 * regardless of cause, falling through to the `LOCK_STALE_MS` mtime backstop
 * rather than reclaiming it quickly — a filesystem that cannot support the
 * stronger construction still gets a working, merely slower-to-recover,
 * lock instead of the false "another process may be applying candidates"
 * this function used to throw after burning the full timeout on such a
 * filesystem.
 */
export function acquireApplyLock(root: string): () => void {
  mkdirSync(ingestDir(root), { recursive: true });
  const file = applyLockPath(root);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let attempt = 0;

  for (;;) {
    const payload: LockPayload = { pid: process.pid, at: Date.now() };

    if (hardLinksSupported) {
      const tmp = `${file}.tmp-${process.pid}-${tempCounter++}`;
      try {
        const fd = openSync(tmp, 'w');
        writeSync(fd, JSON.stringify(payload));
        closeSync(fd);
        try {
          // Called as `fs.linkSync`, not a destructured named import, so
          // `test/fixtures/force-linksync-failure.ts` can force this exact
          // call to fail without a dependency-injection seam in this
          // module's public API: reassigning a property on the `node:fs`
          // default-export object is observed by every call site that reads
          // the property at call time, but NOT by a `{ linkSync } from
          // 'node:fs'` binding elsewhere, which is resolved once at import
          // time — confirmed directly, not assumed.
          fs.linkSync(tmp, file);
        } catch (err) {
          const code = (err as NodeJS.ErrnoException)?.code;
          // `EEXIST` is unambiguous contention regardless of filesystem —
          // handled by the outer catch below like any other retryable
          // error. Anything else is contention too IF the target actually
          // exists (some other process's `linkSync` beat this one to it);
          // but if the target does NOT exist, `linkSync` itself could not
          // complete the operation on this filesystem — a structural
          // failure, not a held lock, and rethrowing or waiting out a
          // retry budget for it would be exactly the "another process may
          // be applying candidates" lie this fallback exists to prevent.
          if (code !== 'EEXIST' && !existsSync(file)) {
            hardLinksSupported = false;
            continue; // not contention — retry now, via the fallback below
          }
          throw err;
        } finally {
          // The temp file's own directory entry is never the lock — only
          // `file` (the link target) is. Removed unconditionally, whether
          // the link succeeded or not: a stray `.tmp-*` file left behind on
          // failure would never be cleaned by anything else, since nothing
          // else in this module knows its name.
          try { rmSync(tmp, { force: true }); } catch { /* best-effort cleanup */ }
        }
        return releaseFnFor(file);
      } catch (err) {
        attempt = retryOrThrow(err, file, deadline, attempt);
        continue;
      }
    }

    try {
      const fd = openSync(file, 'wx');
      writeSync(fd, JSON.stringify(payload));
      closeSync(fd);
      return releaseFnFor(file);
    } catch (err) {
      attempt = retryOrThrow(err, file, deadline, attempt);
    }
  }
}
