// @basis TASK-the-maintenance-tool-crud-where-the-form-is-the-template-and, RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number
/**
 * **A STORE UPDATE UNDER A RUNNING SESSION — the diff only, phrased as
 * supersession, and at session-scope doors only.**
 *
 * D41 spec §12.3, `plan:store seq:3` Task 13:
 *
 * > *A subagent starts fresh and simply receives the new store. **Only a
 * > long-running session holds a stale copy** — and text cannot be removed
 * > from a context window. So the remedy is a correction injected as a
 * > replacement: session-scope doors only; the diff only, never the whole
 * > store; phrased as supersession, naming what it replaces.*
 *
 * The middle clause is the one this project has already paid for. `CLAUDE.md`
 * opens with it: *"five superseded instructions being acted on as current
 * because a document repeated one after it had been reversed."* An update that
 * reads as an ADDITION reproduces exactly that, so the wording is asserted and
 * not left to the renderer's taste.
 *
 * ── HOW "THE DIFF ONLY" IS ASSERTED ────────────────────────────────────────
 *
 * By reading the ids the correction actually RENDERS out of its own text —
 * every entry block carries a `` `id` · kind `` line — and comparing that set
 * to the ids that changed. A length comparison would pass a correction that
 * happened to be short; a substring check for an unchanged id would pass the
 * day that id appeared inside a neighbouring entry's prose.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  SESSION_SCOPE_DOORS, correctionAtDoor, renderCorrection, renderRules,
} from '../../src/rules/deliver.ts';
import { composeEntry, parseEntry, type Entry } from '../../src/rules/schema.ts';
import type { Door } from '../../src/rules/delivered.ts';

function entry(id: string, truth: string): Entry {
  const text = composeEntry({
    id,
    kind: 'fact',
    tier: 'product',
    title: `the fact called ${id}`,
    parts: {
      truth,
      breaks: 'a reader acts on a rule that was reversed',
      example: 'written by test/rules/update-correction.test.ts',
      check: 'none - a fixture has nothing to measure',
    },
  });
  const parsed = parseEntry(text, path.join('fixtures', `${id}.md`));
  assert.ok(!('error' in parsed), `the fixture ${id} does not parse: ${JSON.stringify(parsed)}`);
  return parsed;
}

const UNCHANGED = entry('the-unchanged-constant', 'this one did not move');
const BEFORE = [UNCHANGED, entry('the-reversed-constant', 'answer in prose')];
const AFTER = [UNCHANGED, entry('the-reversed-constant', 'answer by number')];

/** The ids a block actually renders, read out of its own entry headers. */
function rendered(text: string): string[] {
  return [...text.matchAll(/^`([a-z0-9-]+)` · /gm)].map((m) => m[1]).sort();
}

/* ══ 0. THE FIXTURE IS A DIFF, OR EVERY ASSERTION BELOW IS VACUOUS ═════════ */

test('the before and after sets differ in exactly one entry', () => {
  assert.deepEqual(BEFORE.map((e) => e.id), AFTER.map((e) => e.id));
  assert.notEqual(
    BEFORE[1].parts.truth, AFTER[1].parts.truth,
    'the fixture changed nothing, so "the diff only" is trivially satisfied',
  );
  assert.ok(
    rendered(renderRules({ entries: AFTER, refused: [] }).text).length === 2,
    'the full block does not render both entries, so "only one of them" proves nothing',
  );
});

/* ══ 1. THE DIFF ONLY, NEVER THE WHOLE STORE ══════════════════════════════ */

test('the correction carries the changed entry and NOT the whole store', () => {
  const correction = renderCorrection(BEFORE, AFTER);
  assert.deepEqual(
    rendered(correction.text), ['the-reversed-constant'],
    'the correction rendered an entry that did not change. Spec §12.3: "the diff only, never ' +
    'the whole store — a second full copy wastes the window and creates two versions to ' +
    'reconcile."',
  );
  assert.deepEqual(correction.superseded, ['the-reversed-constant']);
  assert.deepEqual(correction.added, []);
  assert.deepEqual(correction.removed, []);
});

test('an added entry is an addition and a removed one is a withdrawal, each named', () => {
  const added = entry('the-new-constant', 'this one is new');
  const withAdded = renderCorrection(BEFORE, [...AFTER, added]);
  assert.deepEqual(withAdded.added, ['the-new-constant']);
  assert.ok(
    rendered(withAdded.text).includes('the-new-constant'),
    'an added entry was named but not delivered, so nobody can obey it',
  );

  const withRemoved = renderCorrection(BEFORE, [UNCHANGED]);
  assert.deepEqual(withRemoved.removed, ['the-reversed-constant']);
  assert.equal(
    rendered(withRemoved.text).includes('the-reversed-constant'), false,
    'a withdrawn entry was re-rendered in full. What a withdrawal needs is its id and the fact ' +
    'that it no longer governs.',
  );
});

test('nothing changed means no correction at all', () => {
  const correction = renderCorrection(BEFORE, BEFORE);
  assert.equal(
    correction.text, '',
    'a correction was produced for a store that did not change. A block that says nothing ' +
    'teaches its reader to skip the block.',
  );
});

/* ══ 2. PHRASED AS SUPERSESSION, NAMING WHAT IT REPLACES ══════════════════ */

/**
 * The defect this guards against is named in `CLAUDE.md`'s own first section,
 * so the assertion is on the WORDING and not only on the ids: an update that
 * reads as an addition leaves the reader holding both statements and obeying
 * whichever they read first.
 */
test('every changed entry is named in a sentence that says it SUPERSEDES', () => {
  const { text } = renderCorrection(BEFORE, AFTER);
  const lines = text.split('\n').filter((line) => line.includes('the-reversed-constant'));
  assert.ok(lines.length > 0, 'the correction never names the entry it replaces');
  assert.ok(
    lines.some((line) => /supersed|replac|no longer in force/i.test(line)),
    `the entry is named in ${lines.length} line(s) and none of them says it supersedes what the ` +
    `session already holds:\n${lines.join('\n')}`,
  );
});

test('a withdrawal says the entry no longer governs, in the line that names it', () => {
  const { text } = renderCorrection(BEFORE, [UNCHANGED]);
  const lines = text.split('\n').filter((line) => line.includes('the-reversed-constant'));
  assert.ok(lines.length > 0, 'the withdrawal never names the entry');
  assert.ok(
    lines.some((line) => /no longer|withdraw|supersed/i.test(line)),
    `a withdrawn entry was named without being withdrawn:\n${lines.join('\n')}`,
  );
});

/**
 * **This assertion was rewritten after its own removal proof came back GREEN,
 * and the reason is worth keeping.**
 *
 * It used to read `assert.match(text, /REPLACE|SUPERSED/)` over the whole
 * block. Deleting the word "REPLACES" from the opening paragraph — the one
 * sentence whose job is to frame everything under it — left the test green,
 * because the *per-entry* heading further down still says "have been
 * REPLACED". A match against the whole document cannot tell the framing from
 * the detail, and the framing is the half that stops a reader treating the
 * block as an addition.
 *
 * So it is asserted against the OPENING PARAGRAPH specifically, which is the
 * thing a reader meets first and the thing that was actually being claimed.
 */
test('the correction says UP FRONT that it replaces what was delivered earlier', () => {
  const { text } = renderCorrection(BEFORE, AFTER);
  const [heading, preamble] = text.split('\n\n');
  assert.match(heading ?? '', /^## /, 'the correction does not open with a heading');
  assert.match(
    preamble ?? '', /^_\*\*CORRECTION/,
    'the paragraph under the heading is not the correction preamble',
  );
  assert.match(
    preamble ?? '', /REPLACES/,
    'the opening paragraph never says that what follows replaces the earlier delivery. An ' +
    'update that reads as an addition produces the defect CLAUDE.md opens with, and a reader ' +
    'who has been told that at the top reads every line under it correctly.',
  );
});

/* ══ 3. SESSION-SCOPE DOORS ONLY ══════════════════════════════════════════ */

test('a subagent gets no correction, at its own door', () => {
  assert.equal(
    correctionAtDoor('subagent-start', BEFORE, AFTER), '',
    'a subagent was sent a correction. It starts fresh and simply receives the new store ' +
    '(spec §12.3); a correction there is a paragraph about a delivery it never had.',
  );
  assert.equal(
    (SESSION_SCOPE_DOORS as readonly string[]).includes('subagent-start'), false,
    '`subagent-start` is listed as session-scope, so the exclusion above is a coincidence',
  );
});

test('what a subagent DOES get is the new store, whole', () => {
  const text = renderRules({ entries: AFTER, refused: [] }).text;
  assert.deepEqual(
    rendered(text).sort(), AFTER.map((e) => e.id).sort(),
    'a subagent\'s delivery is not the whole new store',
  );
  assert.match(
    text, /answer by number/,
    'the subagent\'s copy carries the superseded wording, so it did not get the new store',
  );
});

for (const door of ['session-start', 'compact-restore', 'manual'] as const) {
  test(`a ${door} door carries the correction`, () => {
    assert.ok(
      (SESSION_SCOPE_DOORS as readonly Door[]).includes(door),
      `${door} is not listed as session-scope`,
    );
    assert.notEqual(
      correctionAtDoor(door, BEFORE, AFTER), '',
      `${door} is a session-scope door and produced no correction`,
    );
  });
}
