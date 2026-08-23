import { isMainEntry } from '../core/paths.ts';
import { capped, runObservationHook, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The end of the dispatch `SubagentStart` opened.
 *
 * `hooks/subagent-start.ts` writes two rows per dispatch on purpose: an
 * `injection` row saying `delivery=attempted agent=<id>` BEFORE the selection,
 * and the completion row `buildInjection` writes after it, so that a hook
 * killed at its `hooks.json` timeout leaves an attempt with no completion and
 * the kill becomes evidence rather than silence. What that pair could never say
 * is whether the SUBAGENT then finished. A dispatch that started, received its
 * knowledge, and was killed or abandoned looks in the log exactly like one that
 * ran to the end. This row is the difference, and all three carry the PARENT's
 * `session_id`, so `mycontext audit --session <parent>` already shows them
 * together.
 *
 * **`agent_id` is the gate, for `subagent-start.ts`'s reason turned around.**
 * There it is the gate because injecting under a bare `session_id` would write
 * the parent's dedupe state. Here nothing is written but a row, and a row that
 * cannot name the agent cannot be paired with the two that opened the dispatch
 * — which is the only thing it is for. So a payload with no `agent_id` records
 * nothing.
 *
 * ── WHAT IT DOES NOT DO, AND THIS ONE IS A REAL COST ───────────────────────
 *
 * **It does not clear the subagent's delivery state.** Every dispatch writes a
 * seen file keyed `<session_id>::<agent_id>` (`hooks/io.ts` · `ledgerKey`), a
 * subagent's `agent_id` is minted per dispatch, and those files are only ever
 * removed by `SessionEnd(reason: clear)` on the parent — through
 * `clearWindowState`, which takes the siblings with it — or by the 30-day
 * sweep. A long parent session that dispatches many subagents therefore
 * accumulates one file per dispatch until it ends. This event is where that
 * would be fixed, and it is not fixed here: pruning is a change to the dedupe
 * state, which `hooks/post-compact.ts` already declined to make for the same
 * reason and left to the owner. The event is registered and the id is in the
 * log, so the size of the problem can now be read rather than argued about.
 *
 * **It fills no `additionalContext`.** The event has one (build 2.1.239, byte
 * 303352663) and the platform describes it as feedback delivered to the model.
 * A subagent that has stopped has no more turns; the parent does, and speaking
 * into the parent's context because a subagent ended is a product decision
 * nobody has made.
 *
 * **No matcher.** The matcher on this event is tested against `agent_type`
 * (build 2.1.239, byte 317139714), which is an open set — every agent type a
 * user or plugin defines — so any matcher at all would silently skip the types
 * it did not enumerate. `SubagentStart` is registered the same way, and the
 * clear probe measured both silent on a prompt that dispatched nothing, which
 * is a measured silence rather than an assumed one
 * (`reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3c).
 */
export function observeSubagentStop(input: HookInput): Observation | null {
  const agentId = input.agent_id;
  if (typeof agentId !== 'string' || agentId === '') return null;

  const type = typeof input.agent_type === 'string' && input.agent_type !== ''
    ? input.agent_type : '<absent>';

  return {
    note:
      `delivery=finished agent=${capped(agentId, 64)} type=${capped(type, 48)}; ` +
      'its seen file was left in place',
  };
}

export const SUBAGENT_STOP: ObservationSpec = {
  hook: 'SubagentStop',
  op: 'subagent-stop',
  observe: observeSubagentStop,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(SUBAGENT_STOP);
