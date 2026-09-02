import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorkspace, destroyWorkspace } from '../lib/workspace.mjs';
import { openMcp } from '../lib/mcp.mjs';

test('handshake succeeds and lists 14 tools', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  const tools = await mcp.listTools();
  assert.equal(tools.length, 14);
  assert.ok(tools.some((t) => t.name === 'load_context'));
  await mcp.close();
  await destroyWorkspace(ws);
});

test('an undeclared argument is refused', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  const res = await mcp.callTool('load_context', { nope: 1 });
  const text = JSON.stringify(res);
  assert.match(text, /nope/, 'the refusal names the offending argument');
  await mcp.close();
  await destroyWorkspace(ws);
});

test('a JSON-RPC top-level error round-trips to a protocolError', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  const res = await mcp.callTool('no_such_tool', {});
  assert.ok(res.protocolError, 'resolves with a protocolError instead of throwing');
  assert.match(res.protocolError, /-32602/);
  assert.match(res.protocolError, /no_such_tool/);
  await mcp.close();
  await destroyWorkspace(ws);
});

test('a dead child does not crash the process', async () => {
  const ws = await createWorkspace();
  const mcp = await openMcp(ws);
  await mcp.close();
  const res = await mcp.callTool('load_context', {});
  assert.ok(res.protocolError, 'resolves with a protocolError instead of throwing or hanging');
  await destroyWorkspace(ws);
});
