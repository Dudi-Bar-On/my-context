import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import {
  closeSync, existsSync, openSync, readdirSync, readFileSync, rmSync, statSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { sleepMs } from '../core/sleep.ts';
import { ensureIngestDir, ingestDir } from './session.ts';

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

// The age at which a lock file whose payload CANNOT name a holder — and only
// such a file — is treated as abandoned. A payload that does name a pid is
// decided by that pid's liveness instead, at any age; see `isStaleLock`.
// Also the age at which an orphaned `apply.lock.tmp-*` file is reclaimed (see
// `reclaimStaleTemps`). Set well above any realistic single apply call: this
// is a crash-recovery backstop, not a normal-path timing knob — a legitimate
// holder finishes in well under a second even for a large chunk.
const LOCK_STALE_MS = 5 * 60_000;

/**
 * `nonce` identifies one ACQUISITION, not one process. `pid` cannot: this
 * module is explicitly built for two overlapping `acquireApplyLock` calls in
 * the same process (see `tempCounter`), and a pid-granular ownership check
 * cannot tell the second acquisition's lock from the first's — so a release
 * belonging to one of them would happily delete the other's file, which is
 * the same "delete a lock that is not mine" cascade `releaseFnFor` exists to
 * prevent across processes. `pid` stays in the payload because staleness
 * needs it (a nonce says nothing about whether its holder still exists) and
 * because the timeout message reports it to a human.
 */
interface LockPayload { pid: number; at: number; nonce: string }

const LOCK_BASENAME = 'apply.lock';

function applyLockPath(root: string): string {
  return path.join(ingestDir(root), LOCK_BASENAME);
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
 * case.
 *
 * **Staleness is PID-AUTHORITATIVE whenever the payload names a usable pid:
 * a live pid is NEVER stale, at any age, and a dead pid is ALWAYS stale, at
 * any age.** The `LOCK_STALE_MS` mtime backstop applies only when the pid
 * question cannot be answered at all — an unparseable payload, or a parseable
 * one with no usable `pid`.
 *
 * This replaces an mtime check that was an OR rather than an else, and the
 * reason is a defect that was reproduced on a real wall clock rather than
 * argued about: **the lock file's mtime is written once, at creation, and is
 * never refreshed.** Its age therefore measures how long the holder has been
 * WORKING, not how long it has been GONE, so a holder whose critical section
 * outlives `LOCK_STALE_MS` had its lock declared stale and stolen while it was
 * still running — a genuine double-hold, i.e. exactly the failure the lock
 * exists to prevent, produced by the recovery path meant to protect it.
 * A heartbeat that refreshed the mtime is not implementable here: the critical
 * section is fully synchronous and `sleepMs` blocks the thread, so no timer
 * could ever fire to do the refreshing. Making the live pid decisive removes
 * the need for one.
 *
 * **The residual, stated plainly because it is real and not fixed:** a holder
 * that crashes and whose pid is later REUSED by an unrelated live process
 * wedges this lock permanently — `isProcessAlive` answers "alive" forever,
 * nothing here can tell that process from the original holder, and there is no
 * automatic recovery. Every acquirer then fails after `LOCK_TIMEOUT_MS`. What
 * the code does about it is not a fix but an escape hatch: `retryOrThrow`'s
 * timeout message names the lock file, the recorded pid and the lock's age, so
 * a human can check whether that pid is really a `mycontext` process and
 * delete the file if it is not. No portable, dependency-free way to
 * distinguish a reused pid from the original holder is used here; process
 * start time would do it but reading it needs a platform-specific call.
 * Trading a permanent wedge (recoverable by hand, loudly reported) for a
 * silent double-hold (unrecoverable, silent, corrupts the corpus) is the
 * deliberate choice.
 *
 * An UNPARSEABLE payload (empty, truncated, corrupt) is not a case
 * `acquireApplyLock` can produce as a byproduct of its own construction:
 * see that function's doc comment for why the lock file is created by
 * `linkSync`-ing a fully-written temp file into place, which makes creation
 * atomic WITH its payload. A file that exists at all therefore always
 * carries a complete, valid payload unless something outside this module
 * corrupted it after the fact — genuine corruption, not a race this
 * function needs to tolerate with a grace period — or unless it was written
 * by the `openSync('wx')` fallback, whose window this module already accepts.
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

  const pid = recordedPid(raw);
  // Not `if (pid)` — pid 0 is not a pid this can ask about (`process.kill(0,
  // 0)` addresses a process GROUP, not a process), so `recordedPid` returns
  // null for it and the mtime backstop answers instead.
  if (pid !== null) return !isProcessAlive(pid);

  return Date.now() - mtimeMs > LOCK_STALE_MS;
}

/** The payload's `pid`, or null when the payload is unparseable or carries
 * nothing usable as one — the only case in which `LOCK_STALE_MS` decides. */
function recordedPid(raw: string): number | null {
  try {
    const payload = JSON.parse(raw) as Partial<LockPayload>;
    if (typeof payload?.pid === 'number' && Number.isInteger(payload.pid) && payload.pid > 0) {
      return payload.pid;
    }
  } catch {
    // Genuine corruption, not a mid-write race — see the doc comment above.
  }
  return null;
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

/**
 * The prefix of the temp files `acquireApplyLock`'s `linkSync` construction
 * writes its payload to before linking it into place. Built from
 * `LOCK_BASENAME`, and the acquire path builds its temp names from THIS, so
 * the writer and the reclaimer below cannot drift apart into naming two
 * different things.
 */
const TEMP_PREFIX = `${LOCK_BASENAME}.tmp-`;

/**
 * Deletes `apply.lock.tmp-*` files old enough that no live acquirer can still
 * be using them. A process killed between `openSync(tmp)` and the `finally`
 * that removes it leaks one, and nothing else knows its name — the release
 * path only ever touches `apply.lock` itself, and the lock tests' own
 * `lockFiles()` helper filters on `.endsWith('.lock')`, which is why a leak
 * here was invisible to the suite as well as to the code.
 *
 * The age threshold is `LOCK_STALE_MS` (5 minutes), and the margin is the
 * justification: a temp file is live only between `openSync` and `rmSync`
 * inside ONE synchronous block with no `await` and no I/O wait in between —
 * sub-millisecond in practice. Five minutes is more than five orders of
 * magnitude of headroom, so deleting a CONCURRENT acquirer's in-flight temp
 * file would require that acquirer to be descheduled mid-block for minutes
 * (a stopped process, a debugger breakpoint). It is also the same constant
 * this module already treats as "no live holder could still be here", so the
 * two recovery paths cannot drift to different definitions of abandoned.
 * Best-effort throughout: a file that vanishes underneath this (another
 * acquirer reclaiming the same leak) is not an error.
 */
function reclaimStaleTemps(dir: string): void {
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return; // no directory, or unreadable — nothing to reclaim, and not this call's problem
  }
  for (const name of names) {
    if (!name.startsWith(TEMP_PREFIX)) continue;
    const candidate = path.join(dir, name);
    try {
      if (Date.now() - statSync(candidate).mtimeMs > LOCK_STALE_MS) rmSync(candidate, { force: true });
    } catch { /* vanished or unreadable — best-effort */ }
  }
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
      `${describeHolder(file)} If that process is not a running \`mycontext\`, the lock is wedged ` +
      `— its holder crashed and the operating system has since reused its pid, which this lock ` +
      `cannot detect (see isStaleLock) — and deleting ${file} clears it. Otherwise another ` +
      `process is applying candidates in this workspace; try again shortly.`,
    );
  }
  const next = attempt + 1;
  sleepMs(Math.min(LOCK_RETRY_MS * next, LOCK_MAX_RETRY_MS));
  return next;
}

/**
 * The recorded holder of `file`, as a sentence for the timeout message: the
 * pid a human can check, and the lock's age. The age comes from the mtime,
 * which is stamped once at creation and never refreshed — so it is "held
 * for", i.e. how long ago this lock was TAKEN, and it is worded that way
 * rather than as a staleness measure, which it is not.
 */
function describeHolder(file: string): string {
  let ageMs: number;
  try {
    ageMs = Date.now() - statSync(file).mtimeMs;
  } catch {
    return 'The lock file vanished while this message was being written, so its holder is unknown.';
  }
  let raw = '';
  try {
    raw = readFileSync(file, 'utf8');
  } catch { /* unreadable — reported as an unknown pid below */ }
  const pid = recordedPid(raw);
  const heldFor = `held for ${Math.round(ageMs / 1000)}s`;
  return pid === null
    ? `Its payload records no usable pid (${heldFor}), so nothing here can say who holds it.`
    : `It records pid ${pid}, ${heldFor}.`;
}

/**
 * The release closure shared by both construction paths below, bound to the
 * `nonce` of the acquisition that created it.
 */
function releaseFnFor(file: string, nonce: string): () => void {
  return () => {
    // Ownership check before removal: an unconditional `rmSync` here is
    // what let a stolen-from holder's release() delete the THIEF's lock in
    // the hazard `isStaleLock`'s doc comment describes — this process may
    // no longer be the one holding `file` by the time `release()` runs
    // (e.g. a bug elsewhere wrongly judged this holder's lock stale and
    // reclaimed it while this process was still working). Only remove the
    // file if it still names THIS ACQUISITION as the holder; an unreadable
    // file at release time is treated as "not verifiably ours" and left
    // alone rather than guessed at.
    //
    // The check is on the NONCE, not the pid. A pid check answers "was this
    // written by this process", which is a strictly weaker question than "was
    // this written by this acquisition" — and the weaker answer is wrong for
    // the very case this module is designed to support: two overlapping
    // `acquireApplyLock` calls in one process (`tempCounter`'s doc comment).
    // With a pid check, the first call's release() deletes the SECOND call's
    // lock file, and a third acquirer then walks in alongside a holder that
    // still believes it is alone.
    try {
      const owner = JSON.parse(readFileSync(file, 'utf8')) as Partial<LockPayload>;
      if (owner.nonce !== nonce) return;
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
  // `ensureIngestDir` (session.ts), not a bare `mkdirSync`: that directory
  // holds nothing but working state — lock files, session headers, applied
  // and rejection logs. Every generated WORKING-STATE directory in this
  // project ships a `*` .gitignore inside it (`writeSnapshot`'s ledger
  // directory, src/core/ledger.ts:302; `ensureIngestDir` itself), and
  // `mycontext init` writes a narrower `.index.db` .gitignore into
  // `.my_context/`, which is committed knowledge rather than working state.
  // A workspace whose first ingest command was an APPLY reached this
  // directory through this function's own `mkdirSync` instead of through
  // `saveSession`, so it got no .gitignore at all and offered `apply.lock`
  // — and every session file written later — to git.
  const dir = ensureIngestDir(root);
  const file = applyLockPath(root);
  reclaimStaleTemps(dir);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let attempt = 0;

  for (;;) {
    const payload: LockPayload = { pid: process.pid, at: Date.now(), nonce: randomUUID() };

    if (hardLinksSupported) {
      const tmp = path.join(dir, `${TEMP_PREFIX}${process.pid}-${tempCounter++}`);
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
        return releaseFnFor(file, payload.nonce);
      } catch (err) {
        attempt = retryOrThrow(err, file, deadline, attempt);
        continue;
      }
    }

    try {
      const fd = openSync(file, 'wx');
      writeSync(fd, JSON.stringify(payload));
      closeSync(fd);
      return releaseFnFor(file, payload.nonce);
    } catch (err) {
      attempt = retryOrThrow(err, file, deadline, attempt);
    }
  }
}
