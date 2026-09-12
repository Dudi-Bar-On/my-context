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
import path from 'node:path';
import { openProjection, syncProjection } from '../../core/audit-db.ts';
import { COMMAND_FLAGS } from '../../core/command-flags.ts';
import { canonicalizeNearestExisting } from '../../core/paths.ts';
import { probeUiServer, type Liveness } from '../../core/ui-server-probe.ts';
import { uiServerRecordPath } from '../../core/ui-server-record.ts';
import { repositoryRoot, type Workspace } from '../../core/workspace.ts';
import { IDLE_MS, MAX_IDLE_MS } from '../../ui/idle.ts';
import { openBrowser } from '../../ui/open.ts';
import {
  CODE_FREEZE_NOTICE, MINT_NONCE_TTL_MS, OPENER_NONCE_TTL_MS, PRINTED_NONCE_TTL_MS, startUiServer,
} from '../../ui/server.ts';
import { refuseUnknownFlag } from './format.ts';
import {
  flagOccurrences, hasFlag, registerCommand, repeatedFlagError, type Emit,
} from './registry.ts';

const USAGE =
  'usage: mycontext ui [--port N] [--no-open] [--idle-ms N] | mycontext ui --nonce [--no-open]';

/** The flags this command accepts, and which of them take a following value. */
/**
 * This command's flag surface, LIFTED to `core/command-flags.ts` so a read
 * surface can have it without reaching a module that writes. Nothing about
 * what is accepted changed; the reasoning is in that module's header.
 */
const { allowed: UI_FLAGS, values: UI_VALUE_FLAGS } = COMMAND_FLAGS.ui;

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
 * The default WAS fifteen minutes, and it was right for the case it was
 * designed for: a person opens the UI, reads it, wanders off, and a forgotten
 * tab does not hold a process open forever (spec §2.3).
 *
 * It was wrong for the case that actually kept happening. On 2026-08-23 a
 * server was started for the owner to look at, three separate times, and each
 * time it reaped itself before they got to it — because the work of finishing
 * the change took longer than fifteen minutes and nothing was touching `/api`
 * in the meantime. The owner raised the default to eight hours the same day
 * (`IDLE_MS`, and spec §2.3 with it); this flag is what moves it per run,
 * shorter as readily as longer. Each death was then read as "the page is blank again" and
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
      `(24 hours) (got ${JSON.stringify(occurrence.value)}). A day is three times the default ` +
      'eight hours — headroom for a session that genuinely runs long, and the point past which ' +
      'the window stops meaning anything.',
    );
  }
  return ms;
}

/**
 * **How long the PRINTED url stays usable: the session's own window, never less
 * than the ten minutes it has always been.**
 *
 * The printed nonce is one-shot, loopback-only, and dies with the server, and
 * `PRINTED_NONCE_TTL_MS` is ten minutes — the floor, and once the whole answer,
 * back when the server itself only lived fifteen minutes unattended.
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
 * `--port`, or `0` meaning "ask the operating system for a free one", or
 * `null` meaning THE FLAG WAS NOT GIVEN.
 *
 * ── WHY "NOT GIVEN" IS NOW A THIRD ANSWER ─────────────────────────────────
 *
 * It used to return `0` for an absent flag, because 0 and "absent" had the
 * same meaning: bind wherever. They stopped meaning the same thing on
 * 2026-08-27, when `ui.port` arrived as the fallback (`UiConfig.port`,
 * config.ts) — an absent flag now means "use the config", while an explicit
 * `--port 0` still means "ask the operating system", and the config must not
 * override a number a person typed.
 *
 * That distinction only survives if it is carried out of here. Collapsing it
 * to 0 and writing `port || config.ui.port` at the call site is the bug this
 * shape exists to prevent: `0 || 58888` is `58888`, so a person who typed
 * `--port 0` would silently get the configured port instead. `resolvePort`
 * answers `null` for absent and the call site uses `??`, which is the one
 * operator that treats 0 as the answer it is.
 *
 * It is the same distinction `flag()` cannot express and this file's header
 * refuses to accept — "not given" and "given with nothing after it" are
 * different — one level up.
 *
 * Throws rather than returning a sentinel: every caller of this file's parsing
 * is `cmdUi`, whose `catch` turns it into one line and exit 1, which is the
 * contract every other command in this CLI keeps (`CommandFn` "never throws").
 */
function resolvePort(args: string[]): number | null {
  const found = flagOccurrences(args, 'port');
  if (found.length > 1) throw repeatedFlagError('port', found.map((o) => o.value));
  const occurrence = found[0];
  if (occurrence === undefined) return null;
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

/**
 * **What a start that DID open a browser prints — and why a URL is now one of
 * the lines.**
 *
 * ── THE MEASUREMENT, 2026-09-12 ────────────────────────────────────────────
 *
 * The owner pasted a URL and said it did not work. It worked; it had EXPIRED.
 * The URL a browser is launched on carries `OPENER_NONCE_TTL_MS` — ten seconds
 * — and that is correct FOR THE OPENER: on Windows it goes onto a command line
 * every local account can read for the lifetime of the spawn (`src/ui/open.ts`
 * argues it), and a launch spends it in milliseconds. What nobody accounted for
 * is that the launched URL does not stop existing once it is spent: it is
 * sitting in the address bar of the tab that just opened, and a person who
 * reloads it, copies it, or hands it to somebody else is holding the shortest-
 * lived credential this product mints. Ten seconds, against `MINT_NONCE_TTL_MS`
 * at thirty and `PRINTED_NONCE_TTL_MS` at ten minutes. **The one URL a human
 * actually reads had the shortest life of the three.**
 *
 * ── WHY THIS IS NOT A REVERSAL OF THE 2026-09-03 RULING ───────────────────
 *
 * That ruling sized a credential by WHO SPENDS IT: a browser this process opens
 * consumes it in milliseconds and gets thirty seconds; a human who has to carry
 * it back to a window gets ten minutes (`deliverNonce`). Applied here, the two
 * consumers are simply both present at once — the launch spends its own
 * ten-second one, and the human gets a SECOND credential sized for a human.
 * Neither window moves. The opener keeps its ten seconds and therefore keeps
 * the command-line-exposure argument that set them; nothing printed here ever
 * transits a command line, exactly as `fallbackLine` already says of the URL it
 * prints when no browser opened.
 *
 * A second mint costs nothing worth naming: `urlWithNonce` mints from this
 * server's own in-memory `NonceStore`, which is not the `POST /api/nonce` route
 * and writes no `nonce-minted` audit row. Both nonces are one-shot, loopback
 * only, and die with the process.
 *
 * ── WHY IT ALSO SAYS THE OPENER'S LINK IS ABOUT TO DIE ────────────────────
 *
 * Printing a good URL silently would leave the reader with two links and no way
 * to tell which of them just stopped working — and the one in their address bar
 * is the one they will reach for. So the line names the ten seconds, names the
 * window this one gets, and names `mycontext ui --nonce` for after it is spent.
 * That is the register `nonceOpenFailedLine` already set for a link handed out
 * past its purpose: say what it is, rather than let a person discover it.
 *
 * Exported and taking `urlWithNonce` as a parameter so that
 * `test/cli/ui-printed-url-ttl.test.ts` can prove WHICH window is asked for
 * without starting a server or spawning a browser — the ttl is the whole claim,
 * and a test that could only read the printed string could not see it.
 */
export function startedLines(
  port: number, idleMs: number, urlWithNonce: (ttlMs: number) => string,
): string[] {
  const ttlMs = printedNonceTtl(idleMs);
  return [
    `mycontext ui: serving on http://127.0.0.1:${port} — opening your browser. `
    + `Read-only; exits after ${idleMinutesText(idleMs)}.`,
    `mycontext ui: the link the browser was handed is spent by that launch and lives `
    + `${OPENER_NONCE_TTL_MS / 1_000}s — reloading it later will not let you in. If that tab `
    + `asks for a credential, use this one instead (${nonceWindowText(ttlMs)}, one use, gone `
    + `when the server exits): ${urlWithNonce(ttlMs)} — and after it is spent, `
    + '`mycontext ui --nonce` mints another from the server that is already running.',
  ];
}

/** How long a printed credential lasts, in whole minutes where that is exact. */
function nonceWindowText(ttlMs: number): string {
  const minutes = ttlMs / 60_000;
  return Number.isInteger(minutes) ? `good for ${minutes} minutes` : `good for ${ttlMs}ms`;
}

/**
 * The fallback when opening a browser for a MINTED nonce fails — rare, since
 * this route only runs after `probeUiServer` or a configured `ui.port` has
 * already proved a server is there.
 *
 * **Not `fallbackLine` above, on purpose.** That one is right for a server
 * that just STARTED, whose printed URL carries a `PRINTED_NONCE_TTL_MS`
 * (ten-minute) nonce. This one is reached only when `--no-open` was NOT
 * given, which means `deliverNonce` asked `POST /api/nonce` for the SHORT
 * variant (`MINT_NONCE_TTL_MS`, thirty seconds) — the nonce was minted on the
 * assumption a browser would consume it in milliseconds, not that a human
 * would read it off a terminal. Printing it anyway, with that said honestly,
 * beats silence; the remedy this line names is a fresh mint sized for a human
 * (`mycontext ui --nonce --no-open`), not this one reused past its purpose.
 */
function nonceOpenFailedLine(url: string, reason: string): string {
  return `mycontext ui: could not open a browser (${reason}). The link below was minted for a ` +
    `browser and is short-lived (${MINT_NONCE_TTL_MS / 1_000}s) — it may already be stale by the ` +
    `time it is read. Visit ${url}, or run \`mycontext ui --nonce --no-open\` for a fresh one ` +
    'sized for a human to carry.';
}

/**
 * Deliver a minted nonce the way `noOpen` says to — owner ruling 2026-09-03:
 *
 *     ui --nonce          -> opens the browser, 30s TTL (MINT_NONCE_TTL_MS)
 *     ui --nonce --no-open -> prints, longer TTL (PRINTED_NONCE_TTL_MS)
 *
 * The 30s ruling of 2026-08-28 (`MINT_NONCE_TTL_MS`, `src/ui/server.ts`) was
 * sized for "someone already AT the terminal" reading and pasting a printed
 * line — which is exactly the case `--nonce` used to be, unconditionally, and
 * exactly the case measured today to fail: a human reads the line, switches
 * windows, and the window is gone. This does not overturn that ruling; it
 * removes the human from the path it was sized for. A browser opened by THIS
 * process consumes the nonce in milliseconds, so the 30s window is ample and
 * stays exactly what it was for the caller it now serves. `--no-open` is the
 * escape hatch for the caller who still needs to carry the link by hand, and
 * it asks the server for the SAME longer TTL the startup print path already
 * uses (`printedNonceTtl`/`PRINTED_NONCE_TTL_MS`) — reusing the flag's
 * existing meaning ("do not launch a browser; print the URL instead") rather
 * than adding a second flag that would say the same thing (`--print`
 * considered and rejected for that reason).
 *
 * **The SAME spawn-with-fallback mechanism `cmdUi`'s own start path uses** —
 * `openBrowser` (`../../ui/open.ts`) — reused here rather than a second way of
 * opening a URL existing beside it. `openFn` is that function by default and
 * the injection seam `test/cli/ui-nonce-open.test.ts` uses to prove the
 * open/print decision and the no-browser fallback without a test spawning a
 * real browser.
 *
 * The mint that produced `nonce` already happened — exactly once, in
 * `cmdUiNonce` — before this function is reached, so calling `openFn` here
 * and falling back to printing on failure costs no second mint and no second
 * `nonce-minted` audit row: both outcomes deliver the ONE nonce that was
 * already handed out.
 */
function deliverNonce(
  out: Emit, port: number, nonce: string, noOpen: boolean, openFn: typeof openBrowser,
): void {
  const url = `http://127.0.0.1:${port}/#${nonce}`;
  if (noOpen) {
    out(`mycontext ui: ${url}`);
    return;
  }
  const launch = openFn(url);
  if (!launch.opened) {
    out(nonceOpenFailedLine(url, launch.reason));
    return;
  }
  out(`mycontext ui: opening your browser — http://127.0.0.1:${port}`);
}

/**
 * `--nonce`: ask a server that is ALREADY running for a credential, instead of
 * binding a port of its own.
 *
 * Owner ruling 2026-08-28
 * (`KNOWN-a-locked-out-tab-can-only-be-recovered-by-the-restart-that-locks-
 * out-the-next-one`). The cycle this closes: a tab that loses its token has no
 * route back except a nonce, and a nonce used to be printed only when a server
 * STARTS — so recovering one locked-out tab meant restarting the server, which
 * mints a new token digest, evicts the oldest of the eight
 * `~/.my-context/ui-sessions.json` remembers, and can lock out a DIFFERENT
 * tab. This asks the live server instead, and starts nothing.
 *
 * ── THREE STEPS, THREE HONEST WAYS TO SAY NO ───────────────────────────────
 *
 * `probeUiServer` (`core/ui-server-probe.ts`) is REUSED rather than
 * re-implemented — its own module argues at length why a liveness record is a
 * claim and not a measurement, and this command needs exactly the proof it
 * already provides: the record parses, the pid is alive, and the port accepts
 * a real TCP connection. An `alive` answer can still fail between the probe
 * and this request — the server may exit in that window — and the fetch below
 * is what reports that honestly instead of pretending the probe was the whole
 * proof.
 *
 * ── "NO RECORD" IS NOT "NO SERVER", AND THIS SAID IT WAS ───────────────────
 *
 * Measured twice on 2026-08-28. A server was LISTENING on 127.0.0.1:58888,
 * confirmed by `netstat`, and this command answered *"no server is running"* —
 * because `ui-server.json` had lost a rename race at startup and was never
 * written. The message asserted a fact nothing had checked: `no-record` means
 * THE FILE WAS NOT THERE, and the only thing that follows from it is that this
 * command has no address to aim at. `dead` is the other thing entirely — a
 * record existed, its port was connected to, and nothing answered. That IS a
 * measurement, and only that one earns the sentence "no server is running".
 *
 * So the two states are said differently below, and the `no-record` wording
 * states what was actually established: there is no record, nothing was
 * checked, and a server may well be listening right now.
 *
 * ── THE FALLBACK, AND WHY IT IS NOT A PORT SCAN ───────────────────────────
 *
 * When the record is missing there is exactly one other address this product
 * already knows: `ui.port` in `.my_context/config.json`. It is not a guess —
 * a person wrote it down, and `core/ui-server-upkeep.ts` reads the same key to
 * decide where to put a server back. So `--nonce` tries that ONE address
 * before it gives up, which is how the observed case recovers without a
 * restart.
 *
 * **A port scan was considered and refused.** Sweeping the ephemeral range
 * would find a server the config never named, and it would also knock on every
 * unrelated thing listening on this machine's loopback with a POST — a command
 * that probes ports is a different kind of thing from a command that reads a
 * file a person wrote, and it is not one this product should become on the
 * strength of a rename race. One configured address is the whole widening.
 *
 * It is also honest about what it found: recovering this way means the record
 * is still missing, so the line before the URL says so rather than letting a
 * working `--nonce` hide a broken upkeep (`INV-nothing-is-dropped-silently`).
 *
 * ── "A LIVE SERVER" IS NOT "YOUR LIVE SERVER" ─────────────────────────────
 *
 * The third thing this command was wrong about, and the worst of them, because
 * it did not fail: an `alive` probe was treated as an answer when the record it
 * probed can name any server on this machine. See `NonceCaller` for the
 * measurement, for why one record per user is right and what follows from it,
 * and for the ruling on which server `--nonce` answers for when several are
 * running. The shape here is the same as the two states above — the widening
 * to the configured `ui.port` is shared, and a refusal names what it could not
 * confirm rather than answering about something else.
 *
 * ── WHY THIS PRINTS RATHER THAN RETURNS ────────────────────────────────────
 *
 * Same shape as every other exit from `cmdUi`: `out` is the only channel, and
 * a successful mint reaches it through `deliverNonce` — the SAME one-line
 * printed format the start path prints when it prints at all —
 * `mycontext ui: http://127.0.0.1:<port>/#<nonce>` — so a script or a person
 * reading either output is reading one contract, not two.
 *
 * ── OPENS BY DEFAULT, PRINTS ON `--no-open` (owner ruling 2026-09-03) ──────
 *
 * `noOpen` decides which, and `openFn` (default `openBrowser`,
 * `../../ui/open.ts`) is how the open half happens — see `deliverNonce` for
 * the whole argument, including why this is not a reason to mint twice.
 * Exactly ONE `POST /api/nonce` happens per call to this function, whichever
 * branch is taken and whatever `openFn` reports back, which is what keeps it
 * to the ONE `nonce-minted` audit row `recordNonceMint` (`security.ts`) writes
 * per credential coming into existence — this command must not multiply that.
 */
// `cmdUiNonce`, `mintNonceFrom` and `NonceMint` are exported — the only
// exports this file adds beyond the registered command — so that
// `test/cli/ui-nonce-open.test.ts` can drive the open/print decision and the
// no-browser fallback in-process, with a fake `openFn`, instead of either
// spawning a real browser from a test or never covering that branch at all.
export async function cmdUiNonce(
  out: Emit,
  caller: NonceCaller,
  noOpen: boolean,
  openFn: typeof openBrowser = openBrowser,
): Promise<void> {
  const liveness = await probeUiServer();
  // **The record is one per USER, so an `alive` verdict is not yet an answer
  // to the question that was asked.** See `NonceCaller`. A live server that
  // serves a different corpus is refused here rather than minted from, and the
  // refusal happens BEFORE the mint so no credential for it ever exists.
  const foreign = liveness.state === 'alive' && !sameWorkspace(liveness.workspace, caller.workspace)
    ? liveness
    : null;
  if (liveness.state === 'alive' && foreign === null) {
    const minted = await mintNonceFrom(liveness.url, noOpen);
    if (minted.nonce === null) {
      out(minted.kind === 'unreachable'
        ? `mycontext ui: could not reach the server at ${liveness.url} — it ${minted.reason}. ` +
          'It answered a liveness check a moment ago and may have exited since. Try again, or ' +
          'run `mycontext ui` if it has.'
        : `mycontext ui: the running server at ${liveness.url} ${minted.reason}. This request ` +
          'is built by this command itself, so that is unexpected — please report it.');
      process.exitCode = 1;
      return;
    }
    deliverNonce(out, liveness.port, minted.nonce, noOpen, openFn);
    return;
  }

  // The one other address, and only when it is one the probe has not already
  // disproved: a `dead` verdict on the configured port is a connect that was
  // just refused, and repeating it would spend a second on a settled question.
  //
  // The foreign case adds the second exclusion, and it is the same argument
  // from the other end: when the record's port IS the configured one, that
  // address has just been proved to hold the OTHER workspace's server, so
  // trying it would walk straight back into the defect this function refuses
  // one branch up — by a different route and with the disclosure missing.
  const configuredPort = caller.configuredPort;
  const fallbackPort = configuredPort !== null && configuredPort !== 0
    && !(liveness.state === 'dead' && liveness.port === configuredPort)
    && !(foreign !== null && foreign.port === configuredPort)
    ? configuredPort
    : null;
  let fallback: NonceMint | null = null;
  if (fallbackPort !== null) {
    fallback = await mintNonceFrom(`http://127.0.0.1:${fallbackPort}/`, noOpen);
    if (fallback.nonce !== null) {
      out(`mycontext ui: ${recoveredWithoutRecordLine(liveness, foreign, fallbackPort)}`);
      deliverNonce(out, fallbackPort, fallback.nonce, noOpen, openFn);
      return;
    }
  }

  out(foreign !== null
    ? foreignServerLine(foreign, caller, fallbackPort, fallback)
    : noServerLine(liveness, fallbackPort, fallback));
  process.exitCode = 1;
}

/**
 * WHOSE server `--nonce` is asking about — the fact this command did not have,
 * and the whole of `TASK-ui-nonce-falls-back-to-a-stale-record-and-hands-you-a`.
 *
 * ── WHY A WORKSPACE HAD TO BE PASSED IN AT ALL ─────────────────────────────
 *
 * `~/.my-context/ui-server.json` is ONE file per user. That is correct and is
 * argued where it is written (`core/ui-server-record.ts`: a pid, a port and a
 * URL are true of one process on one machine, and a record in a tracked
 * `.my_context/` would travel). What follows from it is the part nobody had
 * written down: **a second server is an unrecorded server**, and the record
 * goes on naming whichever one wrote it last. Here that is the normal state,
 * not an edge — lanes start throwaway servers on port 0 constantly.
 *
 * Measured twice on 2026-09-05. A lane started its own server; the record
 * write failed with `EPERM` (a Windows share-mode rename conflict, the same
 * one `retryTransientRenameOnce` exists for), so the previous record survived
 * untouched; `--nonce` read it, probed it, found it genuinely alive, and
 * minted. The lane got a WORKING credential for somebody else's server, exit
 * 0, no sentence anywhere saying whose. It then killed that process believing
 * it was cleaning up after itself. The staleness is not bounded by anything: a
 * record is only rewritten by a server that starts and succeeds in writing it,
 * so the one on disk can be arbitrarily old and still probe alive.
 *
 * ── WHICH SERVER IT ANSWERS FOR, WHEN SEVERAL ARE RUNNING ─────────────────
 *
 * **The one serving THIS workspace. Never the newest.** The record names the
 * newest only by accident of write order, which is a race between unrelated
 * processes; and a nonce is a credential FOR the server that mints it — it
 * redeems at that server's `/api/handoff` for that server's session token, and
 * that server is serving one corpus. Answering with the newest would be
 * answering a question the caller did not ask, with a key to a corpus they did
 * not name.
 *
 * So when the record names another workspace this command refuses, and the
 * only widening left is the one the no-record path already allows: the single
 * address a person wrote down in THIS workspace's own `ui.port`.
 */
export interface NonceCaller {
  /**
   * The repository root this nonce is being asked for, spelled the way
   * `src/ui/server.ts` spells the `workspace` field it writes into the record
   * (`repositoryRoot(cwd) ?? path.dirname(corpusRoot)`) — the same expression,
   * so the two sides of the comparison below cannot drift apart.
   */
  workspace: string;
  /** `ui.port` from this workspace's config, or `null`. The one widening. */
  configuredPort: number | null;
}

/**
 * Are these two paths the same workspace?
 *
 * `canonicalizeNearestExisting` on both sides rather than a string compare:
 * the record is written by one process and read by another, and Windows alone
 * offers a drive letter in either case, an 8.3 short name, and a junction — all
 * three of which spell one directory three ways. It degrades to `path.resolve`
 * for a path that no longer exists, which answers "different" for a recorded
 * workspace that has since been deleted. That is the right direction to fail
 * in: every uncertainty here becomes a refusal that names what it could not
 * confirm, never a credential for a server the caller never asked about.
 */
function sameWorkspace(a: string, b: string): boolean {
  return canonicalizeNearestExisting(a) === canonicalizeNearestExisting(b);
}

/** What `mintNonceFrom` found at one address. */
export interface NonceMint {
  /** The credential, or `null` for every way of not getting one. */
  nonce: string | null;
  /**
   * `unreachable` means NOTHING answered; the other two mean something did and
   * would not, or could not, mint. The distinction is the whole reason this is
   * a `kind` and not a boolean: only `unreachable` is evidence about whether a
   * server is there, and the callers say different things about the rest.
   */
  kind: 'minted' | 'unreachable' | 'refused' | 'unusable';
  /** A phrase completing "it …", so every caller composes one sentence. */
  reason: string | null;
  /**
   * The TTL the server actually minted at, on a `'minted'` kind only —
   * `null` for every other kind, and `null` too if an old or misbehaving
   * server answered with no usable number. Not consulted to decide anything
   * here: `deliverNonce` already knows which TTL it asked for, from `noOpen`
   * alone. It is echoed back and kept on this type so a test can assert the
   * two TTLs `POST /api/nonce` offers (`MINT_NONCE_TTL_MS`,
   * `PRINTED_NONCE_TTL_MS` — `src/ui/server.ts`) are actually different
   * values, from the wire, without waiting out either window in real time.
   */
  ttlMs: number | null;
}

/**
 * How long one address gets to answer.
 *
 * Minting is an in-memory operation on loopback and completes in single-digit
 * milliseconds, so five seconds is a wide multiple rather than a guess. The
 * bound exists because of WHERE the second call goes: the configured `ui.port`
 * has not been proved to hold a mycontext server, and something that accepts a
 * connection and then never answers would hang this command with no message at
 * all — the silent failure this whole task is about, relocated one layer out.
 * `probeUiServer` bounds its own connect for the same reason.
 */
const MINT_TIMEOUT_MS = 5_000;

/**
 * Ask ONE address for a nonce. Never throws.
 *
 * `url` ends in `/` — the liveness record's `url` field is written that way and
 * the fallback builds it the same — so `${url}api/nonce` is the endpoint in
 * both cases without a join.
 *
 * `printed` selects which of the two TTLs `POST /api/nonce` mints at
 * (`src/ui/server.ts`), by appending `?ttl=printed` when true — the SAME
 * query flag `deliverNonce`'s caller decided on from `--no-open`, plumbed
 * through here rather than decided twice. `false` (the default path, browser
 * about to consume the nonce in milliseconds) gets `MINT_NONCE_TTL_MS`; `true`
 * (a human is about to carry it) gets `PRINTED_NONCE_TTL_MS`. Exactly one
 * request either way — this function mints, it does not retry.
 */
export async function mintNonceFrom(url: string, printed: boolean): Promise<NonceMint> {
  let response: Response;
  try {
    response = await fetch(`${url}api/nonce${printed ? '?ttl=printed' : ''}`, {
      method: 'POST',
      signal: AbortSignal.timeout(MINT_TIMEOUT_MS),
    });
  } catch (err) {
    // A timeout is not the same story as a refused connection, and saying so
    // costs one branch: "nothing is there" and "something is there and would
    // not answer" send a reader to different places.
    const timedOut = err instanceof Error && err.name === 'TimeoutError';
    return {
      nonce: null,
      kind: 'unreachable',
      reason: timedOut
        ? `accepted the connection and did not answer within ${MINT_TIMEOUT_MS}ms`
        : `did not answer (${err instanceof Error ? err.message : String(err)})`,
      ttlMs: null,
    };
  }
  if (response.status !== 200) {
    return {
      nonce: null,
      kind: 'refused',
      reason: `answered status ${response.status} rather than a nonce`,
      ttlMs: null,
    };
  }
  let body: { nonce?: unknown; ttlMs?: unknown };
  try {
    body = await response.json() as { nonce?: unknown; ttlMs?: unknown };
  } catch {
    body = {};
  }
  if (typeof body.nonce !== 'string' || body.nonce === '') {
    return { nonce: null, kind: 'unusable', reason: 'answered with no usable nonce', ttlMs: null };
  }
  const ttlMs = typeof body.ttlMs === 'number' && Number.isFinite(body.ttlMs) ? body.ttlMs : null;
  return { nonce: body.nonce, kind: 'minted', reason: null, ttlMs };
}

/**
 * Said BEFORE the URL when the configured port answered and the record did not
 * exist. The credential works; the record is still missing, and that costs the
 * upkeep hook and the next `--nonce`. Printing the URL alone would be a working
 * command quietly hiding a broken one.
 */
function recoveredWithoutRecordLine(
  liveness: Liveness, foreign: ForeignServer | null, port: number,
): string {
  const found = `a server answered on the configured ui.port ${port}, so here is a credential ` +
    'from it. The record is still missing: nothing else can find this server, so the upkeep ' +
    'hook will not put it back after it exits. Restarting `mycontext ui` is what rewrites it.';
  // The foreign case FIRST: `liveness.state` is `alive` here, so neither branch
  // below describes it, and falling through to the `no-record` wording would
  // say a record is absent while holding one in its hand.
  if (foreign !== null) {
    return `the liveness record names port ${foreign.port}, which is serving ` +
      `${foreign.workspace} and not this workspace, so it was not asked — but ` +
      `a server answered on the configured ui.port ${port}, so here is a credential from it. ` +
      'The record still names that other server: nothing else can find this one, so the upkeep ' +
      'hook will not put it back after it exits. Restarting `mycontext ui` here is what ' +
      'rewrites it.';
  }
  return liveness.state === 'dead'
    ? `the liveness record named port ${liveness.port} and was disproved, so it has been ` +
      `removed — but ${found}`
    : `no liveness record — ${uiServerRecordPath()} is absent or unreadable — but ${found}`;
}

/** The `alive` liveness of a server that is serving someone else's corpus. */
type ForeignServer = Extract<Liveness, { state: 'alive' }>;

/**
 * The refusal for the case this task exists for: a server is live, it is not
 * yours, and no credential was minted from it.
 *
 * ── WHY THIS IS A REFUSAL AND NOT A WARNING BESIDE A URL ───────────────────
 *
 * A nonce is not advice. It redeems at ONE server's `/api/handoff` for that
 * server's session token, which is read access to that server's corpus — and
 * the URL printed beside it is an implied statement that this is the process
 * you are working with. On 2026-09-05 a lane read exactly that implication and
 * killed the process. A caution printed above a working link would have been
 * read the same way; the only answer that cannot be misread is not producing
 * the credential at all.
 *
 * Every fact the reader needs to act is named rather than summarised: WHICH
 * record said it, which port and pid it names, which workspace that server is
 * serving, which workspace asked, and the two commands that resolve it. This
 * is the project's standing shape for a refusal
 * (`STD-error-message-conventions`), and it applies here with unusual force —
 * the reader of this message is, by construction, someone whose mental model
 * of which server is theirs is already wrong.
 */
function foreignServerLine(
  foreign: ForeignServer,
  caller: NonceCaller,
  fallbackPort: number | null,
  fallback: NonceMint | null,
): string {
  // Said in every case, including when the port was excluded from the try
  // rather than tried — "not tried, and why" is a fact, and dropping it would
  // leave a reader who HAS set ui.port wondering whether it was consulted.
  const tried = fallbackPort !== null && fallback !== null
    ? ` The configured ui.port ${fallbackPort} was tried too, and it ${fallback.reason}.`
    : caller.configuredPort !== null && caller.configuredPort === foreign.port
      ? ` The configured ui.port ${foreign.port} was not tried separately: it is that same ` +
        'server.'
      : '';
  return 'mycontext ui: the liveness record names a server for a different workspace, so no ' +
    `credential was minted. ${uiServerRecordPath()} names port ${foreign.port} (pid ` +
    `${foreign.pid}), which is up and is serving ${foreign.workspace}; you are asking from ` +
    `${caller.workspace}. A nonce is a credential FOR the server that mints it, so answering ` +
    'with that one would have handed you a way into another corpus and an implied licence to ' +
    'stop a process that is not yours — which is what happened on 2026-09-05. There is one ' +
    'record per user, because a pid and a port are facts about this machine rather than about ' +
    `a corpus, so a second server is an unrecorded one.${tried} Run \`mycontext ui\` in this ` +
    'workspace to start one — that rewrites the record — or, if a server for THIS workspace is ' +
    'already up, set `ui.port` in .my_context/config.json to its port and run ' +
    '`mycontext ui --nonce` again.';
}

/**
 * The refusal, and the one sentence in this command that has to be exactly true.
 *
 * `dead` is a measurement and says so. `no-record` is an ABSENCE of one, and
 * says that instead — the wording that was wrong twice on 2026-08-28, when a
 * demonstrably listening server was declared gone on the strength of a missing
 * file.
 */
function noServerLine(
  liveness: Liveness, fallbackPort: number | null, fallback: NonceMint | null,
): string {
  // What the configured address added, if it was tried. Named rather than
  // dropped: a reader must be able to tell "not tried" from "tried and silent".
  const tried = fallbackPort !== null && fallback !== null
    ? ` The configured ui.port ${fallbackPort} was tried too, and it ${fallback.reason}.`
    : '';
  if (liveness.state === 'dead') {
    // `why` is not decoration. "the process is gone" and "the port answered
    // nothing" are two different disproofs, and a reader chasing a server that
    // is up but wedged needs to know which one was performed.
    const disproof = liveness.why === 'pid'
      ? 'the process that recorded it is gone'
      : `nothing is listening on port ${liveness.port}`;
    return 'mycontext ui: no server is running — a record named port ' +
      `${liveness.port} and ${disproof}, so that record has been removed.${tried} \`--nonce\` ` +
      'asks a LIVE server for a credential and has none to ask — run `mycontext ui` first, then ' +
      '`mycontext ui --nonce` to recover a locked-out tab.';
  }
  const noAddress = `mycontext ui: no liveness record, which is not the same as no server. ` +
    `${uiServerRecordPath()} is absent or unreadable, and it is the only address this command ` +
    `is given — so nothing has been checked here, and a server may be listening right now.`;
  if (tried !== '') {
    return `${noAddress}${tried} Run \`mycontext ui\` first, then \`mycontext ui --nonce\` to ` +
      'recover a locked-out tab.';
  }
  return `${noAddress} Run \`mycontext ui\` to start one — it writes the record afresh — or, if ` +
    'a server IS already up, set `ui.port` in .my_context/config.json to the port it is on and ' +
    'run `mycontext ui --nonce` again: that is the one address this command will try without a ' +
    'record.';
}

function cmdUi(ws: Workspace, args: string[], out: Emit, cwd: string): number {
  // Before the flags, as `status` does: "no workspace" is the answer whatever
  // else is on the command line, and it is the case `inventory.test.ts` runs.
  if (!ws.projectRoot) {
    out('my_context: no workspace here. Run `mycontext init` to create one.');
    return 1;
  }

  // **`ui.enabled`'s FIRST enforcement site, and it is here rather than
  // anywhere else because here is where the permission is spent.**
  //
  // The key shipped validated, refused when malformed, rendered on the
  // Configure screen — and consulted by nothing that decided anything, which
  // `src/core/config.ts` said about itself until this landed
  // (spec `2026-08-27-the-ui-server-outlives-the-session-design.md` §2). A
  // permission nothing checks is not a permission; it is a field.
  //
  // **Before the flags, and deliberately so.** It sits with the workspace check
  // above rather than after `refuseUnknownFlag` for that check's own reason: a
  // user who switched the UI off gets the same answer whatever else is on the
  // command line, and reporting a mistyped flag first would make them fix the
  // typo to be told no. It is also before the projection sync below, so a
  // forbidden command writes nothing at all.
  //
  // `=== false` and never `!ws.config.ui.enabled`: absent resolves to
  // `DEFAULT_UI` — enabled — and the falsy spelling would read a config this
  // build failed to resolve as a user who said no.
  //
  // The wording is the pre-tool-use deny hook's own register
  // (`src/hooks/pre-tool-use.ts` · "Configuration changes to
  // `.my_context/config.json` are the user's to make"), and the repetition is
  // the point: the product should say the same thing everywhere it declines to
  // touch a config. The last sentence is the load-bearing one — a refusal that
  // did not say nothing here writes the file invites the reader to look for the
  // command that flips the key, and there is none.
  if (ws.config.ui.enabled === false) {
    out(
      'my_context: ui.enabled is false in .my_context/config.json, so the web UI is off. ' +
      'Set it to true, or remove the key, to serve. Configuration is a file and is yours ' +
      'to edit; nothing here writes it.',
    );
    return 1;
  }

  // Refused before anything is bound or spawned — see `unknownFlag`
  // (format.ts). `mycontext ui --no-opn` would otherwise launch a browser the
  // user had just asked it not to.
  if (refuseUnknownFlag(args, UI_FLAGS, UI_VALUE_FLAGS, USAGE, out)) return 1;

  // **`--nonce` is a different command wearing this one's name, and it exits
  // here rather than falling through.** `--port` and `--idle-ms` describe a
  // server this mode does not start, so combining either with `--nonce` would
  // either be silently ignored (`INV-nothing-is-dropped-silently` forbids
  // that) or require guessing which of two commands the caller meant.
  //
  // **`--no-open` is no longer one of them** (owner ruling 2026-09-03).
  // `--nonce` now OPENS the browser by default — the credential it mints
  // (`MINT_NONCE_TTL_MS`, thirty seconds) is sized for a browser to consume in
  // milliseconds, not for a human to read off this terminal and paste — and
  // `--nonce --no-open` is the printed path for the caller who still needs to
  // carry the link by hand, with the longer TTL that case needs
  // (`PRINTED_NONCE_TTL_MS`, `deliverNonce` below). `--no-open` already meant
  // "do not launch a browser; print the URL instead" on the start path, so it
  // is reused rather than adding a second flag that would say the same thing.
  if (hasFlag(args, 'nonce')) {
    const inert = ['port', 'idle-ms'].filter((name) => flagOccurrences(args, name).length > 0);
    if (inert.length > 0) {
      out(
        `my_context: --nonce asks the server that is ALREADY running for a credential — it binds ` +
        `nothing itself, so --${inert[0]} has no server left to apply to. Run them separately: ` +
        '`mycontext ui` to start one (with whatever flags it needs), then a separate ' +
        '`mycontext ui --nonce` to recover a locked-out tab from it.',
      );
      return 1;
    }
    // `cmdUi` cannot `await`: `CommandFn` returns a number and the process,
    // not the return value, is what carries the outcome — the same reason
    // `startUiServer(...).then(...)` below is fired and not awaited. The
    // in-flight `fetch` inside `cmdUiNonce` keeps the event loop alive on its
    // own, so the process exits naturally once it settles; nothing here needs
    // to hold it open.
    //
    // `ws.config.ui.port` is the ONE address `--nonce` may try when the
    // liveness record is missing or names somebody else's server. It is read
    // here rather than inside `cmdUiNonce` because `ws` is already resolved
    // and `cmdUiNonce` should depend on an address, not on a workspace — the
    // same reason `resolvePort` hands back a number instead of consulting the
    // config itself.
    //
    // **And the workspace beside it, which is the fact that was missing.**
    // `repositoryRoot(cwd) ?? path.dirname(ws.projectRoot)` is `server.ts`'s
    // own expression for the `workspace` field it writes into the liveness
    // record, copied deliberately and for the reason its author gives there:
    // `repositoryRoot` ignores `CORPUS_DIR_ENV`, so it answers "where the
    // person is" rather than "where the corpus was pointed", and the record
    // must be comparable against the same question. Spelled the same on both
    // sides, a workspace can never look foreign to itself.
    void cmdUiNonce(
      out,
      {
        workspace: repositoryRoot(cwd) ?? path.dirname(ws.projectRoot),
        configuredPort: ws.config.ui.port,
      },
      hasFlag(args, 'no-open'),
    );
    return 0;
  }

  let port: number;
  let noOpen: boolean;
  let idleMs: number;
  try {
    // **The precedence, in one line: flag, then config, then ephemeral.**
    //
    // `??` and never `||`, because `--port 0` is a legal thing to type and
    // means "ask the operating system" — under `||` it would fall through to
    // the configured port, which is a person typing a flag and getting
    // something else. `resolvePort` answers `null` for an absent flag for
    // exactly this reason; its header argues it at length.
    //
    // The config is the FALLBACK rather than the winner because the two
    // callers want opposite things. A person at a terminal is about to be
    // handed a URL, so an ephemeral port costs them nothing and the flag they
    // just typed must win. A hook has no command line and nobody to hand a URL
    // to, so `ui.port` is the only address it can use — and `0` there is
    // refused by the loader for that reason (`requireUi`, config.ts).
    //
    // `ws.config`, not a fresh read: `resolveWorkspace` already resolved it,
    // and it already threw — before this command was dispatched at all — if
    // the file could not be understood. That is why a broken `config.json`
    // still surfaces as a config error naming the offending key rather than as
    // a UI that would not start.
    port = resolvePort(args) ?? ws.config.ui.port ?? 0;
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
    // The session store is what lets a tab survive this server restarting. It
    // is not required for the server to work TODAY, so a failure here is a
    // notice rather than a refusal — but it is said out loud, because the cost
    // lands later and somewhere else: the tab you are about to open would stop
    // working at the next restart, which is the exact symptom this removes.
    onSessionStoreIssue: (message) => { out(`mycontext ui: ${message}`); },
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
      // **Said BEFORE the URL, and on every start** (`plan:live seq:12`). The
      // reader who is about to edit a screen with this server running is the
      // one who needs it, and they are looking at the terminal exactly now. It
      // does not replace the shell's own banner — see `CODE_FREEZE_NOTICE` for
      // why a start-time line cannot reach the tab that has been open since the
      // morning, which is the case that was actually paid for.
      out(CODE_FREEZE_NOTICE);
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
      // Two lines, and the second one is a URL a human can actually use: the
      // one the browser was handed lives ten seconds and is already spent.
      // See `startedLines` for the measurement and for why this does not
      // reverse the 2026-09-03 ruling.
      for (const line of startedLines(running.port, idleMs, running.urlWithNonce)) out(line);
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
  usage: 'ui [--port N] [--no-open] [--idle-ms N] | ui --nonce [--no-open]',
  summary: 'read-only web UI on 127.0.0.1 — preview, coverage, reports',
  run: cmdUi,
});
