import {
  closeSync, mkdirSync, openSync, readFileSync, rmSync, statSync, writeSync,
} from 'node:fs';
import path from 'node:path';
import { sleepMs } from '../../core/sleep.ts';
import { relPosix, toPosix } from '../../core/paths.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { buildExtractionRequest, nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import {
  ingestDir, listSessions, loadSession, openIngestSession, pendingAnchors, saveSession,
} from '../../ingest/session.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, readPayload, toCliMessage } from './context.ts';
import { flag, hasFlag, positionals, registerCommand, type Emit } from './registry.ts';

/** The repo root is the parent of `.my_context`. Source paths are relative to it. */
function repoRoot(ws: Workspace): string {
  return path.dirname(ws.projectRoot as string);
}

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

// --- The ingest-apply lock --------------------------------------------------
//
// `applyCandidates` (src/ingest/apply.ts) documents, but does not itself
// guard against, a real hazard proven with two live processes on one
// workspace, ZERO artificial delay: two `ingest-apply` calls whose candidates
// share a title can both read `ctx.store.all()` before either has written,
// both compute the SAME id from `makeId`/`nextCollisionId`/`nextRevisionId`
// (src/ingest/apply.ts) for candidates with DIFFERENT bodies, and both call
// `createItem` with that id — one process's write silently overwrites the
// other's, or the second process's own `createItem` throws "already exists
// with different content" and its whole apply is lost (its OTHER, unrelated
// candidates included, since `saveSession` never runs on the throw path,
// leaving the anchor pending and due to re-extract on resume).
//
// The critical section that must be serialized is `openMutateContext` (which
// reads `ctx.store.all()` internally, inside `applyCandidates`) through
// `saveSession` — read, decide, write, record. What's serialized on MATTERS:
// the ids this hazard collides on come from `takenIds = new Set(everything
// .map(i => i.id))` in apply.ts, built from `ctx.store.all()` — i.e. EVERY
// item in the WORKSPACE, not just this session or this anchor. A lock keyed
// on `(sessionId, anchor)` was tried first and found insufficient: two
// DIFFERENT anchors of the same session, or two DIFFERENT sessions entirely,
// whose candidates happen to share a title, still race on the exact same
// `takenIds` set and can still collide — a per-anchor key does not cover the
// scope of the thing it is meant to protect. The lock is therefore
// per-WORKSPACE: one file, `<root>/.ingest/apply.lock`, held for the whole
// duration of any `ingest-apply` call in this workspace, regardless of which
// session or anchor it targets. This does mean two unrelated `ingest-apply`
// calls on two unrelated documents wait on each other; that is the accepted
// cost of matching the actual shared-state boundary rather than a narrower,
// unsound one.
//
// A plain lock FILE in the session directory (`.ingest/`, via `ingestDir`) is
// sufficient and matches how the rest of this codebase handles cross-process
// state (e.g. `writeHeader`/`persist` use a temp-file-then-rename, not an
// in-memory mutex, because state must be visible to OTHER PROCESSES, not just
// other code in this one). The lock is acquired with `open(..., 'wx')` — an
// exclusive create that fails with EEXIST if the file already exists — which
// is atomic on both POSIX and Windows, unlike a check-then-create pair of
// separate syscalls.
const LOCK_RETRY_MS = 25;
const LOCK_MAX_RETRY_MS = 250;
const LOCK_TIMEOUT_MS = 15_000;

// How old (by the lock file's own mtime) or how conclusively dead (by its
// recorded pid) a lock must be before a NEW acquirer is allowed to break it.
// Set well above any realistic single `ingest-apply` call: this is a
// crash-recovery backstop, not a normal-path timing knob — a legitimate
// holder finishes in well under a second even for a large chunk.
const LOCK_STALE_MS = 5 * 60_000;

// `openSync(file, 'wx')` creates the lock file EMPTY; the pid payload lands
// on the following, separate `writeSync` call — the two are not atomic. A
// concurrent acquirer's `EEXIST` can land exactly inside that window and see
// an empty (or, for the same reason, truncated) file. Treating an unparseable
// payload as stale UNCONDITIONALLY (an earlier version of this function did)
// steals the live holder's lock while it is still mid-write: measured
// directly, planting an empty `apply.lock` made a concurrent acquirer steal
// it in 0ms, and a real double-hold was observed once in 300 cross-process
// acquisitions under that bug. The fix is this short grace period: an
// unparseable payload is trusted to still be mid-write until it has been
// sitting there for longer than any real `openSync`+`writeSync`+`closeSync`
// could plausibly take — comfortably generous for local disk and network
// filesystems alike, while staying far short of `LOCK_STALE_MS` so a
// permanently-corrupt lock (the writer crashed between create and write) is
// still reclaimed quickly rather than waiting the full crash-recovery window.
const LOCK_WRITE_GRACE_MS = 500;

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
 * An UNPARSEABLE payload (empty, truncated, corrupt) is deliberately NOT
 * immediate grounds for staleness — see `LOCK_WRITE_GRACE_MS` above for why.
 */
function isStaleLock(file: string): boolean {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(file).mtimeMs;
  } catch {
    return false; // vanished between our EEXIST and this stat — its owner just released it
  }
  const ageMs = Date.now() - mtimeMs;

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
    // Empty or corrupt: trust it only past the short write-race grace period
    // — see LOCK_WRITE_GRACE_MS. A payload that never becomes parseable
    // (the writer crashed between create and write) still falls through to
    // the mtime backstop below once that grace elapses.
    return ageMs > LOCK_WRITE_GRACE_MS;
  }

  return ageMs > LOCK_STALE_MS;
}

/**
 * Errors worth retrying against, rather than rethrowing immediately.
 * `EEXIST` is the expected "someone else holds it" case from `open(path,
 * 'wx')`. `EPERM` is included because Windows — this project's primary
 * platform — returns `EPERM`, not `EEXIST` or `EBUSY`, for `open(path, 'wx')`
 * against a file that is delete-pending (another process has unlinked it but
 * the OS has not yet actually removed the directory entry, a real window
 * around every `release()`/reclaim `rmSync` in this module). Measured
 * directly: under a synthetic hammer of rapid concurrent acquire/release
 * cycles, 5 of 8 racers died with a raw `EPERM` thrown straight out of
 * `acquireApplyLock` before this was added — a hard exit 1 for a caller that
 * did nothing wrong, on the one platform this matters most on.
 */
export function isRetryableLockError(code: string | undefined): boolean {
  return code === 'EEXIST' || code === 'EPERM';
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
 * Exported for `test/fixtures/hold-apply-lock.ts`, which pins the exclusion
 * property directly (a second acquirer really does block until the first
 * releases) independent of any content-loss race — see that fixture and
 * `test/cli/ingest-lock.test.ts`.
 */
export function acquireApplyLock(root: string): () => void {
  mkdirSync(ingestDir(root), { recursive: true });
  const file = applyLockPath(root);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;
  let attempt = 0;

  for (;;) {
    try {
      const fd = openSync(file, 'wx');
      writeSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() } satisfies LockPayload));
      closeSync(fd);
      return () => { try { rmSync(file, { force: true }); } catch { /* best-effort cleanup */ } };
    } catch (err) {
      if (!isRetryableLockError((err as NodeJS.ErrnoException)?.code)) throw err;
      if (isStaleLock(file)) {
        try { rmSync(file, { force: true }); } catch { /* someone else reclaimed it first; fine */ }
        continue; // retry the create immediately — no reason to wait out a stale lock
      }
      if (Date.now() >= deadline) {
        throw new Error(
          `my_context: could not acquire the ingest-apply lock (${file}) after ${LOCK_TIMEOUT_MS}ms. ` +
          `Another process may be applying candidates in this workspace — try again shortly.`,
        );
      }
      attempt++;
      sleepMs(Math.min(LOCK_RETRY_MS * attempt, LOCK_MAX_RETRY_MS));
    }
  }
}

function cmdIngest(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [target] = positionals(args, ['anchor']);
  if (!target) {
    out('usage: mycontext ingest <path> [--anchor <anchor>]');
    return 1;
  }

  const repo = repoRoot(ws);
  const absolute = path.resolve(repo, toPosix(target));
  let stat;
  try {
    stat = statSync(absolute);
  } catch (err) {
    // ENOENT — genuinely absent — gets the friendly, expected message.
    // Anything else (EACCES, ELOOP from a symlink cycle, ...) is a REAL
    // problem this process could not even inspect, and "no such file" would
    // be actively misleading — it implies "create it and retry", which does
    // not fix a permissions or symlink problem.
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      out(`my_context: no such file "${toPosix(target)}" (looked in ${repo}).`);
    } else {
      out(toCliMessage(err));
    }
    return 1;
  }
  if (!stat.isFile()) {
    out(`my_context: "${toPosix(target)}" is not a file (looked in ${repo}).`);
    return 1;
  }

  // `CommandFn`'s contract (registry.ts) is "never throws" — everything past
  // the file check above (session bookkeeping, a bad file encoding, a
  // permissions error on the write side) is caught here rather than left to
  // propagate, so a command bug never surfaces as a raw stack trace.
  try {
    const rel = relPosix(repo, absolute);
    const session = openIngestSession(ws.projectRoot as string, rel, readFileSync(absolute, 'utf8'));
    saveSession(ws.projectRoot as string, session);

    const anchor = flag(args, 'anchor');
    if (anchor) {
      const chunk = session.chunks.find((c) => c.anchor === anchor);
      if (!chunk) {
        out(
          `my_context: session ${session.id} has no chunk "${anchor}". ` +
          `Known anchors: ${session.chunks.map((c) => c.anchor).join(', ')}.`,
        );
        return 1;
      }
      out(renderExtractionRequest(buildExtractionRequest(session, chunk, ws.config)));
      return 0;
    }

    const request = nextRequest(session, ws.config);
    if (!request) {
      out(
        `my_context: session ${session.id} for ${rel} has every chunk applied ` +
        `(${session.chunks.length}/${session.chunks.length}). ` +
        `Review what it produced with \`mycontext review\`.`,
      );
      return 0;
    }

    out(renderExtractionRequest(request));
    return 0;
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }
}

function cmdIngestApply(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [id] = positionals(args, ['anchor', 'file']);
  const anchor = flag(args, 'anchor');
  const usage = 'usage: mycontext ingest-apply <session-id> --anchor <anchor> (--file <path> | --stdin)';
  if (!id || !anchor) {
    out(usage);
    return 1;
  }
  // `readPayload` (context.ts) reads fd 0 whenever `--file` is absent — with
  // NEITHER flag given, that blocks forever on an interactive terminal
  // instead of ever reaching a usage message. Required explicitly here,
  // rather than left implicit in readPayload, so a plain `mycontext
  // ingest-apply <id> --anchor <a>` fails fast with usage instead of hanging.
  if (!flag(args, 'file') && !hasFlag(args, 'stdin')) {
    out(usage);
    return 1;
  }

  const root = ws.projectRoot as string;
  let payload: unknown;
  let session;
  try {
    session = loadSession(root, id);
    payload = readPayload(args, cwd);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // Serialize the whole workspace — see the module-level comment above
  // `acquireApplyLock` for why per-anchor is not enough and the hazard this
  // closes.
  let release: () => void;
  try {
    release = acquireApplyLock(root);
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  }

  // `CommandFn`'s contract (registry.ts) is "never throws" — this outer
  // try/catch makes that true here too, rather than relying on `runCli`'s
  // top-level catch to convert an escaped exception (e.g. `openMutateContext`
  // throwing before `errors` even exists) into a message.
  try {
    const { ctx, errors } = openMutateContext(ws);
    try {
      const result = applyCandidates(ctx, session, anchor, payload);
      // Immediately after applyCandidates, not batched — see applyCandidates'
      // own doc comment (src/ingest/apply.ts). Not merely for crash
      // durability: without this, a reworded re-extraction of an unchanged
      // document (the normal case for a non-deterministic LLM) takes the
      // supersede branch on a LATER call and mints a spurious revision that
      // retires a still-current draft, because the caller had no on-disk
      // record yet that this exact chunk had already been applied.
      saveSession(root, session);

      out(
        `my_context: ${anchor} — created ${result.created.length}, ` +
        `deduped ${result.deduped.length}, superseded ${result.superseded.length}.`,
      );
      for (const created of result.created) out(`  created     ${created}`);
      for (const deduped of result.deduped) out(`  unchanged   ${deduped}`);
      for (const pair of result.superseded) out(`  superseded  ${pair.previous} -> ${pair.next}`);

      if (result.issues.length) {
        out('');
        const noun = result.issues.length === 1 ? 'candidate' : 'candidates';
        out(`${result.issues.length} ${noun} rejected — every valid sibling above was still written:`);
        for (const issue of result.issues) {
          out(`  [${issue.index}] ${issue.title ?? '(untitled)'}: ${issue.message}`);
        }
      }

      const remaining = pendingAnchors(session);
      out('');
      if (remaining.length === 0) {
        out(
          `my_context: every chunk of ${session.sourceFile} is applied. ` +
          `Promote what you want with \`mycontext review\`.`,
        );
      } else {
        const request = nextRequest(session, ws.config);
        if (request) out(renderExtractionRequest(request));
      }
      // F2 (see the comment in cmdAdd, src/cli/index.ts): ingest-apply did
      // what it was asked — it applied the candidates it could and reported
      // exactly what happened to the rest — so an UNRELATED load error
      // elsewhere in the corpus is a warning, not a failure. Only `status`
      // and `doctor` exit non-zero on one; every command in this plan that
      // did its job, including this one, exits 0.
      emitLoadErrors(errors, out);
      return 0;
    } catch (err) {
      out(toCliMessage(err));
      return 1;
    } finally {
      ctx.store.close();
    }
  } catch (err) {
    out(toCliMessage(err));
    return 1;
  } finally {
    release();
  }
}

function cmdIngestStatus(ws: Workspace, args: string[], out: Emit): number {
  if (!requireWorkspace(ws, out)) return 1;
  void args;

  const sessions = listSessions(ws.projectRoot as string);
  if (sessions.length === 0) {
    out('my_context: no ingest sessions. Start one with `mycontext ingest <path>`.');
    return 0;
  }

  for (const session of sessions) {
    const done = session.chunks.length - pendingAnchors(session).length;
    out(`${session.id.padEnd(40)}${session.sourceFile.padEnd(40)}${done}/${session.chunks.length}`);
  }
  return 0;
}

registerCommand({
  name: 'ingest',
  usage: 'ingest <path>',
  summary: 'emit an extraction request for a document (you are the extractor)',
  run: cmdIngest,
});

registerCommand({
  name: 'ingest-apply',
  usage: 'ingest-apply <id> --anchor <a>',
  summary: 'apply extracted candidates as drafts',
  run: cmdIngestApply,
});

registerCommand({
  name: 'ingest-status',
  usage: 'ingest-status',
  summary: 'list ingest sessions and their progress',
  run: cmdIngestStatus,
});
