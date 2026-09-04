/**
 * **What happens when a project's `config.json` defines a category the plugin
 * also ships**, pinned for the one category where every existing corpus is
 * already in that position.
 *
 * `task` was a CUSTOM category until 2026-09-02: it lived only in a project's
 * `.my_context/config.json`, which is why `mycontext ready`, `core/needs.ts`
 * and doctor's three `needs` checks all shipped with nothing to act on in a
 * fresh install. Adopting it into `CATEGORIES` (core/categories.ts) closes that
 * hole and creates this question in the same move — every corpus that invented
 * `task` still declares it, and now collides with the catalogue.
 *
 * **The answer is PER-KEY, and it is not new machinery.** `resolveConfig`
 * (core/config.ts) seeds `categories` from the catalogue and then walks the
 * config's entries; a name the catalogue holds takes the BUILT-IN branch, where
 * each key is applied on its own:
 *
 *   - `enabled`, `tier`, `description`, `prefix`, `agentEdits`, `scopePolicy`
 *     REPLACE, because they are scalars and replace is the only coherent
 *     reading of a scalar.
 *   - `extraFields` EXTENDS — catalogue fields first, then the config's, with a
 *     repeat collapsing rather than appearing twice.
 *   - `updates` EXTENDS BY NAME, and a name the config declares replaces that
 *     WHOLE entry rather than merging into it.
 *   - Every key the config does NOT name keeps the catalogue's value.
 *
 * `reference` is the proof that the branch existed and worked before any of
 * this: it is shipped AND overridden in this repository's own outer config,
 * with a single `tier` key, and it keeps its prefix, description, extra fields
 * and updates. The first test below is that case, and it is deliberately first.
 *
 * The consequence for a project that already declares `task` in full, stated so
 * nobody has to run it to find out: nothing changes for it. Its entry restates
 * what the catalogue now ships, so every scalar replaces with an equal value
 * and both lists extend with names they already hold. The entry is redundant,
 * not harmful, and deleting it is a separate decision belonging to whoever owns
 * that file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import { CATEGORIES } from '../../src/core/categories.ts';

/**
 * A project's `task` override that restates the catalogue's shape "in full" —
 * every field the shipped entry declares, present and correct.
 *
 * The previous version of this fixture was a snapshot hand-typed 2026-08-23,
 * from this repository's own outer corpus, back when `task` still declared
 * `progress` and `last_change`. Those two were retired from the catalogue
 * (owner ruling, 2026-09-03) and the snapshot was not: `extraFields` only
 * EXTENDS (see the module docblock), so the retired names came back onto the
 * resolved category and stayed there, failing the assertion below against
 * `CATEGORIES.task.extraFields` for as long as nobody noticed the fixture,
 * not the merge, was what had gone stale.
 *
 * So this is built FROM `CATEGORIES.task` instead of typed by hand, which is
 * the only way to stop it rotting the same way again — but copying it
 * verbatim would make the assertions below compare a value to itself, which
 * proves nothing. `extraFields` is REVERSED and `updates` is rebuilt in
 * reverse key order: same content as the catalogue, declared in a different
 * shape than it ships, the way an independently-typed project config would
 * be. The assertions still only pass if `resolveConfig` puts the CATALOGUE's
 * order first and collapses the config's repeats — the actual behaviour
 * under test (documented above `existing.extraFields =` in config.ts) — so a
 * merge that let the config's order win instead, or that concatenated
 * without deduping, would fail here even though it would pass against a
 * verbatim copy.
 */
const PROJECT_TASK = {
  tier: 'rationale',
  prefix: 'TASK',
  description: CATEGORIES.task.description,
  extraFields: [...CATEGORIES.task.extraFields].reverse(),
  updates: Object.fromEntries(
    Object.entries(CATEGORIES.task.updates).reverse().map(([key, value]) => [key, { ...value }]),
  ),
};

/**
 * THE PROOF THE MECHANISM ALREADY WORKED, and the case to read first.
 *
 * A single-key override on a shipped category changes that key and nothing
 * else. `reference` is not hypothetical — it is exactly this shape in this
 * repository's outer `.my_context/config.json`.
 */
test('a one-key override on a shipped category keeps every other shipped default', () => {
  const cfg = resolveConfig({ categories: { reference: { tier: 'normative' } } });
  const resolved = cfg.categories.reference;
  const shipped = CATEGORIES.reference;

  assert.equal(resolved.tier, 'normative', 'the one key the config named did not take effect');
  assert.equal(resolved.prefix, shipped.prefix);
  assert.equal(resolved.description, shipped.description);
  assert.deepEqual(resolved.extraFields, shipped.extraFields);
  assert.deepEqual(resolved.updates, shipped.updates);
  assert.equal(resolved.enabled, true, 'a retiering must not switch the category off');
  // `agentEdits` follows the RESOLVED tier, not the catalogue's — the one key
  // that moves because another key moved, and it is documented as such.
  assert.equal(resolved.agentEdits, 'review');
});

/** The same shape on `task`, which is where every existing corpus now is. */
test('a one-key override on task keeps the shipped defaults for everything else', () => {
  const cfg = resolveConfig({ categories: { task: { prefix: 'WORK' } } });
  const resolved = cfg.categories.task;

  assert.equal(resolved.prefix, 'WORK');
  assert.equal(resolved.tier, CATEGORIES.task.tier);
  assert.equal(resolved.description, CATEGORIES.task.description);
  assert.deepEqual(resolved.extraFields, CATEGORIES.task.extraFields);
  assert.deepEqual(Object.keys(resolved.updates).sort(),
    Object.keys(CATEGORIES.task.updates).sort());
  assert.equal(resolved.enabled, true);
});

/**
 * The collision as it actually stands: a project whose config still defines
 * `task` in full gets the same category it had, and is neither refused nor
 * silently reset.
 */
test('a config that defines task in full is accepted and resolves to the shipped shape', () => {
  const cfg = resolveConfig({ categories: { task: PROJECT_TASK } });
  const resolved = cfg.categories.task;

  assert.equal(resolved.tier, 'rationale');
  assert.equal(resolved.prefix, 'TASK');
  assert.equal(resolved.enabled, true);
  // EXTEND, with every name already present, so the list is the catalogue's and
  // carries no duplicate — `unknownExtraFieldError` and the ingest extraction
  // request both render it verbatim, where a repeat reads as a product bug.
  assert.deepEqual(resolved.extraFields, CATEGORIES.task.extraFields);
  assert.deepEqual(
    resolved.extraFields, [...new Set(resolved.extraFields)],
    'a name declared in both the catalogue and the config appeared twice',
  );
  assert.deepEqual(Object.keys(resolved.updates).sort(),
    Object.keys(CATEGORIES.task.updates).sort());
});

/**
 * ...and the half that says the config still WINS where it disagrees. The two
 * entries above differ only in wording, so a build that ignored the config
 * entirely would pass every assertion so far.
 */
test('where the config disagrees with the catalogue, the config wins for that name', () => {
  const cfg = resolveConfig({
    categories: {
      task: {
        description: 'A ticket, as this team says it',
        extraFields: ['owner'],
        updates: { state: { store: 'field', values: ['open', 'shut'], note: 'Ours.' } },
      },
    },
  });
  const resolved = cfg.categories.task;

  assert.equal(resolved.description, 'A ticket, as this team says it');
  // Extended, not replaced: the catalogue's eight, then `owner`.
  assert.deepEqual(resolved.extraFields, [...CATEGORIES.task.extraFields, 'owner']);
  // The WHOLE `state` entry is the config's — no `projectsTo` inherited from
  // the catalogue underneath the new vocabulary, which is what makes "absent
  // means free text" expressible.
  assert.deepEqual(resolved.updates.state,
    { store: 'field', values: ['open', 'shut'], note: 'Ours.' });
  // ...and every other name the catalogue declares is untouched.
  assert.deepEqual(resolved.updates.needs, CATEGORIES.task.updates.needs);
  assert.equal(Object.keys(resolved.updates).length, Object.keys(CATEGORIES.task.updates).length);
});

/**
 * The limit this creates, stated rather than discovered: a catalogue field
 * cannot be removed from config, because `extraFields` only extends. It is why
 * a shipped `task` can never stop declaring `plan`, `seq`, `state` and `needs`
 * — which is what `isWorkCategory` (core/needs.ts) and doctor's `needs` checks
 * rest on, and why `enabled` is the switch those two follow instead.
 */
test('a config cannot take a catalogue extra field off a shipped category', () => {
  const cfg = resolveConfig({ categories: { task: { extraFields: ['owner'] } } });
  for (const field of ['plan', 'seq', 'state', 'needs']) {
    assert.ok(cfg.categories.task.extraFields.includes(field),
      `"${field}" was dropped by a config that only ADDED a field`);
  }
});

/** Resolving one config must not edit the catalogue object the next one reads —
 * the entries are shared, so both extends have to build fresh values. */
test('overriding task in one config does not reach a second resolved config', () => {
  const first = resolveConfig({
    categories: {
      task: { extraFields: ['owner'], updates: { owner: { store: 'field', note: 'Who.' } } },
    },
  });
  const second = resolveConfig({});
  assert.ok(first.categories.task.extraFields.includes('owner'));
  assert.equal(second.categories.task.extraFields.includes('owner'), false);
  assert.equal(Object.hasOwn(second.categories.task.updates, 'owner'), false);
  assert.deepEqual(second.categories.task.extraFields, CATEGORIES.task.extraFields);
});
