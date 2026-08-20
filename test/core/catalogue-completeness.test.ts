/**
 * The category-enumeration sites that no other test pins.
 *
 * Adding a category touches 22 hand-typed places. Eighteen of them are held by
 * set-equality assertions elsewhere in this suite (HE_CATEGORY_DESCRIPTIONS,
 * both topic sources, SKILL.md's tier bullets, SEEDS, the generated command
 * files, the counts derived from Object.keys(CATEGORIES).length). These four
 * are held by nothing, so a half-added category ships documented nowhere and
 * the suite stays green:
 *
 *   - docs/TUTORIAL.md's two tier bullets
 *   - docs/TUTORIAL-ADVANCED.md's two appendix lists
 *   - README.md's per-category specimen markers
 *   - docs/README.he.md's per-category specimen markers
 *
 * What this test cannot do, stated so a green suite is not mistaken for
 * reviewed prose: it checks that every category is NAMED on the correct side
 * and that the counts beside those names are right. It cannot check that the
 * sentence around the name says anything true or useful. The same disclaimer
 * test/docs/inventory.test.ts carries, for the same reason.
 *
 * Deliberately NOT re-asserted here: that each category has an add-/list-
 * command file. test/plugin/commands.test.ts already holds the committed
 * files byte-identical to generateCommands(config)'s output, which is derived
 * from the resolved config, so the names are covered at their source.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/core/categories.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const read = (...p: string[]): string => readFileSync(path.join(REPO, ...p), 'utf8');

const NAMES = Object.keys(CATEGORIES).sort();
const BY_TIER = (tier: string): string[] =>
  Object.values(CATEGORIES).filter((c) => c.tier === tier).map((c) => c.name).sort();

/** Every `name` inside a backtick pair, in order. */
function ticked(text: string): string[] {
  return [...text.matchAll(/`([a-z_]+)`/g)].map((m) => m[1]!);
}

test('TUTORIAL.md names every category on the side its tier puts it', () => {
  const doc = read('docs', 'TUTORIAL.md');
  for (const tier of ['Normative', 'Rationale']) {
    const found = new RegExp(
      `- \\*\\*${tier}\\*\\* categories \\((\\d+)[^:]*:([\\s\\S]*?)\\) —`,
    ).exec(doc);
    assert.ok(found, `docs/TUTORIAL.md no longer carries a "**${tier}** categories (N: …)" bullet. ` +
      `If the wording changed, update this pattern; do not delete the test.`);
    const expected = BY_TIER(tier.toLowerCase());
    assert.deepEqual(
      ticked(found[2]!).sort(), expected,
      `docs/TUTORIAL.md's ${tier} list is not the catalogue's ${tier} tier. Nothing else in ` +
      `this suite reads that file, so a category added without it ships undocumented there.`,
    );
    assert.equal(
      Number(found[1]), expected.length,
      `docs/TUTORIAL.md says ${found[1]} ${tier} categories; there are ${expected.length}.`,
    );
  }
});

test('TUTORIAL-ADVANCED.md names every category on the side its tier puts it', () => {
  const doc = read('docs', 'TUTORIAL-ADVANCED.md');
  for (const tier of ['normative', 'rationale']) {
    const found = new RegExp(
      `\\*\\*The (\\d+) ${tier} categories:\\*\\*([\\s\\S]*?)\\n\\n`,
    ).exec(doc);
    assert.ok(found, `docs/TUTORIAL-ADVANCED.md no longer carries a "**The N ${tier} ` +
      `categories:**" list. If the wording changed, update this pattern; do not delete the test.`);
    const expected = BY_TIER(tier);
    assert.deepEqual(ticked(found[2]!).sort(), expected,
      `docs/TUTORIAL-ADVANCED.md's ${tier} appendix list is not the catalogue's ${tier} tier.`);
    assert.equal(Number(found[1]), expected.length,
      `docs/TUTORIAL-ADVANCED.md says ${found[1]} ${tier} categories; there are ${expected.length}.`);
  }
});

test('both READMEs carry one specimen marker per category, and no marker for a non-category', () => {
  for (const doc of ['README.md', path.join('docs', 'README.he.md')]) {
    const text = read(doc);
    const marked = [...text.matchAll(/<!-- example: examples ([a-z_]+) --short -->/g)]
      .map((m) => m[1]!)
      .sort();
    assert.deepEqual(
      marked, NAMES,
      `${doc}'s specimen markers are not the catalogue. The marker lines are hand-typed — ` +
      `\`npm run gen:docs\` only FILLS them — so a new category gets no specimen block until ` +
      `somebody writes the marker, and nothing else notices.`,
    );
  }
});
