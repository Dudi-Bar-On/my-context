/**
 * **GROUPING AND FILTERING MUST KEEP WORKING UNCHANGED.**
 *
 * That is the whole reason the tool PROJECTS a tag from a field instead of
 * deleting the tag and telling everyone to read the field. `mycontext focus`,
 * `mycontext search --tag` and every progress view read `item.tags` today and
 * have to resolve `plan:port` and `state:todo` in exactly the same way once the
 * value has moved into a field that can hold it.
 *
 * So this file does not test the projection module against itself. It runs the
 * REAL paths — `runCli(['search', '--tag', …])`, which goes through
 * `filterItems` (core/search.ts), the one predicate `query_items` also uses;
 * and `runCli(['focus', …, '--json'])`, which goes through `select` and
 * `focusReport` (core/select.ts, core/focus.ts) — over a REAL workspace on
 * disk, before and after a projected field edit written by the real
 * `updateItem`.
 *
 * Nothing in `src/core/search.ts`, `src/core/select.ts`, `src/core/focus.ts`,
 * `src/cli/commands/search.ts` or `src/cli/commands/focus.ts` was touched by
 * this work. This file is the evidence that nothing needed to be.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import type { CategoryUpdates } from '../../src/core/categories.ts';
import { parseItem } from '../../src/core/item.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { projectFieldUpdate } from '../../src/core/tag-projection.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const STATE: CategoryUpdates = {
  state: {
    store: 'field',
    values: ['todo', 'doing', 'done', 'blocked'],
    projectsTo: 'state',
    command: 'mycontext edit <id> --state <value>',
    note: 'Where this task has got to. The `state:` tag is generated from it.',
  },
};

/** The `task` category this project's own outer corpus declares, verbatim. */
const CONFIG = {
  profile: 'standard',
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state'],
    },
  },
};

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += `${s}\n`; });
  return { code, out };
}

/**
 * Three tasks across two plans and two states, tagged exactly the way the 293
 * task items in this project's own corpus are tagged.
 */
function seed(): Sandbox {
  const s = sandbox(CONFIG);
  // The declaration seq 14 will author in config.json. Installed on the
  // resolved config so this test exercises the mechanism the two waves meet
  // at; `runCli` below re-resolves its own config from disk and does NOT see
  // it, which is exactly the point — filtering needs no declaration at all.
  s.ctx.config.categories.task.updates = STATE;

  createItem(s.ctx, {
    type: 'task', title: 'Alpha', id: 'TASK-alpha',
    tags: ['plan:port', 'seq:1', 'state:todo', 'v2'],
    extra: { plan: 'port', seq: '1', state: 'todo' },
  });
  createItem(s.ctx, {
    type: 'task', title: 'Beta', id: 'TASK-beta',
    tags: ['plan:port', 'seq:2', 'state:done'],
    extra: { plan: 'port', seq: '2', state: 'done' },
  });
  createItem(s.ctx, {
    type: 'task', title: 'Gamma', id: 'TASK-gamma',
    tags: ['plan:categories', 'seq:3', 'state:todo'],
    extra: { plan: 'categories', seq: '3', state: 'todo' },
  });
  return s;
}

/** Ids `search --tag <tag>` returns, read off the real command's own output. */
function searchTag(s: Sandbox, tag: string): string[] {
  const { code, out } = run(['search', '--tag', tag, '--json'], s.cwd);
  assert.equal(code, 0, out);
  const doc = JSON.parse(out) as { items: { id: string }[] };
  return doc.items.map((i) => i.id).sort();
}

/** Ids `focus <tag> --preview` would hide, read off the real report. */
function focusHides(s: Sandbox, tag: string): string[] {
  const { code, out } = run(['focus', tag, '--preview', '--json'], s.cwd);
  assert.equal(code, 0, out);
  return (JSON.parse(out) as { hidden: string[] }).hidden
    .filter((id) => id.startsWith('TASK-')).sort();
}

/** The projected edit, exactly as `edit.ts` will make it (see the seam comment
 * at the top of core/tag-projection.ts): project, then hand the whole patch to
 * `updateItem`. */
function setState(s: Sandbox, id: string, value: string): void {
  const item = s.ctx.store.get(id);
  assert.ok(item, `${id} must be in the store`);
  const projected = projectFieldUpdate(s.ctx.config, item, { state: value });
  updateItem(s.ctx, { id, origin: 'human', extra: projected.extra, tags: projected.tags });
}

test('search --tag resolves a projected tag exactly as it does any other tag', () => {
  const s = seed();
  try {
    assert.deepEqual(searchTag(s, 'state:todo'), ['TASK-alpha', 'TASK-gamma']);
    assert.deepEqual(searchTag(s, 'state:done'), ['TASK-beta']);
    assert.deepEqual(searchTag(s, 'plan:port'), ['TASK-alpha', 'TASK-beta']);
    assert.deepEqual(searchTag(s, 'seq:3'), ['TASK-gamma']);
    assert.deepEqual(searchTag(s, 'v2'), ['TASK-alpha']);
  } finally {
    s.dispose();
  }
});

/**
 * The load-bearing one. A field edit moves the projected tag with it, so the
 * same `search --tag` that found the item before finds it under its new value
 * afterwards — and every other tag the item carried is exactly where it was.
 */
test('a projected field edit moves the tag, and every other filter is untouched', () => {
  const s = seed();
  try {
    setState(s, 'TASK-alpha', 'done');

    // The tag moved with the field, through the real filter…
    assert.deepEqual(searchTag(s, 'state:done'), ['TASK-alpha', 'TASK-beta']);
    assert.deepEqual(searchTag(s, 'state:todo'), ['TASK-gamma']);
    // …and the memberships this edit was not about did not move at all.
    assert.deepEqual(searchTag(s, 'plan:port'), ['TASK-alpha', 'TASK-beta']);
    assert.deepEqual(searchTag(s, 'seq:1'), ['TASK-alpha']);
    assert.deepEqual(searchTag(s, 'v2'), ['TASK-alpha']);
  } finally {
    s.dispose();
  }
});

test('focus narrows by a projected tag before and after the edit', () => {
  const s = seed();
  try {
    // `state:done` hides the two todo tasks…
    assert.deepEqual(focusHides(s, 'state:done'), ['TASK-alpha', 'TASK-gamma']);
    setState(s, 'TASK-alpha', 'done');
    // …and after the edit it hides only the one that is still todo.
    assert.deepEqual(focusHides(s, 'state:done'), ['TASK-gamma']);
    // A focus on a plan is unaffected by a state edit, in both directions.
    assert.deepEqual(focusHides(s, 'plan:port'), ['TASK-gamma']);
  } finally {
    s.dispose();
  }
});

/**
 * The membership invariant, checked on the BYTES rather than on the index: a
 * set has one of each. Two `state:` tags is the silent third membership a
 * hand-written remove-then-add produces, and it is what the ruling is about.
 */
test('the item on disk ends with exactly one projected tag and a field that agrees', () => {
  const s = seed();
  try {
    setState(s, 'TASK-alpha', 'doing');
    setState(s, 'TASK-alpha', 'blocked');
    setState(s, 'TASK-alpha', 'done');

    const rel = 'items/task/TASK-alpha.md';
    const text = readFileSync(path.join(s.root, ...rel.split('/')), 'utf8');
    const parsed = parseItem(text, rel, 'project');

    assert.deepEqual(parsed.tags.filter((t) => t.startsWith('state:')), ['state:done']);
    assert.equal(parsed.extra.state, 'done');
    // The slot is kept, so three edits did not shuffle a curated tag list.
    assert.deepEqual(parsed.tags, ['plan:port', 'seq:1', 'state:done', 'v2']);
  } finally {
    s.dispose();
  }
});

/**
 * `state:donee` — the typo the corpus had no gate against — refused at the
 * write boundary, before anything reaches the file, and the item is left
 * findable under the value it actually has.
 */
test('an illegal value is refused and changes nothing that any filter can see', () => {
  const s = seed();
  try {
    assert.throws(() => setState(s, 'TASK-alpha', 'donee'), /must be one of: todo, doing, done, blocked/);
    assert.deepEqual(searchTag(s, 'state:todo'), ['TASK-alpha', 'TASK-gamma']);
    assert.deepEqual(searchTag(s, 'state:donee'), []);
    assert.equal(s.ctx.store.get('TASK-alpha')!.extra.state, 'todo');
  } finally {
    s.dispose();
  }
});
