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
import type { Workspace } from '../../core/workspace.ts';
import { IDLE_MS } from '../../ui/idle.ts';
import { openBrowser } from '../../ui/open.ts';
import {
  OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS, startUiServer,
} from '../../ui/server.ts';
import { refuseUnknownFlag } from './format.ts';
import {
  flagOccurrences, hasFlag, registerCommand, repeatedFlagError, type Emit,
} from './registry.ts';

const USAGE = 'usage: mycontext ui [--port N] [--no-open]';

/** The flags this command accepts, and which of them take a following value. */
const UI_FLAGS = ['port', 'no-open'];
const UI_VALUE_FLAGS = ['port'];

/** The idle window as the message says it, derived so the sentence cannot drift. */
const IDLE_MINUTES = IDLE_MS / 60_000;

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
  try {
    port = resolvePort(args);
    noOpen = hasFlag(args, 'no-open');
  } catch (err) {
    out(err instanceof Error ? err.message : String(err));
    return 1;
  }

  // From here the server outlives this function. `runCli` returns, the CLI
  // main sets `process.exitCode` without calling `process.exit`
  // (`src/cli/index.ts:905-906`), and the listening socket keeps the event
  // loop — and the process — alive until the idle exit or Ctrl-C.
  startUiServer({
    cwd,
    port,
    onExit: (reason) => {
      // NOT `process.exit(0)`, which is what the plan's sample called here.
      // `IdleMonitor.start` unrefs its poll and `stop()`s before firing, and
      // the idle path closes the server and destroys its connections, so
      // nothing is left holding the loop: measured at 2ms from `onExit` to a
      // natural exit 0. `process.exit` would buy those 2ms at the cost of
      // truncating this very line on a pipe, which is the one output that
      // explains why the terminal came back.
      if (reason === 'idle') {
        out(`mycontext ui: exited after ${IDLE_MINUTES} idle minutes.`);
      }
    },
  })
    .then((running) => {
      if (noOpen) {
        // The same one line `src/ui/server.ts`'s own main entry prints, so the
        // two ways of starting this server are readable as the same thing.
        out(`mycontext ui: ${running.urlWithNonce(PRINTED_NONCE_TTL_MS)}`);
        return;
      }
      const launch = openBrowser(running.urlWithNonce(OPENER_NONCE_TTL_MS));
      if (!launch.opened) {
        // The fallback IS the `--no-open` path (spec §3): print, never error.
        // A server that started and a browser that did not is a working
        // session, and the URL is the whole remedy — so the exit code stays 0
        // and the reason is named rather than swallowed.
        out(fallbackLine(running.urlWithNonce(PRINTED_NONCE_TTL_MS), launch.reason));
        return;
      }
      out(
        `mycontext ui: serving on http://127.0.0.1:${running.port} — opening your browser. ` +
        `Read-only; exits after ${IDLE_MINUTES} idle minutes.`,
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
  usage: 'ui [--port N] [--no-open]',
  summary: 'read-only web UI on 127.0.0.1 — preview, coverage, reports',
  run: cmdUi,
});
