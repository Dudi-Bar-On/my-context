/**
 * The categories help topic's per-type section — the one place this project
 * says what each type is for and which type it is most often confused with.
 *
 * It lives in `src/help/topics/categories.md`, which is the single source for
 * three surfaces at once: `mycontext help categories`, the `mycontext_help`
 * MCP tool, and the generated block both READMEs embed. A second copy written
 * into a README would be free to drift, which is why the assertions below are
 * made against the rendered topic rather than against a document.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { helpTopic } from '../../src/help/index.ts';
import { resolveConfig } from '../../src/core/config.ts';

const CONFIG = resolveConfig({});

/**
 * The topic's per-type section, checked against the catalogue rather than
 * against a list written here.
 *
 * The complaint this answers was that the categories "are not there". They
 * were — as thirteen close-neighbour comparisons that covered sixteen of the
 * seventeen enabled types and left `glossary` out, contrasted only from the
 * `taxonomy` side in a passage most readers never reached. A hand-written list
 * of pairs is exactly the shape that loses a type when one is added, so the
 * expectation is derived from `CONFIG.categories` and a new category with no
 * entry fails here.
 */
function categoryEntries(): Map<string, string> {
  const text = helpTopic('categories', CONFIG);
  const entries = new Map<string, string>();
  // From one `### \`name\`` heading to the next heading of any level. Built by
  // splitting rather than by one lazy regex: `$` under the `m` flag matches
  // the end of every line, so a `(?=…|$)` lookahead ends each entry at its
  // first newline and every assertion below passes on four words.
  let current: string | null = null;
  let body: string[] = [];
  const flush = (): void => { if (current) entries.set(current, body.join('\n')); };
  for (const line of text.split('\n')) {
    const heading = /^### `([a-z_]+)`\s*$/.exec(line);
    if (heading) {
      flush();
      current = heading[1];
      body = [];
      continue;
    }
    if (/^#{1,3} /.test(line)) { flush(); current = null; body = []; continue; }
    if (current) body.push(line);
  }
  flush();
  return entries;
}

test('every enabled category has an entry saying what it is for', () => {
  const entries = categoryEntries();
  const enabled = Object.values(CONFIG.categories).filter((c) => c.enabled).map((c) => c.name);
  assert.deepEqual(
    [...entries.keys()].sort(), [...enabled].sort(),
    'the categories topic describes a different set of types than the config enables. ' +
    'Every enabled category needs an entry in src/help/topics/categories.md — that file ' +
    'is the single source the help topic, the mycontext_help tool and both READMEs read.',
  );
  for (const [name, body] of entries) {
    // Two sentences of purpose, not four words: the three categories the
    // standard profile leaves out each got an "overlaps with" and an "enable
    // it when", and the seventeen enabled ones had neither.
    assert.ok(body.length >= 150, `the \`${name}\` entry is ${body.length} characters — too ` +
      `thin to say both what it is for and how it differs from its neighbour`);
  }
});

test('every category entry names a nearest neighbour that is a real, different category', () => {
  for (const [name, body] of categoryEntries()) {
    const found = /\*\*Nearest neighbour: `([a-z_]+)`\.\*\*/.exec(body);
    assert.ok(found, `the \`${name}\` entry names no nearest neighbour. \`glossary\` was the ` +
      `one category without a comparison, which is how a reader ends up filing a term as a ` +
      `rule with nothing in the document to talk them out of it.`);
    const neighbour = found[1];
    assert.ok(Object.hasOwn(CONFIG.categories, neighbour),
      `the \`${name}\` entry names \`${neighbour}\` as its neighbour; no such category exists`);
    assert.notEqual(neighbour, name, `the \`${name}\` entry names itself as its neighbour`);
  }
});

test('the categories topic keeps the boundaries the old comparison list drew', () => {
  const text = helpTopic('categories', CONFIG);
  // The pairs the thirteen comparisons made, each still drawn from at least
  // one side. A rewrite that dropped one would otherwise pass the structural
  // checks above with a boundary silently gone.
  const pairs: [string, string][] = [
    ['adr', 'decision'], ['constraint', 'non_goal'], ['rule', 'standard'],
    ['standard', 'pattern'], ['requirement', 'constraint'], ['invariant', 'rule'],
    ['instruction', 'rule'], ['decision', 'tradeoff'], ['risk', 'assumption'],
    ['edge_case', 'requirement'], ['lesson', 'rule'], ['open_question', 'assumption'],
    ['glossary', 'rule'],
  ];
  const entries = categoryEntries();
  for (const [a, b] of pairs) {
    const drawn = entries.get(a)?.includes(`\`${b}\``) || entries.get(b)?.includes(`\`${a}\``);
    assert.ok(drawn, `neither the \`${a}\` entry nor the \`${b}\` entry mentions the other`);
  }
  // The one distinction that is a field rather than a pair.
  assert.match(text, /`kind`/,
    'the topic no longer says that functional and non-functional requirements are the ' +
    '`kind` field rather than two types');
});
