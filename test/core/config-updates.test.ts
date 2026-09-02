import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import { CATEGORIES } from '../../src/core/categories.ts';

/**
 * `updates` in `config.json` — plan:categories seq 14.
 *
 * The owner's constraint, 2026-08-23: "custom categories are created by humen
 * and it should be written in a way a user could edit and define it in the
 * config". Seq 13 gave every SHIPPED category an `updates` declaration and gave
 * a custom one `{}` with no key to set it — so a person could describe their
 * category's SHAPE (`extraFields`) and not its RULES, which is the half that
 * teaches. `task` was the measured case when this shipped: a `config.json`
 * entry with a tier, a prefix, a description and eight extra fields, exactly
 * like any user-defined category. It has since been ADOPTED into the catalogue
 * (2026-09-02), so the fixtures below use `chore` — the same declaration under
 * a name the catalogue does not hold. A shipped category takes the built-in
 * branch of `resolveConfig`, where an override EXTENDS the catalogue rather
 * than being the whole declaration, and that branch is pinned separately in
 * `test/core/config-task-override.test.ts`.
 *
 * The shape a person writes is the one the owner approved:
 *
 *   "chore": { "tier": "rationale", "prefix": "CHORE",
 *             "updates": { "state": { "store": "field", "values": [...],
 *                                     "projectsTo": "state", "note": "…" } } }
 */

/** The owner-approved declaration, verbatim, as a person would type it. */
const CHORE_ENTRY = {
  tier: 'rationale',
  prefix: 'CHORE',
  description: 'A unit of planned work, tracked to completion.',
  extraFields: ['plan', 'state'],
  updates: {
    state: {
      store: 'field',
      values: ['todo', 'doing', 'blocked', 'done'],
      projectsTo: 'state',
      note: 'Where this chore is.',
    },
    plan: { store: 'tag', note: 'Which plan it belongs to.' },
  },
};

test('a custom category declares its own updates in config.json', () => {
  const cfg = resolveConfig({ categories: { chore: CHORE_ENTRY } });
  assert.deepEqual(cfg.categories.chore.updates, {
    state: {
      store: 'field',
      values: ['todo', 'doing', 'blocked', 'done'],
      projectsTo: 'state',
      note: 'Where this chore is.',
    },
    plan: { store: 'tag', note: 'Which plan it belongs to.' },
  });
  // And nothing else about the category moved with it.
  assert.deepEqual(cfg.categories.chore.extraFields, ['plan', 'state']);
  assert.equal(cfg.categories.chore.prefix, 'CHORE');
});

/**
 * A custom category with no `updates` key still resolves to the empty
 * declaration — `{}` says "this category adds nothing of its own", which is a
 * declaration and not a gap. What changed in seq 14 is that it is no longer
 * the ONLY answer available to a custom category.
 */
test('a custom category with no updates entry still declares none', () => {
  const cfg = resolveConfig({
    categories: { chore: { tier: 'rationale', description: 'A unit of planned work' } },
  });
  assert.deepEqual(cfg.categories.chore.updates, {});
});

/**
 * Only `store` is required. Everything else is absent when it does not apply,
 * and an absent `values` means FREE TEXT — a real answer, not a gap.
 *
 * `note` is the one optional key that still resolves to something, because
 * `UpdatableName.note` is required by seq 13's ruling: "an absent `note` would
 * mean this declaration cannot be rendered, and rendering is half of what it
 * exists for". What config may omit is the SENTENCE, not the slot, so the
 * loader supplies one that asserts only what it knows and says where to write
 * a better one.
 */
test('only store is required, and an omitted note is filled rather than left unrenderable', () => {
  const cfg = resolveConfig({
    categories: {
      chore: { tier: 'rationale', description: 'x', updates: { plan: { store: 'tag' } } },
    },
  });
  const plan = cfg.categories.chore.updates.plan;
  assert.equal(plan.store, 'tag');
  assert.equal(plan.values, undefined, 'an absent values means free text, not an empty vocabulary');
  assert.equal(plan.projectsTo, undefined);
  assert.equal(plan.command, undefined);
  assert.match(plan.note, /No note was written for it in \.my_context\/config\.json/);
  assert.match(plan.note, /tag/, 'the filled note still says what it knows: where the value lives');
});

/**
 * THE MERGE SEMANTICS, and the reason a reader must not have to find it out by
 * experiment: `updates` EXTENDS the catalogue's declaration by NAME, exactly as
 * `extraFields` extends the catalogue's list.
 *
 * `rule` declares `directive`, and `directive` is part of what `rule` MEANS —
 * `extraFields` cannot remove it, so a `replace` reading of `updates` would
 * leave the field undroppable and its update rules gone: the category would
 * still declare `directive` and no longer be able to say a single thing about
 * changing it. The two halves of one category description have to follow one
 * rule or they contradict each other.
 */
test('updates on a built-in category EXTENDS the catalogue, it does not replace it', () => {
  const cfg = resolveConfig({
    categories: { rule: { updates: { owner: { store: 'field', note: 'Who owns it.' } } } },
  });
  assert.deepEqual(Object.keys(cfg.categories.rule.updates).sort(), ['directive', 'owner']);
  assert.deepEqual(cfg.categories.rule.updates.directive, CATEGORIES.rule.updates.directive);
  assert.deepEqual(cfg.categories.rule.updates.owner, { store: 'field', note: 'Who owns it.' });
});

/**
 * The other half of "extends by NAME": a name the config declares WINS for that
 * name, and it replaces the WHOLE entry rather than merging key by key.
 *
 * Whole-entry, because an entry is one statement read together: a per-key merge
 * would let a config supply `values` and inherit a `note` describing a
 * different vocabulary, and would make "absent means free text" inexpressible —
 * an inherited `values` could never be cleared.
 *
 * Config wins rather than the catalogue, because the alternatives are both
 * worse: the catalogue winning is a setting accepted and dropped in silence
 * (INV-nothing-is-dropped-silently), and refusing the collision would mean a
 * future catalogue entry breaks a config that was valid before the upgrade.
 */
test('a config declaration for a catalogue name replaces that whole entry', () => {
  const cfg = resolveConfig({
    categories: {
      rule: { updates: { directive: { store: 'field', note: 'Rewritten for this project.' } } },
    },
  });
  assert.deepEqual(cfg.categories.rule.updates.directive, {
    store: 'field', note: 'Rewritten for this project.',
  });
  // The catalogue's `values: ['do','dont']` is GONE, not merged underneath —
  // that is what "whole entry" means, and it is the assertion a per-key merge
  // would fail.
  assert.equal(cfg.categories.rule.updates.directive.values, undefined);
  // And the catalogue object itself was not edited in place.
  assert.deepEqual(CATEGORIES.rule.updates.directive?.values, ['do', 'dont']);
  assert.deepEqual(resolveConfig({}).categories.rule.updates.directive?.values, ['do', 'dont']);
});

/**
 * The 1C.6 discipline applied to this key: a mutant that CLEARS `updates` in
 * the built-in override branch is invisible to every test that resolves a
 * default config. The override branch is the branch that has to be exercised.
 */
test('overriding a built-in category with any other key keeps its updates', () => {
  for (const override of [
    { enabled: true }, { enabled: false }, { tier: 'rationale' }, { description: 'Rewritten' },
    { agentEdits: 'allow' }, { scopePolicy: 'inert' }, { prefix: 'POLICY' },
    { extraFields: ['owner'] },
  ]) {
    const cfg = resolveConfig({ categories: { rule: override } });
    assert.deepEqual(
      cfg.categories.rule.updates, CATEGORIES.rule.updates,
      `overriding rule with ${JSON.stringify(override)} dropped its updates`,
    );
  }
});

test('updates must be an object, refused rather than coerced', () => {
  for (const bad of ['state', 42, null, true, [], [{ store: 'field' }]]) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { updates: bad } } }),
      /has invalid updates/,
      `accepted updates ${JSON.stringify(bad)}`,
    );
  }
  // The refusal shows the accepted shape, not merely the "no".
  assert.throws(() => resolveConfig({ categories: { rule: { updates: 'state' } } }), (err: Error) => {
    assert.match(err.message, /"store": "field"/, 'the refusal must show the shape a person writes');
    assert.match(err.message, /use \{\} to declare none/);
    assert.match(err.message, /Nothing was loaded/);
    return true;
  });
});

test('an updates entry that is not an object is refused, naming the entry', () => {
  for (const bad of ['field', 42, null, true, ['field']]) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { updates: { owner: bad } } } }),
      /has invalid updates\.owner/,
      `accepted updates.owner ${JSON.stringify(bad)}`,
    );
  }
});

/**
 * The `requireCategoryKeys` failure one level down: a key nobody reads,
 * accepted and dropped. `"stores"` for `"store"` and `"projects_to"` for
 * `"projectsTo"` are the two a person actually types.
 */
test('an unknown key inside an updates entry is refused, with the accepted set', () => {
  assert.throws(
    () => resolveConfig({
      categories: { rule: { updates: { owner: { store: 'field', projects_to: 'owner' } } } },
    }),
    (err: Error) => {
      assert.match(err.message, /"projects_to"/);
      assert.match(err.message, /not a key an update declaration understands/);
      assert.match(err.message, /store, values, projectsTo, command, note/);
      assert.match(err.message, /Nothing was loaded/);
      return true;
    },
  );
});

test('an updates entry with no store is refused, and told what store means', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { updates: { owner: { note: 'Who owns it.' } } } } }),
    (err: Error) => {
      assert.match(err.message, /updates\.owner/);
      assert.match(err.message, /no "store"/);
      assert.match(err.message, /membership fixed for the item's life/);
      return true;
    },
  );
});

/**
 * The store vocabulary goes through `enumError` — the ONE wording this project
 * uses for "not one of the allowed values", the same one `agentEdits` and
 * `scopePolicy` use. A second phrasing for that fact is the drift this codebase
 * keeps producing, and the shared one throws in a closest match for free.
 */
test('a store that is not field or tag is refused by the shared enum wording', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { updates: { owner: { store: 'feild' } } } } }),
    (err: Error) => {
      assert.match(err.message, /"categories\.rule\.updates\.owner\.store" must be one of: field, tag/);
      assert.match(err.message, /You passed "feild"/);
      assert.match(err.message, /The closest match is "field"/);
      return true;
    },
  );
  for (const bad of ['tags', 'fields', '', 42, null, {}]) {
    assert.throws(
      () => resolveConfig({ categories: { rule: { updates: { owner: { store: bad } } } } }),
      /must be one of: field, tag/,
      `accepted store ${JSON.stringify(bad)}`,
    );
  }
});

/**
 * `values` is the key that makes a typo impossible rather than merely unlikely,
 * so an unusable one is refused rather than kept. `[]` is the case worth the
 * line: a closed vocabulary with no members admits nothing, and the person who
 * wrote it meant free text — which is spelled by omitting the key.
 */
test('values must be a non-empty array of non-empty strings', () => {
  for (const bad of ['todo', 42, null, {}, [], ['todo', 7], [''], [null]]) {
    assert.throws(
      () => resolveConfig({
        categories: { rule: { updates: { owner: { store: 'field', values: bad } } } },
      }),
      /has invalid updates\.owner\.values/,
      `accepted values ${JSON.stringify(bad)}`,
    );
  }
  assert.throws(
    () => resolveConfig({
      categories: { rule: { updates: { owner: { store: 'field', values: [] } } } },
    }),
    /omit "values" entirely to mean free text/,
  );
});

/**
 * A projection keeps a FIELD filterable by writing a tag beside it. On a tag
 * store there is nothing to project — the tag is already the tag — so the key
 * could only be accepted and never acted on.
 */
test('projectsTo is refused on a tag store, and told which way to fix it', () => {
  assert.throws(
    () => resolveConfig({
      categories: { rule: { updates: { owner: { store: 'tag', projectsTo: 'owner' } } } },
    }),
    (err: Error) => {
      assert.match(err.message, /updates\.owner\.projectsTo on a "tag" store/);
      assert.match(err.message, /"store": "field"/);
      return true;
    },
  );
});

test('projectsTo must be a tag prefix, not an arbitrary string', () => {
  for (const bad of ['', 'has space', 'has:colon', 42, null, ['owner']]) {
    assert.throws(
      () => resolveConfig({
        categories: { rule: { updates: { owner: { store: 'field', projectsTo: bad } } } },
      }),
      /has invalid updates\.owner\.projectsTo/,
      `accepted projectsTo ${JSON.stringify(bad)}`,
    );
  }
  // The legal one still loads.
  assert.equal(
    resolveConfig({
      categories: { rule: { updates: { owner: { store: 'field', projectsTo: 'owner-of' } } } },
    }).categories.rule.updates.owner.projectsTo,
    'owner-of',
  );
});

/** Both are rendered to a person on one line, so neither may be blank or carry
 * a newline that would break the table they are rendered in. */
test('command and note must each be one non-empty line', () => {
  for (const key of ['command', 'note']) {
    for (const bad of ['', '   ', 'two\nlines', 42, null, {}]) {
      assert.throws(
        () => resolveConfig({
          categories: { rule: { updates: { owner: { store: 'field', [key]: bad } } } },
        }),
        new RegExp(`has invalid updates\\.owner\\.${key}`),
        `accepted ${key} ${JSON.stringify(bad)}`,
      );
    }
  }
});

/** An updatable name is what a person TYPES to change the thing, so it cannot
 * be empty — a blank name renders as a blank row in `mycontext help`. */
test('an updates entry under the empty name is refused', () => {
  assert.throws(
    () => resolveConfig({ categories: { rule: { updates: { '': { store: 'field' } } } } }),
    /empty name/,
  );
});

/**
 * The seventh occurrence of this project's oldest bug, in the one map added
 * since it was last found: `updates` keys come from user JSON, and building the
 * map by assignment would send `"__proto__"` to the prototype setter — the
 * declaration silently dropped and no own key created.
 */
test('an updatable name of __proto__ becomes an own property, not a prototype write', () => {
  // Parsed from text, because that is how a config arrives and because an
  // object LITERAL would read `__proto__:` as the prototype-setting syntax and
  // never produce the key this test is about.
  const cfg = resolveConfig(JSON.parse(
    '{"categories":{"chore":{"tier":"rationale","description":"x","updates":' +
    '{"__proto__":{"store":"field","note":"Pathological but writable."}}}}}',
  ));
  const updates = cfg.categories.chore.updates as Record<string, unknown>;
  assert.ok(Object.hasOwn(updates, '__proto__'), 'the declaration was dropped by the setter');
  assert.deepEqual(Object.keys(updates), ['__proto__']);
  assert.equal((Object.prototype as Record<string, unknown>).store, undefined);
});

/** Resolving twice must not let one config edit the other's — the catalogue's
 * declaration object is shared, so the extend has to build a new one. */
test('extending one config\'s updates does not reach a second resolved config', () => {
  const cfg1 = resolveConfig({
    categories: { rule: { updates: { owner: { store: 'field', note: 'Who owns it.' } } } },
  });
  const cfg2 = resolveConfig({});
  assert.ok(Object.hasOwn(cfg1.categories.rule.updates, 'owner'));
  assert.equal(Object.hasOwn(cfg2.categories.rule.updates, 'owner'), false);
});

/** `updates` is settable next to every other category key, on a built-in and on
 * a custom category alike — the refusal is about keys the loop cannot act on. */
test('updates loads alongside every other category key', () => {
  const cfg = resolveConfig({
    categories: {
      rule: {
        enabled: false, tier: 'rationale', description: 'D', prefix: 'RL',
        agentEdits: 'review', scopePolicy: 'inert', extraFields: ['owner'],
        updates: { owner: { store: 'field', command: 'mycontext edit <id> --extra owner=x', note: 'Who owns it.' } },
      },
      chore: CHORE_ENTRY,
    },
  });
  assert.deepEqual(cfg.categories.rule.extraFields, ['directive', 'owner']);
  assert.deepEqual(Object.keys(cfg.categories.rule.updates).sort(), ['directive', 'owner']);
  assert.equal(cfg.categories.rule.updates.owner.command, 'mycontext edit <id> --extra owner=x');
  assert.deepEqual(Object.keys(cfg.categories.chore.updates).sort(), ['plan', 'state']);
});
