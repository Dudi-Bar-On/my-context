import path from 'node:path';
import { recordAudit, type AuditRecord, type HookOp } from '../core/audit.ts';
import { relPosix } from '../core/paths.ts';
import { findProjectRoot } from '../core/workspace.ts';
import {
  hookContext, hookParseErrorLine, parseHookInput, readStdin,
  type HookEventName, type HookInput,
} from './io.ts';

/**
 * The ten OBSERVATION hooks: one shared runtime, ten thin declarations.
 *
 * `hooks plan seq:21` ruled nine more events in — `FileChanged`,
 * `InstructionsLoaded`, `ConfigChange`, `PermissionDenied`, `SubagentStop`,
 * `Stop`, `Setup`, `TaskCreated`, `TaskCompleted` — and `seq:2b` added
 * `UserPromptExpansion`. Every one of them does exactly one thing: it writes at
 * most one scoped row to the audit log. None of them injects, none of them
 * mutates, and none of them writes a byte to stdout.
 *
 * **Why one runtime rather than ten copies.** The main-entry dance is identical
 * for all ten — read stdin, parse, disclose an unreadable payload on stderr,
 * resolve the workspace, record, exit 0 — and it is the part with no failure
 * mode to catch it: a hook that forgets `process.exitCode = 0` breaks a session
 * the day its handler throws, and a hook that forgets the parse disclosure
 * fails `INV-nothing-is-dropped-silently` in silence, by construction. This is
 * `io.ts`'s `hookContext` argument at a larger scale — *a second copy is a
 * second chance to be silently wrong* — and it is why the six older binaries
 * are NOT folded in here: each of them makes a different decision about the
 * stdin reader, the timer and the envelope, and those differences are load
 * bearing and documented where they are made. These ten make the same
 * decisions, so they make them once.
 *
 * **What each declaration still owns**, and it is the whole of what differs:
 * the platform event name, the audit op, and one function that turns a payload
 * into a note or into `null`. `null` is the important half. `FileChanged` fires
 * for every file under a watched directory and `Stop` fires on every assistant
 * turn, so DECLINING is the normal state of most of these; a record-only hook
 * that records everything is a hook that makes the log unreadable.
 *
 * **Every one of them stops short of the obvious second thing.** `Setup(init)`
 * could create a workspace, `TaskCreated` could write a `task` item,
 * `FileChanged` could rebuild the index, `SubagentStop` could prune the
 * subagent's seen file. Each of those is a decision about what mycontext does
 * without being asked, which is `hooks seq:22` — *make mycontext autonomous
 * from the first second* — and that task is BLOCKED on the owner. The mechanism
 * is here and the payloads are reachable; the posture is not chosen. Each
 * declaration names its own stopping point where it stops.
 */

/** The platform events this module runs. Spelled as `hook_event_name` spells them. */
export type ObservationHook = NonNullable<AuditRecord['hook']>;

/** What one firing amounted to, or `null` when it was none of my_context's business. */
export interface Observation {
  /** Scope, never content. One line, already capped by its builder. */
  note: string;
  /**
   * The workspace-relative POSIX path this firing was about, when there is
   * one. Reuses `AuditRecord.path` rather than adding a field: it already means
   * *the repo-relative path that triggered the event*, which is exactly what
   * `FileChanged`, `InstructionsLoaded` and `ConfigChange` have to say.
   */
  path?: string;
  /**
   * Text to deliver to the MODEL, through the event's `additionalContext`
   * envelope. Absent on nine of the ten, and that is not an accident of the
   * current feature set — it is the standing state of this module.
   *
   * **Setting this makes an observation hook ACT**, and the whole header above
   * is about not doing that. One spec sets it — `stop.ts`, at the occupancy
   * threshold, under the owner ruling recorded there — and a second would need
   * its own ruling before it needed any code. `SPEAKS` below is the gate: an
   * event that is not in it cannot deliver this field, and adding an event to
   * it is a visible, reviewable line rather than a builder quietly returning
   * one more property.
   *
   * Never capped like `note` is. `note` is a log line a human reads in a
   * terminal; this is context a model reads, and truncating an instruction
   * mid-sentence to fit a log's width would be a cap borrowed from the wrong
   * surface. The builder that sets it owns its length.
   */
  context?: string;
  /**
   * Overrides `ObservationSpec.op` for THIS firing only. Absent on every
   * builder but one: `observeSubagentStop` (`hooks/subagent-stop.ts`) is the
   * one spec whose op depends on the payload rather than on which event
   * fired — a `SubagentStop` naming a real dispatch (`agent_type` present)
   * writes `subagent-stop`, one that does not writes `subagent-stop-untyped`
   * — and this field is what lets it choose without every other spec's
   * static `op` growing a branch it does not need
   * (`TASK-a-third-of-the-audit-feed-is-stop-rows-for-things-that-were`,
   * hooks/34; see `HOOK_OPS`'s own comment in `core/audit.ts` for the whole
   * argument for the split).
   */
  op?: HookOp;
}

export interface ObservationSpec {
  hook: ObservationHook;
  op: HookOp;
  /**
   * `root` is the workspace directory (`<repo>/.my_context`), already resolved,
   * so a builder that needs a relative path has something to make one against.
   * It must never throw; `recordObservation` catches anyway, but a builder that
   * relies on that catch has given up its own disclosure.
   */
  observe: (input: HookInput, root: string) => Observation | null;
}

/**
 * The longest a note may be. 320 characters is about three terminal lines at
 * the width `mycontext audit` renders, and every builder that interpolates
 * caller text (a task subject, a denial reason, a settings source) runs it
 * through `capped` first.
 *
 * The reason is `RefusalDetail`'s reason, one surface over: the interpolated
 * text is caller-controlled, and a log line that scrolls the terminal discloses
 * less than one that fits on it.
 */
export const NOTE_MAX = 320;

/** One line, flattened and capped — `oneLine` in `io.ts`, for caller text. */
export function capped(text: string, max = 96): string {
  const flat = text.replace(/\s+/gu, ' ').trim();
  return flat.length > max ? `${flat.slice(0, max - 3)}...` : flat;
}

/** The longest a plucked subject may be, before it joins the tool name and the agent id in `note`. */
export const SUBJECT_MAX = 80;

/**
 * The one field of `tool_input` an `agent-step` row will ever carry, tried in
 * this order and stopping at the first STRING present.
 *
 * **Shared between `subagent-stop.ts`'s backfill and `post-tool-use.ts`'s live
 * writer** (TASK-a-lane-step-is-recorded-as-it-happens-because-the-hook,
 * hooks/33) — both produce the identical `${tool}: ${subject} agent=${id}`
 * shape, from the same closed set of keys, so this is the one place that
 * choice is made rather than two copies drifting apart. `subagent-stop.ts`
 * used to keep its own copy; it now imports this one.
 *
 * **Never the whole object.** `tool_input` carries file contents, command
 * output and prompt text — `HOOK_OPS`' comment on `agent-step` in
 * `core/audit.ts` names the 5,207 rows this log already deleted once for
 * exactly that shape of noise. Every key here is chosen because it is
 * normally SHORT and human-recognisable: `description` is a tool's own
 * one-line summary when it supplies one (the `Agent` tool's, and increasingly
 * `Bash`'s); the rest are the argument that names WHAT a call acted on rather
 * than what it did with it.
 *
 * A tool this list does not recognise — an MCP tool, a future built-in —
 * produces no match and falls through to `NO_SUBJECT`. That is the
 * `INSTR-read-the-design-record...`-mandated posture for a schema this
 * project does not own: skip what is not recognised, never guess at it.
 */
export const SUBJECT_KEYS = [
  'description', 'file_path', 'notebook_path', 'command', 'pattern', 'query', 'url', 'path',
] as const;

export const NO_SUBJECT = '<no subject>';

export function subjectFor(toolInput: unknown): string {
  if (typeof toolInput !== 'object' || toolInput === null) return NO_SUBJECT;
  const obj = toolInput as Record<string, unknown>;
  for (const key of SUBJECT_KEYS) {
    const value = obj[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return NO_SUBJECT;
}

/**
 * `abs` relative to the REPOSITORY (the parent of the workspace directory), in
 * POSIX form — or `null` when it is outside it.
 *
 * Outside is not an error and is not a reason to decline: a `User`-tier
 * CLAUDE.md lives in the home directory and still reaches the session. It is a
 * reason not to put the string in the log. `core/audit.ts` already discloses
 * that the log *names local file paths*, and that is about the workspace's own
 * repository; a path from somewhere else on the machine is a wider claim than
 * this file has any need to make.
 *
 * On win32 `path.relative` returns an ABSOLUTE path when the two sides are on
 * different drives or roots, which is why the result is re-tested rather than
 * trusted — the identical guard `post-tool-use.ts` and `pre-tool-use.ts` both
 * carry, and for the identical reason.
 */
export function repoRelative(root: string, abs: string): string | null {
  const repo = path.dirname(root);
  const resolved = path.resolve(abs);
  if (path.isAbsolute(path.relative(repo, resolved))) return null;
  const rel = relPosix(repo, resolved);
  if (rel === '' || rel === '..' || rel.startsWith('../')) return null;
  return rel;
}

/**
 * **Which observation events are allowed to speak to the model, and as what.**
 *
 * Six of the ten have an output envelope declared by the platform (see
 * `runObservationHook` below) and exactly ONE of them is in this map. That is
 * the narrowness of `DEC-stop-speaks-once-and-only-to-raise-the-handover`
 * expressed as code rather than as a comment: `Observation.context` on any
 * other spec reaches an event this map does not name, so no envelope is built
 * and nothing is written. There is no path by which a new builder can start
 * talking to the model without a line being added here.
 *
 * A `Partial<Record<…>>` rather than a cast from `ObservationHook` to
 * `HookEventName`: the two unions overlap without either containing the other —
 * `TaskCreated` is an observation event with no envelope at all, `PreToolUse`
 * has an envelope and is not an observation event — and a cast would compile
 * for both of those while producing an envelope Claude Code silently never
 * delivers, which is the exact failure `io.ts`'s union was introduced to make
 * impossible.
 */
const SPEAKS: Partial<Record<ObservationHook, HookEventName>> = { Stop: 'Stop' };

/**
 * What one firing amounted to on BOTH channels: the note that was recorded, and
 * the bytes the process should put on stdout.
 *
 * `stdout` is a string rather than a side effect because this is the only part
 * of an observation that a test can see without a spawn, and because the two
 * callers want it at different moments — `runObservationHook` writes it, and
 * `test/hooks/stop-handover-ask.test.ts` reads it across several turns of one
 * session, which no binary run could do.
 */
export interface ObservationOutcome {
  /** The note recorded, capped — `null` when nothing was recorded at all. */
  note: string | null;
  /** The `additionalContext` envelope, or `''` — the normal answer. */
  stdout: string;
}

/**
 * Runs one observation. Returns the note recorded, or `null` when nothing was.
 * Never throws (`INV-hooks-fail-open`).
 *
 * The note half of `observeAndRecord`, kept at its original name and shape
 * because it is what the nine record-only hooks and their tests are about, and
 * because the perf harness times it. A caller that needs the model-facing half
 * asks for the whole outcome.
 */
export function recordObservation(
  spec: ObservationSpec, input: HookInput, fallbackCwd: string,
): string | null {
  return observeAndRecord(spec, input, fallbackCwd).note;
}

/**
 * Runs one observation and reports both of its channels.
 * Never throws (`INV-hooks-fail-open`).
 *
 * The three gates, in order, and each is a different kind of "nothing to do":
 *
 *  1. **An empty payload** is an interactive run with no stdin — `readStdin`
 *     documents `''` as that answer — not a platform that stopped sending
 *     fields. Saying anything about it would make every such run noisy about
 *     nothing.
 *  2. **No workspace** means there is nowhere to record: the log lives inside
 *     the workspace. This is also `Setup(init)`'s entire story on a fresh
 *     machine, and `setup.ts` says so where it declines.
 *  3. **`observe` returned `null`** — the firing was real and was none of
 *     my_context's business. This is the common case for `FileChanged`.
 *
 * **`findProjectRoot`, not `resolveWorkspace`**, for the reason
 * `session-start.ts`, `subagent-start.ts`, `session-end.ts` and
 * `post-compact.ts` all give at their own resolutions: `resolveWorkspace`
 * throws on a `config.json` that is not valid JSON, and a workspace with a
 * broken config is still a workspace whose events should be recorded. It
 * matters more here than anywhere: `FileChanged` is the one event that FIRES
 * when `config.json` is edited, so the moment a user breaks that file is
 * exactly the moment `resolveWorkspace` would stop this hook from saying so.
 *
 * The audit write's own failure is discarded, as on every hook path — there is
 * no one to tell, and `core/audit.ts` documents that trade where it is made.
 */
export function observeAndRecord(
  spec: ObservationSpec, input: HookInput, fallbackCwd: string,
): ObservationOutcome {
  // Declared outside the `try` and returned by the `catch` too. The one spec
  // that fills it has ALREADY latched its ask by the time it returns — the
  // latch is what stops the loop, so it must be taken before the ask, not
  // after — which makes this turn the only turn the ask can be delivered on.
  // Losing it to an audit-log failure would trade the feature for a log line.
  let stdout = '';
  try {
    if (Object.keys(input as Record<string, unknown>).length === 0) return { note: null, stdout };

    const root = findProjectRoot(input.cwd ?? fallbackCwd);
    if (!root) return { note: null, stdout };

    const observed = spec.observe(input, root);
    if (observed === null) return { note: null, stdout };

    // `SPEAKS` and not `spec.hook` directly: see the map. An event it does not
    // name produces no envelope, and no observation builder outside `stop.ts`
    // sets `context` at all, so nothing is dropped by this gate today — it is
    // here to make the day one does a code change here rather than a surprise.
    const speaksAs = SPEAKS[spec.hook];
    if (observed.context !== undefined && speaksAs !== undefined) {
      stdout = hookContext(speaksAs, observed.context);
    }

    const note = capped(observed.note, NOTE_MAX);
    recordAudit(root, {
      kind: 'hook',
      op: observed.op ?? spec.op,
      hook: spec.hook,
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      ...(observed.path === undefined ? {} : { path: observed.path }),
      note,
    });
    return { note, stdout };
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a session is worse than
    // one that says nothing.
    return { note: null, stdout };
  }
}

/**
 * The main-entry body every observation binary calls, and the only place any of
 * them touches a process.
 *
 * **A synchronous `readStdin`, and no timer.** `readFileSync(0)` blocks the
 * thread, so no in-process timer could preempt it even if one were set — the
 * fact `post-tool-use.ts` records for the mirror case. That is the right reader
 * here for `post-tool-use-failure.ts`'s reason: nothing waits on these hooks'
 * output, because they produce none, so a stalled read costs this process and
 * nothing else, and the `"timeout"` in `hooks.json` is the bound. The one event
 * where that would be wrong is `Stop`, which the platform DOES wait on before
 * ending the turn, and its timeout is declared accordingly.
 *
 * **Nine of the ten still write nothing to stdout, and for five of those there
 * is an envelope going unused.** Build 2.1.239 declares a `hookSpecificOutput`
 * variant with `additionalContext` for `Stop`, `SubagentStop`, `Setup` and
 * `UserPromptExpansion`, a `retry` for `PermissionDenied` and a `watchPaths`
 * for `FileChanged`. Filling any of them is an act, not an observation —
 * `additionalContext` on `Stop` is *non-error feedback delivered to the model*
 * by the platform's own description, which is a product speaking into every
 * turn — and what these ten do instead is written down. `TaskCreated`,
 * `TaskCompleted`, `InstructionsLoaded` and `ConfigChange` have no output
 * variant at all, so for them a byte on stdout would be a byte nobody reads.
 *
 * **`Stop` is the tenth, since 2026-08-27, and it is the exception this comment
 * used to be able to say did not exist.** It speaks for exactly one purpose —
 * raising the handover once at the configured occupancy — under the owner
 * ruling `DEC-stop-speaks-once-and-only-to-raise-the-handover`, recorded at
 * length in `stop.ts`'s header. The other five envelopes are still unfilled and
 * still unruled, `SPEAKS` above is what keeps that true, and the capture nudge
 * is still on `PostToolUse` where `hooks seq:21` left it.
 */
export function runObservationHook(spec: ObservationSpec): void {
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    const { stdout } = observeAndRecord(spec, input, process.cwd());
    // Guarded rather than written unconditionally: for nine of the ten this is
    // always `''`, and an unconditional `write('')` on a closed or absent
    // stdout is a throw on a path whose whole job is not to have one.
    if (stdout !== '') process.stdout.write(stdout);
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
