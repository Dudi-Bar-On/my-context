/**
 * `mycontext ready` — the list that answers "what can I start right now".
 *
 * The load-bearing tests here are the two that say what this report is NOT
 * allowed to do:
 *
 *  - `a blocked task whose blocker has landed appears` is the `plan:walk
 *    seq:8` case. It sat at `state: blocked` after `seq:7` went green and a
 *    human found it by hand. A ready list that filtered `blocked` out would
 *    omit the one row that has ever surprised anybody.
 *  - `held rows are counted on every path` pins the disclosure. A list that
 *    silently omitted the open work it could not clear would be precise about
 *    the wrong corpus, which is exactly the failure
 *    `STD-the-progress-table-has-one-format-and-this-is-it` names.
 *
 * Refusals are asserted against THIS COMMAND's usage line rather than the
 * top-level banner, for the reason `test/cli/add-flags.test.ts` records.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

function run(args: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(args, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

/** Wrapped prose collapsed to one line — see `todo.test.ts` for why. */
function prose(out: string): string {
  return out.replace(/\s+/g, ' ');
}

const TASK_CATEGORY = {
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
};

/** A throwaway project that declares a work-planning category. Disposed by the
 * caller. Pass `null` for a project that declares none. */
function project(config: unknown = TASK_CATEGORY): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ready-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  if (config !== null) {
    writeFileSync(
      path.join(cwd, '.my_context', 'config.json'), JSON.stringify(config, null, 2) + '\n',
    );
  }
  return cwd;
}

/**
 * A task written straight to disk.
 *
 * `mycontext add` cannot set an extra field, so a task with a `plan`, a `seq`
 * and a `state` has to be authored the way the corpus this feature is for was
 * authored — as a file. `rebuild` reads it back through the same parser every
 * other surface uses.
 */
function writeTask(
  cwd: string, id: string, extra: Record<string, string>, title = `task ${id}`,
): void {
  const dir = path.join(cwd, '.my_context', 'items', 'task');
  mkdirSync(dir, { recursive: true });
  const fields = Object.entries(extra).map(([k, v]) => `${k}: "${v}"`).join('\n');
  writeFileSync(path.join(dir, `${id}.md`), [
    '---',
    `id: ${id}`,
    'type: task',
    `title: ${title}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    fields,
    '---',
    '',
    `# ${title}`,
    '',
  ].join('\n'), 'utf8');
}

test('a blocked task whose blocker has landed appears on the ready list', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'done', priority: '1' });
    writeTask(cwd, 'TASK-walk-8', {
      plan: 'walk', seq: '8', state: 'blocked', priority: '1', needs: 'walk/7',
    });

    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.match(out, /walk\/8/);
    // …and the blocker itself is done, so it is NOT on the list.
    assert.doesNotMatch(out, /walk\/7/);
  } finally {
    removeTree(cwd);
  }
});

test('a task whose blocker has not landed is held, and the held rows are counted on every path', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-walk-8', {
      plan: 'walk', seq: '8', state: 'blocked', priority: '1', needs: 'walk/7',
    });

    const listed = run(['ready'], cwd);
    assert.equal(listed.code, 0);
    assert.doesNotMatch(listed.out, /walk\/8/);
    // Hidden is fine; unmentioned is not.
    assert.match(prose(listed.out), /1 open task\(s\) held and not listed above/);
    assert.match(prose(listed.out), /a blocker has not landed/);

    // The same fact at --summary, which prints no rows at all.
    assert.match(prose(run(['ready', '--summary'], cwd).out), /held: a blocker has not landed/);

    // …and the row itself, with --held.
    assert.match(run(['ready', '--held'], cwd).out, /walk\/8/);
  } finally {
    removeTree(cwd);
  }
});

test('a blocked task that names nothing is held, not listed as ready', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-1h', { plan: 'walk', seq: '1h', state: 'blocked', priority: '2' });
    const { out } = run(['ready', '--held'], cwd);
    assert.match(prose(out), /says blocked and names nothing/);
    assert.match(prose(out), /no task is ready to start/);
  } finally {
    removeTree(cwd);
  }
});

test('the list is ordered by priority, and an unprioritised task sorts last', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-a', { plan: 'walk', seq: '9', state: 'todo', priority: '3' });
    writeTask(cwd, 'TASK-b', { plan: 'walk', seq: '10', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-c', { plan: 'walk', seq: '11', state: 'todo' });

    const { out } = run(['ready'], cwd);
    const order = ['walk/10', 'walk/9', 'walk/11'].map((k) => out.indexOf(k));
    assert.ok(order.every((i) => i >= 0), `a task is missing from:\n${out}`);
    assert.deepEqual([...order].sort((a, b) => a - b), order, `wrong order:\n${out}`);
  } finally {
    removeTree(cwd);
  }
});

test('--plan narrows the report, and --limit caps it and says so', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-a', { plan: 'walk', seq: '1', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-b', { plan: 'walk', seq: '2', state: 'todo', priority: '1' });
    writeTask(cwd, 'TASK-c', { plan: 'port', seq: '1', state: 'todo', priority: '1' });

    const narrowed = run(['ready', '--plan', 'walk'], cwd);
    assert.match(narrowed.out, /walk\/1/);
    assert.doesNotMatch(narrowed.out, /port\/1/);

    const capped = run(['ready', '--limit', '1'], cwd);
    assert.match(prose(capped.out), /3 ready; 1 shown/);
    assert.match(prose(capped.out), /--limit 3/);
  } finally {
    removeTree(cwd);
  }
});

test('--json carries the held rows with their reasons and the categories this answer is about', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-walk-7', { plan: 'walk', seq: '7', state: 'todo' });
    writeTask(cwd, 'TASK-walk-8', { plan: 'walk', seq: '8', state: 'blocked', needs: 'walk/7' });

    const { code, out } = run(['ready', '--json'], cwd);
    assert.equal(code, 0);
    const doc = JSON.parse(out);
    assert.deepEqual(doc.workCategories, ['task']);
    assert.equal(doc.readyTotal, 1);
    assert.deepEqual(doc.held.map((h: { id: string; reason: string }) => [h.id, h.reason]),
      [['TASK-walk-8', 'pending']]);
    assert.deepEqual(doc.held[0].pending, ['walk/7']);
    assert.deepEqual(doc.loadErrors, []);
  } finally {
    removeTree(cwd);
  }
});

test('a project with no work-planning category is told so, not shown an empty list', () => {
  // "Nothing is ready" and "this project declares no category that plans
  // work" are different answers; printing the first for the second is the
  // silent-empty-answer failure `list` and `search` were both fixed for.
  const cwd = project(null);
  try {
    const { code, out } = run(['ready'], cwd);
    assert.equal(code, 0);
    assert.match(prose(out), /no category in this project declares "plan", "seq" and "state"/);
    assert.doesNotMatch(prose(out), /no task is ready to start/);
  } finally {
    removeTree(cwd);
  }
});

test('an unknown flag is refused by name against this command\'s own usage', () => {
  const cwd = project();
  try {
    const { code, out } = run(['ready', '--planx', 'walk'], cwd);
    assert.equal(code, 1);
    assert.match(out, /unknown option "--planx"/);
    assert.match(out, /usage: mycontext ready/);
  } finally {
    removeTree(cwd);
  }
});

test('--limit refuses a value that is not a positive whole number, and prints nothing else', () => {
  const cwd = project();
  try {
    writeTask(cwd, 'TASK-a', { plan: 'walk', seq: '1', state: 'todo' });
    const { code, out } = run(['ready', '--limit', '0'], cwd);
    assert.equal(code, 1);
    assert.match(out, /--limit takes a positive whole number/);
    assert.doesNotMatch(out, /walk\/1/);
  } finally {
    removeTree(cwd);
  }
});
