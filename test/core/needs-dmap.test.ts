// @basis TASK-the-board-under-reports-what-has-shipped-and-the-path-to, REF-the-d-numbers-what-each-one-means-and-which-are-only, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **The D map, read as data — the pure half, exercised as plain function
 * calls.**
 *
 * Same discipline as `test/core/needs.test.ts` next door and for the same
 * reason: `parseDMap` and `dBoard` do no I/O, so a fixture workspace would
 * only add a way for these cases to fail for a reason that is not about the
 * map.
 *
 * ── WHAT EACH ASSERTION HERE IS GUARDING ───────────────────────────────────
 *
 * The defect this replaces is a REGEX OVER PROSE that got two rows wrong on
 * 2026-09-16 — `D78` read CLOSED because its text quotes D57's closure, `D57`
 * read 0/3 because it matched that day's `anchors/` items by name. The repair
 * is only worth anything if a row that does not parse FAILS LOUDLY, so most of
 * what follows is about the failure paths rather than the happy one.
 *
 * **The block is DELIMITED and nothing outside it is read.** That is asserted
 * with prose that looks exactly like a row, because the register's own text
 * above the block is full of `D66  a failure the code never looks at` lines: a
 * parser that scanned the whole body would find seventy-eight of them in the
 * argument and build a second, wrong map out of the sentence explaining the
 * first.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveConfig } from '../../src/core/config.ts';
import {
  D_MAP_CLOSE, D_MAP_OPEN, D_STATUSES, dBoard, parseDMap,
} from '../../src/core/needs.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work, tracked to completion.',
      extraFields: ['plan', 'seq', 'state', 'priority', 'needs'],
    },
  },
});

function task(plan: string, seq: string, state: string, extra: Record<string, string> = {}): Item {
  return {
    id: `TASK-${plan}-${seq}`,
    type: 'task',
    title: `${plan}/${seq}`,
    status: 'active',
    severity: 'soft',
    always: false,
    summary: '',
    summaryOf: null,
    scope: [],
    tags: [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: '2026-09-16',
    validUntil: null,
    checksum: '0',
    body: '',
    relations: [],
    extra: { plan, seq, state, ...extra },
  } as unknown as Item;
}

/** A body with a block in it, plus prose above that LOOKS like rows. */
function body(rows: string[]): string {
  return [
    'RATIFIED — the owner has used these numbers himself.',
    '  D66     a failure the code never looks at   plan:swallow seq:1-12',
    '  D72     the read model blocks the whole server   plan:readmodel seq:1-4   OPEN',
    '',
    D_MAP_OPEN,
    ...rows,
    D_MAP_CLOSE,
    '',
    'THE ORDER AFTER D37, RULED BY THE OWNER: D38, then D33, then D36.',
  ].join('\n');
}

// ─── 0. The block is found, and ONLY the block is read ─────────────────────

test('the rows come from between the sentinels and from nowhere else', () => {
  const reading = parseDMap(body(['D66 | open | swallow/*']));
  assert.equal(reading.found, true);
  assert.deepEqual(reading.defects, []);
  assert.deepEqual(reading.rows.map((r) => r.d), ['66']);
});

/**
 * The pair for the test above, and the one that makes it worth anything: the
 * prose the fixture carries is REAL register text, and a parser that read the
 * whole body would build rows out of it.
 */
test('prose above the block that looks exactly like a row is not a row', () => {
  const text = body(['D66 | open | swallow/*']);
  assert.ok(text.includes('D72     the read model blocks'), 'the fixture lost its decoy prose');
  const reading = parseDMap(text);
  assert.deepEqual(
    reading.rows.map((r) => r.d), ['66'],
    'a line in the argument was read as a row — which is the regex-over-prose defect the block '
    + 'exists to replace, rebuilt by the thing replacing it',
  );
});

test('no block at all is FOUND=false, which is not an empty map', () => {
  const reading = parseDMap('nothing here but prose\nD66 | open | swallow/*');
  assert.equal(reading.found, false, 'a row outside the sentinels made the map look present');
  assert.deepEqual(reading.rows, []);
});

test('an opening sentinel with no close is not a block', () => {
  const reading = parseDMap(`${D_MAP_OPEN}\nD66 | open | swallow/*\n`);
  assert.equal(reading.found, false);
});

// ─── 1. Every line inside parses, or it is NAMED ───────────────────────────

test('a line inside the block that is not a row is a defect carrying its line', () => {
  const reading = parseDMap(body(['D66 | open | swallow/*', 'D72 open readmodel/*']));
  assert.deepEqual(reading.rows.map((r) => r.d), ['66']);
  assert.equal(reading.defects.length, 1);
  assert.match(reading.defects[0]!.why, /three cells/);
  assert.equal(reading.defects[0]!.text, 'D72 open readmodel/*');
  assert.ok(reading.defects[0]!.line > 0, 'the defect carries no line, so nobody can find it');
});

test('blank lines inside the block are skipped and nothing else is', () => {
  const reading = parseDMap(body(['D66 | open | swallow/*', '', '   ', 'D72 | open | readmodel/*']));
  assert.deepEqual(reading.defects, []);
  assert.deepEqual(reading.rows.map((r) => r.d), ['66', '72']);
});

test('a status word outside the five is a defect that names the five', () => {
  const reading = parseDMap(body(['D66 | finished | swallow/*']));
  assert.deepEqual(reading.rows, []);
  assert.equal(reading.defects.length, 1);
  for (const status of D_STATUSES) {
    assert.match(
      reading.defects[0]!.why, new RegExp(status),
      `the refusal does not name "${status}", so a reader has to guess the vocabulary`,
    );
  }
});

test('a member that is neither plan/*, plan/seq nor an item id is a defect', () => {
  const reading = parseDMap(body(['D66 | open | swallow/1/2']));
  assert.deepEqual(reading.rows, []);
  assert.match(reading.defects[0]!.why, /not plan\/\*, plan\/seq or an item id/);
});

/**
 * **A RANGE is not caught by the SHAPE, and it must not be.** `swallow/1-12` is
 * how the register's prose writes a whole plan, and `-` is legal in a seq —
 * `1s-a`, `13c2` and `10p` are real addresses in this corpus, which is why
 * `REF_SHAPE` admits it for `needs` too. So a range transcribed straight out of
 * the prose PARSES, and is caught one layer down by resolution, where the
 * message can say the useful thing.
 *
 * This is the transcription mistake most likely to be made when the map is
 * extended, so which layer catches it is asserted rather than assumed: the
 * failure is loud either way, and the layer decides what the reader is told.
 */
test('a range copied out of the prose parses and is caught as UNRESOLVED', () => {
  const reading = parseDMap(body(['D66 | open | swallow/1-12']));
  assert.deepEqual(reading.defects, [], 'the shape rule rejected a legal seq spelling');
  const board = dBoard(reading, CORPUS, CONFIG);
  assert.equal(board.unresolved.length, 1);
  assert.equal(board.unresolved[0]!.member, 'swallow/1-12');
  assert.match(board.unresolved[0]!.why, /answers to that address/);
});

test('a repeated D number is a defect that names the line the first one is on', () => {
  const reading = parseDMap(body(['D66 | open | swallow/*', 'D66 | closed | gates/*']));
  assert.deepEqual(reading.rows.map((r) => r.d), ['66']);
  assert.match(reading.defects[0]!.why, /already a row at line \d+/);
});

test('the number keeps the register\'s own spelling, suffix and all', () => {
  const reading = parseDMap(body(['D13a/b | open | library/1']));
  assert.deepEqual(reading.defects, []);
  assert.deepEqual(reading.rows.map((r) => r.d), ['13a/b']);
});

test('a row with no members parses and claims nothing', () => {
  const reading = parseDMap(body(['D1 | not-filed | -']));
  assert.deepEqual(reading.defects, []);
  assert.deepEqual(reading.rows[0]!.members, []);
});

// ─── 2. Resolution against a corpus ────────────────────────────────────────

const CORPUS: Item[] = [
  task('swallow', '1', 'done'),
  task('swallow', '2', 'todo'),
  task('swallow', '3', 'blocked', { needs: 'swallow/2' }),
  task('walk', '140', 'done'),
  task('walk', '141', 'todo'),
];

test('plan/* takes every item in the plan, including ones added after the row was written', () => {
  const board = dBoard(parseDMap(body(['D66 | open | swallow/*'])), CORPUS, CONFIG);
  assert.deepEqual(board.unresolved, []);
  assert.equal(board.subjects[0]!.items.length, 3);
  assert.equal(board.subjects[0]!.done, 1);
});

/**
 * The removal proof for the line above, and it is the reason `plan/*` exists
 * at all: `D78` was minted over `plan:anchors seq:1-12` and the plan held
 * thirteen items two days later. A row written as addresses silently stops
 * covering its own subject; a row written as a plan cannot.
 */
test('a plan that GROWS is still wholly claimed, where an address list would not be', () => {
  const grown = [...CORPUS, task('swallow', '4', 'todo')];
  const whole = dBoard(parseDMap(body(['D66 | open | swallow/*'])), grown, CONFIG);
  const listed = dBoard(
    parseDMap(body(['D66 | open | swallow/1, swallow/2, swallow/3'])), grown, CONFIG,
  );
  assert.equal(whole.subjects[0]!.items.length, 4);
  assert.equal(listed.subjects[0]!.items.length, 3);
  assert.ok(
    listed.orphans.map((i) => i.id).includes('TASK-swallow-4'),
    'the new item fell outside every subject and the report did not say so',
  );
  assert.ok(
    !whole.orphans.map((i) => i.id).includes('TASK-swallow-4'),
    'plan/* did not pick up the item added after the row was written, which is the whole reason '
    + 'that spelling exists',
  );
});

test('a plan nothing carries is UNRESOLVED and names its row and line', () => {
  const board = dBoard(parseDMap(body(['D66 | open | nosuchplan/*'])), CORPUS, CONFIG);
  assert.equal(board.unresolved.length, 1);
  assert.equal(board.unresolved[0]!.d, '66');
  assert.equal(board.unresolved[0]!.member, 'nosuchplan/*');
  assert.ok(board.unresolved[0]!.line > 0);
});

test('an address nothing answers to is UNRESOLVED, and says so in different words', () => {
  const board = dBoard(parseDMap(body(['D31 | open | walk/999'])), CORPUS, CONFIG);
  assert.equal(board.unresolved.length, 1);
  assert.match(board.unresolved[0]!.why, /answers to that address/);
});

test('an item id member resolves and contributes NO work items — the D57 case', () => {
  const requirement = { ...task('x', 'y', ''), id: 'REQ-every-anchor-capability', type: 'requirement' } as Item;
  const board = dBoard(
    parseDMap(body(['D57 | closed | REQ-every-anchor-capability'])),
    [...CORPUS, requirement], CONFIG,
  );
  assert.deepEqual(board.unresolved, [], 'the requirement did not resolve');
  assert.equal(
    board.subjects[0]!.items.length, 0,
    'a requirement declares no state, so counting it would make a finished subject read 0 of 1 '
    + 'for ever — which is exactly why D57 closed on the map and not on its item',
  );
});

test('an item id nothing answers to is unresolved', () => {
  const board = dBoard(parseDMap(body(['D57 | closed | REQ-nothing-answers-to-this'])), CORPUS, CONFIG);
  assert.equal(board.unresolved.length, 1);
  assert.match(board.unresolved[0]!.why, /no item has that id/);
});

// ─── 3. One item under two subjects ────────────────────────────────────────

test('an item claimed by two rows is reported with BOTH numbers', () => {
  const board = dBoard(
    parseDMap(body(['D66 | open | swallow/*', 'D70 | open | swallow/2'])), CORPUS, CONFIG,
  );
  assert.equal(board.doubleClaimed.length, 1);
  assert.deepEqual(board.doubleClaimed[0]!.ds, ['66', '70']);
  assert.equal(board.doubleClaimed[0]!.key, 'swallow/2');
});

/**
 * The control for the assertion above: the SAME item named twice by ONE row is
 * not a double claim, and a check that could not tell those apart would redden
 * on `plan/*` plus a belt-and-braces address in the same row — which is a
 * thing a person writing a map does.
 */
test('one row naming an item twice is not two subjects claiming it', () => {
  const board = dBoard(
    parseDMap(body(['D66 | open | swallow/*, swallow/2'])), CORPUS, CONFIG,
  );
  assert.deepEqual(board.doubleClaimed, []);
  assert.equal(board.subjects[0]!.items.length, 3, 'the item was counted twice');
});

// ─── 4. Ready and held are DISTRIBUTED, never re-decided ───────────────────

/**
 * `swallow/3` is `blocked` on `swallow/2`, which is `todo`. `readyReport` puts
 * it in `held`; this asserts the subject sees the same answer rather than a
 * second opinion. Two readings of "what can be started" that can disagree is
 * the defect `core/needs.ts`'s own header is about.
 */
test('a subject\'s ready and held rows are the ones readyReport already decided', () => {
  const board = dBoard(parseDMap(body(['D66 | open | swallow/*'])), CORPUS, CONFIG);
  const subject = board.subjects[0]!;
  assert.deepEqual(subject.ready.map((r) => r.item.id), ['TASK-swallow-2']);
  assert.deepEqual(subject.held.map((r) => r.item.id), ['TASK-swallow-3']);
  assert.equal(subject.held[0]!.reason, 'pending');
  assert.equal(
    subject.ready.length + subject.held.length + subject.done, subject.items.length,
    'the three buckets do not add up to the subject, so some item is drawn nowhere',
  );
});

test('open work no row claims is an ORPHAN, and a done one is not', () => {
  const board = dBoard(parseDMap(body(['D66 | open | swallow/*'])), CORPUS, CONFIG);
  assert.deepEqual(
    board.orphans.map((i) => i.id), ['TASK-walk-141'],
    'walk/140 is done and must not be offered as unclaimed work; walk/141 is open and must be',
  );
});
