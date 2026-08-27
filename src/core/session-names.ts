import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { acquireLock } from './lock.ts';
import { retryOnTransientFsError } from './rebuild.ts';

// --- The session-name store -------------------------------------------------
//
// One workspace-scoped JSON file mapping a SESSION ID to the name a person
// gave that session, so `mycontext session list` can print something a human
// recognises and every session selector can be spelled with a word instead of
// a hex prefix.
//
// **Why a new store, and why it is workspace-scoped.** `core/focus.ts` ·
// `has a trustworthy session id: the CLI runs in a terminal and is handed none,` · ~25
// is the precedent: no writable surface knows which session it is in, so focus
// retreated to one file per workspace — `core/focus.ts` ·
// `export function focusPath(root: string): string {` · ~285. A session name
// cannot take that escape, because telling one session from another *within* a
// workspace is the entire point of the name. So the file is workspace-scoped
// and the **key is explicit**: the caller always supplies the id, and nothing
// in this module ever guesses which session is "the current one".
//
// **The key is the RAW session id, not `sanitizeSessionId`'s spelling.** That
// function exists to make an id safe as a FILENAME (`core/ledger.ts` ·
// `export function sanitizeSessionId(sessionId: string): string {` · ~667), and
// it is deliberately non-injective in the cheap direction — it folds. Here the
// id is a JSON key inside one file, so there is nothing to make safe and
// folding would merge two sessions into one label.
//
// **It lives under `state/`, which is gitignored generated state.** A session
// id is an identifier of one person's machine and one afternoon's work; a name
// file that reached git would travel with the corpus into every checkout. The
// `.gitignore` is written beside the store on every write for the reason
// `core/ledger.ts` · `writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');` · ~752
// writes it beside a snapshot: `state/` may not have one yet, because nothing
// guarantees a snapshot has ever been written in this workspace.
//
// **`state/` is swept at 30 days by mtime** (`pruneSnapshots`), and this file
// is NOT one of the shapes it sweeps — `.restore.json`, `.seen.jsonl` and
// `*.tmp-*`. Names outlive the sessions they describe on purpose: a name is
// the only human-readable handle on an entry the audit log still carries.

export const SESSION_NAMES_PROTOCOL = 'mycontext-session-names/1';

/** One session's name, and when it was given. */
export interface SessionNameEntry {
  name: string;
  /** ISO-8601, stamped at the write. */
  at: string;
}

/**
 * The longest name this store accepts.
 *
 * A name goes into a table column beside a session id and into an injected
 * disclosure, so it is a label rather than a description. 64 characters is
 * generous for the former and refuses the latter outright — and refusing is
 * the point: see `setSessionName` on why nothing here truncates.
 */
export const SESSION_NAME_MAX = 64;

/** `root` is the `.my_context` directory. */
export function sessionNamesPath(root: string): string {
  return path.join(root, 'state', 'session-names.json');
}

/**
 * What is on disk, and what went wrong reading it — both, never one silently
 * standing in for the other. Same shape as `FocusState`, for the same reason.
 *
 * `error !== null` means the file exists and cannot be trusted. It never means
 * "there are no names": a workspace where nobody has named a session reads
 * back as an empty map with a null error, which is not an event.
 */
export interface SessionNamesState {
  names: Map<string, SessionNameEntry>;
  error: string | null;
}

interface StoreShape {
  protocol?: unknown;
  names?: unknown;
}

/**
 * Reads the store. **Never throws**, matching `core/seen-file.ts` ·
 * `unreadable seen file means "inject WITHOUT dedupe and disclose"` · ~18: a
 * corrupt name file costs labels, never an injection. Every caller of this is
 * a display surface or a selector; none of them has a reason to end a session
 * over a file the user can delete.
 *
 * The error is a CLAUSE, completing "`.my_context/state/session-names.json`
 * …", so the caller owns how the path is spelled — `focusErrorNote` does the
 * same and for the same reason: an absolute path inside an injected block is
 * noise a reader cannot act on.
 */
export function readSessionNames(root: string): SessionNamesState {
  const empty = (error: string | null): SessionNamesState => ({ names: new Map(), error });

  let raw: string;
  try {
    raw = readFileSync(sessionNamesPath(root), 'utf8');
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return empty(null);
    return empty(`could not be read (${err instanceof Error ? err.message : String(err)})`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return empty(`is not valid JSON (${(err as Error).message})`);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return empty('is not a JSON object');
  }

  const store = parsed as StoreShape;
  if (store.protocol !== SESSION_NAMES_PROTOCOL) {
    return empty(
      `declares protocol ${JSON.stringify(store.protocol)}, not ${SESSION_NAMES_PROTOCOL}`,
    );
  }
  if (typeof store.names !== 'object' || store.names === null || Array.isArray(store.names)) {
    return empty('carries no `names` object');
  }

  const names = new Map<string, SessionNameEntry>();
  const dropped: string[] = [];
  for (const [sessionId, value] of Object.entries(store.names as Record<string, unknown>)) {
    const row = value as Partial<SessionNameEntry> | null;
    if (typeof row?.name !== 'string' || row.name === '') { dropped.push(sessionId); continue; }
    names.set(sessionId, { name: row.name, at: typeof row.at === 'string' ? row.at : '' });
  }

  // A dropped entry is disclosed rather than swallowed: the readable names
  // still work, and the user is told which session lost its label instead of
  // finding an empty cell and concluding they never named it.
  return {
    names,
    error: dropped.length === 0
      ? null
      : `holds ${dropped.length} entr${dropped.length === 1 ? 'y' : 'ies'} this build cannot ` +
        `read, which are not named below: ${dropped.sort().join(', ')}`,
  };
}

/** What a write did, or why it did nothing. Never throws. */
export interface SessionNameWrite {
  written: boolean;
  /** `null` only when `written` is true. */
  error: string | null;
}

const CONTROL = /\p{Cc}/u;

/**
 * Validates a name, **refusing rather than silently normalising**.
 *
 * Every rule below could have been a fix-up — trim it, truncate it, strip the
 * newline — and each fix-up would hand back a name the caller did not type
 * while reporting success. This string is the handle a person uses to select a
 * session, so a name that is nearly what they asked for is worse than a
 * refusal: they will type the one they meant and it will not match.
 *
 * Returns the refusal, or `null` when the name is acceptable.
 *
 * The residual, stated because it is real: surrounding whitespace is NOT
 * trimmed, so `"beta"` and `"beta "` are two different names that render
 * identically in a table. Trimming would be the silent normalisation this
 * function exists to refuse, and refusing surrounding whitespace outright is a
 * fifth rule nobody asked for; what stops it mattering is that the duplicate
 * check below is byte-exact, so the second one is accepted as its own name
 * rather than mistaken for the first.
 */
function refuseName(name: string): string | null {
  if (name.trim() === '') {
    return 'my_context: a session name cannot be empty or only whitespace. It is the handle ' +
      'you select this session by, so it has to be something you can type.';
  }
  if (name.length > SESSION_NAME_MAX) {
    return `my_context: that session name is ${name.length} characters and the limit is ` +
      `${SESSION_NAME_MAX}. It is a label beside a session id in a table, not a description ` +
      `— shorten it rather than letting it be truncated somewhere downstream.`;
  }
  if (CONTROL.test(name)) {
    return 'my_context: a session name cannot contain a control character, a newline or a ' +
      'tab. It is printed inside a table cell and inside an injected disclosure, and either ' +
      'one would be broken by a name that moves the cursor.';
  }
  return null;
}

let writeCounter = 0;

/**
 * Gives `sessionId` the name `name`, replacing whatever name that session had.
 *
 * **Never throws** — a refusal, a lost race and a failed rename all come back
 * as `{ written: false, error }`, because every caller is a command that has
 * to print one line and return an exit code.
 *
 * **The duplicate rule: a name already held by a DIFFERENT session is
 * refused**, and the refusal names the holder and says that renaming it frees
 * the name. Refusing at write is what lets every selector downstream treat a
 * name as unambiguous — the alternative is resolving ambiguity at every
 * lookup, forever, in each surface separately. Re-writing a session the name
 * it already has is not a duplicate and is accepted (it re-stamps `at`).
 *
 * **Write mechanics: temp file then rename**, through
 * `core/rebuild.ts` · `export function retryOnTransientFsError<T>(fn: () => T, attempts = 5): T {` · ~205 —
 * the same shape `writeSnapshot` uses, so a reader sees the whole old store or
 * the whole new one and a Windows sharing violation on the rename is waited
 * out rather than lost.
 *
 * **And the write is SERIALIZED by a lock**, which `writeSnapshot` needs and
 * this does not have the luxury of skipping: a snapshot is written whole by
 * the one process that owns that session, while this file is a read-modify-
 * write over entries belonging to OTHER sessions. Two unserialized writers
 * that both read before either renamed would leave one entry on disk and drop
 * the other with no error anywhere — `INV-nothing-is-dropped-silently` exactly.
 * The lock is `state/session-names.lock`, and `acquireLock` handles a holder
 * that died without releasing it.
 *
 * What the lock does NOT buy, said plainly: two writers naming the SAME
 * session still resolve last-writer-wins. That is the right answer for one
 * value with one key, and `test/core/session-names.test.ts` asserts it rather
 * than pretending the store merges.
 */
export function setSessionName(root: string, sessionId: string, name: string): SessionNameWrite {
  if (sessionId === '') {
    return {
      written: false,
      error: 'my_context: a session name has to be given a session id to attach to. Nothing ' +
        'here guesses which session you are in — the CLI is handed no session id at all.',
    };
  }
  const refusal = refuseName(name);
  if (refusal !== null) return { written: false, error: refusal };

  const target = sessionNamesPath(root);
  const dir = path.dirname(target);

  let release: (() => void) | null = null;
  try {
    mkdirSync(dir, { recursive: true });
    // Beside the store, on every write: `state/` may have no `.gitignore` yet
    // if no snapshot has ever been written here, and a name file that reaches
    // git is a session identifier travelling with the corpus.
    writeFileSync(path.join(dir, '.gitignore'), '*\n', 'utf8');

    release = acquireLock({
      file: path.join(dir, 'session-names.lock'),
      name: 'session-names',
      otherHolder: 'another process is naming a session in this workspace',
    });

    const state = readSessionNames(root);
    // A store that cannot be read is NOT overwritten. Read fails open — the
    // labels are lost, nothing else — but a WRITE over an unreadable file
    // would destroy every name in it to add one, which is a different and
    // much larger loss than the one this module accepts.
    if (state.error !== null && state.names.size === 0) {
      return {
        written: false,
        error: `my_context: \`.my_context/state/session-names.json\` ${state.error}, so no name ` +
          `was written — overwriting it would take every other session's name with it. ` +
          `Delete the file to start over; nothing else depends on it.`,
      };
    }

    const holder = [...state.names.entries()]
      .find(([id, entry]) => entry.name === name && id !== sessionId);
    if (holder) {
      return {
        written: false,
        error: `my_context: the name ${JSON.stringify(name)} is already held by session ` +
          `${holder[0]}. A name identifies one session, so this one is refused rather than ` +
          `resolved — rename that session to free the name.`,
      };
    }

    state.names.set(sessionId, { name, at: new Date().toISOString() });

    const payload: Record<string, SessionNameEntry> = {};
    for (const key of [...state.names.keys()].sort()) {
      payload[key] = state.names.get(key) as SessionNameEntry;
    }
    const body = `${JSON.stringify(
      { protocol: SESSION_NAMES_PROTOCOL, names: payload }, null, 2,
    )}\n`;

    const tmp = `${target}.tmp-${process.pid}-${writeCounter++}`;
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
      error: `my_context: the session name could not be written ` +
        `(${err instanceof Error ? err.message : String(err)}), so nothing was recorded.`,
    };
  } finally {
    try { release?.(); } catch { /* the lock is best-effort on the way out */ }
  }
}
