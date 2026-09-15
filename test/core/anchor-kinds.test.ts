// @basis TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your,
// TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a,
// RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none,
// INV-nothing-is-dropped-silently
/**
 * **THE OWNER'S OWN VOCABULARY, AND THE LANE BEHIND A MARK** —
 * `TASK-a-mark-you-make-yourself-cannot-say-what-kind-it-is-so-your` and the
 * lane half of
 * `TASK-a-table-mark-is-labelled-with-one-word-from-its-header-and-a`, both
 * ruled by the owner on 2026-09-15.
 *
 * ── THE DEFECT, MEASURED ──────────────────────────────────────────────────
 *
 * A mark he made by hand was pinned to `kind: 'note'`, `origin: 'owner'`, and
 * he could type a label and nothing else. In 750 anchors he had made ONE. The
 * automatic pass, beside him, records a kind, a byte, a session, an agent and
 * an instant for every one of its own.
 *
 * ── WHAT THE FIX MAY NOT COST, WHICH IS THE WHOLE OF THIS FILE ────────────
 *
 * The pinning in `apiAnchorMark` exists so that **no request can forge a row
 * the automatic pass is forbidden to read**, and that property is not traded
 * away for a richer vocabulary. So two things are proved here rather than
 * promised:
 *
 *   1. The owner's kinds are DISJOINT from the automatic ones, checkably, so a
 *      request cannot write `kind: 'table'` at all.
 *   2. **The pass leaves an `origin: 'owner'` row alone WHATEVER KIND IT
 *      CARRIES** — including `'table'` and `'ruling'`, which a relabel can
 *      legitimately leave on a row that has become his. This is the item's
 *      explicit requirement, and it is asserted beside an automatic row at a
 *      reachable byte that the same run DOES change, so the pass is provably
 *      awake while it declines.
 *
 * ── AND THE FILE IS STILL THE TRUTH ───────────────────────────────────────
 *
 * `note` is a new field on the row in `.my_context/.anchors.jsonl`. The index
 * table is derived, so deleting `.index.db` must lose nothing — including the
 * note. That is asserted by actually deleting it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { markAutomaticAnchors } from '../../src/core/anchor-pass.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import {
  AUTOMATIC_ANCHOR_KINDS, OWNER_ANCHOR_KINDS, allAnchors, isOwnerAnchorKind, laneNameOf,
  markAnchor,
} from '../../src/core/anchors.ts';
import { readAnchorFile, reconcileAnchors } from '../../src/core/anchor-file.ts';

const SESSION = 'sess-anchor-kinds';
const LANE = 'agent-kinds-one';
const LANE_NAME = 'Lane 4: rename cancel and hidden total';
const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';

/**
 * One transcript record, as the harness writes one.
 *
 * **`origin: { kind: 'human' }` ON A USER RECORD IS LOAD-BEARING** — it is the
 * column `ownerTyped` reads, and a fixture without it is a fixture in which he
 * never typed anything. The harness writes it on every prompt a person
 * produced and on nothing else; `core/anchor-pass.ts` carries the count.
 */
const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
  ...(role === 'user' ? { origin: { kind: 'human' }, promptSource: 'typed' } : {}),
});

/** A turn holding a table the grammar will certainly recognise and relabel. */
const TABLE_TURN = say(
  'assistant',
  ['## Counts', '', '| seq | what |', '| --- | --- |', '| 1 | a |'].join('\n'),
  '2026-09-10T09:00:02.000Z',
);

/**
 * **A table NO PROBE CAN REACH**, which is the only way to put a row in front
 * of the SWEEP rather than the probe pass.
 *
 * The probes are the literal substrings `|---` and `| ---`. A GFM delimiter
 * row written with alignment colons and no spaces — `|:---:|:---:|` — contains
 * neither, because every `|` in it is followed by `:`. It is still a delimiter
 * row by `isDelimiter`'s own rule, so the GRAMMAR accepts what the PROBES
 * never offer, which is exactly the gap `sweepAutomaticAnchors` exists to
 * cover and the shape `test/cli/anchors.test.ts` already uses for it.
 */
const UNPROBED_TURN = say(
  'assistant',
  ['## Out of reach', '', '|head|tail|', '|:---:|:---:|', '|1|2|'].join('\n'),
  '2026-09-10T09:00:03.000Z',
);

const TURNS = [
  say('user', 'begin', '2026-09-10T09:00:00.000Z'),
  // His words AND the id, because the WORDS are what fires now: a `ruling`
  // stopped being a normative id on 2026-09-15 and became the line he typed.
  say('user', `from now on you must apply ${RULING}`, '2026-09-10T09:00:01.000Z'),
  TABLE_TURN,
  UNPROBED_TURN,
];

/** Where record `n` starts, in BYTES — the only position an anchor takes. */
function offsetOf(n: number): number {
  let at = 0;
  for (let i = 0; i < n; i += 1) at += Buffer.byteLength(JSON.stringify(TURNS[i]), 'utf8') + 1;
  return at;
}

interface Fixture { cwd: string; home: string; dbPath: string; anchorFile: string; dir: string }

function fixture(withLane = false): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-kinds-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-kinds-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const lines = (rows: unknown[]): string => rows.map((r) => JSON.stringify(r)).join('\n') + '\n';
  writeFileSync(path.join(dir, `${SESSION}.jsonl`), lines(TURNS));
  if (withLane) {
    const laneDir = path.join(dir, SESSION, 'subagents');
    mkdirSync(laneDir, { recursive: true });
    writeFileSync(path.join(laneDir, `${LANE}.jsonl`), lines([TABLE_TURN]));
    writeFileSync(path.join(laneDir, `${LANE}.meta.json`), JSON.stringify({
      toolUseId: 'toolu_kinds', spawnDepth: 1, description: LANE_NAME,
    }));
  }
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    assert.equal(runCli(['conversation', 'rebuild'], cwd, () => {}), 0);
  } finally { process.chdir(previous); }
  return {
    cwd,
    home,
    dir,
    dbPath: path.join(cwd, '.my_context', '.index.db'),
    anchorFile: path.join(cwd, '.my_context', '.anchors.jsonl'),
  };
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

/* ── 1. THE TWO VOCABULARIES ─────────────────────────────────────────────── */

test('the owner\'s kinds and the automatic pass\'s kinds do not overlap', () => {
  assert.ok(OWNER_ANCHOR_KINDS.length > 0, 'an empty vocabulary would make everything below '
    + 'vacuously true — this is the anti-vacuity half and it is not decoration');
  assert.ok(AUTOMATIC_ANCHOR_KINDS.length > 0);

  const automatic = new Set<string>(AUTOMATIC_ANCHOR_KINDS);
  const shared = OWNER_ANCHOR_KINDS.filter((kind) => automatic.has(kind));
  assert.deepEqual(
    shared, [],
    'THE ITEM\'S OWN CONSTRAINT: "Any owner kind must sit OUTSIDE the automatic set (table, '
    + 'ruling) so reconciliation cannot confuse the two." A shared word would be a row that '
    + 'reads as either half of §7 to anything that ever comes to read `kind` without `origin` '
    + 'beside it.',
  );

  for (const kind of AUTOMATIC_ANCHOR_KINDS) {
    assert.equal(
      isOwnerAnchorKind(kind), false,
      `a request must not be able to ask for kind "${kind}" — that is the pass's own word for `
      + 'what it writes, and the whole reason the write route pins what it pins',
    );
  }
  assert.equal(
    isOwnerAnchorKind('note'), true,
    'and the predicate really does say yes to something — without this it is green when it '
    + 'returns false for everything, which would refuse him the vocabulary this item gives him',
  );
});

/* ── 2. THE PASS DECLINES HIS ROWS, WHATEVER KIND THEY WEAR ──────────────── */

test('the automatic pass leaves an owner row alone whatever kind it carries', () => {
  const f = fixture();
  try {
    // The byte the probes DO reach: the table turn, which the rebuild already
    // marked. Everything below stands at that same byte, so nothing here can
    // be explained by the pass simply not looking.
    const index = ConversationIndex.open(f.dbPath);
    let tableByte = -1;
    let rulingByte = -1;
    try {
      for (const row of index.anchorRows(null)) {
        if (row.kind === 'table') tableByte = row.byteOffset;
        if (row.kind === 'ruling') rulingByte = row.byteOffset;
      }
    } finally { index.close(); }
    assert.ok(tableByte >= 0 && rulingByte >= 0,
      'the fixture must produce one table anchor and one ruling anchor, or the pass is not '
      + 'reaching these bytes and this test proves nothing about what it declines to do');

    // **THE CONTROL.** An automatic row at the table's byte, wearing a label
    // the grammar will certainly replace. If this one does NOT move, the pass
    // was asleep and every assertion below is worthless.
    const write = ConversationIndex.open(f.dbPath);
    const kinds = [...OWNER_ANCHOR_KINDS, ...AUTOMATIC_ANCHOR_KINDS];
    try {
      markAnchor(write, {
        sessionId: SESSION, byteOffset: tableByte, label: 'stale', kind: 'table',
        origin: 'automatic',
      });
      // His rows, one per kind, each at a byte the pass reaches. They share the
      // ruling turn's byte with an offset so each gets its own derived id —
      // ids come from the POSITION, so two rows need two positions.
      kinds.forEach((kind, i) => {
        markAnchor(write, {
          sessionId: SESSION,
          byteOffset: rulingByte + i,
          label: `his ${kind}`,
          kind,
          origin: 'owner',
          note: `what he wanted to say about the ${kind}`,
        });
      });

      const report = markAutomaticAnchors(write);
      assert.ok(
        report.relabelled >= 1,
        'THE CONTROL: the pass must have relabelled the stale automatic row at the same byte. '
        + 'A run that changed nothing would make "his rows were not changed" a statement about '
        + 'a pass that never ran.',
      );
      assert.equal(
        report.dropped, 0,
        'and it took nothing back — an `origin: owner` row at a byte whose grammar says NO is '
        + 'the case that would delete a hand-made bookmark, which is the worst defect available '
        + 'here',
      );
    } finally { write.close(); }

    const after = new Map(
      (() => {
        const read = ConversationIndex.openReadOnlyChecked(f.dbPath);
        try { return allAnchors(read).map((r) => [r.id, r] as const); } finally { read.close(); }
      })(),
    );
    kinds.forEach((kind, i) => {
      const row = after.get(`${SESSION}:-:${rulingByte + i}`);
      assert.ok(row !== undefined, `his ${kind} bookmark was DELETED by the automatic pass`);
      assert.equal(row!.label, `his ${kind}`, `his ${kind} bookmark was relabelled by the pass`);
      assert.equal(row!.kind, kind, `his ${kind} bookmark had its kind re-derived by the pass`);
      assert.equal(row!.origin, 'owner');
      assert.equal(
        row!.note, `what he wanted to say about the ${kind}`,
        `his ${kind} bookmark lost its note. \`markAnchor\` writes the WHOLE row, so a field `
        + 'the pass omits is not "unchanged" — it is null, which is how a relabel erases a '
        + 'paragraph silently.',
      );
    });

    const control = after.get(`${SESSION}:-:${tableByte}`);
    assert.equal(
      control?.label, 'Counts — seq | what',
      'and the control really did move, to the composed label of the table it points at',
    );
  } finally { tidy(f); }
});

/**
 * **A RELABEL REWRITES THE WHOLE ROW, SO EVERY FIELD IT OMITS IS ERASED.**
 *
 * This test exists because two removal proofs found nothing holding the two
 * lines that carry `note` through a relabel — one in the probe pass, one in
 * the sweep. Breaking either changed no assertion in this file, which is a
 * line nobody was testing rather than a line nobody needs: `markAnchor` is a
 * public door and takes `origin: 'automatic'` with a note from any caller, and
 * `readAnchorFile` will read such a row straight off the document.
 *
 * Both paths are exercised, because they are two separate `markAnchor` calls
 * with two separate field lists and neither one can cover the other.
 */
test('relabelling an automatic row keeps every field the grammar did not re-derive', () => {
  const f = fixture();
  try {
    const probed = offsetOf(2);
    const swept = offsetOf(3);
    const write = ConversationIndex.open(f.dbPath);
    try {
      for (const byteOffset of [probed, swept]) {
        markAnchor(write, {
          sessionId: SESSION,
          byteOffset,
          label: 'stale',
          kind: 'table',
          origin: 'automatic',
          at: '2026-09-11T06:00:00.000Z',
          note: `a detail standing at ${byteOffset}`,
        });
      }
      const report = markAutomaticAnchors(write);
      assert.ok(report.relabelled >= 2,
        'both rows must actually be relabelled, or this says nothing about what a relabel '
        + `keeps — the run reported ${report.relabelled}`);
    } finally { write.close(); }

    const read = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const rows = new Map(allAnchors(read).map((r) => [r.byteOffset, r] as const));
      assert.equal(
        rows.get(probed)?.label, 'Counts — seq | what',
        'the PROBE path relabelled this one — it is a byte the `|---` probe returns',
      );
      assert.equal(
        rows.get(swept)?.label, 'Out of reach — head | tail',
        'and the SWEEP relabelled this one, which no probe offers. Without this half the '
        + 'assertion below covers one of the two `markAnchor` calls and reads as covering both.',
      );
      for (const byteOffset of [probed, swept]) {
        assert.equal(
          rows.get(byteOffset)?.note, `a detail standing at ${byteOffset}`,
          'the note was erased by a relabel. `markAnchor` writes the WHOLE row, so a field the '
          + 'pass omits is not "unchanged" — it is null.',
        );
      }

      // **THE TWO PATHS DO NOT AGREE ABOUT `at`, AND THIS RECORDS IT AS THE
      // FACT IT IS RATHER THAN THE WISH IT LOOKS LIKE.** Found while writing
      // this test, and it predates 2026-09-15 by every line involved:
      //
      //   - the SWEEP re-marks with `at: row.at` — the anchor's own stamp,
      //     which is what its header argues for;
      //   - the PROBE pass re-marks with `at: hit.at ?? now` — the TURN's
      //     timestamp out of the prose index.
      //
      // Neither churns: `hit.at` is a property of the byte, so a second run
      // writes the same value and the list does not reorder. But a bookmark
      // relabelled through one path and then the other would move once, and
      // the two spellings of "when" are one fact recorded twice.
      //
      // It is NOT repaired here: levelling them rewrites `at` on 750 of the
      // owner's anchors and reorders the list he reads, which is his call to
      // make and not a lane's. Asserted so that the day somebody does level
      // them, this line says which half changed.
      assert.equal(
        rows.get(swept)?.at, '2026-09-11T06:00:00.000Z',
        'the sweep carries the anchor\'s own stamp over',
      );
      assert.equal(
        rows.get(probed)?.at, '2026-09-10T09:00:02.000Z',
        'and the probe pass takes the TURN\'s — stable across runs, and a different fact',
      );
    } finally { read.close(); }
  } finally { tidy(f); }
});

/* ── 3. THE FILE IS THE TRUTH, NOTE INCLUDED ─────────────────────────────── */

test('a note survives deleting the whole index, because the document is what holds it', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, {
        sessionId: SESSION, byteOffset: 0, label: 'the decision about offsets',
        kind: 'decision', origin: 'owner', note: 'he ruled bytes, not characters, on 2026-09-11',
      });
    } finally { index.close(); }

    const onDisk = readAnchorFile(f.anchorFile).rows.find((r) => r.kind === 'decision');
    assert.equal(
      onDisk?.note, 'he ruled bytes, not characters, on 2026-09-11',
      'the note reached the DOCUMENT and not only the table. A field that lived in the index '
      + 'alone would be a second store, which is what this whole mechanism exists to refuse.',
    );

    // The index is defined as disposable. Deleting it must lose nothing.
    rmSync(f.dbPath, { force: true });
    rebuildConversations(f.dbPath, process.env, f.cwd);
    const rebuilt = ConversationIndex.open(f.dbPath);
    try {
      reconcileAnchors(rebuilt);
      const back = allAnchors(rebuilt).find((r) => r.kind === 'decision');
      assert.equal(
        back?.note, 'he ruled bytes, not characters, on 2026-09-11',
        'and it came back from the file after the whole index was deleted — the property the '
        + 'anchors document was bought for, now covering the new column too',
      );
      assert.equal(back?.kind, 'decision', 'with his own word for what it is, intact');
    } finally { rebuilt.close(); }
  } finally { tidy(f); }
});

test('an anchor with no note writes no `note` field at all, and reads back as null', () => {
  const f = fixture();
  try {
    const index = ConversationIndex.open(f.dbPath);
    try {
      markAnchor(index, {
        sessionId: SESSION, byteOffset: 0, label: 'no detail here', kind: 'note', origin: 'owner',
      });
      markAnchor(index, {
        sessionId: SESSION, byteOffset: 8, label: 'whitespace is not a detail', kind: 'note',
        origin: 'owner', note: '   ',
      });
    } finally { index.close(); }

    const text = readFileSync(f.anchorFile, 'utf8');
    for (const line of text.split('\n').filter((l) => l !== '')) {
      const row = JSON.parse(line) as Record<string, unknown>;
      assert.ok(
        !('note' in row),
        'a null note must be OMITTED from the document, not written as `"note":null`. 749 of '
        + 'his 750 anchors will never carry one, and writing the field on every line would '
        + `rewrite the whole file the day the column landed — this line did: ${line}`,
      );
    }

    const back = readAnchorFile(f.anchorFile).rows;
    assert.ok(back.length >= 2, 'both rows must be in the document or this proves nothing');
    for (const row of back) {
      assert.equal(
        row.note, null,
        'and an absent field reads back as null rather than undefined — `""` and `null` in one '
        + 'column is the two-namespaces defect `dispatched_by` was repaired for',
      );
    }
  } finally { tidy(f); }
});

/* ── 4. WHICH LANE MADE THE MARK ─────────────────────────────────────────── */

test('an anchor made inside a lane names the lane; one made by the session names none', () => {
  const f = fixture(true);
  try {
    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.equal(
        laneNameOf(index, LANE), LANE_NAME,
        'THE LANE WAS ALWAYS IN THE DATABASE AND NOTHING SHOWED IT. `anchors.agent_id` joins '
        + '`subagents.agent_id`, and `subagents.description` is the line the dispatcher typed. '
        + 'Measured on his corpus 2026-09-15: 386 of 750 anchors carry a lane id and every one '
        + 'of those 386 resolves to a row with a description.',
      );
      assert.equal(
        laneNameOf(index, null), null,
        'and a null agentId is the MAIN SESSION, not a lane whose name is missing. 364 of his '
        + '750 are this. `STD-a-measured-zero-is-drawn-and-named`: say so, do not invent an '
        + 'owner for them.',
      );
      assert.equal(
        laneNameOf(index, 'agent-the-archive-never-held'), null,
        'and a lane the archive no longer holds a row for is null too — the third state, which '
        + 'a reader tells apart by the agentId being set. Zero of his are in it today.',
      );
    } finally { index.close(); }
  } finally { tidy(f); }
});
