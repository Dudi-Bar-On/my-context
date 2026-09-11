// @basis TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled,
// INV-nothing-is-dropped-silently, STD-error-message-conventions
/**
 * **`mycontext conversation anchor` — the two ways an anchor is set**,
 * `plan:recall seq:1` Task 4, and §7 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * The owner's ruling is that anchors are set two ways: he marks one, and
 * things that are anchors by nature are marked *"automatically by the
 * assistant without requiring the user to initiate one"*. This file holds both
 * halves, and the second half is the one worth arguing about.
 *
 * ── WHAT MAKES THE AUTOMATIC HALF NOT A GUESS ─────────────────────────────
 *
 * Every automatic anchor rests on a GRAMMAR that the text either satisfies or
 * does not, never on a judgement about what a turn is about:
 *
 *   - a **table** is GFM's own delimiter row — a row whose every cell is
 *     `---`, `:---`, `---:` or `:---:`, with the SAME NUMBER OF CELLS as the
 *     row above it. `tableIn` is tested against the shape that fools a naive
 *     detector: a line full of pipes with no delimiter row under it, and a
 *     delimiter row whose column count does not match its header.
 *   - a **ruling** is a turn HE TYPED naming a normative corpus id — `DEC-`,
 *     `RULE-`, `INSTR-`, `STD-`, `CONST-`, `INV-`. Restricted to prompts on
 *     purpose: a ruling is something the owner gave, and an assistant turn
 *     quoting one back is a citation, not a ruling.
 *
 * Both are tested in BOTH directions, because a detector that fired on
 * everything would pass a test that only planted positives — and the negative
 * fixtures here are the shapes that actually occur in this corpus.
 *
 * ── THE TRIM HE RULED ON 2026-09-11 ───────────────────────────────────────
 *
 * `TASK-trim-the-automatic-anchor-pass-to-the-two-kinds-he-ruled`. The pass
 * wrote 613 anchors into his index overnight and he read them. A **report**
 * used to be a third grammar — a dated `.md` under `reports/` or
 * `docs/superpowers/{specs,plans}/` — and it contributed 101 of the 613. It
 * marked a turn that MENTIONS a report rather than a report, and he judged
 * those not worth having. `the report detector is gone` is what stops it
 * coming back, and it asserts from BOTH ends: the grammar says `null`, and a
 * rebuild over a fixture that names two such paths writes no anchor at all.
 *
 * And 25 of the table anchors were labelled literally `|`, with five more
 * `|  |`: the label was the whole header row JOINED, so a header of empty
 * cells joined to nothing but its own borders. A label is now the table's
 * first READABLE header cell — one with a letter or a digit in it, which the
 * Hebrew half of this archive needs as much as the English half — and the
 * shapes that produced the defect are asserted one by one rather than through
 * the single example that happened to work.
 *
 * ── AND THE ID IS DERIVED FROM THE POSITION ───────────────────────────────
 *
 * `anchors.ts`' header says why, and `the same point marked twice is one row`
 * is what proves it end to end through the command: the automatic pass runs on
 * every `rebuild`, which is every time the owner types it, so an id derived
 * from a clock or a counter would fill his list with duplicates of one point.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { anchorInTurn, tableIn } from '../../src/cli/commands/conversation.ts';
import { markAnchor } from '../../src/core/anchors.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const SESSION = 'aaaaaaaa-1111-2222-3333-444444444444';
const LANE = 'agent-anchor-lane-1';

const jsonl = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

/** Where record `n` of a transcript starts, in BYTES. */
function offsetOf(rows: unknown[], n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(rows[i]), 'utf8') + 1;
  return at;
}

const TABLE = [
  'Here is what was measured.',
  '',
  '| tokenizer | hits |',
  '| --- | --- |',
  '| trigram | 14 |',
  '| unicode61 | 0 |',
].join('\n');

const TURNS = [
  say('user', 'follow RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number here',
    '2026-09-10T10:00:00.000Z'),
  say('assistant', TABLE, '2026-09-10T10:00:01.000Z'),
  say('assistant', 'I wrote it up in reports/2026-09-10-lexical-selection-research.md today',
    '2026-09-10T10:00:02.000Z'),
  say('assistant', 'nothing here is an anchor by nature, it is only prose about the weather',
    '2026-09-10T10:00:03.000Z'),
  say('user', 'שלום, כאן אין מזהה פריט בכלל', '2026-09-10T10:00:04.000Z'),
  // The second half of the retired report grammar. It is kept as a NEGATIVE:
  // `reports/` and `docs/superpowers/` were two separate probes, and a fixture
  // that named only one of them would let half the removal be undone unseen.
  say('assistant', 'the design is docs/superpowers/specs/2026-09-10-conversation-retrieval-'
    + 'design.md as it stands', '2026-09-10T10:00:05.000Z'),
  // **A TABLE NO PROBE CAN SEE.** Its delimiter row separates the cells with
  // TWO spaces, so it holds neither `|---` nor `| ---` and `searchArchive`
  // never offers it as a candidate — which is what the 97 tables past the
  // probe bound of 200 look like on his real index. Everything asserted at
  // this offset therefore rests on the SWEEP and cannot be satisfied by the
  // probe pass re-marking it.
  say('assistant', ['a table the probes cannot reach', '', 'seq  |  what', '---  |  ---',
    '1  |  the sweep'].join('\n'), '2026-09-10T10:00:06.000Z'),
];

interface Fixture {
  cwd: string;
  dbPath: string;
  out: string[];
  run: (args: string[]) => number;
  drawn: () => string;
  lane: () => void;
  /** The harness prunes the session's transcript out from under the archive. */
  prune: () => void;
  dispose: () => void;
}

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), jsonl(TURNS));

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
    run: (args) => runCli(args, cwd, (line: string) => out.push(line)),
    drawn: () => out.join('\n'),
    lane: () => {
      const under = path.join(dir, SESSION, 'subagents');
      mkdirSync(under, { recursive: true });
      writeFileSync(path.join(under, `${LANE}.jsonl`), jsonl([
        say('assistant', 'a lane said something worth keeping', '2026-09-10T10:01:00.000Z'),
      ]));
      writeFileSync(path.join(under, `${LANE}.meta.json`), JSON.stringify({
        agentType: 'general-purpose', description: 'the anchor lane',
        toolUseId: 'toolu_anchor_lane', spawnDepth: 1,
      }));
      rebuildConversations(ws.dbPath, env, cwd, {});
    },
    prune: () => { removeTree(path.join(dir, `${SESSION}.jsonl`)); },
    dispose: () => {
      if (priorHome === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = priorHome;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** Every anchor the index holds, read through the read-only door. */
function anchors(dbPath: string): { id: string; kind: string; origin: string; label: string;
  byteOffset: number; agentId: string | null }[] {
  const index = ConversationIndex.openReadOnlyChecked(dbPath);
  try {
    return index.anchorRows(null).map((row) => ({
      id: row.id, kind: row.kind, origin: row.origin, label: row.label,
      byteOffset: row.byteOffset, agentId: row.agentId,
    }));
  } finally {
    index.close();
  }
}

/**
 * One anchor written straight into the index, the way AN EARLIER BUILD wrote
 * it — a kind this build no longer produces, or a label this build no longer
 * derives. The command has no flag for that on purpose, so the only honest way
 * to set up "his index as it stands this morning" is to write the row.
 */
function seed(dbPath: string, spec: {
  byteOffset: number; label: string; kind: string; origin: 'owner' | 'automatic';
}): void {
  const index = ConversationIndex.open(dbPath);
  try {
    markAnchor(index, { sessionId: SESSION, at: '2026-09-10T23:00:00.000Z', ...spec });
  } finally {
    index.close();
  }
}

/* ── THE GRAMMAR, ON ITS OWN, IN BOTH DIRECTIONS ─────────────────────────── */

test('a table is GFM\'s delimiter row, not a line that happens to hold pipes', () => {
  assert.equal(
    tableIn(TABLE), 'tokenizer',
    'the first header cell names the table, so the anchor says what it points at',
  );
  assert.equal(
    tableIn('a | b | c\nthis is prose with pipes in it | and more'), null,
    'pipes alone are not a table — this is the shape a naive detector marks, and it occurs '
    + 'in shell pipelines on nearly every page of this archive',
  );
  assert.equal(
    tableIn('| one | two | three |\n| --- | --- |\n| a | b | c |'), null,
    'a delimiter row with fewer cells than its header is not a table in GFM either, and '
    + 'accepting it is how a detector starts marking ASCII art',
  );
  // **THIS ONE IS HERE BECAUSE ITS ABSENCE WAS FOUND BY A REMOVAL PROOF.**
  // The two rows have the SAME cell count, so the matching-header clause
  // cannot save it and only the delimiter rule can. Without it, breaking
  // `isDelimiter` left every assertion in this test green — the cell-count
  // clause was masking it, and the delimiter rule was untested.
  assert.equal(
    tableIn('| one | two |\n| three | four |\n| five | six |'), null,
    'two rows of the same width are not a table without a DELIMITER row between them — this '
    + 'is the shape the cell-count clause cannot reject, so it is the only assertion that '
    + 'actually rests on the dashes',
  );
  assert.equal(
    tableIn('| aligned | right |\n|:---|---:|\n| a | b |'), 'aligned',
    'and the alignment colons GFM allows are still a delimiter row',
  );
});

/**
 * **THE DEFECT HE READ OFF HIS OWN INDEX.** 25 anchors labelled `|` and five
 * labelled `|  |`, because the label was `header.join(' | ')` and the headers
 * in question were empty cells. The shapes below are taken from that index,
 * and they are asserted ONE BY ONE rather than through the single well-formed
 * example above: the old label passed that one too.
 */
test('a table anchor is labelled with a header cell a person can read, never a border', () => {
  assert.equal(
    tableIn('|  |  |\n| --- | --- |\n| a | b |'), 'a table of 2 columns',
    'a header of two EMPTY cells joins to " | " — the exact label 25 of his anchors carried. '
    + 'There is no cell to name it with, so the fallback SAYS what it is instead of drawing '
    + 'the borders',
  );
  assert.equal(
    tableIn('|  |  |  |\n| --- | --- | --- |\n| a | b | c |'), 'a table of 3 columns',
    'and the three-cell shape is the " |  | " label the other five carried',
  );
  assert.equal(
    tableIn('|  | before | after |\n| --- | --- | --- |\n| a | b | c |'), 'before',
    'an empty FIRST cell is common — a corner cell over a row-label column — and the first '
    + 'cell a person can read is still the table\'s own header rather than a fallback',
  );
  assert.equal(
    tableIn('| # | what | state |\n| --- | --- | --- |\n| 1 | a | b |'), 'what',
    'a cell of pure punctuation is no more readable than an empty one, and `# | what | state` '
    + 'is a label his index actually holds',
  );
  assert.equal(
    tableIn('| מזהה | ערך |\n| --- | --- |\n| א | ב |'), 'מזהה',
    'readable means a LETTER OR DIGIT in any script — this archive is half Hebrew, and an '
    + 'ASCII test would have thrown every Hebrew header onto the fallback',
  );

  // **THE ASSERTION THE WHOLE FIX RESTS ON**, over every shape above at once:
  // whatever the header, what comes back is something with a letter or a digit
  // in it. A label that is only punctuation is the defect, so it is refused
  // here rather than at each example.
  for (const text of [
    TABLE,
    '|  |  |\n| --- | --- |\n| a | b |',
    '|  |  |  |\n| --- | --- | --- |\n| a | b | c |',
    '| - |  |\n| --- | --- |\n| a | b |',
    '| :: | ?? |\n| --- | --- |\n| a | b |',
    '| # | what | state |\n| --- | --- | --- |\n| 1 | a | b |',
  ]) {
    const label = tableIn(text);
    assert.ok(label !== null, `this fixture must BE a table or it proves nothing: ${text}`);
    assert.match(
      label ?? '', /[\p{L}\p{N}]/u,
      `a table anchor's label must carry something a person can read, and "${label}" does not `
      + '— an anchor labelled `|` is one he cannot recognise in a list',
    );
  }
});

/**
 * **THE REPORT DETECTOR IS GONE, AND THIS IS WHAT STOPS IT COMING BACK.**
 *
 * It was a dated `.md` path under `reports/` or `docs/superpowers/{specs,
 * plans}/`, it contributed 101 of the 613 anchors in his index, and on
 * 2026-09-11 he ruled it out: it marks a turn that MENTIONS a report, not a
 * report. Asserted at the grammar here and end to end in `a rebuild marks the
 * table and the ruling, and nothing else` — the grammar alone would not catch
 * a probe put back, and the probes alone would not catch the regex.
 */
test('the report detector is gone: a dated narrative path is not an anchor by nature', () => {
  assert.equal(
    anchorInTurn('answer', 'see reports/2026-09-10-lexical-selection-research.md'), null,
    'a turn that names a report is not a report, and 101 of the 613 anchors in his index were '
    + 'this and nothing else',
  );
  assert.equal(
    anchorInTurn('answer', 'see docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md'),
    null,
    'and the plans directory is the same shape, so removing one half would not be removing it',
  );
  assert.equal(
    anchorInTurn('prompt', 'read reports/2026-09-10-lexical-selection-research.md please'), null,
    'nor is it a ruling because HE typed it — the ruling grammar is about normative ids and a '
    + 'path is not one',
  );
});

test('a ruling is a normative id in a turn HE typed', () => {
  assert.deepEqual(
    anchorInTurn('prompt', 'apply DEC-run-is-removed-execute-is-the-only-way-to-run-what-the'),
    { kind: 'ruling', label: 'DEC-run-is-removed-execute-is-the-only-way-to-run-what-the' },
  );
  assert.equal(
    anchorInTurn('answer', 'apply DEC-run-is-removed-execute-is-the-only-way-to-run-what-the'),
    null,
    'the same id in an ANSWER is a citation, not a ruling — a ruling is something he gave, '
    + 'and marking every turn that quotes one back would mark most of this archive',
  );
  assert.equal(
    anchorInTurn('prompt', 'do TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to'),
    null,
    'a task id is not a normative id, and widening the prefix set is how this stops being a '
    + 'grammar and starts being a guess about what matters',
  );
});

/* ── THE OWNER MARKS ONE ─────────────────────────────────────────────────── */

test('he marks a point by its byte offset, and the list shows it', () => {
  const f = fixture();
  try {
    const at = offsetOf(TURNS, 1);
    assert.equal(
      f.run(['conversation', 'anchor', SESSION, String(at), '--label', 'the measurement']),
      0, f.drawn(),
    );
    const marked = anchors(f.dbPath).filter((a) => a.origin === 'owner');
    assert.equal(marked.length, 1);
    assert.equal(marked[0]?.byteOffset, at, 'the position is the BYTE he named');
    assert.equal(marked[0]?.label, 'the measurement');
    assert.equal(marked[0]?.kind, 'note', 'something a person chose is a note by default');

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor']), 0, f.drawn());
    assert.match(f.drawn(), /the measurement/);
  } finally { f.dispose(); }
});

test('the same point marked twice is one row, with the newer label', () => {
  const f = fixture();
  try {
    const at = offsetOf(TURNS, 1);
    f.run(['conversation', 'anchor', SESSION, String(at), '--label', 'first']);
    f.run(['conversation', 'anchor', SESSION, String(at), '--label', 'second']);
    const owned = anchors(f.dbPath).filter((a) => a.origin === 'owner');
    assert.equal(owned.length, 1,
      'the id is derived from WHERE the anchor is, so marking one point twice moves the label '
      + 'rather than filing a second bookmark');
    assert.equal(owned[0]?.label, 'second');
  } finally { f.dispose(); }
});

test('a point inside a LANE is marked, and says which lane', () => {
  const f = fixture();
  try {
    f.lane();
    assert.equal(
      f.run(['conversation', 'anchor', SESSION, '0', '--agent', LANE, '--label', 'in the lane']),
      0, f.drawn(),
    );
    const owned = anchors(f.dbPath).filter((a) => a.origin === 'owner');
    assert.equal(owned[0]?.agentId, LANE);
    assert.equal(owned[0]?.id, `${SESSION}:${LANE}:0`,
      'a session id and a lane id can never compose the same anchor id');
  } finally { f.dispose(); }
});

test('an anchor is searched by its label, and taken back by its id', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'anchor', SESSION, String(offsetOf(TURNS, 1)), '--label', 'the table']);
    f.run(['conversation', 'anchor', SESSION, String(offsetOf(TURNS, 2)), '--label', 'the write-up']);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor', '--find', 'write-up']), 0, f.drawn());
    assert.match(f.drawn(), /the write-up/);
    assert.doesNotMatch(f.drawn(), /the table/,
      'a search over labels answers about the labels and not about the archive');

    f.out.length = 0;
    const id = `${SESSION}:-:${offsetOf(TURNS, 1)}`;
    assert.equal(f.run(['conversation', 'anchor', '--drop', id]), 0, f.drawn());
    assert.deepEqual(
      anchors(f.dbPath).filter((a) => a.origin === 'owner').map((a) => a.label),
      ['the write-up'],
    );

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor', '--drop', id]), 0, f.drawn());
    assert.match(f.drawn(), /no anchor/i,
      'taking back an anchor that is not there is an ANSWER, not a failure');
  } finally { f.dispose(); }
});

test('an offset that is not a byte count is refused, with the reason', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'anchor', SESSION, '-3', '--label', 'x']), 1);
    assert.match(f.drawn(), /byte/i);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor', SESSION, '12']), 1,
      'an anchor with no label is a bookmark that says nothing about why it was kept');
    assert.match(f.drawn(), /--label/);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor', 'no-such-session', '0', '--label', 'x']), 1);
    assert.match(f.drawn(), /no-such-session/,
      'the refusal names what was not found, so it can be told from a typo in the offset');
  } finally { f.dispose(); }
});

/**
 * **MARKING SOMETHING IS NOT A WAY TO TURN THE ARCHIVE ON.**
 *
 * `ConversationIndex.open` is the only thing that creates the conversation
 * tables, and the end-of-turn refresh gates on their EXISTENCE — so a command
 * that opened for write in a workspace nobody had ever scanned would opt that
 * machine into reading its own transcripts, silently, on a bookmark. `name`
 * and `persist --off` both carry this gate; so does this.
 */
test('anchoring in a workspace nobody has scanned creates nothing', () => {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-off-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchor-off-cwd-'));
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  try {
    runCli(['init'], cwd, () => {});
    const ws = resolveWorkspace(cwd);
    const out: string[] = [];
    assert.equal(
      runCli(['conversation', 'anchor', SESSION, '0', '--label', 'x'], cwd,
        (l: string) => out.push(l)),
      1, out.join('\n'),
    );
    assert.match(out.join('\n'), /rebuild/,
      'and it names the command that WOULD turn it on, so the refusal is a route rather than '
      + 'a wall');
    assert.throws(
      () => ConversationIndex.openReadOnlyChecked(ws.dbPath).close(),
      'the tables must still not exist — if they do, this command has opted the machine into '
      + 'the end-of-turn refresh of its own transcripts',
    );
  } finally {
    if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
    else process.env['CLAUDE_CONFIG_DIR'] = prior;
    removeTree(home);
    removeTree(cwd);
  }
});

/* ── AND THEY ARE SET WITHOUT HIM ASKING ─────────────────────────────────── */

test('a rebuild marks the table and the ruling, and nothing else', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    const automatic = anchors(f.dbPath).filter((a) => a.origin === 'automatic');
    assert.deepEqual(
      automatic.map((a) => a.kind).sort(), ['ruling', 'table'],
      'two turns in this fixture are anchors by nature and four are not — a detector that '
      + 'fired on the prose, on the Hebrew turn or on the two REPORT PATHS would show up here '
      + 'as a third kind',
    );
    const table = automatic.find((a) => a.kind === 'table');
    assert.equal(table?.byteOffset, offsetOf(TURNS, 1),
      'and it points at the BYTE the turn holding the table starts on');
    assert.equal(table?.label, 'tokenizer');
    assert.equal(
      automatic.find((a) => a.kind === 'ruling')?.byteOffset, offsetOf(TURNS, 0),
      'the ruling is the turn HE typed, which is record 0 here',
    );
    // **WHAT THESE TWO REST ON, MEASURED RATHER THAN ASSUMED.** Putting the
    // two retired PROBES back and leaving the grammar out was run as a removal
    // proof and every assertion in this file stayed green — a probe with no
    // grammar to accept what it finds marks nothing, so the probes are cost
    // and not behaviour. These two go red when the grammar comes back WITH its
    // probes, which is what a re-introduction would look like: two turns of
    // this fixture name a dated narrative path, one of them the only thing in
    // it under `docs/superpowers/`, and nothing points at either byte.
    const marked = new Set(automatic.map((a) => a.byteOffset));
    assert.ok(!marked.has(offsetOf(TURNS, 2)),
      'the turn that names reports/2026-09-10-… is not marked — the report detector is gone');
    assert.ok(!marked.has(offsetOf(TURNS, 5)),
      'and neither is the turn that names a docs/superpowers/specs/ path, so half the grammar '
      + 'coming back is still caught');
  } finally { f.dispose(); }
});

test('a second rebuild adds no duplicate of an anchor it already marked', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const first = anchors(f.dbPath).filter((a) => a.origin === 'automatic').map((a) => a.id);
    f.out.length = 0;
    f.run(['conversation', 'rebuild', '--full']);
    const second = anchors(f.dbPath).filter((a) => a.origin === 'automatic').map((a) => a.id);
    assert.deepEqual(
      second.sort(), first.sort(),
      'the automatic pass runs on EVERY rebuild and the Stop hook rebuilds every turn, so an '
      + 'id derived from the clock would fill his list with copies of one point',
    );
  } finally { f.dispose(); }
});

/* ── AND THE PASS OWNS WHAT IT MARKED, SO A TRIM CAN LAND ────────────────── */

/**
 * **A PASS THAT ONLY ADDS CANNOT CARRY OUT A TRIM.** Retiring the report
 * grammar would have left its 101 anchors standing in his index for ever,
 * because `markAutomaticAnchors` was idempotent by construction and never
 * deleted. It now reads back every anchor it OWNS and takes back the ones its
 * grammar no longer recognises.
 */
test('a rebuild takes back an automatic anchor its grammar no longer recognises', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    // Exactly the row last night's build wrote for the report grammar, at the
    // turn that names a report, with the path as its label.
    seed(f.dbPath, {
      byteOffset: offsetOf(TURNS, 2),
      label: 'reports/2026-09-10-lexical-selection-research.md',
      kind: 'report',
      origin: 'automatic',
    });
    // And one on a turn no grammar ever recognised, so this is about the
    // grammar's verdict and not about the word "report".
    seed(f.dbPath, {
      byteOffset: offsetOf(TURNS, 3), label: 'nothing at all', kind: 'table',
      origin: 'automatic',
    });
    assert.equal(
      anchors(f.dbPath).filter((a) => a.origin === 'automatic' && a.kind === 'report').length, 1,
      'the seed must actually be in the index or the next assertion is about nothing',
    );

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());

    const left = anchors(f.dbPath).filter((a) => a.origin === 'automatic');
    assert.deepEqual(
      left.map((a) => a.kind).sort(), ['ruling', 'table'],
      'the report anchor is gone from his index, not merely no longer produced — and so is the '
      + 'one on the prose turn',
    );
    assert.ok(
      !left.some((a) => a.byteOffset === offsetOf(TURNS, 3)),
      'the prose turn carries no automatic anchor at all now',
    );
    assert.match(
      f.drawn(), /2 anchor\(s\) marked for you by an earlier build/,
      'and the rebuild SAYS it took them back. `INV-nothing-is-dropped-silently` in the '
      + 'direction that matters here: a pass that quietly deletes his bookmarks is worse than '
      + 'one that keeps too many',
    );
  } finally { f.dispose(); }
});

/**
 * **THE ONE THAT MATTERS MOST.** An automatic pass that deletes a hand-made
 * bookmark is a far worse defect than any it could fix, and the sweep is the
 * first thing in this command that deletes anything. `origin` is the whole
 * distinction between the two halves of §7 and this is where it is load-
 * bearing: all three anchors below are on turns the sweep re-reads, and one of
 * them is on a turn whose grammar was RETIRED this morning.
 */
test('a rebuild never touches an anchor he marked by hand', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    for (const [n, why] of [
      [3, 'come back to this'],
      [2, 'the write-up I asked for'],
      [1, 'my own name for that table'],
    ] as [number, string][]) {
      assert.equal(
        f.run(['conversation', 'anchor', SESSION, String(offsetOf(TURNS, n)), '--label', why]),
        0, f.drawn(),
      );
    }
    const before = anchors(f.dbPath).filter((a) => a.origin === 'owner');
    assert.equal(before.length, 3, 'three hand-made bookmarks stand before the rebuild');

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild', '--full']), 0, f.drawn());

    const after = anchors(f.dbPath).filter((a) => a.origin === 'owner');
    assert.deepEqual(
      after.map((a) => `${a.byteOffset}:${a.kind}:${a.label}`).sort(),
      before.map((a) => `${a.byteOffset}:${a.kind}:${a.label}`).sort(),
      'every one survives with its position, its kind and HIS WORDS unchanged — including the '
      + 'one on the prose turn, which the grammar rejects, and the one on the report turn, '
      + 'whose grammar was retired. The sweep reads `origin` and stops there.',
    );
  } finally { f.dispose(); }
});

/**
 * **SILENCE IS NOT EVIDENCE.** The sweep deletes on one thing only — the
 * grammar, having READ the turn, saying no. A transcript the harness pruned
 * says nothing at all, and treating it as a rejection would turn a missing
 * file into lost bookmarks for every session the harness ages out. An anchor
 * outliving its transcript is the reason anchors are a table at all
 * (`test/core/anchors.test.ts`, `an anchor survives removeMissing pruning the
 * session row`) — that test holds it for one he made, and this holds it for
 * one the pass made, which is the half the sweep could take away.
 */
test('a rebuild leaves an automatic anchor whose transcript is gone exactly where it is', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const before = anchors(f.dbPath).filter((a) => a.origin === 'automatic');
    assert.ok(before.length > 0, 'the pass must have marked something or this proves nothing');

    f.prune();
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());

    assert.deepEqual(
      anchors(f.dbPath).filter((a) => a.origin === 'automatic')
        .map((a) => `${a.byteOffset}:${a.kind}:${a.label}`).sort(),
      before.map((a) => `${a.byteOffset}:${a.kind}:${a.label}`).sort(),
      'every automatic anchor is still there. The rows they pointed into are gone, so the '
      + 'grammar was never asked, and a pass that read that silence as a rejection would empty '
      + 'his list the first time the harness aged a session out',
    );
  } finally { f.dispose(); }
});

/**
 * **THE 25 LABELS THAT SAY `|` ARE IN HIS INDEX ALREADY**, and a fix that only
 * changed what the NEXT mark is called would have left them there: the probes
 * stop at 200 candidates each and his archive holds 297 tables. This is at the
 * one offset in the fixture no probe reaches, so nothing but the sweep can
 * satisfy it.
 */
test('a rebuild relabels a table anchor an earlier build labelled with a border', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const hidden = offsetOf(TURNS, 6);
    assert.ok(
      !anchors(f.dbPath).some((a) => a.byteOffset === hidden),
      'the fixture must really be out of the probes\' reach, or this test is satisfied by the '
      + 'probe pass re-marking it and proves nothing about the sweep',
    );

    seed(f.dbPath, { byteOffset: hidden, label: ' | ', kind: 'table', origin: 'automatic' });
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());

    const repaired = anchors(f.dbPath).find((a) => a.byteOffset === hidden);
    assert.equal(
      repaired?.label, 'seq',
      'the label is re-derived from the table\'s own first header cell, so the bookmarks he '
      + 'already has stop saying `|`',
    );
    assert.equal(repaired?.kind, 'table', 'and it is still a table');
    assert.match(
      f.drawn(), /1 anchor\(s\) marked for you were given a clearer label/,
      'and the rebuild says so — one label moved on this run',
    );
  } finally { f.dispose(); }
});

/**
 * **THE COUNT IS A TOTAL, OR IT IS A LIE.** Most of his `|` labels are on
 * tables the probes DO reach, and the probe pass re-marks every candidate it
 * recognises — so a counter that watched only the sweep reported 56 on the
 * live run that moved 345 labels. Found by that assertion's own removal proof,
 * which stayed green: nothing here reached the probe pass's half of it.
 */
test('the probe pass relabels what it already owns, and that is counted too', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const visible = offsetOf(TURNS, 1);
    assert.ok(
      anchors(f.dbPath).some((a) => a.byteOffset === visible && a.origin === 'automatic'),
      'this offset must be one the PROBES reach, or the sweep would be doing the work and '
      + 'this test would be the previous one again',
    );

    seed(f.dbPath, { byteOffset: visible, label: ' | ', kind: 'table', origin: 'automatic' });
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());

    assert.equal(
      anchors(f.dbPath).find((a) => a.byteOffset === visible)?.label, 'tokenizer',
      'the probe pass re-derives the label of an anchor it already owns',
    );
    assert.match(
      f.drawn(), /1 anchor\(s\) marked for you were given a clearer label/,
      'and it is counted. A disclosure that omits one of the two paths reads as a total and '
      + 'is not one',
    );
  } finally { f.dispose(); }
});

/**
 * **REWRITTEN AFTER ITS OWN REMOVAL PROOF STAYED GREEN.** It asserted
 * `/anchor/i` over the whole output, and the line beside the disclosure names
 * `mycontext conversation anchor` as the way to list them — so the word
 * survived the sentence being replaced and the assertion proved nothing. The
 * count is now taken FROM THE INDEX and looked for in the sentence, which
 * cannot be satisfied by any other part of the output.
 */
test('the rebuild SAYS how many it marked, rather than marking in silence', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const marked = anchors(f.dbPath).filter((a) => a.origin === 'automatic').length;
    assert.ok(marked > 0, 'the fixture must actually produce anchors, or the next assertion '
      + 'is satisfied by the number zero appearing anywhere');
    assert.match(
      f.drawn(), new RegExp(`${marked} new anchor\\(s\\) were marked`),
      'something was written to his index on his behalf; a write nobody is told about is the '
      + 'shape INV-nothing-is-dropped-silently forbids in the other direction',
    );
  } finally { f.dispose(); }
});

/**
 * The listing and `--find` are the surfaces the trim has to leave working, and
 * `--find` over a TABLE label is the one the old label made useless: nobody
 * searches their bookmarks for `|`.
 */
test('the trimmed set still lists, and --find matches a table by its new label', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor']), 0, f.drawn());
    assert.match(f.drawn(), /tokenizer/, 'the table anchor is listed under its header cell');

    f.out.length = 0;
    assert.equal(f.run(['conversation', 'anchor', '--find', 'tokenizer']), 0, f.drawn());
    // **REWRITTEN AFTER ITS OWN REMOVAL PROOF STAYED GREEN.** It asserted
    // `/tokenizer/` over the output, and the not-found message quotes the term
    // back — `no anchor's label contains "tokenizer"` — so emptying
    // `searchAnchors` left it green and it proved nothing. The COUNT the
    // listing prints is on the other branch and cannot be reached any other
    // way.
    assert.match(
      f.drawn(), /showing all 1\./,
      'one anchor came back, and it is the table\'s',
    );
    assert.match(f.drawn(), /tokenizer/);
    assert.doesNotMatch(
      f.drawn(), /RULE-a-citation-names/,
      'and the search still discriminates — it is about the labels, not about the archive',
    );
  } finally { f.dispose(); }
});

test('a rebuild fills the prose index, so the viewer has something to search', () => {
  const f = fixture();
  try {
    f.run(['conversation', 'rebuild']);
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.ok(
        index.matchProse('"lexical-selection"', {}, 10).length > 0,
        'nothing called buildSearchIndex until this landed, so conversation_prose was empty — '
        + 'an empty table answers nothing, which is honest, and useless',
      );
    } finally { index.close(); }
  } finally { f.dispose(); }
});
