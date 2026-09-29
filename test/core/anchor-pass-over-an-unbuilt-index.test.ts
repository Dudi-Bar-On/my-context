// @basis TASK-nine-sites-report-a-measured-zero-for-something-they-could, INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when, INV-nothing-is-dropped-silently
/**
 * **THE AUTOMATIC ANCHOR PASS MAY NOT REPORT `probed: 0` FOR PROBES IT COULD
 * NOT RUN.**
 *
 * Task 4.6c, gap 1 of three, and the reviewer's own words against
 * `core/anchor-pass.ts:~749` (task 4.6 report, §G4):
 *
 * > `probeCandidates` pages `searchArchive` and reads `.hits`; with
 * > `searchable: false` it sees an empty page and stops, which is correct
 * > control flow (there is nothing to page through). What is NOT correct is
 * > what the pass then reports.
 *
 * `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when` rules on
 * it in as many words:
 *
 * > A pass that answers "nothing to do" when it means "I could not read
 * > anything". Those are two different answers and must be two different
 * > values.
 *
 * The prose index the probes read is filled by `mycontext conversation
 * rebuild`; `rebuildConversations` — what the Stop hook runs — does not fill
 * it. So an unbuilt or partly built index is not an edge case, and over one the
 * pass answered `probed: 0, found: 0, marked: 0` — byte for byte the report of
 * an archive the grammar was shown and recognised nothing in.
 *
 * ── WHAT IS ASSERTED, AND ON WHICH SURFACE ────────────────────────────────
 *
 * **The pass's own recorded state**, which is the surface a reader of this
 * disclosure is on: `AutoAnchorReport` as `markAutomaticAnchors` returns it
 * (what `mycontext conversation rebuild`'s plan prints), and the same report
 * carried on `TurnAnchorReport.anchors` as `markAnchorsOnTurn` returns it (what
 * the Stop hook's refresh row is composed from). Not through `searchArchive`,
 * which is where task 4.6 round 2 proved it and where round 1 of the fix found
 * out that proving a disclosure on the function is not proving it on the
 * surface.
 *
 * Nothing here drives `src/hooks/stop.ts`: that file is another lane's, and the
 * clause that would print this field there is named in the task 4.6c report as
 * a follow-up rather than written here.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { buildSearchIndex } from '../../src/core/conversation-search.ts';
import { markAnchorsOnTurn, markAutomaticAnchors } from '../../src/core/anchor-pass.ts';
import { Store } from '../../src/core/store.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A turn that IS a table — the `"|---"` probe's own shape, header row and all. */
const TABLE = ['## Wave 1 results', '', '| lane | task | owns |', '| --- | --- | --- |',
  '| A | rename | ui |'].join('\n');

const said = (body: string, at: string): unknown => ({
  type: 'assistant',
  message: { role: 'assistant', content: [{ type: 'text', text: body }] },
  timestamp: at,
});

interface Box {
  dbPath: string;
  write: (session: string, rows: unknown[]) => void;
  scan: () => void;
  fill: (options?: { maxSourceBytes?: number }) => void;
  dispose: () => void;
}

function box(): Box {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-anchorcov-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-anchorcov-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const dbPath = path.join(cwd, 'index.db');
  Store.open(dbPath).close();
  const prior = process.env['CLAUDE_CONFIG_DIR'];
  process.env['CLAUDE_CONFIG_DIR'] = home;
  return {
    dbPath,
    write: (session, rows) => writeFileSync(
      path.join(dir, `${session}.jsonl`), rows.map((r) => JSON.stringify(r)).join('\n') + '\n',
    ),
    scan: () => { rebuildConversations(dbPath, process.env, cwd); },
    fill: (options = {}) => {
      const index = ConversationIndex.open(dbPath);
      try { buildSearchIndex(index, options); } finally { index.close(); }
    },
    dispose: () => {
      if (prior === undefined) delete process.env['CLAUDE_CONFIG_DIR'];
      else process.env['CLAUDE_CONFIG_DIR'] = prior;
      removeTree(home);
      removeTree(cwd);
    },
  };
}

/** A plan, so the assertion is about the REPORT and nothing is written. */
function plan(dbPath: string): ReturnType<typeof markAutomaticAnchors> {
  const index = ConversationIndex.open(dbPath);
  try { return markAutomaticAnchors(index, { plan: true }); } finally { index.close(); }
}

test('a pass whose probes could not be run says so, instead of reporting a measured zero', () => {
  const b = box();
  try {
    b.write('s-one', [said(TABLE, '2026-09-10T09:00:01.000Z')]);
    b.scan();
    // Deliberately no `fill()`: the archive is walked, the prose index is not —
    // the state every workspace is in until somebody types the rebuild.

    const report = plan(b.dbPath);
    assert.equal(report.probed, 0, 'nothing is indexed, so the probes bring nothing back');
    assert.equal(
      typeof report.unsearchable, 'string',
      'the pass reported `probed: 0, found: 0` over a table it never looked for — which is '
      + 'byte for byte the report of an archive the grammar was shown and recognised nothing '
      + 'in. INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when: those are two '
      + 'answers and must be two values',
    );
    assert.ok(
      report.unsearchable !== null && /rebuild/.test(report.unsearchable),
      'and the reason is actionable — it names the command that fills the index',
    );
  } finally { b.dispose(); }
});

test('the PER-TURN state carries it too, which is the surface the Stop row is composed from', () => {
  const b = box();
  try {
    // The small session is read by the turn's budgeted build; the large one is
    // over `maxSourceBytes` and is DEFERRED, so the prose index covers one of
    // the two transcripts this archive holds — and the table is in the half
    // that was not indexed.
    b.write('s-small', [said('nothing here is an anchor by nature', '2026-09-10T09:00:00.000Z')]);
    b.write('s-large', [
      said(TABLE, '2026-09-10T09:00:01.000Z'),
      said('x'.repeat(4000), '2026-09-10T09:00:02.000Z'),
    ]);
    b.scan();

    const report = markAnchorsOnTurn(b.dbPath, { maxSourceBytes: 1000 });
    assert.ok(report !== null, 'the pass ran');
    assert.ok(report.anchors !== null, 'a transcript moved, so the grammar was offered the turn');
    assert.equal(report.anchors.probed, 0, 'and the probes brought nothing back');
    assert.equal(
      typeof report.anchors.unsearchable, 'string',
      'the prose index covers one of the two transcripts and the table is in the other, so '
      + '`probed: 0` on this turn is not a measurement of the archive — and the per-turn report '
      + 'is what the refresh row a reader sees is composed from',
    );
  } finally { b.dispose(); }
});

test('THE MEASURED ZERO SURVIVES: a complete index that really holds no table', () => {
  const b = box();
  try {
    b.write('s-one', [said('nothing here is an anchor by nature', '2026-09-10T09:00:00.000Z')]);
    b.scan();
    b.fill();

    const report = plan(b.dbPath);
    assert.equal(report.probed, 0);
    assert.equal(
      report.unsearchable, null,
      'every transcript the archive holds was indexed and probed and none carries a table. '
      + 'That is an ANSWER, and turning it into a refusal would be this defect inverted',
    );
  } finally { b.dispose(); }
});

/**
 * **The one place this pass does NOT copy the search route's rule, and the
 * reason it does not.**
 *
 * `apiConversationSearch` reports the refusal only when EVERY per-session
 * answer is unsearchable, because returning on the first would have thrown real
 * hits away to report that the index is behind. Nothing is thrown away here:
 * `unsearchable` sits BESIDE the candidates rather than in place of them, so
 * the run serves everything it found AND says what it could not look for. The
 * probes are also not one query asked several times — `"|---"` and `"| ---"`
 * are different shapes — so "another probe found something" is no evidence at
 * all about the one that was refused.
 */
test('candidates are served AND the refusal is still said — neither is held back', () => {
  const b = box();
  try {
    b.write('s-one', [said(TABLE, '2026-09-10T09:00:01.000Z')]);
    b.scan();
    b.fill();
    // A second transcript lands after the index was built, so coverage is
    // partial — and the probe still finds the table in the indexed half.
    b.write('s-two', [said('the harbour was quiet all morning', '2026-09-11T09:00:00.000Z')]);
    b.scan();

    const report = plan(b.dbPath);
    assert.ok(report.probed > 0, 'the table is in the indexed half and is found');
    assert.equal(report.found, 1, 'and the grammar recognised the table it was shown');
    assert.equal(
      typeof report.unsearchable, 'string',
      'the index covers one of the two transcripts, so the probe that came back empty came '
      + 'back empty about HALF the archive. A reader who is shown one table has no way to '
      + 'tell that from a reader who is shown every table there is',
    );
  } finally { b.dispose(); }
});

test('an empty archive is not an unbuilt index — zero of zero is complete coverage', () => {
  const b = box();
  try {
    b.scan();
    const report = plan(b.dbPath);
    assert.equal(report.probed, 0);
    assert.equal(
      report.unsearchable, null,
      'reporting a fresh workspace as unsearchable would invent a fault out of an empty archive',
    );
  } finally { b.dispose(); }
});
