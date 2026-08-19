/**
 * `extra` at the trust boundary, driven over the real MCP server on stdio.
 *
 * This file exists because of a hole that a unit test would not have found and
 * that no unit test can keep closed on its own: `extra` was neither staged by
 * `agentEdits: "review"` (it was absent from `REVISION_FIELDS`) nor refused by
 * the reach-and-force guard (it is not one of `GUARDED_FIELDS`), so an agent
 * holding ONLY the MCP tools — no shell — could rewrite `extra.directive` on a
 * governing `rule` and have it apply immediately. `directive` is the field that
 * decides whether a rule prohibits or prescribes, so that is the inversion of
 * "never log customer email" into an instruction to do it, with the item
 * staying `active`, `hard`, and unchanged in every report.
 *
 * Everything here therefore goes through `src/mcp/server.ts` as a child
 * process, exactly as a model reaches it, and every assertion about what did or
 * did not change is made against the item's MARKDOWN FILE rather than against a
 * returned object — the file is the source of truth, and a message claiming
 * something did not apply is worth nothing if the bytes moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

interface Call { isError: boolean; text: string }

/**
 * One MCP session against `cwd`: initialize, then every call in `calls`, in
 * order, over one stdio pipe. Returns one entry per call.
 *
 * A fresh child per test rather than a shared one, because each test asserts on
 * a workspace it set up itself and a server holding a cwd open on Windows pins
 * the directory `removeTree` is about to take away.
 */
async function session(
  cwd: string, calls: { name: string; arguments: Record<string, unknown> }[],
): Promise<Call[]> {
  const child: ChildProcessWithoutNullStreams = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', SERVER], {
    cwd, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let buffered = '';
  let stderr = '';
  const seen: Record<string, unknown>[] = [];
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    buffered += chunk;
    for (;;) {
      const newline = buffered.indexOf('\n');
      if (newline < 0) break;
      const line = buffered.slice(0, newline);
      buffered = buffered.slice(newline + 1);
      if (line.trim() !== '') seen.push(JSON.parse(line) as Record<string, unknown>);
    }
  });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => { stderr += chunk; });

  const send = (message: unknown): void => { child.stdin.write(JSON.stringify(message) + '\n'); };
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
  calls.forEach((call, i) => {
    send({ jsonrpc: '2.0', id: i + 2, method: 'tools/call', params: call });
  });

  const wanted = calls.length + 1;
  const deadline = Date.now() + 30_000;
  while (seen.length < wanted && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  // Wait for the streams to CLOSE, not merely for the kill to be sent: on
  // Windows a live child pins its own working directory, and returning early
  // makes `removeTree` report a leak on every run.
  await new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
    child.once('close', () => resolve());
    child.stdin.end();
    child.kill();
  });
  assert.ok(seen.length >= wanted,
    `expected ${wanted} responses, got ${seen.length}; stderr:\n${stderr}`);

  return seen.slice(1, wanted).map((message) => {
    const result = (message as { result?: { isError?: boolean; content?: { text: string }[] } }).result;
    assert.ok(result?.content?.[0]?.text !== undefined,
      `no text content in ${JSON.stringify(message)}`);
    return { isError: result.isError === true, text: result.content[0].text };
  });
}

/**
 * A `rule` that is ACTIVE, hard and carries `extra.directive: "dont"` — the
 * shape the whole hole was about.
 *
 * Created through the MCP tool rather than through the CLI, because `mycontext
 * add` has no flag for a category-specific field: `create_item` is the only
 * surface that writes `extra` at capture. It lands as a draft (every normative
 * item a model captures does), and the human then promotes it, which is exactly
 * the history that makes the item worth protecting afterwards.
 */
async function governingRule(cwd: string): Promise<string> {
  const id = 'RULE-never-log-customer-email';
  const [created] = await session(cwd, [{
    name: 'create_item',
    arguments: {
      type: 'rule',
      title: 'Never log customer email',
      body: 'Customer email addresses must not reach any log sink.',
      scope: ['src/**'],
      severity: 'hard',
      directive: 'dont',
    },
  }]);
  assert.equal(created.isError, false, created.text);
  assert.equal(runCli(['review', 'promote', id, '--yes'], cwd, () => {}), 0);
  assert.match(itemFile(cwd, id), /directive: dont/);
  assert.match(itemFile(cwd, id), /status: active/);
  return id;
}

function project(config?: Record<string, unknown>): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-extra-'));
  runCli(['init'], cwd, () => {});
  if (config) {
    writeFileSync(path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config, null, 2));
  }
  return cwd;
}

function itemFile(cwd: string, id: string): string {
  return readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
}

/**
 * The reproduction, and the one test in this file that fails on the build this
 * was written against: before the fix the response said "updated
 * RULE-never-log-customer-email (active)" and the file on disk read
 * `directive: do`.
 */
test('an agent cannot flip extra.directive on a governing rule — it is staged, not applied', async () => {
  const cwd = project();
  try {
    const id = await governingRule(cwd);
    const [flip] = await session(cwd, [
      { name: 'update_item', arguments: { id, extra: { directive: 'do' } } },
    ]);

    assert.equal(flip.isError, false, 'staging is not a failure — it is a different outcome');
    assert.match(flip.text, /^my_context: NOT applied/,
      'the first words a model reads must say the change did not take effect');
    assert.match(flip.text, /staged as revision REV-/);
    assert.doesNotMatch(flip.text, /\bupdated\b/);

    const file = itemFile(cwd, id);
    assert.match(file, /directive: dont/, 'the directive on disk must not have moved');
    assert.doesNotMatch(file, /directive: do\b/);
    assert.match(file, /status: active/, 'and the item still governs, unchanged in every report');
    assert.match(file, /severity: hard/);
  } finally {
    removeTree(cwd);
  }
});

/** The other half of staging: a human's promotion is what applies it, and the
 * proposal really does carry `extra` all the way through. Without this the test
 * above would be satisfied by a build that merely refused `extra` outright. */
test('a human promoting the revision is what actually moves extra.directive', async () => {
  const cwd = project();
  try {
    const id = await governingRule(cwd);
    await session(cwd, [{ name: 'update_item', arguments: { id, extra: { directive: 'do' } } }]);

    const lines: string[] = [];
    assert.equal(runCli(['review', 'promote-revision', id, '--yes'], cwd, (l) => lines.push(l)), 0,
      lines.join('\n'));
    assert.match(itemFile(cwd, id), /directive: do\b/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * `mycontext review revisions` must SHOW the proposed `extra`, or staging it
 * would be a queue a human cannot read — the same failure as applying it.
 */
test('review revisions renders the extra a revision proposes', async () => {
  const cwd = project();
  try {
    const id = await governingRule(cwd);
    await session(cwd, [{ name: 'update_item', arguments: { id, extra: { directive: 'do' } } }]);

    const lines: string[] = [];
    assert.equal(runCli(['review', 'revisions'], cwd, (l) => lines.push(l)), 0);
    const text = lines.join('\n');
    assert.match(text, /extra/);
    assert.match(text, /- directive: dont/);
    assert.match(text, /\+ directive: do\b/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * `agentEdits: "allow"` is a statement about CONTENT and must never read as
 * "agents may do anything to this category". `extra` is content, so it applies
 * here; the reach-and-force fields are refused in the same session, under the
 * same setting, on the same item.
 */
test('agentEdits: allow applies extra directly and still refuses reach and force', async () => {
  const cwd = project({ categories: { rule: { agentEdits: 'allow' } } });
  try {
    const id = await governingRule(cwd);
    const [applied, scope, always, severity, status] = await session(cwd, [
      { name: 'update_item', arguments: { id, extra: { directive: 'do' } } },
      { name: 'update_item', arguments: { id, scope: ['docs/**'] } },
      { name: 'update_item', arguments: { id, always: true } },
      { name: 'update_item', arguments: { id, severity: 'soft' } },
      { name: 'update_item', arguments: { id, status: 'deprecated' } },
    ]);

    assert.equal(applied.isError, false);
    assert.match(applied.text, /updated/);
    assert.doesNotMatch(applied.text, /staged/);
    assert.match(itemFile(cwd, id), /directive: do\b/);

    for (const [what, call] of [['scope', scope], ['always', always], ['severity', severity]] as const) {
      assert.equal(call.isError, true, `${what} must still be refused under allow`);
      assert.match(call.text, new RegExp(`non-human caller cannot change the ${what}`));
    }
    assert.equal(status.isError, true);
    assert.match(status.text, /non-human caller cannot change the status/);

    const file = itemFile(cwd, id);
    assert.match(file, /src\/\*\*/);
    assert.doesNotMatch(file, /docs\/\*\*/);
    assert.match(file, /severity: hard/);
    assert.match(file, /status: active/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * What the model is TOLD, read off the same `tools/list` a client reads.
 *
 * The description used to advertise "title, body, scope, tags, severity,
 * always, extra or status" as one list of revisable fields. Under the shipped
 * default on a governing normative item, four of those are refused and four are
 * staged, and `extra` was the one that applied — so the sentence was at its
 * least true about exactly the field that made it dangerous.
 */
test('tools/list describes update_item as it actually behaves', async () => {
  const cwd = project();
  const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', SERVER], { cwd, stdio: ['pipe', 'pipe', 'pipe'] });
  try {
    let buffered = '';
    const seen: Record<string, unknown>[] = [];
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (chunk: string) => {
      buffered += chunk;
      for (;;) {
        const newline = buffered.indexOf('\n');
        if (newline < 0) break;
        const line = buffered.slice(0, newline);
        buffered = buffered.slice(newline + 1);
        if (line.trim() !== '') seen.push(JSON.parse(line) as Record<string, unknown>);
      }
    });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) + '\n');
    const deadline = Date.now() + 30_000;
    while (seen.length < 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    assert.equal(seen.length, 1, 'the server did not answer tools/list');

    const tools = (seen[0].result as {
      tools: { name: string; description: string; inputSchema: { properties: Record<string, { description?: string }> } }[]
    }).tools;
    const update = tools.find((t) => t.name === 'update_item');
    assert.ok(update, 'update_item is not listed');

    assert.match(update.description, /staged for a human/,
      'the model must be told a content edit may not apply');
    assert.doesNotMatch(update.description, /title, body, scope, tags, severity, always, extra/,
      'the flat list of eight fields that behave four ways is what was wrong');
    // And the field at the centre of it says what it is, where a model reading
    // one property rather than the whole sentence will see it.
    assert.match(update.inputSchema.properties.extra.description ?? '', /staged for review/);
    for (const field of ['scope', 'always', 'severity']) {
      assert.match(update.inputSchema.properties[field].description ?? '',
        /Refused on a governing normative item/, field);
    }
  } finally {
    await new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) { resolve(); return; }
      child.once('close', () => resolve());
      child.stdin.end();
      child.kill();
    });
    removeTree(cwd);
  }
});

/**
 * A call that mixes `extra` with a field a revision cannot carry is refused
 * whole. `extra` moving out of the "non-content" list and into the staged set
 * changes which side of that refusal it is on: it used to be the field being
 * named as the other half, and it is now the content half naming the other.
 *
 * The item is a DRAFT, which is where the mixed rule is actually load-bearing —
 * on a governing item the reach-and-force guard refuses such a call first.
 */
test('update_item refuses a mixed extra-and-scope call whole', async () => {
  const cwd = project();
  try {
    const [created, mixed] = await session(cwd, [
      {
        name: 'create_item',
        arguments: { type: 'rule', title: 'Cache reads', body: 'Cache for 60s.', scope: ['src/**'], directive: 'do' },
      },
      {
        name: 'update_item',
        arguments: { id: 'RULE-cache-reads', extra: { directive: 'dont' }, scope: ['docs/**'] },
      },
    ]);
    assert.equal(created.isError, false, created.text);
    assert.equal(mixed.isError, true);
    assert.match(mixed.text, /mixes a content change \(extra\) with a change to scope/);
    assert.match(mixed.text, /nothing was applied and nothing was staged/);

    const file = itemFile(cwd, 'RULE-cache-reads');
    assert.match(file, /directive: do\b/, 'no half of a mixed call may be applied');
    assert.match(file, /src\/\*\*/);
    assert.doesNotMatch(file, /docs\/\*\*/);
  } finally {
    removeTree(cwd);
  }
});
