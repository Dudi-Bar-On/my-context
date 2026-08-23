/**
 * The two config projections, the pack refusals and the field-wise merge.
 *
 * The rule this file exists to hold is one sentence: **a pack may name
 * knowledge this build has never heard of, and may not re-describe knowledge
 * it has.** Every refusal below is one half of that asymmetry, and the two
 * halves are tested against the SAME `local` config — the importing build's
 * resolved `Config` — so "does this name already exist here" cannot mean one
 * thing in the tier check and another in the prefix check.
 *
 * **Every refusal is asserted by its MESSAGE and not merely by its count.**
 * Several of these inputs break more than one rule, and a test that asserts
 * only `/^my_context: /` stays green when the check it was written for is
 * deleted and a later one refuses the same input for a different reason. That
 * is a checker that cannot fail, and this module has room for six of them.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import { PACK_PROTOCOL } from '../../src/pack/layout.ts';
import {
  mergePackConfig, projectExportConfig, projectPackConfig, refusePackConfig,
} from '../../src/pack/config-io.ts';

// The importing build's resolved config: the names it already knows and the
// prefixes those names already hold. Both halves of §6n.1 read from this one
// value, so they cannot disagree about what "already exists here" means.
const LOCAL = resolveConfig({});

/** A workspace that defines a category the product's catalogue does not. */
const WITH_CUSTOM = resolveConfig({
  categories: { threat_model: { tier: 'normative', description: 'A threat we model.' } },
});

// --- the export projection ------------------------------------------------

test('an exported config round-trips through resolveConfig', () => {
  const config = resolveConfig({ profile: 'standard', categories: { rule: { scopePolicy: 'required' } } });
  const raw = projectExportConfig(config);
  assert.doesNotThrow(() => resolveConfig(raw));
  // `name` is refused by the category key check on the way in, so serialising
  // the resolved shape would produce a file this product wrote and cannot
  // read back. It is the reason the projection is a stated key list rather
  // than a spread — and the reason the key list needs the gate below.
  const text = JSON.stringify(raw);
  assert.equal(text.includes('"name"'), false);
  assert.deepEqual(resolveConfig(raw).skippedKeys, [], 'the projection writes no key this build cannot read');
});

test('the export projection re-resolves to the same config, key for key', () => {
  // The projection is not a serialisation of the resolved shape, so nothing
  // makes it faithful except this: every key that decides behaviour comes
  // back with the value it had. A key dropped from the writer would be
  // invisible to a round trip that only asserted `doesNotThrow`.
  const config = resolveConfig({
    profile: 'minimal',
    categories: {
      rule: { scopePolicy: 'required', agentEdits: 'allow', prefix: 'POLICY' },
      lesson: { enabled: false },
      threat_model: { tier: 'rationale', description: 'A threat we model.', scopePolicy: 'inert' },
    },
    budgets: { pinned: 11 },
    watchedDocs: ['docs/mine/**'],
  });
  const back = resolveConfig(projectExportConfig(config));
  assert.equal(back.profile, 'minimal');
  assert.deepEqual(back.budgets, config.budgets);
  assert.deepEqual(back.watchedDocs, ['docs/mine/**']);
  for (const [name, category] of Object.entries(config.categories)) {
    const seen = back.categories[name];
    assert.ok(seen, `${name} did not survive the round trip`);
    for (const key of [
      'enabled', 'tier', 'description', 'prefix', 'agentEdits', 'scopePolicy', 'extraFields',
    ] as const) {
      assert.deepEqual(seen[key], category[key], `${name}.${key}`);
    }
  }
});

/**
 * The gate the drift this file was written to end could not get past.
 *
 * `config.json` accepted seven category keys and a whole-workspace export
 * wrote six: `extraFields` was settable, was set, and did not travel. Nothing
 * noticed, because nothing compared the two lists. This is that comparison,
 * and it is what fails when an EIGHTH key is added to one list and not the
 * other.
 *
 * The accepted list is READ FROM THE RESOLVER rather than written out here. A
 * list typed into this test would be a third copy of the same list, drifting
 * from the other two exactly as they drifted from each other — the defect one
 * level up, in the test that exists to catch it.
 */
function categoryKeysConfigAccepts(): string[] {
  // `CATEGORY_KEYS` is module-private to core/config.ts, and the ONE surface
  // that renders it verbatim is this refusal: `A category accepts:
  // ${CATEGORY_KEYS.join(', ')}.` So the key check is asked a question only
  // that list can answer.
  let message = '';
  try {
    resolveConfig({ categories: { rule: { thisIsNotAKeyAnyConfigAccepts: true } } });
  } catch (err) {
    message = err instanceof Error ? err.message : String(err);
  }
  const match = /A category accepts: ([^.]+)\./.exec(message);
  // Loudly, not by returning a short list: a helper that silently returned
  // fewer keys than `CATEGORY_KEYS` holds would make the gate below pass by
  // asking nothing, which is the failure mode the gate exists to prevent.
  assert.ok(
    match,
    `this test reads the keys config.json accepts out of core/config.ts's own refusal, and that ` +
    `refusal no longer contains "A category accepts: <list>." — it said: ${JSON.stringify(message)}. ` +
    `Re-point this helper at whatever now renders CATEGORY_KEYS, or export CATEGORY_KEYS and ` +
    `import it. Do NOT paste the list in here: a hand-copied list is the drift this gate exists ` +
    `to catch, one level up.`,
  );
  const keys = (match[1] ?? '').split(', ');
  assert.ok(keys.includes('enabled') && keys.length >= 7, `parsed an implausible key list: ${keys.join(', ')}`);
  return keys;
}

test('every key config.json ACCEPTS is a key a whole-workspace export WRITES', () => {
  const accepted = categoryKeysConfigAccepts();
  // What the export actually wrote, not what a constant says it writes: the
  // projection is the thing an artefact is made of, and EXPORT_KEYS is only
  // how it is spelled today.
  const raw = projectExportConfig(resolveConfig({}));
  const entries = Object.entries(raw.categories);
  assert.ok(entries.length > 0, 'an export with no categories cannot answer this question');

  for (const [name, entry] of entries) {
    const written = Object.keys(entry);
    const missing = accepted.filter((key) => !written.includes(key));
    assert.deepEqual(
      missing, [],
      `config.json ACCEPTS ${missing.join(', ')} on a category, and a whole-workspace export ` +
      `does not write ${missing.length === 1 ? 'it' : 'them'} (checked on "${name}"). Add ` +
      `${missing.join(', ')} to EXPORT_KEYS in src/pack/config-io.ts — and to RawCategoryJson ` +
      `beside it — because a key config.json ACCEPTS must also TRAVEL: a user who sets it has ` +
      `an export that silently drops it, and the artefact then describes a workspace nobody ` +
      `has. Pick the position deliberately and say why in a comment; config.json's BYTES are ` +
      `hashed into the manifest, so key order is fixed once written. If the new key genuinely ` +
      `must not travel, that is a decision, and it belongs here as a named exception with its ` +
      `reason — not as a key quietly missing from a list. (extraFields drifted out of ` +
      `EXPORT_KEYS exactly this way and nothing noticed for the life of the feature.)`,
    );
    // The other direction, which costs one line: a key the export writes that
    // config.json cannot read is a file this product wrote and refuses.
    const unreadable = written.filter((key) => !accepted.includes(key));
    assert.deepEqual(
      unreadable, [],
      `a whole-workspace export writes ${unreadable.join(', ')} on "${name}", and config.json ` +
      `does not accept ${unreadable.length === 1 ? 'it' : 'them'} — an artefact this build ` +
      `wrote and this build refuses to read back. Remove ${unreadable.join(', ')} from ` +
      `EXPORT_KEYS, or add it to CATEGORY_KEYS in src/core/config.ts.`,
    );
  }
});

test('extraFields travels on a whole-workspace export, on a built-in and on a custom category', () => {
  // The measured defect: `task` exported with a description reading "Its plan,
  // sequence, state and progress live in extra fields" and carried none of
  // them. An export is the author's workspace travelling whole, so both
  // branches of `extraFields` travel — the union a config added to a built-in
  // and the whole list a custom category is.
  const config = resolveConfig({
    categories: {
      rule: { extraFields: ['owner'] },
      threat_model: { tier: 'normative', description: 'A threat.', extraFields: ['likelihood'] },
    },
  });
  assert.deepEqual(config.categories.rule.extraFields, ['directive', 'owner']);
  const back = resolveConfig(projectExportConfig(config));
  assert.deepEqual(back.categories.rule.extraFields, ['directive', 'owner'], 'the union survives');
  assert.deepEqual(back.categories.threat_model.extraFields, ['likelihood'], 'and so does a custom list');
  // Idempotent, which is why writing a built-in's resolved list cannot freeze
  // this build's catalogue: the built-in branch resolves by UNION, so reading
  // back a list that already contains the catalogue's defaults adds nothing.
  assert.equal(
    JSON.stringify(projectExportConfig(back)),
    JSON.stringify(projectExportConfig(config)),
    'a second export of a re-read export is byte-identical',
  );
});

test('the export projection hands back its own arrays, not the resolved config\'s', () => {
  // Every other field of this projection is copied (`{...budgets}`,
  // `[...watchedDocs]`); `extraFields` is the one array inside a category
  // entry, and an alias would let a later mutation of either show up in the
  // other.
  const config = resolveConfig({ categories: { rule: { extraFields: ['owner'] } } });
  const raw = projectExportConfig(config);
  assert.notEqual(raw.categories.rule?.extraFields, config.categories.rule.extraFields);
  assert.deepEqual(raw.categories.rule?.extraFields, ['directive', 'owner']);
});

test('the export projection does not carry "ui" either, and the omission is pinned rather than assumed', () => {
  // `ui` joined TOP_LEVEL_KEYS after this projection's key list was written.
  // It is a permission about the receiving machine rather than knowledge, so
  // it is omitted like `profile` — but an export is meant to be the author's
  // whole workspace, and a UI switched off does not survive one. Pinned here
  // so the next reader finds a decision instead of an accident.
  const config = resolveConfig({ ui: { enabled: false } });
  assert.equal(config.ui.enabled, false);
  const raw = projectExportConfig(config);
  assert.equal(Object.hasOwn(raw, 'ui'), false);
  assert.equal(resolveConfig(raw).ui.enabled, true);
});

test('the export projection is byte-stable, whatever order the config declared its categories in', () => {
  // `config.json` is hashed into the manifest, so two exports of one
  // workspace that differ only in key order are two artefacts that do not
  // verify against each other.
  const a = projectExportConfig(resolveConfig({
    categories: {
      zeta: { tier: 'rationale', description: 'Z.' },
      alpha: { tier: 'rationale', description: 'A.' },
    },
  }));
  const b = projectExportConfig(resolveConfig({
    categories: {
      alpha: { tier: 'rationale', description: 'A.' },
      zeta: { tier: 'rationale', description: 'Z.' },
    },
  }));
  assert.equal(JSON.stringify(a), JSON.stringify(b));
  assert.deepEqual(Object.keys(a.categories).slice(0, 2), ['adr', 'alpha']);
});

// --- the pack projection --------------------------------------------------

test('a pack config carries vocabulary and nothing about the importer', () => {
  const raw = projectPackConfig(resolveConfig({}), ['rule', 'standard']);
  assert.deepEqual(Object.keys(raw), ['categories']);
  assert.deepEqual(Object.keys(raw.categories).toSorted(), ['rule', 'standard']);
  for (const entry of Object.values(raw.categories)) {
    assert.deepEqual(Object.keys(entry).toSorted(), ['enabled', 'prefix', 'scopePolicy']);
    assert.equal(entry.enabled, true);
  }
  // The values are the exporting workspace's, not this build's defaults: a
  // scope policy the author set is part of what the category MEANS to them.
  const configured = projectPackConfig(
    resolveConfig({ categories: { rule: { scopePolicy: 'required', prefix: 'POLICY' } } }),
    ['rule'],
  );
  assert.equal(configured.categories.rule.scopePolicy, 'required');
  assert.equal(configured.categories.rule.prefix, 'POLICY');
});

test('a pack carrying a CUSTOM category also carries its tier, description and extraFields', () => {
  // The exporter's own workspace defines `threat_model`; the receiver's does
  // not. Without tier and description `resolveConfig` refuses the pack's
  // config on arrival, so omitting them would ship a pack that cannot be
  // imported; without `extraFields` the config loads and every item the pack
  // carries for that category is then refused by `unknownExtraFieldError`,
  // which is the quieter half of the same failure.
  const raw = projectPackConfig(WITH_CUSTOM, ['rule', 'threat_model']);
  assert.deepEqual(Object.keys(raw.categories.rule).toSorted(), ['enabled', 'prefix', 'scopePolicy']);
  assert.deepEqual(
    Object.keys(raw.categories.threat_model).toSorted(),
    // `updates` joined this list on 2026-08-23, on the same predicate and for
    // the reason one step further on: `extraFields` says which fields an item
    // may carry, `updates` says what may be CHANGED on them. A pack carrying
    // the fields and not their rules lands a category whose items are accepted
    // and whose every update refusal has to be rediscovered by trial.
    ['description', 'enabled', 'extraFields', 'prefix', 'scopePolicy', 'tier', 'updates'],
  );
  // Written even when empty — see the projection's docstring: `[]` from the
  // author is a fact, an omission read as `[]` by the receiver is a guess.
  assert.deepEqual(raw.categories.threat_model.extraFields, []);
  const withFields = projectPackConfig(
    resolveConfig({
      categories: { threat_model: { tier: 'normative', description: 'A threat.', extraFields: ['likelihood'] } },
    }),
    ['threat_model'],
  );
  assert.deepEqual(withFields.categories.threat_model.extraFields, ['likelihood']);
  // The pack's key order is fixed for the same reason the export's is: a
  // pack's config.json is hashed into its manifest too.
  assert.deepEqual(
    Object.keys(withFields.categories.threat_model),
    ['enabled', 'tier', 'description', 'prefix', 'scopePolicy', 'extraFields', 'updates'],
  );
  assert.equal(raw.categories.threat_model.tier, 'normative');
  assert.equal(raw.categories.threat_model.prefix, 'THREAT');
  assert.equal(JSON.stringify(raw).includes('agentEdits'), false, 'never, on either branch');
});

test('what the pack projection writes is exactly what the pack refusal accepts', () => {
  // The two halves of this module against each other, which is the only test
  // that can fail when they disagree: a projection that emitted `tier` for a
  // built-in, or omitted it for a custom name, would be refused by the very
  // check this file also owns — on the receiver's machine, hours later.
  const packed = projectPackConfig(WITH_CUSTOM, ['rule', 'threat_model']);
  assert.deepEqual(refusePackConfig(packed, LOCAL), []);

  const merged = mergePackConfig({ profile: 'standard', categories: {}, budgets: {} }, packed);
  const resolved = resolveConfig(merged);
  assert.equal(resolved.categories.threat_model.tier, 'normative');
  assert.equal(resolved.categories.threat_model.enabled, true);
  assert.equal(resolved.categories.threat_model.agentEdits, 'review', 'defaulted from the tier, never carried');
  assert.equal(resolved.categories.rule.tier, 'normative', 'and the built-in keeps the tier this build gave it');
});

test('the pack projection ignores the order and the repeats of the types it is given', () => {
  assert.equal(
    JSON.stringify(projectPackConfig(LOCAL, ['standard', 'rule', 'rule'])),
    JSON.stringify(projectPackConfig(LOCAL, ['rule', 'standard'])),
  );
});

test('a type with no category in the exporting config is refused, not written as a guess', () => {
  // `loadLayer` still indexes items whose category was removed from config,
  // so this reaches the exporter as an ordinary item type. There is no honest
  // prefix, tier or description to invent for it, and a pack that declared
  // nothing for it would carry items no build could accept.
  assert.throws(
    () => projectPackConfig(LOCAL, ['rule', 'threat_model']),
    (err: Error) => {
      assert.match(err.message, /^my_context: /);
      assert.match(err.message, /threat_model/);
      assert.match(err.message, /config/);
      return true;
    },
  );
});

// --- the trust boundary ---------------------------------------------------

test('tier on a category that already resolves here is refused — this is the F2 attack', () => {
  const refusals = refusePackConfig(
    { categories: { rule: { tier: 'rationale', agentEdits: 'allow' } } }, LOCAL,
  );
  assert.equal(refusals.length, 2);
  assert.ok(refusals.some((r) => r.includes('tier')));
  assert.ok(refusals.some((r) => r.includes('agentEdits')));
  assert.ok(refusals.every((r) => /boundary/.test(r)));
});

test('the tier refusal names the attack AND the half a pack is still allowed', () => {
  // Asserted on the wording, because the key allow-list a few lines below
  // ALSO refuses `tier` on an existing name: with only a count and a
  // `/^my_context: /` match, deleting this check leaves the suite green and
  // the message teaching the rule §6n.1 withdrew.
  const [refusal] = refusePackConfig({ categories: { rule: { tier: 'rationale' } } }, LOCAL);
  assert.ok(refusal);
  assert.match(refusal, /categories\.rule\.tier/);
  assert.match(refusal, /already has/);
  assert.match(refusal, /a boundary a flag can override is not a boundary/);
  assert.match(refusal, /A pack MAY declare a tier for a category name this build does not have/);
});

test('tier on a name this build has never heard of is ACCEPTED — §6n.1', () => {
  // The half §6m.4 refused and §6n.1 restored. It can override nothing,
  // because there is nothing at this name to override; and resolveConfig
  // will not resolve the config without it, which is why the flat refusal
  // was jointly unsatisfiable with the code rather than merely strict.
  const raw = { categories: { threat_model: { enabled: true, tier: 'normative', description: 'A threat.' } } };
  assert.deepEqual(refusePackConfig(raw, LOCAL), []);
  assert.doesNotThrow(() => resolveConfig(mergePackConfig({ categories: {} }, raw)));
});

test('a new category WITHOUT tier and description is refused, naming both', () => {
  // Not a policy of this module — the resolver would throw on the way in,
  // and a refusal here names the pack rather than surfacing as a config
  // error after the corpus has been half-built.
  const refusals = refusePackConfig({ categories: { threat_model: { enabled: true } } }, LOCAL);
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0]?.includes('threat_model'));
  assert.ok(/tier/.test(refusals[0] ?? '') && /description/.test(refusals[0] ?? ''));
  assert.match(refusals[0] ?? '', /pack/, 'the pack is named, not just the config');
});

test('agentEdits is refused on a NEW name too, and the refusal says the tier already decides it', () => {
  const refusals = refusePackConfig(
    { categories: { threat_model: { tier: 'normative', description: 'A threat.', agentEdits: 'allow' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0]?.includes('agentEdits'));
  assert.match(refusals[0] ?? '', /tier already decides it/);
});

test('description on a category that already resolves here is refused', () => {
  // The description is what this build tells every agent the category means.
  // A pack may name knowledge this build has never heard of; it may not
  // re-describe knowledge it has.
  const refusals = refusePackConfig({ categories: { rule: { description: 'Whatever I say it is.' } } }, LOCAL);
  assert.equal(refusals.length, 1);
  assert.match(refusals[0] ?? '', /categories\.rule\.description/);
  assert.match(refusals[0] ?? '', /re-describe/);
});

test('a new category whose prefix is already in use is reported, not silently accepted', () => {
  const refusals = refusePackConfig(
    { categories: { threat_model: { tier: 'normative', description: 'A threat.', prefix: 'RULE' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.ok(refusals[0]?.includes('RULE') && refusals[0]?.includes('rule'));
});

test('the prefix check folds case and spares a category its own prefix', () => {
  // `makeId` upper-cases the prefix, so "Rule" and "RULE" mint the same ids —
  // a comparison that respected case would report no collision for the one
  // spelling an attacker would actually write.
  const refusals = refusePackConfig(
    { categories: { threat_model: { tier: 'normative', description: 'A threat.', prefix: 'Rule' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.match(refusals[0] ?? '', /collide/);
  assert.deepEqual(refusePackConfig({ categories: { rule: { prefix: 'RULE' } } }, LOCAL), [],
    'a category may keep the prefix it already has');
  assert.equal(refusePackConfig({ categories: { rule: { prefix: 'STD' } } }, LOCAL).length, 1,
    'and may not take another category\'s, on an existing name either');

  // Both sides fold, not just the pack's. `requirePrefix` accepts any case, so
  // an importer whose own custom category was configured with a lower-case
  // prefix holds "abc" — and a pack claiming "ABC" mints exactly the same ids.
  const localLower = resolveConfig({
    categories: { threat_model: { tier: 'normative', description: 'A threat.', prefix: 'abc' } },
  });
  const clash = refusePackConfig(
    { categories: { risk_model: { tier: 'normative', description: 'A risk.', prefix: 'ABC' } } },
    localLower,
  );
  assert.equal(clash.length, 1);
  assert.ok(clash[0]?.includes('threat_model'), 'and the refusal names the category holding it');
});

test('budgets, watchedDocs and profile in a pack are refused', () => {
  for (const key of ['budgets', 'watchedDocs', 'profile']) {
    const refusals = refusePackConfig({ [key]: {} }, LOCAL);
    assert.ok(refusals.some((r) => r.includes(key)), key);
  }
});

test('each of the three never-carried keys is refused for its own reason', () => {
  // One generic "a pack carries only categories" sentence would pass the test
  // above with all three checks deleted. Each names what carrying it would
  // actually do to the importer.
  assert.match(refusePackConfig({ profile: 'minimal' }, LOCAL)[0] ?? '', /wholesale/);
  assert.match(refusePackConfig({ budgets: { pinned: 1 } }, LOCAL)[0] ?? '', /how much of YOUR corpus/);
  assert.match(refusePackConfig({ watchedDocs: ['x/**'] }, LOCAL)[0] ?? '', /author's own repository/);
});

test('enabled: false is refused — a pack may add vocabulary, never silence the importer', () => {
  assert.equal(refusePackConfig({ categories: { rule: { enabled: false } } }, LOCAL).length, 1);
  assert.match(
    refusePackConfig({ categories: { rule: { enabled: false } } }, LOCAL)[0] ?? '',
    /categories\.rule\.enabled/,
  );
  assert.equal(refusePackConfig({ categories: { rule: { enabled: 'yes' } } }, LOCAL).length, 1,
    'and a non-boolean is the same refusal, not a resolver error later');
  assert.equal(
    refusePackConfig({
      categories: { threat_model: { enabled: false, tier: 'normative', description: 'A threat.' } },
    }, LOCAL).length,
    1,
    'on a new name too — a disabled category is a setting, not knowledge',
  );
});

test('an unknown top-level key is refused rather than skipped, and the message says why', () => {
  // R14.2 SKIPS an unknown top-level key in your OWN config, because that
  // file may come from a newer build. A pack is a stranger's file and the
  // merge carries nothing out of it except `categories`, so skipping would
  // be the silent drop, not the safe read. The format's own version is the
  // manifest protocol, which is what a newer pack format changes.
  const refusals = refusePackConfig({ categories: {}, ui: { enabled: false } }, LOCAL);
  assert.equal(refusals.length, 1);
  assert.match(refusals[0] ?? '', /"ui"/);
  assert.ok(refusals[0]?.includes(PACK_PROTOCOL));
});

test('extraFields from a pack splits the way tier and description do: refused on a name this build HAS', () => {
  // §6n.1's asymmetry, reached through a third key. A pack may name knowledge
  // this build has never heard of — and for a custom category `extraFields`
  // is most of what the name MEANS — and may not re-declare knowledge it has:
  // the built-in branch of `resolveConfig` resolves extraFields by UNION, so
  // a pack could not delete a field, but it could ADD one to `rule` for every
  // rule the importer already wrote.
  const onExisting = refusePackConfig({ categories: { rule: { extraFields: ['owner'] } } }, LOCAL);
  assert.equal(onExisting.length, 1);
  assert.match(onExisting[0] ?? '', /extraFields/);
  assert.match(onExisting[0] ?? '', /already has/);
  // The refusal must say what a pack MAY do instead, or an author reads it as
  // "packs cannot carry a custom category's fields" and ships one that cannot
  // accept its own items.
  assert.match(onExisting[0] ?? '', /MAY declare extraFields for a category name this build does not have/);

  const onNew = refusePackConfig({
    categories: {
      threat_model: { tier: 'normative', description: 'A threat.', extraFields: ['owner'] },
    },
  }, LOCAL);
  assert.deepEqual(onNew, [], 'a custom category may carry the fields its own items need');

  // The permitted set differs between the two branches, and naming the wrong
  // one sends an author to write a key that will be refused again.
  const otherKey = refusePackConfig({ categories: { rule: { nonsense: 1 } } }, LOCAL);
  const otherKeyNew = refusePackConfig({
    categories: { threat_model: { tier: 'normative', description: 'A threat.', nonsense: 1 } },
  }, LOCAL);
  assert.match(otherKey[0] ?? '', /a pack may set: enabled, prefix, scopePolicy\./);
  assert.match(
    otherKeyNew[0] ?? '',
    /a pack may set: enabled, tier, description, prefix, scopePolicy, extraFields, updates\./,
  );
});

test('a pack carrying a custom category arrives able to accept that category\'s own items', () => {
  // The end of the chain the refusal used to break: project a pack from a
  // workspace whose custom category declares frontmatter, refuse it against a
  // build that has never heard of the name, merge it, and the field is there.
  const authored = resolveConfig({
    categories: {
      threat_model: { tier: 'normative', description: 'A threat.', extraFields: ['likelihood'] },
    },
  });
  const packed = projectPackConfig(authored, ['threat_model']);
  assert.deepEqual(refusePackConfig(packed, LOCAL), []);
  const resolved = resolveConfig(mergePackConfig({ categories: {} }, packed));
  assert.deepEqual(resolved.categories.threat_model.extraFields, ['likelihood']);
});

test('a category named __proto__ is refused, because assigning it would set a prototype', () => {
  const refusals = refusePackConfig(
    { categories: { ['__proto__']: { tier: 'normative', description: 'A threat.' } } },
    LOCAL,
  );
  assert.equal(refusals.length, 1);
  assert.match(refusals[0] ?? '', /__proto__/);
  assert.match(refusals[0] ?? '', /prototype/);
});

test('a pack config that is not an object at all is refused', () => {
  for (const raw of [null, 'categories', 42, ['rule']]) {
    const refusals = refusePackConfig(raw, LOCAL);
    assert.equal(refusals.length, 1, JSON.stringify(raw));
    assert.match(refusals[0] ?? '', /not an object/);
  }
});

test('categories present-but-not-an-object is refused; absent is simply no vocabulary', () => {
  assert.equal(refusePackConfig({ categories: [] }, LOCAL).length, 1);
  assert.equal(refusePackConfig({ categories: 'rule' }, LOCAL).length, 1);
  assert.deepEqual(refusePackConfig({}, LOCAL), [], 'a pack of built-in categories declares nothing');
});

test("a value the resolver would refuse is refused HERE, in the pack's name", () => {
  // Not restated: the grammar for a prefix, a tier and a description belongs
  // to `core/config.ts`, and this module asks it rather than growing a second
  // copy that can drift. What this module adds is WHERE the refusal lands —
  // against the pack, before a corpus is half-built, rather than as a config
  // error the next time the workspace is opened.
  const cases: [unknown, RegExp][] = [
    [{ categories: { threat_model: { tier: 'normative', description: 'A threat.', prefix: 'a/b' } } }, /prefix/],
    [{ categories: { threat_model: { tier: 'lava', description: 'A threat.' } } }, /tier/],
    [{ categories: { threat_model: { tier: 'normative', description: 7 } } }, /description/],
    [{ categories: { rule: 'off' } }, /object/],
    [{ categories: { rule: { scopePolicy: 'sometimes' } } }, /scopePolicy/],
  ];
  for (const [raw, pattern] of cases) {
    const refusals = refusePackConfig(raw, LOCAL);
    assert.equal(refusals.length, 1, JSON.stringify(raw));
    assert.match(refusals[0] ?? '', pattern);
    assert.match(refusals[0] ?? '', /pack/, 'the pack is what is being refused');
  }
});

test('every refusal is one my_context: line, because a report prints them one per line', () => {
  const raw = {
    profile: 'minimal',
    budgets: {},
    watchedDocs: [],
    ui: {},
    categories: {
      rule: { tier: 'rationale', agentEdits: 'allow', description: 'x', enabled: false, extraFields: [] },
      threat_model: { prefix: 'a/b' },
    },
  };
  const refusals = refusePackConfig(raw, LOCAL);
  assert.ok(refusals.length >= 10, `only ${refusals.length} refusals`);
  for (const refusal of refusals) {
    assert.match(refusal, /^my_context: /);
    assert.equal(refusal.includes('\n'), false, refusal);
  }
  assert.equal(new Set(refusals).size, refusals.length, 'no rule reports the same input twice');
});

// --- the merge ------------------------------------------------------------

test('the merge touches categories only; budgets and watchedDocs come out untouched', () => {
  const existing = {
    profile: 'strict',
    categories: { rule: { scopePolicy: 'required' } },
    budgets: { pinned: 9000 },
    watchedDocs: ['docs/mine/**'],
  };
  const merged = mergePackConfig(existing, {
    categories: { standard: { enabled: true, prefix: 'STD', scopePolicy: 'global' } },
  });
  assert.deepEqual(merged.budgets, { pinned: 9000 });
  assert.deepEqual(merged.watchedDocs, ['docs/mine/**']);
  assert.equal(merged.profile, 'strict');
  assert.equal(merged.categories.rule.scopePolicy, 'required');
  assert.equal(merged.categories.standard.enabled, true);
});

test('the merge is field-wise inside one category, not entry replacement', () => {
  const merged = mergePackConfig(
    { categories: { rule: { scopePolicy: 'required' } } },
    { categories: { rule: { enabled: true, prefix: 'RULE' } } },
  );
  assert.deepEqual(merged.categories.rule, { scopePolicy: 'required', enabled: true, prefix: 'RULE' });
});

test("the merge keeps a top-level key this build does not know — R14.2 is the importer's half", () => {
  // A config written by a NEWER build carries keys this one skips. The merge
  // rewrites the file, so a merge that rebuilt the object from the keys it
  // understands would delete a setting the user's other build is still
  // reading — the silent drop R14.2 exists to stop, reached from the side
  // that writes rather than the side that reads.
  const merged = mergePackConfig(
    { categories: {}, telemetry: { enabled: false }, ui: { enabled: false } },
    { categories: { standard: { enabled: true } } },
  );
  assert.deepEqual(merged.telemetry, { enabled: false });
  assert.deepEqual(merged.ui, { enabled: false });
});

test('the merge keeps a key the importer set that a pack may not carry', () => {
  // `extraFields` and `agentEdits` are the importer's own settings here, not
  // the pack's. Field-wise means the pack adds fields to an entry; it never
  // replaces the entry, and an entry it does not mention is not touched.
  const merged = mergePackConfig(
    {
      categories: {
        rule: { extraFields: ['owner'], agentEdits: 'allow' },
        lesson: { enabled: false },
      },
    },
    { categories: { rule: { prefix: 'RULE' } } },
  );
  assert.deepEqual(merged.categories.rule, { extraFields: ['owner'], agentEdits: 'allow', prefix: 'RULE' });
  assert.deepEqual(merged.categories.lesson, { enabled: false });
});

test('the merge copies only the six permitted fields, whatever a pack put in the entry', () => {
  // The refusal above is what a user is told; this is what protects them if a
  // caller ever forgets to ask. A merge that copied the entry wholesale would
  // make every refusal in this file advisory. `agentEdits` is the trust
  // boundary itself and is dropped here even though the pack sent it.
  const merged = mergePackConfig({ categories: {} }, {
    categories: {
      threat_model: {
        enabled: true, tier: 'normative', description: 'A threat.', prefix: 'THREAT',
        scopePolicy: 'global', agentEdits: 'allow', extraFields: ['owner'], nonsense: 1,
      },
    },
  });
  assert.deepEqual(Object.keys(merged.categories.threat_model).toSorted(),
    ['description', 'enabled', 'extraFields', 'prefix', 'scopePolicy', 'tier']);
  assert.deepEqual(merged.categories.threat_model.extraFields, ['owner']);
});

test('the merge writes nothing for an entry the pack sent as something other than an object', () => {
  // Not a formality: writing an empty entry for it would leave `{"rule": {}}`
  // in the user's config — harmless on a name this build has, and a config
  // that will NOT load on a name it does not, because an empty entry declares
  // neither tier nor description. A refused pack should not be able to brick
  // the file it was refused from.
  const merged = mergePackConfig(
    { categories: {} },
    { categories: { rule: 'off', threat_model: ['normative'], note: null } },
  );
  assert.deepEqual(merged.categories, {});
  assert.doesNotThrow(() => resolveConfig(merged));
});

test('the merge never switches a category off, even if it is handed one that is', () => {
  const merged = mergePackConfig(
    { categories: { rule: { enabled: true } } },
    { categories: { rule: { enabled: false, prefix: 'RULE' } } },
  );
  assert.equal(merged.categories.rule.enabled, true);
});

test('the merge does not mutate what it was given', () => {
  const existing = { categories: { rule: { scopePolicy: 'required' } } };
  const pack = { categories: { rule: { prefix: 'RULE' } } };
  const merged = mergePackConfig(existing, pack);
  merged.categories.rule.scopePolicy = 'inert';
  assert.equal(existing.categories.rule.scopePolicy, 'required');
  assert.deepEqual(pack, { categories: { rule: { prefix: 'RULE' } } });
});

test('the merge refuses an existing config that is not an object, rather than replacing it', () => {
  // Absent is ordinary — `init --pack` merges into a workspace that has no
  // config yet. A config file holding a string or an array is corruption, and
  // starting from `{}` there would rewrite it as this build's defaults.
  assert.throws(
    () => mergePackConfig('categories', { categories: { standard: { enabled: true } } }),
    /my_context: the workspace config a pack would merge into is "categories", not an object/,
  );
  assert.doesNotThrow(() => mergePackConfig(null, { categories: { standard: { enabled: true } } }));
});

test('the merge creates the categories block when the existing config has none', () => {
  const merged = mergePackConfig({ profile: 'standard' }, { categories: { standard: { enabled: true } } });
  assert.equal(merged.categories.standard.enabled, true);
  assert.equal(merged.profile, 'standard');
});

test('a category named __proto__ becomes an own key of the merged config, not its prototype', () => {
  // `target[name] = value` walks the prototype chain for `__proto__` and sets
  // the prototype instead of adding a member: the category would vanish from
  // the file, and the object handed to `resolveConfig` would carry a stranger's
  // object as its prototype. Refused by `refusePackConfig` — and the merge is
  // safe on its own, because a guard whose only enforcement is a caller
  // remembering to ask is not a guard.
  const merged = mergePackConfig({ categories: {} }, {
    categories: { ['__proto__']: { enabled: true, tier: 'normative', description: 'A threat.' } },
  });
  assert.ok(Object.hasOwn(merged.categories, '__proto__'));
  assert.equal(Object.getPrototypeOf(merged.categories), Object.prototype);
  assert.ok(JSON.stringify(merged).includes('__proto__'));
});
