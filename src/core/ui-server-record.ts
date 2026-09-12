/**
 * Where a UI server said it was listening — `~/.my-context/ui-server.json`,
 * beside `ui-sessions.json` and written the same way.
 *
 * ── A HINT, NOT A MEASUREMENT ──────────────────────────────────────────────
 *
 * **This file is a claim, and a claim is not a measurement.** A server that was
 * killed, or that crashed, leaves its record behind untouched; and a pid is
 * reused, so even `process.kill(pid, 0)` succeeding proves only that SOMETHING
 * holds that number. Liveness is therefore PROVED by connecting to the port —
 * `ui-server-probe.ts` does that, and nothing in this module attempts it. What
 * is stored here is only the address to aim the proof at.
 *
 * That is why every read here is all-or-nothing. A file that does not parse,
 * that declares a `version` this build does not write, or that is missing any
 * one field, degrades to `null` rather than to a partly-trusted object. The
 * alternative is the failure worth naming: a record read half-way — right port,
 * absent host, say — would send the probe to a port nobody is listening on, the
 * connect would be refused, and the mechanism would conclude a server had DIED
 * when in fact it never existed. It would then clear a record it never
 * understood and spawn against a configuration it had guessed at. `null` says
 * "there is nothing here to aim at", which is exactly true and is the one
 * answer that cannot mislead the step after it.
 *
 * The same argument in the other direction is why a future `version` is not
 * read leniently. Guessing at a shape a later build writes is how a store
 * silently starts honouring the wrong thing — `ui-sessions.ts` refuses for that
 * reason and this refuses for the same one.
 *
 * ── WHY THE GLOBAL DIRECTORY, NEVER A REPOSITORY ───────────────────────────
 *
 * This is machine state. A pid, a port and a URL are true of ONE process on ONE
 * machine, and a pid committed to git means something else entirely on the next
 * one. `.my_context/` is tracked in this corpus, so a record written there is a
 * record that travels; `GLOBAL_DIR` is not, and does not.
 *
 * It also keeps `test/ui/server-e2e.test.ts` honest: that suite snapshots every
 * byte under the workspace and asserts the read surface changes none of them.
 *
 * `MYCONTEXT_UI_SESSIONS_DIR` overrides the directory when no root is passed.
 * The existing variable rather than a second one of its own, deliberately:
 * both files live in the same directory, the test preload
 * (`test/helpers/pin-rendering.ts`) already pins that variable to a temporary
 * directory for the whole suite, and a new name would be a new thing to
 * remember to pin — which is precisely the convention that failed on
 * 2026-08-22, when fixtures reached the real `~/.my-context` and turned 134
 * unrelated tests red with a message pointing nowhere near the cause. Reusing
 * it means every caller that passes no root is already sandboxed.
 */
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { sleepMs } from './sleep.ts';
import { GLOBAL_DIR } from './workspace.ts';

/** The file, inside the resolved global root. */
const RECORD_FILE = 'ui-server.json';

/** The current schema. A file declaring anything else is not read. */
const VERSION = 1;

export interface UiServerRecord {
  version: 1;
  pid: number;
  host: string;
  /** The BOUND port, never the requested one: the CLI's default is 0. */
  port: number;
  url: string;
  /** Epoch ms, so staleness needs no date parsing. */
  startedAt: number;
  workspace: string;
}

/**
 * An explicit root wins; otherwise the override; otherwise the real one. Read
 * per call rather than captured at import, so a test may set it late — the
 * habit `sessionsDir()` established, and the reason a module-level constant is
 * not used here.
 */
function recordDir(globalRoot?: string): string {
  if (globalRoot !== undefined && globalRoot !== '') return globalRoot;
  const override = process.env['MYCONTEXT_UI_SESSIONS_DIR'];
  return override !== undefined && override !== '' ? override : GLOBAL_DIR;
}

/** The record's absolute path. */
export function uiServerRecordPath(globalRoot?: string): string {
  return path.join(recordDir(globalRoot), RECORD_FILE);
}

/**
 * The rename failures that are a MOMENT rather than a verdict.
 *
 * On Windows `renameSync` is `MoveFileEx`, which refuses with `EPERM`,
 * `EACCES` or `EBUSY` while anything else holds the destination open in a
 * conflicting share mode. `rebuild.ts` names the same three codes for the same
 * reason; POSIX rename has no such failure mode, so nothing below ever fires
 * there. Every other code — a parent that is a file, a read-only volume, a full
 * disk — is a verdict, and is rethrown untouched on the first attempt.
 */
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);

/**
 * The pause before the ONE retry.
 *
 * Fifty milliseconds, and the number comes from the case this exists for: the
 * record is written in the seconds after a restart, which is exactly when the
 * PREVIOUS server's `close` listener is removing the same file and the old
 * process still holds a handle on it. That window is a scheduler tick or two,
 * not a second — `rebuild.ts` clears the same contention with 20ms on its first
 * backoff — and fifty is that with room, still far below anything a person
 * waiting for a page could perceive.
 */
const RENAME_RETRY_MS = 50;

/**
 * Rename, and on a TRANSIENT failure wait once and try exactly once more.
 *
 * ── WHY ONCE, AND NOT `retryOnTransientFsError`'S FIVE ─────────────────────
 *
 * `rebuild.ts` has a general five-attempt version of this, and it is the right
 * policy there: it is writing the corpus, the caller is a command, and a failed
 * item write loses authored knowledge. This write loses a HINT — the caller is
 * a server's `listen` callback with a person waiting on the other side of it,
 * and the product here is not the file but the DISCLOSURE that the file is
 * missing. A loop that keeps trying is a loop that delays the sentence, and a
 * long enough one would swallow it: measured on 2026-08-28, the failure that
 * mattered was one transient `EPERM` during a restart, which one retry clears.
 * So: retry once, then hand the failure to the caller to say out loud.
 *
 * It is also why this is not an import. `ui-server-record.ts` is read on the
 * `Stop` hook path through `ui-server-probe.ts`, on a 3-second hook budget, and
 * `rebuild.ts` pulls in the item parser, the config types and the path
 * normaliser to reach ten lines of retry.
 *
 * Exported, and taking the operation as a parameter, for `rebuild.ts`'s own
 * stated reason: a genuine Windows `EPERM` from a competing file handle cannot
 * be manufactured reliably in a unit test on any platform, so the policy —
 * retry a transient code, rethrow anything else, and give up after exactly one
 * retry — is exercised directly with a fake operation.
 */
export function retryTransientRenameOnce<T>(rename: () => T): T {
  try {
    return rename();
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    // Not transient: this is the answer, not a moment. Rethrown unchanged so
    // the caller's disclosure carries the real reason.
    if (code === undefined || !TRANSIENT_RENAME_CODES.has(code)) throw err;
  }
  sleepMs(RENAME_RETRY_MS);
  // The second attempt is the last one. Whatever it throws is thrown as-is —
  // there is no third, and no path from here that reports success.
  return rename();
}

/**
 * Write the record, atomically.
 *
 * Temp-plus-rename, the shape `ui-sessions.ts` and `rebuild.ts` both use: a
 * crash midway leaves the previous record intact rather than a truncated one.
 * That matters more here than it looks, because a truncated record does not
 * read as broken to a careless reader — it reads as a DIFFERENT server. The
 * all-or-nothing read above is the second half of the same guarantee; this is
 * the half that keeps the half-written file from existing in the first place.
 *
 * The temp name carries the pid because two servers on one machine — different
 * ports, different workspaces — may write within microseconds of each other,
 * and a shared `.tmp` would let one rename the other's half-written bytes into
 * place. `ui-sessions.ts` uses a bare `.tmp`; it is written once per server
 * start against a store both would be appending to anyway, so the collision it
 * risks is a lost digest rather than a wrong address.
 *
 * **This one throws, unlike its neighbours in `ui-sessions.ts`.** It returns
 * `void`, so it has no channel to report a failure in, and swallowing one would
 * be a silent drop — the failure this project refuses. The caller decides:
 * `src/ui/server.ts` catches, because a server that cannot write its own record
 * must still serve.
 *
 * **The rename is retried once before it is allowed to fail**, and that is not
 * defensive tidiness: on 2026-08-28 this write lost a race with the server it
 * was replacing — the old process still held the file, `MoveFileEx` answered
 * `EPERM`, and the record was absent for the rest of that server's life. See
 * `retryTransientRenameOnce`, which also says why the bound is one and not the
 * five its sibling in `rebuild.ts` allows.
 */
export function writeUiServerRecord(record: UiServerRecord, globalRoot?: string): void {
  const target = uiServerRecordPath(globalRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    retryTransientRenameOnce(() => renameSync(tmp, target));
  } catch (err) {
    // Leave no orphan behind on the way out. Best-effort: the original failure
    // is the one worth reporting, and it is about to be.
    try { rmSync(tmp, { force: true }); } catch { /* nothing to clean up */ }
    throw err;
  }
}

/**
 * The record, or `null` — including for every way the file can be wrong.
 *
 * Never throws. This is read from a `Stop` hook that must exit 0 and from a
 * server's start path, and neither has anything useful to do with an exception
 * that means "there is no server to talk to".
 */
export function readUiServerRecord(globalRoot?: string): UiServerRecord | null {
  let raw: string;
  try {
    raw = readFileSync(uiServerRecordPath(globalRoot), 'utf8');
  } catch {
    // No file is the ordinary case — no server has ever run here, or the last
    // one cleaned up after itself. Not an error.
    return null;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  // An array parses as an object and would answer `undefined` to every field
  // below, so it is ruled out by name rather than left to the field checks.
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const value = parsed as Record<string, unknown>;
  if (value['version'] !== VERSION) return null;

  // `Number.isFinite` and not merely `typeof`: JSON has no NaN, but `1e999`
  // parses to Infinity, and an infinite port is a value every later comparison
  // accepts and no socket can use.
  const num = (key: string): number | null => {
    const found = value[key];
    return typeof found === 'number' && Number.isFinite(found) ? found : null;
  };
  const str = (key: string): string | null => {
    const found = value[key];
    return typeof found === 'string' ? found : null;
  };

  const pid = num('pid');
  const port = num('port');
  const startedAt = num('startedAt');
  const host = str('host');
  const url = str('url');
  const workspace = str('workspace');

  // One field short is the whole record short. See the module comment: a
  // partly-read record aims the probe at nothing and reports a death.
  if (pid === null || port === null || startedAt === null
    || host === null || url === null || workspace === null) return null;

  return { version: VERSION, pid, host, port, url, startedAt, workspace };
}

/**
 * **Who a record must name before it may be removed.**
 *
 * `pid` alone is not enough and the reason is the module header's own: a pid is
 * reused, so a record left by a server that died can be "confirmed" by whatever
 * the operating system handed that number to next. `port` alone is not enough
 * either, and that is the case this project actually runs into — the node suite
 * and the lanes start several servers inside ONE process, so every one of them
 * has the same `pid` and only the bound port tells them apart. Both, together,
 * are what identify a listening server on a machine.
 */
export interface UiServerIdentity {
  pid: number;
  /** The BOUND port, read back from `server.address()` — never the requested one. */
  port: number;
}

/**
 * What `clearUiServerRecord` did, said out loud rather than returned as a
 * boolean nobody can read at the call site.
 *
 * `no-record` covers a file that is absent AND one that does not parse, because
 * `readUiServerRecord` deliberately answers `null` to both (see the module
 * header) and neither can be shown to name the caller. Nothing is removed for
 * either, which is the safe reading: a record that cannot be understood cannot
 * be proved to be mine, and the upkeep's next spawn overwrites it anyway.
 */
export type ClearOutcome =
  /** The record named this server, and is gone. */
  | 'removed'
  /** There was nothing there to remove, or nothing readable. */
  | 'no-record'
  /** A record is there and it names a DIFFERENT server. Left exactly as it was. */
  | 'names-another-server';

/**
 * Remove the record — **only if it still names the server the caller names.**
 *
 * ── THE DEFECT THIS EXISTS FOR, MEASURED 2026-09-12 ────────────────────────
 *
 * This used to take a root and nothing else, and it removed the file. The file
 * is ONE per user (the module header argues why, and that argument stands), so
 * "remove the record" and "remove MY record" are different operations that
 * looked identical at every call site. `src/ui/server.ts` wanted the second and
 * called the first from a `close` listener: server A shutting down AFTER server
 * B had started and written its own record deleted B's record. B was listening,
 * answering 200, and invisible — nothing could find it, so the upkeep hook
 * would not put it back when it finally exited. The owner spent a morning
 * reporting a server that was going down "again and again" and was in fact up
 * the whole time.
 *
 * So the identity is a REQUIRED first parameter, not an option with a default.
 * Every existing caller had to answer the question, and every future one has to
 * — which is the same argument the `close` listener's own comment makes about
 * having one listener rather than a copy per route: correctness that lives in
 * one place cannot drift, and a caller cannot forget a parameter the type
 * system asks it for. The alternative considered and rejected was a check at
 * `src/ui/server.ts`'s call site, which leaves this function honest to a name
 * no caller can obey safely and puts the guard exactly where the next caller
 * will not look.
 *
 * ── THE SAME CHECK THE KILL PATH ALREADY MAKES ────────────────────────────
 *
 * `ui-server-upkeep.ts` re-reads this record immediately before it signals a
 * pid and declines with `replaced-elsewhere` if it no longer names the pid the
 * probe proved (2026-09-11). That is this check, at the other end of the same
 * mechanism: **nothing acts on a record it has not just re-read.** The clear
 * path was the half that did not ask.
 *
 * ── WHAT IT DOES NOT CLOSE, SAID RATHER THAN IMPLIED ──────────────────────
 *
 * Read-then-remove is two syscalls and there is no compare-and-delete in the
 * filesystem, on Windows least of all. A server that writes its record in the
 * gap between the read and the `rmSync` still loses it. What the check removes
 * is the WINDOW that was the whole lifetime of a process — A's `close` firing
 * minutes after B started — and what it leaves is a window of microseconds that
 * the atomic temp-plus-rename write above already makes the loser of a race
 * rather than a corruption. The probe's window was the wider of the two and is
 * now bounded the same way: it passes the identity it disproved, so a
 * replacement that arrives during its 250ms connect keeps its record.
 *
 * Never throws, for the reason it never did: a closing server and a probe that
 * has just disproved a stale record can race here, and the loser must not turn
 * a hook red for arriving second. An unremovable file answers `no-record` for
 * the same reason — there is then nothing this process can do about it, and
 * saying so is not the same as pretending it removed something.
 */
export function clearUiServerRecord(
  owner: UiServerIdentity, globalRoot?: string,
): ClearOutcome {
  const record = readUiServerRecord(globalRoot);
  if (record === null) return 'no-record';
  // BOTH, and the conjunction is the point: see `UiServerIdentity`. `pid` alone
  // is defeated by recycling, `port` alone by a machine that reuses a port.
  if (record.pid !== owner.pid || record.port !== owner.port) return 'names-another-server';
  try {
    rmSync(uiServerRecordPath(globalRoot), { force: true });
  } catch {
    /* unremovable — nothing this process can do, and nothing it may claim */
    return 'no-record';
  }
  return 'removed';
}
