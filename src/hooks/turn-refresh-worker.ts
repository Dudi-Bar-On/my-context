/**
 * ── THE END-OF-TURN REFRESH, RUN BEFORE THE END OF THE TURN ─────────────────
 *
 * Spawned DETACHED by `PostToolUse` when `refreshSoonCheck` says the
 * transcript has grown enough, long enough ago, to be worth reading. The hook
 * that spawns it does not wait for it and cannot fail because of it.
 *
 * **It calls `stopConversationRefresh` and nothing else, and that is the whole
 * design.** The owner asked for this twice, and the second time widened it:
 * *"you should flush in general not only because of a mark was added"*. So
 * this is not an anchor path — it is the SAME function `src/hooks/stop.ts`
 * calls, doing the same three things in the same order (the transcript scan,
 * the mirror, then the anchors, which must come last because the pass reads
 * the index and the index is only level once the scan has run).
 *
 * A second copy of that sequence here would be a second place for its ORDER to
 * be got wrong, and the order is load-bearing: run the pass first and it marks
 * against a table the next line replaces from disk.
 *
 * ── WHY IT IS A PROCESS AND NOT A PROMISE ──────────────────────────────────
 *
 * A hook is a process that must exit. Work left pending in it either keeps the
 * process alive — which is exactly the delay this exists to remove — or is
 * killed when the process exits, which is worse than not starting it. A
 * detached child is the only shape that lets the hook return in microseconds
 * and the refresh still finish.
 *
 * ── WHAT IT DOES WITH A FAILURE, WHICH IS NOTHING ──────────────────────────
 *
 * Nothing is reported back and a throw is swallowed, for `startServer`'s
 * reason one feature along: there is no one to tell. The hook that spawned
 * this exited long ago, and `Stop` will run the same refresh at the end of the
 * turn regardless — so a failure here costs latency and never correctness.
 * That is what makes it safe to be silent, and it is a different case from a
 * swallow inside an ANSWER: this process returns no answer to anybody.
 * `stopConversationRefresh` already swallows its own failures and answers
 * `null`; this is belt beside braces.
 */

import { isMainEntry } from '../core/paths.ts';
import { stopConversationRefresh } from './stop.ts';

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // argv: [node, thisFile, cwd, sessionId]. Positional rather than a JSON
  // payload on stdin, because the spawner has no stdin to give it — `stdio:
  // 'ignore'` is what lets the parent exit without waiting on a pipe.
  const cwd = process.argv[2];
  const sessionId = process.argv[3];
  try {
    if (cwd !== undefined && cwd !== '') {
      stopConversationRefresh({
        cwd,
        ...(sessionId !== undefined && sessionId !== '' ? { session_id: sessionId } : {}),
      });
    }
  } catch {
    // See the header: there is nobody to tell, and `Stop` is the backstop.
  }
  process.exitCode = 0;
}
