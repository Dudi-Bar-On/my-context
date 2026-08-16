import { readFileSync } from 'node:fs';

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  /** SessionStart only: startup | clear | resume | compact. */
  source?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  /**
   * Present on a PreToolUse payload exactly when the tool call was made by a
   * subagent (Task tool), absent for the main conversation's own tool calls.
   * Measured, not assumed: a probe hook under a real `claude -p` run whose
   * prompt dispatched a subagent logged `session_id` IDENTICAL to the
   * parent's on the subagent's Write, with `agent_id`/`agent_type` as the
   * only distinguishing fields — and no SessionStart fired for the subagent
   * at all. `CLAUDE_CODE_SESSION_ID` in the environment is inherited verbatim
   * by subagents, so this payload field is the only subagent discriminator
   * the hooks have.
   */
  agent_id?: string;
  /** The subagent's type (e.g. `general-purpose`); same presence rule as `agent_id`. */
  agent_type?: string;
}

/**
 * The key the JIT ledger dedupes on. A subagent shares the parent's
 * `session_id` (see `HookInput.agent_id`), but it starts with an EMPTY
 * context window: nothing the parent was injected with exists for it. Keying
 * the ledger on the bare `session_id` therefore suppressed, for a subagent,
 * every item the parent had already received — the subagent got nothing while
 * the ledger claimed delivery — and, in the other direction, recorded a
 * subagent's deliveries as if the parent had seen them, silently dropping the
 * parent's own first injection on that path and polluting the PreCompact
 * snapshot with items the parent's context never contained.
 *
 * Appending `agent_id` when present gives every subagent its own dedupe
 * scope, which is exactly what "once per session" was always standing in
 * for: once per context window. The parent's key is unchanged (no
 * `agent_id`, no suffix), so existing rows and the PreCompact/restore path —
 * both keyed on the bare `session_id`, both parent-only events by
 * measurement — are untouched.
 */
export function ledgerKey(input: HookInput): string | null {
  if (!input.session_id) return null;
  return input.agent_id ? `${input.session_id}::${input.agent_id}` : input.session_id;
}

/** Reads fd 0 to EOF. Returns '' when there is no stdin (interactive runs). */
export function readStdin(): string {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export function parseHookInput(raw: string): HookInput {
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
    return value as HookInput;
  } catch {
    return {};
  }
}

export function preToolUseContext(text: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: 'PreToolUse', additionalContext: text },
  });
}

export function preToolUseDeny(reason: string): string {
  return JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason,
    },
  });
}
