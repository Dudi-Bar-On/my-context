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
 */
export function writeUiServerRecord(record: UiServerRecord, globalRoot?: string): void {
  const target = uiServerRecordPath(globalRoot);
  const tmp = `${target}.tmp-${process.pid}`;
  try {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(tmp, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    renameSync(tmp, target);
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
 * Remove the record.
 *
 * Never throws, and an absent file is success rather than failure: the goal
 * state is "no record", and both callers are already in it when the file is
 * gone. A closing server and a probe that has just disproved a stale record can
 * race here, and the loser must not turn a hook red for arriving second.
 */
export function clearUiServerRecord(globalRoot?: string): void {
  try {
    rmSync(uiServerRecordPath(globalRoot), { force: true });
  } catch {
    /* already gone, or unremovable — either way there is nothing to aim at */
  }
}
