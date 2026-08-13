import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { resolveServerCwd } from '../../src/mcp/server.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

interface Harness {
  send(message: unknown): void;
  responses(count: number): Promise<Record<string, unknown>[]>;
  stderr(): string;
  // Resolves once the child has actually exited. On Windows, deleting the
  // child's cwd immediately after kill() races the OS releasing its handle
  // on that directory and fails with EPERM; awaiting 'exit' first avoids it.
  stop(): Promise<void>;
}

function start(cwd: string): Harness {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, [SERVER], {
    cwd, stdio: ['pipe', 'pipe', 'pipe'],
  });

  let out = '';
  let err = '';
  const seen: Record<string, unknown>[] = [];
  const waiters: (() => void)[] = [];

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    out += chunk;
    for (;;) {
      const newline = out.indexOf('\n');
      if (newline < 0) break;
      const line = out.slice(0, newline);
      out = out.slice(newline + 1);
      if (line.trim() !== '') seen.push(JSON.parse(line) as Record<string, unknown>);
    }
    for (const notify of waiters.splice(0)) notify();
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { err += chunk; });

  return {
    send: (message) => child.stdin.write(JSON.stringify(message) + '\n'),
    async responses(count) {
      const deadline = Date.now() + 15_000;
      while (seen.length < count && Date.now() < deadline) {
        await new Promise<void>((resolve) => {
          waiters.push(resolve);
          setTimeout(resolve, 100);
        });
      }
      assert.ok(seen.length >= count, `expected ${count} responses, got ${seen.length}; stderr: ${err}`);
      return seen.slice(0, count);
    },
    stderr: () => err,
    stop: () => new Promise<void>((resolve) => {
      child.once('exit', () => resolve());
      child.stdin.end();
      child.kill();
    }),
  };
}

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-e2e-'));
  runCli(['init'], cwd, () => {});
  return cwd;
}

test('resolveServerCwd prefers CLAUDE_PROJECT_DIR', () => {
  assert.equal(resolveServerCwd({ CLAUDE_PROJECT_DIR: '/repo' }, '/elsewhere'), '/repo');
  assert.equal(resolveServerCwd({}, '/elsewhere'), '/elsewhere');
  assert.equal(resolveServerCwd({ CLAUDE_PROJECT_DIR: '' }, '/elsewhere'), '/elsewhere');
});

test('a legacy client can initialize, list and call tools over stdio', async () => {
  const cwd = project();
  const harness = start(cwd);

  harness.send({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: {
      protocolVersion: '2025-06-18', capabilities: {},
      clientInfo: { name: 'test', version: '1' },
    },
  });
  harness.send({ jsonrpc: '2.0', method: 'notifications/initialized' });
  harness.send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  harness.send({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: {
      name: 'create_item',
      arguments: { type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'] },
    },
  });

  const [init, list, call] = await harness.responses(3);

  assert.equal((init.result as Record<string, unknown>).protocolVersion, '2025-06-18');
  const tools = (list.result as { tools: { name: string }[] }).tools;
  assert.equal(tools.length, 9);
  assert.ok(tools.some((t) => t.name === 'create_item'));

  const content = (call.result as { content: { text: string }[] }).content;
  assert.match(content[0].text, /CONST-pool-capped-at-20/);
  assert.match(content[0].text, /draft/);

  await harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('a modern client works without any handshake', async () => {
  const cwd = project();
  const harness = start(cwd);

  const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' };
  harness.send({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } });
  harness.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta } });

  const [discover, list] = await harness.responses(2);
  const discovered = discover.result as Record<string, unknown>;
  assert.ok((discovered.supportedVersions as string[]).includes('2026-07-28'));
  assert.equal((list.result as Record<string, unknown>).resultType, 'complete');

  await harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('a rejected call arrives as content the model can read', async () => {
  const cwd = project();
  const harness = start(cwd);

  harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  harness.send({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'create_item', arguments: { type: 'requirment', title: 'X' } },
  });

  const [, call] = await harness.responses(2);
  const result = call.result as { isError: boolean; content: { text: string }[] };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /closest match is "requirement"/);

  await harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('nothing but MCP messages reaches stdout', async () => {
  const cwd = project();
  const harness = start(cwd);
  harness.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const [pong] = await harness.responses(1);
  assert.deepEqual(pong, { jsonrpc: '2.0', id: 1, result: {} });
  await harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});

test('the server survives a workspace it cannot use', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const harness = start(cwd);

  harness.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
  harness.send({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'create_item', arguments: { type: 'constraint', title: 'X' } },
  });

  const [list, call] = await harness.responses(2);
  assert.equal((list.result as { tools: unknown[] }).tools.length, 9);
  const result = call.result as { isError: boolean; content: { text: string }[] };
  assert.equal(result.isError, true);
  assert.match(result.content[0].text, /mycontext init/);

  await harness.stop();
  rmSync(cwd, { recursive: true, force: true });
});
