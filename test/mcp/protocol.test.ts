import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  LATEST_PROTOCOL_VERSION, SUPPORTED_PROTOCOL_VERSIONS, createSession, serveStdio,
} from '../../src/mcp/protocol.ts';
import type { ToolRegistry } from '../../src/mcp/protocol.ts';

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
  assert.equal((result.serverInfo as { name: string }).name, 'my-context');
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
  assert.equal(meta['io.modelcontextprotocol/serverInfo'].name, 'my-context');
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

function drive(lines: string[]): Promise<string[]> {
  return new Promise((resolve) => {
    const input = new PassThrough();
    const output = new PassThrough();
    const chunks: string[] = [];
    output.on('data', (c: Buffer) => chunks.push(c.toString('utf8')));
    serveStdio(input, output, session());
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

test('a notification writes nothing at all', async () => {
  const lines = await drive(['{"jsonrpc":"2.0","method":"notifications/initialized"}\n']);
  assert.deepEqual(lines, []);
});
