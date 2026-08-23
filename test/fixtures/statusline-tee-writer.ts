/**
 * Argv: <root> <sessionId> <receivedAt>
 *
 * Tees one payload through the real writer, in a process of its own, so
 * `test/core/statusline-tee.test.ts` can put several writers on the SAME
 * sample file in the same instant — the race the tee's temp-then-rename is
 * built for, and the one that used to strand a temp file when a rename lost.
 *
 * Prints the `writeTee` result as JSON on stdout and always exits 0. Losing
 * the rename is the case under test, not a failure of the child: the parent
 * counts the losers and decides what the outcome should have been. A child
 * that exits non-zero here would mean the writer THREW, which it never may —
 * every refusal comes back as `{ written: false, reason }`.
 */
import { writeTee } from '../../src/core/statusline-tee.ts';

const [root, sessionId, receivedAt] = process.argv.slice(2);

try {
  const result = writeTee(root, { session_id: sessionId, marker: receivedAt }, receivedAt);
  process.stdout.write(JSON.stringify(result));
} catch (err) {
  process.stderr.write(`writeTee THREW: ${err instanceof Error ? err.stack : String(err)}\n`);
  process.exitCode = 1;
}
