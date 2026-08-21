/**
 * `runbook` and `procedure` must each say which one they are.
 *
 * Spec §6o creates a second normative ordered-step category, over an explicit
 * objection (§6l F7) that two categories differing only by repeatable-versus-
 * once are a second spelling of one concept. §6o accepts that risk on one
 * condition: that the difference is statable at capture time, in
 * `mycontext help categories`, in `mycontext examples <either>`, and in both
 * READMEs. This file is that condition, expressed as an assertion.
 *
 * It fails if EITHER category's documented description stops distinguishing
 * them — not only if the boundary sentence is deleted. A reworded `runbook`
 * entry that no longer mentions `procedure` fails here even though every
 * other test in the suite stays green, which is the whole reason this file
 * exists.
 *
 * What it cannot do, stated so a green run is not mistaken for a reviewed
 * document: it checks that both names appear, that the discriminating words
 * appear, and that the verbatim test sentence is present where §6o requires
 * it. It cannot check that the surrounding prose is true or useful. Same
 * disclaimer as test/docs/inventory.test.ts, for the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { CATEGORIES } from '../../src/core/categories.ts';
import { exampleItemShort } from '../../src/help/index.ts';
import { resolveConfig } from '../../src/core/config.ts';

/**
 * `resolveConfig({})` rather than a shared `test/helpers/config.ts`, which does
 * not exist: `test/help/help.test.ts` builds its own `CONFIG` the same way, one
 * line under its import block, and a new helper module would be a second
 * spelling of one call.
 */
const CONFIG = resolveConfig({});

const REPO = path.join(import.meta.dirname, '..', '..');
/** LF-normalized, the way `test/docs/parity.test.ts` reads for the same reason:
 * a working tree checked out before `.gitattributes` is CRLF, and a sentence
 * asserted `includes` would then never match across its line break. */
const read = (...p: string[]): string =>
  readFileSync(path.join(REPO, ...p), 'utf8').replaceAll('\r\n', '\n');

/** §6o's words, and they are not paraphrased anywhere this test looks. */
const TEST_SENTENCE =
  'Will you do this again next time the situation arises? Then it is a `runbook`. ' +
  'Is it done once and then finished? Then it is a `procedure`.';

/** The `### \`name\`` section of a topic source, heading excluded. */
function entry(doc: string, name: string): string {
  const found = new RegExp(`\\n### \`${name}\`\\n([\\s\\S]*?)(?=\\n### |$)`).exec(doc);
  assert.ok(found, `the categories topic has no \`${name}\` entry`);
  return found[1]!;
}

test('the two CategoryDef descriptions distinguish each other', () => {
  const run = CATEGORIES.runbook!.description;
  const proc = CATEGORIES.procedure!.description;
  assert.notEqual(run, proc);
  // `procedure` names its sibling in its own description, because that string
  // is what /mycontext:add-procedure, `mycontext help`, the generated category
  // table in both READMEs and the MCP create_item enum all print. Removing the
  // name is how the boundary quietly stops being reachable at capture time.
  assert.match(proc, /runbook/,
    "`procedure`'s description no longer names `runbook`. Spec §6o requires the difference " +
    'to be statable where an author is choosing, and this description is the shortest of ' +
    'those places — it is printed by every add surface.');
  assert.match(proc, /once/);
  // `runbook`'s description is the SHIPPED one and §6o keeps it verbatim; it
  // is pinned here so a future "let us make them symmetrical" edit is a
  // decision somebody takes deliberately rather than a diff nobody reviews.
  assert.equal(run, 'The steps for a named operation, in the order they must be taken');
});

test('`mycontext help categories` states the boundary, in both directions', () => {
  const doc = read('src', 'help', 'topics', 'categories.md');
  const run = entry(doc, 'runbook');
  const proc = entry(doc, 'procedure');

  assert.match(run, /`procedure`/, "`runbook`'s entry no longer mentions `procedure`");
  assert.match(proc, /`runbook`/, "`procedure`'s entry no longer mentions `runbook`");
  for (const [name, body] of [['runbook', run], ['procedure', proc]] as const) {
    assert.ok(body.includes(TEST_SENTENCE),
      `the \`${name}\` entry no longer carries §6o's one-sentence test verbatim:\n` +
      `${TEST_SENTENCE}\nIt is quoted rather than paraphrased on purpose — a paraphrase in ` +
      `one entry and not the other is how the two stopped agreeing last time.`);
  }
  // The tagged neighbours point at each other (design decision 18). The
  // `instruction` contrast stays in runbook's entry as prose; only the tagged
  // line moves.
  assert.match(run, /\*\*Nearest neighbour: `procedure`\.\*\*/);
  assert.match(proc, /\*\*Nearest neighbour: `runbook`\.\*\*/);
});

test('the Hebrew topic source states the boundary too, in both directions', () => {
  const doc = read('src', 'help', 'topics', 'categories.he.md');
  // The category NAMES are Latin in the Hebrew source — they are identifiers a
  // reader types, not words. The sentence itself is Hebrew, so only the names
  // and the neighbour markers are asserted here; the entry-set and
  // heading-structure equality with the English source is already held by
  // test/help/categories-topic.test.ts.
  assert.match(entry(doc, 'runbook'), /procedure/);
  assert.match(entry(doc, 'procedure'), /runbook/);
});

test('`mycontext examples <either>` says which of the two it is', () => {
  const run = exampleItemShort('runbook', CONFIG);
  const proc = exampleItemShort('procedure', CONFIG);
  // Each specimen names the other category. This is the narrowest possible
  // assertion that survives a rewrite of either body: a specimen that stops
  // mentioning its sibling has stopped answering "which one is this?", which
  // is the question §6o says these two commands must answer.
  assert.match(run, /procedure/,
    'the `runbook` specimen no longer mentions `procedure`. Both READMEs print this block, ' +
    'and it is where a reader meets the pair.');
  assert.match(proc, /runbook/,
    'the `procedure` specimen no longer mentions `runbook`.');
  // And they are shaped differently, which is the non-verbal half of the
  // answer: a procedure carries `## Steps` checkboxes, a runbook does not.
  assert.match(proc, /- \[ \] /);
  assert.doesNotMatch(run, /- \[ \] /);
  assert.doesNotMatch(proc, /- \[x\]/);   // a shipped specimen never teaches stored progress
});

test('both READMEs carry the boundary sentence', () => {
  for (const doc of ['README.md', path.join('docs', 'README.he.md')]) {
    assert.ok(read(doc).includes(TEST_SENTENCE),
      `${doc} no longer carries §6o's one-sentence test. It is the sentence a reader uses to ` +
      `choose, and it is verbatim in all four places on purpose.`);
  }
});
