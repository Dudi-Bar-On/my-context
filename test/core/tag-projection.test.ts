/**
 * `src/core/tag-projection.ts` — fields store, tags index, and the projection
 * is generated rather than typed.
 *
 * The two load-bearing tests in this file are the last two. `projectionMismatch`
 * is asserted TOTAL over its whole input space rather than over the cases
 * somebody thought of, because the defect this module exists to end was a
 * measurement that could not see every kind of member; and the shipped
 * catalogue is asserted to declare no projection this module would have to
 * guess at, because a declaration bug belongs in a gate and not in a runtime
 * branch nobody reads.
 *
 * Every test here installs its own declaration on a resolved config. That is
 * not a workaround for a missing feature: `TIER_UPDATES` and
 * `UpdatableName.projectsTo` landed at plan:categories seq 13, authoring one in
 * `config.json` is seq 14 and belongs to another agent, and this module is the
 * mechanism both sides meet at. Installing the declaration directly tests the
 * mechanism against every declaration shape, including the ones the catalogue
 * does not ship yet.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, TIER_UPDATES, type CategoryUpdates } from '../../src/core/categories.ts';
import { resolveConfig, type Config } from '../../src/core/config.ts';
import {
  handWrittenProjectionError, projectedTagValues, projectFieldUpdate, projectionFor,
  projectionMismatch, projectionMismatches, projectionsFor, reconcileTags, updatesFor,
  type MismatchKind, type Projection,
} from '../../src/core/tag-projection.ts';
import type { Item } from '../../src/core/types.ts';

/** The declaration `task` will carry once seq 14 lands, written out here. */
const STATE: CategoryUpdates = {
  state: {
    store: 'field',
    values: ['todo', 'doing', 'done', 'blocked'],
    projectsTo: 'state',
    command: 'mycontext edit <id> --state <value>',
    note: 'Where this task has got to. The `state:` tag is generated from it.',
  },
};

/** A second projection on the same category, to prove they do not interfere. */
const PLAN: CategoryUpdates = {
  plan: {
    store: 'field',
    projectsTo: 'plan',
    command: 'mycontext edit <id> --plan <value>',
    note: 'Which plan this task belongs to. Free text — no closed vocabulary.',
  },
};

function config(updates: CategoryUpdates = STATE): Config {
  const resolved = resolveConfig({
    categories: {
      task: {
        tier: 'rationale',
        prefix: 'TASK',
        description: 'A unit of planned work, tracked to completion.',
        extraFields: ['plan', 'seq', 'state'],
      },
    },
  });
  resolved.categories.task.updates = updates;
  return resolved;
}

function item(tags: string[], extra: Record<string, string> = {}): Item {
  return {
    id: 'TASK-probe', type: 'task', title: 'Probe', status: 'active', severity: 'soft',
    always: false, scope: [], tags, origin: 'human', sourceFile: null, sourceAnchor: null,
    continuity: false,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra,
    body: '', steps: [], observations: [], relations: [], layer: 'project',
    filePath: 'items/task/TASK-probe.md',
  };
}

const stateProjection = (c: Config = config()): Projection => {
  const p = projectionFor(c, 'task', 'state');
  assert.ok(p, 'the test fixture must declare a state projection');
  return p;
};

test('updatesFor overlays a category own declaration onto its tier rules', () => {
  const merged = updatesFor(config(), 'task');
  // The tier's names are all present…
  for (const name of Object.keys(TIER_UPDATES.rationale)) {
    assert.ok(Object.hasOwn(merged, name), `${name} should come from the tier`);
  }
  // …and the category's own is added beside them.
  assert.equal(merged.state.projectsTo, 'state');
  // The tier's own rules are not rewritten by the overlay.
  assert.deepEqual(merged.severity.values, ['soft']);
});

test('a category own declaration wins over the tier on the same name', () => {
  const narrowed = config({
    status: { store: 'field', values: ['active'], note: 'Narrowed for this category.' },
  });
  assert.deepEqual(updatesFor(narrowed, 'task').status.values, ['active']);
});

/**
 * The same direction `updateItem`'s missing-category branch already takes: an
 * item whose category was renamed or removed after capture has no declaration,
 * and inventing one would refuse edits against a list that no longer exists.
 */
test('a type absent from config declares nothing rather than borrowing a tier', () => {
  assert.deepEqual(updatesFor(config(), 'no_such_category'), {});
  assert.deepEqual(projectionsFor(config(), 'no_such_category'), []);
  // The prototype hazard a bare index carries, which this codebase has been
  // bitten by six times.
  assert.deepEqual(updatesFor(config(), 'constructor'), {});
});

test('projectionsFor returns only field-stored names that declare a prefix, in name order', () => {
  const both = config({ ...STATE, ...PLAN });
  assert.deepEqual(
    projectionsFor(both, 'task').map((p) => `${p.field}->${p.prefix}`),
    ['plan->plan', 'state->state'],
  );
  // `title`, `body`, `status`… are fields and project nothing; `tags` is a tag.
  assert.equal(projectionFor(both, 'task', 'title'), null);
  assert.equal(projectionFor(both, 'task', 'tags'), null);
});

/**
 * A membership that generates a membership is not a thing. It is skipped rather
 * than thrown on — a read path that throws takes `doctor` down with it — and
 * the catalogue is gated on it further down this file.
 */
test('a tag-stored declaration that claims a projection is ignored', () => {
  const wrong = config({
    state: { store: 'tag', projectsTo: 'state', note: 'Declaration bug.' },
  });
  assert.deepEqual(projectionsFor(wrong, 'task'), []);
});

test('reconcileTags appends when the item carries no projected tag yet', () => {
  assert.deepEqual(
    reconcileTags(['plan:categories', 'v2'], stateProjection(), 'todo'),
    ['plan:categories', 'v2', 'state:todo'],
  );
});

/**
 * The slot is kept, not the value. A rewritten tag that jumped to the end of
 * the list would make every projected edit a two-line diff in the item's
 * Markdown, and would reorder a list a person curated.
 */
test('reconcileTags rewrites in place and leaves every other tag untouched', () => {
  assert.deepEqual(
    reconcileTags(['plan:categories', 'state:todo', 'v2'], stateProjection(), 'done'),
    ['plan:categories', 'state:done', 'v2'],
  );
});

/**
 * The silent third membership: what a hand-written remove-then-add produces
 * when the remove half is forgotten. A machine doing both cannot leave one, and
 * it heals one it finds.
 */
test('reconcileTags collapses a pre-existing duplicate membership to exactly one', () => {
  assert.deepEqual(
    reconcileTags(
      ['state:todo', 'plan:categories', 'state:done', 'state:doing'],
      stateProjection(), 'done',
    ),
    ['state:done', 'plan:categories'],
  );
});

test('reconcileTags removes the projection entirely when the value goes away', () => {
  assert.deepEqual(
    reconcileTags(['plan:categories', 'state:todo'], stateProjection(), undefined),
    ['plan:categories'],
  );
});

/** A prefix match is on `prefix:`, not on `prefix` — `stateful` is somebody's tag. */
test('reconcileTags does not touch a tag that merely starts with the prefix letters', () => {
  assert.deepEqual(
    reconcileTags(['stateful', 'state-machine', 'state:todo'], stateProjection(), 'done'),
    ['stateful', 'state-machine', 'state:done'],
  );
});

test('projectFieldUpdate returns the whole replacement tag list, not a delta', () => {
  const out = projectFieldUpdate(
    config(), item(['plan:categories', 'seq:18', 'state:todo', 'v2']), { state: 'done' },
  );
  assert.deepEqual(out.extra, { state: 'done' });
  assert.deepEqual(out.tags, ['plan:categories', 'seq:18', 'state:done', 'v2']);
});

/**
 * `updateItem` assigns `item.tags = input.tags` outright, so a list that only
 * carried the changed tag would delete every other membership on the item.
 */
test('projectFieldUpdate carries every unrelated tag through unchanged', () => {
  const tags = ['plan:port', 'seq:3', 'state:todo', 'v2', 'ui'];
  const out = projectFieldUpdate(config(), item(tags), { state: 'blocked' });
  assert.deepEqual(out.tags!.filter((t) => !t.startsWith('state:')), ['plan:port', 'seq:3', 'v2', 'ui']);
});

/** An echo is not a change: returning an identical list would put a tags edit
 * that moved nothing in front of a human for approval. */
test('projectFieldUpdate reports no tag change when the projection already agrees', () => {
  const out = projectFieldUpdate(
    config(), item(['state:done'], { state: 'done' }), { state: 'done' },
  );
  assert.equal(out.tags, undefined);
});

test('projectFieldUpdate leaves a field that projects nothing alone', () => {
  const out = projectFieldUpdate(config(), item(['state:todo']), { seq: '18' });
  assert.equal(out.tags, undefined);
  assert.deepEqual(out.extra, { seq: '18' });
});

/** The whole point: `state:donee` is impossible, not merely undetected. */
test('projectFieldUpdate refuses a value outside the declared vocabulary, naming the legal ones', () => {
  assert.throws(
    () => projectFieldUpdate(config(), item(['state:todo']), { state: 'donee' }),
    (err: Error) => {
      assert.match(err.message, /"state" must be one of: todo, doing, done, blocked/);
      assert.match(err.message, /You passed "donee"/);
      assert.match(err.message, /The closest match is "done"/);
      assert.match(err.message, /Nothing was changed\./);
      assert.match(err.message, /projected into the tag "state:donee"/);
      assert.match(err.message, /mycontext edit <id> --state <value>/);
      return true;
    },
  );
});

/** A closed vocabulary with no projection is still a closed vocabulary. */
test('a declared vocabulary is enforced on a field that projects nothing', () => {
  const rules = config({
    directive: { store: 'field', values: ['do', 'dont'], note: 'What the rule means.' },
  });
  assert.throws(
    () => projectFieldUpdate(rules, item([]), { directive: 'dont ' }),
    /"directive" must be one of: do, dont/,
  );
  // …and the generic spelling is named when the declaration carries no command.
  assert.throws(
    () => projectFieldUpdate(rules, item([]), { directive: 'maybe' }),
    /mycontext edit <id> --extra <name>=<value>/,
  );
});

/** Absent `values` means free text, which is a real answer and not a gap. */
test('a declaration with no vocabulary accepts any value', () => {
  const out = projectFieldUpdate(config(PLAN), item(['plan:categories']), { plan: 'port' });
  assert.deepEqual(out.tags, ['plan:port']);
});

test('a hand-written projected tag is refused, naming the command that does work', () => {
  const refusal = handWrittenProjectionError(config(), 'task', ['v2', 'state:done']);
  assert.ok(refusal, 'a state: tag passed to --tags must be refused');
  assert.match(refusal, /"state:done" is a PROJECTED tag/);
  assert.match(refusal, /update is not a legal operation on a tag/i);
  assert.match(refusal, /Nothing was changed\./);
  assert.match(refusal, /mycontext edit <id> --state done/);
  // The refusal must not leave the reader thinking their other tags are at risk,
  // or that filtering by the projected tag has stopped working.
  assert.match(refusal, /only the "state:" prefix is reserved/);
  assert.match(refusal, /mycontext search --tag state:done/);
});

test('an ordinary tag, and a category that declares no projection, are not refused', () => {
  assert.equal(handWrittenProjectionError(config(), 'task', ['v2', 'ui', 'stateful']), null);
  assert.equal(handWrittenProjectionError(config({}), 'task', ['state:done']), null);
  assert.equal(handWrittenProjectionError(config(), 'rule', ['state:done']), null);
  assert.equal(handWrittenProjectionError(config(), 'task', undefined), null);
});

test('projectedTagValues counts every membership rather than answering with the first', () => {
  assert.deepEqual(
    projectedTagValues(['state:todo', 'v2', 'state:done'], stateProjection()),
    ['todo', 'done'],
  );
});

/**
 * **The measurement proof.**
 *
 * The classifier is exercised over its WHOLE input space — every combination of
 * "what the tags say" and "what the field says" this module can be handed — and
 * asserted to (a) return a classification or a clean bill for every one of
 * them, never undefined and never a kind outside the declared union, and (b)
 * actually produce every kind in the union from that space. (a) is what makes
 * it total; (b) is what makes it honest, because a `MismatchKind` no input can
 * reach is a kind of member the measurement cannot see, which is precisely the
 * blindness that let fifteen disagreeing items sit in this corpus unreported.
 */
test('projectionMismatch classifies every combination of tag list and field, and reaches every kind', () => {
  const KINDS: MismatchKind[] = ['stale', 'duplicate', 'absent', 'unknown_value', 'unprojected'];
  const tagSets: string[][] = [
    [],
    ['state:todo'],
    ['state:done'],
    ['state:donee'],
    ['state:todo', 'state:done'],
    ['state:todo', 'state:todo'],
    ['state:donee', 'state:done'],
  ];
  const fields: (string | undefined)[] = [undefined, 'todo', 'done', 'donee'];

  const seen = new Set<MismatchKind>();
  let clean = 0;
  for (const tags of tagSets) {
    for (const field of fields) {
      const probe = item([...tags, 'plan:categories'], field === undefined ? {} : { state: field });
      const mismatch = projectionMismatch(probe, stateProjection());
      if (mismatch === null) { clean++; continue; }
      assert.ok(KINDS.includes(mismatch.kind), `unknown kind ${mismatch.kind}`);
      assert.equal(mismatch.itemId, 'TASK-probe');
      assert.deepEqual(mismatch.tagValues, tags.map((t) => t.slice('state:'.length)));
      assert.equal(mismatch.field, field ?? null);
      seen.add(mismatch.kind);
    }
  }
  // Every kind in the union is reachable from real data…
  assert.deepEqual([...seen].sort(), [...KINDS].sort());
  // …and the space really did contain agreeing items, so "total" is not
  // "everything is a mismatch".
  assert.equal(clean, 3);
});

test('the four kinds land on the shapes the ruling names', () => {
  const p = stateProjection();
  const kind = (tags: string[], extra: Record<string, string>): MismatchKind | null =>
    projectionMismatch(item(tags, extra), p)?.kind ?? null;

  assert.equal(kind(['state:done'], { state: 'doing' }), 'stale');
  assert.equal(kind(['state:done', 'state:todo'], { state: 'done' }), 'duplicate');
  assert.equal(kind([], { state: 'done' }), 'absent');
  assert.equal(kind(['state:donee'], { state: 'donee' }), 'unknown_value');
  assert.equal(kind(['state:done'], {}), 'unprojected');
  assert.equal(kind(['state:done'], { state: 'done' }), null);
  assert.equal(kind([], {}), null);
});

/**
 * The corpus-level measurement, over one item of every kind at once. The counts
 * have to PARTITION the corpus — every item accounted for exactly once — which
 * is the property the original hand measurement did not have and could not
 * have, since it never looked at the prefixes at all.
 */
test('projectionMismatches partitions a mixed corpus, missing nothing and double-counting nothing', () => {
  const c = config();
  const mk = (id: string, tags: string[], extra: Record<string, string>): Item =>
    ({ ...item(tags, extra), id });
  const items: Item[] = [
    mk('TASK-stale', ['state:done'], { state: 'doing' }),
    mk('TASK-duplicate', ['state:done', 'state:todo'], { state: 'done' }),
    mk('TASK-absent', ['plan:categories'], { state: 'done' }),
    mk('TASK-unknown', ['state:donee'], { state: 'donee' }),
    mk('TASK-unprojected', ['state:todo'], {}),
    mk('TASK-agrees', ['state:todo'], { state: 'todo' }),
    mk('TASK-silent', ['plan:categories'], {}),
    { ...mk('RULE-other', ['state:nonsense'], { state: 'nonsense' }), type: 'rule' },
  ];

  const found = projectionMismatches(items, c);
  assert.deepEqual(
    found.map((m) => [m.itemId, m.kind]),
    [
      ['TASK-stale', 'stale'],
      ['TASK-duplicate', 'duplicate'],
      ['TASK-absent', 'absent'],
      ['TASK-unknown', 'unknown_value'],
      ['TASK-unprojected', 'unprojected'],
    ],
  );
  // A category that declares no projection contributes nothing, however its
  // items are tagged — the declaration is what makes a prefix meaningful.
  assert.equal(found.some((m) => m.itemId === 'RULE-other'), false);
  // Nothing is reported twice.
  assert.equal(new Set(found.map((m) => m.itemId)).size, found.length);
});

/**
 * **The catalogue gate.**
 *
 * `projectionsFor` skips a `store: 'tag'` declaration that claims a projection,
 * and `reconcileTags` would let two fields projecting to one prefix overwrite
 * each other. Neither is a runtime finding, because neither is a corpus
 * problem: both are declaration bugs, and a declaration bug is caught where the
 * declaration is written.
 */
test('the shipped catalogue declares no projection this module has to guess at', () => {
  const declarations: [string, CategoryUpdates][] = [
    ...Object.entries(TIER_UPDATES).map(([tier, u]) => [`tier ${tier}`, u] as [string, CategoryUpdates]),
    ...Object.values(CATEGORIES).map((c) => [`category ${c.name}`, c.updates] as [string, CategoryUpdates]),
  ];
  for (const [where, updates] of declarations) {
    const prefixes: string[] = [];
    for (const [name, decl] of Object.entries(updates)) {
      if (decl.projectsTo === undefined) continue;
      assert.equal(decl.store, 'field', `${where}: "${name}" projects a tag but is stored as a ${decl.store}`);
      prefixes.push(decl.projectsTo);
    }
    assert.equal(
      new Set(prefixes).size, prefixes.length,
      `${where}: two names project to the same tag prefix (${prefixes.join(', ')})`,
    );
  }
});
