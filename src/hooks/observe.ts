import path from 'node:path';
import { recordAudit, type AuditRecord, type HookOp } from '../core/audit.ts';
import { relPosix } from '../core/paths.ts';
import { findProjectRoot } from '../core/workspace.ts';
import { hookParseErrorLine, parseHookInput, readStdin, type HookInput } from './io.ts';

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
 * Runs one observation. Returns the note recorded, or `null` when nothing was.
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
export function recordObservation(
  spec: ObservationSpec, input: HookInput, fallbackCwd: string,
): string | null {
  try {
    if (Object.keys(input as Record<string, unknown>).length === 0) return null;

    const root = findProjectRoot(input.cwd ?? fallbackCwd);
    if (!root) return null;

    const observed = spec.observe(input, root);
    if (observed === null) return null;

    const note = capped(observed.note, NOTE_MAX);
    recordAudit(root, {
      kind: 'hook',
      op: spec.op,
      hook: spec.hook,
      ...(input.session_id === undefined ? {} : { sessionId: input.session_id }),
      ...(observed.path === undefined ? {} : { path: observed.path }),
      note,
    });
    return note;
  } catch {
    // INV-hooks-fail-open. A knowledge base that breaks a session is worse than
    // one that says nothing.
    return null;
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
 * **Nothing is ever written to stdout, and for six of the ten there is an
 * envelope going unused.** Build 2.1.239 declares a `hookSpecificOutput`
 * variant with `additionalContext` for `Stop`, `SubagentStop`, `Setup` and
 * `UserPromptExpansion`, a `retry` for `PermissionDenied` and a `watchPaths`
 * for `FileChanged`. Filling any of them is an act, not an observation —
 * `additionalContext` on `Stop` is *non-error feedback delivered to the model*
 * by the platform's own description, which is a product speaking into every
 * turn — and what these ten do instead is written down. `TaskCreated`,
 * `TaskCompleted`, `InstructionsLoaded` and `ConfigChange` have no output
 * variant at all, so for them a byte on stdout would be a byte nobody reads.
 */
export function runObservationHook(spec: ObservationSpec): void {
  try {
    const { input, parseError } = parseHookInput(readStdin());
    if (parseError !== null) process.stderr.write(hookParseErrorLine(parseError));
    recordObservation(spec, input, process.cwd());
  } catch {
    /* fail open */
  }
  process.exitCode = 0;
}
