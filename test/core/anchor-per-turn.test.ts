// @basis REQ-every-anchor-capability-is-reachable-from-the-screen-and-a, TASK-the-automatic-marking-stopped-and-said-nothing-because-a, INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when
/**
 * **CREATION PATH 1: A TRANSCRIPT BEING APPENDED TO GETS ITS ANCHORS AS IT
 * GOES** — owner's design, 2026-09-12.
 *
 * His words: *"1 ongoing appended payload to the conversation would have
 * anchores created on the fly"*. `markAnchorsOnTurn` (`core/anchor-pass.ts`)
 * is the one line that landing needs, and this is the proof that the line
 * would do what it claims — taken HERE rather than through the Stop hook,
 * because another lane was measuring `src/hooks/stop.ts` on the day this was
 * written and two lanes editing one file is how a measurement gets attributed
 * to the wrong change.
 *
 * ── WHAT IS PROVED, AND WHAT IS DELIBERATELY NOT ──────────────────────────
 *
 * PROVED: a turn appended after the last pass is marked by the next one; a
 * turn that is not an anchor by nature is still not marked; a point the reader
 * marked by hand survives; and the steady state on an archive that has not
 * moved is single-digit milliseconds, which is the measurement the expired
 * cost objection has to be answered with rather than quoted against.
 *
 * NOT PROVED: that the Stop hook calls it. It does not, by instruction, and
 * the function's own header says so. A test asserting the hook's behaviour
 * would be asserting a line nobody has written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  appendFileSync, mkdirSync, mkdtempSync, renameSync, statSync, writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import {
  ANCHOR_PROBE_LIMIT, ANCHOR_PROBE_PAGES, markAnchorsOnTurn, markAutomaticAnchors,
} from '../../src/core/anchor-pass.ts';
import { archiveFreshness, buildSearchIndex } from '../../src/core/conversation-search.ts';
import {
  ConversationIndex, projectDirName, rebuildConversations,
} from '../../src/core/conversation-index.ts';
import { markAnchor } from '../../src/core/anchors.ts';

const SESSION = 'sess-per-turn';
const RULING = 'RULE-a-citation-names-an-item-by-id-never-a-report-by-line-number';

const say = (role: 'user' | 'assistant', body: string, at: string): unknown => ({
  type: role,
  message: { role, content: role === 'user' ? body : [{ type: 'text', text: body }] },
  timestamp: at,
});

const FIRST = [
  say('user', 'let us begin', '2026-09-10T09:00:00.000Z'),
  say('assistant', 'nothing here is an anchor by nature', '2026-09-10T09:00:01.000Z'),
];

interface Fixture { cwd: string; home: string; transcript: string; dbPath: string }

function fixture(): Fixture {
  const home = mkdtempSync(path.join(tmpdir(), 'myctx-perturn-home-'));
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perturn-cwd-'));
  const dir = path.join(home, 'projects', projectDirName(cwd));
  mkdirSync(dir, { recursive: true });
  const transcript = path.join(dir, `${SESSION}.jsonl`);
  writeFileSync(transcript, FIRST.map((r) => JSON.stringify(r)).join('\n') + '\n');
  process.env['CLAUDE_CONFIG_DIR'] = home;
  const previous = process.cwd();
  process.chdir(cwd);
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    runCli(['conversation', 'rebuild'], cwd, () => {});
  } finally { process.chdir(previous); }
  return { cwd, home, transcript, dbPath: path.join(cwd, '.my_context', '.index.db') };
}

function tidy(f: Fixture): void {
  delete process.env['CLAUDE_CONFIG_DIR'];
  removeTree(f.cwd);
  removeTree(f.home);
}

/** What the Stop hook already does before the anchors would be marked. */
function turn(f: Fixture, record: unknown): void {
  appendFileSync(f.transcript, JSON.stringify(record) + '\n');
  rebuildConversations(f.dbPath, process.env, path.dirname(path.join(f.cwd, '.my_context')));
}

function labels(f: Fixture): string[] {
  const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
  try { return index.anchorRows(null).map((r) => r.label).sort(); } finally { index.close(); }
}

test('a turn appended after the last pass is marked by the next one', () => {
  const f = fixture();
  try {
    assert.deepEqual(labels(f), [],
      'the opening two turns are neither a table nor a ruling, so a pass that marked one of '
      + 'them would make every count below meaningless');

    turn(f, say('user', `and now: follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    const first = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(first, null);
    assert.equal(first!.anchors!.marked, 1,
      'the turn that arrived on this turn was not marked — which is the whole of creation '
      + 'path 1: a transcript being appended to gets its anchors as it goes');
    assert.deepEqual(labels(f), [RULING]);

    turn(f, say('assistant', 'still nothing by nature here', '2026-09-10T09:00:03.000Z'));
    const second = markAnchorsOnTurn(f.dbPath);
    assert.equal(second!.anchors!.marked, 0,
      'a turn that is not an anchor by nature was marked. The grammar has widened, and a list '
      + 'of bookmarks that fills with ordinary turns is one he stops reading.');
    assert.deepEqual(labels(f), [RULING]);

    turn(f, say('assistant',
      'measured.\n\n| tokenizer | hits |\n| --- | --- |\n| trigram | 14 |',
      '2026-09-10T09:00:04.000Z'));
    assert.equal(markAnchorsOnTurn(f.dbPath)!.anchors!.marked, 1);
    assert.deepEqual(labels(f), [RULING, 'tokenizer | hits'].sort());
  } finally { tidy(f); }
});

test('a point the reader marked by hand survives every per-turn pass', () => {
  const f = fixture();
  try {
    // **ON A TURN THE GRAMMAR WOULD RECOGNISE, and that is the whole of what
    // makes this test say anything.** A first draft marked byte 0 — a turn
    // holding no table and no ruling id — so no probe ever brought it back and
    // the probe loop's `origin === 'owner'` guard could be deleted with this
    // test still green. Caught by the removal proof, not by review.
    //
    // Marked HERE means the point is a candidate every run, and the only thing
    // between it and being relabelled to `RULE-…`/`ruling` is that one line.
    const ruling = say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z');
    const at = FIRST.reduce<number>(
      (sum, r) => sum + Buffer.byteLength(JSON.stringify(r), 'utf8') + 1, 0);
    turn(f, ruling);

    const index = ConversationIndex.open(f.dbPath);
    let id: string;
    try {
      id = markAnchor(index, {
        sessionId: SESSION, byteOffset: at, label: 'where it starts',
      }).id;
    } finally { index.close(); }

    for (let i = 0; i < 3; i += 1) {
      turn(f, say('assistant', `turn ${i} says nothing by nature`, '2026-09-10T09:01:00.000Z'));
      assert.notEqual(markAnchorsOnTurn(f.dbPath), null);
    }

    const after = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      const row = after.anchorRow(id);
      assert.deepEqual(
        row === null ? null : { label: row.label, origin: row.origin },
        { label: 'where it starts', origin: 'owner' },
        'a per-turn pass touched a point the reader marked. Running on every turn multiplies '
        + 'that failure by the length of the session, which is why it is asserted over three '
        + 'turns rather than one.',
      );
    } finally { after.close(); }
  } finally { tidy(f); }
});

test('a turn on which no transcript moved does not run the pass at all', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    markAnchorsOnTurn(f.dbPath);

    // **THE MEASUREMENT THAT MADE THIS BRANCH NECESSARY, taken on the owner's
    // own corpus on 2026-09-12 rather than assumed**: the prose build over 341
    // unchanged sources costs 3 ms — the 2026-09-11 resume clamp doing exactly
    // what it was built for — and the anchor pass costs a further **548-564 ms
    // every single run**, because it re-reads 574 probe candidates and 621 of
    // its own rows AT THEIR BYTES whether or not anything moved.
    //
    // That second number was never part of the expired cost objection, which
    // was about the prose index alone. Wiring the unscoped pass to the Stop
    // hook would have put half a second on every assistant turn — so the door
    // skips when nothing moved, and scopes to what did when something has.
    const report = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(report, null);
    assert.equal(report!.search.read.length, 0,
      'the prose build re-read a source on a turn where nothing was appended — the resume '
      + 'clamp has come undone, and the skip below rests on it');
    assert.equal(report!.anchors, null,
      'the pass RAN on a turn where no transcript moved. Over bytes nobody appended to, its '
      + 'answer is the answer it already gave, and paying ~550 ms of seeks for it on every '
      + 'assistant turn is the cost that keeps this off the per-turn path.');
    // A CEILING, generous against the measured 3 ms, because this runs on
    // whatever machine the suite runs on and a tight bound would be a flake
    // rather than a gate. What it refuses is the SECOND-scale cost.
    assert.ok(report!.search.ms < 1000,
      `the unchanged-archive turn cost ${report!.search.ms} ms. The cost objection that kept `
      + 'this off the per-turn path was about 1.8-2.1 s a run, and a pass that has drifted back '
      + 'to that order is one that must not be wired to the Stop hook.');
  } finally { tidy(f); }
});

test('the pass a turn does run is scoped to the transcript that moved', () => {
  const f = fixture();
  try {
    // A second session, marked and then left alone. Its rows must not be read
    // back on a turn that appended to the FIRST one — which is the whole of
    // what makes a per-turn pass affordable.
    const other = path.join(
      path.dirname(f.transcript), 'sess-per-turn-other.jsonl');
    writeFileSync(other, [
      say('user', `follow ${RULING}`, '2026-09-10T08:00:00.000Z'),
    ].map((r) => JSON.stringify(r)).join('\n') + '\n');
    rebuildConversations(f.dbPath, process.env, path.dirname(path.join(f.cwd, '.my_context')));
    markAnchorsOnTurn(f.dbPath);
    assert.equal(labels(f).length, 1, 'the other session should have been marked once');

    turn(f, say('assistant',
      'measured.\n\n| tokenizer | hits |\n| --- | --- |\n| trigram | 14 |',
      '2026-09-10T09:00:04.000Z'));
    const report = markAnchorsOnTurn(f.dbPath);
    assert.deepEqual(report!.search.read, [SESSION],
      'the prose build read a source other than the one that grew');
    assert.equal(report!.anchors!.marked, 1);
    // `probed` counts candidates the grammar was shown. Scoped, the other
    // session's ruling turn is filtered out before its record is ever read.
    assert.equal(report!.anchors!.probed, 1,
      'the scoped pass looked at a candidate outside the transcript that moved. Unscoped this '
      + 'is 574 candidates and ~550 ms on this workspace; scoped it is what arrived.');
    assert.equal(labels(f).length, 2);
  } finally { tidy(f); }
});

test('the SWEEP half is scoped too, so a turn never re-reads a row in a transcript that did not move', () => {
  const f = fixture();
  try {
    // A row the pass OWNS, standing at a turn its grammar does not recognise.
    // An unscoped run reads it back at its byte, finds nothing by nature, and
    // takes it back — which is correct for a rebuild and is exactly what a
    // per-turn run must not spend, because it is one seek per owned row and
    // this workspace holds 621 of them.
    //
    // **This assertion is here because a removal proof found the gap.**
    // Deleting the sweep's `only` check left every test green: the probe half
    // had an assertion of its own and the sweep half had none, so half a
    // measured optimisation was unprotected.
    const index = ConversationIndex.open(f.dbPath);
    let stale: string;
    try {
      stale = markAnchor(index, {
        sessionId: SESSION, byteOffset: 0, label: 'not a table and not a ruling',
        kind: 'table', origin: 'automatic',
      }).id;
    } finally { index.close(); }

    // A turn that appends to a DIFFERENT transcript, so this session does not
    // move and the stale row is out of scope.
    const other = path.join(path.dirname(f.transcript), 'sess-per-turn-elsewhere.jsonl');
    writeFileSync(other, JSON.stringify(
      say('user', 'somewhere else entirely', '2026-09-10T08:00:00.000Z')) + '\n');
    rebuildConversations(f.dbPath, process.env, path.dirname(path.join(f.cwd, '.my_context')));

    const report = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(report!.anchors, null, 'a transcript moved, so the pass should have run');
    assert.equal(report!.anchors!.dropped, 0,
      'the scoped pass read back a row in a transcript that did not move. That is one seek per '
      + 'owned row on every assistant turn — the cost this scoping was measured to remove.');

    const after = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.notEqual(after.anchorRow(stale), null,
        'the stale row was taken back on a turn that did not touch its transcript');
    } finally { after.close(); }

    // And the FULL pass — `mycontext conversation rebuild`, unscoped — is
    // still the run that trims it. The narrowing defers work; it never
    // silently forgives it.
    const full = ConversationIndex.open(f.dbPath);
    try {
      assert.equal(markAutomaticAnchors(full).dropped, 1,
        'the unscoped pass no longer takes back a row its grammar does not recognise — the '
        + 'scoping has stopped being a deferral and become a hole');
    } finally { full.close(); }
  } finally { tidy(f); }
});

test('a workspace nobody has scanned is answered as null, never as a new database', () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-perturn-bare-'));
  try {
    assert.equal(runCli(['init'], cwd, () => {}), 0);
    // A path inside a directory that does not exist: `ConversationIndex.open`
    // cannot create it, so this is the throw the caller must survive. The hook
    // composes this in its own `try` for the same reason `advanceMirrors` is
    // composed in one — a pass that failed must not cost the turn its refresh.
    const missing = path.join(cwd, 'no-such-directory', '.index.db');
    assert.equal(markAnchorsOnTurn(missing), null,
      'a failure escaped as a throw. On the Stop hook that is the whole turn\'s refresh report '
      + 'lost to a bookmark pass.');
  } finally { removeTree(cwd); }
});

/**
 * **THE TWO BOUNDS, AND THE PROPERTY THAT MAKES THEM SAFE** — added
 * 2026-09-12 when this door was wired to the `Stop` hook, whose platform
 * timeout is 3 seconds and whose overrun is a `taskkill /T` that costs the
 * turn its audit row.
 *
 * Everything the incremental prose build does is proportional to what MOVED,
 * which is the argument for running it per turn and is NOT a ceiling: a
 * workspace scanned before the prose index existed has its whole archive to
 * read on the first turn that asks — 875 MB and 8.6 s on this corpus.
 *
 * What both assertions below are really defending is the DIRECTION of the
 * bound. A budget that read a source part-way would write a
 * `prose_sources.bytes` that is not where the archive's scan reached, which is
 * the skew that cost 103.3 MB a run until 2026-09-11 and never healed by
 * itself. So a source that does not fit is not touched at all, and the proof
 * of that is the second half of each test: the next run, unbounded, finds it
 * exactly as it was and marks what it holds.
 */
test('a turn out of time leaves a transcript completely unread, and the next run still has it', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));

    const starved = markAnchorsOnTurn(f.dbPath, { budgetMs: 0 });
    assert.deepEqual(
      starved!.search.read, [],
      'a run with no budget at all read a source anyway — the clock is being consulted after '
      + 'the read rather than before it',
    );
    assert.equal(
      starved!.search.deferred, 1,
      'the source that was skipped for want of time was not counted. `deferred` is the only '
      + 'thing that can ever tell a reader the prose index is further behind than a turn can '
      + 'carry, and a silent zero reads as an archive that is up to date.',
    );
    assert.equal(starved!.anchors, null, 'and with nothing read, the grammar is not run');
    assert.deepEqual(labels(f), [], 'nothing was marked');

    // The next turn, with the ordinary budget. Nothing was consumed.
    const after = markAnchorsOnTurn(f.dbPath);
    assert.deepEqual(after!.search.read, [SESSION]);
    assert.equal(
      after!.anchors!.marked, 1,
      'the anchor a busy turn deferred was never marked. The bound must DEFER work and never '
      + 'forgive it — otherwise the archive silently loses bookmarks from exactly the turns on '
      + 'which the machine was busiest.',
    );
    assert.deepEqual(labels(f), [RULING]);
  } finally { tidy(f); }
});

test('a transcript too big for one turn is left for the rebuild, not read half way', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));

    // One byte of pending read is more than this turn will take. The bound is
    // on what the source would READ — its appended tail here, not its size.
    const tooBig = markAnchorsOnTurn(f.dbPath, { maxSourceBytes: 1 });
    assert.deepEqual(
      tooBig!.search.read, [],
      'a source larger than the per-turn bound was read anyway. Without this the clock alone '
      + 'is not a ceiling: it is only ever consulted BETWEEN sources, so one transcript needing '
      + 'a whole re-read — 106 MB in this workspace, about a second — can start at the last '
      + 'millisecond of the budget and overrun it by its own whole size.',
    );
    assert.equal(tooBig!.search.deferred, 1);
    assert.deepEqual(labels(f), []);

    // **AND THE ROW IT LEFT BEHIND IS UNTOUCHED**, which is what makes the
    // next run correct rather than merely possible. A bound implemented as a
    // small `cap` would have written `bytes === cap` here, failed
    // `previous.bytes < cap` for ever after, and re-read the same first bytes
    // on every single turn.
    const unbounded = markAnchorsOnTurn(f.dbPath);
    assert.equal(unbounded!.search.appended, 1,
      'the deferred source came back as a WHOLE re-read rather than a tail — the skipped run '
      + 'moved its row, which is the cost this bound exists to avoid');
    assert.equal(unbounded!.anchors!.marked, 1);
    assert.deepEqual(labels(f), [RULING]);
  } finally { tidy(f); }
});

/**
 * **AND THE SCOPE IS THE BYTES THAT ARRIVED, NOT THE TRANSCRIPT THEY ARRIVED
 * IN** — the bound that made this affordable enough to wire, measured on the
 * real corpus 2026-09-12 rather than assumed.
 *
 * Scoping to the transcripts that MOVED takes the pass from 346 sources to
 * six. It does not take it from 316 candidates to three, because the session
 * being typed into is both the transcript that moves every turn and the one
 * holding most of the archive's tables and rulings: every one of them came
 * back from the probes on every single turn, was re-read at its byte and
 * re-marked idempotently. **935 ms of a 3-second hook, for an answer already
 * given.**
 *
 * So a per-turn run also carries the byte each transcript was read FROM, and a
 * candidate behind it is skipped — same argument as the transcript-level
 * scoping, one level finer: over bytes nobody appended to, the grammar's
 * answer cannot have changed. The unscoped `mycontext conversation rebuild`
 * still reads everything, which is what a changed grammar is trimmed by.
 */
test('a second turn does not re-decide the anchor the first turn already marked', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    const first = markAnchorsOnTurn(f.dbPath);
    assert.equal(first!.anchors!.probed, 1, 'the ruling turn should be this turn\'s one candidate');
    assert.equal(first!.anchors!.marked, 1);

    // Another turn, holding nothing by nature. The ruling above is still in
    // the transcript and still matches the `RULE-` probe, so an unscoped pass
    // — and a pass scoped only to the transcript — reads it back again.
    turn(f, say('assistant', 'nothing by nature here', '2026-09-10T09:00:03.000Z'));
    const second = markAnchorsOnTurn(f.dbPath);
    assert.equal(
      second!.anchors!.probed, 0,
      'a candidate in bytes that did not move was read back again. On the owner\'s corpus that '
      + 'is 316 candidates re-decided every turn at 935 ms — the single largest term in the '
      + 'hook\'s 3-second budget, and every one of them an answer already given.',
    );
    assert.deepEqual(labels(f), [RULING], 'and the anchor already standing is untouched');

    // A third turn that IS an anchor by nature still arrives, so the narrowing
    // has not simply turned the pass off after its first run.
    turn(f, say('assistant',
      'measured.\n\n| tokenizer | hits |\n| --- | --- |\n| trigram | 14 |',
      '2026-09-10T09:00:04.000Z'));
    assert.equal(markAnchorsOnTurn(f.dbPath)!.anchors!.marked, 1);
    assert.deepEqual(labels(f), [RULING, 'tokenizer | hits'].sort());
  } finally { tidy(f); }
});

/**
 * **THE SWEEP TAKES THE BYTE FLOOR TOO, AND THIS ASSERTION EXISTS BECAUSE A
 * REMOVAL PROOF FOUND IT MISSING.**
 *
 * Deleting the floor from the sweep left every test green: the test above
 * covers the PROBE half, and the test before it covers a row in a transcript
 * that did not move at all. A row standing in the transcript that DID move, in
 * bytes that did not, had nothing on it — and that is the case that costs, not
 * the rare one: the sweep re-reads every row it owns at its own byte, and 621
 * of this workspace's 623 are in the session being typed into.
 */
test('the sweep skips its own rows in bytes that did not move, and the rebuild still trims them', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    assert.equal(markAnchorsOnTurn(f.dbPath)!.anchors!.marked, 1);

    // A row the pass OWNS, standing at byte 0 — the opening turn, which is
    // neither a table nor a ruling. An unscoped run reads it back, finds
    // nothing by nature, and takes it back.
    const index = ConversationIndex.open(f.dbPath);
    let stale: string;
    try {
      stale = markAnchor(index, {
        sessionId: SESSION, byteOffset: 0, label: 'not a table and not a ruling',
        kind: 'table', origin: 'automatic',
      }).id;
    } finally { index.close(); }

    // A turn appended to THIS transcript, so the session moves and byte 0 is
    // inside it — but behind the byte this run read from.
    turn(f, say('assistant', 'nothing by nature here', '2026-09-10T09:00:03.000Z'));
    const report = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(report!.anchors, null, 'a transcript moved, so the pass should have run');
    assert.equal(
      report!.anchors!.dropped, 0,
      'the scoped sweep read back a row in bytes that did not move. That is one seek per owned '
      + 'row of the live session on every assistant turn — 621 of them here.',
    );
    const after = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.notEqual(after.anchorRow(stale), null, 'and the row is still standing');
    } finally { after.close(); }

    // And the unscoped rebuild is still the run that trims it. The narrowing
    // defers work; it never silently forgives it.
    const full = ConversationIndex.open(f.dbPath);
    try {
      assert.equal(
        markAutomaticAnchors(full).dropped, 1,
        'the unscoped pass no longer takes back a row its grammar does not recognise — the '
        + 'byte floor has stopped being a deferral and become a hole',
      );
    } finally { full.close(); }
  } finally { tidy(f); }
});

/* ══ 2026-09-15 — THE DEFECT THAT KILLED MARKING FOR HALF AN HOUR ══════════
 *
 * `TASK-the-automatic-marking-stopped-and-said-nothing-because-a` and
 * `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when`.
 *
 * Everything above this line asserts the pass on an archive SMALLER than
 * `ANCHOR_PROBE_LIMIT`, where every probe returns everything it matches and
 * the ranking is therefore invisible. That is the whole reason the suite was
 * green throughout: the defect only exists once an archive holds more
 * candidates than a probe returns, and the fixtures never built one.
 *
 * Measured on the owner's live workspace on the day: the `"|---"` probe
 * matched 777 spans and returned the 200 best by `bm25()`, a ranking with no
 * opinion about recency. Of 15 turns since 10:30 that the grammar marks as
 * tables, 6 were inside that window and exactly those 6 carried anchors.
 */

/**
 * **THE REPRODUCTION. A new table in an archive that already holds more tables
 * than one probe returns.**
 *
 * The precondition is ASSERTED rather than assumed, and that is the point of
 * the first two assertions: a fixture that quietly stopped producing an
 * over-full probe window would turn this into a test of nothing, passing
 * forever over the exact defect it was written for.
 */
test('a turn is marked even when the archive holds more tables than one probe returns', () => {
  const f = fixture();
  try {
    // More candidates than one probe may return, each a BETTER-RANKED match
    // than the turn that arrives last: `bm25()` normalises by document length,
    // so a bare table in a short turn outranks the same table inside a long
    // one. That is not a trick — it is the shape of the archive this failed
    // on, where the crowded-out turns were the ones with prose around them.
    const heavy = '| a | b |\n| --- | --- |\n| 1 | 2 |';
    for (let i = 0; i < ANCHOR_PROBE_LIMIT + 50; i += 1) {
      turn(f, say('assistant', heavy, `2026-09-10T10:${String(i % 60).padStart(2, '0')}:00.000Z`));
    }
    assert.notEqual(markAnchorsOnTurn(f.dbPath), null,
      'the pass must run at all before anything below means much');

    // THE NEW TURN: one table, arriving last, in a long turn — the shape of
    // every table the owner was actually looking at.
    const fresh = 'here is the measurement, and there is a great deal of prose around it so that '
      + 'the span is long and its term frequency low, which is exactly the shape a relevance '
      + 'ranking puts last. it goes on for a while precisely so that the ranking has something '
      + 'to push down, in the way a real answer with a table at the end of it does.\n\n'
      + '| reader | sees |\n| --- | --- |\n| the table | nothing |\n';
    turn(f, say('assistant', fresh, '2026-09-10T11:00:00.000Z'));

    // ── THE PASS RUNS FIRST, AND ONLY THEN IS THE WINDOW INSPECTED ────────
    //
    // A first draft read the prose index here to state the preconditions, and
    // reading it meant BUILDING it — which consumed the very tail the pass was
    // about to be measured on, and turned the run below into `nothing-moved`.
    // The candidate set is the same either way (the pass only adds spans, and
    // the ranking over them is the same ranking), so the window is asked about
    // afterwards and the pass faces the state a real turn faces.
    const report = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(report, null, 'the pass failed outright');

    const index = ConversationIndex.open(f.dbPath);
    let outsideWindow: boolean;
    let candidates: number;
    try {
      // The probe string is the one that actually matches these tables — a
      // window computed with a probe the fixture does not produce would be
      // empty, and an empty window contains nothing, which would make
      // PRECONDITION 2 below pass by vacuum.
      const all = index.matchProse('"| ---"', {}, ANCHOR_PROBE_LIMIT * ANCHOR_PROBE_PAGES);
      candidates = all.length;
      const window = index.matchProse('"| ---"', {}, ANCHOR_PROBE_LIMIT);
      assert.equal(window.length, ANCHOR_PROBE_LIMIT,
        'the relevance window did not even fill, so there is no truncation here to prove '
        + 'anything about');
      const newest = all.reduce((a, b) => (b.byteOffset > a.byteOffset ? b : a));
      outsideWindow = !window.some((h) => h.byteOffset === newest.byteOffset);
    } finally { index.close(); }

    // ── PRECONDITION 1, asserted: the archive really is over-full ──────────
    assert.ok(
      candidates > ANCHOR_PROBE_LIMIT,
      `the fixture built ${candidates} table span(s), which is not more than the `
      + `${ANCHOR_PROBE_LIMIT} a probe returns — so this test is no longer standing on the `
      + 'condition the defect needs and proves nothing about it',
    );
    // ── PRECONDITION 2, asserted: the newest table really is ranked out ────
    assert.ok(
      outsideWindow,
      `the newest table span is inside the top-${ANCHOR_PROBE_LIMIT} relevance window, so the `
      + 'unscoped probe would have found it anyway and this test cannot tell the fix from its '
      + 'absence. The fixture has stopped carrying the defect.',
    );

    // ── AND THE CLAIM ─────────────────────────────────────────────────────
    assert.equal(report!.did, 'marked', 'the pass did not run on a turn that appended a table');
    assert.ok(
      labels(f).includes('reader | sees'),
      'THE DEFECT IS BACK. A table the grammar recognises was appended, the archive read it, and '
      + 'the pass was never shown it — because the probe asked for the best '
      + `${ANCHOR_PROBE_LIMIT} matches in the whole archive instead of the matches in what was `
      + 'appended. This is the exact failure of 2026-09-15: every layer green, feature dead.',
    );
  } finally { tidy(f); }
});

/**
 * **AND THE UNSCOPED REBUILD REACHES EVERY CANDIDATE, WHICH IT COULD NOT.**
 *
 * The other half of the same measurement, and the one a per-turn fix does not
 * touch: with 777 table spans and a bound of 200, the 577 behind them could
 * not be marked by ANY run — including `mycontext conversation rebuild`, which
 * is the run whose whole job is to reach everything. A reader who noticed a
 * missing bookmark and ran the rebuild would have got the same 200 back.
 */
test('the unscoped rebuild marks past one probe page, and says so when it cannot', () => {
  const f = fixture();
  try {
    const rows = ANCHOR_PROBE_LIMIT + 40;
    for (let i = 0; i < rows; i += 1) {
      turn(f, say('assistant',
        `| run ${i} | value |\n| --- | --- |\n| ${i} | ${i * 2} |`,
        `2026-09-10T12:${String(i % 60).padStart(2, '0')}:00.000Z`));
    }
    const index = ConversationIndex.open(f.dbPath);
    let report;
    try {
      buildSearchIndex(index);
      report = markAutomaticAnchors(index);
    } finally { index.close(); }

    assert.ok(
      report.marked > ANCHOR_PROBE_LIMIT,
      `the rebuild marked ${report.marked} of ${rows} table turns. A bound of `
      + `${ANCHOR_PROBE_LIMIT} has become a ceiling on how many bookmarks this archive can ever `
      + 'hold, and the run that exists to reach everything reaches 200 of them',
    );
    assert.equal(
      report.capped, false,
      'the pass reports itself capped on an archive it exhausted in '
      + `${ANCHOR_PROBE_PAGES} page(s) — which would make the disclosure meaningless by firing `
      + 'on every ordinary rebuild',
    );
  } finally { tidy(f); }
});

/**
 * **THE STALL, REPRODUCED: a frozen row against a growing file, and the
 * product SAYS SO** — the item's closing condition 3, in its own words.
 *
 * *"Freeze the recorded size against a growing file and assert the product
 * SAYS so. Any fix whose test only proves the happy path leaves exactly the
 * hole this defect lived in — every layer was already green while the feature
 * was dead."*
 *
 * Appending WITHOUT the scan is the freeze, and it is not contrived: it is
 * exactly what a killed hook, a stood-down pass, or a refresh that lost its
 * lock leaves behind — a conversations row that has stopped describing the
 * file it names, while the file goes on growing.
 */
test('a row behind its file is reported as "could not look", never as "nothing to do"', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    assert.equal(markAnchorsOnTurn(f.dbPath)!.anchors!.marked, 1, 'the pass must start level');

    // LEVEL: nothing moved and nothing is behind. This is the answer that must
    // stay distinguishable from the one below it.
    const quiet = markAnchorsOnTurn(f.dbPath);
    assert.equal(quiet!.anchors, null);
    assert.equal(
      quiet!.did, 'nothing-moved',
      'an archive level with its files that read nothing had nothing to read, and calling that '
      + 'anything else would make the disclosure below fire on every ordinary turn',
    );
    assert.deepEqual(quiet!.stale, [], 'and nothing is behind');

    // ── THE FREEZE. The file grows; the row does not. ─────────────────────
    const table = '| reader | sees |\n| --- | --- |\n| the table | nothing |';
    appendFileSync(f.transcript, JSON.stringify(
      say('assistant', table, '2026-09-10T09:00:03.000Z'),
    ) + '\n');
    // deliberately NO rebuildConversations — that is the stall

    const stalled = markAnchorsOnTurn(f.dbPath);
    assert.notEqual(stalled, null, 'the pass failed outright');
    assert.equal(
      stalled!.anchors, null,
      'the pass cannot mark what the archive has not read, and pretending otherwise would be a '
      + 'worse defect than the silence',
    );
    assert.equal(
      stalled!.did, 'could-not-look',
      'THE SILENCE IS BACK. The archive is behind the file it indexes and the pass answered the '
      + 'same thing it answers on a quiet turn. Those are the two answers '
      + '`STD-nothing-to-do-and-could-not-look-are-different-answers` forbids sharing a value, '
      + 'and merging them is what made half an hour of dead marking invisible on 2026-09-15.',
    );
    const behind = stalled!.stale.find((s) => s.key === SESSION);
    assert.notEqual(behind, undefined, 'and it must name WHICH source, not merely that one is');
    assert.equal(
      behind!.behind, statSync(f.transcript).size - behind!.rowBytes,
      'the disclosure must carry the NUMBER. "behind" without "by how much" cannot separate a '
      + 'transcript being typed into right now from one frozen for half an hour, which is the '
      + 'distinction `INV-a-turn-that-qualifies-for-an-automatic-mark-carries-one-when` asks '
      + 'the screen for in as many words.',
    );

    // ── AND IT HEALS, which is the "it must work again" half ─────────────
    rebuildConversations(f.dbPath, process.env, path.dirname(path.join(f.cwd, '.my_context')));
    const healed = markAnchorsOnTurn(f.dbPath);
    assert.equal(healed!.did, 'marked',
      'the scan caught up, so the pass must have been offered the turn it could not see before');
    assert.ok(
      labels(f).includes('reader | sees'),
      'the table that arrived during the stall was never marked once the archive caught up — so '
      + 'the stall does not merely delay bookmarks, it loses them',
    );
    assert.deepEqual(
      markAnchorsOnTurn(f.dbPath)!.stale, [],
      'and the archive reports itself level again — a disclosure that never clears is an alarm '
      + 'nobody reads',
    );
  } finally { tidy(f); }
});

/**
 * **A FILE THAT WILL NOT ANSWER IS NOT A FILE THAT IS LEVEL**, and this is the
 * assertion that keeps the detector from being the defect it was written to
 * prevent. `behind: null` and the row still returned; `0` would be a measured
 * zero the measurement never made.
 */
test('a transcript that will not stat is disclosed, not silently counted as caught up', () => {
  const f = fixture();
  try {
    turn(f, say('user', `follow ${RULING}`, '2026-09-10T09:00:02.000Z'));
    markAnchorsOnTurn(f.dbPath);

    const index = ConversationIndex.openReadOnlyChecked(f.dbPath);
    try {
      assert.deepEqual(archiveFreshness(index), [], 'level before the file goes away');
    } finally { index.close(); }

    const moved = `${f.transcript}.moved`;
    renameSync(f.transcript, moved);
    try {
      const gone = ConversationIndex.openReadOnlyChecked(f.dbPath);
      try {
        const answer = archiveFreshness(gone);
        const row = answer.find((s) => s.key === SESSION);
        assert.notEqual(
          row, undefined,
          'a transcript the archive holds a row for and cannot stat came back as CAUGHT UP. That '
          + 'is the substitution `STD-nothing-to-do-and-could-not-look-are-different-answers` '
          + 'names, made by the function written to prevent it.',
        );
        assert.equal(row!.fileBytes, null);
        assert.equal(
          row!.behind, null,
          'reported as a measured number of bytes behind. It is not behind by any number — the '
          + 'file would not answer, and `0` here would be a measurement nobody took',
        );
      } finally { gone.close(); }
    } finally { renameSync(moved, f.transcript); }
  } finally { tidy(f); }
});
