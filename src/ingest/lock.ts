import path from 'node:path';
import { acquireLock } from '../core/lock.ts';
import { ensureIngestDir } from './session.ts';

export { isRetryableLockError } from '../core/lock.ts';

// --- The ingest-apply lock --------------------------------------------------
//
// The lock ITSELF — construction, staleness, ownership, the retry budget and
// every guarantee established for it — lives in `src/core/lock.ts`. This file
// is the one place that says WHICH file the ingest-apply critical section is
// serialized on, and what to tell a human who is waiting on it.
//
// `applyCandidates` (src/ingest/apply.ts) documents, but does not itself guard
// against, a real hazard proven with two live processes on one workspace, ZERO
// artificial delay: two concurrent applies whose candidates share a title can
// both read `ctx.store.all()` before either has written, both compute the SAME
// id from `makeId`/`nextCollisionId`/`nextRevisionId` (src/ingest/apply.ts) for
// candidates with DIFFERENT bodies, and both call `createItem` with that id —
// one process's write silently overwrites the other's, or the second process's
// own `createItem` throws "already exists with different content" and its whole
// apply is lost (its OTHER, unrelated candidates included, since `saveSession`
// never runs on the throw path, leaving the anchor pending and due to
// re-extract on resume).
//
// The critical section that must be serialized is "open the mutation context
// (which reads `ctx.store.all()` internally, inside `applyCandidates`) through
// `saveSession`" — read, decide, write, record. What's serialized on MATTERS:
// the ids this hazard collides on come from `takenIds = new
// Set(everything.map(i => i.id))` in apply.ts, built from `ctx.store.all()` —
// i.e. EVERY item in the WORKSPACE, not just this session or this anchor. A
// lock keyed on `(sessionId, anchor)` was tried first and found insufficient:
// two DIFFERENT anchors of the same session, or two DIFFERENT sessions
// entirely, whose candidates happen to share a title, still race on the exact
// same `takenIds` set and can still collide — a per-anchor key does not cover
// the scope of the thing it is meant to protect. The lock is therefore
// per-WORKSPACE: one file, `<root>/.ingest/apply.lock`, held for the whole
// duration of any apply call in this workspace, regardless of which session or
// anchor it targets. This does mean two unrelated apply calls on two unrelated
// documents wait on each other; that is the accepted cost of matching the
// actual shared-state boundary rather than a narrower, unsound one.
//
// Both entry points that reach the critical section — the CLI's `ingest-apply`
// command (src/cli/commands/ingest.ts) and the MCP `ingest_document` tool's
// second phase (src/mcp/tools/ingest.ts) — import `acquireApplyLock` from here
// rather than each carrying its own copy. This codebase has four recorded cases
// of a concurrency hazard being fixed at one call site and reappearing at
// another because the fix was not reachable from both.
const LOCK_BASENAME = 'apply.lock';

/**
 * Blocks until this process holds the workspace's ingest-apply lock, then
 * returns a function that releases it. See `acquireLock` (core/lock.ts) for
 * the construction, the staleness rules and their residuals.
 */
export function acquireApplyLock(root: string): () => void {
  // `ensureIngestDir` (session.ts), not a bare `mkdirSync`: that directory
  // holds nothing but working state — lock files, session headers, applied
  // and rejection logs. Every generated WORKING-STATE directory in this
  // project ships a `*` .gitignore inside it (`writeSnapshot`'s ledger
  // directory, src/core/ledger.ts; `ensureIngestDir` itself), and
  // `mycontext init` writes a narrower `.index.db` .gitignore into
  // `.my_context/`, which is committed knowledge rather than working state.
  // A workspace whose first ingest command was an APPLY reached this
  // directory through this function's own `mkdirSync` instead of through
  // `saveSession`, so it got no .gitignore at all and offered `apply.lock`
  // — and every session file written later — to git.
  const dir = ensureIngestDir(root);
  return acquireLock({
    file: path.join(dir, LOCK_BASENAME),
    name: 'ingest-apply',
    otherHolder: 'another process is applying candidates in this workspace',
  });
}
