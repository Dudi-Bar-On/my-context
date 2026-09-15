/**
 * Argv: `<dir> <file> <tag> <count> <barrier>`
 *
 * Appends `<count>` complete records to one JSONL log through the real
 * `appendJsonlLine`, starting only once `<barrier>` exists — so N of these
 * enter the critical section together rather than in the order they were
 * spawned. Every record carries `tag` and its index, so the parent can count
 * exactly which ones survived rather than only how many.
 *
 * A record that could not be appended is reported on stderr with its index and
 * the process keeps going: the parent asserts on the file, and a racer that
 * silently stopped early would make a truncation look like a smaller one than
 * it was.
 */
import { existsSync } from 'node:fs';
import { appendJsonlLine } from '../../src/core/jsonl-log.ts';

const [dir, file, tag, countArg, barrier] = process.argv.slice(2);
const count = Number(countArg);

// A spin, not a sleep: the point is that every racer leaves the gate in the
// same millisecond, and a `setTimeout` would hand them out in spawn order.
while (!existsSync(barrier!)) { /* wait for the gate */ }

for (let i = 0; i < count; i++) {
  try {
    appendJsonlLine(dir!, file!, { tag, i });
  } catch (err) {
    process.stderr.write(`${tag}: record ${i} refused: ${err instanceof Error ? err.message : String(err)}\n`);
  }
}
