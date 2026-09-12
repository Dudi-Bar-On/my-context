// @basis REQ-every-anchor-capability-is-reachable-from-the-screen-and-a
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
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import { runCli } from '../../src/cli/index.ts';
import { markAnchorsOnTurn, markAutomaticAnchors } from '../../src/core/anchor-pass.ts';
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
    assert.deepEqual(labels(f), [RULING, 'tokenizer'].sort());
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
