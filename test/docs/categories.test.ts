/**
 * The documentation defines every category, and cannot fall behind the
 * catalogue that decides what a category is.
 *
 * The definitions themselves are NOT copied into either README. They are
 * generated: both documents carry an `<!-- example: help categories -->` block
 * that `npm run gen:docs` fills with the real output of `mycontext help
 * categories`, and `test/docs/examples.test.ts` fails when a block no longer
 * matches what the command prints. So the table of types, tiers, id prefixes
 * and "use for" lines has exactly one source — `src/core/categories.ts`, via
 * `src/help/topics/categories.md` — and no second copy to drift.
 *
 * What this file covers is the part that block CANNOT carry, and that a
 * reviewer would otherwise have to re-check by hand: the generated block shows
 * a *resolved* config, so it lists the 17 categories the `standard` profile
 * enables and says nothing about the other three. Everything the README says
 * about them, and about the profile arithmetic around them, is hand-written
 * prose over values that live in code. Each assertion below pins one of those
 * values.
 *
 * The failure this prevents is the one this repository has been bitten by
 * repeatedly: a category added, renamed, or flipped to `defaultEnabled` in
 * `categories.ts` while both READMEs keep describing the old catalogue,
 * confidently and in two languages.
 *
 * What it cannot check, as ever, is whether the prose around a name is *true*.
 * That stays a review obligation (see `test/docs/parity.test.ts`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES, PROFILES } from '../../src/core/categories.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

const DOCUMENTS = [
  { file: 'README.md', heading: '### The three categories only `full` enables' },
  { file: path.join('docs', 'README.he.md'), heading: '### שלוש הקטגוריות שרק `full` מפעילה' },
] as const;

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(relative: string): string {
  return readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n');
}

/** The text from `heading` up to the next heading of the same or a higher level. */
function section(markdown: string, heading: string): string {
  const start = markdown.indexOf(heading);
  assert.notEqual(start, -1, `${JSON.stringify(heading)} is missing — it is where the three categories the standard profile does not enable are explained`);
  const rest = markdown.slice(start + heading.length);
  const end = /\n#{1,3} /.exec(rest);
  return rest.slice(0, end ? end.index : undefined);
}

/** Every `` `name` `` in `text` that is the name of a real category. */
function categoryNamesIn(text: string): Set<string> {
  const names = new Set<string>();
  for (const [, name] of text.matchAll(/`([a-z_]+)`/g)) {
    if (Object.hasOwn(CATEGORIES, name)) names.add(name);
  }
  return names;
}

const DEFAULT_OFF = Object.values(CATEGORIES)
  .filter((c) => !c.defaultEnabled).map((c) => c.name).sort();

test('every category in the catalogue is named in both documents', () => {
  for (const { file } of DOCUMENTS) {
    const text = read(file);
    for (const name of Object.keys(CATEGORIES)) {
      assert.ok(
        text.includes(`\`${name}\``),
        `${file} never mentions the category \`${name}\`. Every category the ` +
        `catalogue holds must be defined: the 17 the standard profile enables come ` +
        `from the generated \`help categories\` block, the rest from the section ` +
        `that explains what the standard profile leaves out.`,
      );
    }
  }
});

/**
 * The generated block, not a pasted table. If someone replaces it with a
 * hand-written copy of the same rows, the copy stops being regenerated and
 * `examples.test.ts` stops guarding it — which is precisely how two copies of
 * one fact start to drift.
 */
test('both documents get their definitions from the generated help block', () => {
  for (const { file } of DOCUMENTS) {
    assert.match(
      read(file), /<!-- example: help categories -->/,
      `${file} must embed \`mycontext help categories\` as a generated example block ` +
      `rather than duplicating the category table by hand`,
    );
  }
});

/**
 * The comparisons must not be behind a disclosure widget.
 *
 * They existed, and were good, and the owner of this project reported that
 * there was "no list of all the categories with explanations and examples" —
 * because a presentation pass had put the whole `help categories` block inside
 * a `<details>` two thousand lines down, to stop a long generated block from
 * burying the narrative. It buried the best category writing in the document
 * instead.
 *
 * Structural rather than textual on purpose. A prose assertion ("the document
 * says the comparisons are visible") is satisfied by prose; this is satisfied
 * only by the block actually being outside every collapsed element, in both
 * languages, and a future presentation pass that folds it away again fails
 * here rather than being noticed by a reader months later.
 */
test('the category comparisons are not collapsed behind a <details>', () => {
  for (const { file } of DOCUMENTS) {
    const text = read(file);
    const at = text.indexOf('<!-- example: help categories -->');
    assert.notEqual(at, -1, `${file} no longer embeds the generated categories block`);
    const before = text.slice(0, at);
    const opened = (before.match(/<details>/g) ?? []).length;
    const closed = (before.match(/<\/details>/g) ?? []).length;
    assert.equal(
      opened, closed,
      `${file} keeps \`mycontext help categories\` inside a <details>. That block carries ` +
      `every category's definition and its nearest-neighbour comparison, and collapsed is ` +
      `where they were when the owner reported he could not see them. Fold something else.`,
    );
    // Not vacuous: this document does use <details>, so the check above is
    // distinguishing a real state of the file rather than one it cannot reach.
    assert.ok(opened + closed >= 0 && text.includes('<details>'),
      `${file} contains no <details> at all — this assertion no longer distinguishes ` +
      `anything, so either the document changed or the marker did`);
  }
});

/**
 * One worked specimen per enabled category, in both documents, generated from
 * the command rather than pasted.
 *
 * Seventeen hand-written specimens already existed — `mycontext examples
 * <category>` has printed a real title, a real body and the category's own
 * fields for every enabled type since long before this test — and exactly one
 * of them reached the README, framed as a demonstration of the *command*
 * rather than of the category. The set is derived from the catalogue so that
 * adding a category makes this fail until it has a specimen too.
 */
test('every enabled category has a short specimen block in both documents', () => {
  const enabled = Object.values(CATEGORIES).filter((c) => c.defaultEnabled).map((c) => c.name);
  for (const { file } of DOCUMENTS) {
    const text = read(file);
    const found = [...text.matchAll(/<!-- example: examples ([a-z_]+) --short -->/g)]
      .map((m) => m[1]);
    assert.deepEqual(
      [...found].sort(), [...enabled].sort(),
      `${file} shows short specimens for ${JSON.stringify([...found].sort())}; the standard ` +
      `profile enables ${JSON.stringify([...enabled].sort())}. Every enabled category needs ` +
      `one — and it must be a generated \`--short\` block, not a pasted one, or it stops ` +
      `being checked by test/docs/examples.test.ts the moment the seed changes.`,
    );
    assert.equal(new Set(found).size, found.length, `${file} shows one category twice`);
  }
});

test('the section on the disabled categories names exactly the disabled ones', () => {
  for (const { file, heading } of DOCUMENTS) {
    const rows = [...section(read(file), heading).matchAll(/^\| `([a-z_]+)` \|/gm)]
      .map((m) => m[1]).sort();
    assert.deepEqual(
      rows, DEFAULT_OFF,
      `${file} documents ${JSON.stringify(rows)} as the categories the standard ` +
      `profile leaves out, but the catalogue marks ${JSON.stringify(DEFAULT_OFF)} ` +
      `as not enabled by default.`,
    );
  }
});

test('the catalogue and standard-profile counts in the prose are the real ones', () => {
  const total = Object.keys(CATEGORIES).length;
  const standard = PROFILES.standard.length;
  // The `standard` profile IS the default-enabled set — asserted here so the
  // sentence the READMEs make of it ("standard is exactly those the catalogue
  // marks defaultEnabled") is checked against the code, not merely repeated.
  assert.deepEqual(
    [...PROFILES.standard].sort(),
    Object.values(CATEGORIES).filter((c) => c.defaultEnabled).map((c) => c.name).sort(),
  );
  assert.equal(total - standard, DEFAULT_OFF.length);

  for (const { file, heading } of DOCUMENTS) {
    const text = section(read(file), heading);
    for (const n of [total, standard]) {
      assert.ok(
        text.includes(`**${n}**`),
        `${file} must state **${n}** in the section on the disabled categories ` +
        `(the catalogue holds ${total} categories and the standard profile enables ` +
        `${standard}). Keep the number in bold so this can find it.`,
      );
    }
  }
});

test('the minimal profile is listed by name, and by the right names', () => {
  const expected = new Set(PROFILES.minimal);
  for (const { file, heading } of DOCUMENTS) {
    const text = section(read(file), heading);
    const at = text.lastIndexOf('`minimal`');
    assert.notEqual(at, -1, `${file} does not describe the \`minimal\` profile here`);
    const listed = categoryNamesIn(text.slice(at));
    assert.deepEqual(
      [...listed].sort(), [...expected].sort(),
      `${file} lists ${JSON.stringify([...listed].sort())} as the minimal profile; ` +
      `the catalogue says ${JSON.stringify([...expected].sort())}.`,
    );
  }
});
