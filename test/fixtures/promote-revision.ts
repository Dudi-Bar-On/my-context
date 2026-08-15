/**
 * Promotes one revision in a real, separate OS process.
 *
 * A single-process test cannot establish anything about `promoteRevision`'s
 * exclusion: the whole hazard is that two processes each load the workspace,
 * then race for the lock, so both hold a view of the item taken BEFORE either
 * wrote. That is only reproducible with two processes.
 *
 * Deliberately opens an in-memory store and rebuilds from the Markdown files,
 * exactly as the CLI does — and, critically, does so BEFORE contending for the
 * lock, which is what makes the loser's view of the item stale and puts
 * `refreshFromDisk` (src/core/revision.ts) under test.
 *
 * Usage: node promote-revision.ts <cwd> <itemId> <revisionId> <startAtMs>
 * Prints one line of JSON: { ok: true, message } or { ok: false, message }.
 */
import { rebuild } from '../../src/core/rebuild.ts';
import { promoteRevision } from '../../src/core/revision.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';

const [cwd, itemId, revisionId, startAt] = process.argv.slice(2);

const ws = resolveWorkspace(cwd);
const store = Store.open(':memory:');
rebuild(store, { project: ws.projectRoot! }, ws.config);
const ctx = { root: ws.projectRoot!, store, config: ws.config };

// Both racers load above, then converge on the same wall-clock instant, so the
// contention is real rather than incidental to process startup order.
const target = Number(startAt);
while (Date.now() < target) { /* spin — the overlap is the point */ }

try {
  const result = promoteRevision(ctx, itemId, { revisionId });
  process.stdout.write(`${JSON.stringify({ ok: true, message: result.message })}\n`);
} catch (err) {
  process.stdout.write(
    `${JSON.stringify({ ok: false, message: err instanceof Error ? err.message : String(err) })}\n`,
  );
} finally {
  store.close();
}
