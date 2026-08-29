import { recordAudit } from '../core/audit.ts';
import {
  checkHandoverAsk, discloseIgnoredAsk, handoverConfigAt,
} from '../core/handover-ask.ts';
import { isMainEntry } from '../core/paths.ts';
import { clearWindowState } from '../core/window-state.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

/**
 * The one firing that carries the id of the context window `/clear` destroyed.
 *
 * **Why this hook exists at all.** `/clear` MINTS a new `session_id`. The order
 * is `SessionEnd` with `reason: "clear"` on the OLD id, then `SessionStart`
 * with `source: "clear"` on a NEW one — measured on build 2.1.239 and quoted in
 * `reports/probes/2026-08-20-clear-and-prompt-hooks.md`. So the `/clear` branch
 * in `core/inject.ts` never receives the old key: it clears state for an id
 * that was created microseconds earlier and owns nothing. The destroyed
 * window's seen files and restore snapshot were not cleared, they were
 * ORPHANED, and they sat until the 30-day sweep in `pruneSnapshots`. This is
 * the only event that can reach them.
 *
 * **THE BUDGET IS 1,500 ms, and a plugin cannot raise it.** Read off the same
 * build. The shutdown path awaits the SessionEnd batch under
 * `AbortSignal.timeout(getSessionEndHookTimeoutMs())`, and that resolver takes
 * the largest `timeout` declared by a SessionEnd entry in *settings* hooks or
 * main-thread agent hooks — never the plugin registry that this manifest lands
 * in — then floors the result at a 1,500 ms constant. So the `"timeout"` in
 * `hooks/hooks.json` does NOT extend the window a plugin gets; the abort at
 * 1.5 s is the real ceiling, and everything below runs inside it including a
 * cold `node` start. That is why this file imports `core/window-state.ts` and
 * not `core/inject.ts`: the injection import graph costs roughly 150 ms of
 * type-stripping on this machine (`test/perf/subagent-start-latency.perf.ts` ·
 * `roughly` · ~38) and buys this hook nothing, since it injects nothing.
 *
 * The declared `"timeout": 2` is therefore a ceiling that bites on exactly one
 * path — a user who ALSO registers a `SessionEnd` hook in their own
 * `settings.json` with a larger timeout raises the abort for every SessionEnd
 * hook including this one — and on that path it stops my_context from being
 * the reason their shutdown waits. On the ordinary path the platform's 1.5 s
 * is the bound and this number never takes effect. It is declared rather than
 * omitted because an omitted `timeout` means 600 s (`Q_`), which would be a
 * far larger untruth than a ceiling that is usually redundant.
 *
 * **NOTHING A SUCCESSFUL SessionEnd HOOK WRITES IS EVER SHOWN.** The platform
 * copies a SessionEnd hook's output to stderr only on the failure branch —
 * `if(!l.succeeded&&l.output)process.stderr.write(...)` — and
 * `INV-hooks-fail-open` requires this process to exit 0. So stderr is not a
 * disclosure channel here the way it is for every other hook in this
 * directory, and the audit log is not a convenience: it is the ONLY place this
 * hook can say what it did. That is what the `session-end` op is for.
 */

/**
 * The `reason` values build 2.1.239's payload schema accepts, in its order.
 *
 * Read out of the shipped executable at
 * `C:/Users/UserC/.local/share/claude/versions/2.1.239`, by
 * `grep -a -b -o 'hook_event_name:kt("SessionEnd")'` and dumping the bytes
 * before it:
 *
 *     G3b=["clear","resume","logout","prompt_input_exit","other"],
 *     V3b=ve(()=>Or(G3b)),
 *     q3b=ve(()=>YH().and(_e({hook_event_name:kt("SessionEnd"),reason:V3b()})))
 *
 * Byte-identical in `2.1.237` and `2.1.238`, so this is not a list that
 * appeared yesterday. It is a validation schema and therefore the values the
 * platform ACCEPTS; `clear` and `other` are additionally measured on the wire
 * by the probe named above.
 *
 * Exported so `test/hooks/session-end-matcher.test.ts` can hold the manifest
 * and this file's branches against it — the same discipline
 * `session-start-matcher.test.ts` applies to `source`, and for the same reason:
 * a `reason` nobody named does not fail, it silently does not run.
 */
export const SESSION_END_REASONS = [
  'clear', 'resume', 'logout', 'prompt_input_exit', 'other',
] as const;

export type SessionEndReason = (typeof SESSION_END_REASONS)[number];

/**
 * What this hook did, in one word plus one sentence. The sentence is never
 * empty, including for `retained`.
 *
 *  - `cleared`   — the destroyed window's state was removed. Recorded.
 *  - `retained`  — the session is ending but its id survives and can be
 *                  resumed, so its state was deliberately left. Not recorded:
 *                  nothing was dropped, and a row on every process exit would
 *                  be the log's largest and least informative population.
 *  - `unknown`   — a `reason` this build's enum does not contain. Recorded,
 *                  loudly: a new member may well be another window-destroying
 *                  one, and this is the only channel that can say so.
 *  - `skipped`   — no payload, no `session_id`, or no workspace. Nothing to
 *                  act on and nowhere to write.
 */
export type SessionEndAction = 'cleared' | 'retained' | 'unknown' | 'skipped';

export interface SessionEndOutcome {
  action: SessionEndAction;
  note: string;
}

/**
 * The sentence for each `reason` this hook declines to act on, and the reason
 * it declines. Every one of them is a session whose `session_id` OUTLIVES the
 * event: the transcript stays on disk and `claude --resume <id>` reuses that
 * exact id, so its seen file is the dedupe state of a window that is coming
 * back. Clearing it would cost that resumed window a full re-delivery, and —
 * worse — would take the PreCompact restore snapshot with it, so a compaction
 * after the resume would restore nothing.
 *
 * `resume` is the subtle one and it is the same answer: the platform fires it
 * on the session being LEFT when the user switches to another one from inside
 * a live session (`/resume`, `/branch`), and that left session is precisely
 * the one a user comes back to.
 */
const RETAIN_REASONS: Record<string, string> = {
  resume: 'this session is being left for another one, not destroyed — its id and transcript ' +
    'survive and a later resume reuses both, so its delivery state and restore snapshot were ' +
    'kept',
  logout: 'the process is exiting after a sign-out; the transcript and the session id survive ' +
    'it, so its delivery state and restore snapshot were kept',
  prompt_input_exit: 'the user exited from the prompt; the transcript and the session id ' +
    'survive it, so its delivery state and restore snapshot were kept',
  other: 'the process is exiting; the transcript and the session id survive it, so its ' +
    'delivery state and restore snapshot were kept',
};

/**
 * Runs one `SessionEnd`. Never throws — `INV-hooks-fail-open`, and a knowledge
 * base that breaks a shutdown is worse than one that says nothing.
 *
 * **The clear is gated on a real `session_id` and on nothing else.** There is
 * no subagent to exclude here the way `core/inject.ts` excludes one: no
 * `SessionEnd` fires for a subagent (`gb(agentContext)` guards the shutdown
 * path), and the payload carries no `agent_id`. What it is gated on instead is
 * the reason, because four of the five are sessions that are coming back.
 *
 * **`findProjectRoot`, not `resolveWorkspace`.** The latter throws on a
 * `config.json` that is not valid JSON, and a workspace whose config is broken
 * is still a workspace whose destroyed window should be cleared — the same
 * choice `session-start.ts` makes for its sweep and `subagent-start.ts` makes
 * for its attempt record, and for the same reason.
 */
export function buildSessionEndOutcome(input: HookInput, fallbackCwd: string): SessionEndOutcome {
  try {
    const reason = typeof input.reason === 'string' ? input.reason : '';
    // An empty payload is an interactive run with no stdin, not a platform
    // that stopped sending `reason` — `readStdin` documents '' as that answer.
    // Saying anything about it would make every such run noisy about nothing.
    if (Object.keys(input as Record<string, unknown>).length === 0) {
      return { action: 'skipped', note: 'no payload arrived, so there was nothing to act on' };
    }

    const sessionId = input.session_id;
    if (!sessionId) {
      return {
        action: 'skipped',
        note: 'the payload carried no session_id, so no window could be named',
      };
    }

    const root = findProjectRoot(input.cwd ?? fallbackCwd);
    if (!root) {
      return { action: 'skipped', note: 'no my_context workspace was found for this directory' };
    }

    if (reason === 'clear') {
      // ── THE OTHER BOUNDARY THAT DESTROYS A WINDOW ────────────────────────
      //
      // Plan `handover` seq:9, and the reason it is HERE and not only on
      // `PreCompact`: a `/clear` destroys a context window exactly as a
      // compaction does, so an ask that went unanswered before one is a stale
      // handover about to become the only record of a session that is gone.
      // `DEC-the-ask-and-the-writing-are-two-turns-apart-so-a-flag-is` names
      // both boundaries and rules `PostCompact` out of it — that hook can only
      // report, and this one can still say something while it matters.
      //
      // Read BEFORE `clearWindowState`, deliberately. That function does not
      // touch the latch or the handover today, so the order is not load-
      // bearing yet; it is written this way so it never becomes a question the
      // day the sweep grows.
      //
      // `handoverConfigAt` and not `resolveWorkspace`: this hook reaches for
      // `findProjectRoot` precisely so a broken `config.json` cannot stop it
      // clearing a destroyed window, and that helper keeps the same promise —
      // an unparseable config turns the handover check off and changes nothing
      // else. The whole added cost is one small JSON read, one latch read and
      // one `stat`, well inside the platform's 1,500 ms abort.
      const ask = checkHandoverAsk(root, handoverConfigAt(root), sessionId);
      // The two verdicts that describe a mechanism nobody engaged add no
      // clause, for `pre-compact.ts`'s reason: `off` is every unconfigured
      // workspace and `not-asked` is every ordinary session, and a clause on
      // all of them is boilerplate in the one channel this hook has.
      const askNote = ask.verdict === 'off' || ask.verdict === 'not-asked'
        ? ''
        : `; handover ask ${ask.verdict} — ${ask.note}`;

      // The whole point of the hook. `clearWindowState` never throws and its
      // sentence distinguishes "cleared nothing" from "cleared" from "would
      // not go", so the record below is the truth rather than the intention.
      const note = clearWindowState(root, sessionId);
      recordAudit(root, {
        kind: 'hook',
        op: 'session-end',
        sessionId,
        hook: 'SessionEnd',
        // The FIELD is written for all five verdicts even where the note says
        // nothing: *how often is the handover we ask for actually written* is a
        // count, and a count needs the rows that answer "never asked" too.
        handoverAsk: ask.verdict,
        note: `reason=clear; ${note}${askNote}`,
      });
      // **The audit row above is the real channel, and this line is written
      // anyway.** The platform copies a SessionEnd hook's output to stderr only
      // on the FAILURE branch and this process exits 0, so nothing here is
      // shown today — the file header says so. It is written for the reason the
      // parse-error line below is: it costs nothing, it is the same disclosure
      // `PreCompact` makes at the other boundary, and one mechanism should not
      // have two spellings of its one important sentence depending on which
      // hook noticed. The day this channel is surfaced, it is already there.
      const disclosure = discloseIgnoredAsk(root, sessionId, ask, '/clear');
      if (disclosure !== '') process.stderr.write(disclosure);
      return { action: 'cleared', note: `${note}${askNote}` };
    }

    const retained = RETAIN_REASONS[reason];
    if (retained !== undefined) return { action: 'retained', note: retained };

    // A `reason` this build's enum does not contain. It is NOT treated as a
    // clear — guessing at an unknown member is how a hook deletes state for a
    // window that is coming back — and it is not swallowed either, because the
    // member that gets added next may well be another window-destroying one and
    // this record is the only thing that would ever say so.
    // `INV-nothing-is-dropped-silently`, on the only channel this event has.
    const note =
      `reason=${reason === '' ? '<absent>' : reason} is not one of ` +
      `${SESSION_END_REASONS.join(', ')}; no window state was cleared and none was ` +
      'deliberately kept — this build of my_context does not know what this reason means';
    recordAudit(root, {
      kind: 'hook', op: 'session-end', sessionId, hook: 'SessionEnd', note,
    });
    return { action: 'unknown', note };
  } catch {
    // INV-hooks-fail-open.
    return { action: 'skipped', note: 'the handler failed open' };
  }
}

if (isMainEntry(import.meta.filename, process.argv[1])) {
  // No runtime safety timer, for `pre-compact.ts`'s reason: everything below
  // is synchronous, so an unref'd timer set before it could only ever fire
  // after the work it was meant to preempt already returned. The bound is the
  // platform's 1.5 s abort, described at the top of this file.
  try {
    const { input, parseError } = parseHookInput(readStdin());
    // Written even though the platform discards a successful hook's stderr:
    // the line costs nothing, it is the shared one every hook writes, and the
    // day Claude Code starts surfacing this channel it will be there. What
    // makes the loss survivable is that the same fact reaches the audit log —
    // an unreadable payload names no `session_id`, so the outcome is `skipped`
    // and there is nothing to record, which is itself the honest answer.
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    buildSessionEndOutcome(input, process.cwd());
  } catch {
    /* fail open */
  }
  // Nothing on stdout, ever. `SessionEnd` has no `hookSpecificOutput` variant
  // in the platform's own output schema — there is no `additionalContext` for
  // it to carry — so a byte written here would be a byte nobody reads.
  process.exitCode = 0;
}
