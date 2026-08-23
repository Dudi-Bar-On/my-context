/**
 * `mycontext ui` — the read-only web UI (spec `2026-08-16-web-ui-design.md`,
 * plan `2026-08-16-web-ui-1-server-and-reads.md` Task 15).
 *
 * The server binds `127.0.0.1` only, refuses to start on any other host, and
 * exits on its own after `IDLE_MS` with no `/api` request other than a stream
 * — so a forgotten background tab does not hold it up (spec §2.3). Every write
 * the UI shows is composed and handed back for the user to paste into their
 * own shell; none executes here, which is what `test/ui/no-writes.test.ts` and
 * `test/ui/server-e2e.test.ts` enforce between them.
 *
 * ── WHY EVERY REFUSAL IN THIS FILE IS SYNCHRONOUS ─────────────────────────
 *
 * `CommandFn` returns a number, and this command's work does not fit in one:
 * the server outlives the call. So `cmdUi` validates EVERYTHING it can before
 * the first `await`-shaped thing happens, and only then starts a server it
 * will not be around to see fail.
 *
 * That ordering is load-bearing, and not only for tidiness.
 * `test/docs/inventory.test.ts` proves every name in the usage banner really
 * dispatches by RUNNING it — `mycontext ui` included — in a scratch directory
 * with no `.my_context` above it. With the workspace check deferred into the
 * promise, that call returns 0, the rejection lands one tick later, and
 * `process.exitCode = 1` is set on the test runner's own process: a suite that
 * passes every assertion and still exits 1. With it here, the command prints
 * one line and returns 1 before anything is started, which is also what
 * `test/docs/counts.test.ts`'s `--yes` probe meets when it reaches this name.
 *
 * ── AND WHY THE FLAG PARSING IS NOT `flag()` ──────────────────────────────
 *
 * `flag(args, 'port')` answers `null` for BOTH "not given" and "given with
 * nothing after it", so `mycontext ui --port` would start on a port the caller
 * did not choose and say nothing — one of the three silent drops Task 13
 * measured in this same command's server-side parser and refused there
 * (`parseServerArgs`, `src/ui/server.ts`). `--port=` is the fourth spelling of
 * the same drop: `Number('')` is `0`, which is a legal value meaning "any free
 * port". Both are refused below, from the occurrences rather than from the
 * collapsed answer.
 */
import { openProjection, syncProjection } from '../../core/audit-db.ts';
import type { Workspace } from '../../core/workspace.ts';
import { IDLE_MS, MAX_IDLE_MS } from '../../ui/idle.ts';
import { openBrowser } from '../../ui/open.ts';
import {
  OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS, startUiServer,
} from '../../ui/server.ts';
import { refuseUnknownFlag } from './format.ts';
import {
  flagOccurrences, hasFlag, registerCommand, repeatedFlagError, type Emit,
} from './registry.ts';

const USAGE = 'usage: mycontext ui [--port N] [--no-open] [--idle-ms N]';

/** The flags this command accepts, and which of them take a following value. */
const UI_FLAGS = ['port', 'no-open', 'idle-ms'];
const UI_VALUE_FLAGS = ['port', 'idle-ms'];

/* ── WHAT USED TO STAND HERE, AND WHY IT DOES NOT ─────────────────────────
 *
 * **The flag this file's previous comment said would arrive, and the sentence
 * it said must move with it. It arrived on 2026-08-23, and it did.**
 *
 * What stood here was a constant, `IDLE_MS / 60_000`, with a warning: "A task
 * that gives this command an `--idle-ms` flag breaks that, and it was measured
 * rather than reasoned about: shortening the window to 1500ms under
 * `scripts/mutate.ts` produced an exit at 1.8s and a line that still read '15
 * idle minutes'. The flag and these sentences move together or not at all."
 *
 * So the constant is gone rather than left beside the flag, and both messages
 * now read the RESOLVED window through `idleMinutesText` — there is still
 * exactly one source for the number and the sentence, and it is now the value
 * actually in force rather than the default that used to be the only value
 * possible. `IDLE_MS` survives as the default `resolveIdleMs` returns when the
 * flag is absent, which is the one thing it was ever really for.
 */

/**
 * `--idle-ms`, the window before an untouched server exits.
 *
 * ── WHY THIS FLAG EXISTS, MEASURED RATHER THAN WANTED ─────────────────────
 *
 * The default is fifteen minutes and it is right for the case it was designed
 * for: a person opens the UI, reads it, wanders off, and a forgotten tab does
 * not hold a process open forever (spec §2.3).
 *
 * It is wrong for the case that actually kept happening. On 2026-08-23 a server
 * was started for the owner to look at, three separate times, and each time it
 * reaped itself before they got to it — because the work of finishing the
 * change took longer than fifteen minutes and nothing was touching `/api` in
 * the meantime. Each death was then read as "the page is blank again" and
 * investigated as a fresh defect. It was not one. The log said so plainly every
 * time — `mycontext ui: exited after 15 idle minutes.` — and that line was not
 * looked at until the third occurrence.
 *
 * Worse, it compounded a real defect. A page that could not authenticate drew
 * nothing AND started no heartbeat, so it issued no `/api` request at all; the
 * lockout starved the very timer that then killed the server, fifteen minutes
 * later, in a different layer. One symptom, two causes, and the second one
 * looked exactly like the first.
 *
 * ── WHY THE BOUND IS NOT RE-SPELLED HERE ──────────────────────────────────
 *
 * `IdleMonitor`'s constructor already refuses NaN, Infinity, zero, negative and
 * anything past `MAX_IDLE_MS`, and says why at length — it refuses THERE "so
 * the invariant covers every caller rather than only the caller that happens to
 * be written first". This function validates the same window against the same
 * imported constant rather than a literal, so there is one bound and one place
 * it is written down. The shape check happens here only because this command
 * refuses everything it can BEFORE starting a server it will not be around to
 * see fail — the ordering the file header argues for.
 */
function resolveIdleMs(args: string[]): number {
  const found = flagOccurrences(args, 'idle-ms');
  if (found.length > 1) throw repeatedFlagError('idle-ms', found.map((o) => o.value));
  const occurrence = found[0];
  if (occurrence === undefined) return IDLE_MS;
  if (occurrence.value === null || occurrence.value === '') {
    throw new Error(
      'my_context: --idle-ms needs a value — whole milliseconds of idleness before the server ' +
      `exits, from 1 to ${MAX_IDLE_MS} (24 hours). It is refused rather than defaulted, because ` +
      'a window silently chosen for you is a server that disappears at a time you did not pick.',
    );
  }
  const ms = Number(occurrence.value);
  if (!Number.isInteger(ms) || ms < 1 || ms > MAX_IDLE_MS) {
    throw new Error(
      `my_context: --idle-ms must be a whole number of milliseconds from 1 to ${MAX_IDLE_MS} ` +
      `(24 hours) (got ${JSON.stringify(occurrence.value)}). A day is 96 times the default ` +
      'fifteen minutes — far more than any session needs, and the point past which the window ' +
      'stops meaning anything.',
    );
  }
  return ms;
}

/**
 * **How long the PRINTED url stays usable: the session's own window, never less
 * than the ten minutes it has always been.**
 *
 * The printed nonce is one-shot, loopback-only, and dies with the server, and
 * it lives for `PRINTED_NONCE_TTL_MS` — ten minutes. That is the right answer
 * for the default fifteen-minute server: a person starts the UI, glances at the
 * terminal, opens the link.
 *
 * It is the wrong answer the moment somebody passes `--idle-ms` to say "this
 * server is for a long session". Measured 2026-08-23: a server was started with
 * an eight-hour window so it would still be there when the owner came back, and
 * the only credential it ever printed expired ten minutes later. The process
 * was healthy, listening and answering — and unreachable. A live server you
 * cannot get into is indistinguishable, from the outside, from a dead one, and
 * it was reported as exactly that.
 *
 * So the URL's life follows the window the operator asked for. One knob, one
 * meaning: how long is this session expected to last. What it does NOT do is
 * shorten anything — an operator asking for a two-minute server still gets the
 * ten-minute link, because the nonce outliving the server is harmless (it dies
 * with it) while the reverse is the failure above.
 *
 * The credential this lengthens is still single-use, still refused off
 * loopback, and still gone when the process exits. What changes is only how
 * long a person has to walk back to their terminal.
 */
function printedNonceTtl(idleMs: number): number {
  return Math.max(PRINTED_NONCE_TTL_MS, idleMs);
}

/** The window as the two messages below say it, in whole minutes where that is exact. */
function idleMinutesText(idleMs: number): string {
  const minutes = idleMs / 60_000;
  return Number.isInteger(minutes) ? `${minutes} idle minutes` : `${idleMs} idle milliseconds`;
}

/**
 * `--port`, or `0` meaning "ask the operating system for a free one".
 *
 * Throws rather than returning a sentinel: every caller of this file's parsing
 * is `cmdUi`, whose `catch` turns it into one line and exit 1, which is the
 * contract every other command in this CLI keeps (`CommandFn` "never throws").
 */
function resolvePort(args: string[]): number {
  const found = flagOccurrences(args, 'port');
  if (found.length > 1) throw repeatedFlagError('port', found.map((o) => o.value));
  const occurrence = found[0];
  if (occurrence === undefined) return 0;
  if (occurrence.value === null || occurrence.value === '') {
    throw new Error(
      'my_context: --port needs a value — a whole number from 0 to 65535, where 0 asks the ' +
      'operating system for a free one. It is refused rather than defaulted, because a port ' +
      'silently chosen for you is a server you cannot find twice.',
    );
  }
  const port = Number(occurrence.value);
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(
      `my_context: --port must be a whole number from 0 to 65535 (got ` +
      `${JSON.stringify(occurrence.value)}). 0 asks the operating system for a free one.`,
    );
  }
  return port;
}

/**
 * The line printed when no browser opened, and the only thing that makes that
 * outcome a working session rather than a dead end.
 *
 * The URL carries a `PRINTED_NONCE_TTL_MS` nonce, not the ten-second opener
 * one: this URL never transits a process command line, so it can afford long
 * enough to be pasted into a browser by hand (plan §"Design decisions", item
 * 5). It is still one-shot and still dies with the server.
 */
function fallbackLine(url: string, reason: string): string {
  return `mycontext ui: could not open a browser (${reason}). Visit ${url}`;
}

function cmdUi(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  // Before the flags, as `status` does: "no workspace" is the answer whatever
  // else is on the command line, and it is the case `inventory.test.ts` runs.
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // Refused before anything is bound or spawned — see `unknownFlag`
  // (format.ts). `mycontext ui --no-opn` would otherwise launch a browser the
  // user had just asked it not to.
  if (refuseUnknownFlag(args, UI_FLAGS, UI_VALUE_FLAGS, USAGE, out)) return 1;

  let port: number;
  let noOpen: boolean;
  let idleMs: number;
  try {
    port = resolvePort(args);
    idleMs = resolveIdleMs(args);
    noOpen = hasFlag(args, 'no-open');
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // **The audit projection is synced HERE, before the server exists.**
  //
  // Owner decision, 2026-08-23. The read surface may never sync it — building
  // the projection is a write, and `audit-db.ts` refuses on that ground by
  // design, answering 503 with a sentence telling the reader to run
  // `mycontext audit`. That is correct for a read surface and useless as a
  // product: every audit endpoint then fails until somebody knows to run a
  // command nobody mentioned.
  //
  // And it happens constantly, not rarely. A refusal is the read surface's ONE
  // write: a single stale-tab heartbeat answering `token-mismatch 403 GET
  // /api/ping` appends an access record, the log outgrows the projection, and
  // the Audit stream 503s from then on. The surface disables itself by doing
  // the one thing it is allowed to do. Measured repeatedly on 2026-08-23; it is
  // the whole reason that screen kept appearing empty.
  //
  // This command is a CLI invocation and IS a write context, so it may do what
  // the server may not. Syncing once here means the UI works when it opens.
  //
  // **Best effort, never fatal.** A corpus with no audit log yet, one whose
  // projection is damaged, a read-only checkout — none of those is a reason to
  // refuse to start a UI that reads twenty other things perfectly well. The
  // endpoints keep their own 503 for the case where this could not help, so
  // nothing is hidden by trying.
  try {
    // `ws.projectRoot`, never `cwd`: the workspace can be a directory ABOVE the
    // one the command was run from, and `audit.ts` resolves it the same way for
    // the same reason. Passing cwd worked only when they happened to coincide.
    const db = openProjection(ws.projectRoot);
    try { syncProjection(ws.projectRoot, db); } finally { db.close(); }
  } catch { /* the endpoints still report a stale projection in their own words */ }

  // From here the server outlives this function. `runCli` returns, the CLI
  // main sets `process.exitCode` without calling `process.exit`
  // (`src/cli/index.ts:905-906`), and the listening socket keeps the event
  // loop — and the process — alive until the idle exit or Ctrl-C.
  startUiServer({
    cwd,
    port,
    idleMs,
    onExit: (reason) => {
      // NOT `process.exit(0)`, which is what the plan's sample called here.
      // `IdleMonitor.start` unrefs its poll and `stop()`s before firing, and
      // the idle path closes the server and destroys its connections, so
      // nothing is left holding the loop: measured at 2ms from `onExit` to a
      // natural exit 0. `process.exit` would buy those 2ms at the cost of
      // truncating this very line on a pipe, which is the one output that
      // explains why the terminal came back.
      if (reason === 'idle') {
        out(`mycontext ui: exited after ${idleMinutesText(idleMs)}.`);
      }
    },
  })
    .then((running) => {
      if (noOpen) {
        // The same one line `src/ui/server.ts`'s own main entry prints, so the
        // two ways of starting this server are readable as the same thing.
        out(`mycontext ui: ${running.urlWithNonce(printedNonceTtl(idleMs))}`);
        return;
      }
      const launch = openBrowser(running.urlWithNonce(OPENER_NONCE_TTL_MS));
      if (!launch.opened) {
        // The fallback IS the `--no-open` path (spec §3): print, never error.
        // A server that started and a browser that did not is a working
        // session, and the URL is the whole remedy — so the exit code stays 0
        // and the reason is named rather than swallowed.
        out(fallbackLine(running.urlWithNonce(printedNonceTtl(idleMs)), launch.reason));
        return;
      }
      out(
        `mycontext ui: serving on http://127.0.0.1:${running.port} — opening your browser. ` +
        `Read-only; exits after ${idleMinutesText(idleMs)}.`,
      );
    })
    .catch((err: unknown) => {
      // `startUiServer` never throws synchronously and says so: every refusal
      // it and `IdleMonitor` write is a whole user-facing message, arriving
      // here as a rejection. Printed unchanged — `toCliMessage` would prefix
      // `my_context:` onto a sentence that already opens `mycontext ui:`.
      out(err instanceof Error ? err.message : String(err));
      process.exitCode = 1;
    });
  return 0;
}

registerCommand({
  name: 'ui',
  usage: 'ui [--port N] [--no-open] [--idle-ms N]',
  summary: 'read-only web UI on 127.0.0.1 — preview, coverage, reports',
  run: cmdUi,
});
