/**
 * Argv: <cwd> <cycles>
 *
 * Rapidly acquires and releases the workspace's ingest-apply lock `cycles`
 * times with no hold in between — a tight create/delete cycle on the same
 * path, which is exactly the shape that produces a delete-pending `EPERM`
 * from `open(path, 'wx')` on Windows (this project's primary platform):
 * one process's `rmSync` in `release()` and another's `openSync(..., 'wx')`
 * landing on the same path in close succession. Run several of these
 * concurrently (see `test/cli/ingest-lock.test.ts`) to hammer that window.
 *
 * Exits 0 if every cycle completed; exits 1 with the error on stderr
 * otherwise — `isRetryableLockError` (src/ingest/lock.ts) existing
 * to swallow `EPERM` alongside `EEXIST` is what should keep this at 0.
 */
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { acquireApplyLock } from '../../src/ingest/lock.ts';

const [cwd, cyclesRaw] = process.argv.slice(2);
const cycles = Number(cyclesRaw);

const ws = resolveWorkspace(cwd);
const root = ws.projectRoot as string;

try {
  for (let i = 0; i < cycles; i++) {
    const release = acquireApplyLock(root);
    release();
  }
  process.exitCode = 0;
} catch (err) {
  process.stderr.write(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
}
