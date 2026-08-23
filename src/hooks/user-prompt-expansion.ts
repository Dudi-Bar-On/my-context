import { isMainEntry } from '../core/paths.ts';
import { capped, runObservationHook, type Observation, type ObservationSpec } from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The second event a slash command fires, and the one that says what it was.
 *
 * `hooks seq:2b`, measured by the clear probe
 * (`reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3):
 *
 *     2026-08-22T07:07:04.674Z UserPromptExpansion {"session_id":"8321812a-…",
 *     "prompt_id":"d472fded-…","hook_event_name":"UserPromptExpansion",
 *     "expansion_type":"slash_command","command_name":"probeslash",
 *     "command_args":"someArg","command_source":"projectSettings",
 *     "prompt":"/probeslash someArg"}
 *
 * and on one of this project's own commands, separately measured:
 * `"command_name":"mycontext:status","command_args":"","command_source":"plugin"`.
 *
 * Six hundred milliseconds later the SAME prompt fires `UserPromptSubmit`
 * carrying the raw text `"/probeslash someArg"`, with an identical `prompt_id`.
 * Plain typed text fires only the second. **So a slash command is
 * distinguishable from typed text with no sentinel line in the command body and
 * no hook on every prompt** — which is the cost the plan's Task 16 row 1 was
 * thought to carry, and does not.
 *
 * The two events partition the command space, and that is measured too: both
 * are reached only from the dispatcher's `case"prompt":` arm, so markdown
 * commands, skills, plugin commands and MCP prompts fire both, while built-in
 * local commands — `/clear`, `/resume`, `/branch` — fire neither. Nothing in
 * this project may be built on a hook seeing `/clear` as a prompt.
 *
 * ── THE MATCHER IS THE POINT, AND IT IS THE ONLY ONE OF THE TEN ────────────
 *
 * `UserPromptExpansion` is matched on `command_name` (build 2.1.239, byte
 * 317139714: `case"UserPromptExpansion":a=n.command_name;break;`), and the name
 * arrives already parsed and already carrying its plugin prefix. `hooks.json`
 * registers this event with `"matcher": "^mycontext:"`, so the process is
 * spawned for this plugin's own commands and for nothing else.
 *
 * That is a deliberate exception to the no-matcher rule the other nine follow,
 * and the reason the rule does not apply is that here the omission is the
 * FEATURE rather than an accident waiting to happen. The `fork` defect was a
 * matcher that meant to admit everything and missed a value; this one means to
 * admit one namespace, states it, and — because the literal-list form is
 * rejected for a string containing `^` and `:` and the platform falls through
 * to `new RegExp(matcher)` — admits every `mycontext:` command that will ever
 * exist, including ones not yet written. The cost of the alternative is
 * concrete: no matcher is a process spawn on every slash command in every
 * session of every project that installs this plugin, to record commands that
 * are none of its business.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 *
 * It does not act on the command. `hooks task 16` — *the slash commands* — is
 * BLOCKED, and it is the task that would decide what `mycontext:session-name`
 * or any other command DOES when it is announced here. This hook records the
 * announcement, which is what proves the route exists and makes the volume
 * measurable before anything is built on it.
 *
 * It fills no `additionalContext` and never sets `suppressOriginalPrompt`
 * (build 2.1.239, byte 303349018), which would let a hook replace the user's
 * own prompt. A knowledge product editing what the user asked for is not a
 * thing this project does.
 *
 * `command_args` is never recorded. It is everything the user typed after the
 * command name — free text, by definition — and the log records scope. Whether
 * arguments were given, and how much, is scope and is recorded.
 */

/** The `expansion_type` values build 2.1.239's schema accepts, in its order. */
export const EXPANSION_TYPES = ['slash_command', 'mcp_prompt'] as const;

export function observePromptExpansion(input: HookInput): Observation | null {
  const name = typeof input.command_name === 'string' && input.command_name !== ''
    ? input.command_name : null;
  // The parsed name is the whole of what this event adds over `UserPromptSubmit`,
  // which carries the same prompt as raw text. Without it there is nothing here
  // that the other event does not already say.
  if (name === null) return null;

  const type = typeof input.expansion_type === 'string' && input.expansion_type !== ''
    ? input.expansion_type : '<absent>';
  const unknown = !(EXPANSION_TYPES as readonly string[]).includes(type);
  const source = typeof input.command_source === 'string' && input.command_source !== ''
    ? input.command_source : '<absent>';
  const args = typeof input.command_args === 'string' ? input.command_args : '';

  return {
    note:
      `command=${capped(name, 96)} type=${type}${unknown ? ' (unknown)' : ''} ` +
      `source=${capped(source, 32)} ` +
      `args=${args === '' ? 'none' : `${args.length} chars`}; nothing was acted on`,
  };
}

export const PROMPT_EXPANSION: ObservationSpec = {
  hook: 'UserPromptExpansion',
  op: 'prompt-expansion',
  observe: observePromptExpansion,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(PROMPT_EXPANSION);
