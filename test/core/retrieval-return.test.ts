// @basis TASK-reconstruct-a-subject-from-a-passage-you-copied-without-the,
// INV-nothing-is-dropped-silently,
// RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
/**
 * **What returns, and when — Task 11 steps 2, 3, 4, 4a, 4b and 4c of
 * `docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md`**, §10 and
 * §10a of `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * The plan's own self-review names step 2 the SAFETY BOUNDARY — *"everything
 * else can be imperfect; this one cannot"* — so this file asserts it four
 * separate ways rather than once, and each way is arranged so it can FAIL:
 *
 *   1. **The return path cannot inject.** A source scan over
 *      `src/core/retrieval/`, with a PLANTED importer as a positive control,
 *      exactly as `test/review/drift.test.ts` proves its own scanner can see
 *      one. A scan with no control is a scan that is green on a reader that
 *      reads nothing, and this project has shipped two of those.
 *   2. **Marking is a VALUE, not an effect.** The module binds no writer at
 *      all — no `node:fs`, no `writeFileSync`, no reach into the staging half
 *      — and the control plants each shape to prove the scan can see it. This
 *      assertion replaced one that could not fail: see its own docblock.
 *   3. **Staging is not delivery.** After `stageRetrievalReturn`, the question
 *      the INJECTION asks — `approvedRestore` — still answers `null`. That is
 *      the assertion of an inability rather than a promise of one, which is
 *      `driftCheck`'s shape and step 4b's instruction in as many words.
 *   4. **What returns arrives MARKED**, and a ruling that has since been
 *      REVERSED says so on arrival. A supersession is planted and the marking
 *      is asserted on STRUCTURE — the section, and what the section lists —
 *      never on a substring, because every id in the reversed section also
 *      appears in the claim that named it, and `toContain` on one would pass
 *      on the other. Around twenty-five assertions were caught here this week
 *      for exactly that.
 *
 * And a staged return is marked identically (step 4c). A fresh window makes
 * that MORE important, not less: there is less context around it to contradict
 * a stale claim.
 */
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';
import { removeTree } from '../helpers/tmp.ts';

import { approvedRestore, loadStagedRestore } from '../../src/core/restore-staging.ts';
import { SESSION_SUMMARY_MARKER, isMarkedSummary } from '../../src/core/session-summary.ts';
import type { RetrievalResult } from '../../src/core/retrieval/result.ts';
import {
  RETURN_PROTOCOL, idsNamedIn, markReturn, returnReviewForm, sectionsOf,
  type RulingLookup,
} from '../../src/core/retrieval/return.ts';
import { stageRetrievalReturn } from '../../src/core/retrieval/return-stage.ts';

const REVERSED = 'DEC-the-ui-is-developed-against-a-simulated-corpus-until-the';
const SUCCESSOR = 'INSTR-testing-happens-against-the-current-corpus-and-an-exception';
const STANDING = 'INV-nothing-is-dropped-silently';

const RESULT: RetrievalResult = {
  id: 'recall-0001',
  at: '2026-09-10T08:00:00.000Z',
  mode: 'from-selection',
  query: { names: [REVERSED], terms: ['the byte offset'] },
  missionPath: '.my_context/.retrieval/recall-0001.mission.md',
  claims: [
    {
      text: `The browser suite ran against a simulated corpus under ${REVERSED}.`,
      citations: [{ kind: 'commit', hash: 'a50fc84' }],
    },
    {
      text: `Nothing is dropped without a line saying so — ${STANDING}.`,
      citations: [{ kind: 'file', file: 'src/core/retrieval/noise.ts', line: 264 }],
    },
    {
      text: 'The anchors table is keyed by session and byte offset.',
      citations: [{ kind: 'turn', sessionId: 'sess-a', agentId: null, byteOffset: 918_273 }],
    },
  ],
};

/**
 * The corpus, as the marking asks it: one ruling reversed, one still standing,
 * and everything else unknown. Injected rather than read, so this module never
 * acquires a store handle — `CitationResolvers`' shape, for its reason.
 */
const LOOKUP: RulingLookup = (id) => {
  if (id === REVERSED) return { id, status: 'superseded', supersededBy: SUCCESSOR };
  if (id === STANDING) return { id, status: 'active', supersededBy: null };
  return null;
};

const NOW = new Date('2026-09-12T11:30:00.000Z');

/**
 * **Every temporary root this file makes, removed when it is done.**
 *
 * Measured rather than tidied on principle: an earlier form of this file left
 * a `mkdtempSync` directory behind per test per run, and `%TEMP%` held 213 of
 * them by the end of one afternoon. A test that litters is a test nobody wants
 * to run often, and this project cleaned 9.59 GB of leaked fixtures off this
 * machine the day before.
 */
const madeDirs: string[] = [];
const tempRoot = (prefix: string): string => {
  const dir = mkdtempSync(path.join(tmpdir(), prefix));
  madeDirs.push(dir);
  return dir;
};
after(() => { for (const dir of madeDirs) removeTree(dir); });

/* ── 1. the return path cannot inject ────────────────────────────────────── */

test('nothing on the return path can put a byte into a context window', () => {
  const dir = path.join(process.cwd(), 'src', 'core', 'retrieval');
  const sources = readdirSync(dir).filter((name) => name.endsWith('.ts'));
  assert.ok(sources.includes('return.ts'), 'the module under test must be in the scan');

  for (const name of sources) {
    const code = readFileSync(path.join(dir, name), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    assert.ok(!/from '[^']*inject\.ts'/.test(code), `${name} imports the injection builder`);
    assert.ok(!/from '[^']*hooks\//.test(code), `${name} imports hook machinery`);
    assert.ok(!code.includes('additionalContext'), `${name} names the field a hook answers with`);
  }

  // ── THE POSITIVE CONTROL ────────────────────────────────────────────────
  // Without it the three assertions above are green on a scanner that strips
  // everything and reads nothing. `test/review/drift.test.ts` plants an
  // importer for the same reason; this plants all three shapes at once.
  const sneak = [
    "import { buildInjection } from '../core/inject.ts';",
    "import { hookOut } from '../hooks/stop.ts';",
    'export const answer = { additionalContext: buildInjection, hookOut };',
  ].join(String.fromCharCode(10));
  assert.ok(/from '[^']*inject\.ts'/.test(sneak), 'the scanner cannot see an inject import');
  assert.ok(/from '[^']*hooks\//.test(sneak), 'the scanner cannot see a hook import');
  assert.ok(sneak.includes('additionalContext'), 'the scanner cannot see the field');
});

/* ── 2. marking is a value, not an effect ────────────────────────────────── */

/**
 * **`markReturn` cannot write, and this is the assertion that says so.**
 *
 * The first form of this test handed `markReturn` a temporary workspace and
 * compared its bytes before and after. **A removal proof caught it, and the
 * finding is worth writing down**: `markReturn(result, chosen, lookup, now)`
 * takes no root, so there is no directory it could write to even in principle
 * — the comparison could not fail for any implementation, and a planted write
 * left it green. It looked like the strongest assertion in the file and was
 * the only one that asserted nothing.
 *
 * What replaces it is the property that is actually load-bearing: the module
 * BINDS no writer. `node:fs` is not imported, `writeFileSync` is not named,
 * and the staging half lives in a separate file precisely so that it cannot
 * arrive here through an import somebody adds later. The control plants each
 * shape and proves the scanner sees it.
 */
test('the marking module binds nothing that can write', () => {
  const file = path.join(process.cwd(), 'src', 'core', 'retrieval', 'return.ts');
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

  assert.ok(!/from 'node:fs'/.test(code), 'return.ts imports the filesystem');
  assert.ok(!/writeFileSync/.test(code), 'return.ts names a file writer');
  assert.ok(!/from '[^']*restore-stage\.ts'/.test(code),
    'return.ts reaches the staging writer; that half lives in return-stage.ts');

  const planted = [
    "import { writeFileSync } from 'node:fs';",
    "import { stageRestoreSummary } from '../restore-stage.ts';",
    'export const go = () => { writeFileSync("x", ""); stageRestoreSummary; };',
  ].join(String.fromCharCode(10));
  assert.ok(/from 'node:fs'/.test(planted), 'the scanner cannot see an fs import');
  assert.ok(/writeFileSync/.test(planted), 'the scanner cannot see the writer');
  assert.ok(/from '[^']*restore-stage\.ts'/.test(planted),
    'the scanner cannot see the staging import');
});

/**
 * And it is DETERMINISTIC, which is the other half of "a value, not an
 * effect": the same result, the same choice and the same clock produce the
 * same bytes, so nothing about a marking depends on what has happened before
 * it.
 */
test('the same choice marked twice is byte-identical', () => {
  assert.equal(
    markReturn(RESULT, [1, 3], LOOKUP, NOW).text,
    markReturn(RESULT, [1, 3], LOOKUP, NOW).text,
  );
});

/* ── 3. what returns arrives MARKED, and a reversal says so ──────────────── */

test('a return is dated and states itself a record rather than an instruction', () => {
  const marked = markReturn(RESULT, [1, 2, 3], LOOKUP, NOW);
  const sections = sectionsOf(marked.text);

  // The header, asserted as the FIRST line rather than as a substring: the
  // protocol strings also appear in the review form and in the staged record.
  const [first = '', second = ''] = marked.text.split('\n');
  assert.ok(
    first.startsWith(`[${SESSION_SUMMARY_MARKER}]`),
    `the loop guard's marker must open the payload, got ${JSON.stringify(first)}`,
  );
  assert.ok(second.startsWith(`[${RETURN_PROTOCOL}]`), 'the return protocol line is the second');

  assert.equal(marked.at, NOW.toISOString(), 'the marking carries the day it was made');
  assert.ok(second.includes(NOW.toISOString().slice(0, 10)), 'the day is IN the text he reads');
  assert.ok(second.includes(RESULT.at.slice(0, 10)), 'and so is the day the result was written');

  assert.ok(
    sections.has('THIS IS A RECORD, NOT AN INSTRUCTION'),
    `the record section is missing; sections were ${[...sections.keys()].join(' / ')}`,
  );
});

test('a ruling that has since been reversed says so on arrival', () => {
  const marked = markReturn(RESULT, [1, 2, 3], LOOKUP, NOW);

  assert.deepEqual(
    marked.reversed.map((r) => [r.id, r.supersededBy]),
    [[REVERSED, SUCCESSOR]],
    'exactly the reversed ruling, and the item that answers it',
  );

  // **On STRUCTURE, never on a substring.** `REVERSED` appears in claim 1 and
  // in the query line as well, so `text.includes(REVERSED)` would be green on
  // a build that dropped the section entirely.
  const sections = sectionsOf(marked.text);
  const section = sections.get('REVERSED SINCE — READ THESE FIRST');
  assert.ok(section !== undefined, `no reversal section; got ${[...sections.keys()].join(' / ')}`);
  const listed = (section ?? []).filter((line) => line.startsWith('- '));
  assert.equal(listed.length, 1, 'one reversal, one line');
  assert.match(listed[0] ?? '', new RegExp(`\`${REVERSED}\``), 'the line names the reversed id');
  assert.match(listed[0] ?? '', new RegExp(`\`${SUCCESSOR}\``), 'and names what answers it');

  // The standing ruling is NOT listed — a marking that warned about everything
  // would say nothing.
  assert.ok(
    !listed.some((line) => line.includes(STANDING)),
    'a ruling still in force was reported as reversed',
  );
});

test('nothing is reversed, and then there is no reversal section at all', () => {
  const marked = markReturn(RESULT, [2, 3], () => null, NOW);
  assert.deepEqual(marked.reversed, []);
  assert.ok(
    !sectionsOf(marked.text).has('REVERSED SINCE — READ THESE FIRST'),
    'a section warning about nothing is noise a reader learns to skip',
  );
  // And the ids it could not judge are SURFACED rather than dropped.
  assert.ok(marked.unknown.includes(STANDING), 'an id the corpus does not hold must be said');
});

/* ── 4. he can return PART of a result ───────────────────────────────────── */

test('one claim out of three returns, and the other two say they were left', () => {
  const marked = markReturn(RESULT, [3], LOOKUP, NOW);
  const returned = sectionsOf(marked.text).get('WHAT RETURNS') ?? [];
  const lines = returned.filter((line) => line.startsWith('- '));

  assert.equal(lines.length, 1, 'exactly the claim he chose');
  assert.match(lines[0] ?? '', /anchors table/, 'and it is that claim');
  assert.equal(marked.chosen.length, 1);
  assert.equal(marked.left, 2, 'what was not chosen is COUNTED, never silently absent');
  assert.ok(
    (sectionsOf(marked.text).get('THIS IS A RECORD, NOT AN INSTRUCTION') ?? [])
      .some((line) => line.includes('2 of the 3')),
    'the header says how much of the result this is',
  );

  // Choosing one claim must not drag the whole file's reversals in: claim 3
  // names no ruling at all.
  assert.deepEqual(marked.reversed, [], 'a reversal of a claim he did not take is not his problem');
});

test('a choice that names no claim is refused rather than returning everything', () => {
  assert.throws(() => markReturn(RESULT, [], LOOKUP, NOW), /nothing was chosen/i);
  assert.throws(() => markReturn(RESULT, [9], LOOKUP, NOW), /no claim 9/i);
});

/* ── 5. the ids a text names ─────────────────────────────────────────────── */

test('the ids a claim names are found by shape, and a bare word is not one', () => {
  assert.deepEqual(
    idsNamedIn(`see ${REVERSED} and ${STANDING}, but not decision or rule`),
    [REVERSED, STANDING].sort(),
  );
});

/* ── 6. staging is NOT delivery ──────────────────────────────────────────── */

test('staging a return for a fresh window delivers nothing, and the injection still sees nothing', () => {
  const root = tempRoot('return-stage-');
  const marked = markReturn(RESULT, [1, 2], LOOKUP, NOW);

  // Before: there is nothing for an injection to take.
  assert.equal(approvedRestore(root).record, null, 'the fixture must start empty');

  const staged = stageRetrievalReturn(root, marked, '.my_context/.retrieval/recall-0001.result.md', NOW);
  assert.ok(staged.verified, `the stage must be verifiable on disk: ${staged.reason}`);
  assert.ok(statSync(staged.file).size > 0);

  const record = loadStagedRestore(root, staged.key);
  assert.ok(record !== null);
  assert.equal(record?.state, 'proposed', 'staging leaves a PROPOSAL, never an approval');
  assert.equal(record?.approvedAt, null);
  assert.equal(record?.approvedBy, null);
  assert.equal(record?.deliveredAt, null);

  // **The assertion that matters.** `approvedRestore` is the question
  // `core/inject.ts` asks at a session start, and it is the only route a
  // staged payload can take into a window. It must still answer nothing.
  assert.equal(
    approvedRestore(root).record,
    null,
    'a staged return was visible to the injection — the clear is his act and so is the release',
  );
});

test('a staged return is marked exactly as a returned one is', () => {
  const root = tempRoot('return-stagemark-');
  const marked = markReturn(RESULT, [1, 2], LOOKUP, NOW);
  const staged = stageRetrievalReturn(root, marked, 'result.md', NOW);
  const record = loadStagedRestore(root, staged.key);

  assert.equal(record?.payload, marked.text, 'the payload IS the marked text, unaltered');
  assert.ok(isMarkedSummary(record?.payload ?? ''), 'the loop guard can see its own marker');

  const sections = sectionsOf(record?.payload ?? '');
  assert.ok(sections.has('THIS IS A RECORD, NOT AN INSTRUCTION'), 'a staged return states itself');
  assert.ok(sections.has('REVERSED SINCE — READ THESE FIRST'), 'and carries the reversal');

  // The review form is the OTHER artefact — what he reads before approving —
  // and it is not the payload. Two artefacts, D34's ruling, unchanged.
  assert.notEqual(record?.reviewForm, record?.payload);
  assert.ok((record?.reviewForm ?? '').includes('2 of the 3'), 'the form says how much this is');
  assert.ok(
    (record?.shortfalls ?? []).some((line) => line.startsWith('CHOSEN:')),
    `every way this is partial, itemised: ${JSON.stringify(record?.shortfalls)}`,
  );
  assert.ok(
    (record?.shortfalls ?? []).some((line) => line.startsWith('REVERSED:')),
    'a reversal is a way the record is partial, and the form must say so',
  );
});

test('the review form names the result it was built from and the claims it left', () => {
  const marked = markReturn(RESULT, [1], LOOKUP, NOW);
  const form = returnReviewForm(marked, '.my_context/.retrieval/recall-0001.result.md');
  assert.match(form, /recall-0001\.result\.md/, 'a form that does not name its source cannot be checked');
  assert.match(form, /2 of the 3/);
  assert.match(form, new RegExp(`\`${REVERSED}\``), 'the reversal is in the form, not only the payload');
});
