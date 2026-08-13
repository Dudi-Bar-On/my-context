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
