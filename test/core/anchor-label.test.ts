// @basis TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none,
// INV-nothing-is-dropped-silently
/**
 * **WHAT A TABLE BOOKMARK IS CALLED** — the grammar half of
 * `TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a`, owner
 * ruling 2026-09-15, option 1b plus the clarification he gave when asked:
 * *the label carries the HEADER CELLS PLUS THE NEAREST HEADING ABOVE THE
 * TABLE*.
 *
 * ── THE DEFECT THESE REST ON, MEASURED ON HIS OWN CORPUS ──────────────────
 *
 * 2026-09-15, 750 anchors in `.my_context/.anchors.jsonl`: 376 are tables and
 * every one of them was named after ONE header cell, because `tableLabel` was
 * `header.find(isReadable)`. 27 were called `"lane"`, 13 `"before"`, 11
 * `"id"`, 9 `"D"`. A bookmark that cannot be told from twenty-six others is
 * not a bookmark.
 *
 * ── WHY THE HEADING IS HALF THE ANSWER, ALSO MEASURED ─────────────────────
 *
 * Over those same 376 tables, read at their own bytes out of the real
 * transcripts: **285 have a heading within reach above them** (242 ATX, 43
 * more that are bold captions), sitting 2 lines up at the median and 20 at the
 * furthest. They are the part a person recognises — `Removal proofs`,
 * `Wave 1 results`, `The 21, triaged` — and they were being thrown away.
 *
 * ── WHAT IS PROVED HERE, AND WHAT IS NOT ──────────────────────────────────
 *
 * PROVED, each by an assertion that reddens on its own line: every readable
 * cell is used and not the first; the nearest heading is carried; a bold
 * caption counts; NEAREST really means nearest; a heading beyond the lookback
 * is not this table's; the 2026-09-11 border-label ruling still holds; and an
 * over-long label says how many cells it dropped instead of stopping quietly.
 * Then the whole thing through `markAutomaticAnchors`, where a relabel must be
 * the RELABEL the pass already reports and must not happen twice.
 *
 * NOT PROVED: anything about how the viewer draws it. That is `anchors/3`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  HEADING_LOOKBACK_LINES, TABLE_LABEL_CAP, markAnchorsOnTurn, markAutomaticAnchors, tableIn,
} from '../../src/core/anchor-pass.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { markAnchor } from '../../src/core/anchors.ts';

/** A GFM table with the header cells given, and whatever prose is put above it. */
function table(above: string[], header: string[]): string {
  return [
    ...above,
    `| ${header.join(' | ')} |`,
    `| ${header.map(() => '---').join(' | ')} |`,
    `| ${header.map((_, i) => `v${i}`).join(' | ')} |`,
  ].join('\n');
}

/* ── THE COMPOSITION, ONE CLAUSE AT A TIME ───────────────────────────────── */

test('a table is named by EVERY readable header cell, not by the first one', () => {
  assert.equal(
    tableIn(table([], ['lane', 'task', 'owns'])), 'lane | task | owns',
    'this is the defect verbatim: `header.find(isReadable)` answered "lane" here, and 27 of '
    + 'his 750 bookmarks carried exactly that label because their first column happened to be '
    + 'headed "lane". A name twenty-seven things share is not a name.',
  );
  assert.equal(
    tableIn(table([], ['id', 'origin'])), 'id | origin',
    'and the two-column case, which is the commonest shape in his archive',
  );
});

test('the nearest heading above the table is part of the label', () => {
  assert.equal(
    tableIn(table(['## Removal proofs', ''], ['proof', 'result'])),
    'Removal proofs — proof | result',
    'the owner\'s ruling in one line. Without the heading this is "proof | result", which is '
    + 'every removal-proof table in this archive and tells him which one he marked: none.',
  );
  assert.equal(
    tableIn(table(['# Wave 1 — five lanes, disjoint files', ''], ['lane', 'task'])),
    'Wave 1 — five lanes, disjoint files — lane | task',
    'any ATX level, and the heading is taken verbatim including its own punctuation',
  );
});

test('a bold line standing alone is a heading, which is how this archive writes most of them', () => {
  assert.equal(
    tableIn(table(['**Wave 1 results**', ''], ['before', 'after'])),
    'Wave 1 results — before | after',
    'counting these took the heading hit rate on his 376 tables from 242 to 285 — the 43 they '
    + 'add are captions sitting directly above the table, which is the position the ruling names',
  );
  assert.equal(
    tableIn(table(['**What I measured:**', ''], ['shape', 'count'])),
    'What I measured — shape | count',
    'and the trailing colon a caption usually wears is dropped rather than kept',
  );
  assert.equal(
    tableIn(table(['this **bold run** sits inside a sentence', ''], ['a', 'b'])), 'a | b',
    'a bold RUN inside prose is not a heading — only a line that is nothing but the bold text '
    + 'is one, or every emphasised phrase in this archive would be a caption',
  );
});

test('NEAREST means nearest: a caption just above beats a heading further up', () => {
  const label = tableIn(table(
    ['# The section this is under', '', 'some prose', '', '**The caption on this table**', ''],
    ['a', 'b'],
  ));
  assert.equal(
    label, 'The caption on this table — a | b',
    'the walk goes UP from the table and the first heading it meets wins. A walk that started '
    + 'at the top of the window would label every table in a long section with the section '
    + 'heading, and they would all read the same — the defect this item is about.',
  );
});

test('a heading beyond the lookback belongs to something else, and one inside it does not', () => {
  const filler = Array.from({ length: HEADING_LOOKBACK_LINES }, () => 'prose');

  // **DERIVED FROM THE CONSTANT, NEVER FROM A NUMBER.** `HEADING_LOOKBACK_LINES`
  // is imported and both halves are built from it, so moving the constant moves
  // the test with it rather than reddening it.
  const inside = table([...filler.slice(0, HEADING_LOOKBACK_LINES - 1), '## Still mine'], ['a', 'b']);
  assert.equal(
    tableIn(inside), 'Still mine — a | b',
    'a heading at exactly the lookback distance IS this table\'s — the anti-vacuity half. '
    + 'Without it the assertion below is green on a window of zero.',
  );

  assert.equal(
    tableIn(table(['## Not mine', ...filler], ['a', 'b'])), 'a | b',
    'and one line further up it is a heading the table happens to sit under, not the table\'s '
    + 'own. Measured on his corpus: the furthest real one of 285 was 20 lines up.',
  );
});

test('a heading of pure punctuation is no more a heading than an empty header cell is a name', () => {
  assert.equal(
    tableIn(table(['## ---', ''], ['a', 'b'])), 'a | b',
    '`## ---` is a horizontal rule somebody wrote with hashes. Labelling a bookmark "---" is '
    + 'the 2026-09-11 defect in a new place: a name he cannot recognise in a list.',
  );
  assert.equal(
    tableIn(table(['## Real heading', '', '## ···', ''], ['a', 'b'])),
    'Real heading — a | b',
    'and the walk CONTINUES past it rather than giving up — the unreadable line is skipped, '
    + 'not treated as "there is no heading here"',
  );
});

test('the 2026-09-11 ruling survives: an unreadable header says so, and never draws its borders', () => {
  assert.equal(
    tableIn(table([], ['', ''])), 'a table of 2 columns',
    'THE REGRESSION THIS FILE EXISTS TO REFUSE. The label was `header.join(" | ")` until '
    + '2026-09-11 and 25 of his anchors came out labelled literally `|`. Using the whole header '
    + 'again is only safe because UNREADABLE CELLS ARE DROPPED — this is the assertion that '
    + 'says so.',
  );
  assert.equal(
    tableIn(table(['## How the store actually works', ''], ['', ''])),
    'How the store actually works — a table of 2 columns',
    'and the heading rescues even the fallback. 32 of his anchors wear `a table of N columns` '
    + 'today; the ones with a heading above them stop being interchangeable.',
  );
  assert.equal(
    tableIn(table([], ['#', 'what', 'state'])), 'what | state',
    'a cell of pure punctuation is dropped the same way — `# | what | state` is a header his '
    + 'index actually holds',
  );
});

test('a label too long for a list is cut at the cap and SAYS how many cells it dropped', () => {
  // Built from `TABLE_LABEL_CAP` so the bound is the product's own and not a
  // number typed here: enough cells of known width to overrun it twice over.
  const cell = 'column-of-some-width';
  const many = Array.from({ length: Math.ceil((TABLE_LABEL_CAP * 2) / cell.length) },
    (_, i) => `${cell}${i}`);
  const long = tableIn(table([], many));
  assert.ok(long !== null, 'the fixture must BE a table or this proves nothing');
  assert.ok(
    long!.length <= TABLE_LABEL_CAP,
    `a composed label must stay inside TABLE_LABEL_CAP (${TABLE_LABEL_CAP}); this one is `
    + `${long!.length}. His longest real one composes to 428 characters, which is not a name in `
    + 'a list, it is a paragraph.',
  );
  assert.match(
    long ?? '', /\+\d+ more$/,
    'AND IT SAYS SO. A capped answer and a complete one must not look the same — the rule '
    + '`ANCHOR_PROBE_LIMIT` already obeys one layer up, applied to the label.',
  );

  const short = tableIn(table([], ['before', 'after']));
  assert.equal(
    short, 'before | after',
    'the anti-vacuity half: a label that FITS keeps every cell and carries no `+N more`. '
    + 'Without this the assertion above is green on an implementation that truncates always.',
  );
});

/* ── AND THROUGH THE PASS, WHERE THE RELABEL HAS TO BE COUNTED ───────────── */

const SESSION = 'sess-anchor-label';

const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

interface Fixture { cwd: string; home: string; transcript: string; dbPath: string }

function fixture(turns: unknown[]): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-label-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-label-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const transcript = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(transcript, turns.map((r) => JSON.stringify(r)).join('\n') + '\n');
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    assert.equal(runCli(['conversation', 'rebuild'], cwd, () => {}), 0);
  } finally { process.chdir(previous); }
  return { cwd, home, transcript, dbPath: path.join(cwd, '.my_context', '.index.db') };
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

function rows(f: Fixture): { label: string; kind: string; origin: string }[] {
  const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
  try {
    return index.anchorRows(null).map((r) => ({ label: r.label, kind: r.kind, origin: r.origin }));
  } finally { index.close(); }
}

test('an anchor an older build named after one cell is RELABELLED, counted, and then left alone', () => {
  const turn = say(
    'assistant',
    ['prose above it.', '', '## Wave 1 results', '', '| lane | task | owns |',
      '| --- | --- | --- |', '| A | rename | ui |'].join('\n'),
    '2026-09-10T09:00:01.000Z',
  );
  const f = fixture([say('user', 'begin', '2026-09-10T09:00:00.000Z'), turn]);
  try {
    const composed = 'Wave 1 results — lane | task | owns';
    assert.deepEqual(
      rows(f).map((r) => r.label), [composed],
      'the rebuild marks the table under today\'s grammar, which is the label the whole item '
      + 'is about',
    );

    // His index as it stands this morning: the row the OLD grammar wrote,
    // written back at the same byte so the pass meets exactly what it will
    // meet on his machine.
    const index = ConversationIndex.open(f.dbPath);
    let byteOffset = 0;
    try {
      const standing = index.anchorRows(null)[0];
      assert.ok(standing !== undefined);
      byteOffset = standing!.byteOffset;
      markAnchor(index, {
        sessionId: standing!.sessionId,
        agentId: standing!.agentId,
        byteOffset,
        label: 'lane',
        kind: 'table',
        origin: 'automatic',
        at: standing!.at,
      });
    } finally { index.close(); }
    assert.deepEqual(rows(f).map((r) => r.label), ['lane'], 'the old label really is in place');

    const write = ConversationIndex.open(f.dbPath);
    try {
      const first = markAutomaticAnchors(write);
      assert.equal(
        first.relabelled, 1,
        'THE RELABEL IS THE PASS\'S OWN EXISTING PATH, not a new write. This is the count a '
        + 'first real run reports, and the item asks for the number rather than the fact.',
      );
      assert.equal(first.marked, 0, 'and it is not a NEW bookmark — the byte was already marked');
      assert.equal(first.dropped, 0, 'and nothing was taken back');
      assert.deepEqual(rows(f).map((r) => r.label), [composed]);

      const second = markAutomaticAnchors(write);
      assert.equal(
        second.relabelled, 0,
        'IDEMPOTENT IN BOTH DIRECTIONS. A pass that relabelled every run would rewrite the '
        + 'whole anchors document on every assistant turn, and his list would never settle.',
      );
      assert.equal(second.marked, 0);
      assert.equal(second.dropped, 0);
    } finally { write.close(); }

    assert.deepEqual(
      rows(f), [{ label: composed, kind: 'table', origin: 'automatic' }],
      'and the row is otherwise untouched: same kind, same origin, one row at one byte',
    );
    assert.ok(byteOffset >= 0);
  } finally { tidy(f); }
});

test('a turn appended later is labelled by the same grammar, heading and all', () => {
  const f = fixture([say('user', 'begin', '2026-09-10T09:00:00.000Z')]);
  try {
    appendFileSync(f.transcript, JSON.stringify(say(
      'assistant',
      ['**Measured before / after**', '', '| invocation | before | after |',
        '| --- | --- | --- |', '| x | 1 | 2 |'].join('\n'),
      '2026-09-10T09:00:02.000Z',
    )) + '\n');
    // **THE REAL PER-TURN PATH, and using it was a finding rather than a
    // preference.** This test first called `rebuildConversations` and then
    // `markAutomaticAnchors` directly, and marked NOTHING: the pass finds its
    // candidates through `searchArchive`, and `rebuildConversations` does not
    // fill the prose index. `markAnchorsOnTurn` builds it first, which is
    // exactly why that function exists and is documented in its own header.
    rebuildConversations(f.dbPath, process.env, f.cwd);
    const report = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(report, null, 'the per-turn pass swallows its own failure — a null here is '
      + 'a pass that threw, and every assertion below would be about a turn nobody read');
    assert.equal(report!.anchors?.marked, 1, 'and it marked the appended turn');

    assert.deepEqual(
      rows(f).map((r) => r.label),
      ['Measured before / after — invocation | before | after'],
      'a bold caption above a table appended after the last pass reaches the label exactly as '
      + 'one in the original transcript does — there is one grammar, not a per-path one',
    );
  } finally { tidy(f); }
});
