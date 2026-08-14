/**
 * Argv: <cwd> <holdMs>
 *
 * Sibling of `test/fixtures/hold-apply-lock.ts`, with one difference: before
 * calling `acquireApplyLock`, this process monkeypatches `node:fs`'s
 * `linkSync` to always throw `EPERM` — simulating a filesystem with no
 * hard-link support (exFAT/FAT32 removable media, some SMB/NFS mounts, some
 * container volume drivers), which is exactly what CI (NTFS on
 * `windows-latest`, ext4 on `ubuntu-latest`) cannot exercise for real. This
 * is what `src/cli/commands/ingest.ts`'s "I-1" fix (`hardLinksSupported` in
 * src/ingest/lock.ts) exists to survive: without it, this fixture would burn
 * the full 15s `LOCK_TIMEOUT_MS` and then throw a message blaming a process
 * that does not exist, instead of acquiring the lock at all.
 *
 * Same two-line stdout protocol as `hold-apply-lock.ts` — see that fixture's
 * doc comment for why `ACQUIRED` is a separate, awaited signal rather than
 * something the parent test infers from timing.
 */
import fs from 'node:fs';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { acquireApplyLock } from '../../src/ingest/lock.ts';

fs.linkSync = () => {
  const err = new Error('EPERM: operation not permitted, link') as NodeJS.ErrnoException;
  err.code = 'EPERM';
  throw err;
};

const [cwd, holdMsRaw] = process.argv.slice(2);
const holdMs = Number(holdMsRaw);

const ws = resolveWorkspace(cwd);
const root = ws.projectRoot as string;

const startedAt = Date.now();
const release = acquireApplyLock(root);
const gotAt = Date.now();
process.stdout.write('ACQUIRED\n');
Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, holdMs);
release();
const releasedAt = Date.now();

process.stdout.write(JSON.stringify({ gotAt, releasedAt, acquireMs: gotAt - startedAt }) + '\n');
