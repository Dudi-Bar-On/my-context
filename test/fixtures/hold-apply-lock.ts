/**
 * Argv: <cwd> <holdMs>
 *
 * Acquires the workspace's ingest-apply lock (`acquireApplyLock`,
 * src/ingest/lock.ts), holds it for `holdMs`, releases it, and
 * prints two lines to stdout:
 *
 *   1. `ACQUIRED` — the instant this process holds the lock, so the parent
 *      test can wait for this exact line before spawning a second racer,
 *      making acquisition ORDER deterministic instead of hoping two
 *      near-simultaneous spawns race the OS's `open(..., 'wx')` a
 *      particular way. A test that instead spawns both racers together and
 *      sorts by OBSERVED acquisition time only exercises real contention
 *      on whichever run happens to overlap — measured at roughly a 50%
 *      hit rate for `test/cli/ingest-lock.test.ts`'s exclusion test before
 *      this signal was added, which is not a reliable pin.
 *   2. `{ gotAt, releasedAt, acquireMs }` (epoch ms), the final line, once
 *      released.
 *
 * `acquireMs` is the time spent INSIDE `acquireApplyLock`, and it is the only
 * number a parent test should put a bound on. The obvious alternative —
 * `gotAt` minus the moment the parent called `spawn` — also counts this
 * process's startup: Node booting plus type-stripping the whole module graph
 * `resolveWorkspace`/`acquireApplyLock` pull in. Measured on an otherwise idle
 * machine with one background suite running, that was 82–146ms with no
 * contention at all, against the 300ms budget
 * `test/cli/ingest-lock.test.ts`'s two-workspace test used to apply to it —
 * which is why that test failed spuriously under full-suite load and passed
 * 15/15 in isolation. `acquireMs` is 0–1ms uncontended regardless of load.
 * Same reason `force-linksync-failure.ts` already reports it.
 */
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { acquireApplyLock } from '../../src/ingest/lock.ts';

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
