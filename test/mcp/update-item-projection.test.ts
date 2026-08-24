/**
 * The projection at the MCP surface — the one a model actually reaches
 * (plan:categories seq 20).
 *
 * `mycontext edit` was closed at seq 15 and the store was not, which left the
 * CLI's edit door the only closed one of three. Measured by execution on
 * 2026-08-24, over this same server, on a workspace declaring `updates.state`
 * with a `projectsTo`:
 *
 *     update_item({id, extra: {state: 'donee'}})  isError=false, "updated",
 *                                                 and `state: donee` on disk
 *     update_item({id, extra: {state: 'done'}})   field written, tag left
 *                                                 reading `state:todo`, and
 *                                                 `mycontext doctor` then
 *                                                 exits 1 on the drift it made
 *
 * So the defect was DETECTED after the fact and PREVENTED on exactly one of
 * three write surfaces. Everything here therefore goes through
 * `src/mcp/server.ts` as a child process, exactly as a model reaches it, and
 * every assertion is made against the item's MARKDOWN FILE rather than the
 * returned object: a response claiming a value was refused is worth nothing if
 * the bytes moved.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { startStdioChild } from '../helpers/stdio.ts';
import { removeTree } from '../helpers/tmp.ts';

const SERVER = fileURLToPath(new URL('../../src/mcp/server.ts', import.meta.url));

interface Call { isError: boolean; text: string }

/** One MCP session against `cwd`: initialize, then every call in order, over
 * one stdio pipe. A fresh child per test, because each asserts on a workspace
 * it set up itself and a live server pins that directory on Windows. */
async function session(
  cwd: string, calls: { name: string; arguments: Record<string, unknown> }[],
): Promise<Call[]> {
  const child = startStdioChild(SERVER, { cwd });
  try {
    child.send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    calls.forEach((call, i) => {
      child.send({ jsonrpc: '2.0', id: i + 2, method: 'tools/call', params: call });
    });
    const seen = await child.responses(calls.length + 1);
    return seen.slice(1).map((message) => {
      const result = (message as { result?: { isError?: boolean; content?: { text: string }[] } }).result;
      assert.ok(result?.content?.[0]?.text !== undefined,
        `no text content in ${JSON.stringify(message)}`);
      return { isError: result.isError === true, text: result.content[0].text };
    });
  } finally {
    await child.stop();
  }
}

/**
 * The declaration under test, as a user writes it in `.my_context/config.json`.
 * `task` exists nowhere in `src/`, so a refusal that knows this vocabulary — or
 * a tag written from this prefix — can only have read it from the config.
 */
const CONFIG = {
  profile: 'standard',
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state'],
      updates: {
        state: {
          store: 'field',
          values: ['todo', 'doing', 'blocked', 'done'],
          projectsTo: 'state',
          command: 'mycontext edit <id> --state <value>',
          note: 'Where this task is.',
        },
      },
    },
    // `create_item`'s argument list is built from the DEFAULT config so that
    // `tools/list` stays byte-stable for prompt caching, which means a field a
    // project declares on a category of its own is refused at the argument gate
    // and never reaches `createItem` (see `extraFieldSchema`, mcp/tools.ts).
    // `directive` is a BUILT-IN extra field, so it is in that static schema —
    // which makes declaring a projection on it the only way to drive capture's
    // half of this through the tool a model actually calls.
    rule: {
      updates: {
        directive: {
          store: 'field',
          values: ['do', 'dont'],
          projectsTo: 'directive',
          command: 'mycontext edit <id> --extra directive=<value>',
          note: 'Whether this rule tells you to do something or not to.',
        },
      },
    },
  },
};

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-mcpproj-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  writeFileSync(
    path.join(cwd, '.my_context', 'config.json'), JSON.stringify(CONFIG, null, 2) + '\n', 'utf8',
  );
  return cwd;
}

function itemPath(cwd: string, id: string): string {
  return path.join(cwd, '.my_context', 'items', 'task', `${id}.md`);
}

function rulePath(cwd: string, id: string): string {
  return path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`);
}

function itemFile(cwd: string, id: string): string {
  return readFileSync(itemPath(cwd, id), 'utf8');
}

/** The `tags:` block of a rendered item, as a list of tag strings. */
function tagsOf(file: string): string[] {
  const block = /\ntags:\n((?: {2}- .*\n)*)/.exec(file);
  if (!block) return [];
  return block[1].split('\n').filter(Boolean)
    .map((l) => l.replace(/^ {2}- /, '').replace(/^"|"$/g, ''));
}

const TASK = 'TASK-wire-the-projection';

/** One task carrying both halves of the projection in agreement, plus two
 * unrelated tags. Through the CLI, so the MCP call under test is the only
 * thing the assertions can be measuring. */
function task(cwd: string): string {
  const lines: string[] = [];
  const code = runCli([
    'add', 'task', 'Wire the projection', '--body', 'Call the seam.',
    '--tags', 'plan:categories,seq:20,state:todo,v2',
    '--extra', 'state=todo', '--extra', 'plan=categories',
  ], cwd, (l) => lines.push(l));
  assert.equal(code, 0, lines.join('\n'));
  return TASK;
}

/**
 * The reproduction. Before this landed the response read "my_context: updated
 * TASK-wire-the-projection (active)." and the file on disk read `state: donee`
 * — `updateItem` called `validateExtra` and `unknownExtraFieldError` and never
 * `updatableExtraError`, so the declared vocabulary was not enforced on this
 * path at all.
 */
test('update_item refuses a value outside the declared vocabulary', async () => {
  const cwd = project();
  try {
    const id = task(cwd);
    const before = itemFile(cwd, id);
    const [res] = await session(cwd, [
      { name: 'update_item', arguments: { id, extra: { state: 'donee' } } },
    ]);

    assert.equal(res.isError, true, res.text);
    assert.match(res.text, /"state" must be one of: todo, doing, blocked, done/);
    assert.match(res.text, /The closest match is "done"/);
    assert.doesNotMatch(res.text, /\bupdated\b/);
    assert.equal(itemFile(cwd, id), before, 'the refusal says nothing was changed');
  } finally {
    removeTree(cwd);
  }
});

/**
 * The other half, and the one that makes the refusal above more than a blanket
 * "extra is refused": a legal value moves the field AND the tag generated from
 * it, in one write, so the two cannot disagree — and `doctor`, which used to
 * report exactly this call's output as `tag_projection_drift`, finds nothing.
 */
test('update_item moves the projected tag with the field, and doctor stays clean', async () => {
  const cwd = project();
  try {
    const id = task(cwd);
    const [res] = await session(cwd, [
      { name: 'update_item', arguments: { id, extra: { state: 'done' } } },
    ]);

    assert.equal(res.isError, false, res.text);
    const file = itemFile(cwd, id);
    assert.match(file, /^state: done$/m);
    assert.deepEqual(tagsOf(file), ['plan:categories', 'seq:20', 'state:done', 'v2']);

    const lines: string[] = [];
    assert.equal(runCli(['doctor'], cwd, (l) => lines.push(l)), 0, lines.join('\n'));
    assert.doesNotMatch(lines.join('\n'), /tag_projection_drift/);
  } finally {
    removeTree(cwd);
  }
});

/**
 * Hazard 1 over the real surface. `updateItem` MERGES `extra` and ASSIGNS
 * `tags`, so a projection computed against the STORED list is thrown away by
 * the caller's replacement list — measured landing `['v2', 'ui']`, an item with
 * the field moved and no projected tag at all.
 */
test('update_item projects onto the tag list the caller passed, not the one it replaces', async () => {
  const cwd = project();
  try {
    const id = task(cwd);
    const [res] = await session(cwd, [
      { name: 'update_item', arguments: { id, tags: ['v2', 'ui'], extra: { state: 'done' } } },
    ]);

    assert.equal(res.isError, false, res.text);
    assert.deepEqual(tagsOf(itemFile(cwd, id)), ['v2', 'ui', 'state:done']);
  } finally {
    removeTree(cwd);
  }
});

/**
 * Capture, through the tool that writes `extra` at capture time. `mycontext add
 * --extra state=donee` exited 0 and wrote the field; `create_item` did the
 * same, and an item born with a declared field and no tag projected from it is
 * invisible to `focus`, `search --tag` and every progress view from its first
 * byte.
 */
test('create_item refuses an undeclared value and projects a declared one', async () => {
  const cwd = project();
  try {
    const [bad, good] = await session(cwd, [
      {
        name: 'create_item',
        arguments: { type: 'rule', title: 'Typo at capture', body: 'x', directive: 'maybe' },
      },
      {
        name: 'create_item',
        arguments: { type: 'rule', title: 'Never log customer email', body: 'x', directive: 'dont' },
      },
    ]);

    assert.equal(bad.isError, true, bad.text);
    assert.match(bad.text, /"directive" must be one of: do, dont/);
    assert.equal(existsSync(rulePath(cwd, 'RULE-typo-at-capture')), false,
      'nothing may be written by a call that was refused');

    assert.equal(good.isError, false, good.text);
    const file = readFileSync(rulePath(cwd, 'RULE-never-log-customer-email'), 'utf8');
    assert.match(file, /^directive: dont$/m);
    assert.deepEqual(tagsOf(file), ['directive:dont']);
  } finally {
    removeTree(cwd);
  }
});
