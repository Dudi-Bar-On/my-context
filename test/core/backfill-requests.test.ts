// @basis TASK-an-item-records-the-request-that-produced-it-in-the-owner-s, INV-nothing-is-dropped-silently
/**
 * **The backfill, and the one mistake that would have poisoned it silently.**
 *
 * D41 spec §16a, plan Task 18. `scripts/backfill-requests.ts` writes to 1,076
 * real items in the owner's corpus, so every test here is about what it must
 * NOT do:
 *
 *  1. **A LANE'S DISPATCH BRIEF IS NEVER TREATED AS THE OWNER'S REQUEST.**
 *     This is the load-bearing test of the whole task. A brief is stored as a
 *     `type: 'user'` record, and `plan:loop seq:2` measured what a naive sweep
 *     finds: 1,453,700 characters of person-side text across 280 lanes, 33x
 *     the 44,006 the owner actually typed, and none of it his. The failure
 *     would be invisible AFTERWARDS, because a brief written into `request`
 *     reads exactly like a request — so it has to be caught here.
 *  2. **An ambiguous mapping SKIPS.** Two prompts that quote an item about
 *     equally well are not a match to pick between; an empty field is honest
 *     and a wrong one is not.
 *  3. **Adjacency is not evidence.** The prompt the owner typed a minute
 *     before the write is not the request unless the item quotes it.
 *  4. **It is reversible, and the clear touches nothing else.** Body, summary,
 *     summary basis and the recorded checksum are all identical after a fill
 *     and after a clear — which is what makes running it at all defensible.
 *
 * Every fixture below is a transcript this test wrote, in the harness's own
 * JSONL shape, so nothing here depends on the owner's real archive being
 * present or unchanged.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  longestSharedRun, ownerTurns, stripReminders, sweep, type Report,
} from '../../scripts/backfill-requests.ts';
import { itemSummaryBasis } from '../../src/core/content-hash.ts';
import { parseItem } from '../../src/core/item.ts';
import { createItem } from '../../src/core/mutate.ts';
import { removeTree } from '../helpers/tmp.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** The words the owner actually typed, and the words the item then quoted. */
const OWNER_ASK = 'the injected endpoint collapses a missing seen file into a measured zero, so '
  + 'the screen says a file nobody opened was read. fix it and say what it now reports instead.';

/**
 * A dispatch brief, in the register a coordinator writes them in — including
 * the tell that makes this trap so dangerous: it quotes the item's own words
 * back, so a sweep that scored by content overlap alone would rate it a
 * BETTER match than the owner's real ask.
 */
const LANE_BRIEF = 'You are a lane in the my_context repo. Your task: the injected endpoint '
  + 'collapses a missing seen file into a measured zero, so the screen says a file nobody '
  + 'opened was read. Build it, test it, and prove every assertion by removal.';

const AT = Date.parse('2026-09-05T10:00:00.000Z');

function userRecord(text: string, at: number): string {
  return JSON.stringify({ type: 'user', timestamp: new Date(at).toISOString(), message: { content: text } });
}

function assistantRecord(text: string, at: number): string {
  return JSON.stringify({
    type: 'assistant',
    timestamp: new Date(at).toISOString(),
    message: { content: [{ type: 'text', text }] },
  });
}

interface Fixture {
  dir: string;
  transcripts: string;
  auditDir: string;
  cleanup(): void;
}

/** A transcript directory with one owner session and, optionally, lanes under it. */
function fixture(sessionRecords: string[], laneRecords: string[] = []): Fixture {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-backfill-'));
  const transcripts = path.join(dir, 'projects', 'D--repo');
  mkdirSync(transcripts, { recursive: true });
  writeFileSync(path.join(transcripts, 'session-1.jsonl'), `${sessionRecords.join('\n')}\n`, 'utf8');
  if (laneRecords.length > 0) {
    const lanes = path.join(transcripts, 'session-1', 'subagents');
    mkdirSync(lanes, { recursive: true });
    writeFileSync(path.join(lanes, 'agent-abc123.jsonl'), `${laneRecords.join('\n')}\n`, 'utf8');
  }
  const auditDir = path.join(dir, 'audit');
  mkdirSync(auditDir, { recursive: true });
  return { dir, transcripts, auditDir, cleanup: () => removeTree(dir) };
}

function writeCreates(
  auditDir: string, rows: { id: string; at: number; origin?: string }[],
): void {
  const lines = rows.map((r) => JSON.stringify({
    protocol: 'my_context/audit@2',
    kind: 'mutation',
    op: 'create',
    origin: r.origin ?? 'human',
    itemId: r.id,
    at: new Date(r.at).toISOString(),
  }));
  writeFileSync(path.join(auditDir, 'audit.jsonl'), `${lines.join('\n')}\n`, 'utf8');
}

/** The item every test below backfills onto — its body quotes the owner. */
function seed(box: Sandbox, body: string, title = 'The endpoint reports a zero it never measured'): string {
  return createItem(box.ctx, {
    type: 'known_issue',
    title,
    body,
    summary: 'A screen says it checked a session and found nothing, when it never checked at all.',
    origin: 'human',
  }).id;
}

function run(box: Sandbox, fx: Fixture, apply = false, clear = false): Report {
  return sweep({
    root: box.root,
    auditDir: fx.auditDir,
    transcripts: fx.transcripts,
    apply,
    clear,
  });
}

/* -------------------------------------------------------------------------- *
 * 1. THE DISPATCH BRIEF. THE ONE THAT MATTERS.
 * -------------------------------------------------------------------------- */

test('a lane\'s dispatch brief is NEVER recorded as the owner\'s request', () => {
  const box = sandbox();
  // The lane's brief quotes the item MORE closely than the owner's own ask —
  // the worst case on purpose. A sweep that read lane files at all would pick
  // the brief, and the result would read like a real request forever after.
  const fx = fixture(
    [
      userRecord(OWNER_ASK, AT - 60_000),
      assistantRecord('Fixed. It now reports "not read" and says so.', AT - 30_000),
    ],
    [
      userRecord(LANE_BRIEF, AT - 45_000),
      assistantRecord('Understood.', AT - 40_000),
    ],
  );
  try {
    const id = seed(box, `${OWNER_ASK} The endpoint returned 0 for a file it never opened.`);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx);

    assert.equal(report.filled.length, 1, 'plant: the owner\'s own ask IS found');
    assert.equal(
      report.filled[0].request, OWNER_ASK,
      'the recorded request is what the OWNER typed in the session transcript',
    );
    assert.equal(
      report.filled[0].request.includes('You are a lane'), false,
      'plan:loop seq:2: a lane transcript holds 1,453,700 characters of "person-side" text '
      + 'across 280 lanes, 33x what the owner typed and none of it his. One of them written '
      + 'into this field would be undetectable afterwards, because it reads like a request',
    );
    assert.equal(
      report.lanes.personRecords, 1,
      'and the exclusion is DISCLOSED rather than silent — the count of what was left out is '
      + 'the number a reader can interrogate (loop/2 prints it as briefPoints)',
    );
    assert.ok(report.lanes.personChars >= LANE_BRIEF.length);
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('with the owner\'s own ask removed, the brief still does not get used', () => {
  const box = sandbox();
  // The non-vacuity half of the test above: prove the brief is refused because
  // it is in a LANE file, not because the owner's ask happened to beat it.
  // The owner IS in this session — he simply never asked for this item. The
  // two turns bracket the create from outside the window, so the session
  // covers the moment and the skip is `no_candidate` rather than "no archive",
  // which is what makes the absence of the brief the thing being measured.
  const fx = fixture(
    [
      userRecord('something else entirely, hours earlier', AT - 5 * 3600_000),
      assistantRecord('Working on it.', AT - 30_000),
      userRecord('an unrelated thing, an hour later', AT + 3600_000),
    ],
    [userRecord(LANE_BRIEF, AT - 45_000)],
  );
  try {
    const id = seed(box, `${OWNER_ASK} The endpoint returned 0 for a file it never opened.`);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 0, 'nobody typed anything in a lane: there is no request');
    assert.equal(report.skipped.find((s) => s.id === id)?.why, 'no_candidate');
    assert.equal(
      report.lanes.personRecords, 1,
      'the brief was seen, counted, and not used — which is the whole distinction',
    );
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * 2. AMBIGUITY SKIPS, AND ADJACENCY IS NOT EVIDENCE.
 * -------------------------------------------------------------------------- */

test('two prompts that quote the item equally well produce NO request', () => {
  const box = sandbox();
  const fx = fixture([
    userRecord(`first thought: ${OWNER_ASK}`, AT - 600_000),
    assistantRecord('Noted.', AT - 500_000),
    userRecord(`saying it again: ${OWNER_ASK}`, AT - 60_000),
    assistantRecord('Noted again.', AT - 50_000),
  ]);
  try {
    const id = seed(box, OWNER_ASK);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 0);
    assert.equal(
      report.skipped.find((s) => s.id === id)?.why, 'ambiguous_candidate',
      'spec §16a: "where the mapping is ambiguous, SKIP — an empty field is honest and a '
      + 'wrong one is not". Picking the later one would be a coin toss with a citation on it',
    );
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('the prompt typed a minute before the write is NOT the request unless the item quotes it', () => {
  const box = sandbox();
  const fx = fixture([
    userRecord('carry on with whatever you were doing, i am going to sleep', AT - 60_000),
  ]);
  try {
    const id = seed(box, OWNER_ASK);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 0);
    const skip = report.skipped.find((s) => s.id === id);
    assert.equal(
      skip?.why, 'no_evidence',
      'adjacency is true of SOME prompt for every item ever created; it is not evidence, and '
      + 'a field filled from it would be a guess nobody could tell from a quotation',
    );
    assert.match(String(skip?.note), /1 candidate\(s\), best run \d+ chars/, 'and the skip says '
      + 'what it found, so it can be argued with rather than only counted');
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('an agent-origin item is skipped by rule, not for want of evidence', () => {
  const box = sandbox();
  const fx = fixture([userRecord(OWNER_ASK, AT - 60_000)]);
  try {
    const id = seed(box, OWNER_ASK);
    writeCreates(fx.auditDir, [{ id, at: AT, origin: 'agent' }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 0);
    assert.equal(
      report.skipped.find((s) => s.id === id)?.why, 'agent_origin',
      'spec §16a: an agent- or ingest-origin item has no request and must not be given one — '
      + 'even when a person\'s words are sitting right there in the window',
    );
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('an item created outside every surviving transcript is skipped, and says so', () => {
  const box = sandbox();
  const fx = fixture([userRecord(OWNER_ASK, AT - 60_000)]);
  try {
    const id = seed(box, OWNER_ASK);
    // Two years before anything in the archive.
    writeCreates(fx.auditDir, [{ id, at: AT - 700 * 24 * 3600_000 }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 0);
    assert.equal(report.skipped.find((s) => s.id === id)?.why, 'no_transcript');
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * 3. WHAT IT DOES WRITE, AND WHAT IT LEAVES ALONE.
 * -------------------------------------------------------------------------- */

test('the fill adds a request and moves NOTHING else — then --clear undoes it exactly', () => {
  const box = sandbox();
  const fx = fixture([
    userRecord(OWNER_ASK, AT - 60_000),
    assistantRecord('Done.', AT - 30_000),
  ]);
  try {
    const id = seed(box, `${OWNER_ASK} The endpoint returned 0 for a file it never opened.`);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const before = readFileSync(path.join(box.root, box.ctx.store.get(id)!.filePath), 'utf8');
    const beforeItem = parseItem(before, box.ctx.store.get(id)!.filePath, 'project');

    const filled = run(box, fx, true);
    assert.equal(filled.filled.length, 1, 'plant: it wrote');

    const file = path.join(box.root, box.ctx.store.get(id)!.filePath);
    const after = readFileSync(file, 'utf8');
    const afterItem = parseItem(after, box.ctx.store.get(id)!.filePath, 'project');

    assert.equal(afterItem.request, OWNER_ASK, 'the words are there, verbatim');
    assert.equal(afterItem.body, beforeItem.body, 'the body did not move');
    assert.equal(afterItem.summary, beforeItem.summary, 'nor the summary');
    assert.equal(afterItem.summaryOf, beforeItem.summaryOf, 'nor the basis it was written against');
    assert.equal(
      itemSummaryBasis(afterItem), itemSummaryBasis(beforeItem),
      'and the basis recomputed over the item as it now stands is unchanged, so nothing in '
      + 'this corpus goes stale because of the sweep',
    );
    assert.equal(
      afterItem.checksum, beforeItem.checksum,
      'and the recorded checksum is untouched — 1,076 items rewritten and `doctor` reports '
      + 'nothing, which is the property that makes the sweep undoable',
    );
    assert.equal(
      after.split('\n## Request\n')[0], before,
      'byte-for-byte above the section: only text was ADDED',
    );

    const cleared = run(box, fx, true, true);
    assert.equal(cleared.filled.length, 1, 'plant: it cleared one');
    assert.equal(
      readFileSync(file, 'utf8'), before,
      'spec §16a: "if the sweep proves wrong, the field clears without touching body, summary '
      + 'or checksum". The undo is byte-identical to the file before the sweep ran',
    );
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('a request already recorded is never overwritten', () => {
  const box = sandbox();
  const fx = fixture([userRecord(OWNER_ASK, AT - 60_000)]);
  try {
    const id = createItem(box.ctx, {
      type: 'known_issue',
      title: 'The endpoint reports a zero it never measured',
      body: OWNER_ASK,
      summary: 'A screen says it checked a session and found nothing.',
      origin: 'human',
      request: 'something a person recorded at the time, which this script was not there for',
    }).id;
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx, true);
    assert.equal(report.filled.length, 0);
    assert.equal(report.skipped.find((s) => s.id === id)?.why, 'already_has_one');
    assert.match(String(box.ctx.store.get(id)!.request), /^something a person recorded/);
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

test('a request spanning two consecutive owner turns is joined; one across an answer is not', () => {
  const box = sandbox();
  const tail = 'and say what it now reports instead of the zero.';
  const fx = fixture([
    userRecord('a thing i asked about hours ago and then dropped entirely', AT - 3_000_000),
    assistantRecord('OK.', AT - 2_900_000),
    userRecord(OWNER_ASK, AT - 120_000),
    userRecord(tail, AT - 110_000),
  ]);
  try {
    const id = seed(box, `${OWNER_ASK} The endpoint returned 0 for a file it never opened.`);
    writeCreates(fx.auditDir, [{ id, at: AT }]);

    const report = run(box, fx);
    assert.equal(report.filled.length, 1);
    assert.equal(
      report.filled[0].request, OWNER_ASK,
      'the winner is the turn the item quotes; the turn AFTER it is a separate record and is '
      + 'not swept in — only turns BEFORE it with no answer between are one utterance',
    );
    assert.equal(report.filled[0].joined, 1);
    assert.equal(
      report.filled[0].request.includes('hours ago'), false,
      'and the turn separated by an assistant answer is a different ask entirely',
    );
  } finally {
    fx.cleanup();
    box.dispose();
  }
});

/* -------------------------------------------------------------------------- *
 * 4. THE PARTS, ON THEIR OWN.
 * -------------------------------------------------------------------------- */

test('a system-reminder appended inside a real message is cut out and counted', () => {
  const said = 'do the thing\n<system-reminder>\nCLAUDE.md says X\n</system-reminder>';
  const cut = stripReminders(said);
  assert.equal(cut.text, 'do the thing');
  assert.equal(cut.stripped, 1, 'counted, because a removal that reported nothing would be a '
    + 'silent drop wearing a fix\'s clothes');
});

test('ownerTurns drops every synthetic person-side turn the summariser drops', () => {
  const fx = fixture([
    userRecord('<task-notification>lane finished</task-notification>', AT),
    userRecord('<command-name>/graphify</command-name>', AT + 1000),
    userRecord('<system-reminder>a whole reminder record</system-reminder>', AT + 2000),
    userRecord('a real thing the owner typed', AT + 3000),
  ]);
  try {
    const { turns } = ownerTurns(path.join(fx.transcripts, 'session-1.jsonl'), 'session-1');
    assert.deepEqual(
      turns.map((t) => t.text), ['a real thing the owner typed'],
      'the list is `syntheticKind` (session-summary.ts), imported rather than copied — a '
      + 'second copy of it here could drift, and a <task-notification> recorded as a request '
      + 'reads exactly like a request',
    );
  } finally {
    fx.cleanup();
  }
});

test('longestSharedRun finds a re-wrapped quotation and quotes it back from the original', () => {
  const prompt = 'the injected endpoint collapses a missing seen file into a measured zero';
  const body = 'We saw that the injected endpoint\ncollapses a missing seen file into a '
    + 'measured   zero, so the screen lies.';
  const run = longestSharedRun(prompt, body);
  assert.ok(
    run.length >= 40,
    `a hard-wrapped body must still match an unwrapped prompt; got ${run.length} chars`,
  );
  assert.ok(prompt.includes(run), 'and the run reported is text that really appears in the message');
  assert.equal(
    longestSharedRun('completely unrelated words about deployment pipelines', body).length < 40,
    true,
    'non-vacuity: two texts that share nothing produce nothing near the bar',
  );
});
