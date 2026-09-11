// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently, CONST-zero-runtime-dependencies
/**
 * **A selection becomes a query** — `plan:recall seq:2`, Task 6 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §3 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * What is worth proving here, and why each assertion is not scaffolding.
 *
 *   1. **The NAME is the unit, and the passage's own names are found.** The
 *      research measured the three candidate query shapes against the archive:
 *      headings 4%, word-bags 32%, item-id slugs 68%. So `a copied passage
 *      yields the identifiers it carries` plants one of EACH kind the design
 *      names — an item id, a `plan:`/`seq:` reference, a file path, a
 *      backticked name, a bare camelCase call, a commit hash — and asserts
 *      each arrives. A fixture carrying one kind would pass on an extractor
 *      that knew only that kind.
 *   2. **A passage with no names SAYS SO.** `a passage carrying no names is
 *      reported as nothing to match on` is the assertion the design asks for
 *      by name: *a guess that resolves is worse than silence*. An extractor
 *      that fell back to a word-bag would return something plausible here, and
 *      the caller could not tell it apart from a real match.
 *   3. **A name the archive cannot search for is not offered.** The prose
 *      index is `trigram`, so a term under three characters matches nothing at
 *      all, ever — `MIN_QUERY_CHARS` is imported from the module that owns
 *      that bound rather than spelled again here.
 *   4. **The automaton earns its place on the terms the patterns cannot see.**
 *      `a vocabulary term the passage never backticks is found` puts the name
 *      in plain prose, where no pattern can find it and only a dictionary scan
 *      can. And `a vocabulary term inside a longer word is not a match` is the
 *      other half: a substring hit would make the automaton worse than
 *      nothing, because it would resolve.
 *   5. **Hebrew, because this corpus is Hebrew from record 5.** Two
 *      assertions, one per mechanism: an identifier surrounded by Hebrew is
 *      still extracted, and a Hebrew vocabulary term is matched by the
 *      automaton.
 *
 * Nothing here opens a database or reads the archive: a passage is a string
 * the owner copied, and turning it into a query is a pure function of it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  queryFromPassage, buildAutomaton, findTerms,
} from '../../src/core/retrieval/from-selection.ts';
import { MIN_QUERY_CHARS } from '../../src/core/conversation-search.ts';

/**
 * A passage in the shape the owner actually copies: a paragraph out of a
 * design document, dense in names, written by a person rather than generated.
 */
const PASSAGE = [
  'The precedent is hours old and was proved the hard way.',
  'plan:archive seq:34 needed to store a session name, and',
  'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number is why',
  'the note in src/core/conversation-index.ts says it rather than the report.',
  'classifyTurn already does the reduction in thirteen lines, and commit',
  'c7bcaa1b is where the table landed, and `mycontext ready --held` lists what is open.',
].join('\n');

test('a copied passage yields the identifiers it carries', () => {
  const query = queryFromPassage(PASSAGE);
  assert.equal(query.matchable, true);
  assert.equal(query.note, null);
  assert.ok(
    query.names.includes('RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number'),
    `item id missing from ${JSON.stringify(query.names)}`,
  );
  assert.ok(
    query.names.includes('plan:archive seq:34'),
    `plan reference missing from ${JSON.stringify(query.names)}`,
  );
  assert.ok(
    query.names.includes('src/core/conversation-index.ts'),
    `file path missing from ${JSON.stringify(query.names)}`,
  );
  assert.ok(
    query.names.includes('classifyTurn'),
    `bare camelCase name missing from ${JSON.stringify(query.names)}`,
  );
  assert.ok(
    query.names.includes('c7bcaa1b'),
    `commit hash missing from ${JSON.stringify(query.names)}`,
  );
  assert.ok(
    query.names.includes('mycontext ready --held'),
    `backticked command missing from ${JSON.stringify(query.names)}`,
  );
});

test('a name that appears twice is offered once', () => {
  const query = queryFromPassage('`classifyTurn` and classifyTurn again, classifyTurn.');
  const hits = query.names.filter((name) => name === 'classifyTurn');
  assert.deepEqual(hits, ['classifyTurn']);
});

test('a passage carrying no names is reported as nothing to match on', () => {
  const query = queryFromPassage(
    'i used to work on a subject while developing my project, because a specific '
    + 'issue took a very long time the development started to diverge and drift '
    + 'and in some point i felt lost and panic about how could i come back.',
  );
  assert.equal(query.matchable, false);
  assert.deepEqual(query.names, []);
  assert.deepEqual(query.terms, []);
  assert.ok(query.note !== null, 'a passage with nothing to match on must say so');
  assert.match(query.note ?? '', /nothing to match on/);
});

test('a name too short for the archive to search for is not offered', () => {
  const short = 'ui';
  assert.ok(short.length < MIN_QUERY_CHARS, 'fixture must be under the index floor');
  const tick = String.fromCharCode(96);
  const query = queryFromPassage(
    'the ' + tick + short + tick + ' layer and ' + tick + 'retrieval' + tick + ' beside it',
  );
  assert.ok(!query.names.includes(short), `${short} cannot be searched for and must not be offered`);
  assert.ok(query.names.includes('retrieval'), 'the searchable name beside it must survive');
});

test('a vocabulary term the passage never backticks is found', () => {
  const query = queryFromPassage(
    'he asked for the byte offset to be the position marker, not a character one.',
    ['byte offset', 'conversation retrieval'],
  );
  assert.equal(query.matchable, true);
  assert.deepEqual(query.terms, ['byte offset']);
});

test('a vocabulary term inside a longer word is not a match', () => {
  const found = findTerms(buildAutomaton(['anchor']), 'the anchorage was unreachable');
  assert.deepEqual([...found.keys()], []);
});

test('a vocabulary term standing as a word is a match', () => {
  const found = findTerms(buildAutomaton(['anchor']), 'the anchor was unreachable');
  assert.deepEqual([...found.keys()], ['anchor']);
});

test('an identifier surrounded by Hebrew is still extracted', () => {
  const query = queryFromPassage('הפונקציה classifyTurn היא זו שמחליטה מה נשמר.');
  assert.ok(
    query.names.includes('classifyTurn'),
    `identifier missing from ${JSON.stringify(query.names)}`,
  );
});

test('a Hebrew vocabulary term is matched through its prefixed form', () => {
  const found = findTerms(buildAutomaton(['שורה']), 'זו השורה שחיפשתי');
  assert.deepEqual([...found.keys()], ['שורה']);
});

test('a Hebrew term is not matched inside an unrelated word', () => {
  const found = findTerms(buildAutomaton(['שרה']), 'היו שם עשרה אנשים');
  assert.deepEqual([...found.keys()], []);
});
