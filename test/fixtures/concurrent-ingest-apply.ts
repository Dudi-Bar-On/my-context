/**
 * Argv: <cwd> <sessionId> <anchor> <label> <title> <body> <startAt>
 *
 * Writes its own candidate file (`c-<label>.json`, so two racing processes
 * never step on each other's payload) with a candidate whose TITLE matches
 * the other racer's (same `ingestKey`, so both attempt to revise the same
 * predecessor) but whose BODY differs (so `candidateHash` differs and
 * neither dedupes against the other) — this is the exact concurrent
 * `applyCandidates` hazard `src/cli/commands/ingest.ts`'s `acquireAnchorLock`
 * exists to serialize, per that function's doc comment.
 *
 * `startAt` is a wall-clock barrier, the same technique
 * `test/fixtures/concurrent-opener.ts` uses: spawning two children is not
 * simultaneous, so without a barrier they would not reliably overlap inside
 * the few-millisecond race window this exercises.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';

const [cwd, sessionId, anchor, label, title, body, startAtRaw] = process.argv.slice(2);

const wait = Number(startAtRaw) - Date.now();
if (wait > 0) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, wait);

const fileName = `c-${label}.json`;
writeFileSync(path.join(cwd, fileName), JSON.stringify([{
  type: 'requirement',
  title,
  body,
  quote: 'Passwords must be at least 12 characters.',
}]), 'utf8');

let out = '';
const code = runCli(
  ['ingest-apply', sessionId, '--anchor', anchor, '--file', fileName],
  cwd,
  (s) => { out += s + '\n'; },
);
process.stdout.write(out);
process.exitCode = code;
