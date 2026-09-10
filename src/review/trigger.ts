/**
 * **When to look at a session** — `plan:loop seq:2`, design §2 and §5.
 *
 * This is the decision itself, in one place, called by `Stop` and by
 * `PreCompact`. It lives here rather than inside `hooks/stop.ts` because two
 * hooks make the identical decision, and design §2 is explicit that they must:
 * *"`PreCompact` fires it too — the moment context is about to be lost is when
 * capture is worth most."* A copy in each hook is two things to keep in step,
 * and the kill switch is exactly the thing that must not have two of.
 *
 * ── WHERE THE RUBRIC ACTUALLY RUNS, AND WHY THE PLAN IS WRONG ABOUT IT ─────
 *
 * §2 and this phase's plan both put the rubric in the trigger: the counter says
 * *consider*, the rubric *decides*, and then the child is spawned. **Measured,
 * that cannot be done at `Stop`.** The rubric reasons over the points in a
 * stretch, points come from the reader, and the reader's walk over the owner's
 * own transcript costs **1,297 ms for 86.7 MB (36,268 records), 2026-09-10**.
 * `Stop` already spends ~470 ms on the conversation-index refresh inside a
 * 3-second platform budget, with a person watching a prompt.
 *
 * The alternative — running the rubric over a cheap tail read — is worse than
 * the cost, because it is a decision made on a SAMPLE, which is the one thing
 * this phase exists to refuse.
 *
 * **So the rubric moved into the child, and it loses nothing the research
 * measured.** arXiv:2606.23525's saving is 30-70% of TOKEN cost; tokens are
 * spent by the model call, and the rubric still runs before any model call
 * (phase 3's, since this build makes none). What the trigger keeps is the part
 * that is free: the switch, the ration, the interval, and one `stat`.
 *
 * The consequence is stated rather than hidden: **`maxFiresPerSession` bounds
 * how many times the pass LOOKS, not how many times it finds something.** A
 * session in which the rubric declines three times has spent its ration on
 * three reports that each say why. That is visible — `rubric.because` is in
 * every report — and it is the tuning signal for whoever sets the interval.
 *
 * ── THE GATES, IN COST ORDER, AND WHAT EACH ONE IS FOR ─────────────────────
 *
 *  1. **Not inside a lane.** A fan-out of ten lanes finishing at once is ten
 *     `Stop`-shaped firings reaching for one counter inside one second.
 *     `agent_id` is the only discriminator on the payload.
 *  2. **A workspace**, and **a config that parses**. A user who mistyped a
 *     comma has turned this feature off, not broken their session.
 *  3. **`review.enabled`** — §11's one switch. Off returns `null`: no verdict,
 *     no row, no state, no child. Upstream's issue #82708 was a switch that
 *     did not kill because a second path created anyway; there is one path
 *     here and this is the only place it is gated.
 *  4. **The ration.** `fires >= maxFiresPerSession` and nothing else happens.
 *  5. **The interval**, except on `PreCompact` with `onPreCompact` set, where
 *     context is about to be lost and the interval is beside the point.
 *  6. **Something new to read.** One `stat` against the last report's
 *     `readTo`. A stretch with no new bytes in it cannot contain anything,
 *     and this is the one piece of the rubric's job that is free.
 *
 * ── WHY NOT `SessionEnd`, MEASURED RATHER THAN ARGUED ──────────────────────
 *
 * §2 says `SessionEnd` fires on exit or `/clear` and not on compaction, and
 * that the session which produced the design survived five compactions without
 * firing one. Counted in this project's own audit log on 2026-09-10 — 36,084
 * rows across fifteen days and three sessions — there is **not one
 * `session-end` row**, against **1,094 `stop`**, **17 `pre-compact`** and
 * **54 `session-start`**. A trigger on that hook would have fired zero times
 * in the life of this project.
 */
import { snapshotBytes } from '../core/session-summary.ts';
import { readCounter, resetCounter } from '../core/review-counter.ts';
import { subagentDir } from '../core/conversation-index.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { workspaceConfigAt } from '../core/handover-ask.ts';
import { lastReadTo, spawnPass, type SpawnOutcome } from './pass.ts';
import type { spawn } from 'node:child_process';

/** The fields of a hook payload this decision reads. */
export interface TriggerInput {
  cwd?: string;
  session_id?: string;
  agent_id?: string;
  transcript_path?: string;
}

/** What the trigger decided, and why. `null` from `reviewTrigger` means OFF. */
export interface TriggerVerdict {
  fire: boolean;
  /**
   * One sentence. **Present on refusals too**, which is the half that matters:
   * this is the only place a quiet loop can be told apart from a broken one,
   * and it travels into the audit row the hook was already writing.
   */
  because: string;
  calls: number;
  fires: number;
  /** `false` on every refusal, and on a spawn that could not start. */
  spawned: boolean;
  /** Present only when a spawn was attempted and failed. */
  why?: string;
}

/** The hooks that may fire the pass. Both make the same decision. */
export type TriggerHook = 'Stop' | 'PreCompact';

function verdict(fire: boolean, because: string, calls: number, fires: number): TriggerVerdict {
  return { fire, because, calls, fires, spawned: false };
}

/**
 * Decide, and — only if the answer is yes — spawn a detached child and return.
 *
 * **Never awaited by any caller, and it cannot be: it is synchronous and the
 * child is unref'ed before it returns.** That is the shape that makes the
 * assertion in `test/review/trigger.test.ts` meaningful rather than a timing
 * coincidence.
 *
 * `spawnFn` and `now` are injected for tests; production passes neither.
 *
 * **Never throws** (`INV-hooks-fail-open`). A trigger that threw would break
 * the hook it rides, which is the highest-value hook in the product for
 * everything else it does.
 */
export function reviewTrigger(
  input: TriggerInput,
  hook: TriggerHook,
  spawnFn?: typeof spawn,
  env: Record<string, string | undefined> = process.env,
): TriggerVerdict | null {
  try {
    // 1. A lane is not a session. Ten lanes finishing at once must not become
    //    ten passes over the parent's transcript.
    if (typeof input.agent_id === 'string' && input.agent_id !== '') return null;

    const cwd = input.cwd !== undefined && input.cwd !== '' ? input.cwd : process.cwd();
    // 2. A workspace, and a config that parses.
    const root = findProjectRoot(cwd);
    if (root === null) return null;
    const config = workspaceConfigAt(root);
    if (config === null) return null;

    // 3. THE SWITCH. Off is off: no verdict, no row, no state, no child.
    const review = config.review;
    if (!review.enabled) return null;

    const counter = readCounter(root);

    // 4. The ration.
    if (counter.fires >= review.maxFiresPerSession) {
      return verdict(
        false,
        `the session's ration of ${review.maxFiresPerSession} pass(es) is spent`,
        counter.calls, counter.fires,
      );
    }

    // 5. The interval — waived on PreCompact, where context is about to go.
    const compacting = hook === 'PreCompact' && review.onPreCompact;
    if (!compacting && counter.calls < review.everyNToolCalls) {
      return verdict(
        false,
        `${counter.calls} of ${review.everyNToolCalls} tool call(s) since the last pass`,
        counter.calls, counter.fires,
      );
    }

    const transcript = input.transcript_path;
    if (transcript === undefined || transcript === '') {
      return verdict(
        false,
        'the hook payload carried no transcript_path, so there is nothing to read',
        counter.calls, counter.fires,
      );
    }

    // 6. Something new. One `stat` against the last report's offset, and it is
    //    the whole of the rubric's job that can be done for free.
    const bytes = snapshotBytes(transcript);
    const since = lastReadTo(root);
    if (bytes <= since) {
      return verdict(
        false,
        bytes === 0
          ? 'the transcript could not be measured on disk, so there is nothing to read'
          : `no new bytes since the last pass stopped at ${since}`,
        counter.calls, counter.fires,
      );
    }

    // The ration is spent HERE, before the spawn, and `review-counter.ts`
    // argues why: a spawn that failed has still spent its fire, or a machine
    // that cannot spawn retries on every threshold crossing for the rest of
    // the session.
    const spent = resetCounter(root, input.session_id);

    const lanes = input.session_id === undefined || input.session_id === ''
      ? null
      : subagentDir(env, cwd, input.session_id);

    const outcome: SpawnOutcome = spawnPass({
      workspace: root,
      transcript,
      sessionId: input.session_id ?? null,
      subagentDir: lanes,
      includeSubagents: review.includeSubagents,
      // §11's ration, read HERE and passed down rather than re-read by the
      // child: the parent has the resolved config, and a second reader is a
      // second answer. It ships at 0, so a workspace that turns `enabled` on
      // and changes nothing else still writes nothing — see `DEFAULT_REVIEW`.
      maxProposals: review.maxProposalsPerPass,
      // §10's ceiling, read from the same resolved config and passed down the
      // same way. The pass counts the queue itself when it has something to
      // admit — this is only the number it counts against.
      queueCeiling: review.queueCeiling,
      // A pass proposes only when it has a ration to spend. `dryRun` and a
      // zero ration say the same thing from two directions and both are
      // honoured, so neither can be the one that was forgotten.
      dryRun: review.maxProposalsPerPass <= 0,
    }, spawnFn);

    return {
      fire: true,
      because:
        `${counter.calls} tool call(s) since the last pass, ${bytes - since} new byte(s) to ` +
        `read${compacting ? ', and context is about to be compacted' : ''}`,
      calls: counter.calls,
      fires: spent.fires,
      spawned: outcome.spawned,
      ...(outcome.why === undefined ? {} : { why: outcome.why }),
    };
  } catch {
    // INV-hooks-fail-open.
    return null;
  }
}

/**
 * The clause the hook adds to the audit row it was already writing, or `''`.
 *
 * `''` for `null` — the subsystem is off, and a row per turn saying so on
 * every workspace in the world would be the noise this log has already had
 * 5,207 rows of once.
 *
 * **A refusal DOES get a clause**, and that asymmetry is the point: once the
 * loop is on, every turn it declines to look is a turn somebody may need to
 * explain, and the audit log is the only durable place this decision can be
 * read back from. `state/review-counter.json` holds a count and no reasons.
 */
export function reviewNote(decision: TriggerVerdict | null): string {
  if (decision === null) return '';
  if (!decision.fire) return `review: no pass — ${decision.because}`;
  if (!decision.spawned) {
    return `review: a pass was due (${decision.because}) but the child could not be started` +
      `${decision.why === undefined ? '' : ` — ${decision.why}`}`;
  }
  return `review: pass ${decision.fires} of the session started — ${decision.because}`;
}
