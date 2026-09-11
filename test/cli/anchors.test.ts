// @basis TASK-search-the-archive-properly-and-mark-the-anchors-you-want-to,
// INV-nothing-is-dropped-silently, STD-error-message-conventions
/**
 * **`mycontext conversation anchor` — the two ways an anchor is set**,
 * `plan:recall seq:1` Task 4, and §7 of
 * `docs/superpowers/specs/2026-09-10-conversation-retrieval-design.md`.
 *
 * The owner's ruling is that anchors are set two ways: he marks one, and
 * things that are anchors by nature — *"a table, a report"*, a ruling he gave
 * — are marked *"automatically by the assistant without requiring the user to
 * initiate one"*. This file holds both halves, and the second half is the one
 * worth arguing about.
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
 *   - a **report** is a dated Markdown path under `reports/` or
 *     `docs/superpowers/{specs,plans}/` — this project's own convention for
 *     where narrative lives, and a path either has that shape or has not.
 *   - a **ruling** is a turn HE TYPED naming a normative corpus id — `DEC-`,
 *     `RULE-`, `INSTR-`, `STD-`, `CONST-`, `INV-`. Restricted to prompts on
 *     purpose: a ruling is something the owner gave, and an assistant turn
 *     quoting one back is a citation, not a ruling.
 *
 * The three are tested in BOTH directions, because a detector that fired on
 * everything would pass a test that only planted positives — and the negative
 * fixtures here are the shapes that actually occur in this corpus.
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
];

interface Fixture {
  cwd: string;
  dbPath: string;
  out: string[];
  run: (args: string[]) => number;
  drawn: () => string;
  lane: () => void;
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

/* ── THE GRAMMAR, ON ITS OWN, IN BOTH DIRECTIONS ─────────────────────────── */

test('a table is GFM\'s delimiter row, not a line that happens to hold pipes', () => {
  assert.equal(
    tableIn(TABLE), 'tokenizer | hits',
    'the header row names the table, so the anchor says what it points at',
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
    tableIn('| aligned | right |\n|:---|---:|\n| a | b |'), 'aligned | right',
    'and the alignment colons GFM allows are still a delimiter row',
  );
});

test('a report is a dated path under this project\'s own narrative directories', () => {
  assert.deepEqual(
    anchorInTurn('answer', 'see reports/2026-09-10-lexical-selection-research.md'),
    { kind: 'report', label: 'reports/2026-09-10-lexical-selection-research.md' },
  );
  assert.deepEqual(
    anchorInTurn('answer', 'see docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md'),
    { kind: 'report', label: 'docs/superpowers/plans/2026-09-10-d42-conversation-retrieval.md' },
  );
  assert.equal(
    anchorInTurn('answer', 'see reports/README.md and src/core/conversation-search.ts'), null,
    'an undated file under reports/ is not one of these, and a source path is not a report — '
    + 'the shape is the whole test, so a detector that matched any .md would mark the corpus',
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

test('a rebuild marks the table, the report and the ruling, and nothing else', () => {
  const f = fixture();
  try {
    assert.equal(f.run(['conversation', 'rebuild']), 0, f.drawn());
    const automatic = anchors(f.dbPath).filter((a) => a.origin === 'automatic');
    assert.deepEqual(
      automatic.map((a) => a.kind).sort(), ['report', 'ruling', 'table'],
      'three turns in this fixture are anchors by nature and three are not — a detector that '
      + 'fired on the prose or on the Hebrew turn would show up here as a fourth kind',
    );
    const table = automatic.find((a) => a.kind === 'table');
    assert.equal(table?.byteOffset, offsetOf(TURNS, 1),
      'and it points at the BYTE the turn holding the table starts on');
    assert.equal(table?.label, 'tokenizer | hits');
    assert.equal(
      automatic.find((a) => a.kind === 'ruling')?.byteOffset, offsetOf(TURNS, 0),
      'the ruling is the turn HE typed, which is record 0 here',
    );
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
