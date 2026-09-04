import path from 'node:path';
import { recordAudit } from '../core/audit.ts';
import { isMainEntry, managedSplit, matchesAnyGlob, relPosix, toPosix } from '../core/paths.ts';
import { findProjectRoot, resolveWorkspace } from '../core/workspace.ts';
import { capped, NOTE_MAX, subjectFor, SUBJECT_MAX } from './observe.ts';
import { hookContext, readStdinAsync } from './io.ts';

/**
 * Narrower than `io.ts`'s `HookInput` on purpose, and not merged with it in
 * this task: this hook reads a handful of specific fields rather than the
 * whole payload shape `pre-tool-use.ts`'s `extractFilePath` needs.
 *
 * `tool_input` is `Record<string, unknown>` — not a struct of named optional
 * strings — because, since `hooks/33` widened this hook's matcher to
 * `Bash|Read|Grep` alongside `Write|Edit|MultiEdit|Agent`, `agentStepNote`
 * below has to read whichever of `SUBJECT_KEYS` (`observe.ts`) a given tool
 * actually supplied, the same way `subagent-stop.ts`'s transcript backfill
 * always has. Every existing narrow read (`nudgeFor`'s `file_path`,
 * `agentDispatchNote`'s `description`/`subagent_type`) goes through
 * `stringField` already, so this widening changes no existing behaviour.
 *
 * `agent_id`/`agent_type` are the two fields `hooks/33`'s probe found already
 * on the wire, on every `PostToolUse` firing INSIDE a subagent, and absent
 * (not merely falsy) on the parent's own tool calls — see `agentStepNote`.
 */
export interface HookInput {
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_response?: { agentId?: string };
  cwd?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
}

// NotebookEdit is deliberately excluded: `hooks.json`'s matcher
// (`Write|Edit|MultiEdit|Agent`) never spawns this process for it, and its
// payload carries the file under `notebook_path`, not `file_path` — so
// including it here would cost a process spawn on every notebook edit for a
// branch that can never produce a nudge. Notebooks are not what `watchedDocs`
// is for.
const WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/** A named string field of an untyped payload object, or `null`. Never throws. */
function stringField(obj: unknown, key: string): string | null {
  if (typeof obj !== 'object' || obj === null) return null;
  const value = (obj as Record<string, unknown>)[key];
  return typeof value === 'string' && value !== '' ? value : null;
}

/**
 * The nudge text, or '' when this edit is none of our business. Returns rather
 * than throws on every failure path: a hook that breaks an edit is worse than
 * a hook that says nothing (spec §6.5).
 */
export function nudgeFor(input: HookInput, fallbackCwd: string): string {
  try {
    if (!input.tool_name || !WRITING_TOOLS.has(input.tool_name)) return '';

    const filePath = stringField(input.tool_input, 'file_path');
    if (!filePath) return '';

    const cwd = input.cwd && input.cwd !== '' ? input.cwd : fallbackCwd;
    const ws = resolveWorkspace(cwd);
    if (!ws.projectRoot) return '';

    // watchedDocs globs are repo-relative, and projectRoot is `<repo>/.my_context`.
    const repoRoot = path.dirname(ws.projectRoot);
    // Resolve against `cwd` (the hook payload's cwd, not `process.cwd()`) —
    // mirrors `pre-tool-use.ts`'s `path.resolve(cwd, filePath)`.
    const abs = path.resolve(cwd, filePath);

    // On win32, `path.relative` returns an ABSOLUTE path (not a `..`-prefixed
    // one) when the two paths resolve to different drives/roots — e.g. repo
    // on C:, target on D: or a UNC share. Left unchecked, that absolute
    // string would flow straight into the glob check below and leak a
    // foreign path into the model's context. Identical guard and hazard as
    // `pre-tool-use.ts`'s `buildJitOutput`.
    if (path.isAbsolute(path.relative(repoRoot, abs))) return '';
    const relative = relPosix(repoRoot, abs);
    if (relative === '' || relative === '..' || relative.startsWith('../')) return '';

    // A my_context workspace — this one or a nested one, either spelling —
    // must never nudge about itself. Shared with `pre-tool-use.ts`'s deny
    // check rather than re-implemented; see the comment on `managedSplit`.
    if (managedSplit(toPosix(abs))) return '';

    if (!matchesAnyGlob(relative, ws.config.watchedDocs)) return '';

    // Recorded only when the nudge actually fires. Every return above is "this
    // edit is none of our business", and a record per uninteresting tool call
    // would be the overwhelming majority of the log while telling a reader
    // nothing — the hook ran and declined, which is its normal state. What is
    // worth auditing is the moment my_context asked the model to capture
    // something, because that is when it influenced the session.
    //
    // `recordAudit` never throws, so this cannot break the fail-open contract
    // this whole function is written to. The nudge TEXT is not recorded: it is
    // a fixed sentence, and `path` is the only part that varies.
    recordAudit(ws.projectRoot, {
      kind: 'hook',
      op: 'post-tool-use',
      hook: 'PostToolUse',
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      path: relative,
      note: `${input.tool_name} on a watched document — capture nudge emitted`,
    });

    return (
      `You edited ${relative}. If it set a new requirement, decision or ` +
      `constraint, capture it now with create_item (source_file: the path ` +
      `above). Skip if nothing new was decided.`
    );
  } catch {
    return '';
  }
}

/**
 * One audit row per `Agent` dispatch — the owner's own choice, presented with
 * the alternative and declined: NOT one row per subagent tool call.
 * `src/core/ui-server-upkeep.ts` names the reason that alternative was never
 * on the table: this project once deleted 5,207 rows of per-message noise
 * from this very log for being noise.
 *
 * **What makes one row enough.** The dispatch title a terminal shows
 * (`general-purpose  Grepping runChecks signature in checks.ts`) is
 * `tool_input.description` on the **`Agent`** tool itself — never on any
 * subagent payload, which starts a fresh context window with no memory of
 * how it was dispatched — and `tool_response.agentId`, the join key, is on
 * the SAME `PostToolUse` firing. One record, zero extra reads.
 *
 * **Never throws (`INV-hooks-fail-open`).** This runs on the PostToolUse path
 * of a tool that fires constantly; anything here that could throw would
 * threaten every dispatch, not just this feature.
 *
 * **Gated on `tool_name === 'Agent'` inside the function, not only by the
 * caller.** `hooks.json`'s widened matcher (`Write|Edit|MultiEdit|Agent`) is
 * the first gate, but repeating the check here is what keeps this function
 * correct when called directly — by a test, or by a future caller that
 * forgets the matcher exists — and it is the assertion this project asked
 * for explicitly: a widened `PostToolUse` matcher must not silently become an
 * audit of every tool it now sees.
 *
 * **A missing title still writes a row; a missing id and a missing type do
 * too, each spelled `<absent>`** (`INV-nothing-is-dropped-silently`). Partial
 * data about a real dispatch beats a dropped row — the same argument
 * `subagent-stop.ts` makes for `type=<absent>` on 96.7% of its own rows.
 *
 * **No workspace, no record** — the log lives inside the workspace, and
 * `findProjectRoot` (not `resolveWorkspace`) is used for the reason every
 * other hook on this path gives at its own resolution: it never throws on a
 * broken `config.json`, so a dispatch that happens while the config is
 * broken is still recorded rather than lost to the one call here that could
 * throw.
 */
export function agentDispatchNote(input: HookInput, fallbackCwd: string): void {
  try {
    if (input.tool_name !== 'Agent') return;

    const cwd = input.cwd && input.cwd !== '' ? input.cwd : fallbackCwd;
    const root = findProjectRoot(cwd);
    if (!root) return;

    const agentId = stringField(input.tool_response, 'agentId') ?? '<absent>';
    const agentType = stringField(input.tool_input, 'subagent_type') ?? '<absent>';
    const description = stringField(input.tool_input, 'description');

    const note = capped(
      `dispatched type=${agentType} agent=${agentId}` +
      (description === null ? '' : `: ${description}`),
      NOTE_MAX,
    );

    recordAudit(root, {
      kind: 'hook',
      op: 'agent-dispatched',
      hook: 'PostToolUse',
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      note,
    });
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a session is worse
    // than one that says nothing.
  }
}

/**
 * One `agent-step` row per widened-matcher tool call made INSIDE a lane, live
 * — the change `TASK-a-lane-step-is-recorded-as-it-happens-because-the-hook`
 * (hooks/33) asked for, and the owner's ruling that `PostToolUse` may be
 * widened because it only observes and cannot block (see this task's own
 * report for the full ruling).
 *
 * **Gated on `input.agent_id` alone.** `hooks/33`'s own probe measured this
 * directly: `agent_id`/`agent_type` are present on every `PostToolUse` firing
 * caused by a tool call INSIDE a subagent, and absent — not empty, absent —
 * on the parent's own tool calls, including the parent's own `PostToolUse`
 * for the `Agent` call that does the dispatching. So this one gate is both
 * "this firing belongs to a lane" and "this is not the dispatch itself",
 * with no second check needed for the second half. A nested subagent
 * dispatching its OWN subagent still carries its own (non-empty) `agent_id`,
 * so its `Agent` call gets a step row too — the same tool-name-agnostic
 * treatment `transcriptSteps` already gives every `tool_use` block in a
 * transcript, kept here for the identical reason: a schema this project does
 * not own is not one this hook should special-case further than it has to.
 *
 * **Same shape as the (now retired) backfill, on purpose.**
 * `${tool}: ${subject} agent=${agentId}`, built from `SUBJECT_KEYS`
 * (`observe.ts`) exactly as `subagent-stop.ts`'s `transcriptSteps` built it —
 * the watch screen's step parser (`ui/public/screens/watch.js`,
 * `/^(\S+): (.*) agent=\S+$/`) does not care which hook wrote the row it is
 * reading, and a second shape for the same op would be a second thing that
 * parser has to recognise for no reason.
 *
 * **No `at` override.** The transcript backfill had a RECORD's own past
 * timestamp to attach; this firing IS the moment, so `recordAudit`'s own
 * write-time stamp is already correct and nothing here overrides it.
 *
 * **Never throws (`INV-hooks-fail-open`).** This runs on the PostToolUse path
 * of a tool that, since `hooks/33`, fires on very nearly every call a lane
 * makes; a throw or a slow path here is far more costly than it was when the
 * matcher only covered `Write|Edit|MultiEdit|Agent`.
 */
export function agentStepNote(input: HookInput, fallbackCwd: string): void {
  try {
    const agentId = input.agent_id;
    if (typeof agentId !== 'string' || agentId === '') return;

    const cwd = input.cwd && input.cwd !== '' ? input.cwd : fallbackCwd;
    const root = findProjectRoot(cwd);
    if (!root) return;

    const tool = input.tool_name && input.tool_name !== '' ? input.tool_name : '<absent>';
    const subject = capped(subjectFor(input.tool_input), SUBJECT_MAX);
    const note = capped(`${tool}: ${subject} agent=${agentId}`, NOTE_MAX);

    recordAudit(root, {
      kind: 'hook',
      op: 'agent-step',
      hook: 'PostToolUse',
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      note,
    });
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a session is worse
    // than one that says nothing.
  }
}

/**
 * The envelope, from `io.ts`'s one builder — and the empty guard, which stays
 * here because it is this hook's rule and not the builder's. Almost every edit
 * in a session is one this hook has no opinion on; an envelope carrying an
 * empty `additionalContext` on each of them is a hook that speaks constantly
 * and says nothing.
 */
export function buildOutput(text: string): string {
  if (text === '') return '';
  return hookContext('PostToolUse', text);
}

// isMainEntry, matching the CLI's and the SessionStart hook's entry guard
// (see the note in src/mcp/server.ts, Task 8) — not a bare `===` comparison.
if (isMainEntry(import.meta.filename, process.argv[1])) {
  // Unlike PreToolUse (fully synchronous readFileSync(0)), stdin here is read
  // through `io.ts`'s `readStdinAsync`, so the event loop stays free while
  // waiting on 'data'/'end'. That is what lets this unref'd timer preempt a
  // stdin that never closes: it is still scheduled and Node still fires it at
  // 2s regardless of ref state — unref only excuses the timer from keeping
  // the process alive on its own; it does not stop it from firing while
  // something else (the pending stdin read) is already keeping the process
  // alive. A synchronous readFileSync(0), by contrast, blocks the thread
  // entirely and no timer could ever preempt it. Verified by direct
  // execution: payload-with-open-pipe and empty-with-open-pipe both exit at
  // ~2070ms via this timer; payload-plus-close and malformed-plus-close both
  // exit in under 100ms via the normal promise resolution, unaffected by the
  // timer either way.
  //
  // The timer belongs to this caller, not to the reader: `readStdinAsync`
  // resolves on 'end' and supplies no bound of its own, which is exactly what
  // it says at its definition. Deleting these two lines does not break a test
  // that reads a payload — it breaks the one that holds the pipe open, which
  // is why that test exists.
  const timer = setTimeout(() => process.exit(0), 2000);
  timer.unref();

  readStdinAsync()
    .then((raw) => {
      let parsed: HookInput = {};
      try {
        parsed = JSON.parse(raw) as HookInput;
      } catch {
        return;
      }
      const line = buildOutput(nudgeFor(parsed, process.cwd()));
      if (line) process.stdout.write(line + '\n');
      // No stdout of its own: a dispatch row is audit-only, and there is
      // nothing here the model needs told back to it about its own dispatch.
      agentDispatchNote(parsed, process.cwd());
      // Likewise audit-only, and likewise gated so it does nothing on the
      // overwhelming majority of firings (every one outside a lane) — see
      // agentStepNote's own comment for the gate and the duplication
      // decision it is half of.
      agentStepNote(parsed, process.cwd());
    })
    .catch(() => { /* fail open */ })
    .finally(() => { process.exitCode = 0; });
}
