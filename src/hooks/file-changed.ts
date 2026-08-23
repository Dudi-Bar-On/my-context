import path from 'node:path';
import { isMainEntry, relPosix, toPosix } from '../core/paths.ts';
import {
  runObservationHook, type Observation, type ObservationSpec,
} from './observe.ts';
import type { HookInput } from './io.ts';

/**
 * A corpus file changed on disk without going through my_context.
 *
 * `INV-markdown-is-the-source-of-truth` means a human may open
 * `.my_context/items/…md` in an editor and change it, and the index is a
 * projection that is rebuilt from those files on every open
 * (`core/open-store.ts` · `The rebuild is unconditional and per call by design`).
 * So the index is not what a hand edit endangers. What a hand edit endangers is
 * the RECORD: `REQ-changes-are-timestamped-and-audited` is satisfied by
 * `core/audit.ts`, and every writer that reaches it is a my_context writer. An
 * edit made in an editor changed the corpus and left no row anywhere. This is
 * the event that leaves one.
 *
 * ── HOW THIS EVENT IS REGISTERED, WHICH IS NOT LIKE ANY OTHER ──────────────
 *
 * **`FileChanged` fires only for paths something asked to be watched, and a
 * hook's `matcher` is one of the two things that ask.** Read off build 2.1.239
 * at byte 309954100:
 *
 *     let b=ume()?.FileChanged??[],S=HD()?[]:cbe()?.FileChanged??[],w=[...b,...S],T=[];
 *     for(let x of w){if(!x.matcher)continue;
 *       for(let R of x.matcher.split("|").map((I)=>I.trim())){if(!R)continue;
 *         T.push(JPi.isAbsolute(R)?R:JPi.join(t,R))}}
 *     …
 *     e=Zne.watch(_,{persistent:!0,ignoreInitial:!0,
 *       awaitWriteFinish:{stabilityThreshold:500,pollInterval:200},…})
 *
 * Each `|`-separated segment of the matcher is a WATCH PATH, joined against the
 * session's cwd when relative, and `if(w.length===0)return` — a `FileChanged`
 * entry with no matcher contributes no path, so a registration with only such
 * an entry never fires at all. That is the opposite of the matcher's meaning on
 * every other event, and it is why this project's other new registrations carry
 * no matcher and this one carries two entries.
 *
 * **The second entry is the one that runs.** At DISPATCH the same string is
 * used again, and used differently (byte 317139714):
 *
 *     case"FileChanged":a=ues.basename(n.file_path);break;
 *     …
 *     let d=(a?s.filter((x)=>!x.matcher||cEE(a,x.matcher,l,c)):s)
 *
 * The query is the file's BASENAME, `FileChanged` is absent from the set that
 * allows the comma/space literal form (`aEE`, byte 317176590), so a matcher
 * containing a dot or a slash falls through to `new RegExp(matcher)` and is
 * tested against `CONST-x.md`. `.my_context/items` cannot match that, so the
 * watch-path entry declares paths and never dispatches, and the entry with NO
 * matcher — which `!x.matcher` admits unconditionally — is what spawns this
 * binary. Two entries for one event is not a second spelling; it is one string
 * the platform reads twice with two meanings, and neither reading can be
 * dropped.
 *
 * ── THE FEEDBACK LOOP THIS FILE EXISTS INSIDE ──────────────────────────────
 *
 * **The audit log lives under `.my_context/`, and this hook writes to the audit
 * log.** Watching the workspace directory whole would mean: append a row → the
 * watcher sees `.audit/audit.jsonl` change → this hook runs → it appends a row.
 * That is not a slow leak, it is a running program that never stops. It is cut
 * in two independent places, deliberately, because either one alone would be a
 * single point of failure for an unbounded loop:
 *
 *  1. The manifest watches `.my_context/items` and `.my_context/config.json`
 *     and nothing else — the log, the index, the seen files and the snapshots
 *     are outside the watch set entirely.
 *  2. `INTERESTING` below re-checks it on the payload, so a watch path widened
 *     by any other means (a `SessionStart` hook returning `watchPaths`, a user's
 *     own `FileChanged` entry, a future default) still cannot start the loop.
 *
 * ── WHAT IT DOES NOT DO ────────────────────────────────────────────────────
 *
 * It does not rebuild, repair, validate or re-index. The rebuild already
 * happens on every open, and anything more — reconciling a hand edit against
 * the checksum, refusing it, repairing it — is a behaviour change to the
 * corpus that nobody has ruled. It also cannot tell a hand edit from
 * my_context's OWN write: the payload carries a path and a verb and nothing
 * about the writer, so a `mycontext create` leaves a `create` mutation row and
 * a `file-changed` row beside it. That duplication is real, it is the cost of
 * the only channel that sees an editor, and it is stated here rather than
 * discovered in the log.
 */

/**
 * The two places inside the workspace whose changes are worth a row, as
 * workspace-relative POSIX prefixes.
 *
 * `items/` is the corpus. `config.json` is the user's file — and it is worth
 * noting exactly where, because it is easy to assume the other new hook covers
 * it: `ConfigChange`'s five sources are `user_settings`, `project_settings`,
 * `local_settings`, `policy_settings` and `skills` (build 2.1.239, byte
 * 303345900). None of them is `.my_context/config.json`. That event watches
 * Claude Code's own settings and can never see this file, so `FileChanged` is
 * the only event in the platform that can.
 */
function interesting(rel: string): boolean {
  return rel === 'config.json' || rel.startsWith('items/');
}

/** `file_path` relative to the WORKSPACE directory, or `null` when outside it. */
function workspaceRelative(root: string, filePath: string): string | null {
  const abs = path.resolve(filePath);
  if (path.isAbsolute(path.relative(root, abs))) return null;
  const rel = relPosix(root, abs);
  if (rel === '' || rel === '..' || rel.startsWith('../')) return null;
  return rel;
}

/** `change | add | unlink`, the three the schema declares. */
export const FILE_CHANGED_EVENTS = ['change', 'add', 'unlink'] as const;

export function observeFileChanged(input: HookInput, root: string): Observation | null {
  if (typeof input.file_path !== 'string' || input.file_path === '') return null;
  // `toPosix` first so a Windows payload and a POSIX one take the same branch,
  // exactly as `post-tool-use.ts` normalises before its managed check.
  const rel = workspaceRelative(root, toPosix(input.file_path));
  if (rel === null || !interesting(rel)) return null;

  // Absent rather than defaulted, the rule `post-compact.ts` states for
  // `trigger`: inventing one of the three for a payload that carried none would
  // put a claim in the log that no payload supports.
  const verb = typeof input.event === 'string' && input.event !== '' ? input.event : '<absent>';
  const known = (FILE_CHANGED_EVENTS as readonly string[]).includes(verb);

  return {
    path: rel,
    note:
      `event=${verb}${known ? '' : ` (not one of ${FILE_CHANGED_EVENTS.join(', ')})`}; ` +
      'the corpus changed on disk. Nothing was rebuilt — the index is a projection and is ' +
      'rebuilt on every open — and this row cannot say whether the writer was my_context',
  };
}

export const FILE_CHANGED: ObservationSpec = {
  hook: 'FileChanged',
  op: 'file-changed',
  observe: observeFileChanged,
};

if (isMainEntry(import.meta.filename, process.argv[1])) runObservationHook(FILE_CHANGED);
