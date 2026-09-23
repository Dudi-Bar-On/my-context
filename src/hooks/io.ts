import { readFileSync } from 'node:fs';
// TYPE-only, and it stays that way. This module is on every hook's startup
// path and imports nothing at runtime but `node:fs`; an erased import costs
// the hook nothing, while a value import from `core/` would pull the
// selector's whole dependency graph into a process that only wanted to parse
// stdin.
import type { PinnedSpill } from '../core/select.ts';

export interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  /**
   * SessionStart only: `startup | resume | clear | compact | fork`.
   *
   * Five, and the fifth was missing here and from `hooks.json`'s matcher
   * until 2026-08-22. A `source` the matcher omits does not fail — the hook
   * does not RUN, so a forked session got no injection and no disclosure.
   * The list is the platform's own payload schema, read off build 2.1.239
   * and then confirmed by running a fork; see
   * `reports/probes/2026-08-20-clear-and-prompt-hooks.md`.
   */
  source?: string;
  /**
   * `SessionEnd` only: `clear | resume | logout | prompt_input_exit | other`.
   *
   * Five, and only two of them have ever been seen on the wire — `clear` and
   * `other`, both in
   * `reports/probes/2026-08-20-clear-and-prompt-hooks.md`. The list itself is
   * build 2.1.239's own payload schema, byte-identical in 2.1.237 and 2.1.238;
   * `hooks/session-end.ts` · `export const SESSION_END_REASONS = [` · ~76
   * carries the quotation and is the one place that enumerates it.
   *
   * **`other` is the DEFAULT, not a residual category.** The shutdown entry
   * point is declared `async function oc(e=0,t="other",r)`, so every ordinary
   * exit that names no reason arrives as `other` — which is why the probe saw
   * it on five of its six session ends.
   *
   * `PreCompact` and `PostCompact` carry `trigger` rather than this field, and
   * it is deliberately a separate key below: the two are matched on by the same
   * mechanism but they are different vocabularies, and one field spelling both
   * would let a `PostCompact` matcher silently accept a `SessionEnd` word.
   */
  reason?: string;
  /**
   * `PreCompact` and `PostCompact` only: `manual | auto`.
   *
   * The value the hook matcher is tested against on those two events, exactly
   * as `source` is on `SessionStart` and `reason` is on `SessionEnd`.
   */
  trigger?: string;
  /**
   * `PostCompact` only: the conversation summary compaction produced, verbatim.
   *
   * The platform's own schema describes it as *"The conversation summary
   * produced by compaction"*. It is the entire content of the context window
   * that comes out of a compaction, which is what makes it the one thing
   * `SessionStart(source: 'compact')` — the proxy this project inferred a
   * compaction from before `PostCompact` was registered — can never supply.
   * See `hooks/post-compact.ts` for what is done with it and what is not.
   */
  compact_summary?: string;
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

  // --- The observation events (hooks plan seq 21 and 2b) -------------------
  //
  // Every field below was read off build 2.1.239's own payload schema at
  // `C:/Users/UserC/.local/share/claude/versions/2.1.239`, by
  // `grep -a -b -o 'hook_event_name:kt("<Event>")'` and dumping the bytes that
  // follow. Each is present, byte-for-byte equivalent, in `2.1.237` and
  // `2.1.238` as well, so none of them is a value that appeared yesterday.
  // They are VALIDATION schemas, which makes them what the platform accepts;
  // it does not make them what it sends, and every handler below treats an
  // absent field as absent rather than defaulting it.

  /**
   * `FileChanged` (`file_path:L(),event:Or(["change","add","unlink"])`),
   * `InstructionsLoaded` and `ConfigChange` (both `file_path`, optional on
   * `ConfigChange`).
   *
   * NOT the same field as `tool_input.file_path`, which is a tool ARGUMENT and
   * is typed inside `tool_input` above. This one is the platform's own
   * top-level key and three different events spell it.
   */
  file_path?: string;
  /**
   * `FileChanged` only: `change | add | unlink`.
   *
   * Named `event`, not `change` or `kind`, because that is what is on the
   * wire. It collides with nothing else in this interface today, and it is
   * deliberately NOT folded into `reason`/`trigger`/`source`: those three are
   * already three vocabularies wearing three key names, and a fourth sharing
   * one of them is how a matcher silently accepts another event's word (see
   * `reason` above).
   */
  event?: string;
  /**
   * `InstructionsLoaded` only: `User | Project | Local | Managed` — which
   * memory tier the loaded CLAUDE.md came from.
   */
  memory_type?: string;
  /**
   * `InstructionsLoaded` only: `session_start | nested_traversal |
   * path_glob_match | include | compact`. **This is also the field
   * `InstructionsLoaded`'s hook MATCHER is tested against**, which is why the
   * manifest registers that event with no matcher at all — see
   * `hooks/instructions-loaded.ts`.
   */
  load_reason?: string;
  /** `InstructionsLoaded` only, optional: the globs that selected the file. */
  globs?: string[];
  /**
   * `PermissionDenied` (`tool_name,tool_input,tool_use_id,reason`) and, per the
   * same probe, `PreToolUse`. Declared here only because `PermissionDenied`
   * pairs a denial with the call that caused it and the id is the only join.
   */
  tool_use_id?: string;
  /**
   * `Stop` and `SubagentStop`: the platform's own re-entrancy guard, true when
   * the turn is continuing BECAUSE a stop hook asked it to. Nothing in this
   * project blocks a stop, so nothing here acts on it; it is recorded so the
   * log can say whether a turn ended on its own.
   */
  stop_hook_active?: boolean;
  /** `SubagentStop` only: the subagent's own transcript, distinct from the parent's. */
  agent_transcript_path?: string;
  /**
   * `TaskCreated` and `TaskCompleted`. `task_description`, `teammate_name` and
   * `team_name` are on the wire and are deliberately NOT declared: nothing
   * reads them, and `prompt_id`'s note above states the rule — a declared field
   * nothing reads is a claim about the payload that no test can hold up.
   */
  task_id?: string;
  /** `TaskCreated` and `TaskCompleted`: the task's one-line subject. */
  task_subject?: string;
  /**
   * `UserPromptExpansion` only: `slash_command | mcp_prompt`.
   *
   * The event a slash command actually announces, measured on this project's
   * own `/mycontext:status` in
   * `reports/probes/2026-08-20-clear-and-prompt-hooks.md` §3a. It fires FIRST,
   * ~600 ms before the `UserPromptSubmit` carrying the same raw text, and the
   * two share one `prompt_id`. Plain typed text fires only the second, which is
   * what makes a slash command distinguishable with no sentinel line and no
   * hook on every prompt.
   */
  expansion_type?: string;
  /**
   * `UserPromptExpansion` only: the command, already parsed and already carrying
   * its plugin prefix (`mycontext:status`). **This is the field
   * `UserPromptExpansion`'s matcher is tested against**, which is what lets the
   * manifest spawn this hook for this plugin's own commands and nothing else.
   */
  command_name?: string;
  /** `UserPromptExpansion` only: everything after the command name, unparsed. */
  command_args?: string;
  /**
   * `UserPromptExpansion` only, optional in the schema: where the command was
   * defined — `plugin` for this project's own, `projectSettings` for a
   * `.claude/commands/*.md`.
   */
  command_source?: string;
}

/* ========================================================================== *
 * THE PER-EVENT PAYLOAD SHAPES
 *
 * `TASK-one-flat-input-type-spans-fifteen-events-so-a-handler` measured what is
 * above this line: `HookInput` is ONE FLAT INTERFACE with ~25 optional fields
 * spanning fifteen platform events, so `input.compact_summary` COMPILES on a
 * `SessionStart` handler and yields `undefined` at run time — a field that
 * cannot exist on that event, accepted by the compiler. Every handler can read
 * fields from events it never receives, and nothing anywhere says which fields
 * its own event actually carries.
 *
 * **The comparison that settles the design question was already in this file.**
 * `HookEventName` below is a closed union for the OUTPUT envelope, with the
 * argument for it written out: *"A union rather than a `string` parameter makes
 * that a compile error instead of a hook whose injection arrives as
 * punctuation."* The shape was known, argued and applied on one side of the
 * boundary only. This is the other side.
 *
 * ── THE LIVE INSTANCE, found while typing this ─────────────────────────────
 *
 * `HookInput.source` is documented above as *"SessionStart only"*. It is not:
 * `ConfigChange` carries a `source` too, and `hooks/config-change.ts` reads it
 * — with a COMPLETELY DIFFERENT vocabulary (`CONFIG_SOURCES`:
 * `user_settings | project_settings | local_settings | policy_settings |
 * skills`, against `SessionStart`'s `startup | resume | clear | compact |
 * fork`). One key name, two vocabularies, and a docblock four fields up that
 * warns about exactly this for `reason`/`trigger`: *"one field spelling both
 * would let a `PostCompact` matcher silently accept a `SessionEnd` word."* A
 * flat interface cannot hold two types under one key. A per-event map can, and
 * `HookEventFields` below does — `SessionStart.source` and
 * `ConfigChange.source` are two separate declarations that cannot be confused.
 *
 * ── HOW THIS LANDS WITHOUT BREAKING EVERY CALL SITE AT ONCE ────────────────
 *
 * `HookInput` stays exactly as it is and stays the type `parseHookInput`
 * returns, because that function is handed untyped JSON and genuinely does not
 * know which event it has until it reads `hook_event_name`. What is new is a
 * NARROWING at each handler's entry: `payloadOf(input, 'PostCompact')` returns
 * a view carrying the base fields plus that event's own, and nothing else. From
 * that line on, reading a foreign field is a compile error IN THAT HANDLER,
 * with no effect on any other.
 *
 * So the migration is per handler and each one is independently landable, which
 * is the property a widening of `HookInput` itself would not have had. Handlers
 * not yet migrated behave exactly as before; `test/hooks/hook-payload.test.ts`
 * records which ones are done and which are not, by name.
 *
 * Everything here is types plus one identity function: erasable
 * (`CONST-node-24-no-build-step`), and it costs the hot hook path nothing.
 * ========================================================================== */

/**
 * The EIGHTEEN platform events this product registers a hook for, and the
 * per-event fields each one actually carries.
 *
 * **Eighteen, not fifteen.** The item that raised this counted fifteen when it
 * was written; `hooks/hooks.json` registers eighteen today, and the list here
 * was checked against that file rather than against the item. `Setup` and
 * `PostToolUseFailure` are the two most recently added, and both were reading
 * fields off the flat `HookInput` with nothing saying which event they belong
 * to — which is the defect, arriving again, in the two newest handlers.
 *
 * **Every entry was read off build 2.1.239's own payload schema** — the same
 * provenance the field comments above record, `grep -a -b -o
 * 'hook_event_name:kt("<Event>")'` and the bytes that follow — so this is what
 * the platform VALIDATES, which is not quite the same as what it sends. Every
 * field is therefore still optional and every handler still treats an absent
 * one as absent. What the map adds is the other half: a field that is not
 * listed for an event cannot be READ on that event at all.
 */
export interface HookEventFields {
  /** `startup | resume | clear | compact | fork` — see `HookInput.source`. */
  SessionStart: { source?: string };
  /** `clear | resume | logout | prompt_input_exit | other` — `SESSION_END_REASONS`. */
  SessionEnd: { reason?: string };
  /**
   * `manual | auto`.
   *
   * **A THIRD vocabulary is spelled `trigger`** — see `Setup` below, whose
   * `trigger` is `init | maintenance`. `HookInput.trigger` above declares it
   * once, as *"`PreCompact` and `PostCompact` only"*, which is false. That is
   * the same defect `HookInput.source` carries, found the same way, and the map
   * is where the two stop being one declaration.
   */
  PreCompact: { trigger?: string };
  /** `manual | auto`, plus the summary compaction produced. */
  PostCompact: { trigger?: string; compact_summary?: string };
  PreToolUse: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_use_id?: string;
    agent_id?: string;
    agent_type?: string;
    prompt_id?: string;
  };
  PostToolUse: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_response?: { agentId?: string };
    tool_use_id?: string;
    agent_id?: string;
    agent_type?: string;
  };
  /** `tool_name,tool_input,tool_use_id,reason` — a denial paired with its call. */
  PermissionDenied: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_use_id?: string;
    reason?: string;
  };
  Stop: { stop_hook_active?: boolean };
  SubagentStart: { agent_id?: string; agent_type?: string; prompt_id?: string };
  SubagentStop: {
    stop_hook_active?: boolean;
    agent_id?: string;
    agent_type?: string;
    agent_transcript_path?: string;
    prompt_id?: string;
  };
  /** `file_path:L(),event:Or(["change","add","unlink"])`. */
  FileChanged: { file_path?: string; event?: string };
  InstructionsLoaded: {
    file_path?: string;
    memory_type?: string;
    load_reason?: string;
    globs?: string[];
  };
  /**
   * **`source` here is NOT `SessionStart.source`**, and the whole reason this
   * map exists rather than a flat interface is that the two cannot both live
   * under one key. `CONFIG_SOURCES` (`hooks/config-change.ts`) is
   * `user_settings | project_settings | local_settings | policy_settings |
   * skills`; `SessionStart`'s is `startup | resume | clear | compact | fork`.
   * `file_path` is optional in the schema — a `skills` change carries no single
   * file, which `observeConfigChange` relies on.
   */
  ConfigChange: { source?: string; file_path?: string };
  /**
   * The failure counterpart of `PostToolUse`. Its payload is swept rather than
   * read field by field — see `reasonFrom` (`post-tool-use-failure.ts`), which
   * looks for a reason under several keys and inside several containers — so
   * the named fields here are the ones the handler DOES read directly.
   */
  PostToolUseFailure: {
    tool_name?: string;
    tool_input?: Record<string, unknown>;
    tool_use_id?: string;
  };
  /**
   * `init | maintenance` (`SETUP_TRIGGERS`, `hooks/setup.ts`) — and the third
   * thing named `trigger` in this map, after `PreCompact` and `PostCompact`'s
   * `manual | auto`. `hooks.json` registers this event with NO matcher exactly
   * because the matcher is tested against this field; see `setup.ts`.
   */
  Setup: { trigger?: string };
  TaskCreated: { task_id?: string; task_subject?: string };
  TaskCompleted: { task_id?: string; task_subject?: string };
  UserPromptExpansion: {
    expansion_type?: string;
    command_name?: string;
    command_args?: string;
    command_source?: string;
  };
}

/** One of the fifteen. A closed union, derived from the map so it cannot drift. */
export type HookEvent = keyof HookEventFields;

/**
 * What EVERY event carries, whatever it is. Four fields, and no more — the
 * platform stamps these on every payload, and anything else belongs to an
 * event.
 */
export interface HookBaseFields {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
}

/** The payload of exactly one event: the base fields plus that event's own. */
export type HookPayload<E extends HookEvent> = HookBaseFields & HookEventFields[E];

/**
 * **Narrow a parsed payload to the event this handler is registered for.**
 *
 * The event name is passed as a literal by the handler — `payloadOf(input,
 * 'PostCompact')` — because the handler is a separate process spawned by
 * `hooks.json` for exactly one event and therefore KNOWS which it is. It is not
 * read from `input.hook_event_name`: that field is caller-supplied, a handler
 * that trusted it would narrow to whatever a malformed payload claimed, and
 * `parseHookInput` already documents that a `{}` is indistinguishable from a
 * real payload downstream.
 *
 * It validates nothing and converts nothing — it is an identity function whose
 * return TYPE is narrower than its argument's. Every field stays optional and
 * every absent field stays absent, so no handler's behaviour changes on the
 * line it is added; what changes is what the compiler will let the lines after
 * it read.
 */
export function payloadOf<E extends HookEvent>(input: HookInput, _event: E): HookPayload<E> {
  return input;
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

/**
 * What fd 0 held, and whether it was read at all.
 *
 * **`unreadable` exists because `''` was answering for both** — the door of
 * the whole product, and report 3's P1 calls this its cleanest instance
 * (`plan:swallow seq:11`, minor m1). The docstring said *"Returns '' when
 * there is no stdin (interactive runs)"*, which is true of the case it names;
 * the `catch` was wider than the comment and returned `''` for EVERY errno,
 * `readFileSync(0)`'s `EAGAIN` on a non-blocking pipe included — a payload
 * that arrived and was lost. Three modules then reasoned FROM that docstring
 * to a decision to say nothing: `io.ts`'s own `parseHookInput`,
 * `observe.ts` and `session-end.ts` each argue that an empty payload is an
 * interactive run and *"not a platform that stopped sending fields"*.
 *
 * `null` means fd 0 WAS read to EOF — including an empty read, which is a
 * measured nothing. A string is the errno, and the caller discloses.
 */
export interface StdinRead {
  /** What was read. `''` when nothing was, for either reason. */
  text: string;
  /** `null` when fd 0 was read. Otherwise the errno that stopped it. */
  unreadable: string | null;
}

/** Reads fd 0 to EOF. See `StdinRead` for what `''` can and cannot mean. */
export function readStdin(): StdinRead {
  try {
    return { text: readFileSync(0, 'utf8'), unreadable: null };
  } catch (err) {
    return {
      text: '',
      unreadable: (err as NodeJS.ErrnoException).code
        ?? (err instanceof Error ? err.message : String(err)),
    };
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

/**
 * `read` is what `readStdin` returned. A plain string is accepted for callers
 * that ALREADY HAVE the text — the test suite, and any caller that read fd 0
 * some other way — and means "this text, successfully obtained". It is not a
 * second door onto stdin: nothing in `src/` may pass `readStdin().text` here,
 * because that is the drop this function exists to stop.
 */
export function parseHookInput(read: string | StdinRead): ParsedHookInput {
  const { text: raw, unreadable } = typeof read === 'string'
    ? { text: read, unreadable: null }
    : read;

  // **A read that did not happen is not an empty payload.** `''` with an errno
  // behind it means the hook is about to run with no `session_id`, no `source`
  // and no `transcript_path` because the pipe REFUSED, not because nobody sent
  // one — and every consequence `ParsedHookInput.parseError` documents for a
  // malformed payload applies here identically.
  if (unreadable !== null) {
    return {
      input: {},
      parseError: `stdin could not be read (${unreadable}), so no payload arrived`,
    };
  }

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
/**
 * **The line that would have caught the nine-day silence.**
 *
 * `findProjectRoot` walks UP from the session's `cwd` looking for
 * `.my_context`. From a directory with no workspace above it — a home
 * directory, a scratch folder, anywhere the terminal happened to be — it
 * reaches the filesystem root and returns null, and `buildInjection` then
 * returns `''`. Exit 0, empty output, and NO AUDIT RECORD, because with no
 * workspace there is nowhere to write one.
 *
 * **Measured on 2026-08-26 and it is the reason this function exists.** One
 * session ran from 2026-08-17 to 2026-08-26 and its own audit records stop on
 * 08-19: 44 of them across three days — `injection/jit`, `hook/deny`,
 * `injection/compact-restore` — and then nothing, for six working days on the
 * very repository the corpus governs. Same session id, same plugin, same code.
 * What changed was the working directory it was relaunched in, and no surface
 * anywhere reported that the corpus had stopped arriving. The failure was
 * indistinguishable from success at every observable point.
 *
 * That is `INV-nothing-is-dropped-silently` broken at the product's most
 * important path: everything else here names its absences — load errors are
 * surfaced, an unparseable payload discloses on both channels, a measured zero
 * is drawn and named — and "there is no corpus here" returned an empty string.
 *
 * **Stderr, because it is the only channel available.** There is no workspace,
 * so there is no audit log; and the model cannot be told in the injected block
 * without the plugin announcing itself inside every unrelated project a person
 * ever opens. Claude Code surfaces stderr to the USER, who is the one who can
 * fix it — and the fix is one thing, so the line says it.
 */
export function noWorkspaceLine(cwd: string): string {
  return (
    `my_context: no corpus found from ${cwd} — nothing was injected, and nothing ` +
    'else here will inject either until this is fixed. `.my_context` is looked for in this ' +
    'directory and every directory above it. If you expected a corpus, start Claude Code in ' +
    'the project directory instead.\n'
  );
}

/**
 * **The line a hook writes when this project's config could not be read.**
 *
 * `noWorkspaceLine`'s sibling, and it closes the same silence through the other
 * door. That one covers "there is no corpus HERE"; this one covers "there is
 * one and it could not be loaded", which until 2026-09-13 was the quieter of
 * the two by far — `findProjectRoot` SUCCEEDS on a broken config, so the
 * `findProjectRoot(cwd) === null` gate that guards `noWorkspaceLine` never
 * fired, `storeAppendix` and `handoverAppendix` caught to `''`, and the hook
 * exited 0 with empty stdout and empty stderr. Meanwhile the recording paths,
 * which read no config precisely so they cannot throw, kept the audit log full
 * of healthy rows. The evidence exonerated the failure.
 *
 * **`lost` is per hook, and the rest is shared.** One sentence would be wrong
 * here in a way it is not wrong for `hookParseErrorLine`: a malformed payload
 * costs every hook the same two fields, while a malformed config costs each of
 * these six a different thing — the whole injection, the JIT tier, the
 * compaction snapshot, the watched-doc nudge. A line that named all six on
 * every tool call would be a line nobody reads by the end of the first minute.
 * So each caller names what IT could not do, in its own voice, and the file,
 * the reason and the fix are shared so they cannot drift.
 *
 * **It ends by saying nothing was blocked**, for `hookParseErrorLine`'s reason:
 * a user who reads this mid-task needs to know their session is still running.
 * `INV-hooks-fail-open` is not weakened by any of this — nothing here refuses
 * to start, and that is the ruling in
 * `KNOWN-an-unparseable-hook-payload-injects-plausibly-and-discloses`: keep
 * failing open, and disclose.
 */
export function configUnreadableLine(failure: string, lost: string): string {
  return (
    `my_context: this project's config could not be read — ${failure} — so ${lost}. ` +
    'Nothing was blocked and nothing else changed; the corpus stays unreadable until the file ' +
    'is fixed. `mycontext doctor` names the file and the fault.\n'
  );
}

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
 * **The line a hook writes when its audit record could not be appended.**
 *
 * `recordAudit` returns `{ written, error }` and never throws, and for a long
 * time fourteen of the sixteen hook call sites discarded that answer
 * (`TASK-recordaudit-reports-whether-it-wrote-and-fourteen-of-sixteen`).
 * `core/audit.ts` used to justify the discard — *"Hooks discard it, because
 * there is no one to tell"* — and that is the sentence this function exists
 * to retire: there IS someone to tell, it is the person whose stderr Claude
 * Code surfaces, and the three other lines in this file already tell them
 * about losses of exactly this size.
 *
 * **Three of the fourteen were load-bearing in writing**, each because a
 * neighbouring comment said so: the JIT injection record, on whose durability
 * the seen-file append rests its best-effort posture; `recordDeny`, *"the one
 * hook action that CHANGES what a tool call does"*; and `subagent-start`'s
 * `delivery=attempted` row, the whole mechanism by which a killed lane
 * becomes evidence rather than silence. When the append failed, all three
 * guarantees were void and the prose still asserted them.
 *
 * **`lost` is per site and the rest is shared** — `configUnreadableLine`'s
 * shape, for its reason. What an unwritable log costs is different at each of
 * these sixteen doors (a refusal, a delivery, a compaction's captured ids, a
 * lane's first breath), and a line that named all sixteen on every firing is
 * a line nobody reads. What is shared is the fault, the `--op` a reader would
 * have gone looking under, and the promise that nothing was blocked.
 *
 * **It ends by saying nothing was blocked**, exactly as `hookParseErrorLine`
 * and `configUnreadableLine` do, because `INV-hooks-fail-open` is not
 * weakened by any of this: a hook exits 0 with a disclosure, since a hook
 * that failed over a log line would break the owner's session to report that
 * a log line was missing.
 *
 * **Not `auditFailureNote`.** That one is the sentence a MUTATION appends to
 * the message its human or agent is already reading; this is a standalone
 * line on the channel a hook has, addressed to a reader who asked for nothing.
 * Same fault, two readers, and merging them would put `mycontext audit`
 * troubleshooting into the middle of a `create` confirmation.
 */
export function unrecordedHookLine(
  hook: string, op: string, error: string, lost: string,
): string {
  return (
    `my_context: the ${hook} audit record could not be written (${error}) — ${lost}. ` +
    `\`mycontext audit --op ${op}\` is missing a row, so every count built from it is a ` +
    'floor. Nothing was blocked and nothing else changed; `mycontext doctor` names the audit ' +
    'directory and the fault.\n'
  );
}

/**
 * The one line SessionStart writes when a PINNED item did not fit.
 *
 * **`always: true` MEANS ALWAYS**, so a pinned tier that delivers part of
 * itself has broken a promise, and a broken promise that says nothing reads
 * exactly like a kept one. Measured on this project's own corpus
 * (`REQ-a-pinned-item-is-delivered-or-the-user-is-told-it-was-not`): 23 pinned
 * items against a 16,000 budget, 16 delivered, SEVEN silently absent — among
 * them the instruction to use my_context for everything the assistant needs to
 * remember. The corpus spilled the rules that would have said it was not
 * following the rules, and reported success.
 *
 * **The IDS, not a count.** "7 spilled" tells a reader that something is wrong;
 * "these seven" tells them what. Every id is named however long the list — a
 * truncated list would recreate the silence for whatever fell off the end, and
 * this line is written at most once per session start.
 *
 * **Both numbers, because the next question is "by how much".** `cost` is what
 * the whole tier would take, `budget` is what it is allowed, and the difference
 * is spelled out rather than left as arithmetic the reader does at a glance and
 * gets wrong. It stops there: this line REPORTS, it does not raise anything.
 * Auto-raising a budget was offered to the owner and declined — a corpus that
 * grows its own injection cost with nobody deciding is how a context window
 * fills quietly — and the surface where a person chooses is the UI's job, not
 * this line's.
 *
 * **Stderr, and one line.** Claude Code surfaces a hook's stderr to the USER,
 * who is the only reader who can act on it; the model gets nothing, because
 * telling a model "you are missing seven rules" spends the very budget that is
 * short on a sentence it cannot act on. `noWorkspaceLine` is the precedent for
 * both the channel and the tone.
 */
export function pinnedSpillLine(spill: PinnedSpill): string {
  return (
    `my_context: ${spill.ids.length} PINNED item(s) did not fit and were NOT injected, so ` +
    '`always: true` was not honoured for them. The pinned tier costs ' +
    `~${spill.cost} estimated tokens against a budget of ${spill.budget}, over by ` +
    `${spill.cost - spill.budget}. Not delivered: ${spill.ids.join(', ')}
`
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
 *
 * **`Stop` joined on 2026-08-27, and joining this union is the smaller half of
 * what that took.** Build 2.1.239 has declared a `hookSpecificOutput` variant
 * with `additionalContext` for `Stop` all along — `hooks/observe.ts` quotes the
 * platform's own description of it, *"non-error feedback delivered to the
 * model; the conversation continues so the model can act on it"* — and this
 * project still left it empty, because an event that CAN speak on every
 * assistant turn is a product decision and not a capability question
 * (`hooks/stop.ts`'s header records the whole of it). What changed is the
 * ruling, not the declaration: the owner's occupancy requirement is
 * `DEC-stop-speaks-once-and-only-to-raise-the-handover`, and it is narrow. This
 * union says `Stop` MAY be stamped on an envelope; it does not say anything may
 * be put in one, and `observe.ts` is where that stays narrow.
 */
export type HookEventName = 'PreToolUse' | 'PostToolUse' | 'SubagentStart' | 'Stop';

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
 * **The strongest thing a hook can say on an event it cannot stop.**
 *
 * `decision` and `reason` are TOP-LEVEL fields of the platform's generic hook
 * output schema — read off build 2.1.258's own validator, which declares
 * `decision:ee(["approve","block"]).optional(), reason:i().describe("Explanation
 * for the decision").optional()` beside `continue`, `stopReason` and
 * `systemMessage`, outside the per-event `hookSpecificOutput` union. So every
 * event may return it; what differs is what the event's CONSUMER does with the
 * result.
 *
 * What `block` produces is one object: the platform turns
 * `{decision:'block', reason}` into `blockingError:{blockingError: reason,
 * command}` (`case"block":F.permissionBehavior="deny",F.blockingError={...}`),
 * which is byte-for-byte what a hook exiting 2 with that text on stderr
 * produces. The two spellings converge, and this is the one that keeps the
 * process exiting 0 — so the whole file stays under `INV-hooks-fail-open`'s
 * "empty output and exit 0" shape, and stderr stays free for the copy the
 * human reads.
 *
 * **It is not a veto anywhere it is used here, and no caller may read it as
 * one.** On `PreToolUse` a `blockingError` becomes a permission denial; on
 * `SubagentStart` the consumer reads exactly three fields off each hook result
 * — `message`, `blockingError`, `additionalContexts` — and pushes the
 * `blockingError` into the new subagent's opening messages as a
 * `hook_non_blocking_error` attachment. The dispatch is not aborted, and
 * `preventContinuation` (what `continue:false` sets) is not read at that site
 * at all. `subagent-start.ts` documents what it does with that fact.
 */
export function hookBlockDecision(reason: string): string {
  return JSON.stringify({ decision: 'block', reason });
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
