import { isMainEntry } from '../core/paths.ts';
import { capped, runObservationHook, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * A tool call was refused — and most often this project is what refused it.
 *
 * `hooks/pre-tool-use.ts` denies writes into `.my_context/items/`, into
 * `state/focus.json` and into the generated state beside them, and every one of
 * those denials already writes its own `deny` row. What it could not write is
 * what happened NEXT. `PreToolUse`'s deny is a decision; `PermissionDenied` is
 * the platform confirming it took effect, on the same `tool_use_id`, and its
 * output schema carries a `retry` flag (build 2.1.239, byte 303352919:
 * `_e({hookEventName:kt("PermissionDenied"),retry:Ut().optional()})`) which
 * means a denial is a place a hook could change the outcome of.
 *
 * **This hook does not set `retry`, and that is the stopping point.** Retrying
 * a denied call — or steering the model to a different one — is my_context
 * acting on a session's control flow rather than on its knowledge, and nothing
 * has ruled that it should. The row is written; the flag is left absent.
 *
 * ── WHAT IS AND IS NOT PUT IN THE ROW ──────────────────────────────────────
 *
 * `tool_input` is on the payload and is never recorded, in any form. It is the
 * ARGUMENTS of the refused call — a `Write`'s whole file body among them — and
 * the audit log records scope. `tool_name` is scope and is recorded.
 *
 * `reason` is recorded only when it is OURS. Every denial this project issues
 * starts `my_context: `
 * (`hooks/pre-tool-use.ts` · `return 'my_context: \`.my_context/items/\` is managed by my_context. Writing the file ' +` · ~89),
 * so that prefix is a reliable test, and our own sentences are ours to repeat.
 * A denial from anywhere else — the user answering no, a permission rule, a
 * sandbox — carries a message written by something else about something else,
 * and may quote the very `tool_input` that is excluded one line above. Those
 * are recorded as `source=other` with no text at all.
 *
 * **No matcher.** The matcher on this event is tested against `tool_name`
 * (build 2.1.239, byte 317139714), and the interesting denials are precisely
 * the ones on the tools `hooks.json` already denies — `Write`, `Edit`,
 * `MultiEdit`, `NotebookEdit` — plus every tool the user's own rules refuse,
 * which this project cannot enumerate. So it names none and records all.
 */

/** Every denial my_context issues opens with this; nothing else's does. */
const OWN_PREFIX = 'my_context: ';

export function observePermissionDenied(input: HookInput): Observation | null {
  const tool = typeof input.tool_name === 'string' && input.tool_name !== ''
    ? input.tool_name : '<absent>';
  const reason = typeof input.reason === 'string' ? input.reason : '';
  const own = reason.startsWith(OWN_PREFIX);

  return {
    note:
      `tool=${capped(tool, 48)}; ` +
      (own
        ? `source=${capped(reason, 180)}`
        : 'source=other — the denial did not come from my_context, and its reason is not ' +
          'recorded because it is text written elsewhere about a tool_input this log excludes'),
  };
}

export const PERMISSION_DENIED: ObservationSpec = {
  hook: 'PermissionDenied',
  op: 'permission-denied',
  observe: observePermissionDenied,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(PERMISSION_DENIED);
