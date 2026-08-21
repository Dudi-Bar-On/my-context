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
  /**
   * Claude Code's per-prompt identifier. Measured present on `PreToolUse`,
   * `SubagentStart` and `SubagentStop` on 2.1.234 — declared here so a reader
   * of this interface sees what the payload actually carries rather than
   * rediscovering it from a probe.
   *
   * The same probe measured `permission_mode`, `effort` and `tool_use_id` on
   * those payloads and this interface deliberately does NOT declare them:
   * nothing in the product reads them, and a declared field nothing reads is a
   * claim about the payload that no test can hold up. `prompt_id` earns its
   * line by being the identifier the web-UI design's §4b join was left open
   * on; nothing joins on it yet either, and that is said there, not implied
   * here.
   */
  prompt_id?: string;
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

/**
 * Reads stdin to EOF without blocking the event loop. '' on a stream error.
 *
 * The counterpart to `readStdin`, and the difference between them is the whole
 * reason both exist. `readFileSync(0)` blocks the thread outright, so no
 * in-process timer can ever preempt it; this reader leaves the loop free,
 * which is what lets `post-tool-use.ts`'s unref'd 2s timer fire against a pipe
 * the caller never closed. Neither is the better one — a hook nothing waits on
 * is correct to read synchronously, and `post-tool-use-failure.ts` says so
 * where it does it.
 *
 * **The bound is the CALLER's, and this function does not supply one.** The
 * promise resolves on `end`; a pipe that is never closed never ends, and
 * nothing here cuts that short. Measured rather than reasoned about: a process
 * that awaits this with its stdin held open stays alive indefinitely — the
 * pending 'data'/'end' listeners are themselves a ref on the event loop — and
 * an unref'd timer racing the promise resolves the race while leaving the
 * process up. So a caller whose output something waits on sets its own unref'd
 * timer BEFORE awaiting, exactly as `post-tool-use.ts` does; a caller that
 * sets none has `hooks.json`'s `"timeout"` — Claude Code killing the process —
 * as its only bound, and should say so where it reads.
 */
export function readStdinAsync(): Promise<string> {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk: string) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', () => resolve(''));
  });
}

/**
 * A hook payload plus the reason it could not be read, if it could not.
 *
 * The reason is the whole point. `parseHookInput` used to swallow every
 * failure and hand back `{}`, and `{}` is nearly indistinguishable from a
 * real payload downstream: `session-start.ts` falls back to `process.cwd()`,
 * which is USUALLY the right directory, so the workspace resolves, the corpus
 * loads, and the pinned tier injects normally. What silently vanished was
 * `source` and `session_id` — and with them `inject.ts`'s `compacting` flag
 * (so a compaction restores nothing), `buildJitOutput`'s session key (so the
 * JIT tier delivers nothing) and PreCompact's snapshot key (so no snapshot is
 * written). A plausible, complete-looking injection that has quietly lost
 * three features is worse than a visibly broken one; it cost a full
 * diagnostic pass that wrongly concluded the selection logic was at fault.
 */
export interface ParsedHookInput {
  input: HookInput;
  /**
   * `null` for a successful parse AND for empty/whitespace-only input — see
   * `readStdin`, which returns `''` for an interactive run with no stdin at
   * all. Nothing was malformed there and nothing was lost, so nothing is
   * disclosed: a fix that makes every interactive run noisy is a worse defect
   * than the silence it replaces.
   *
   * Otherwise a short human-readable reason, which distinguishes the two
   * genuinely malformed cases because they have different causes: text that
   * is not JSON at all (a truncated pipe, a wrapper writing a log line into
   * the payload) versus JSON of the wrong shape (a caller sending an array,
   * `null`, or a bare scalar where an object is required).
   */
  parseError: string | null;
}

/**
 * Flattens a thrown message to something safe to put on one line.
 *
 * `JSON.parse`'s message QUOTES the offending input — `Unexpected token 'o',
 * "not json at all {{{\n" is not valid JSON` — so a payload with a trailing
 * newline, which is what a real pipe delivers, drags that newline straight
 * into the disclosure and turns a one-line stderr note into two. It also
 * turns the injected block's note into a paragraph split mid-sentence.
 * Measured against the real binary, not reasoned about.
 *
 * Length is capped for the same reason: the quoted snippet is attacker- (or
 * at least caller-) controlled, and a disclosure that scrolls the user's
 * terminal discloses less than one that fits on it.
 */
function oneLine(message: string): string {
  const flat = message.replace(/\s+/gu, ' ').trim();
  return flat.length > 200 ? `${flat.slice(0, 197)}...` : flat;
}

export function parseHookInput(raw: string): ParsedHookInput {
  // Not an error: `readStdin` documents '' as the interactive-run answer.
  if (raw.trim() === '') return { input: {}, parseError: null };

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (err) {
    return {
      input: {},
      parseError: `stdin was not valid JSON (${
        oneLine(err instanceof Error ? err.message : String(err))})`,
    };
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    const shape = value === null
      ? 'null'
      : Array.isArray(value) ? 'an array' : `a ${typeof value}`;
    return {
      input: {},
      parseError: `stdin was valid JSON but ${shape}, not an object`,
    };
  }

  return { input: value as HookInput, parseError: null };
}

/**
 * The single line every hook puts on stderr when its payload could not be
 * read. Claude Code surfaces hook stderr, it cannot break the tool call, and
 * it needs no audit `op` — `AUDIT_OPS` is a closed vocabulary and `parseAudit`
 * refuses a whole segment on an unknown op, so a new one is a separate,
 * larger decision than this disclosure.
 *
 * `''` when there is nothing to disclose, exactly like `focusErrorNote`, so
 * callers stay a single `if`.
 *
 * One shared line rather than one per hook: what is lost is the same payload
 * in all three cases, and the consequences travel together — the hook that
 * NOTICES the malformed payload is rarely the one whose feature the user
 * later finds missing, so naming all three is what makes the line diagnostic.
 * It ends by saying the hook failed open, because a user who reads
 * "session_id never arrived" on stderr mid-task needs to know their tool call
 * was not blocked (`INV-hooks-fail-open`).
 */
export function hookParseErrorLine(parseError: string | null): string {
  if (parseError === null) return '';
  return (
    `my_context: hook payload unreadable — ${parseError}. ` +
    '`source` and `session_id` were not received, so this run has no session to key on: ' +
    'a compaction restore will not fire, the JIT (per-tool-call) tier will inject nothing, ' +
    'and PreCompact will write no snapshot. The hook still failed open — nothing was ' +
    'blocked and nothing else changed.\n'
  );
}

/**
 * The events whose hook output is a `hookSpecificOutput` envelope.
 *
 * `SessionStart` is deliberately absent, and absent as a TYPE rather than as a
 * convention: it writes raw text to stdout — `hooks/session-start.ts` ·
 * `if (text) process.stdout.write(text);` — which Claude Code appends to the
 * session verbatim, so wrapping it would deliver the JSON itself into the
 * model's context instead of the knowledge inside it. A union rather than a
 * `string` parameter makes that a compile error instead of a hook whose
 * injection arrives as punctuation.
 */
export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'SubagentStart';

/**
 * The one `additionalContext` envelope builder.
 *
 * There were two hand-rolled copies of this object literal before Task 5 —
 * this module's and `post-tool-use.ts`'s — differing in exactly one string,
 * the event name. That is the field with no failure mode to catch it: Claude
 * Code does not reject an envelope stamped with the wrong `hookEventName`, it
 * just never delivers the context, so a second copy is a second chance to be
 * silently wrong. One builder, and each caller names its event once.
 */
export function hookContext(event: HookEventName, text: string): string {
  return JSON.stringify({
    hookSpecificOutput: { hookEventName: event, additionalContext: text },
  });
}

/**
 * Kept as a wrapper rather than replaced at its call sites: `pre-tool-use.ts`
 * imports it and `test/hooks/pre-tool-use-jit.test.ts` reads the envelope it
 * produces, and none of that has anything to do with this task.
 */
export function preToolUseContext(text: string): string {
  return hookContext('PreToolUse', text);
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
