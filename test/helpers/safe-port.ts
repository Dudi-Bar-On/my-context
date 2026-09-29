/**
 * A raw `http.Server` bound on a port `fetch` will actually talk to.
 *
 * The UI server has two guarded starters — `startUiChild` for a spawned child,
 * `startSafeUiServer` for an in-process one. This is the third case: a test
 * that stands up its own `node:http` server around one handler, so that the
 * handler writes its own head and its own bytes over a real socket instead of
 * into a stubbed `ServerResponse`. `test/ui/conversation-document.test.ts`'s
 * `askSpill` is the one that exists today.
 *
 * `server.listen(0)` draws from the same ephemeral range as everything else,
 * and node's `fetch` refuses the same list of ports before it opens a socket —
 * `TypeError: fetch failed { cause: Error: bad port }`. A one-handler server is
 * no less exposed to that than the whole UI is; it was simply too small to look
 * like a server, which is exactly how the gap survived. See
 * `test/ui/unsafe-ports.ts` for the measured list and
 * `TASK-tests-that-bind-a-port-without-the-safe-port-guard-fail-with` for the
 * failure it produces.
 *
 * `create` is taken as a function rather than a live server so a refused port
 * can be discarded and a FRESH server bound: an `http.Server` that has already
 * listened can be re-listened, but a closed one carries its previous state, and
 * "make another one" is the shape that cannot get that subtly wrong.
 *
 * **Loopback only.** Nothing here binds a routable interface; `src/ui/server.ts`
 * refuses to, and a test helper has even less business doing it.
 */
import type { AddressInfo } from 'node:net';
import { createServer as createNetServer } from 'node:net';
import type { Server } from 'node:http';
import { startOnSafePort } from '../ui/unsafe-ports.ts';

export interface SafeListening {
  server: Server;
  port: number;
  /** Close the listener and resolve when it is actually down. */
  stop(): Promise<void>;
}

/**
 * Try to bind `port` on loopback, right now, and let it go again immediately.
 *
 * This is the raw bind `safe-port-gate.test.ts` names as the deliberate,
 * un-fetched exception to its own rule — "the four `net.createServer()`
 * probes reached with `net.connect`... genuinely not exposed to a `bad
 * port`". Nothing here ever hands the bound socket to `fetch` or a browser;
 * the whole point is to ask the OS a yes/no question about ONE port and let
 * go, which is a different question from "start a server a test will talk
 * to" — `listenOnSafePort` above answers that one, on a port IT draws, never
 * one a caller names.
 *
 * `test/ui/unsafe-ports.test.ts` uses this to find, among the ports Chrome
 * and node's `fetch` refuse, one this machine will actually let a socket bind
 * to — so its two real-server cases can pin a port that is both refused by a
 * consumer and bindable here, instead of a hardcoded number that an OS-level
 * exclusion (Hyper-V/WSL reservations on Windows, say) can refuse before the
 * product's own screen ever sees it.
 *
 * Resolves `null` when the OS let the bind through, or the OS's own refusal —
 * `code`/`message`, not a canned string — when it did not, so a caller
 * sweeping several candidates can report what actually happened.
 */
export function probeBindable(port: number): Promise<string | null> {
  return new Promise((resolve) => {
    const probe = createNetServer();
    probe.once('error', (err: NodeJS.ErrnoException) => {
      resolve(`${port}: ${err.code ?? err.message}`);
    });
    probe.listen(port, '127.0.0.1', () => {
      probe.close(() => resolve(null));
    });
  });
}

/** Bind `create()`'s server to an OS-chosen port no consumer refuses. */
export function listenOnSafePort(create: () => Server): Promise<SafeListening> {
  return startOnSafePort(async () => {
    const server = create();
    await new Promise<void>((done, fail) => {
      // A bind that FAILS is an answer, and `startOnSafePort` propagates it on
      // the first attempt rather than asking four more times.
      server.once('error', fail);
      server.listen(0, '127.0.0.1', () => { done(); });
    });
    const address = server.address() as AddressInfo | string | null;
    const port = typeof address === 'object' && address !== null ? address.port : 0;
    return {
      server,
      port,
      stop: (): Promise<void> => new Promise<void>((done) => { server.close(() => { done(); }); }),
    };
  });
}
