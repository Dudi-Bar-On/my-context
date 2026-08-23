import path from 'node:path';
import { isMainEntry } from '../core/paths.ts';
import {
  capped, repoRelative, runObservationHook, type Observation, type ObservationSpec,
} from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * The OTHER thing that reaches a session's context, finally visible to us.
 *
 * This product's entire argument is about what a model is shown and why: the
 * pinned tier, the JIT tier, the index, the budgets that decide between them,
 * and an audit row for each so a user can ask *what did this session actually
 * see*. And for all of that, a `CLAUDE.md` loading beside it was invisible —
 * often larger than the injection, always unbudgeted, and never in the log. A
 * session's context is the union of the two, and until this event my_context
 * could only describe its own half.
 *
 * **It is an observation and it will stay one until someone rules otherwise.**
 * The obvious next moves — counting the loaded instructions against the
 * injection budget, warning when they contradict a governing item, proposing
 * that a rule move from `CLAUDE.md` into the corpus — are all decisions about
 * what my_context does to a file the user owns, and `hooks seq:22` names that
 * surface explicitly (*CLAUDE.md and the memory system — InstructionsLoaded now
 * makes this visible to us; what should mycontext write, propose, or refuse to
 * touch*). That task is BLOCKED on the owner. This file makes the thing
 * visible, which is what the survey needs; it decides nothing about it.
 *
 * **Registered with no matcher, deliberately.** The matcher on this event is
 * tested against `load_reason` (build 2.1.239, byte 317139714:
 * `case"InstructionsLoaded":a=n.load_reason;break;`), whose five declared values
 * are `session_start`, `nested_traversal`, `path_glob_match`, `include` and
 * `compact` (byte 303346128). A matcher naming four of five does not fail — the
 * hook does not RUN — which is the exact defect
 * `test/hooks/session-start-matcher.test.ts` exists because of. Since this hook
 * wants every load, it names none of them and filters nothing.
 *
 * **The five reasons are worth knowing apart** even though none is excluded:
 * `session_start` is the memory a session begins with, `compact` is memory
 * being re-read after a compaction — which is the same moment the restore tier
 * fires, so the two now appear side by side in one log — and
 * `path_glob_match` is a file that loaded because of what the model touched,
 * which is the JIT tier's own shape arriving from the other direction.
 */

/** The `memory_type` values build 2.1.239's schema accepts, in its order. */
export const MEMORY_TYPES = ['User', 'Project', 'Local', 'Managed'] as const;

/** The `load_reason` values build 2.1.239's schema accepts, in its order. */
export const LOAD_REASONS = [
  'session_start', 'nested_traversal', 'path_glob_match', 'include', 'compact',
] as const;

function known(list: readonly string[], value: string): string {
  return list.includes(value) ? '' : ` (not one of ${list.join(', ')})`;
}

export function observeInstructionsLoaded(input: HookInput, root: string): Observation | null {
  if (typeof input.file_path !== 'string' || input.file_path === '') return null;

  const tier = typeof input.memory_type === 'string' && input.memory_type !== ''
    ? input.memory_type : '<absent>';
  const reason = typeof input.load_reason === 'string' && input.load_reason !== ''
    ? input.load_reason : '<absent>';
  const globs = Array.isArray(input.globs) ? input.globs.length : 0;

  // Inside the repository the path goes in the `path` column, where every other
  // hook's path goes. Outside it — the `User` tier lives in the home directory
  // and reaches the session exactly as loudly — only the basename is recorded:
  // the log already discloses that it names this repository's local paths, and
  // a home directory is a wider claim than this row needs to make.
  const rel = repoRelative(root, input.file_path);
  const name = path.basename(input.file_path);

  return {
    ...(rel === null ? {} : { path: rel }),
    note:
      `memory_type=${tier}${known(MEMORY_TYPES, tier)}; ` +
      `load_reason=${reason}${known(LOAD_REASONS, reason)}; ` +
      (rel === null ? `${capped(name, 64)} (outside this repository); ` : '') +
      (globs === 0 ? '' : `${globs} glob(s); `) +
      'instructions my_context did not select reached this session',
  };
}

export const INSTRUCTIONS_LOADED: ObservationSpec = {
  hook: 'InstructionsLoaded',
  op: 'instructions-loaded',
  observe: observeInstructionsLoaded,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(INSTRUCTIONS_LOADED);
