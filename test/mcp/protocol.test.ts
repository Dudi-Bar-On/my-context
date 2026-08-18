import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS,
  MAX_PENDING_LINE_LENGTH, createSession, serveStdio,
} from '../../src/mcp/protocol.ts';
import type { ToolRegistry, JsonRpcMessage, JsonRpcResponse } from '../../src/mcp/protocol.ts';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * The version `package.json` declares, read here independently.
 *
 * These assertions used to pin the literal `'0.1.0'`, so that a corrupted
 * version string could not agree with itself. That held, and it also meant the
 * one place that would have caught `SERVER_INFO` drifting from the manifests
 * was itself a copy of the number — it stayed at `0.1.0` through two releases
 * while `package.json` reached `1.0.0`, and asserted that the drift was
 * correct. Reading the owning declaration keeps the property that mattered —
 * this is not `SERVER_INFO`, so a mutation there cannot agree with itself —
 * and turns the test into the one that catches the drift instead of blessing it.
 */
const PACKAGE_VERSION = (
  JSON.parse(
    readFileSync(path.join(import.meta.dirname, '..', '..', 'package.json'), 'utf8'),
  ) as { version: string }
).version;

const registry: ToolRegistry = {
  list: () => [
    {
      name: 'echo',
      description: 'Echo the text back. Not for: anything useful.',
      inputSchema: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] },
    },
  ],
  call: (name, args) => {
    if (args.text === 'boom') throw new Error('my_context: "text" must not be "boom".');
    return `echo: ${String(args.text)}`;
  },
};

function session() {
  return createSession(registry);
}

test('initialize echoes a supported protocol version', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'c', version: '1' } },
  })!;
  const result = response.result as Record<string, unknown>;
  assert.equal(response.id, 1);
  assert.equal(result.protocolVersion, '2025-06-18');
  assert.deepEqual(result.capabilities, { tools: { listChanged: false } });
  // Pinned against `package.json`, not against the imported SERVER_INFO
  // constant itself — comparing against the same mutated source would
  // trivially agree with itself and never catch a corrupted version string.
  assert.deepEqual(result.serverInfo, { name: 'mycontext', version: PACKAGE_VERSION });
  assert.match(result.instructions as string, /mycontext_help\("capture"\)/);
});

test('the supported version list includes the oldest revision still in wide client use', () => {
  assert.ok(SUPPORTED_PROTOCOL_VERSIONS.includes('2024-11-05'));
});

test('every supported protocol version is echoed back verbatim by initialize', () => {
  for (const version of SUPPORTED_PROTOCOL_VERSIONS) {
    const result = session().handle({
      jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: version },
    })!.result as Record<string, unknown>;
    assert.equal(result.protocolVersion, version);
  }
});

test('initialize with an unknown version answers with the latest supported', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '1900-01-01' },
  })!.result as Record<string, unknown>;
  assert.equal(result.protocolVersion, LATEST_PROTOCOL_VERSION);
});

test('a notification never produces a response', () => {
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'notifications/cancelled' }), null);
  assert.equal(session().handle({ jsonrpc: '2.0', method: 'nonsense/unknown' }), null);
});

test('tools/list returns the registry and no cursor', () => {
  const result = session().handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })!
    .result as Record<string, unknown>;
  const tools = result.tools as { name: string }[];
  assert.deepEqual(tools.map((t) => t.name), ['echo']);
  assert.equal('nextCursor' in result, false);
});

test('tools/call wraps the result as text content', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'echo', arguments: { text: 'hi' } },
  })!.result as Record<string, unknown>;
  assert.deepEqual(result.content, [{ type: 'text', text: 'echo: hi' }]);
  assert.equal(result.isError, false);
});

test('a rejected tool call is a result with isError, not a protocol error', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'echo', arguments: { text: 'boom' } },
  })!;
  assert.equal(response.error, undefined);
  const result = response.result as Record<string, unknown>;
  assert.equal(result.isError, true);
  assert.match((result.content as { text: string }[])[0].text, /must not be "boom"/);
});

test('an unknown tool is a protocol error', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 5, method: 'tools/call', params: { name: 'nope', arguments: {} },
  })!;
  assert.equal(response.error?.code, -32602);
  assert.match(response.error!.message, /Unknown tool: nope/);
});

test('tools/call without arguments passes an empty object', () => {
  const result = session().handle({
    jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'echo' },
  })!.result as Record<string, unknown>;
  assert.deepEqual(result.content, [{ type: 'text', text: 'echo: undefined' }]);
});

test('an unknown method with an id is method-not-found', () => {
  const response = session().handle({ jsonrpc: '2.0', id: 7, method: 'resources/list' })!;
  assert.equal(response.error?.code, -32601);
});

test('ping answers empty for legacy clients', () => {
  assert.deepEqual(session().handle({ jsonrpc: '2.0', id: 8, method: 'ping' })!.result, {});
});

test('server/discover advertises every supported version', () => {
  const result = session().handle({ jsonrpc: '2.0', id: 9, method: 'server/discover' })!
    .result as Record<string, unknown>;
  assert.deepEqual(result.supportedVersions, SUPPORTED_PROTOCOL_VERSIONS);
  assert.deepEqual(result.capabilities, { tools: {} });
  assert.equal(result.resultType, 'complete');
  const meta = result._meta as Record<string, { name: string }>;
  assert.equal(meta['io.modelcontextprotocol/serverInfo'].name, 'mycontext');
});

test('a modern client announcing 2026-07-28 in _meta gets decorated results', () => {
  const s = session();
  const result = s.handle({
    jsonrpc: '2.0', id: 10, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' } },
  })!.result as Record<string, unknown>;
  assert.equal(result.resultType, 'complete');
  assert.equal(typeof result.ttlMs, 'number');
  assert.equal(result.cacheScope, 'public');
  const meta = result._meta as Record<string, { name: string; version: string }>;
  assert.deepEqual(
    meta['io.modelcontextprotocol/serverInfo'], { name: 'mycontext', version: PACKAGE_VERSION },
  );
});

test('a legacy client gets no 2026 fields', () => {
  const s = session();
  s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  const result = s.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' })!
    .result as Record<string, unknown>;
  assert.equal('resultType' in result, false);
  assert.equal('ttlMs' in result, false);
});

test('an unsupported announced version is rejected with -32022 and the supported list', () => {
  const response = session().handle({
    jsonrpc: '2.0', id: 11, method: 'tools/list',
    params: { _meta: { 'io.modelcontextprotocol/protocolVersion': '1900-01-01' } },
  })!;
  assert.equal(response.error?.code, -32022);
  const data = response.error!.data as Record<string, unknown>;
  assert.deepEqual(data.supported, SUPPORTED_PROTOCOL_VERSIONS);
  assert.equal(data.requested, '1900-01-01');
});

test('a message with no method and an id is an invalid request', () => {
  const response = session().handle({ jsonrpc: '2.0', id: 12 })!;
  assert.equal(response.error?.code, -32600);
});

function drive(
  lines: string[],
  target: { handle(message: JsonRpcMessage): JsonRpcResponse | null } = session(),
): Promise<string[]> {
  return new Promise((resolve) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
    serveStdio(input, output, target);
    for (const line of lines) input.write(line);
    setImmediate(() => resolve(chunks.join('').split('\n').filter((l) => l !== '')));
  });
}

test('stdio framing reads newline-delimited messages, including split writes', async () => {
  const lines = await drive([
    '{"jsonrpc":"2.0","id":1,"method":"ping"}\n{"jsonrpc":"2.0","id":2,',
    '"method":"ping"}\n',
  ]);
  assert.equal(lines.length, 2);
  assert.deepEqual(JSON.parse(lines[0]), { jsonrpc: '2.0', id: 1, result: {} });
  assert.deepEqual(JSON.parse(lines[1]), { jsonrpc: '2.0', id: 2, result: {} });
});

test('every written line is a single line of valid JSON', async () => {
  const lines = await drive([
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":' +
    '{"name":"echo","arguments":{"text":"a\\nb"}}}\n',
  ]);
  assert.equal(lines.length, 1);
  const parsed = JSON.parse(lines[0]) as { result: { content: { text: string }[] } };
  assert.equal(parsed.result.content[0].text, 'echo: a\nb');
});

test('malformed JSON yields a parse error and does not kill the loop', async () => {
  const lines = await drive(['not json\n', '{"jsonrpc":"2.0","id":2,"method":"ping"}\n']);
  assert.equal(JSON.parse(lines[0]).error.code, -32700);
  assert.equal(JSON.parse(lines[1]).id, 2);
});

test('blank lines and CRLF endings are tolerated', async () => {
  const lines = await drive(['\n', '{"jsonrpc":"2.0","id":1,"method":"ping"}\r\n']);
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).id, 1);
});

test('a CR embedded in message content, not at line end, round-trips intact', async () => {
  const lines = await drive([
    '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":' +
    '{"name":"echo","arguments":{"text":"a\\rb"}}}\r\n',
  ]);
  assert.equal(lines.length, 1);
  // The framed output line itself must carry no raw CR byte, whether from
  // the line's own CRLF terminator or from JSON.stringify re-escaping the
  // embedded one back into "\r" text.
  assert.equal(lines[0].includes('\r'), false);
  const parsed = JSON.parse(lines[0]) as { result: { content: { text: string }[] } };
  assert.equal(parsed.result.content[0].text, 'echo: a\rb');
});

test('a notification writes nothing at all', async () => {
  const lines = await drive(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n']);
  assert.deepEqual(lines, []);
});

test('a pending buffer beyond the max length is rejected eagerly, with no newline ever arriving', async () => {
  // No trailing newline anywhere in this write, and none ever follows: the
  // *only* way a response can appear at all is the no-newline branch's own
  // proactive length check. This isolates that branch specifically from
  // the "complete oversized line" check below — without the eager check, a
  // client that simply never sends '\n' would grow `buffer` unboundedly
  // for the life of the connection with no response ever written back.
  const huge = 'x'.repeat(MAX_PENDING_LINE_LENGTH + 1);
  const lines = await drive([huge]);
  assert.equal(lines.length, 1);
  const err = JSON.parse(lines[0]) as { error: { code: number; message: string } };
  assert.equal(err.error.code, -32700);
  assert.match(err.error.message, /too long/i);
});

test('after an eager rejection, the buffer is clear and the stream accepts the next message normally', async () => {
  const huge = 'x'.repeat(MAX_PENDING_LINE_LENGTH + 1);
  const lines = await drive([huge, '\n{"jsonrpc":"2.0","id":1,"method":"ping"}\n']);
  assert.equal(lines.length, 2);
  assert.equal(JSON.parse(lines[0]).error.code, -32700);
  assert.equal(JSON.parse(lines[1]).id, 1);
});

test('a single write containing an already-complete oversized line is also rejected, and the stream recovers', async () => {
  // Unlike the previous test, this line already carries its own trailing
  // '\n' in the very first chunk — the no-newline branch never fires here,
  // since a newline is present from the start. This pins the other half of
  // the cap: a single oversized write, not a slow no-newline trickle.
  const huge = 'x'.repeat(MAX_PENDING_LINE_LENGTH + 1);
  const lines = await drive([
    `${huge}\n`,
    '{"jsonrpc":"2.0","id":1,"method":"ping"}\n',
  ]);
  assert.equal(lines.length, 2);
  const first = JSON.parse(lines[0]) as { error: { code: number; message: string } };
  assert.equal(first.error.code, -32700);
  assert.match(first.error.message, /too long/i);
  assert.equal(JSON.parse(lines[1]).id, 1);
});

test('a session that throws handling a notification gets no reply at all', async () => {
  const throwingSession = {
    handle(message: JsonRpcMessage): JsonRpcResponse | null {
      throw new Error(`boom handling ${String(message.method)}`);
    },
  };
  const lines = await drive(
    ['{"jsonrpc":"2.0","method":"notifications/initialized"}\n'],
    throwingSession,
  );
  assert.deepEqual(lines, []);
});
