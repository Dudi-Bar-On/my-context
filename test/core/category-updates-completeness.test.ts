/**
 * The seventh field, and the gate its six siblings already had.
 *
 * `test/core/catalogue-completeness.test.ts` holds the enumeration sites that
 * nothing else pins, so a half-added category cannot ship documented nowhere.
 * `CategoryDef` grew a seventh field at plan:categories seq 13 — `updates`, what
 * may be changed on an item of this category and how — and seq 14 made it
 * authorable in `.my_context/config.json`. This file is the completeness
 * assertion for that field.
 *
 * **The config-defined half is the half that matters.** A test over the shipped
 * catalogue alone would pass forever while a person's own category declared
 * nothing, which is the sentence
 * REQ-every-category-declares-what-may-be-updated-on-its-items-and opens with:
 * "a category that cannot describe its own updates teaches nobody anything".
 * So every assertion here runs over a RESOLVED CONFIG and the list of
 * categories is derived from it — never from `CATEGORIES`, never from the
 * enabled set, and never hand-copied. A shipped category, a category a person
 * defined, and a shipped one a person extended are judged by one function.
 *
 * ## What is asserted, and what each rule is worth
 *
 * 1. **Every category carries a declaration.** `{}` IS a declaration — it says
 *    "this category adds nothing of its own beyond its tier's rules", which is
 *    true of the shipped categories that declare no fields of their own. What
 *    it must never be is absent.
 * 2. **A category with fields of its own has something to say, and must say
 *    it.** `{}` on a category declaring `directive` is not "nothing of its own";
 *    it is silence about the one field the category MEANS. This is the same
 *    argument `requireUpdates` (src/core/config.ts) makes for extending rather
 *    than replacing: `extraFields` and `updates` are two halves of one
 *    description, and a category that declares a field and no rule for it is
 *    the half that teaches, missing.
 * 3. **Every name a declaration mentions is real.** A `field` name must be one
 *    of the category's own `extraFields` or a field every item carries; a `tag`
 *    name must be writable as `name:value`; a `projectsTo` must be a tag prefix.
 *    A declaration naming a field that does not exist is worse than none — it
 *    is rendered to a person by `mycontext help categories` and `mycontext
 *    examples`, nothing else in the build reads it, and so no other gate can
 *    catch it. It teaches a reader something false for as long as it stands.
 *
 * Deliberately NOT asserted: that any declaration is non-empty, and that no two
 * names project to one tag prefix. The first is rule 1 stated backwards and
 * would be false of most of the catalogue; the second is already held over the
 * catalogue by `test/core/tag-projection.test.ts`, and over a config by
 * `requireUpdatableName`.
 *
 * ## What this test cannot do, stated so a green run is not read as more
 *
 * It checks that a declared name EXISTS, not that the sentence beside it is
 * true or useful — the same disclaimer `catalogue-completeness.test.ts` and
 * `test/docs/inventory.test.ts` carry. And the set of real item fields is every
 * key a parsed `Item` and a rendered file carry, which includes structural ones
 * (`extra`, `filePath`, `layer`) that no category should ever declare an update
 * for: a declaration naming one of those passes here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CATEGORIES, type CategoryUpdates, type UpdatableName, type UpdateStore,
} from '../../src/core/categories.ts';
import { resolveConfig, type Config, type ResolvedCategory } from '../../src/core/config.ts';
import { updatesFor } from '../../src/core/tag-projection.ts';
import { parseItem, renderItem } from '../../src/core/item.ts';
import { parseFrontmatter } from '../../src/core/frontmatter.ts';
import { closestMatch } from '../../src/core/teach.ts';

/**
 * One item, pushed through the real parser and the real writer, so the set of
 * names an item actually carries is MEASURED rather than listed.
 *
 * A hand-typed copy of `Item`'s fields is exactly the defect this file's
 * sibling exists to catch one layer up: it is right on the day it is written
 * and silently wrong the day a field is renamed. Both spellings are collected,
 * because both are what a person types — the parsed object says `validUntil`
 * and the frontmatter `renderItem` writes says `valid_until`, and a declaration
 * naming either means the same real field.
 */
const SPECIMEN = `---
id: RULE-specimen
type: rule
title: A specimen item, read for its field names and nothing else
status: active
severity: soft
always: false
scope: []
tags: [specimen]
origin: human
source_file: null
source_anchor: null
source_checksum: null
valid_from: 2026-08-23
valid_until: null
checksum: 0000000000000000
---

# A specimen item, read for its field names and nothing else

Body prose, so \`body\` is a name this set contains.

## Observations
- [note] Something observed #specimen

## Relations
- derived_from [[ADR-specimen]]
`;

function frontmatterKeys(file: string): string[] {
  const block = /^---\n([\s\S]*?)\n---\n/.exec(file);
  assert.ok(block, 'renderItem no longer writes a leading --- frontmatter block; ' +
    'if the file format changed, update this reader — do not delete it, or every name ' +
    'below is judged against half the fields an item has.');
  return Object.keys(parseFrontmatter(block[1]!));
}

const SPECIMEN_ITEM = parseItem(SPECIMEN, 'items/rule/RULE-specimen.md', 'project');
const ITEM_FIELDS: ReadonlySet<string> = new Set([
  ...Object.keys(SPECIMEN_ITEM),
  ...frontmatterKeys(renderItem(SPECIMEN_ITEM)),
]);

/**
 * What a tag prefix may contain, and the SAME grammar `requireUpdatableName`
 * (src/core/config.ts) holds a config's `projectsTo` to. The catalogue never
 * passes through that loader, so the catalogue is held to it here.
 */
const TAG_PREFIX = /^[A-Za-z0-9_-]+$/;

const SHIPPED = Object.values(CATEGORIES);
/**
 * Both counts are DERIVED, and they are two different counts on purpose.
 *
 * A failure message that says "nineteen of the twenty-four" is a hand-typed
 * fact inside a sentence nobody re-reads, and it goes stale the day the
 * twenty-fifth category lands — the exact rot this file's sibling exists to
 * catch. Worse, either count computed the other way would be stated FALSELY by
 * the failure it accompanies: at the moment a category loses its declaration
 * the empty-declaration count includes it, and it is not a category that
 * declares no fields.
 */
const EMPTY_SHIPPED = SHIPPED.filter((c) => Object.keys(c.updates).length === 0).length;
const FIELDLESS_SHIPPED = SHIPPED.filter((c) => c.extraFields.length === 0).length;

/** Where a category's own declaration is written, by which half of the product
 * defines the category. `Object.hasOwn`, never a bare index: a category may be
 * named `constructor`, and a plain lookup answers that with `Object` itself. */
function whereCategory(category: string): string {
  return Object.hasOwn(CATEGORIES, category)
    ? `in the def(...) call for "${category}" in src/core/categories.ts`
    : `under categories.${category}.updates in .my_context/config.json`;
}

/** Where ONE name is declared: a tier's shared table, the catalogue, or a
 * config that defined the category or extended a shipped one by that name. */
function whereName(category: string, updatable: string, own: boolean): string {
  if (!own) {
    return 'in TIER_UPDATES (src/core/categories.ts), the table every category on that ' +
      'tier shares';
  }
  if (Object.hasOwn(CATEGORIES, category) && Object.hasOwn(CATEGORIES[category].updates, updatable)) {
    return `in the def(...) call for "${category}" in src/core/categories.ts`;
  }
  return `under categories.${category}.updates in .my_context/config.json`;
}

/** One declaration the audit READ, recorded whether it complained or not — the
 * evidence that the measurement can see every kind of member. */
interface Declaration {
  category: string;
  name: string;
  store: UpdateStore;
  projectsTo: string | undefined;
  /** The category's OWN, as against inherited from `TIER_UPDATES`. */
  own: boolean;
  /** Defined in `.my_context/config.json` rather than shipped in the catalogue. */
  fromConfig: boolean;
  enabled: boolean;
}

interface Audit {
  /** Every category looked at, sorted — derived from the config, so a config
   * one is in it and a disabled one is not skipped. */
  categories: string[];
  declarations: Declaration[];
  complaints: string[];
}

function isDeclaration(value: unknown): value is CategoryUpdates {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The whole gate, as one function over a resolved config, so that a shipped
 * category and a person's own are judged by identical rules and neither can be
 * exempted by where it was written.
 */
function auditUpdates(config: Config): Audit {
  const audit: Audit = { categories: [], declarations: [], complaints: [] };
  for (const name of Object.keys(config.categories).sort()) {
    const category = config.categories[name];
    audit.categories.push(name);
    // Read through `unknown`, deliberately. The TYPE says every
    // `ResolvedCategory` has an `updates`, and a test that trusts the type here
    // asserts the compiler's opinion rather than the object's: `resolveConfig`
    // builds this map from user JSON on one of its two branches, and `npm test`
    // does not run `tsc`.
    const own: unknown = (category as { updates?: unknown }).updates;
    if (!isDeclaration(own)) {
      audit.complaints.push(missingDeclaration(name, own));
      continue;
    }
    for (const field of category.extraFields) {
      if (Object.hasOwn(own, field)) continue;
      audit.complaints.push(unexplainedField(category, field));
    }
    // The merged surface — the tier's rules overlaid with the category's own —
    // because that is the surface a person is shown and the one a wrong name
    // teaches from. `updatesFor` is the product's own merge, not a second copy
    // of it.
    for (const [updatable, decl] of Object.entries(updatesFor(config, name))) {
      const isOwn = Object.hasOwn(own, updatable);
      audit.declarations.push({
        category: name,
        name: updatable,
        store: decl.store,
        projectsTo: decl.projectsTo,
        own: isOwn,
        fromConfig: !Object.hasOwn(CATEGORIES, name),
        enabled: category.enabled,
      });
      if (!namesSomethingReal(category, updatable, decl)) {
        audit.complaints.push(unrealName(category, updatable, decl, isOwn));
      }
      if (decl.projectsTo !== undefined && !TAG_PREFIX.test(decl.projectsTo)) {
        audit.complaints.push(unusablePrefix(name, updatable, decl.projectsTo, isOwn));
      }
    }
  }
  return audit;
}

function namesSomethingReal(
  category: ResolvedCategory, updatable: string, decl: UpdatableName,
): boolean {
  if (decl.store === 'field') {
    return category.extraFields.includes(updatable) || ITEM_FIELDS.has(updatable);
  }
  // A `tag` names a MEMBERSHIP rather than a field, so there is no field to
  // check it against: what is checked is that it can be written as one. `tags`
  // itself is the tier's entry and is a real item field, which is why the
  // membership test is an alternative and not a replacement.
  return ITEM_FIELDS.has(updatable) || TAG_PREFIX.test(updatable);
}

function missingDeclaration(category: string, found: unknown): string {
  return (
    `category "${category}" carries no updates declaration: it is ${JSON.stringify(found)}. ` +
    `Every category has one, and {} is a real declaration rather than a gap — it says "this ` +
    `category adds nothing of its own", beyond the rules its tier already declares in ` +
    `TIER_UPDATES (src/core/categories.ts), which is true of ${EMPTY_SHIPPED} of the ` +
    `${SHIPPED.length} shipped categories. What it must never be is ABSENT: a category that ` +
    `cannot describe its own updates teaches nobody anything. Write it ${whereCategory(category)} ` +
    `— {} if the category adds nothing of its own, and an entry per name if it does.`
  );
}

function unexplainedField(category: ResolvedCategory, field: string): string {
  const fields = category.extraFields.join(', ');
  return (
    `category "${category.name}" declares the field "${field}" and says nothing about how it ` +
    `is changed. {} is a real declaration — it says "this category adds nothing of its own", ` +
    `true of the ${FIELDLESS_SHIPPED} shipped categories that declare no fields — but a category ` +
    `with fields of its own (${category.name} declares: ${fields}) has something to say, and ` +
    `this one does not say it. Add an entry for "${field}" ${whereCategory(category.name)}: ` +
    `{"${field}": {"store": "field", "note": "<the one line a person reads>"}}. Only "store" ` +
    `is required; an absent "values" means free text, which is a real answer and not a gap, ` +
    `and a "values" list is what makes a typo in it impossible rather than merely unlikely. ` +
    `Nothing else in this build reads the declaration, so no other gate will tell you it is ` +
    `missing — it is missing from what a person is shown by \`mycontext help categories\` and ` +
    `\`mycontext examples\`, and that is the whole of the cost.`
  );
}

function unrealName(
  category: ResolvedCategory, updatable: string, decl: UpdatableName, own: boolean,
): string {
  const where = whereName(category.name, updatable, own);
  if (decl.store === 'tag') {
    return (
      `category "${category.name}" declares the tag "${updatable}", which cannot be written ` +
      `as one. A "tag" declaration names a MEMBERSHIP, recorded as "${updatable}:<value>", so ` +
      `the name must be letters, digits, "_" or "-" and nothing else — a colon or a space in ` +
      `it makes a tag nobody can filter on. It is the same grammar projectsTo is held to. ` +
      `Declared ${where}.`
    );
  }
  const fields = category.extraFields.length === 0
    ? `${category.name} declares none`
    : `${category.name} declares: ${category.extraFields.join(', ')}`;
  const near = closestMatch(updatable, [...category.extraFields, ...ITEM_FIELDS]);
  return (
    `category "${category.name}" declares an update for the field "${updatable}", which is ` +
    `not a name an item of that category carries. A "field" declaration must name one of the ` +
    `category's own extra fields (${fields}) or one of the ${ITEM_FIELDS.size} names every ` +
    `item carries.` + (near === null ? '' : ` The closest match is "${near}".`) +
    ` A declaration naming a field that does not exist is worse than none: it is rendered to ` +
    `a person by \`mycontext help categories\` and \`mycontext examples\`, nothing else in ` +
    `this build reads it, and so no other gate can catch it — it teaches a reader something ` +
    `false for as long as it stands. Fix the spelling, or add "${updatable}" to ` +
    `${category.name}'s extraFields if the FIELD is what is missing. Declared ${where}.`
  );
}

function unusablePrefix(
  category: string, updatable: string, projectsTo: string, own: boolean,
): string {
  return (
    `category "${category}" declares updates.${updatable}.projectsTo ` +
    `${JSON.stringify(projectsTo)}, which is not a tag prefix. The generated tag is ` +
    `"${projectsTo}:<value>", so a colon or a space in the prefix makes a tag nobody can ` +
    `filter on — letters, digits, "_" and "-" only. A config is held to exactly this grammar ` +
    `by requireUpdatableName (src/core/config.ts); a declaration ${whereName(category, updatable, own)} ` +
    `never passes through that loader, which is why it is held to it here.`
  );
}

/** The audit's own verdict, rendered so a failure prints the sentence rather
 * than a count. */
function verdict(audit: Audit): string {
  return audit.complaints.length === 0 ? '' : `\n\n${audit.complaints.join('\n\n')}\n`;
}

/**
 * The complaints about ONE category. Every audit below walks the whole resolved
 * config — that is the point of the gate — so a control that plants a defect in
 * `ticket` and counts every complaint in the config would also count a real
 * catalogue defect and report the wrong thing about itself. The two tests above
 * are where a catalogue defect is reported; these ask only whether the rule
 * they control for fires on the category they broke.
 */
function complaintsFor(audit: Audit, category: string): string[] {
  return audit.complaints.filter((c) => c.startsWith(`category "${category}" `));
}

/**
 * Every kind of category a resolved config can hold, in one config, so the
 * audit is measured against all of them at once rather than against the shipped
 * catalogue and a hope.
 *
 * `profile: "minimal"` is not decoration: it leaves most of the catalogue
 * switched OFF, and an audit that walked the enabled set would then judge eight
 * categories and report itself green. The prior art is stated in
 * `test/core/tag-projection.test.ts` — a measurement that could not see every
 * kind of member is the defect this project keeps finding.
 */
const EVERY_KIND = {
  profile: 'minimal',
  categories: {
    /** A person's own category that declares fields AND explains them — the
     * shape the owner approved for `task` on 2026-08-23. */
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'state'],
      updates: {
        state: {
          store: 'field',
          values: ['todo', 'doing', 'blocked', 'done'],
          projectsTo: 'state',
          note: 'Where this task is.',
        },
        plan: { store: 'tag', note: 'Which plan it belongs to.' },
      },
    },
    /** A person's own category that adds nothing of its own: no `updates` key
     * at all, resolving to `{}`, which is legal and must stay legal. */
    chore: {
      tier: 'rationale',
      description: 'Something small and repeatable, with nothing of its own to change.',
    },
    /** A person's own category whose NAME is this codebase's oldest bug. A
     * bare `CATEGORIES[name]` answers "constructor" with `Object` itself, and
     * an audit that used one would judge this entry against the wrong object
     * and stay green. */
    constructor: {
      tier: 'normative',
      description: 'Named for the prototype trap, because the audit must survive it.',
    },
    /** A SHIPPED category extended by config: a field and a rule for it that
     * the catalogue never had. The extend branch is the one a mutant hides in. */
    rule: {
      extraFields: ['owner'],
      updates: { owner: { store: 'field', note: 'Who owns this rule.' } },
    },
    /** A shipped category switched OFF. It is still a category and its
     * declaration is still rendered by `mycontext help categories` when it is
     * switched back on. */
    lesson: { enabled: false },
  },
};

test('every shipped category carries an updates declaration, and every name in it is real', () => {
  const audit = auditUpdates(resolveConfig({}));
  assert.deepEqual(audit.complaints, [], verdict(audit));
  // Derived from the config that was audited, so a category added to the
  // catalogue is judged without this file being touched.
  assert.deepEqual(audit.categories, Object.keys(CATEGORIES).sort());
});

test('every category a config defines carries one too, judged by the same rules', () => {
  const audit = auditUpdates(resolveConfig(EVERY_KIND));
  assert.deepEqual(audit.complaints, [], verdict(audit));
  assert.deepEqual(
    audit.categories,
    [...new Set([...Object.keys(CATEGORIES), ...Object.keys(EVERY_KIND.categories)])].sort(),
    'the audit walked a different set of categories than the config resolved',
  );
});

/**
 * **The measurement can see every kind of member.**
 *
 * A gate is worth what it can see. Two in this project were green for weeks
 * because they could not see part of their input — one read `el.className` and
 * so ignored every SVG element, one enumerated a list it had hand-copied — so
 * the kinds are enumerated here and each is asserted to have been READ, from
 * the audit's own record of what it looked at rather than from the fixture.
 */
test('the audit reads every kind of category and every kind of declaration', () => {
  const audit = auditUpdates(resolveConfig(EVERY_KIND));
  const config = resolveConfig(EVERY_KIND);

  const seen = new Set(audit.categories);
  for (const name of Object.keys(config.categories)) {
    assert.ok(seen.has(name), `the audit never looked at category "${name}"`);
  }
  assert.equal(seen.size, Object.keys(config.categories).length);

  // A category switched off is a category. So is one whose name is the
  // prototype trap, and one that exists only in config.json.
  assert.ok(seen.has('lesson') && config.categories.lesson.enabled === false,
    'the fixture must switch a shipped category off, or this proves nothing');
  assert.ok(seen.has('constructor'), 'a category named "constructor" was not read');
  assert.ok(seen.has('chore'), 'a config-only category with no updates key was not read');

  // A category that declares nothing of its own is READ and not skipped: `{}`
  // is a declaration, and a walk that iterated declarations rather than
  // categories would never visit one.
  const declaredNothing = Object.values(config.categories)
    .filter((c) => Object.keys(c.updates).length === 0).map((c) => c.name);
  assert.ok(declaredNothing.length > 0, 'the fixture must contain a category declaring {}');
  for (const name of declaredNothing) assert.ok(seen.has(name), `"${name}" declares {} and was skipped`);

  const kinds = audit.declarations;
  const has = (label: string, match: (d: Declaration) => boolean): void => {
    assert.ok(kinds.some(match), `the audit read no ${label}, so it cannot have checked one`);
  };
  has('field-stored name', (d) => d.store === 'field');
  has('tag-stored name', (d) => d.store === 'tag');
  has('name that projects a tag', (d) => d.projectsTo !== undefined);
  has('name inherited from TIER_UPDATES', (d) => !d.own);
  has('name the category declares itself', (d) => d.own);
  has('declaration on a config-defined category', (d) => d.fromConfig);
  has('declaration on a disabled category', (d) => !d.enabled);
  has('declaration a config added to a shipped category',
    (d) => !d.fromConfig && d.own && !Object.hasOwn(CATEGORIES[d.category].updates, d.name));
  has('declaration the catalogue itself ships',
    (d) => !d.fromConfig && d.own && Object.hasOwn(CATEGORIES[d.category].updates, d.name));
});

/**
 * **The positive control for the half that matters.** A person defines a
 * category, gives it the fields their work actually uses, and says nothing
 * about changing any of them — which is the exact case the requirement opens
 * with, and the case a catalogue-only test would never reach.
 */
test('a config-defined category that declares fields and explains none is caught', () => {
  const audit = auditUpdates(resolveConfig({
    categories: {
      ticket: {
        tier: 'rationale',
        description: 'A unit of work from the tracker.',
        extraFields: ['assignee', 'state'],
      },
    },
  }));
  const complaints = complaintsFor(audit, 'ticket');
  assert.equal(complaints.length, 2, verdict(audit));
  for (const [field, complaint] of [['assignee', complaints[0]], ['state', complaints[1]]]) {
    assert.match(complaint!, new RegExp(`declares the field "${field}"`));
    // The message has to say WHERE, and for a category a person defined that
    // is their config file and not this product's source.
    assert.match(complaint!, /under categories\.ticket\.updates in \.my_context\/config\.json/);
    assert.match(complaint!, /"store": "field"/);
    assert.match(complaint!, /\{\} is a real declaration/);
  }
});

/** A category that declares NO fields of its own is not asked for one. `{}` is
 * the right answer there and this gate must never turn it into a chore. */
test('a config-defined category with no fields of its own is asked for nothing', () => {
  const audit = auditUpdates(resolveConfig({
    categories: { ticket: { tier: 'rationale', description: 'A unit of work from the tracker.' } },
  }));
  assert.deepEqual(complaintsFor(audit, 'ticket'), [], verdict(audit));
});

/**
 * **The positive control for a name that is not real**, on both halves at once:
 * a shipped category whose config override misspells its own field, and a
 * config-defined category that invents one.
 */
test('a declaration naming a field that does not exist is caught, and told the closest match', () => {
  const audit = auditUpdates(resolveConfig({
    categories: {
      rule: { updates: { directve: { store: 'field', note: 'Do or dont.' } } },
      ticket: {
        tier: 'rationale',
        description: 'A unit of work from the tracker.',
        updates: { assignee: { store: 'field', note: 'Who has it.' } },
      },
    },
  }));
  // Found rather than counted on the shipped half: this control owns `ticket`
  // outright, but it only BORROWS `rule`, and a catalogue defect in `rule`
  // belongs to the two tests above rather than reported a second time here.
  const misspelled = complaintsFor(audit, 'rule').find((c) => c.includes('"directve"'));
  assert.ok(misspelled, verdict(audit));
  const [invented] = complaintsFor(audit, 'ticket');
  assert.equal(complaintsFor(audit, 'ticket').length, 1, verdict(audit));
  assert.match(misspelled, /declares an update for the field "directve"/);
  assert.match(misspelled, /The closest match is "directive"/);
  assert.match(misspelled, /worse than none/);
  assert.match(misspelled, /add "directve" to rule's extraFields if the FIELD is what is missing/);
  assert.match(misspelled, /under categories\.rule\.updates in \.my_context\/config\.json/);

  assert.match(invented!, /declares an update for the field "assignee"/);
  assert.match(invented!, /ticket declares none/);
});

/** The tag half of the same rule: a `tag` names a membership written
 * `name:value`, so a name that cannot be written that way is a rule nobody can
 * follow. */
test('a tag-stored name that cannot be written as a tag is caught', () => {
  const audit = auditUpdates(resolveConfig({
    categories: {
      ticket: {
        tier: 'rationale',
        description: 'A unit of work from the tracker.',
        updates: { 'not a tag': { store: 'tag', note: 'Which sprint.' } },
      },
    },
  }));
  const complaints = complaintsFor(audit, 'ticket');
  assert.equal(complaints.length, 1, verdict(audit));
  assert.match(complaints[0]!, /declares the tag "not a tag", which cannot be written as one/);
  assert.match(complaints[0]!, /"not a tag:<value>"/);
});

/**
 * `projectsTo` is refused by the loader on a config, so the case this reaches
 * is the one nothing else can: a declaration installed directly, which is what
 * the catalogue is.
 */
test('a projectsTo that is not a tag prefix is caught wherever the declaration came from', () => {
  const config = resolveConfig({
    categories: {
      ticket: { tier: 'rationale', description: 'A unit of work from the tracker.', extraFields: ['state'] },
    },
  });
  config.categories.ticket.updates = {
    state: { store: 'field', projectsTo: 'ticket:state', note: 'Where it is.' },
  };
  const audit = auditUpdates(config);
  const complaints = complaintsFor(audit, 'ticket');
  assert.equal(complaints.length, 1, verdict(audit));
  assert.match(complaints[0]!, /projectsTo "ticket:state", which is not a tag prefix/);
  assert.match(complaints[0]!, /"ticket:state:<value>"/);
});

/**
 * The declaration ABSENT, which the type says cannot happen and `npm test` does
 * not run `tsc` to find out. `resolveConfig` builds half its categories from
 * user JSON, `def()` supplies `{}` by default on the other half, and both of
 * those are code that can change; the assertion is here so the message a
 * forgetful author reads exists and is the one they need.
 */
test('a category whose updates is absent altogether is caught, and told what {} means', () => {
  const config = resolveConfig({});
  delete (config.categories.rule as { updates?: unknown }).updates;
  const audit = auditUpdates(config);
  const complaints = complaintsFor(audit, 'rule');
  assert.equal(complaints.length, 1, verdict(audit));
  const complaint = complaints[0]!;
  assert.match(complaint, /category "rule" carries no updates declaration/);
  assert.match(complaint, /\{\} is a real declaration rather than a gap/);
  assert.match(complaint, /What it must never be is ABSENT/);
  assert.match(complaint, /in the def\(\.\.\.\) call for "rule" in src\/core\/categories\.ts/);
});

/**
 * The names an item really has are MEASURED, and this is the assertion that
 * says so. If `frontmatterKeys` ever stops finding a block, or `parseItem`
 * stops returning the fields it returns, every name check above silently
 * loosens — a set of two names would pass almost nothing and a set of
 * everything would pass anything.
 */
test('the set of real item fields is derived from a real item, in both spellings', () => {
  // The tier's own names, which every category inherits, are the floor: if
  // these are not in the set the measurement is not measuring an item.
  for (const name of ['title', 'body', 'status', 'severity', 'always', 'scope', 'tags']) {
    assert.ok(ITEM_FIELDS.has(name), `"${name}" is declared by TIER_UPDATES and is not a known item field`);
  }
  // Both spellings of the same field, which is the reason the set is a union.
  assert.ok(ITEM_FIELDS.has('validUntil'), 'the parsed spelling is missing');
  assert.ok(ITEM_FIELDS.has('valid_until'), 'the frontmatter spelling is missing');
  // And it is a set of names, not of everything: the check is only worth
  // something while something fails it.
  assert.equal(ITEM_FIELDS.has('directive'), false, 'an extra field is not a field every item has');
  assert.equal(ITEM_FIELDS.has('donee'), false);
});
