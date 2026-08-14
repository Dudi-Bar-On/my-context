/**
 * Argv: <root> <holdMs>
 *
 * The same contract as `hold-apply-lock.ts` — print `ACQUIRED` the instant the
 * lock is held, then `{ gotAt, releasedAt }` once released — but it takes the
 * `.my_context` ROOT directly instead of resolving a workspace from a cwd, so
 * a test can exercise `src/ingest/lock.ts` against a bare temp directory
 * without standing up a whole initialized project.
 */
import { acquireApplyLock } from '../../src/ingest/lock.ts';

const [root, holdMsRaw] = process.argv.slice(2);
const holdMs = Number(holdMsRaw);

const release = acquireApplyLock(root);
const gotAt = Date.now();
process.stdout.write('ACQUIRED\n');
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
release();
const releasedAt = Date.now();

process.stdout.write(JSON.stringify({ gotAt, releasedAt }) + '\n');
