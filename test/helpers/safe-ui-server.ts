/**
 * `startUiServer`, with the port screened — the in-process half of the guard
 * `test/ui/helpers.ts` already applies to every server it SPAWNS.
 *
 * ── WHY THIS FILE EXISTS ───────────────────────────────────────────────────
 *
 * `startUiServer({ cwd })` defaults to `port: 0`, which asks the OS for a free
 * port. The OS answers without knowing who will connect. Node's `fetch`
 * (undici) has an opinion: it enforces the WHATWG "bad port" list and answers
 * `TypeError: fetch failed { cause: Error: bad port }` BEFORE it opens a
 * socket. Chrome has its own, longer opinion. `test/ui/unsafe-ports.ts` carries
 * both, measured rather than remembered, and `startOnSafePort` is the retry
 * that discards a server the consumer will refuse and asks for another port.
 *
 * **Spawned servers went through that guard from the day it was written;
 * in-process ones never did.** `startUiChild` calls `startOnSafePort`; the ten
 * test files that called `startUiServer` directly called nothing. On this
 * machine `netsh int ipv4 show dynamicport tcp` reports an ephemeral range of
 * 1024-15000, which contains 19 refused ports — about 1 draw in 736. That is
 * invisible on one file and arithmetic on a loaded suite, and it is why a full
 * `npm test` reported roughly five `bad port` failures per run in DIFFERENT
 * FILES each time while every one of those files passed alone.
 *
 * A varying set of victims is what teaches people to re-run instead of read,
 * and the cost is the next real failure being dismissed. See
 * `TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with`.
 *
 * ── WHY A WRAPPER AND NOT A GUARD INSIDE `startUiServer` ───────────────────
 *
 * Putting the retry in `src/ui/server.ts` would make a PRODUCT function retry
 * a bind because of a constraint only a TEST's consumers impose. A person who
 * runs `mycontext ui` and opens the printed URL in Chrome would then be served
 * on a port silently different from the one they configured, and a person who
 * asked for `--port 6669` on purpose would be answered on some other port with
 * no explanation. The list is a fact about test consumers, so the screen
 * belongs on the test side of the boundary.
 *
 * It is enforced rather than remembered: `test/ui/safe-port-gate.test.ts`
 * fails `npm test` for any file under `test/` or `e2e/` that imports
 * `startUiServer` from `src/ui/server.ts` and is not this module.
 *
 * ── A SERVER THAT REFUSES TO START IS NOT RETRIED ──────────────────────────
 *
 * `startOnSafePort` propagates a start rejection untouched, on the first
 * attempt. So the three refusal cases in `test/ui/server.test.ts` — a
 * non-loopback host, `localhost`, a `NaN` idle window — reject through this
 * wrapper exactly as they reject without it, and asking the same question five
 * times would only delay the answer. That is asserted in
 * `test/ui/unsafe-ports.test.ts`, not assumed here.
 *
 * ── THE SESSION-STORE PIN TRAVELS WITH IT ──────────────────────────────────
 *
 * `./pin-sessions-dir.ts` is imported here, which closes the gap that module's
 * own docstring names: the pin lived in the `--import` preload and in the
 * spawn helper, and "a test calling `startUiServer` IN PROCESS goes through
 * neither". Now every in-process start does. An existing
 * `MYCONTEXT_UI_SESSIONS_DIR` is honoured, so `server-record.test.ts`, which
 * re-points the store per test, is unaffected.
 */
import { startUiServer, type RunningUiServer, type UiServerOptions } from '../../src/ui/server.ts';
import { startOnSafePort } from '../ui/unsafe-ports.ts';
// Pins the UI session store out of the developer's real home; see the module.
import './pin-sessions-dir.ts';

/**
 * Start the UI server in process on a port both `fetch` and a browser will
 * talk to.
 *
 * Same options, same `RunningUiServer`, same rejections — the only difference
 * is that the port handed back is one a consumer does not refuse outright.
 */
export async function startSafeUiServer(options: UiServerOptions): Promise<RunningUiServer> {
  // The extra `server` field is what carries the real handle through
  // `startOnSafePort`, which needs only `{ port, stop }` and returns whatever
  // it was given. `RunningUiServer` spells its shutdown `close()`; the harness
  // interface spells it `stop()`, so the adapter is one line rather than a
  // change to either side.
  const started = await startOnSafePort(async () => {
    const server = await startUiServer(options);
    return { server, port: server.port, stop: (): Promise<void> => server.close() };
  });
  return started.server;
}
