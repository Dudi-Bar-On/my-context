import path from 'node:path';
import { recordAudit } from '../core/audit.ts';
import { isMainEntry, managedSplit, matchesAnyGlob, relPosix, toPosix } from '../core/paths.ts';
import { resolveWorkspace } from '../core/workspace.ts';
import { hookContext, readStdinAsync } from './io.ts';

/**
 * Narrower than `io.ts`'s `HookInput` on purpose, and not merged with it in
 * this task: `nudgeFor` reads `tool_input.file_path` as a string, while the
 * shared interface types `tool_input` as `Record<string, unknown>` — which is
 * the right shape for `pre-tool-use.ts`, whose `extractFilePath` tries three
 * different keys. Unifying them means giving this hook that same
 * three-key lookup, which is a behaviour change (`path` and `notebook_path`
 * would start producing nudges) and belongs to whoever wants that behaviour.
 */
export interface HookInput {
  tool_name?: string;
  tool_input?: { file_path?: string };
  cwd?: string;
  session_id?: string;
}

// NotebookEdit is deliberately excluded: `hooks.json`'s matcher
// (`Write|Edit|MultiEdit`) never spawns this process for it, and its payload
// carries the file under `notebook_path`, not `file_path` — so including it
// here would cost a process spawn on every notebook edit for a branch that
// can never produce a nudge. Notebooks are not what `watchedDocs` is for.
const WRITING_TOOLS = new Set(['Write', 'Edit', 'MultiEdit']);

/**
 * The nudge text, or '' when this edit is none of our business. Returns rather
 * than throws on every failure path: a hook that breaks an edit is worse than
 * a hook that says nothing (spec §6.5).
 */
export function nudgeFor(input: HookInput, fallbackCwd: string): string {
  try {
    if (!input.tool_name || !WRITING_TOOLS.has(input.tool_name)) return '';

    const filePath = input.tool_input?.file_path;
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
    })
    .catch(() => { /* fail open */ })
    .finally(() => { process.exitCode = 0; });
}
