/**
 * What may be changed on an item, and by which command — the half of the
 * catalogue nothing rendered.
 *
 * `TIER_UPDATES` and `CategoryDef.updates` (src/core/categories.ts) declare it.
 * Until these renderings existed, nothing anywhere printed either: not the
 * category table, not the seven help topics, not `mycontext examples`. Five
 * rules were learned in one session by trying something and reading the
 * refusal — `state` on a chore being a TAG, `--tags` replacing the whole list,
 * `--severity hard` being refused on the rationale tier, `always` having two
 * spellings, `source_file` having no command at all — which is guidance
 * arriving after the attempt.
 *
 * Every assertion below is derived from the declarations rather than written
 * out here, for the same reason the rendering is: a note copied into a test is
 * a second copy free to drift from the first, and a test that agrees with a
 * stale copy is worse than no test.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  CATEGORIES, TIER_UPDATES, type CategoryUpdates,
} from '../../src/core/categories.ts';
import { resolveConfig } from '../../src/core/config.ts';
import { helpTopic, updatableSurface } from '../../src/help/index.ts';
import { runCli } from '../../src/cli/index.ts';
import type { Tier } from '../../src/core/types.ts';

const CONFIG = resolveConfig({});

/**
 * A category declared as a CONFIG DOCUMENT rather than imported: it exists
 * nowhere in `src/`, which is exactly what makes it the check that the data
 * path is the only path.
 *
 * It was the outer corpus's own `task`, copied from `.my_context/config.json`,
 * until `task` was adopted into the catalogue on 2026-09-02 — at which point it
 * stopped being config-only and the assertion below says so out loud. `chore`
 * is the same declaration under a name the catalogue does not hold.
 */
const CUSTOM = resolveConfig({
  categories: {
    chore: {
      tier: 'rationale',
      prefix: 'CHORE',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state'],
    },
    sla: { tier: 'normative', description: 'Latency target' },
  },
});

/**
 * Whitespace collapsed to single spaces.
 *
 * Both renderings WRAP — the topic wraps a note to the width its own
 * paragraphs are written to, and `table` wraps a cell to the column it fits
 * in — so a note is present in the output without being present as one
 * contiguous string. Comparing flattened text asserts the words are there
 * without freezing the line breaks, which are a layout decision and not a
 * claim about the catalogue.
 */
function flat(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/**
 * `render()` under a layout budget nothing reaches, so every table cell
 * arrives on one line and a wrapped cell cannot hide a `│` in the middle of a
 * sentence `flat` would otherwise have to see through. The budget is restored
 * afterwards — `test/helpers/pin-rendering.ts` deletes it for the whole suite
 * on purpose, and a test that leaked it would reshape every other file's
 * expected output.
 */
function wide<T>(render: () => T): T {
  const saved = process.env.MYCONTEXT_WIDTH;
  process.env.MYCONTEXT_WIDTH = '400';
  try {
    return render();
  } finally {
    if (saved === undefined) delete process.env.MYCONTEXT_WIDTH;
    else process.env.MYCONTEXT_WIDTH = saved;
  }
}

/** Everything a declaration says, as the strings a reader must be able to find. */
function claims(updates: CategoryUpdates): string[] {
  return Object.entries(updates).flatMap(([name, entry]) => [
    name,
    entry.store,
    ...(entry.values ?? []),
    entry.command ?? `--extra ${name}=<value>`,
    entry.note,
  ]);
}

test('help categories prints every tier rule: its name, its store, its values and its command', () => {
  const text = flat(helpTopic('categories', CONFIG));
  for (const [tier, updates] of Object.entries(TIER_UPDATES)) {
    assert.ok(
      text.includes(`\`${tier}\`-tier item`),
      `the categories topic never introduces the \`${tier}\` tier's own update rules. ` +
      `TIER_UPDATES declares them once per tier because 23 copies in the catalogue would ` +
      `be 23 things to keep in step — but a declaration nothing renders is one nobody reads.`,
    );
    for (const claim of claims(updates)) {
      assert.ok(
        text.includes(flat(claim)),
        `the \`${tier}\` tier declares ${JSON.stringify(claim)} and the categories topic ` +
        `never prints it`,
      );
    }
  }
});

/**
 * The difference between the tiers is the part a reader cannot guess, and the
 * part that cost an attempt: `--severity hard` on a chore is refused, and the
 * refusal — which is a good one — arrives only after the attempt.
 *
 * Asserted as a difference rather than against the literal `soft`: whatever
 * the two tiers declare, the topic must print BOTH declarations, so that
 * neither tier's answer can be read off the other's.
 */
test('the topic prints both tiers where they differ, never one as a variant of the other', () => {
  const text = flat(helpTopic('categories', CONFIG));
  const differing = Object.keys(TIER_UPDATES.normative).filter((name) => (
    JSON.stringify(TIER_UPDATES.normative[name]) !== JSON.stringify(TIER_UPDATES.rationale[name])
  ));
  assert.ok(differing.length > 0, 'the two tiers no longer differ anywhere — this test is ' +
    'asserting nothing, and the topic can no longer be checked for saying so');
  for (const name of differing) {
    for (const tier of ['normative', 'rationale'] as Tier[]) {
      assert.ok(
        text.includes(flat(TIER_UPDATES[tier][name].note)),
        `\`${name}\` differs between the tiers and the topic prints only one of the two ` +
        `notes — the missing one is the \`${tier}\` tier's`,
      );
    }
  }
});

test('help categories prints what each category adds of its own, and names the ones that add nothing', () => {
  const text = flat(helpTopic('categories', CONFIG));
  const silent: string[] = [];
  for (const category of Object.values(CONFIG.categories)) {
    if (!category.enabled) continue;
    if (Object.keys(category.updates).length === 0) { silent.push(category.name); continue; }
    for (const claim of claims(category.updates)) {
      assert.ok(text.includes(flat(claim)), `\`${category.name}\` declares ` +
        `${JSON.stringify(claim)} of its own and the categories topic never prints it`);
    }
  }
  // Named, not omitted: a reader cannot otherwise tell "declares nothing" from
  // "was not rendered", and that is the distinction this whole section is for.
  const closing = flat(helpTopic('categories', CONFIG).split('\n\n')
    .find((block) => /nothing of (its|their) own/.test(block)) ?? '');
  for (const name of silent) {
    assert.ok(closing.includes(`\`${name}\``),
      `\`${name}\` declares nothing of its own and is named nowhere: it is indistinguishable ` +
      `from a category the topic simply forgot`);
  }
});

test('a name with no command of its own renders the generic --extra spelling, with the name in it', () => {
  const text = helpTopic('categories', CONFIG);
  // `rule.directive` is the case: it is declared without a `command`, and
  // `UpdatableName.command` says an absent one means the extra-field spelling.
  assert.equal(CATEGORIES.rule.updates.directive.command, undefined,
    'rule.directive now declares a command of its own — this test is checking the wrong name');
  assert.ok(text.includes('mycontext edit <id> --extra directive=<value>'),
    'a declaration with no command renders no command at all, so `directive` reads as a field ' +
    'nothing can change — which is what `source_file` actually is and `directive` is not');
});

test('mycontext examples prints the surface beside the specimen, tier rules first', () => {
  const surface = flat(wide(() => updatableSurface('rule', CONFIG)));
  for (const claim of [...claims(TIER_UPDATES.normative), ...claims(CATEGORIES.rule.updates)]) {
    assert.ok(surface.includes(flat(claim)),
      `\`mycontext examples rule\` never prints ${JSON.stringify(claim)}`);
  }
  // The rationale tier's answers must NOT appear on a normative category: the
  // whole value of printing the tier is that it is THIS item's tier.
  assert.ok(!surface.includes(flat(TIER_UPDATES.rationale.severity.note)),
    'the normative surface carries the rationale tier\'s severity note — the tables are not ' +
    'selected by the category\'s tier at all');
});

/**
 * The check that the data path is the only path.
 *
 * `chore` and `sla` exist nowhere in `src/`; they are two objects in a config
 * document. A shipped category on the same tier that also declares nothing of
 * its own must therefore produce the SAME rendering, name for name — any
 * difference is a branch for built-ins, which is the thing this requirement
 * exists to rule out.
 */
test('a category defined only in config.json renders exactly like a shipped one', () => {
  const pairs: [string, string][] = [['chore', 'todo'], ['sla', 'constraint']];
  for (const [custom, shipped] of pairs) {
    assert.ok(!Object.hasOwn(CATEGORIES, custom),
      `\`${custom}\` is in the catalogue now — it can no longer stand for a config-only category`);
    assert.equal(CUSTOM.categories[custom].tier, CUSTOM.categories[shipped].tier, custom);
    assert.deepEqual(
      Object.keys(CUSTOM.categories[custom].updates),
      Object.keys(CUSTOM.categories[shipped].updates),
      `${custom} and ${shipped} declare different names of their own, so this pair cannot ` +
      `show that the rendering treats them alike`,
    );
    const rendered = wide(() => updatableSurface(custom, CUSTOM));
    // Equal AND non-empty: two renderings that both print nothing are equal,
    // and would let this test pass on a build where nothing renders at all.
    for (const claim of claims(TIER_UPDATES[CUSTOM.categories[custom].tier])) {
      assert.ok(flat(rendered).includes(flat(claim)),
        `\`mycontext examples ${custom}\` never prints ${JSON.stringify(claim)}, so the ` +
        `comparison below would be between two things that say nothing`);
    }
    assert.equal(
      rendered.replaceAll(`\`${custom}\``, '<type>'),
      wide(() => updatableSurface(shipped, CUSTOM)).replaceAll(`\`${shipped}\``, '<type>'),
      `\`mycontext examples ${custom}\` renders differently from \`mycontext examples ` +
      `${shipped}\`. They differ only in their name, so the rendering has a branch that ` +
      `knows which of them the catalogue shipped.`,
    );
  }
  // And in the topic, in the update section itself rather than only in the
  // category table above it: named on exactly the terms a shipped category is.
  const closing = flat(helpTopic('categories', CUSTOM).split('\n\n')
    .find((block) => /nothing of (its|their) own/.test(block)) ?? '');
  for (const name of ['chore', 'sla']) {
    assert.ok(closing.includes(`\`${name}\``),
      `the categories topic's update section never names \`${name}\` — it is rendered from ` +
      `the catalogue rather than from the resolved config, so a project's own categories ` +
      `are missing from the one section that says what may be changed on their items`);
  }
});

/**
 * A reader of a `chore`'s help must learn the rationale tier's rules from the
 * command, not from `src/core/categories.ts`. `chore` is the case that made the
 * point: it is defined only in a config document, it is on the rationale tier,
 * and `--severity hard` on one is refused.
 */
test('a chore teaches its tier\'s refusals without anyone reading the source', () => {
  const surface = flat(wide(() => updatableSurface('chore', CUSTOM)));
  for (const [name, entry] of Object.entries(TIER_UPDATES.rationale)) {
    assert.ok(surface.includes(flat(entry.note)), `\`mycontext examples chore\` never says what ` +
      `\`${name}\` means on the tier the chore is actually on`);
    for (const value of entry.values ?? []) {
      assert.ok(surface.includes(value),
        `\`${name}\` on a chore admits ${JSON.stringify(value)} and the surface does not say so`);
    }
  }
});

test('the bordered surface honours the ASCII/Unicode switch the rest of the CLI reads', () => {
  const saved = { ascii: process.env.MYCONTEXT_ASCII, unicode: process.env.MYCONTEXT_UNICODE };
  try {
    delete process.env.MYCONTEXT_ASCII;
    process.env.MYCONTEXT_UNICODE = '1';
    assert.match(updatableSurface('rule', CONFIG), /┌/,
      'the surface draws its own borders instead of going through `table` (format.ts), so ' +
      'MYCONTEXT_UNICODE moves every other report and not this one');
    delete process.env.MYCONTEXT_UNICODE;
    process.env.MYCONTEXT_ASCII = '1';
    const ascii = updatableSurface('rule', CONFIG);
    assert.doesNotMatch(ascii, /[┌│└]/, 'MYCONTEXT_ASCII=1 still renders box-drawing characters');
    assert.match(ascii, /\+-/, 'the ASCII fallback drew no table at all');
  } finally {
    if (saved.ascii === undefined) delete process.env.MYCONTEXT_ASCII;
    else process.env.MYCONTEXT_ASCII = saved.ascii;
    if (saved.unicode === undefined) delete process.env.MYCONTEXT_UNICODE;
    else process.env.MYCONTEXT_UNICODE = saved.unicode;
  }
});

/** The wiring, through the command a person actually types. */
test('`mycontext examples <type>` prints the specimen and then the surface; --short prints neither', () => {
  // A directory of its own, with no workspace above it: `resolveWorkspace`
  // walks upwards, and this repository is itself inside a corpus whose
  // config.json declares categories of its own.
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-examples-'));
  try {
    const run = (args: string[]): string => wide(() => {
      let text = '';
      assert.equal(runCli(args, cwd, (s) => { text += `${s}\n`; }), 0, args.join(' '));
      return text;
    });
    const full = run(['examples', 'rule']);
    assert.ok(full.indexOf('id: RULE-') < full.indexOf('What may be changed'),
      'the surface is printed before the specimen — the example is what the command is for');
    assert.ok(flat(full).includes(flat(TIER_UPDATES.normative.tags.note)),
      '`mycontext examples rule` does not say what `--tags` does to the list it replaces');

    // `--short` is four to six lines per category and both READMEs print one
    // per category; the surface belongs to the full form only.
    const short = run(['examples', 'rule', '--short']);
    assert.ok(!short.includes('What may be changed'),
      'the --short form now carries the whole update surface, which is not the distinctive ' +
      'fields of an item and is 24 copies of it across the documentation');
  } finally {
    removeTree(cwd);
  }
});
