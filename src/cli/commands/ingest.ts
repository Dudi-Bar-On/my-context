import { closeSync, existsSync, mkdirSync, openSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { sleepMs } from '../../core/sleep.ts';
import { relPosix, toPosix } from '../../core/paths.ts';
import { applyCandidates } from '../../ingest/apply.ts';
import { buildExtractionRequest, nextRequest, renderExtractionRequest } from '../../ingest/request.ts';
import {
  ingestDir, listSessions, loadSession, openIngestSession, pendingAnchors, saveSession,
} from '../../ingest/session.ts';
import type { Workspace } from '../../core/workspace.ts';
import { emitLoadErrors, openMutateContext, readPayload } from './context.ts';
import { flag, positionals, registerCommand, type Emit } from './registry.ts';

/** The repo root is the parent of `.my_context`. Source paths are relative to it. */
function repoRoot(ws: Workspace): string {
  return path.dirname(ws.projectRoot as string);
}

function requireWorkspace(ws: Workspace, out: Emit): boolean {
  if (ws.projectRoot) return true;
  out('my_context: no workspace here. Run `mycontext init` to create one.');
  return false;
}

// --- Per-anchor lock -------------------------------------------------------
//
// `applyCandidates` (src/ingest/apply.ts) documents, but does not itself
// guard against, a real hazard proven with two live processes on one
// workspace: two callers applying the SAME anchor of the SAME session
// concurrently can both read `ctx.store.all()` before either has written,
// both compute the same next revision id (`nextRevisionId` in apply.ts) for
// candidates with DIFFERENT bodies, and both call `createItem` with that
// explicit id. Because neither write's read preceded the other's write,
// `createItem`'s explicit-id handling never sees a conflict to refuse —
// whichever `persist()` call lands second silently overwrites the first
// process's file and index row, and BOTH processes report success. The
// applied log then carries two conflicting records for the same id, and only
// one of them matches what is actually on disk.
//
// `applyCandidates` cannot fix this itself — it has no notion of "another
// caller is mid-flight" — so the caller (this module) must serialize access
// per anchor. A plain lock FILE in the session directory (`.ingest/`, via
// `ingestDir`) is sufficient and matches how the rest of this codebase
// handles cross-process state (e.g. `writeHeader`/`persist` use a
// temp-file-then-rename, not an in-memory mutex, because state must be
// visible to OTHER PROCESSES, not just other code in this one). The lock is
// acquired with `open(..., 'wx')` — an exclusive create that fails with
// EEXIST if the file already exists — which is atomic on both POSIX and
// Windows, unlike a check-then-create pair of separate syscalls.
const LOCK_RETRY_MS = 25;
const LOCK_TIMEOUT_MS = 15_000;

function anchorLockPath(root: string, sessionId: string, anchor: string): string {
  return path.join(ingestDir(root), `${sessionId}.${anchor}.lock`);
}

/**
 * Blocks (via a bounded, backing-off poll — `sleepMs` blocks the thread
 * without a dependency, see core/sleep.ts) until this process holds the lock
 * for `sessionId`'s `anchor`, then returns a function that releases it.
 * Throws a `my_context:`-prefixed message if the lock is still held by
 * someone else after `LOCK_TIMEOUT_MS` — better than hanging forever behind a
 * crashed holder that never released.
 */
function acquireAnchorLock(root: string, sessionId: string, anchor: string): () => void {
  mkdirSync(ingestDir(root), { recursive: true });
  const file = anchorLockPath(root, sessionId, anchor);
  const deadline = Date.now() + LOCK_TIMEOUT_MS;

  for (;;) {
    try {
      const fd = openSync(file, 'wx');
      closeSync(fd);
      return () => { try { rmSync(file, { force: true }); } catch { /* best-effort cleanup */ } };
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== 'EEXIST') throw err;
      if (Date.now() >= deadline) {
        throw new Error(
          `my_context: could not acquire the ingest lock for session ${sessionId} § ${anchor} ` +
          `(${file}) after ${LOCK_TIMEOUT_MS}ms. Another process may be applying the same chunk — ` +
          `try again shortly. If no other process is running, the lock file is stale (left behind ` +
          `by a crash) and can be removed by hand.`,
        );
      }
      sleepMs(LOCK_RETRY_MS);
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
  if (!existsSync(absolute)) {
    out(`my_context: no such file "${toPosix(target)}" (looked in ${repo}).`);
    return 1;
  }

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
}

function cmdIngestApply(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  if (!requireWorkspace(ws, out)) return 1;

  const [id] = positionals(args, ['anchor', 'file']);
  const anchor = flag(args, 'anchor');
  if (!id || !anchor) {
    out('usage: mycontext ingest-apply <session-id> --anchor <anchor> (--file <path> | --stdin)');
    return 1;
  }

  const root = ws.projectRoot as string;
  let payload: unknown;
  let session;
  try {
    session = loadSession(root, id);
    payload = readPayload(args, cwd);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // Serialize per anchor — see the module-level comment above
  // `acquireAnchorLock` for the two-process hazard this closes.
  let release: () => void;
  try {
    release = acquireAnchorLock(root, id, anchor);
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

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
        out(`${result.issues.length} candidate rejected — every valid sibling above was still written:`);
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
        emitLoadErrors(errors, out);
        return errors.length ? 1 : 0;
      }

      const request = nextRequest(session, ws.config);
      if (request) out(renderExtractionRequest(request));
      // A corrupt item file means the dedupe above ran against an incomplete
      // corpus, so this is reported and the command fails — never dropped.
      emitLoadErrors(errors, out);
      return errors.length ? 1 : 0;
    } catch (err) {
      out(err instanceof Error ? err.message : String(err));
      return 1;
    } finally {
      ctx.store.close();
    }
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
