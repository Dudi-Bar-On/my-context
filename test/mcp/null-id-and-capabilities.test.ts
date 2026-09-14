// @basis TASK-a-request-with-a-null-id-gets-no-response-ever-and-two, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mcpsurface/3`: a request with a null id used to get no response, ever.**
 *
 * The defect and the fix both turn on one sentence of JSON-RPC 2.0 §4.1 —
 * *"A Notification is a Request object without an 'id' member."* `id: null` is
 * a member, so `{"id": null, "method": "ping"}` is a REQUEST. The MCP base
 * protocol then says of it: *"Requests MUST include a string or integer ID.
 * Unlike base JSON-RPC, the ID MUST NOT be `null`."* — a malformed request,
 * which is answered, not dropped. Only a notification earns silence, and only
 * for a notification does *"The receiver MUST NOT send a response"* apply.
 *
 * ── EVERY WAIT IN THIS FILE IS BOUNDED, ON PURPOSE ──────────────────────────
 *
 * The subject is a HANG. A test that waits for a response it is not going to
 * get is the same hang wearing a test's name, and
 * `LESSON-a-removal-proof-can-hang-instead-of-failing-and-nothing` is what that
 * costs here. So `collect` never waits for a message — it waits a fixed
 * `SETTLE_MS` and then reports whatever arrived, including nothing. A broken
 * server makes these tests FAIL; it cannot make them run forever.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  CAPABILITIES, NULL_ID_REFUSAL, SUPPORTED_PROTOCOL_VERSIONS,
  createSession, serveStdio,
} from '../../src/mcp/protocol.ts';
import type { JsonRpcMessage, JsonRpcResponse, ToolRegistry } from '../../src/mcp/protocol.ts';

const registry: ToolRegistry = {
  list: () => [{
    name: 'echo',
    description: 'Echo the text back. Not for: anything useful.',
    inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    annotations: { readOnlyHint: true, openWorldHint: false },
  }],
  call: (_name, args) => `echo: ${String(args.text)}`,
};

const session = () => createSession(registry);

/** Long enough for a synchronous write to have landed; short enough to never matter. */
const SETTLE_MS = 100;

interface Framed { jsonrpc: string; id: string | number | null; result?: unknown; error?: { code: number; message: string } }

/**
 * Writes `lines` at the transport and returns whatever came back after a FIXED
 * wait — never "wait until a response arrives", which is the hang itself.
 */
function collect(
  lines: string[],
  target: { handle(m: JsonRpcMessage): JsonRpcResponse | null } = session(),
): Promise<Framed[]> {
  return new Promise((resolve) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
    serveStdio(input, output, target);
    for (const line of lines) input.write(line);
    setTimeout(() => {
      resolve(
        chunks.join('').split('\n').filter((l) => l !== '').map((l) => JSON.parse(l) as Framed),
      );
    }, SETTLE_MS);
  });
}

const PING_NULL_ID = '{"jsonrpc":"2.0","id":null,"method":"ping"}\n';
const PING_99 = '{"jsonrpc":"2.0","id":99,"method":"ping"}\n';

test('a request whose id is null is ANSWERED, and the transport is not the thing that was broken', async () => {
  // Two messages, and the second is the control. Before the fix this produced
  // exactly one line — the id 99 reply — which is the proof that the stream was
  // alive and reading, and that the null-id message specifically was swallowed.
  // Without the control a reader could not tell a swallowed message from a
  // transport that had stopped.
  const got = await collect([PING_NULL_ID, PING_99]);

  const answered = got.find((m) => m.id === null);
  assert.notEqual(
    answered, undefined,
    'a request with id null got no response at all — this is the hang mcpsurface/3 names',
  );
  assert.equal(answered!.error?.code, -32600, 'JSON-RPC Invalid Request');
  assert.equal(answered!.result, undefined, 'a response sets error or result, never both');

  assert.equal(got.find((m) => m.id === 99)?.result !== undefined, true, 'control: stream alive');
  assert.equal(got.length, 2, 'exactly one answer per request, and no extra chatter');
});

test('the answer to a null-id request carries id null, because JSON-RPC 2.0 allows it no other value', () => {
  // §5, on the Response `id`: "If there was an error in detecting the id in the
  // Request object (e.g. Parse error/Invalid Request), it MUST be Null."
  const response = session().handle({ jsonrpc: '2.0', id: null, method: 'ping' });
  assert.notEqual(response, null, 'handle() returned null — the session itself dropped it');
  assert.equal(response!.id, null);
  assert.equal(response!.jsonrpc, '2.0');
  assert.equal(response!.error?.message, NULL_ID_REFUSAL);
});

test('the refusal names both shapes the sender could have meant', () => {
  // Not a golden string: the two ROUTES OUT are what make this refusal useful
  // rather than merely correct, and a message that named neither would leave a
  // client with a -32600 and no next move.
  assert.match(NULL_ID_REFUSAL, /string or (an )?integer id/i);
  assert.match(NULL_ID_REFUSAL, /omit the "id" member/i);
});

test('a real notification — no id member at all — still gets no response', async () => {
  // The other direction, and the reason the fix is a narrowed predicate rather
  // than a removed one. "MUST NOT send a response" is still absolute here.
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'ping' }), null);
  assert.deepEqual(await collect(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n']), []);
});

test('a null-id request that makes the session THROW is still answered', async () => {
  // The SECOND site. `serveStdio`'s catch block carried its own copy of the
  // "id null means notification" test, so fixing only `createSession` would
  // have left the hang in place on the one path where something had already
  // gone wrong.
  const throwing = {
    handle(message: JsonRpcMessage): JsonRpcResponse | null {
      throw new Error(`boom handling ${String(message.method)}`);
    },
  };
  const got = await collect([PING_NULL_ID], throwing);
  assert.equal(got.length, 1, 'a throwing session swallowed a null-id request');
  assert.equal(got[0]!.id, null);
  assert.equal(got[0]!.error?.code, -32603);

  // ...and a genuine notification that throws is still silent, from the same site.
  assert.deepEqual(
    await collect(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n'], throwing), [],
  );
});

test('a malformed envelope is refused before it can negotiate a protocol version', () => {
  // Ordering, and it is a real property rather than a preference: the version
  // check assigns `negotiated` as a side effect, so a request the server is
  // about to refuse must not get to change how it answers every LATER message.
  const s = session();
  const refused = s.handle({
    jsonrpc: '2.0', id: null, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
  });
  assert.equal(refused!.error?.code, -32600, 'the envelope is judged before its contents');

  // If the refused message HAD negotiated 2026-07-28, this next result would
  // come back decorated. It must not.
  const after = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' })!
    .result as Record<string, unknown>;
  assert.equal(
    after.resultType, undefined,
    'a refused request negotiated a version for the session that followed it',
  );
});

test('an unsupported version announced on a null-id request loses to the null id', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: null, method: 'ping',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1999-01-01' } },
  });
  assert.equal(response!.error?.code, -32600);
});

test('initialize and server/discover advertise the SAME capabilities', () => {
  // The assertion `mcpsurface/3`'s second half asks for, and it compares the
  // two ROUTES against each other rather than each against a literal: a copy of
  // the expected value in this file would go stale in exactly the way the two
  // copies in the source did, and could not detect them diverging.
  const s = session();
  const init = s.handle({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18' },
  })!.result as Record<string, unknown>;
  const discover = s.handle({ jsonrpc: '2.0', id: 2, method: 'server/discover' })!
    .result as Record<string, unknown>;

  assert.deepEqual(
    init.capabilities, discover.capabilities,
    'two routes told a client different things about the same server',
  );

  // Equal is not enough on its own — equally WRONG would also be equal. This is
  // the truthfulness half: the tool list is built once and required to be
  // byte-stable for prompt caching, so this server really never emits
  // notifications/tools/list_changed.
  assert.deepEqual(init.capabilities, { tools: { listChanged: false } });
  assert.deepEqual(discover.supportedVersions, SUPPORTED_PROTOCOL_VERSIONS);
});

test('the one capabilities declaration cannot be mutated by whoever gets handed it', () => {
  // Two responses share one object. "One answer" is only true while it stays
  // one answer, so it is frozen rather than trusted.
  assert.equal(Object.isFrozen(CAPABILITIES), true);
  assert.equal(Object.isFrozen(CAPABILITIES.tools), true);
});

test('a failing stream is reported on the diagnostics channel, not thrown and not onto stdout', async () => {
  // A stream that emits `error` with no listener is re-thrown by Node as an
  // uncaught exception; on `output` that throw happens inside the `data`
  // handler and takes the read loop with it. Either way the client waits on a
  // reply that is never coming, and nothing says why.
  const said: string[] = [];
  const input = new PassThrough();
  const output = new PassThrough();
  const framed: string[] = [];
  output.on('data', (c: Buffer) => framed.push(c.toString('utf8')));
  serveStdio(input, output, session(), (line) => said.push(line));

  // Would throw out of this call if nothing were listening.
  input.emit('error', new Error('EPIPE'));
  output.emit('error', new Error('write after end'));

  assert.equal(said.length, 2);
  assert.match(said[0]!, /input stream failed: EPIPE/);
  assert.match(said[1]!, /output stream failed: write after end/);
  // The framed channel carries JSON-RPC and nothing else — a diagnostic written
  // there would corrupt the one stream a client parses.
  assert.deepEqual(framed, []);
});
