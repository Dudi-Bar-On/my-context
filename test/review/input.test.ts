// @basis TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// INV-nothing-is-dropped-silently
//
// `INV-nothing-is-dropped-silently` is the whole of this file. Every test
// below that is not about points is about a shortfall being NAMED: the cap,
// the budget, the unreadable file, the excluded lanes. The one thing this
// module must never do is return a small number that reads like a quiet
// session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { gather, wholenessLine } from '../../src/review/input.ts';
import { SESSION_SUMMARY_MARKER } from '../../src/core/session-summary.ts';
import { removeTree } from '../helpers/tmp.ts';

/** One transcript record, in the shape the harness writes. */
function record(type: 'user' | 'assistant', text: string, at: string): string {
  return JSON.stringify({
    type,
    timestamp: at,
    message: { role: type, content: [{ type: 'text', text }] },
  });
}

/** A record with no `message` at all — stage 1's 62.5%, and it must still count. */
function machinery(at: string): string {
  return JSON.stringify({ type: 'file-history-snapshot', timestamp: at });
}

function writeTranscript(file: string, lines: string[]): number {
  const text = lines.map((line) => `${line}\n`).join('');
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, text, 'utf8');
  return Buffer.byteLength(text, 'utf8');
}

const RULING = 'The owner ruling is that the archive stops asking and starts deciding, ' +
  'because a screen that asks twice is a screen nobody trusts.';
const SECOND = 'We decided to keep the byte offset rather than the record index, so that a ' +
  'resumed read cannot shift silently.';

test('a whole read says so, and the points are the whole file', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [
      record('assistant', RULING, '2026-09-10T01:00:00Z'),
      machinery('2026-09-10T01:00:01Z'),
      record('assistant', SECOND, '2026-09-10T01:00:02Z'),
    ]);
    const got = gather({ transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: null });
    assert.equal(got.whole, true);
    assert.deepEqual(got.skipped, []);
    assert.equal(got.records, 3, 'the machinery record is WALKED and counted, not skipped');
    assert.deepEqual(got.sources, [file]);
    assert.ok(got.points.length >= 2, `expected both rulings as points, got ${got.points.length}`);
    assert.ok(got.points.every((p) => p.source === file), 'every point names the file it came from');
    assert.match(wholenessLine(got), /^read WHOLE:/);
  } finally { removeTree(dir); }
});

// ── THE ONE THE WHOLE MODULE IS FOR ────────────────────────────────────────
//
// §3a: "always read the whole file, send only what is new since the last
// pass." `sinceByte` bounds what is RETURNED. If it ever bounds the SCAN,
// `records` goes down with `points` and this test is what says so.
test('sinceByte bounds what is returned and NOT what is scanned', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const first = [record('assistant', RULING, '2026-09-10T01:00:00Z')];
    const prefixBytes = writeTranscript(file, first);
    writeTranscript(file, [...first, record('assistant', SECOND, '2026-09-10T01:00:02Z')]);

    const got = gather({
      transcript: file, sinceByte: prefixBytes, includeSubagents: false, subagentDir: null,
    });
    assert.equal(got.whole, true, 'reading the whole and returning part of it is still whole');
    assert.equal(got.records, 2, 'BOTH records were walked');
    assert.ok(got.points.length >= 1);
    assert.ok(
      got.points.every((p) => p.recordIndex >= 1),
      'a point from before sinceByte was returned — the offset is bounding the wrong thing',
    );
  } finally { removeTree(dir); }
});

test('sinceByte at the end of the file yields no points and readTo is the size', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const bytes = writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const got = gather({
      transcript: file, sinceByte: bytes, includeSubagents: false, subagentDir: null,
    });
    assert.equal(got.points.length, 0);
    assert.equal(got.readTo, bytes);
    assert.equal(got.whole, true, 'nothing new is not the same as something skipped');
  } finally { removeTree(dir); }
});

test('sinceByte PAST the end is a replaced file, and it is disclosed rather than quiet', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const bytes = writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const got = gather({
      transcript: file, sinceByte: bytes + 5000, includeSubagents: false, subagentDir: null,
    });
    assert.equal(got.points.length, 0);
    assert.equal(got.whole, false);
    assert.equal(got.skipped[0]?.why, 'shrank');
    assert.match(wholenessLine(got), /NOT read whole/);
  } finally { removeTree(dir); }
});

test('our own injected summary never re-enters the points', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [
      record('assistant', `${SESSION_SUMMARY_MARKER}\n${RULING}`, '2026-09-10T01:00:00Z'),
    ]);
    const got = gather({ transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: null });
    assert.equal(
      got.points.length, 0,
      'the loop guard was defeated: a summary this feature produced became input to the next one',
    );
    assert.equal(got.records, 1, 'and it was still WALKED — dropped at the filter, not unread');
  } finally { removeTree(dir); }
});

test('a transcript that is not there is disclosed, never reported as an empty pass', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'never-written.jsonl');
    const got = gather({ transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: null });
    assert.equal(got.whole, false);
    assert.equal(got.skipped[0]?.why, 'unreadable');
    assert.match(wholenessLine(got), /NOT read whole/);
    assert.match(wholenessLine(got), /FLOOR/);
  } finally { removeTree(dir); }
});

// ── THE SUBAGENTS, WHICH ARE 8.4x THE SESSION FILE ON THIS CORPUS ──────────

function laneDir(root: string, lanes: [string, string[]][]): string {
  const dir = path.join(root, 'subagents');
  mkdirSync(dir, { recursive: true });
  for (const [id, lines] of lanes) writeTranscript(path.join(dir, `${id}.jsonl`), lines);
  return dir;
}

test('subagent transcripts are read, and every point names its own lane', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const lanes = laneDir(dir, [
      ['agent-a1', [record('assistant', SECOND, '2026-09-10T01:00:03Z')]],
    ]);
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: true, subagentDir: lanes,
    });
    assert.equal(got.whole, true);
    assert.equal(got.sources.length, 2);
    const fromLane = got.points.filter((p) => p.source.includes('agent-a1'));
    assert.ok(fromLane.length >= 1, 'the lane transcript produced no points at all');
  } finally { removeTree(dir); }
});

// ── THE FINDING THAT COST THE MOST TO SEE, MEASURED 2026-09-10 ────────────
//
// In a lane transcript the DISPATCH BRIEF is a `type: 'user'` record, so the
// reader labels it `person` and admits it on the person's much lower bar. Over
// all 280 of this workspace's lane transcripts that is 1,927 person points
// against 1,165 model points, and NONE of it was typed by a person: it is the
// parent model quoting items the corpus already holds. A loop that learned
// from it would be the corpus proposing its own rules back to itself.
test('a lane’s dispatch brief is not evidence, and dropping it is counted', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const brief = 'The owner ruling is that a lane declares what it rests on, and you must ' +
      'reuse the exported helpers rather than re-spell them.';
    const lanes = laneDir(dir, [
      ['agent-a1', [
        record('user', brief, '2026-09-10T01:00:02Z'),
        record('assistant', SECOND, '2026-09-10T01:00:03Z'),
      ]],
    ]);
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: true, subagentDir: lanes,
    });
    const fromLane = got.points.filter((p) => p.source.includes('agent-a1'));
    assert.ok(fromLane.length >= 1, 'the lane produced no points at all');
    assert.ok(
      fromLane.every((p) => p.who === 'model'),
      'a dispatch brief came back labelled as something a person typed. Nobody types in a ' +
      'lane; every user-side record there is the prompt, a tool result or a reminder.',
    );
    assert.ok(
      fromLane.every((p) => !p.text.includes('reuse the exported helpers')),
      'the brief itself is in the points',
    );
    assert.ok(got.briefPoints >= 1, 'the drop was silent — it must be counted and printed');
    assert.match(wholenessLine(got), /dispatch brief/);
    // And the SESSION file keeps its person side, which is the whole reason
    // the reader labels it that way.
    assert.equal(got.briefPoints, 1);
  } finally { removeTree(dir); }
});

test('the session’s own person-side points are untouched by that filter', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [record('user', RULING, '2026-09-10T01:00:00Z')]);
    const got = gather({ transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: null });
    assert.ok(
      got.points.some((p) => p.who === 'person'),
      'the owner’s own typing was filtered out of his own session',
    );
    assert.equal(got.briefPoints, 0);
  } finally { removeTree(dir); }
});

test('includeSubagents: false NAMES the lanes it did not read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const lanes = laneDir(dir, [
      ['agent-a1', [record('assistant', SECOND, '2026-09-10T01:00:03Z')]],
    ]);
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: lanes,
    });
    assert.equal(
      got.whole, false,
      'the lanes hold the reasoning; a pass that skipped them and called itself whole is ' +
      'the overstatement this module exists to prevent',
    );
    assert.equal(got.skipped.length, 1);
    assert.equal(got.skipped[0]?.why, 'excluded');
    assert.match(wholenessLine(got), /includeSubagents is off/);
  } finally { removeTree(dir); }
});

test('a session that dispatched no lanes is still whole', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: true,
      subagentDir: path.join(dir, 'no-such-dir'),
    });
    assert.equal(got.whole, true, 'no lanes is an ordinary state, not a shortfall');
  } finally { removeTree(dir); }
});

// ── THE BUDGET, AND THE CAP ────────────────────────────────────────────────

test('a budget that bites drops the OLDEST lane and names it', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    const sessionBytes = writeTranscript(file, [record('assistant', RULING, '2026-09-10T01:00:00Z')]);
    const lanes = laneDir(dir, [
      ['agent-old', [record('assistant', SECOND, '2026-09-10T01:00:03Z')]],
      ['agent-new', [record('assistant', SECOND, '2026-09-10T01:00:04Z')]],
    ]);
    // `agent-new` is made the newer of the two by touching it after the fact.
    utimesSync(path.join(lanes, 'agent-old.jsonl'), new Date(1e9), new Date(1e9));
    utimesSync(path.join(lanes, 'agent-new.jsonl'), new Date(2e9), new Date(2e9));

    const oneLane = Buffer.byteLength(
      `${record('assistant', SECOND, '2026-09-10T01:00:03Z')}\n`, 'utf8',
    );
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: true, subagentDir: lanes,
      budgetBytes: sessionBytes + oneLane,
    });
    assert.equal(got.whole, false);
    assert.equal(got.skipped.length, 1, 'exactly one lane should have fallen outside the budget');
    assert.match(got.skipped[0]?.file ?? '', /agent-old/, 'the OLDEST lane is the one to drop');
    assert.equal(got.skipped[0]?.why, 'budget');
    assert.ok(
      got.sources.some((s) => s.includes('agent-new')),
      'the newest lane should have been read',
    );
    assert.match(wholenessLine(got), /budget was already spent/);
  } finally { removeTree(dir); }
});

test('the per-file cap biting is a DIFFERENT fact from a file that would not read', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-gather-'));
  try {
    const file = path.join(dir, 'session.jsonl');
    writeTranscript(file, [
      record('assistant', RULING, '2026-09-10T01:00:00Z'),
      record('assistant', SECOND, '2026-09-10T01:00:02Z'),
    ]);
    const got = gather({
      transcript: file, sinceByte: 0, includeSubagents: false, subagentDir: null, capBytes: 40,
    });
    assert.equal(got.whole, false);
    assert.equal(got.skipped[0]?.why, 'cap', 'a cap this build chose is not an unreadable file');
    assert.ok(
      (got.skipped[0]?.readBytes ?? 0) <= 40,
      'the cap must bound the read, not merely be reported',
    );
    assert.match(wholenessLine(got), /per-file cap/);
  } finally { removeTree(dir); }
});
