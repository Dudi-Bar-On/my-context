/**
 * Argv: <cwd> <sessionId> <anchor> <label> <title> <body> <quote> <startAt>
 *
 * Writes its own candidate file (`c-<label>.json`, so two racing processes
 * never step on each other's payload) with a candidate whose TITLE matches
 * the other racer's (so both mint an id from the same `makeId` base) but
 * whose BODY differs (so `candidateHash` differs and neither dedupes against
 * the other) — the collision `acquireApplyLock`
 * (src/ingest/lock.ts) exists to serialize. `anchor`/`quote` are
 * independent per racer so this fixture can reproduce a CROSS-anchor
 * collision (two different anchors, same session, same title) as well as a
 * same-anchor one — a per-anchor lock closes only the latter; the workspace
 * lock closes both.
 *
 * `startAt` is a wall-clock barrier, the same technique
 * `test/fixtures/concurrent-opener.ts` uses: spawning two children is not
 * simultaneous, so without a barrier they would not reliably overlap inside
 * the few-millisecond race window this exercises.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

const [cwd, sessionId, anchor, label, title, body, quote, startAtRaw] = process.argv.slice(2);

const wait = Number(startAtRaw) - Date.now();
if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);

const fileName = `c-${label}.json`;
writeFileSync(path.join(cwd, fileName), JSON.stringify([{
  type: 'requirement',
  title,
  body,
  quote,
}]), 'utf8');

let out = '';
const code = runCli(
  ['ingest-apply', sessionId, '--anchor', anchor, '--file', fileName],
  cwd,
  (s) => { out += s + '\n'; },
);
process.stdout.write(out);
process.exitCode = code;
