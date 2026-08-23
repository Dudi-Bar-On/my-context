import { isMainEntry } from '../core/paths.ts';
import { runObservationHook, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The end of an assistant turn — the only boundary in the audit log that is not
 * a tool call, a mutation or a session edge.
 *
 * Everything else in the log happens at a moment nobody chose: a `PreToolUse`
 * row lands because a model reached for a file, a `jit` row lands because that
 * file matched a scope. Reading a session back, there is nothing that says
 * *here is where one exchange ended and the next began*. `Stop` is that line,
 * and it is why this is the one observation hook whose row is written on the
 * ordinary path rather than only when something notable happened.
 *
 * **The cost is stated rather than assumed: one row per turn, and one process
 * spawn per turn.** Turns are two orders of magnitude rarer than tool calls —
 * this project's own log held 957 records across weeks of use — so the volume
 * is small, but it is not nothing and it is the highest-frequency of the ten.
 * `test/perf/observation-latency.perf.ts` records what the spawn costs.
 *
 * ── THE CAPTURE NUDGE, AND WHY IT IS STILL WHERE IT WAS ────────────────────
 *
 * `hooks seq:21` observes that the capture nudge is *"arguably"* better here
 * than on `PostToolUse`, and the argument is a good one: `PostToolUse` fires
 * per edit, so a model that edits a watched document five times in one turn is
 * asked five times to capture what it decided, and it is asked in the middle of
 * work rather than at the end of it. `Stop`'s `additionalContext` exists
 * exactly for this — the platform's own description reads *"non-error feedback
 * delivered to the model; the conversation continues so the model can act on
 * it"* (build 2.1.239, byte 303352370).
 *
 * **It is not moved, and "arguably" is the reason.** Moving it changes what
 * this product asks a model to do and when, on every turn of every session,
 * and it changes it in a direction nothing has measured: a nudge at the end of
 * a turn arrives when the model has already written its answer, which may be
 * exactly too late to be acted on, or exactly right. That is a product ruling
 * and `hooks seq:21` did not make one — it named the argument. So this hook
 * writes nothing to stdout, `hooks/post-tool-use.ts` is untouched, and the
 * question is reported to the owner with the measurement attached rather than
 * answered by a commit.
 *
 * **No matcher, and none is possible.** `Stop` is absent from the matcher-query
 * switch entirely (build 2.1.239, byte 317139714 — it falls to `default:break`,
 * leaving the query `undefined`), and `let d=(a?s.filter(…):s)` runs every
 * entry when the query is undefined. So a matcher on this event would be
 * ignored, not honoured: dead configuration that reads as a filter.
 *
 * **The timeout is the one that genuinely bites.** The platform waits for this
 * hook before ending the turn, which is a user staring at a prompt, so
 * `hooks.json` declares the tightest timeout of the ten.
 */
export function observeStop(input: HookInput): Observation | null {
  // `stop_hook_active` is the platform's re-entrancy guard: true when this turn
  // is continuing BECAUSE a stop hook asked it to. Nothing here ever asks, so a
  // `true` in this project's log means some OTHER hook did — which is worth
  // being able to see, and is the only thing on this payload that varies.
  const active = input.stop_hook_active === true;
  return {
    note:
      `stop_hook_active=${active ? 'true' : 'false'}; the assistant turn ended` +
      (active ? ', continuing because another stop hook asked it to' : ''),
  };
}

export const STOP: ObservationSpec = {
  hook: 'Stop',
  op: 'stop',
  observe: observeStop,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(STOP);
