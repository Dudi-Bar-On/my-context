import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { resolveServerCwd } from '../../src/mcp/server.ts';
import { startStdioChild, type StdioHarness } from '../helpers/stdio.ts';
import { removeTree } from '../helpers/tmp.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

type Harness = StdioHarness;

/**
 * The harness moved to `test/helpers/stdio.ts` so that its response clock
 * could be pinned by a test of its own. The behaviour that changed with the
 * move: the 15-second budget no longer starts at `spawn`, it starts once the
 * server has answered a readiness `ping`. Node's cold start was being charged
 * against the server's response time, which put roughly one run in six of this
 * file into the red on a cold module cache — and this project's ledger records
 * mutation conclusions being drawn against a suite that was already red.
 */
function start(cwd: string): Harness {
  return startStdioChild(SERVER, { cwd });
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
        arguments: { summary_omitted: true, type: 'constraint', title: 'Pool capped at 20', scope: ['src/db/**'] },
      },
    });

    const [init, list, call] = await harness.responses(3);

    assert.equal((init.result as Record<string, unknown>).protocolVersion, '2025-06-18');
    const tools = (list.result as { tools: { name: string }[] }).tools;
    assert.equal(tools.length, 16);
    assert.ok(tools.some((t) => t.name === 'create_item'));

    const content = (call.result as { content: { text: string }[] }).content;
    assert.match(content[0].text, /CONST-pool-capped-at-20/);
    assert.match(content[0].text, /draft/);
  } finally {
    await harness.stop();
    removeTree(cwd);
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
    removeTree(cwd);
  }
});

test('a rejected call arrives as content the model can read', async () => {
  const cwd = project();
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    harness.send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'create_item', arguments: { summary_omitted: true, type: 'requirment', title: 'X' } },
    });

    const [, call] = await harness.responses(2);
    const result = call.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /closest match is "requirement"/);
  } finally {
    await harness.stop();
    removeTree(cwd);
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
    removeTree(cwd);
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
  runCli(['add', '--summary-omitted', 'lesson', 'Migrations need locks'], cwd, () => {});
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
    removeTree(cwd);
  }
});

/**
 * `agentEdits` (spec §4) over the surface an agent actually reaches.
 *
 * `update_item` is the ONLY non-human caller of `updateItem` in the codebase,
 * so the staging policy is a property of this path or of nothing. Driven over
 * real stdio rather than through the handler, for the reason this file exists:
 * this project has repeatedly found a unit test and the real surface
 * disagreeing, and the response text below is exactly what a model reads
 * before deciding what is true of the item.
 *
 * `import`ing `updateItem` into the running server ALSO exercises the
 * `mutate.ts ⇄ revision.ts` import cycle under a real entry point — a cycle
 * that resolves under `node --test` can still deadlock a different module
 * evaluation order.
 */
function governingRule(cwd: string, config?: Record<string, unknown>): string {
  if (config) {
    writeFileSync(path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config, null, 2));
  }
  const id = 'RULE-do-not-log-customer-email';
  assert.equal(runCli(
    ['add', '--summary-omitted', 'rule', 'Do not log customer email',
      '--body', 'Never log a customer email address, anywhere.', '--scope', 'src/**', '--yes'],
    cwd, () => {},
  ), 0);
  return id;
}

function bodyOnDisk(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
}

async function callUpdate(
  harness: Harness, args: Record<string, unknown>,
): Promise<{ isError: boolean; text: string }> {
  harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  harness.send({
    jsonrpc: '2.0', id: 2, method: 'tools/call',
    params: { name: 'update_item', arguments: args },
  });
  const [, call] = await harness.responses(2);
  const result = call.result as { isError: boolean; content: { text: string }[] };
  return { isError: result.isError, text: result.content[0].text };
}

test('update_item stages an agent content edit under review, and says it did not apply', async () => {
  const cwd = project();
  const id = governingRule(cwd);
  const before = bodyOnDisk(cwd, id);
  const harness = start(cwd);
  try {
    const { isError, text } = await callUpdate(harness, {
      id, body: 'Avoid logging customer email addresses unless it is necessary.',
      summary: 'A proposed sentence.',
    });

    assert.equal(isError, false, 'staging is not a failure — it is a different outcome');
    assert.match(text, /NOT applied/);
    assert.match(text, /staged as revision REV-/);
    assert.match(text, /Do not reason as if the new text is in force/);
    assert.doesNotMatch(text, /\bupdated\b/);
    assert.equal(bodyOnDisk(cwd, id), before, 'the item file must be byte-identical');
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

test('update_item applies an agent content edit under allow', async () => {
  const cwd = project();
  const id = governingRule(cwd, { categories: { rule: { agentEdits: 'allow' } } });
  const harness = start(cwd);
  try {
    const { isError, text } = await callUpdate(harness, {
      id, body: 'Avoid logging customer email addresses unless it is necessary.',
      summary: 'A proposed sentence.',
    });

    assert.equal(isError, false);
    assert.match(text, /updated/);
    assert.doesNotMatch(text, /staged/);
    assert.match(bodyOnDisk(cwd, id), /unless it is necessary/);
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

/** The trust boundary, over the real surface and under the permissive policy:
 * `allow` is about content and must not read as "agents may do anything to
 * this category". */
test('update_item still refuses to empty a governing item scope under allow', async () => {
  const cwd = project();
  const id = governingRule(cwd, { categories: { rule: { agentEdits: 'allow' } } });
  const harness = start(cwd);
  try {
    const { isError, text } = await callUpdate(harness, { id, scope: [] });
    assert.equal(isError, true);
    assert.match(text, /non-human caller cannot change the scope/);
    assert.match(bodyOnDisk(cwd, id), /scope:/);
    assert.match(bodyOnDisk(cwd, id), /src\/\*\*/);
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

/** A mixed call is refused whole rather than half-applied. The item here is a
 * DRAFT, which is where the mixed rule is actually load-bearing: on a
 * governing item the field guard refuses such a call first. */
test('update_item refuses a mixed content-and-scope call whole', async () => {
  const cwd = project();
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    harness.send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: {
        name: 'create_item',
        arguments: { summary_omitted: true, type: 'rule', title: 'Cache reads', body: 'Cache for 60s.', scope: ['src/**'] },
      },
    });
    harness.send({
      jsonrpc: '2.0', id: 3, method: 'tools/call',
      params: {
        name: 'update_item',
        arguments: { id: 'RULE-cache-reads', body: 'Cache for 300s.', scope: ['docs/**'], summary: 'A proposed sentence.' },
      },
    });
    const [, created, mixed] = await harness.responses(3);
    assert.equal((created.result as { isError: boolean }).isError, false);

    const result = mixed.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, true);
    // `summary` rides along because a body edit cannot be sent without one — see
    // the summary gate. Both are content, and the refusal names both.
    assert.match(result.content[0].text, /mixes a content change \(body, summary\) with a change to scope/);
    assert.match(result.content[0].text, /nothing was applied and nothing was staged/);

    const file = readFileSync(path.join(cwd, '.my_context', 'items', 'rule', 'RULE-cache-reads.md'), 'utf8');
    assert.match(file, /src\/\*\*/, 'no half of a mixed call may be applied');
    assert.match(file, /Cache for 60s\./);
    assert.doesNotMatch(file, /docs\/\*\*/);
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});

test('the server survives a workspace it cannot use', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-bare-'));
  const harness = start(cwd);
  try {
    harness.send({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    harness.send({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'create_item', arguments: { summary_omitted: true, type: 'constraint', title: 'X' } },
    });

    const [list, call] = await harness.responses(2);
    assert.equal((list.result as { tools: unknown[] }).tools.length, 16);
    const result = call.result as { isError: boolean; content: { text: string }[] };
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /mycontext init/);
  } finally {
    await harness.stop();
    removeTree(cwd);
  }
});
