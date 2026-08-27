import { mkdirSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { retryOnTransientFsError } from './rebuild.ts';
import { readSeen, SEEN_FILE_SUFFIX, seenFilePath, seenIds } from './seen-file.ts';
import { readSessionNames } from './session-names.ts';

// --- What a new session carries forward, and from where ---------------------
//
// One workspace-scoped choice (`state/continuity.json`) plus one rule for when
// nobody has made it, resolved into the `SelectContext.carried` shape
// `core/select.ts` consumes. Nothing here decides what a carried id DOES to the
// index — that is §6n.2 and it lives in `buildIndex`. This module answers only
// "whose ids, and what do we call that session".
//
// **WHERE THE IDS COME FROM, AND THE COST OF THAT.** They come from the source
// session's seen file, not from the audit projection. The survey recommended
// the projection; `core/audit.ts` · `the hook path calls this` · ~747 is why
// this does not follow it — `readAudit` reads whole files and is documented as
// off the hook path, and this read happens inside a `SessionStart` bounded at
// 500 ms. The seen file holds the three delivery tiers, is one small file, and
// `readSeen` already never throws.
//
// The cost, named rather than left to be discovered: **an item the source
// session only ever saw as an INDEX LINE is not carried.** The seen file
// records deliveries (`pinned`, `jit`, `restored`), and an index line is not a
// delivery — `core/seen-file.ts` · `const TIERS = new Set<string>(['pinned', 'jit', 'restored']);` · ~38
// refuses one. So what is carried is what that session actually HAD in context,
// which is the stronger evidence anyway.
//
// **NEVER THROWS, AND NEVER REPORTS A CARRY IT CANNOT MAKE.** Both halves are
// load-bearing and they fail in opposite directions. A throw here would end a
// `SessionStart` over a file the user can delete, which `INV-hooks-fail-open`
// forbids; so every path returns `null` and the session simply carries nothing.
// But `null` is also the answer whenever the ids come back EMPTY — a source
// whose seen file was swept, or cannot be parsed. Returning `{ ids: [] }` there
// would be a carry that reports success and delivers nothing, and Task 19's
// disclosure would say so in the injected block: the silent failure this
// module's whole return type exists to make unrepresentable.

export const CONTINUITY_PROTOCOL = 'mycontext-continuity/1';

/**
 * How many characters of a session id make a label.
 *
 * Exported so `mycontext session list`'s `short` column and the carry
 * disclosure's fallback label are the SAME prefix. Two spellings of this
 * number would print two different handles for one session, and the user would
 * have no way to know which one to type back.
 */
export const SESSION_SHORT_ID = 8;

/** What a previous session had, and what to call that session. */
export interface CarrySelection {
  sessionId: string;
  /** The session's name when it has one, its short prefix when it does not. */
  label: string;
  ids: string[];
}

/**
 * The choice on disk, and why there is none — never one silently standing in
 * for the other. Same shape as `SessionNamesState` and `FocusState`, for the
 * same reason.
 *
 * `chosen === false` is "nobody has chosen", which falls through to the
 * default. `chosen === true` with `source === null` is `mycontext session
 * carry --none`: an explicit "carry nothing", which must NOT fall through — a
 * user who turned the carry off and got the default back would have no way to
 * turn it off at all.
 */
export interface CarrySource {
  source: string | null;
  chosen: boolean;
  /** The file exists and cannot be trusted. The default is used and this is said. */
  error: string | null;
}

/** `root` is the `.my_context` directory. */
export function carrySourcePath(root: string): string {
  return path.join(root, 'state', 'continuity.json');
}

function reason(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Reads the chosen carry source. **Never throws**, and degrades to "nobody has
 * chosen" on anything it cannot read — a corrupt file costs the CHOICE, never
 * the session.
 *
 * The error is a CLAUSE completing "`.my_context/state/continuity.json` …", so
 * the caller owns how the path is spelled — `readSessionNames` does the same.
 */
export function readCarrySource(root: string): CarrySource {
  const none = (error: string | null): CarrySource => ({ source: null, chosen: false, error });

  let raw: string;
  try {
    raw = readFileSync(carrySourcePath(root), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return none(null);
    return none(`could not be read (${reason(err)})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return none(`is not valid JSON (${(err as Error).message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return none('is not a JSON object');
  }

  const store = parsed as { protocol?: unknown; source?: unknown };
  if (store.protocol !== CONTINUITY_PROTOCOL) {
    return none(`declares protocol ${JSON.stringify(store.protocol)}, not ${CONTINUITY_PROTOCOL}`);
  }
  // `null` is the explicit "carry nothing" and is the only non-string accepted.
  // A number or an object here is a file this build cannot act on, and acting
  // on half of it would be a carry from a session nobody named.
  if (store.source === null) return { source: null, chosen: true, error: null };
  if (typeof store.source !== 'string' || store.source === '') {
    return none(`carries no usable "source" (${JSON.stringify(store.source)})`);
  }
  return { source: store.source, chosen: true, error: null };
}

/**
 * The default source: **the most recent parent session other than the current
 * one**, by mtime over `state/*.seen.jsonl`.
 *
 * **Excluding the current id is not optional.** On a resume the current session
 * is already the most recent thing in `state/`, so without the exclusion the
 * default is always "carry from yourself" — every id already delivered to this
 * window, marked as though it came from somewhere else. The exclusion is by
 * FILENAME rather than by id string, so it survives `sanitizeSessionId`'s fold.
 *
 * **Sibling files are excluded by the `__` in their stem**, which is what
 * `sanitizeSessionId` turns the `::` of a `session::agent` key into
 * (`core/ledger.ts` · `export function sanitizeSessionId(sessionId: string): string {` · ~699).
 * A subagent's dedupe file holds what one agent was handed, filed under a key
 * no `mycontext audit --session` query names; it is not a session anybody can
 * carry from. The residual, said rather than hidden: a session whose own id
 * folds to contain `__` is excluded too. That costs a carry, never a wrong
 * carry, which is this module's direction everywhere.
 *
 * **Why `state/` mtimes here and the audit projection in `session list`.** Two
 * surfaces, two budgets: the hook must not open a database, the CLI may. They
 * can disagree — a session the log names whose seen file was swept at 30 days
 * is not carryable — and `session list`'s `carryable` column is where that
 * disagreement is shown rather than hidden.
 */
function mostRecentOtherSession(root: string, currentSessionId: string | null): string | null {
  const dir = path.join(root, 'state');
  let names: string[];
  try {
    names = readdirSync(dir);
  } catch {
    // No `state/` at all: a workspace where no hook has ever run. Nothing to
    // carry, and not an event.
    return null;
  }

  const mine = currentSessionId === null || currentSessionId === ''
    ? null
    : path.basename(seenFilePath(root, currentSessionId));

  let best: { key: string; at: number; name: string } | null = null;
  for (const name of names) {
    if (!name.endsWith(SEEN_FILE_SUFFIX)) continue;
    if (name === mine) continue;
    const stem = name.slice(0, -SEEN_FILE_SUFFIX.length);
    if (stem.includes('__')) continue;
    let at: number;
    try {
      at = statSync(path.join(dir, name)).mtimeMs;
    } catch {
      // A file that vanished between the listing and the stat is not a source
      // and is not a failure either.
      continue;
    }
    // The name breaks an mtime tie, so two files written inside one filesystem
    // tick resolve the same way on every run rather than on directory order.
    if (best === null || at > best.at || (at === best.at && name < best.name)) {
      best = { key: stem, at, name };
    }
  }
  return best?.key ?? null;
}

/**
 * The label a reader sees. **Nothing is invented.**
 *
 * The session's name when a person gave it one, and its short prefix when they
 * did not — the same prefix `mycontext session list` prints in its `short`
 * column. A derived label ("the session from Tuesday") can be wrong, and this
 * string goes into an injected block where a reader cannot check it.
 */
function labelFor(root: string, sessionId: string): string {
  const named = readSessionNames(root).names.get(sessionId);
  return named?.name ?? sessionId.slice(0, SESSION_SHORT_ID);
}

/**
 * The one resolution both entry points share: the chosen source when there is
 * one, the caller's default when there is not, and `null` for every way that
 * can fail. **Never throws.**
 *
 * `defaultSource` is a thunk rather than a value because the session default
 * costs a `readdirSync` and a `statSync` per file, and an explicit choice
 * makes it unnecessary. `exclude` is the session that must never be its own
 * source; the subagent event passes `null`, because the id it resolves from is
 * its parent's and excluding it is the defect this shape exists to fix.
 */
function carryFrom(
  root: string, defaultSource: () => string | null, exclude: string | null,
): CarrySelection | null {
  try {
    const chosen = readCarrySource(root);
    // An explicit `--none` stops here. It is the one case where "no source" is
    // an answer rather than an absence, and falling through to the default
    // would make `mycontext session carry --none` do nothing at all. It stops
    // BOTH entry points: a kill switch that one event ignored would leave a
    // user who turned the carry off getting one on every subagent dispatch.
    if (chosen.chosen && chosen.source === null) return null;

    const sessionId = chosen.source ?? defaultSource();
    if (sessionId === null || sessionId === '') return null;
    if (exclude !== null && sessionId === exclude) return null;

    // Computed from the ids the seen file YIELDS, not from the file's
    // existence: a file that exists and parses to nothing carries nothing, and
    // an unreadable one carries nothing either (`readSeen` returns no lines and
    // an error rather than throwing). Saying "carried from X" about any of
    // those would be a disclosure of a delivery that never happened.
    const ids = seenIds(readSeen(root, sessionId));
    if (ids.length === 0) return null;

    return { sessionId, label: labelFor(root, sessionId), ids };
  } catch {
    // The backstop. Every branch above is already non-throwing by contract;
    // this is what keeps a contract that changes underneath from ending a
    // session — `INV-hooks-fail-open`.
    return null;
  }
}

/**
 * What this session should carry, or `null` when there is nothing to carry.
 * **Never throws.**
 *
 * `currentSessionId` is the session this injection is FOR — `null` on a path
 * that has no session id at all. It is excluded as a source whether it was
 * chosen explicitly or reached by default: carrying from yourself is a no-op
 * that reports success, and reporting it is the failure, not the no-op.
 *
 * **Not for the SubagentStart event** — see `resolveSubagentCarry`. That
 * payload's `session_id` is the PARENT's, so this function's exclusion would
 * throw away the one session a child should continue.
 *
 * `root` is the `.my_context` directory.
 */
export function resolveCarry(root: string, currentSessionId: string | null): CarrySelection | null {
  return carryFrom(root, () => mostRecentOtherSession(root, currentSessionId), currentSessionId);
}

/**
 * What a SUBAGENT should carry: **its parent's session, named, not ranked.**
 * **Never throws.**
 *
 * `parentSessionId` is the `session_id` a SubagentStart payload carries, which
 * is the PARENT's — a subagent has no session id of its own
 * (`core/inject.ts` · `const subagent = options.event === 'subagent';` · ~199).
 *
 * **Why this is a separate entry point rather than a call to `resolveCarry`.**
 * Passing that payload's id as `currentSessionId` excludes it, so the default
 * fell through to "the most recent OTHER session" — an unrelated window's ids,
 * hoisted in front of the child's index under a label naming a session nobody
 * in that dispatch was ever in. The owner ruled on 2026-08-22 that the parent
 * is exactly the session a child should continue. This is the same shape of
 * divergence as the `/clear` handler's `!subagent` gate
 * (`core/inject.ts` · `const clearNote = clearing && !subagent && sessionId !== undefined` · ~378),
 * and it is here for the same reason: on this one event the id in hand belongs
 * to somebody else.
 *
 * **What did NOT change: precedence.** An explicit `mycontext session carry
 * <id>` still wins and `--none` still turns the carry off. The ruling replaced
 * the DEFAULT — which session is continued when nobody said — and a second
 * precedence order on this event would make one command mean two things.
 *
 * **There is no fallback to recency.** A parent with no dedupe state left on
 * disk carries nothing: `null` here, and the injected block simply has no carry
 * line. A carry a reader cannot trace back to their own dispatch is worse than
 * no carry, which is this module's direction everywhere.
 */
export function resolveSubagentCarry(
  root: string, parentSessionId: string | null,
): CarrySelection | null {
  return carryFrom(root, () => parentSessionId, null);
}

let writeCounter = 0;

/**
 * Chooses the carry source, or turns the carry off with `null`.
 *
 * **Never throws** — every failure comes back as `{ written: false, error }`,
 * because the caller is a command that has to print one line and return an exit
 * code.
 *
 * **Written whole, temp file then rename**, through `retryOnTransientFsError`,
 * so a reader sees the whole old file or the whole new one and a Windows
 * sharing violation on the rename is waited out rather than lost.
 *
 * **No lock, unlike `setSessionName`, and the difference is the shape of the
 * write rather than an oversight.** That store is a read-modify-write over
 * entries belonging to OTHER sessions, so two unserialized writers drop one of
 * them with no error anywhere. This file holds ONE value under ONE key: two
 * writers resolve last-writer-wins, which is the correct answer for a setting
 * and is what a user typing the command twice expects.
 *
 * The id is NOT checked against the sessions that exist. That check belongs to
 * the CLI, which has the audit log open and can refuse with a listing
 * (`mycontext session carry <id>`); doing it here would mean this module
 * enumerating sessions on a write path that only ever stores a string.
 */
export function setCarrySource(
  root: string, sessionId: string | null,
): { written: boolean; error: string | null } {
  if (sessionId === '') {
    return {
      written: false,
      error: 'my_context: a carry source has to be a session id. Nothing here guesses which ' +
        'session you mean — `mycontext session list` prints every id, and ' +
        '`mycontext session carry --none` is how you turn the carry off.',
    };
  }

  const target = carrySourcePath(root);
  const dir = path.dirname(target);
  const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
  try {
    mkdirSync(dir, { recursive: true });
    // Beside the file, on every write: `state/` may have no `.gitignore` yet if
    // no snapshot has ever been written here, and a session id that reaches git
    // travels with the corpus into every checkout.
    writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');

    const body = `${JSON.stringify({
      protocol: CONTINUITY_PROTOCOL, source: sessionId, at: new Date().toISOString(),
    }, null, 2)}\n`;
    try {
      writeFileSync(tmp, body, 'utf8');
      retryOnTransientFsError(() => renameSync(tmp, target));
    } catch (err) {
      rmSync(tmp, { force: true });
      throw err;
    }
    return { written: true, error: null };
  } catch (err) {
    return {
      written: false,
      error: `my_context: the carry source could not be written (${reason(err)}), so nothing ` +
        `was recorded.`,
    };
  }
}
