// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently,
// DEC-markdown-it-is-vendored-as-the-tokeniser-and-the-drawings
/**
 * **Subjects come from the documents** — `plan:recall seq:2`, Task 7 of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`, and §5 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * What is worth proving here, and why each assertion is not scaffolding.
 *
 *   1. **The tokeniser is the vendored one, and that is asserted rather than
 *      hoped.** `the vocabulary is derived by the vendored tokeniser` is the
 *      same shape `bandsAreDerived()` gives the status line: a module that
 *      quietly fell back to a regex would still return headings, and every
 *      other assertion here would still pass. The research measured what the
 *      fallback costs — a regex gets the headings and **misses 44% of the
 *      inline code**, and inline code is what this actually runs on.
 *   2. **The hard inline-code shapes are the point.** `a double-backticked
 *      span carrying a backtick is extracted` is the case that separates a
 *      parser from a pattern; a fixture of plain single-backtick spans would
 *      pass on either.
 *   3. **A fence is not a name.** `a fenced block is not offered as a subject`
 *      keeps the whole body of every code block out of a vocabulary that is
 *      about to become FTS5 queries.
 *   4. **Depth is a knob he chooses**, his ruling, so `shallow and deep return
 *      different sets` asserts the difference AND the containment — a knob
 *      whose two settings returned the same thing is a knob in name only.
 *   5. **Nothing is dropped silently.** `session text that matches nothing is
 *      surfaced as an unnamed thread` and the count assertion beside it are
 *      `INV-nothing-is-dropped-silently` applied where it matters most: the
 *      leftovers are themselves the signal the design asks for, *work
 *      happening that no item covers*.
 *   6. **A subject cites where it came from.** A vocabulary term with no file
 *      and line behind it cannot be checked by the subagent that receives it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  subjectsIn, readVocabulary, vocabularyOf, matchSubjects, markdownIsDerived,
} from '../../src/core/retrieval/subjects.ts';

const TICK = String.fromCharCode(96);

/**
 * A document in the shape this project actually writes them: a title, numbered
 * headings, a table, inline code in prose and inside the table, a
 * double-backticked span, and a fenced block that must not be mistaken for a
 * name.
 */
const DOC = [
  '# Conversation retrieval: finding your way back',
  '',
  '**Status:** APPROVED by the owner.',
  '',
  '## What a subject is',
  '',
  `Subjects come from the documents the session references, and ${TICK}classifyTurn${TICK}`,
  'already does the reduction in thirteen lines.',
  '',
  '| decision | measurement |',
  '|---|---|',
  `| **markdown-it** | found ${TICK}4,348 headings${TICK} over 7.53 MB |`,
  '',
  `A span carrying a backtick inside it: ${TICK}${TICK}a ${TICK}b${TICK} c${TICK}${TICK}.`,
  '',
  `${TICK}${TICK}${TICK}ts`,
  "const FENCED_IS_NOT_A_SUBJECT = 'and must never reach the vocabulary';",
  `${TICK}${TICK}${TICK}`,
  '',
  '### Byte offsets, not character offsets',
  '',
  'The corpus is Hebrew from record 5.',
].join('\n');

test('the vocabulary is derived by the vendored tokeniser', () => {
  assert.equal(
    markdownIsDerived(), true,
    'a regex fallback would still return headings and would miss 44% of the inline code',
  );
});

test('headings and inline code are extracted from a document', () => {
  const names = subjectsIn('spec.md', DOC, 'deep').map((subject) => subject.name);
  assert.ok(
    names.includes('Conversation retrieval: finding your way back'),
    `title missing from ${JSON.stringify(names)}`,
  );
  assert.ok(names.includes('What a subject is'), `heading missing from ${JSON.stringify(names)}`);
  assert.ok(names.includes('classifyTurn'), `inline code missing from ${JSON.stringify(names)}`);
  assert.ok(
    names.includes('4,348 headings'),
    `inline code inside a table missing from ${JSON.stringify(names)}`,
  );
});

test('a subject found in a table cites its own row, not line 1', () => {
  const found = subjectsIn('spec.md', DOC, 'deep')
    .find((subject) => subject.name === '4,348 headings');
  assert.ok(found !== undefined, 'the table cell must be found before its citation is checked');
  assert.equal(
    found?.line, 12,
    'the vendored tokeniser gives every token inside a table map: null, so an unguarded '
    + 'read cites line 1 — a citation that resolves to the wrong line',
  );
});

test('a double-backticked span carrying a backtick is extracted', () => {
  const names = subjectsIn('spec.md', DOC, 'deep').map((subject) => subject.name);
  assert.ok(
    names.includes(`a ${TICK}b${TICK} c`),
    `the shape a regex gets wrong is missing from ${JSON.stringify(names)}`,
  );
});

test('a fenced block is not offered as a subject', () => {
  const names = subjectsIn('spec.md', DOC, 'deep').map((subject) => subject.name);
  assert.ok(
    !names.some((name) => name.includes('FENCED_IS_NOT_A_SUBJECT')),
    `a fenced block reached the vocabulary: ${JSON.stringify(names)}`,
  );
});

test('a subject says which file and line it came from', () => {
  const found = subjectsIn('docs/spec.md', DOC, 'deep')
    .find((subject) => subject.name === 'Byte offsets, not character offsets');
  assert.ok(found !== undefined, 'the heading must be found before its citation can be checked');
  assert.equal(found?.file, 'docs/spec.md');
  assert.equal(found?.line, 20);
});

test('shallow and deep return different sets', () => {
  const shallow = subjectsIn('spec.md', DOC, 'shallow').map((subject) => subject.name);
  const deep = subjectsIn('spec.md', DOC, 'deep').map((subject) => subject.name);
  assert.notDeepEqual(shallow, deep, 'a knob whose settings agree is not a knob');
  assert.ok(
    !shallow.includes('classifyTurn'),
    'a shallow pass reads titles and headings, not the documents fully',
  );
  assert.ok(
    shallow.every((name) => deep.includes(name)),
    'deep must be a superset: a deeper read may not lose a heading',
  );
});

test('a vocabulary is read from documents on disk', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mycontext-subjects-'));
  const file = path.join(dir, 'design.md');
  writeFileSync(file, DOC, 'utf8');
  const vocabulary = readVocabulary([file], 'deep');
  assert.equal(vocabulary.documents, 1);
  assert.ok(vocabulary.terms.includes('classifyTurn'), 'the document was not read');
});

test('session text that matches nothing is surfaced as an unnamed thread', () => {
  const vocabulary = vocabularyOf([
    { name: 'classifyTurn', kind: 'code', file: 'spec.md', line: 7 },
  ], 'deep');
  const spans = [
    { text: 'we should reuse classifyTurn rather than write a second filter' },
    { text: 'the development started to diverge and at some point i felt lost' },
  ];
  const report = matchSubjects(vocabulary, spans);

  assert.deepEqual(report.matched.map((hit) => hit.subject.name), ['classifyTurn']);
  assert.deepEqual(report.matched[0]?.spans, [0]);
  assert.deepEqual(report.unnamed.map((thread) => thread.span), [1]);
  assert.equal(
    report.matchedSpans + report.unnamed.length, spans.length,
    'every span is either attributed or surfaced; none is dropped',
  );
});
