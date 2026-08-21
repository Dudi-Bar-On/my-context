/**
 * Argv: <root> <sessionId> <name>
 *
 * Writes one session name through the real store, in a process of its own, so
 * `test/core/session-names.test.ts` can put several read-modify-write cycles
 * on the same file at the same time. A refusal is a failure here: the names
 * the test passes are all valid, so a `written: false` means the store lost
 * the race rather than judged the name.
 */
import { setSessionName } from '../../src/core/session-names.ts';

const [root, sessionId, name] = process.argv.slice(2);

const result = setSessionName(root, sessionId, name);
if (!result.written) {
  process.stderr.write(`${sessionId}: ${result.error ?? 'refused with no reason'}\n`);
  process.exitCode = 1;
}
