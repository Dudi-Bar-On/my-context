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
  /** Every parsed stdout message seen so far, including any after the count `responses()` waited for. */
  messageCount(): number;
  /** Set once the child has exited; null if it never had — i.e. never spawned or still running. */
  exitInfo(): { code: number | null; signal: NodeJS.Signals | null } | null;
  /**
   * Kills the child and resolves once its stdio streams have fully closed —
   * not merely once it has exited — so that any output written between exit
   * and stream teardown is captured before the caller inspects stdout/stderr.
   *
   * Guards against a child that has already exited: registering a 'close'
   * listener after the event already fired would never resolve, and
   * node:test has no default per-test timeout, so an unguarded wait here
   * turns "server answered then died" into an indefinite CI hang rather than
   * a red test. Idempotent — safe to call more than once per harness.
   */
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
  let exitInfo: { code: number | null; signal: NodeJS.Signals | null } | null = null;
  child.on('exit', (code, signal) => { exitInfo = { code, signal }; });

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
    messageCount: () => seen.length,
    exitInfo: () => exitInfo,
    stop: () => new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
      child.once('close', () => resolve());
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
  try {
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
    assert.equal(tools.length, 11);
    assert.ok(tools.some((t) => t.name === 'create_item'));

    const content = (call.result as { content: { text: string }[] }).content;
    assert.match(content[0].text, /CONST-pool-capped-at-20/);
    assert.match(content[0].text, /draft/);
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('a modern client works without any handshake', async () => {
  const cwd = project();
  const harness = start(cwd);
  try {
    const meta = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28' };
    harness.send({ jsonrpc: '2.0', id: 1, method: 'server/discover', params: { _meta: meta } });
    harness.send({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: { _meta: meta } });

    const [discover, list] = await harness.responses(2);
    const discovered = discover.result as Record<string, unknown>;
    assert.ok((discovered.supportedVersions as string[]).includes('2026-07-28'));
    assert.equal((list.result as Record<string, unknown>).resultType, 'complete');
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('a rejected call arrives as content the model can read', async () => {
  const cwd = project();
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    harness.send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'create_item', arguments: { type: 'requirment', title: 'X' } },
    });

    const [, call] = await harness.responses(2);
    const result = call.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /closest match is "requirement"/);
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('nothing but MCP messages reaches stdout', async () => {
  const cwd = project();
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'ping' });
    const [pong] = await harness.responses(1);
    assert.deepEqual(pong, { jsonrpc: '2.0', id: 1, result: {} });

    // Kill now and wait for stdio to fully close, so anything the process
    // might write on its way out (a warning, a caught stack) is captured
    // before we assert on the totals below — not just the first response.
    await harness.stop();
    assert.equal(harness.exitInfo()?.signal, 'SIGTERM', 'the server was still running when we killed it, not already dead');
    assert.equal(harness.messageCount(), 1, 'no stdout message besides the one response, including anything written at exit');
    assert.equal(harness.stderr(), '', 'nothing reached stderr either');
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

/**
 * load_context reaches further into the codebase than any other tool — it
 * pulls the whole injection path (rebuild, select, render, ledger) into the
 * MCP server's import graph. One stray `console.log` anywhere down there
 * corrupts the protocol stream, so this drives it over real stdio and checks
 * the stream is exactly one clean response.
 */
test('load_context runs over stdio without a byte of stray stdout', async () => {
  const cwd = project();
  runCli(['add', 'lesson', 'Migrations need locks'], cwd, () => {});
  const harness = start(cwd);
  try {
    harness.send({
      jsonrpc: '2.0', id: 1, method: 'tools/call',
      params: { name: 'load_context', arguments: {} },
    });

    const [call] = await harness.responses(1);
    const result = call.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, false);
    assert.match(result.content[0].text, /1 lesson/);

    await harness.stop();
    assert.equal(harness.messageCount(), 1, 'exactly one message on stdout');
    assert.equal(harness.stderr(), '', 'nothing reached stderr either');
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});

test('the server survives a workspace it cannot use', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    harness.send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'create_item', arguments: { type: 'constraint', title: 'X' } },
    });

    const [list, call] = await harness.responses(2);
    assert.equal((list.result as { tools: unknown[] }).tools.length, 11);
    const result = call.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /mycontext init/);
  } finally {
    await harness.stop();
    rmSync(cwd, { recursive: true, force: true });
  }
});
