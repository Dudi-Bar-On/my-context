// @basis TASK-a-user-who-installs-mycontext-mid-project-has-conversations,
// INV-nothing-is-dropped-silently
/**
 * **THE FIRST AUTOMATIC PASS IN A WORKSPACE, WHICH IS THE ONE NOBODY HAS SEEN
 * THE SIZE OF.**
 *
 * `TASK-a-user-who-installs-mycontext-mid-project-has-conversations`, owner
 * request 2026-09-16: *"i want to add a capability that will backfill a
 * conversation with anchores as we did … it is intended for a user that
 * installs mycontext at the middle of development so it's conversation was
 * created before mycontext was installed."*
 *
 * ── WHAT WAS ACTUALLY MISSING, BECAUSE IT WAS NOT THE GRAMMAR ─────────────
 *
 * `mycontext conversation rebuild` already ran the pass unscoped over every
 * archived conversation and it already worked. Measured 2026-09-16 on a
 * DIFFERENT real Claude Code project on this machine — 13,375 prose spans, 575
 * lanes, 726 turns the person typed — with the grammar exactly as it stands
 * and not one line changed for the occasion:
 *
 * | kind | marks | per 1,000 turns | share |
 * |---|---|---|---|
 * | table | 907 | 67.8 | 74.8% |
 * | report | 275 | 20.6 | 22.7% |
 * | ruling | 31 | 2.3 | 2.6% |
 * | **all three** | **1,213** | **90.7** | |
 *
 * All three transferred. What did not transfer is the EXPERIENCE: 1,213
 * bookmarks appeared in one command, and `anchors/9` measured that 1,155 over
 * thirteen days was already enough to make the rare kinds hard to find. So
 * what this file holds is not a fourth grammar. It is three properties of the
 * first run:
 *
 *   1. it SAYS what it is about to do, per kind, before it does it;
 *   2. a plan writes NOTHING — not a row, not a byte of `.anchors.jsonl`;
 *   3. it is UNDOABLE in one act, and the undo never reads a mark he made.
 *
 * ── THE FIXTURE CARRIES NO ANCHORS, DELIBERATELY ──────────────────────────
 *
 * Every anchor asserted here is one the PASS found in transcript text this
 * file wrote as a conversation. Nothing seeds the `anchors` table except the
 * one owner row in the undo test, which exists precisely to be the row the
 * undo must NOT take. A spec that planted the kinds it then counted would be
 * measuring its own fixture — the mistake this project found in a baseline
 * harness on 2026-09-15 — and every count below would be a restatement of a
 * literal twenty lines above it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { markAnchor } from '../../src/core/anchors.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'bbbbbbbb-1111-2222-3333-555555555555';
const LANE = 'agent-backfill-lane-1';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';

/**
 * One transcript record as the harness writes one. `origin: { kind: 'human' }`
 * is the column the `ruling` grammar reads — `ownerTyped` in
 * `core/anchor-pass.ts` carries the measurement — so a fixture without it is a
 * fixture in which nobody typed anything.
 */
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
  ...(role === 'user' ? { origin: { kind: 'human' }, promptSource: 'typed' } : {}),
});

/** Where record `n` of a transcript starts, in BYTES. */
function offsetOf(rows: unknown[], n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(rows[i]), 'utf8') + 1;
  return at;
}

const TABLE = [
  'What the two tokenizers found.',
  '',
  '| tokenizer | hits |',
  '| --- | --- |',
  '| trigram | 14 |',
].join('\n');

/**
 * **A LANE ANSWER OVER `LANE_REPORT_FLOOR_CHARS`, AND IT CARRIES NO TABLE.**
 *
 * Both halves matter. Under 400 characters the `report` grammar refuses it and
 * this file would be asserting two kinds while claiming three; with a table in
 * it the TABLE wins the precedence in `anchorInTurn` and the mark would come
 * back as the wrong kind — which is the house style this project measured, 230
 * of its own 419 lane reports already wearing a `table` mark.
 */
const LANE_ANSWER = `${'I read the whole surface and this is what I found. '.repeat(9)}Nothing `
  + 'else moved.';

/**
 * The conversation this file is about: one table, one ruling he typed, and
 * prose that is neither. The three kinds are produced by CONTENT, never by a
 * seeded row.
 */
const TURNS = [
  say('user', 'from now on the archive must say what it is about to do before it does it',
    '2026-09-16T10:00:00.000Z'),
  say('assistant', TABLE, '2026-09-16T10:00:01.000Z'),
  say('assistant', 'nothing here is an anchor by nature, it is only prose about the weather',
    '2026-09-16T10:00:02.000Z'),
  say('user', 'שלום, כאן אין כלל מילת פסיקה', '2026-09-16T10:00:03.000Z'),
];

interface Fixture {
  cwd: string;
  dbPath: string;
  out: string[];
  run: (args: string[]) => number;
  drawn: () => string;
  clear: () => void;
  /** The conversation carries on: more turns, appended as the harness appends. */
  append: (rows: unknown[]) => void;
  anchorFile: string;
  /** Every anchor row in the index, as `(origin, kind)` pairs. */
  rows: () => { id: string; origin: string; kind: string }[];
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-backfill-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-backfill-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(TURNS));

  // The lane, written BEFORE the first scan: a mid-project installer's archive
  // already holds its lanes, and a fixture that added them afterwards would be
  // testing an incremental run, which is the run this file is not about.
  const under = path.join(dir, SESSION, 'subagents');
  mkdirSync(under, { recursive: true });
  writeFileSync(path.join(under, `${LANE}.jsonl`), jsonl([
    say('assistant', LANE_ANSWER, '2026-09-16T10:01:00.000Z'),
  ]));
  writeFileSync(path.join(under, `${LANE}.meta.json`), JSON.stringify({
    agentType: 'general-purpose', description: 'the backfill lane',
    toolUseId: 'toolu_backfill_lane', spawnDepth: 1,
  }));

  runCli(['init'], cwd, () => {});
  const ws = resolveWorkspace(cwd);
  const env = { ...process.env, CLAUDE_CONFIG_DIR: home };
  rebuildConversations(ws.dbPath, env, cwd, {});

  const priorHome = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;

  const out: string[] = [];
  return {
    cwd,
    dbPath: ws.dbPath,
    out,
    anchorFile: path.join(cwd, '.my_context', '.anchors.jsonl'),
    run: (args) => runCli(args, cwd, (line: string) => out.push(line)),
    drawn: () => out.join('\n'),
    clear: () => { out.length = 0; },
    append: (rows) => { appendFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(rows)); },
    rows: () => {
      const index = ConversationIndex.open(ws.dbPath);
      try {
        return index.anchorRows(null).map((r) => ({ id: r.id, origin: r.origin, kind: r.kind }));
      } finally {
        index.close();
      }
    },
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** The `anchors` object of a `--json` rebuild. */
function jsonRebuild(f: Fixture, args: string[]): Record<string, never> & {
  anchors: {
    marked: number; found: number; dropped: number; planned: boolean;
    byKind: Record<string, number>; samples: { kind: string; label: string }[];
  };
  plan: { marked: number; planned: boolean } | null;
} {
  f.clear();
  assert.equal(f.run(['conversation', 'rebuild', ...args, '--json']), 0, f.drawn());
  return JSON.parse(f.drawn());
}

/**
 * **A PLAN IS A RUN WITH THE WRITES TAKEN OUT, AND THE PROOF IS THAT NOTHING
 * MOVED — not a row and not a byte.**
 *
 * FINDING (green): over a fixture the pass marks three points in, `rebuild
 * --plan` reports all three with their kinds and leaves the `anchors` table
 * empty and `.anchors.jsonl` exactly as it found it.
 *
 * **BORROWED POWER, disclosed:** the three counted here are found by the
 * grammar this file does not test — `tableIn`, `ownerTyped`, `laneReportAt`,
 * each held from both ends in `test/cli/anchors.test.ts` and
 * `test/core/anchor-kinds.test.ts`. What this asserts is that the PLAN sees
 * exactly what the RUN sees and writes none of it. The lower bound of three is
 * asserted rather than assumed, so a fixture that stopped producing marks
 * would redden here instead of passing as a vacuous "wrote nothing".
 */
test('a plan says what the pass would mark and writes nothing at all', () => {
  const f = fixture();
  try {
    const answer = jsonRebuild(f, ['--plan']);
    const plan = answer.anchors;

    assert.equal(plan.planned, true, 'a plan says so in the report, not only in the prose');
    assert.equal(plan.marked, 3,
      'the fixture holds a table, a ruling he typed and a lane report over the floor — a plan '
      + 'that found fewer is a plan that cannot see what the run sees, and this assertion is '
      + 'what keeps "wrote nothing" from passing vacuously');
    assert.deepEqual(plan.byKind, { table: 1, ruling: 1, report: 1 },
      'the count is PER KIND, because that is the disclosure a reader refuses on — a total of '
      + '1,213 measured on a foreign archive is a number nobody can judge');
    assert.equal(plan.byKind['table'] + plan.byKind['ruling'] + plan.byKind['report'],
      plan.marked, 'the split adds up to the total it splits');
    assert.equal(plan.samples.length, 3,
      'and it carries a label of each, so a reader judges the grammar rather than the number');

    assert.deepEqual(f.rows(), [],
      'NOT ONE ROW. This is the whole of the plan\'s guarantee: the pass ran its probes, its '
      + 'owner-prompt query, its lane query, its grammar and its sweep, and the index is '
      + 'exactly as empty as it was.');

    // **THE DOCUMENT IS COMPARED ACROSS A SECOND PLAN, NOT ACROSS THE FIRST.**
    // `mycontext conversation rebuild` reconciles the anchors file before
    // anything else touches it, and on a workspace that has never had one that
    // ADOPTS — it creates the empty document. That write belongs to the
    // rebuild and predates this item; measuring from before it would blame the
    // plan for it, which is the opposite of a proof.
    const before = readFileSync(f.anchorFile, 'utf8');
    // **THE STAMP AS WELL AS THE BYTES, and the stamp is the half that
    // catches this.** `anchorTransaction` closes by rewriting the document
    // from the table, so a plan that entered one over an unchanged table would
    // produce a file with IDENTICAL CONTENT — invisible to a content
    // comparison, and still a write of the one file this project treats as the
    // truth. Measured: the removal "the plan is wrapped in anchorTransaction
    // after all" passed a content-only assertion and reddens this one.
    const stamp = statSync(f.anchorFile).mtimeMs;
    jsonRebuild(f, ['--plan']);
    assert.equal(readFileSync(f.anchorFile, 'utf8'), before,
      'a plan leaves the anchors DOCUMENT byte-identical');
    assert.equal(statSync(f.anchorFile).mtimeMs, stamp,
      'and leaves it UNWRITTEN — same content is not the same as not written, and the write '
      + 'path is what a plan may not take');
    assert.deepEqual(f.rows(), [], 'and the table is still empty after the second plan');

    // **AND THE PROSE SAYS IT TOO**, because a report shaped like a run's is
    // how a reader comes to believe a plan marked something. The sentence the
    // accepted run prints — "N new anchor(s) were marked for you" — must not
    // appear over a run that wrote nothing.
    f.clear();
    assert.equal(f.run(['conversation', 'rebuild', '--plan']), 0, f.drawn());
    assert.match(f.drawn(), /nothing was marked\. 3 point\(s\) WOULD be/, f.drawn());
    assert.doesNotMatch(f.drawn(), /new anchor\(s\) were marked for you/, f.drawn());

    // **AND THE COMPARISON ABOVE CAN SEE A WRITE**, proved in this same run
    // rather than assumed. Without this the two assertions would also pass
    // against a document nothing on earth could change.
    jsonRebuild(f, []);
    assert.notEqual(readFileSync(f.anchorFile, 'utf8'), before,
      'the accepted run DOES move the document — so "byte-identical" above is a measurement '
      + 'and not a property of the file being unwritable');
    assert.notEqual(statSync(f.anchorFile).mtimeMs, stamp,
      'and it moves the stamp, so the stamp comparison above can see a write when there is one');
    assert.equal(f.rows().filter((r) => r.origin === 'automatic').length, plan.marked,
      'and it marks exactly what the plan said it would');
  } finally {
    f.dispose();
  }
});

/**
 * **THE FIRST RUN ANNOUNCES ITSELF, AND THE ANNOUNCEMENT IS THE PLAN'S OWN
 * NUMBERS.**
 *
 * FINDING (green): a rebuild in a workspace where the automatic pass owns
 * nothing prints the per-kind count and a label of each BEFORE the line that
 * says what was marked, and the numbers it printed are the numbers that landed.
 *
 * The ordering is asserted rather than the presence, and that is the point:
 * *"A first run over a long history is not a thing to start silently"* is a
 * claim about WHEN the reader is told, and a disclosure after the write is the
 * thing the item calls silent.
 */
test('the first run says what it is about to do, per kind, before it marks', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    const drawn = f.drawn();

    const announced = drawn.indexOf('first automatic pass in this workspace');
    const marked = drawn.indexOf('new anchor(s) were marked for you');
    assert.notEqual(announced, -1, 'the first run says that it is the first run');
    assert.notEqual(marked, -1, 'and it did mark, so both halves are present to be ordered');
    assert.ok(announced < marked,
      'the count comes BEFORE the write is reported, which is the whole requirement');

    assert.match(drawn, /1 {2}table/, 'the table count, per kind');
    assert.match(drawn, /1 {2}report/, 'the lane report count, per kind');
    assert.match(drawn, /1 {2}ruling/, 'the ruling count, per kind');
    assert.match(drawn, /taken back|can be taken back/,
      'and the undo is offered in the same breath as the marks, because a bulk act a reader '
      + 'cannot unmake is not one they can accept');

    assert.equal(f.rows().filter((r) => r.origin === 'automatic').length, 3,
      'and the three it announced are the three that landed');
  } finally {
    f.dispose();
  }
});

/**
 * **AND IT IS THE FIRST RUN ONLY — WHICH IS NOT THE SAME AS "A RUN THAT MARKS
 * NOTHING NEW".**
 *
 * FINDING (green): after the first run is announced, a LATER rebuild that
 * finds a brand-new point marks it and says nothing about a first run.
 *
 * ── WHY THE LATER RUN HAS TO FIND SOMETHING ───────────────────────────────
 *
 * A second rebuild over an unchanged archive marks nothing, so a test built on
 * one would pass whatever the condition was — the removal `every rebuild is
 * treated as a first run` passed exactly that shape of assertion, because a
 * plan of zero marks announces nothing either way. The conversation therefore
 * CARRIES ON here, exactly as a real one does: two more turns are appended and
 * one of them is a table.
 *
 * Without the first-run condition this disclosure would land on every rebuild
 * that found anything — and the Stop hook rebuilds every turn. A notice a
 * reader sees on every turn is one they stop reading, which is the failure
 * `anchors/11` measured for the marks themselves.
 */
test('a later rebuild marks what it finds without announcing or asking', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    assert.match(f.drawn(), /first automatic pass/, 'the first run was announced');
    f.clear();

    f.append([
      say('assistant', ['A later answer.', '', '| lane | verdict |', '| --- | --- |',
        '| the second | green |'].join('\n'), '2026-09-16T12:00:00.000Z'),
    ]);
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());

    assert.match(f.drawn(), /1 new anchor\(s\) were marked/,
      'the later run found the new table and marked it');
    assert.doesNotMatch(f.drawn(), /first automatic pass/,
      'and said nothing about a first run — the pass owns rows now, so every run from here is '
      + 'incremental, and a disclosure on each would be one nobody reads');
    assert.equal(f.rows().filter((r) => r.origin === 'automatic').length, 4, f.drawn());
  } finally {
    f.dispose();
  }
});

/**
 * **THE BULK UNDO, AND THE ONE ROW IT MAY NOT TOUCH.**
 *
 * FINDING (green): `conversation anchor --drop-automatic --count <n>` takes back
 * every mark the pass made and leaves the one the owner made by hand, and the
 * next rebuild re-derives all three — so the undo destroys nothing that is not
 * re-derivable.
 *
 * **The owner row is seeded here and NOWHERE else in this file**, because it
 * is the control rather than the measurement: the three automatic rows are
 * found by the pass, and this one exists so that "never reads an `origin:
 * owner` row" has something to be false about.
 */
test('the bulk undo takes back every mark made for you and not one you made', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    assert.equal(f.rows().filter((r) => r.origin === 'automatic').length, 3, f.drawn());

    // His own bookmark, at a byte the grammar says nothing about — the prose
    // turn — so it can only survive by being HIS, never by being recognised.
    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, {
        sessionId: SESSION,
        agentId: null,
        byteOffset: offsetOf(TURNS, 2),
        label: 'a bookmark he made himself',
        kind: 'question',
        origin: 'owner',
        at: '2026-09-16T11:00:00.000Z',
        note: null,
      });
    } finally {
      index.close();
    }
    assert.equal(f.rows().length, 4, 'three made for him and one he made');

    f.clear();
    assert.equal(
      f.run(['conversation', 'anchor', '--drop-automatic', '--count', '3']), 0, f.drawn());
    assert.match(f.drawn(), /took back 3 mark\(s\)/, f.drawn());

    const left = f.rows();
    assert.equal(left.length, 1, 'exactly one bookmark is left');
    assert.equal(left[0]?.origin, 'owner',
      'and it is HIS. An undo that took his bookmarks with it would be a far worse defect than '
      + 'the bulk it was written to undo.');

    f.clear();
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    assert.equal(f.rows().filter((r) => r.origin === 'automatic').length, 3,
      'and the three come back from the same grammar over the same bytes — which is what makes '
      + 'the undo safe to offer: nothing it removes is a thing that cannot be re-derived');
  } finally {
    f.dispose();
  }
});

/**
 * **A BULK DELETE COUNTS FIRST, AND THE COUNT IS THE CONSENT.**
 *
 * FINDING (green): `--drop-automatic` with no `--count` exits 1, removes
 * nothing, and prints the exact line to rerun; a `--count` that disagrees with
 * what is standing is refused with both numbers.
 *
 * This is the opposite decision from the first RUN one command along, and the
 * difference is what each act costs: the run writes rows that are derived and
 * reversible, while this one deletes. It is `mycontext ack --all`'s idiom for
 * its own stated reason — *"a number cannot be typed by accident"* — and it
 * answers the same way from a terminal and from a script, which a `--yes`
 * behind a TTY check does not.
 */
test('the bulk undo refuses until it is given the count it just printed', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    const before = f.rows().length;
    f.clear();

    assert.equal(f.run(['conversation', 'anchor', '--drop-automatic']), 1, f.drawn());
    assert.match(f.drawn(), /asks for the number as the consent/, f.drawn());
    assert.match(f.drawn(), /--drop-automatic --count 3/,
      'and the refusal states its unblocking condition, with the number already in it');
    assert.equal(f.rows().length, before, 'and nothing was taken back');

    f.clear();
    assert.equal(f.run(['conversation', 'anchor', '--drop-automatic', '--count', '2']), 1,
      f.drawn());
    assert.match(f.drawn(), /--count says 2 and there are 3/,
      'a number that does not match is a reader who was looking at a different set');
    assert.equal(f.rows().length, before, 'and that took nothing back either');
  } finally {
    f.dispose();
  }
});
