// @basis TASK-twenty-one-one-line-swallows-where-the-docstring-asserts, INV-nothing-is-dropped-silently, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`swallow/11` · m21: neither stream carried an `end` or a `close` handler,
 * so a final request with no trailing newline was never parsed, never
 * answered, and never logged.**
 *
 * Half of m21 was closed by `mcpsurface/3`, which added the `error` listeners
 * that stop a broken pipe from being re-thrown as a raw stack trace
 * (`test/mcp/null-id-and-capabilities.test.ts` holds that half). The other half
 * is the quiet one: `serveStdio` frames on `\n`, so everything after the last
 * newline sits in `buffer` — and when the input ends, that buffer is dropped
 * with the closure it lived in. A client that wrote a request and closed its
 * side without the newline gets no response, no error and no diagnostic, which
 * is the same hang `mcpsurface/3` was raised about wearing a different cause.
 *
 * ── WHY IT IS DISCLOSED AND NOT ANSWERED ──────────────────────────────────
 *
 * A response cannot honestly be sent: the framing says the message is not over,
 * so what is in the buffer may be half a message, and JSON-RPC's own rule for
 * an id it could not detect is a null id — which is what the parse-error branch
 * already writes for a line that at least ARRIVED. Answering a fragment would
 * be guessing at what the sender meant, and the stream it would be written to
 * has just ended. So the buffer is reported on `diagnostics`, which is the
 * channel `reportStreamError` established for exactly this: transport-level
 * facts, on stderr, never onto the framed stream a client parses.
 *
 * ── THE BYTES ARE COUNTED AND NOT ECHOED ──────────────────────────────────
 *
 * The dropped text is caller-supplied and unbounded — up to
 * `MAX_PENDING_LINE_LENGTH` — and the sender already knows what it sent. A
 * COUNT is what the reader on stderr does not have, and it is what separates
 * "the client closed cleanly" from "the client lost a message here".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import { spawn } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { createSession, serveStdio } from '../../src/mcp/protocol.ts';
import type { ToolRegistry } from '../../src/mcp/protocol.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

const registry: ToolRegistry = {
  list: () => [{
    name: 'echo',
    description: 'Echo the text back. Not for: anything useful.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }],
  call: (_name, args) => `echo: ${String(args.text)}`,
};

/** Long enough for a synchronous write to have landed; short enough to never matter. */
const SETTLE_MS = 100;

const settle = (): Promise<void> => new Promise((r) => { setTimeout(r, SETTLE_MS); });

interface Run { said: string[]; framed: string[] }

/**
 * Writes `chunks`, ends the input, and reports both channels after a FIXED
 * wait. Never "wait until something arrives" — the subject here is a hang, and
 * a test that waits for a message it is not going to get is that hang wearing
 * a test's name (`LESSON-a-removal-proof-can-hang-instead-of-failing-and-nothing`).
 */
async function endAfter(chunks: string[]): Promise<Run> {
  const said: string[] = [];
  const framed: string[] = [];
  const input = new PassThrough();
  const output = new PassThrough();
  output.on('data', (c: Buffer) => framed.push(c.toString('utf8')));
  serveStdio(input, output, createSession(registry), (line) => said.push(line));
  for (const chunk of chunks) input.write(chunk);
  input.end();
  await settle();
  return { said, framed };
}

test('input that ends in the middle of a message says so, on stderr', async () => {
  // No trailing newline: the whole request is sitting in `buffer` when the
  // stream ends, and the client is waiting for a reply to it.
  const { said, framed } = await endAfter(['{"jsonrpc":"2.0","id":7,"method":"ping"}']);

  assert.equal(
    said.length, 1,
    'the input ended holding a whole request and nothing anywhere said so — the client waits ' +
    'forever and the server exits believing it was done',
  );
  assert.match(said[0]!, /ended/u);
  assert.match(
    said[0]!, /40 byte/u,
    'the count is the part the reader does not already have: it is what separates a clean ' +
    'close from a message that was lost here',
  );
  // The framed channel carries JSON-RPC and nothing else. A diagnostic written
  // there would corrupt the one stream a client parses — `Diagnostics`' own rule.
  assert.deepEqual(framed, []);
});

test('an input that ends cleanly says nothing at all', async () => {
  // Anti-vacuity, and it is the whole of the "is the condition IDENTIFIED"
  // question: every well-behaved client in the world ends exactly like this,
  // and a line on that path would be noise on every session.
  const { said, framed } = await endAfter([
    '{"jsonrpc":"2.0","id":7,"method":"ping"}\n',
    '   \n',
  ]);
  assert.deepEqual(said, [], 'an ordinary close was reported as a lost message');
  assert.equal(framed.length, 1, 'the ping that DID arrive was answered');
});

test('the message that arrived is still answered, and the fragment is reported beside it', async () => {
  // The two halves in one stream, because the failure this pins is a partial
  // one: a transport that answered everything it framed and silently dropped
  // the tail. A test with only the fragment could not tell that apart from a
  // transport that had stopped reading altogether.
  const { said, framed } = await endAfter([
    '{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,"metho',
  ]);
  assert.equal(framed.length, 1);
  assert.equal((JSON.parse(framed[0]!) as { id: number }).id, 1);
  assert.equal(said.length, 1);
  assert.match(said[0]!, /ended/u);
});

/* ---------------------------------------------------------------------------
 * AND IT REACHES THE REAL SERVER'S STDERR.
 *
 * Everything above drives `serveStdio` with two `PassThrough`s, which is the
 * right shape for the branch but proves nothing about `process.stdin`. The
 * event this rests on is `end` on a real pipe closed by a real parent, and
 * `src/mcp/server.ts` calls `process.stdin.resume()` — a flowing stream is
 * what makes `end` arrive at all. So the last test is one child process.
 * ------------------------------------------------------------------------- */

test('the real server says it on stderr when its parent closes stdin mid-message', async () => {
  // A THROWAWAY workspace, never this repository: the server opens whatever
  // corpus its cwd resolves to, and a test that pointed it at the developer's
  // own would be writing into the live audit log to prove a point about stderr.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mcp-tail-'));
  runCli(['init'], cwd, () => {});
  const child = spawn(
    // The same flag Claude Code launches this binary with — the harness must
    // reproduce production and not a quieter variant of it.
    process.execPath,
    ['--disable-warning=ExperimentalWarning', SERVER],
    { cwd, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  let err = '';
  let out = '';
  child.stderr.setEncoding('utf8');
  child.stdout.setEncoding('utf8');
  child.stderr.on('data', (c: string) => { err += c; });
  child.stdout.on('data', (c: string) => { out += c; });

  // One framed request so the run proves the transport was alive, then a
  // fragment and a close. Without the first, a silent stderr could mean the
  // server never started.
  child.stdin.write('{"jsonrpc":"2.0","id":1,"method":"ping"}\n');
  child.stdin.write('{"jsonrpc":"2.0","id":2,"metho');
  child.stdin.end();

  const code = await new Promise<number | null>((resolve) => {
    child.on('exit', (c) => resolve(c));
  });

  assert.match(out, /"id":1/u, 'the framed request was never answered — the run proves nothing');
  assert.match(
    err, /ended with \d+ byte\(s\) after the last newline/u,
    'the real server exited holding a message nobody framed and said nothing about it',
  );
  // Exit code unchanged and deliberately so: a client that closed its side is
  // not a server that failed. `src/mcp/server.ts` reserves a non-zero exit for
  // a startup that did not happen.
  assert.equal(code, 0);
  removeTree(cwd);
});
