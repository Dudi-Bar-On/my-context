// @basis TASK-take-the-lane-report-and-the-owner-s-own-words-as-automatic,
// INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when,
// TASK-find-out-what-else-in-a-transcript-is-worth-marking,
// STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **THE LANE REPORT, THE OWNER'S OWN WORDS, AND THE INJECTION BLOCK THAT MUST
 * NEVER BE MARKED AGAIN** — `TASK-take-the-lane-report-and-the-owner-s-own-
 * words-as-automatic`, owner rulings of 2026-09-15.
 *
 * ── THE ONE ASSERTION THAT WOULD HAVE CAUGHT THIS YEARS EARLIER ───────────
 *
 * The `ruling` grammar owned **377 of his 1,164 bookmarks — 32% — and marked
 * ZERO turns he typed**. 296 of the 377 were a lane's FIRST prose span, which
 * is THIS PLUGIN'S OWN SubagentStart injection block: it delivers every
 * governing item in full, so it carries every normative id there is, and
 * `classifyTurn` calls it a prompt. Fifty-five wore the identical label
 * `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none`.
 *
 * Nothing in the suite fed the pass a lane dispatch. The item names that gap
 * and names the repair: *"feed the pass a real lane dispatch carrying a
 * normative id and assert nothing is written"*. That is the first test below,
 * taken END TO END through `markAutomaticAnchors` rather than at the grammar —
 * `test/scripts/anchor-candidates.test.ts` holds the grammar half, and neither
 * alone would catch a probe reaching a byte the grammar refuses or a grammar
 * accepting a byte no probe offers.
 *
 * ── EVERY GREEN HERE PROVES A RED IS VISIBLE IN THE SAME RUN ──────────────
 *
 * A pass that marked nothing at all would satisfy "the dispatch is not marked".
 * So every refusal below stands beside a NEAR MISS that the same run must
 * accept, with exactly one property moved:
 *
 * | the refusal | the property that moves | what must be accepted |
 * |---|---|---|
 * | the lane dispatch is not marked | who the record says wrote it | his own turn IS a ruling |
 * | a short final answer is not a report | the length of the answer | the long one IS a report |
 * | a superseded report is taken back | which byte is the lane's last answer | the new byte IS marked |
 *
 * ── WHAT IS NOT PROVED HERE ───────────────────────────────────────────────
 *
 * That the Stop hook calls `markAnchorsOnTurn`. `test/core/anchor-per-turn.
 * test.ts` carries that question and its own answer to it; this file uses the
 * per-turn entry point directly, for the same reason that one does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  LANE_REPORT_FLOOR_CHARS, markAnchorsOnTurn, markAutomaticAnchors, rulingLabel,
} from '../../src/core/anchor-pass.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';

const SESSION = 'sess-anchor-report';
/** The lane whose last answer is long enough to be a report. */
const REPORTER = 'agent-report-one';
/** The lane whose last answer is a trailing acknowledgement. */
const BRIEF = 'agent-report-two';
/** The lane whose last answer is a table AND long enough to be a report. */
const TABULAR = 'agent-report-three';

const MISSION = 'general-purpose — close the anchor pass and report the counts';
const BRIEF_MISSION = 'general-purpose — watch the background build';
const TABULAR_MISSION = 'general-purpose — count what the grammar marks';

/**
 * A turn the harness attributes to a PERSON.
 *
 * `origin: { kind: 'human' }` is the whole of what makes this his, and it is
 * the harness's own column rather than anything this fixture invents:
 * `promptSource` rides along because the real records carry it, and nothing in
 * the grammar reads it.
 */
const heTyped = (body: string, at: string): unknown => ({
  type: 'user',
  message: { role: 'user', content: body },
  timestamp: at,
  origin: { kind: 'human' },
  promptSource: 'typed',
});

/** An assistant turn in the main session. It carries no `origin` at all. */
const answered = (body: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: at,
});

/** An assistant turn inside a LANE's transcript. */
const laneSaid = (body: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: at,
  isSidechain: true,
});

/**
 * **A REAL LANE DISPATCH — the block this plugin's own SubagentStart hook
 * prepends, carrying a normative id and the word `must`.**
 *
 * Every property that made the old grammar fire on it is present: the harness
 * files it as a `user` record, `classifyTurn` therefore calls it a `'prompt'`,
 * and the block is normative text so it speaks in the same words the new
 * grammar looks for. The ONE thing it does not have is an `origin` saying a
 * person produced it — because the hook is not a person.
 */
const dispatched = (at: string): unknown => ({
  type: 'user',
  message: {
    role: 'user',
    content: [{
      type: 'text',
      text: [
        '_This block was added by my_context, the knowledge plugin installed in this',
        'repository, when this subagent started._',
        '',
        '## my_context — these govern this project',
        '',
        '### RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none · rule',
        '',
        'A test declares what it rests on. `none` with a reason is a legal answer, and a',
        'test that names nothing and says nothing must be treated as untethered.',
        '',
        '### CONST-node-24-no-build-step · constraint',
        '',
        'Source is `.ts`. Every relative import must carry an explicit `.ts` extension.',
      ].join('\n'),
    }],
  },
  timestamp: at,
  isSidechain: true,
});

/** The sentence he typed. One line, and the line is what the label must be. */
const HIS_RULING = 'from now on the UI server must always be on 58888, never anywhere else';

/** A lane report: long enough to clear the floor, and holding no table. */
const REPORT_BODY = [
  'Done. The pass now reads the record rather than the classification.',
  '',
  ...Array.from({ length: 12 }, (_, i) =>
    `Point ${i + 1}: the detector was replaced rather than deleted, because the kind is `
    + 'the right name for the right thing and only the detection was wrong.'),
].join('\n');

/** A lane's trailing acknowledgement — the shape the floor exists to refuse. */
const ACK = 'that background command finished, no action needed';

/** A lane report whose body IS a table. Both grammars can see this turn. */
const TABULAR_REPORT = [
  '## What the pass counted',
  '',
  '| what | n |',
  '| --- | --- |',
  '| newly marked | 189 |',
  '| taken back | 377 |',
  '',
  ...Array.from({ length: 8 }, () =>
    'The net is negative, which is the point of the change rather than a side effect.'),
].join('\n');

interface Fixture { cwd: string; home: string; dir: string; dbPath: string }

const lines = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/** The main session's records, in order. Record 0 is his ruling. */
const TURNS = [
  heTyped(HIS_RULING, '2026-09-10T09:00:00.000Z'),
  // **THE SAME SENTENCE, ANSWERED.** An assistant quoting him back must not be
  // a ruling, and this project's assistants write `must` and `never` in nearly
  // every turn — so without this the grammar would mark most of the archive.
  answered(`understood — ${HIS_RULING}`, '2026-09-10T09:00:01.000Z'),
];

function laneFile(f: Fixture, agentId: string, records: unknown[], description: string): void {
  const laneDir = path.join(f.dir, SESSION, 'subagents');
  mkdirSync(laneDir, { recursive: true });
  writeFileSync(path.join(laneDir, `${agentId}.jsonl`), lines(records));
  writeFileSync(path.join(laneDir, `${agentId}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description, toolUseId: `toolu_${agentId}`, spawnDepth: 1,
  }));
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-report-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-report-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), lines(TURNS));
  const f: Fixture = { cwd, home, dir, dbPath: path.join(cwd, '.my_context', '.index.db') };

  laneFile(f, REPORTER, [
    dispatched('2026-09-10T09:01:00.000Z'),
    laneSaid('starting', '2026-09-10T09:01:01.000Z'),
    laneSaid(REPORT_BODY, '2026-09-10T09:01:02.000Z'),
  ], MISSION);
  laneFile(f, BRIEF, [
    dispatched('2026-09-10T09:02:00.000Z'),
    laneSaid(ACK, '2026-09-10T09:02:01.000Z'),
  ], BRIEF_MISSION);
  laneFile(f, TABULAR, [
    dispatched('2026-09-10T09:03:00.000Z'),
    laneSaid(TABULAR_REPORT, '2026-09-10T09:03:01.000Z'),
  ], TABULAR_MISSION);

  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    assert.equal(runCli(['conversation', 'rebuild'], cwd, () => {}), 0);
  } finally { process.chdir(previous); }
  return f;
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

interface Row { kind: string; label: string; agentId: string | null; byteOffset: number }

function rows(dbPath: string): Row[] {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.anchorRows(null).map((row) => ({
      kind: row.kind, label: row.label, agentId: row.agentId, byteOffset: row.byteOffset,
    }));
  } finally { index.close(); }
}

/** Where record `n` of a written transcript starts, in BYTES. */
function offsetOf(records: unknown[], n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(records[i]), 'utf8') + 1;
  return at;
}

/* ══ 1. THE REMOVAL PROOF THE ITEM ASKS FOR, END TO END ═══════════════════ */

test('the pass writes NOTHING at a lane dispatch carrying a normative id', () => {
  const f = fixture();
  try {
    const marks = rows(f.dbPath);

    // Three lanes, and every one of them opens with the same dispatch block.
    const dispatchByte = 0;
    const onDispatch = marks.filter(
      (row) => row.agentId !== null && row.byteOffset === dispatchByte,
    );
    assert.deepEqual(
      onDispatch, [],
      'THE DEFECT: 296 of the 377 `ruling` marks on his archive were exactly this byte — the '
      + "first prose span of a lane, which is this plugin's own injection block. It carries "
      + '`RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none` and the word `must`, '
      + 'and neither is a reason to bookmark it: nobody typed it.',
    );
    assert.equal(
      marks.some((row) => row.label.includes('RULE-a-test-names-the-items')), false,
      '55 of his marks wore that exact id as their label — an item this plugin injects into '
      + 'every lane. Not one may come back under any kind.',
    );

    // ── AND THE DETECTOR CAN SEE A RED IN THE SAME RUN ──────────────────
    // A pass that marked nothing would satisfy every line above. These are the
    // near misses, each differing from a refusal by ONE property.
    assert.deepEqual(
      marks.filter((row) => row.kind === 'ruling').map((row) => row.label),
      [HIS_RULING],
      'his own turn, on a record the archive attributes to a person, IS marked — and its '
      + 'label is the LINE he typed rather than a keyword',
    );
    assert.equal(
      marks.filter((row) => row.kind === 'report').length, 1,
      'and the one lane whose last answer clears the floor AND holds no table carries a report '
      + '— the tabular lane keeps its table mark, which is the precedence asserted below',
    );
  } finally { tidy(f); }
});

/* ══ 2. THE LANE REPORT, ITS LABEL AND ITS FLOOR ══════════════════════════ */

test('a lane report is marked at the lane\'s last answer and wears the lane\'s mission', () => {
  const f = fixture();
  try {
    const reports = rows(f.dbPath).filter((row) => row.kind === 'report');
    const mine = reports.find((row) => row.agentId === REPORTER);
    assert.equal(
      mine?.label, MISSION,
      "the label writes itself from `subagents.description` — the lane's own mission rather "
      + 'than a header cell, and it is present for 419 of 419 lanes on his archive',
    );
    // The byte is the LAST answer's, not the dispatch's. Asserted against the
    // index's own `MAX` rather than by recomputing the offset a second time —
    // a second computation of a position is a second thing to be wrong, which
    // is `anchorIdFor`'s whole argument one layer down.
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const span = index.laneLastAnswers([REPORTER]).get(REPORTER);
      assert.equal(mine?.byteOffset, span?.byteOffset);
      assert.notEqual(span?.byteOffset, 0, 'and it is not the dispatch, which is byte 0');
    } finally { index.close(); }
  } finally { tidy(f); }
});

test('a trailing acknowledgement is under the floor and is not a report', () => {
  const f = fixture();
  try {
    assert.ok(
      ACK.length < LANE_REPORT_FLOOR_CHARS && REPORT_BODY.length >= LANE_REPORT_FLOOR_CHARS,
      'the fixture must straddle the floor or neither half below means anything — this is the '
      + "guard against a proof whose FIXTURE carried its power, which `anchors/11`'s own "
      + 'measurement lost to a `\\b`-after-`%` bug',
    );
    const reports = rows(f.dbPath).filter((row) => row.kind === 'report');
    assert.equal(
      reports.some((row) => row.agentId === BRIEF), false,
      `a lane whose last answer is ${ACK.length} characters said "no action needed", not a `
      + 'report. 19 of 436 lanes on his archive end this way.',
    );
    // The near miss: same shape, one property moved — the length.
    assert.equal(reports.some((row) => row.agentId === REPORTER), true);
  } finally { tidy(f); }
});

test('a table in the final answer keeps the turn, and the report kind yields', () => {
  const f = fixture();
  try {
    const onTabular = rows(f.dbPath).filter((row) => row.agentId === TABULAR);
    assert.deepEqual(
      onTabular.map((row) => row.kind), ['table'],
      'THE PRECEDENCE, and it is a decision rather than an accident: 230 of his 419 lane '
      + 'reports already carry a table mark, and the worth of the report mark was judged 8/8 on '
      + 'a sample drawn from the 189 that carry NOTHING. Relabelling turns that already wear a '
      + 'judged-good mark is a change nobody measured.',
    );
    assert.equal(
      onTabular[0]?.label, 'What the pass counted — what | n',
      'and it keeps the TABLE\'s label — the nearest heading above it joined to its header '
      + 'cells, which is what `tableLabel` composes and is not the lane mission',
    );
    assert.equal(
      onTabular.length, 1,
      'one turn, one mark — the id is derived from the byte, so two kinds at one byte is not a '
      + 'state this store can even hold, and a test that expected two would be asserting a bug',
    );
  } finally { tidy(f); }
});

/* ══ 3. THE REPORT MOVES WHEN THE LANE SAYS MORE, AND THE PASS TAKES THE OLD
        ONE BACK ITSELF ═══════════════════════════════════════════════════ */

test('a lane that says more moves its report, and never carries two', () => {
  const f = fixture();
  try {
    const before = rows(f.dbPath).filter(
      (row) => row.kind === 'report' && row.agentId === REPORTER,
    );
    assert.equal(before.length, 1);

    // The lane says something LATER and longer. This is the churn the item
    // names: "a lane's FINAL answer is not knowable while the lane still runs".
    const transcript = path.join(f.dir, SESSION, 'subagents', `${REPORTER}.jsonl`);
    const later = `${REPORT_BODY}\n\nOne correction, after re-reading: the net is negative.`;
    appendFileSync(transcript, `${JSON.stringify(laneSaid(later, '2026-09-10T09:01:03.000Z'))}\n`);
    rebuildConversations(f.dbPath, process.env, f.cwd);

    // **THE PER-TURN PATH, NOT A REBUILD**, and that is the whole point of this
    // test: the sweep deliberately skips every row standing BEHIND the byte a
    // transcript was read from, so the superseded mark — which is always behind
    // the new one — is unreachable to it. If the take-back were left to the
    // sweep this assertion would find two reports on one lane.
    const turn = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(turn, null);
    assert.equal(turn?.did, 'marked');

    const after = rows(f.dbPath).filter(
      (row) => row.kind === 'report' && row.agentId === REPORTER,
    );
    assert.equal(
      after.length, 1,
      'EXACTLY ONE REPORT PER LANE. Two would mean a reader browsing a finished lane sees its '
      + 'report twice, at two different turns, one of which is not the report.',
    );
    assert.notEqual(
      after[0]?.byteOffset, before[0]?.byteOffset,
      'and it MOVED — a mark that stayed on the superseded answer would be pointing at a turn '
      + 'the lane has since corrected',
    );
    assert.equal(after[0]?.label, MISSION, 'the mission is the lane\'s, not the answer\'s');
    assert.ok(
      (turn?.anchors?.dropped ?? 0) >= 1,
      'and the take-back is COUNTED rather than silent — `INV-nothing-is-dropped-silently`',
    );
  } finally { tidy(f); }
});

/* ══ 4. THE PASS IS IDEMPOTENT IN BOTH DIRECTIONS ═════════════════════════ */

test('a second unscoped pass marks nothing, relabels nothing and takes nothing back', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      const second = markAutomaticAnchors(index);
      assert.deepEqual(
        { marked: second.marked, relabelled: second.relabelled, dropped: second.dropped },
        { marked: 0, relabelled: 0, dropped: 0 },
        'the rebuild in `fixture()` already ran this pass. A second run that wrote anything '
        + 'would mean the report source re-decides its own answer — which is the churn the item '
        + 'weighs, and it must cost nothing on a lane that has not moved.',
      );
      assert.ok(
        second.found > 0,
        'and the pass was AWAKE while it declined: a run that found nothing would satisfy '
        + 'every zero above without being idempotent at all',
      );
    } finally { index.close(); }
  } finally { tidy(f); }
});

/* ══ 5. THE RULING LABEL IS THE LINE, AND ONLY THE LINE ═══════════════════ */

test('a ruling is labelled with the line the word is on, not the word and not the turn', () => {
  const text = ['first line, ordinary', 'you must always use 58888', 'third line, also ordinary']
    .join('\n');
  const at = text.indexOf('must');
  assert.equal(
    rulingLabel(text, at, 'must'), 'you must always use 58888',
    'the line and nothing else — the line above and the line below are the removal proof, and '
    + 'a composer that returned the whole turn would fail on both',
  );
  assert.equal(
    rulingLabel('must', 0, 'must'), 'must',
    'a turn that is one word is its own line, and the label is never empty',
  );
  assert.equal(
    rulingLabel('\n', 0, 'must'), 'must',
    'AND A LINE THAT TRIMS TO NOTHING FALLS BACK TO THE WORD. Without this the label would be '
    + "the empty string, which is a row in his list with no name on it — the `|` defect of "
    + '2026-09-11 in a new place.',
  );
  const long = `x ${'y'.repeat(400)} must ${'z'.repeat(400)}`;
  assert.ok(
    rulingLabel(long, long.indexOf('must'), 'must').length <= 200,
    'and it is capped at `TABLE_LABEL_CAP`, so one enormous line cannot carry a label past the '
    + 'length the write routes would have refused',
  );
  assert.match(rulingLabel(long, long.indexOf('must'), 'must'), /…$/,
    'a capped label SAYS it was capped rather than simply stopping');
});
