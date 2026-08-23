import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import {
  closeSync, existsSync, openSync, readdirSync, readFileSync, rmSync, statSync,
} from 'node:fs';
import path from 'node:path';
import { sleepMs } from './sleep.ts';

// --- The workspace file lock ------------------------------------------------
//
// This module is the ONE implementation of the file lock this project uses to
// serialize a read-decide-write critical section across processes. It was
// written for, and every guarantee in it was established by, the ingest-apply
// lock (`acquireApplyLock`, src/ingest/lock.ts, which is now a thin wrapper
// over `acquireLock` below). That lock's own history explains the shape:
//
//   `applyCandidates` (src/ingest/apply.ts) documents, but does not itself
//   guard against, a real hazard proven with two live processes on one
//   workspace, ZERO artificial delay: two concurrent applies whose candidates
//   share a title can both read `ctx.store.all()` before either has written,
//   both compute the SAME id for candidates with DIFFERENT bodies, and both
//   call `createItem` with that id — one process's write silently overwrites
//   the other's, or the second process's own `createItem` throws and its whole
//   apply is lost.
//
//   What's serialized on MATTERS: the ids that hazard collides on are derived
//   from EVERY item in the WORKSPACE, not just one session or one anchor. A
//   lock keyed on `(sessionId, anchor)` was tried first and found insufficient
//   — a per-anchor key does not cover the scope of the thing it is meant to
//   protect. That lock is therefore per-WORKSPACE. This does mean two
//   unrelated apply calls on two unrelated documents wait on each other; that
//   is the accepted cost of matching the actual shared-state boundary rather
//   than a narrower, unsound one.
//
// Callers name their own lock file and their own timeout wording through
// `LockSpec`. Two different `LockSpec`s with different `file` paths do NOT
// exclude each other — each protects its own critical section — so a caller
// choosing a per-item lock file when its shared state is workspace-wide would
// reproduce the per-anchor mistake above. Pick the file to match the state.
//
// This codebase has four recorded cases of a concurrency hazard being fixed at
// one call site and reappearing at another because the fix was not reachable
// from both; this module exists so a fifth is structurally impossible for this
// lock specifically. A second implementation of a file lock anywhere in `src/`
// is that fifth case, whatever it is called.
const LOCK_RETRY_MS = 25;
const LOCK_MAX_RETRY_MS = 250;
const LOCK_TIMEOUT_MS = 15_000;

// The age at which a lock file whose payload CANNOT name a holder — and only
// such a file — is treated as abandoned. A payload that does name a pid is
// decided by that pid's liveness instead, at any age; see `judgeStale`.
// Also the age at which an orphaned `<basename>.tmp-*` file is reclaimed (see
// `reclaimStaleTemps`). Set well above any realistic single critical section:
// this is a crash-recovery backstop, not a normal-path timing knob — a
// legitimate holder finishes in well under a second.
const LOCK_STALE_MS = 5 * 60_000;

/**
 * What a caller is locking, and how to describe it to a human when the wait
 * times out.
 *
 * `name` and `otherHolder` exist so the timeout message stays TRUE for each
 * lock rather than being written once for the first caller and inherited as a
 * lie by the second. A revision promotion told to "try again shortly, another
 * process is applying candidates" would be asserting something the code does
 * not know.
 */
export interface LockSpec {
  /** Absolute path to the lock file. Its directory must already exist. */
  file: string;
  /** What this lock protects, e.g. `ingest-apply`. Read as "the <name> lock". */
  name: string;
  /**
   * What the OTHER process is most likely doing, as a clause that completes
   * "Otherwise …; try again shortly." e.g. "another process is applying
   * candidates in this workspace".
   */
  otherHolder: string;
}

/**
 * `nonce` identifies one ACQUISITION, not one process. `pid` cannot: this
 * module is explicitly built for two overlapping `acquireLock` calls in
 * the same process (see `tempCounter`), and a pid-granular ownership check
 * cannot tell the second acquisition's lock from the first's — so a release
 * belonging to one of them would happily delete the other's file, which is
 * the same "delete a lock that is not mine" cascade `releaseFnFor` exists to
 * prevent across processes. `pid` stays in the payload because staleness
 * needs it (a nonce says nothing about whether its holder still exists) and
 * because the timeout message reports it to a human.
 */
interface LockPayload { pid: number; at: number; nonce: string }

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
 * Whether the lock file was left behind by a process that died without
 * releasing it — and if so, the exact PAYLOAD that was judged, so the caller
 * can remove the file the judgement was ABOUT rather than whatever file
 * happens to sit at that path when the removal runs. `null` means "not
 * stale", which includes "vanished underneath this judgement". See
 * `reclaimStaleLock` for why returning the payload, rather than a bare
 * boolean, is the difference between crash recovery and a double-hold.
 *
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
 * `acquireLock` can produce as a byproduct of its own construction:
 * see that function's doc comment for why the lock file is created by
 * `linkSync`-ing a fully-written temp file into place, which makes creation
 * atomic WITH its payload. A file that exists at all therefore always
 * carries a complete, valid payload unless something outside this module
 * corrupted it after the fact — genuine corruption, not a race this
 * function needs to tolerate with a grace period — or unless it was written
 * by the `openSync('wx')` fallback, whose window this module already accepts.
 */
function judgeStale(file: string): string | null {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return null; // vanished between our EEXIST and this stat — its owner just released it
  }

  let raw: string;
  try {
    raw = readFileSync(file, 'utf8');
  } catch {
    return null; // vanished between stat and read — as above
  }

  return staleBy(raw, mtimeMs) ? raw : null;
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
    // Genuine corruption, not a mid-write race — see `judgeStale`'s doc
    // comment above on why an unparseable payload is not a race this has to
    // tolerate with a grace period.
  }
  return null;
}

/**
 * The staleness rule itself, over a payload ALREADY READ and the mtime of the
 * same file. Split out from `judgeStale` so `reclaimStaleLock` can re-apply
 * the identical rule to its re-read without a second definition of stale
 * drifting away from this one.
 */
function staleBy(raw: string, mtimeMs: number): boolean {
  const pid = recordedPid(raw);
  // Not `if (pid)` — pid 0 is not a pid this can ask about (`process.kill(0,
  // 0)` addresses a process GROUP, not a process), so `recordedPid` returns
  // null for it and the mtime backstop answers instead.
  if (pid !== null) return !isProcessAlive(pid);

  return Date.now() - mtimeMs > LOCK_STALE_MS;
}

/**
 * The exclusive marker one reclaimer creates so no OTHER reclaimer of the same
 * lock can run beside it. Named after the VICTIM, never the reclaimer: every
 * process that judged the same payload stale contends for this one name and
 * exactly one wins, which is the whole point of it.
 *
 * The victim is named by its `nonce` when it has one — already a unique,
 * filename-safe name for exactly one acquisition — and by a digest of its
 * bytes when it does not. A payload with no nonce is not an exotic case: the
 * `openSync(file, 'wx')` fallback's empty/truncated window produces one, so
 * does genuine corruption, and so does any lock file written by something
 * other than this module (`test/cli/ingest-lock.test.ts` writes `{pid, at}`
 * by hand). Those are exactly the payloads the `LOCK_STALE_MS` mtime backstop
 * exists to recover, so they must be reclaimable, and a digest gives them the
 * same one-marker-per-victim contention a nonce gives the rest.
 *
 * Built from `tempPrefix`, so a marker leaked by a process killed mid-reclaim
 * is already swept by `reclaimStaleTemps` at `LOCK_STALE_MS`, and two
 * different locks living in one directory cannot sweep each other's.
 */
function reclaimMarker(file: string, raw: string): string {
  let key: string;
  try {
    const payload = JSON.parse(raw) as Partial<LockPayload>;
    key = typeof payload?.nonce === 'string' && payload.nonce !== '' ? payload.nonce : '';
  } catch {
    key = '';
  }
  if (key === '') key = `sha-${createHash('sha256').update(raw).digest('hex').slice(0, 32)}`;
  return path.join(path.dirname(file), `${tempPrefix(file)}reclaim-${key}`);
}

/**
 * Removes `file` **only if it is still the exact lock that was judged**, and
 * reports whether it did. `judgedRaw` is the payload `judgeStale` read and
 * ruled on.
 *
 * `judgeStale` answers a question about a payload read at ONE INSTANT; the
 * removal happens at a later one. In between, the lock just judged can be
 * released and REPLACED by a live acquirer's. An unconditional `rmSync(file)`
 * there deletes that new, legitimately-held lock, and the reclaimer then walks
 * straight in beside its holder — two processes inside one critical section,
 * which is the entire failure this module exists to prevent, produced by the
 * recovery path meant to protect it. It is the same "delete a lock that is not
 * mine" cascade `releaseFnFor` carries a nonce check against; the release path
 * had that guard and this one did not.
 *
 * Not a theoretical window. Reproduced on this machine from separate real
 * processes with zero artificial delay, by raising
 * `test/core/session-names.test.ts`'s concurrent writers to 24 and then 32: a
 * reclaimer read a payload naming a pid that had just exited, and ~8ms later —
 * the cost of a `process.kill` liveness probe plus ordinary scheduler delay —
 * deleted a DIFFERENT payload belonging to a live holder that was mid-write.
 * That holder's `release()` then correctly declined to remove a file no longer
 * naming it, by which point both had read the store and one's entry was gone.
 * Eleven rounds in twenty lost at least one of 32 entries, every writer
 * reporting success. The trigger is ordinary rather than exotic: a short-lived
 * process makes "the recorded pid is dead" true within milliseconds of a
 * NORMAL release, so a healthy release-then-reacquire is indistinguishable
 * from a crash to a check that consults liveness alone.
 *
 * **Why the marker makes this structural rather than merely narrower.** Once
 * the re-read under the marker confirms `file` still carries `judgedRaw`,
 * nothing can replace it before the `rmSync`:
 *
 *   - Replacement requires prior REMOVAL. Both constructions in `acquireLock`
 *     (`linkSync`, `openSync(file, 'wx')`) fail against an existing target,
 *     and nothing in this module writes the lock file in place.
 *   - The only removals of `file` are `releaseFnFor` and this function.
 *     `releaseFnFor` removes it only on behalf of the acquisition whose nonce
 *     the payload names — i.e. from the process recorded in it, which is
 *     already dead on the pid path, and which on the mtime path has not
 *     touched this file for `LOCK_STALE_MS`.
 *   - Another reclaimer of the SAME payload cannot create the marker. A
 *     reclaimer of any OTHER payload re-reads `file`, finds `judgedRaw`
 *     instead of the bytes it judged, and declines exactly as this one would.
 *
 * So the check and the removal cannot be separated by a replacement, and no
 * timing assumption is carrying the guarantee — which matters here
 * specifically, because a grace period standing in for a structural guarantee
 * is the defect `acquireLock`'s `linkSync` construction was written to retire.
 *
 * The staleness rule is re-applied to the re-read as well as the payload
 * compared, and the second check is not redundant: two DIFFERENT lock files
 * can carry identical bytes when those bytes are the empty string, which is
 * precisely what the `openSync(file, 'wx')` fallback puts on disk for an
 * instant. Byte equality alone would let a five-minute-old empty lock's
 * reclaimer delete a brand-new one; re-checking staleness sees the fresh mtime
 * and declines.
 *
 * **The residual, stated because it is real:** a process killed between
 * creating the marker and the `finally` that removes it leaves that ONE victim
 * unreclaimable until `reclaimStaleTemps` sweeps the marker at
 * `LOCK_STALE_MS`, so a crashed holder's lock wedges for up to that long
 * instead of being reclaimed at once. That is a bounded delay in CRASH
 * RECOVERY, traded for the removal of a silent double-hold on the NORMAL path
 * — the same asymmetry `judgeStale` chose when it preferred a loudly-reported
 * wedge to a silent double-hold.
 *
 * **Exported for testing on purpose**, for the reason `isCorruptionError`
 * (core/store.ts) is: exercising this only THROUGH `acquireLock` proves
 * nothing. The old unconditional `rmSync` and this identity-checked removal
 * differ only inside a window measured in milliseconds, so a test driven
 * through the public API can observe the difference only PROBABILISTICALLY —
 * it would have stayed green on the broken code most of the time, which is how
 * this defect survived five sightings and roughly twenty clean isolated runs.
 * The distinction has to be asserted directly, and
 * `test/core/lock-stale-reclaim.test.ts` does; the multi-process test in
 * `test/core/session-names.test.ts` remains the end-to-end evidence.
 */
export function reclaimStaleLock(file: string, judgedRaw: string): boolean {
  const marker = reclaimMarker(file, judgedRaw);
  try {
    // `wx` is atomic create-or-fail on win32 (`CREATE_NEW`) exactly as on
    // POSIX (`O_CREAT|O_EXCL`). No payload: the NAME is the claim, so there is
    // no second syscall for a concurrent reader to land inside.
    closeSync(openSync(marker, 'wx'));
  } catch {
    return false; // another process owns this victim's reclaim; leave it to them
  }
  try {
    let mtimeMs: number;
    let raw: string;
    try {
      mtimeMs = statSync(file).mtimeMs;
      raw = readFileSync(file, 'utf8');
    } catch {
      return false; // already gone — released or reclaimed since we judged it
    }
    // The two checks this whole function exists for: the file at this path may
    // no longer be the one that was judged, and bytes alone do not identify it.
    if (raw !== judgedRaw) return false;
    if (!staleBy(raw, mtimeMs)) return false;
    try { rmSync(file, { force: true }); } catch { return false; }
    return true;
  } finally {
    try { rmSync(marker, { force: true }); } catch { /* best-effort; swept by reclaimStaleTemps */ }
  }
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
 * The prefix of the temp files `acquireLock`'s `linkSync` construction writes
 * its payload to before linking it into place. Derived from the lock file's
 * OWN basename, and the acquire path builds its temp names from this same
 * function, so the writer and the reclaimer below cannot drift apart into
 * naming two different things — and two different locks living in one
 * directory cannot reclaim each other's in-flight temp files.
 */
function tempPrefix(file: string): string {
  return `${path.basename(file)}.tmp-`;
}

/**
 * Deletes `<basename>.tmp-*` files old enough that no live acquirer can still
 * be using them. A process killed between `openSync(tmp)` and the `finally`
 * that removes it leaks one, and nothing else knows its name — the release
 * path only ever touches the lock file itself, and the lock tests' own
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
function reclaimStaleTemps(file: string): void {
  const dir = path.dirname(file);
  const prefix = tempPrefix(file);
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    return; // no directory, or unreadable — nothing to reclaim, and not this call's problem
  }
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const candidate = path.join(dir, name);
    try {
      if (Date.now() - statSync(candidate).mtimeMs > LOCK_STALE_MS) rmSync(candidate, { force: true });
    } catch { /* vanished or unreadable — best-effort */ }
  }
}

/** Monotonic per-process counter, folded into the temp file name below so
 * two concurrent `acquireLock` calls IN THE SAME PROCESS (a host that
 * allows overlapping tool calls) never share a temp path and clobber each
 * other's in-flight payload before either's `linkSync` runs. */
let tempCounter = 0;

/**
 * Whether this process should still attempt the `linkSync` construction.
 * Starts `true` and is latched to `false` the first time `linkSync` fails
 * for a STRUCTURAL reason (see `acquireLock`) rather than contention —
 * some filesystems (exFAT/FAT32 removable media, some SMB/NFS mounts, some
 * container volume drivers) do not support hard links at all, and Node
 * commonly surfaces that as `EPERM`, a code `isRetryableLockError` already
 * treats as "someone else holds it" for the Windows delete-pending case.
 * Without detecting this, that misclassification made every acquire on such
 * a filesystem burn the full `LOCK_TIMEOUT_MS` retry budget and then throw a
 * message blaming a process that does not exist — measured at just over
 * 15s, on every call, forever. Module-level (not per-call) because the
 * filesystem backing a given workspace does not change mid-process, so
 * re-discovering this on every single `acquireLock` call would mean
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
function retryOrThrow(err: unknown, spec: LockSpec, deadline: number, attempt: number): number {
  const file = spec.file;
  if (!isRetryableLockError((err as NodeJS.ErrnoException)?.code)) throw err;
  const stale = judgeStale(file);
  // Only a reclaim that ACTUALLY removed the lock this attempt judged skips
  // the backoff. A declined one — the file was replaced since the judgement,
  // or another process owns this victim's reclaim — falls through to the
  // deadline check and the sleep below, rather than hot-spinning against a
  // lock somebody else legitimately holds.
  if (stale !== null && reclaimStaleLock(file, stale)) {
    return attempt; // retry immediately — no reason to wait out a stale lock
  }
  if (Date.now() >= deadline) {
    throw new Error(
      `my_context: could not acquire the ${spec.name} lock (${file}) after ${LOCK_TIMEOUT_MS}ms. ` +
      `${describeHolder(file)} If that process is not a running \`mycontext\`, the lock is wedged ` +
      `— its holder crashed and the operating system has since reused its pid, which this lock ` +
      `cannot detect (see judgeStale) — and deleting ${file} clears it. Otherwise ` +
      `${spec.otherHolder}; try again shortly.`,
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
    // the hazard `judgeStale`'s doc comment describes — this process may
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
    // `acquireLock` calls in one process (`tempCounter`'s doc comment).
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
 * without a dependency, see core/sleep.ts) until this process holds
 * `spec.file`, then returns a function that releases it. A lock found stale
 * (`judgeStale`) is reclaimed immediately — but only if it is still the same
 * lock that was judged (`reclaimStaleLock`) — without waiting out the rest of
 * the poll budget. Throws a `my_context:`-prefixed message if the lock is
 * still legitimately held by someone else after `LOCK_TIMEOUT_MS`.
 *
 * The directory holding `spec.file` must already exist — every caller creates
 * its own working-state directory (with the `*` .gitignore that directory
 * needs) before calling, and guessing here would write one without it.
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
 * protect against — see `judgeStale`'s doc comment for the other half of
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
 * payload: `judgeStale` treats an unparseable payload the same way
 * regardless of cause, falling through to the `LOCK_STALE_MS` mtime backstop
 * rather than reclaiming it quickly — a filesystem that cannot support the
 * stronger construction still gets a working, merely slower-to-recover,
 * lock instead of the false "another process may be holding it" this
 * function used to throw after burning the full timeout on such a
 * filesystem.
 *
 * That is the TRANSIENT window, and it is the only one this comment used to
 * describe. There is a second, PERSISTENT one, and it is named here because
 * an unstated window is how a "brief" claim gets read as a complete one: if
 * the `writeSync` itself fails, the zero-byte lock file it opened stays on
 * disk. Nothing recovers that quickly — `judgeStale` cannot parse it, so it
 * waits out the full `LOCK_STALE_MS` backstop and wedges every acquirer,
 * including this process's own retry, for five minutes over a purely local
 * write failure. The fallback therefore removes the file before letting the
 * error propagate (and closes its descriptor, which it also used to leak).
 * The removal is best-effort: on a filesystem that can fail the write it can
 * fail the unlink too, so the claim is that a failed write does not leave the
 * lock behind BY CONSTRUCTION — not that it can never be left behind.
 */
export function acquireLock(spec: LockSpec): () => void {
  const file = spec.file;
  const dir = path.dirname(file);
  reclaimStaleTemps(file);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let attempt = 0;

  for (;;) {
    const payload: LockPayload = { pid: process.pid, at: Date.now(), nonce: randomUUID() };

    if (hardLinksSupported) {
      const tmp = path.join(dir, `${tempPrefix(file)}${process.pid}-${tempCounter++}`);
      try {
        // `try/finally` around the write, not three bare statements: a
        // `writeSync` that throws (ENOSPC, EIO, a quota, a disconnected
        // mount) otherwise leaks the descriptor for the life of the process,
        // and this loop can run many times before `LOCK_TIMEOUT_MS`. The
        // stray temp file is reclaimed by `reclaimStaleTemps`, but nothing
        // reclaims a descriptor.
        const fd = openSync(tmp, 'w');
        try {
          fs.writeSync(fd, JSON.stringify(payload));
        } finally {
          closeSync(fd);
        }
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
          // be holding it" lie this fallback exists to prevent.
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
        attempt = retryOrThrow(err, spec, deadline, attempt);
        continue;
      }
    }

    try {
      const fd = openSync(file, 'wx');
      // Same two corrections as the `linkSync` path's temp write above, and
      // the second one matters more here because the file being written IS
      // the lock: a `writeSync` that throws used to leak the descriptor AND
      // leave a zero-byte lock file behind. That empty lock is not
      // recoverable the way a stray temp file is — `judgeStale` cannot parse
      // it, so it falls through to the `LOCK_STALE_MS` mtime backstop and
      // wedges every acquirer, including this process's own retry, for five
      // minutes over a purely local write failure. Removing it before the
      // error propagates is the same asymmetry fix `createExclusive`
      // (core/rebuild.ts) carries for its own `openSync('wx')` fallback; the
      // removal is best-effort, so the guarantee is "not left behind by
      // construction", not "cannot be left behind at all".
      let written = false;
      try {
        fs.writeSync(fd, JSON.stringify(payload));
        written = true;
      } finally {
        try {
          closeSync(fd);
        } finally {
          if (!written) {
            try { rmSync(file, { force: true }); } catch { /* best-effort cleanup */ }
          }
        }
      }
      return releaseFnFor(file, payload.nonce);
    } catch (err) {
      attempt = retryOrThrow(err, spec, deadline, attempt);
    }
  }
}
