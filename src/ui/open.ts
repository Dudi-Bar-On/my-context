/**
 * Opening the user's browser on the URL the server just bound.
 *
 * Spec: `docs/superpowers/specs/2026-08-16-web-ui-design.md` §3 (*Opening the
 * browser*) and §2 point 4 (why the token is not in this command line). Plan:
 * `docs/superpowers/plans/2026-08-16-web-ui-1-server-and-reads.md` Task 15.
 *
 * **THE FIRST `child_process` USE IN `src/`.** There were none before this
 * module — re-verified by grep at implementation time, `src/` matched
 * `child_process` in `scripts/mutate.ts` alone, which is not shipped code.
 * Zero runtime DEPENDENCIES is intact; "zero moving parts" is not, and this
 * comment exists so nobody assumes otherwise.
 *
 * **The URL handed to this function carries a one-shot handoff nonce, never
 * the token.** On Windows the command line below is readable by every local
 * account for the lifetime of the spawn (spec §2 point 4), which is exactly
 * why the token must not be in it and why the opener's nonce lives ten
 * seconds (`OPENER_NONCE_TTL_MS`).
 *
 * ── THREE THINGS THE PLAN'S SAMPLE GOT WRONG, MEASURED ────────────────────
 *
 * 1. **`spawn` does not throw when the opener is missing.** The plan wrapped
 *    the spawn in `try/catch` and returned `null` from the `catch`, and its
 *    test passed a fake that threw — so the fallback was proved against a
 *    control flow the real `child_process` never takes. Measured on Node
 *    v24.14.0: `spawn('definitely-not-a-real-binary-xyz', …, { stdio:
 *    'ignore', detached: true })` RETURNS a `ChildProcess` with `pid ===
 *    undefined` and emits `'error'` on a later tick.
 * 2. **That `'error'` event, unlistened, kills the process.** An `EventEmitter`
 *    with no `'error'` listener throws the event as an uncaught exception; the
 *    same probe exited with the ENOENT reaching the top level. So the plan's
 *    `mycontext ui` would have taken down the server it had just started, on
 *    every machine without `xdg-open`. The listener below is not defensive
 *    tidiness — it is the difference between a printed URL and a dead process.
 *    `pid === undefined` is the synchronous half of the same fact (libuv reads
 *    the exec failure before `uv_spawn` returns), which is what lets this
 *    function stay synchronous and still answer honestly.
 * 3. **A URL is not a shell string.** `openBrowser` is exported and takes a
 *    string, and both openers treat a leading `-` as an option and `cmd.exe`
 *    treats `&` as a command separator. `assertOpenable` below refuses
 *    anything that is not a loopback `http` URL, and it decides that by
 *    comparing PARSED values, never by inspecting the shape of the string —
 *    `KNOWN-repo-containment-guard-is-defeated-across-windows-drive` is this
 *    project's record of what shape-inspection costs, and
 *    `http://127.0.0.1@evil.example/` is the same defect wearing a URL.
 */
import { spawn } from 'node:child_process';

/**
 * What happened, with the reason attached when nothing opened.
 *
 * A bare `{command, args} | null` — the plan's shape — cannot say WHICH
 * failure occurred, and the two are not interchangeable: "this system has no
 * browser opener" is a fact about the machine that the printed URL fully
 * remedies, while "that URL is not one this server could have minted" is a
 * bug in the caller. `INV-nothing-is-dropped-silently` is why the reason
 * travels with the answer instead of being discarded at the `null`.
 *
 * `reason` is a fixed literal in both cases and carries no caller-supplied
 * text: the CLI prints it, and echoing a submitted URL back onto a terminal is
 * the class of echo this project has already removed once (plan §0.6 ruling 11).
 */
export type BrowserLaunch =
  | { opened: true; command: string; args: string[] }
  | { opened: false; reason: string };

/**
 * The per-platform opener, and the empty string that has to be there.
 *
 * The `''` after `start` is the TITLE argument. `start` reads its first quoted
 * operand as a window title, so `start "http://…"` opens a console window
 * titled with the URL and no browser at all; the empty title is what makes the
 * URL the operand (spec §3).
 *
 * Everything that is not Windows or macOS gets `xdg-open`, which is the
 * freedesktop opener — the same answer the spec gives for Linux, applied to
 * the rest of the POSIX platforms `NodeJS.Platform` names rather than left as
 * an unhandled case that would spawn `undefined`.
 */
function opener(platform: NodeJS.Platform, url: string): { command: string; args: string[] } {
  if (platform === 'win32') return { command: 'cmd', args: ['/c', 'start', '', url] };
  if (platform === 'darwin') return { command: 'open', args: [url] };
  return { command: 'xdg-open', args: [url] };
}

/**
 * The characters a URL may consist of before it is allowed onto a command
 * line: RFC 3986's unreserved and reserved sets, MINUS `&`, and minus
 * everything outside them — which is every control character (NUL included),
 * every space, `"`, `'`, backtick, `<`, `>`, `|`, `^` and `\`.
 *
 * `&` is excluded by name because `cmd.exe` reads it as a command separator
 * and this repository ships on Windows. Nothing this server mints contains
 * one: `urlWithNonce` builds `http://127.0.0.1:<port>/#<32 hex characters>`.
 *
 * **What this guarantees, with its condition**: given a string that passes
 * both this test and the parsed-value checks in `assertOpenable`, no character
 * that `cmd.exe`, `open` or `xdg-open` treats as syntax rather than as data
 * reaches the spawned argument vector. It guarantees nothing about a URL that
 * is never handed to this module.
 */
const URL_CHARACTERS = /^[A-Za-z0-9\-._~:/?#[\]@!$'()*+,;=%]+$/;

/**
 * Refuse anything that is not a loopback `http` URL, by PARSED value.
 *
 * Each check is here because a string test would pass the case beside it:
 * `startsWith('http://127.0.0.1')` accepts `http://127.0.0.1.evil.example/`
 * and `http://127.0.0.1@evil.example/`, whose hostnames are `evil.example` in
 * both readings; a hostname check alone accepts `https://` and a credential
 * pair; and all of them accept a control character in the fragment.
 *
 * It throws rather than returning a value, because reaching it means a caller
 * built a URL this server cannot have minted — a defect in the program, not a
 * condition of the machine. Its one caller catches it and turns it into an
 * `opened: false` with the fallback URL, so a user still ends up holding the
 * remedy; see `openBrowser`.
 */
function assertOpenable(url: string): void {
  const bad = (why: string): never => {
    throw new Error(`mycontext ui: refusing to hand the browser opener a URL that ${why}.`);
  };
  if (!URL_CHARACTERS.test(url)) bad('contains a character an opener would read as syntax');
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return bad('is not a URL at all');
  }
  if (parsed.protocol !== 'http:') bad(`is not http (it is ${JSON.stringify(parsed.protocol)})`);
  if (parsed.hostname !== '127.0.0.1') bad('does not resolve to 127.0.0.1 once parsed');
  if (parsed.username !== '' || parsed.password !== '') bad('carries credentials');
  if (parsed.port === '') bad('names no port');
}

/**
 * Launch the user's browser on `url`, and never throw, never hang, never
 * outlive this process.
 *
 * `platform` and `spawnFn` are injected so the three command lines and the
 * failure path are testable on one machine; production passes neither.
 *
 * `detached: true` plus `unref()` is what keeps the CLI free to exit on its
 * own schedule — the opener is not a child whose lifetime means anything here.
 * `stdio: 'ignore'` is what keeps a browser's own chatter off the terminal the
 * URL was just printed to.
 */
export function openBrowser(
  url: string,
  platform: NodeJS.Platform = process.platform,
  spawnFn: typeof spawn = spawn,
): BrowserLaunch {
  try {
    assertOpenable(url);
  } catch (err) {
    return { opened: false, reason: err instanceof Error ? err.message : String(err) };
  }
  const { command, args } = opener(platform, url);
  try {
    const child = spawnFn(command, args, { stdio: 'ignore', detached: true });
    // BEFORE unref, and before anything can return. A ChildProcess whose spawn
    // failed emits `'error'` on a later tick, and an EventEmitter with no
    // `'error'` listener rethrows it as an uncaught exception — which would
    // take down the server this browser was being opened onto. See the header.
    child.on('error', () => { /* the pid check below is the answer; see the header */ });
    child.unref();
    if (child.pid === undefined) {
      // The spawn already failed, synchronously: libuv reports an exec failure
      // before `uv_spawn` returns, so this is not a race with the event above.
      return { opened: false, reason: `${command} could not be started on this system` };
    }
    return { opened: true, command, args };
  } catch (err) {
    // `spawn` throws only for an argument it will not accept (a bad `options`,
    // an unspawnable name on Windows). Kept because it is real, and NOT
    // described as the failure path for a missing opener — that one is the
    // `pid` check above, and calling this its catch is what the plan did.
    return { opened: false, reason: err instanceof Error ? err.message : String(err) };
  }
}
