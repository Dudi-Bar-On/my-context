/**
 * Spawns `src/ui/server.ts` as a real child process (the way
 * `test/mcp/server-e2e.test.ts` spawns the MCP server) and waits for its
 * readiness line. The server prints exactly one line to stdout when listening:
 *
 *   mycontext ui: http://127.0.0.1:<port>/#<nonce>
 *
 * The harness parses port and nonce; the TEST exchanges the nonce for the token
 * over HTTP, which exercises the handoff path on every run.
 *
 * **stderr is captured into the same buffer as stdout, and that is not tidiness.**
 * Every way this server refuses to start — a non-loopback host, a malformed
 * `--idle-ms`, no workspace — prints one line to stderr and exits 1. With stdout
 * alone the rejection reads `ui server exited early (1):` with nothing after the
 * colon, which is indistinguishable from a crash, from a hang, and from the
 * harness itself being broken. This project has already spent one four-minute
 * heap-OOM on a failure that could not say which input produced it.
 *
 * **`stop()` checks whether the child is already gone before waiting for its
 * exit.** The idle test's whole point is that the process exits on its own, so
 * by the time its `finally` runs there is no `exit` event left to fire — a bare
 * `child.once('exit', …); child.kill();` would wait for an event that has
 * already happened and hang the file until the runner's timeout.
 *
 * **`startUiChild` does not return a port Chrome refuses.** `--port 0` asks the
 * OS for a free port, and the OS answers without knowing who will connect;
 * Chrome refuses 80 specific ports outright with `net::ERR_UNSAFE_PORT`, and on
 * this machine 17 of them sit inside the ephemeral range. Drawing one killed a
 * browser run on 2026-08-23 with no assertion behind it. `startOnSafePort` is
 * the check that was missing — see `unsafe-ports.ts` for the measurement, the
 * retry bound, and why a fixed port was not the answer.
 */
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { connect } from 'node:net';
import { fileURLToPath } from 'node:url';
import { startOnSafePort } from './unsafe-ports.ts';
import '../helpers/pin-sessions-dir.ts';

const SERVER = fileURLToPath(new URL('../../src/ui/server.ts', import.meta.url));

/**
 * **No harness-started server may touch the developer's real session store.**
 *
 * Done by importing `../helpers/pin-sessions-dir.ts`, which carries the full
 * argument and the measurement.
 *
 * This file used to hold the pin itself, claiming to be "the one file every
 * harness-started server goes through". That was false for a server started IN
 * PROCESS, and the three files that do so wrote the developer's real store on
 * 2026-08-27. The pin moved to a module all of them can import; what remains
 * here is the import, because the servers this file spawns still need it.
 */

/** How long a server may take to print its readiness line before the test gives up. */
const READY_TIMEOUT_MS = 30_000;

export interface UiHarness {
  port: number;
  nonce: string;
  child: ChildProcessWithoutNullStreams;
  /** Everything the child has written to stdout and stderr so far. */
  output(): string;
  stop(): Promise<void>;
}

/**
 * Resolved once the child is listening on a port a browser will open; rejected
 * with the child's output if it never listens at all.
 *
 * The port is not the OS's last word: `startOnSafePort` throws away a child
 * that landed on one of Chrome's refused ports and asks for another, up to a
 * bounded number of attempts. Callers see no difference — the same `UiHarness`,
 * the same rejection on a bad command line — except that the port they are
 * given is one the browser will actually connect to.
 */
export function startUiChild(cwd: string, extraArgs: string[] = []): Promise<UiHarness> {
  return startOnSafePort(() => spawnUiChild(cwd, ['--port', '0', ...extraArgs]));
}

/**
 * One attempt: spawn the server with a complete argv and wait for its readiness
 * line. Exported for `unsafe-ports.test.ts`, which needs to start a REAL server
 * on a port Chrome refuses — `--port 6669` rather than `--port 0` — to
 * demonstrate the retry against real sockets instead of only against a fake.
 * `startUiChild` is the entry point for everyone else.
 */
export function spawnUiChild(cwd: string, args: string[]): Promise<UiHarness> {
  const child = spawn(process.execPath, [SERVER, ...args], { cwd });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  return new Promise((resolve, reject) => {
    let buffer = '';
    const timer = setTimeout(
      () => reject(new Error(`ui server never became ready; output so far: ${buffer}`)),
      READY_TIMEOUT_MS,
    );
    const onChunk = (chunk: string): void => {
      buffer += chunk;
      const match = buffer.match(/http:\/\/127\.0\.0\.1:(\d+)\/#([0-9a-f]+)/);
      if (!match) return;
      clearTimeout(timer);
      resolve({
        port: Number(match[1]),
        nonce: match[2] ?? '',
        child,
        output: () => buffer,
        stop: () => new Promise<void>((done) => {
          // Already gone — the idle test's exit, or a crash. There is no second
          // `exit` event coming, so waiting for one waits forever.
          if (child.exitCode !== null || child.signalCode !== null) { done(); return; }
          child.once('exit', () => done());
          child.kill();
        }),
      });
    };
    child.stdout.on('data', onChunk);
    child.stderr.on('data', onChunk);
    child.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`ui server exited early (${code}): ${buffer}`));
    });
  });
}

export interface UiChildResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Run the server to completion and report what it said — for the command lines
 * that must REFUSE to start. A refusal that exits 1 silently and a refusal that
 * exits 1 having named the bad value are the same test without this.
 */
export function runUiChild(cwd: string, args: string[]): Promise<UiChildResult> {
  const child = spawn(process.execPath, [SERVER, ...args], { cwd });
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (c: string) => { stdout += c; });
  child.stderr.on('data', (c: string) => { stderr += c; });
  return new Promise((resolve) => {
    child.once('exit', (code) => resolve({ code, stdout, stderr }));
  });
}

export interface RawResponse {
  status: number;
  /** The status line and headers, verbatim and lower-cased. */
  head: string;
  /** Everything after the blank line. */
  body: string;
}

/**
 * One request written as bytes on a socket, because `fetch` cannot send the
 * requests that matter most here.
 *
 * A WHATWG URL — which is what `fetch`, `undici` and every browser build a
 * request target from — resolves double-dot segments **including their
 * percent-encodings** before a byte leaves the client: `/%2e%2e/x`, `/.%2e/x`
 * and `/%2E%2E/x` all become `/x`. So no test written with `fetch` can ever
 * put those spellings on the wire, and a server that relied on the client for
 * that normalisation would pass every such test while answering anything a
 * hand-written socket asked it for. That is the whole reason this exists.
 *
 * `HTTP/1.0` so the response body is delimited by the close rather than by
 * chunked framing: this returns the bytes as they arrived, not as a parser
 * reassembled them, and an empty body has to be genuinely empty.
 */
export interface RawOptions {
  /** The `Host` to send. `null` omits the header entirely — legal in HTTP/1.0. */
  host?: string | null;
  /** Extra header lines, each without its CRLF. */
  headers?: string[];
}

export function rawGet(port: number, target: string, options: RawOptions = {}): Promise<RawResponse> {
  const host = options.host === undefined ? `127.0.0.1:${port}` : options.host;
  return new Promise((resolve, reject) => {
    const socket = connect(port, '127.0.0.1', () => {
      socket.write(
        `GET ${target} HTTP/1.0\r\n` +
        (host === null ? '' : `Host: ${host}\r\n`) +
        (options.headers ?? []).map((h) => `${h}\r\n`).join('') + '\r\n',
      );
    });
    socket.setEncoding('utf8');
    let raw = '';
    socket.on('data', (chunk: string) => { raw += chunk; });
    socket.on('error', reject);
    socket.on('end', () => {
      const split = raw.indexOf('\r\n\r\n');
      const head = split === -1 ? raw : raw.slice(0, split);
      const body = split === -1 ? '' : raw.slice(split + 4);
      const status = Number(head.match(/^HTTP\/1\.[01] (\d{3})/)?.[1] ?? 0);
      resolve({ status, head: head.toLowerCase(), body });
    });
  });
}

/** Exchange a one-shot handoff nonce for the session token, over real HTTP. */
export async function redeemNonce(port: number, nonce: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/api/handoff`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nonce }),
  });
  if (response.status !== 200) throw new Error(`handoff refused: ${response.status}`);
  return ((await response.json()) as { token: string }).token;
}
