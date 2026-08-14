/**
 * Argv: <cwd> <holdMs>
 *
 * Acquires the workspace's ingest-apply lock (`acquireApplyLock`,
 * src/cli/commands/ingest.ts), holds it for `holdMs`, releases it, and
 * prints `{ gotAt, releasedAt }` (epoch ms) as its only stdout line — for
 * `test/cli/ingest-lock.test.ts`'s direct pin of the lock's EXCLUSION
 * property: a second process racing this one must not be able to report
 * `gotAt` earlier than this process's own `releasedAt`.
 */
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { acquireApplyLock } from '../../src/cli/commands/ingest.ts';

const [cwd, holdMsRaw] = process.argv.slice(2);
const holdMs = Number(holdMsRaw);

const ws = resolveWorkspace(cwd);
const root = ws.projectRoot as string;

const release = acquireApplyLock(root);
const gotAt = Date.now();
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
release();
const releasedAt = Date.now();

process.stdout.write(JSON.stringify({ gotAt, releasedAt }));
