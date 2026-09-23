// @basis TASK-release-phase-3-the-defects,
// TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it
//
// B8: one workspace held a single `readTo`, shared by every transcript that
// ever passed through it. Two sessions through the same workspace — the
// ordinary case, not an edge one — meant the second session's transcript was
// read from the FIRST session's byte offset: it either skipped its own head
// (the inherited offset landed past where this transcript's own content
// starts) or re-read what a prior pass had already returned (the inherited
// offset landed short of where this transcript's own tail was). This file
// proves the fix is keyed by transcript, and that a report written before
// this change still reads — as the CURRENT transcript's offset, `pass.ts`'s
// `lastReadTo` says why that is the conservative direction and where it is
// not unconditionally so.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { lastReadTo, passReportPath, runPass } from '../../src/review/pass.ts';
import { NO_QUEUE_CEILING } from '../../src/review/propose.ts';
import { removeTree } from '../helpers/tmp.ts';

/** One assistant record, shaped the way `input.ts`'s reader expects one. */
function record(text: string, at: string): string {
  return JSON.stringify({
    type: 'assistant', timestamp: at,
    message: { role: 'assistant', content: [{ type: 'text', text }] },
  });
}

const RULING = 'B8: the offset a pass resumes from belongs to the transcript it is reading, ' +
  'never to whichever transcript a shared workspace happened to see last.';

/** A workspace with review enabled. No transcript yet — each test writes its own. */
function project(): { cwd: string; root: string } {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-pass-offset-'));
  runCli(['init'], cwd, () => {});
  const root = path.join(cwd, '.my_context');
  writeFileSync(
    path.join(root, 'config.json'),
    JSON.stringify({ profile: 'standard', review: { enabled: true } }, null, 2) + '\n',
  );
  return { cwd, root };
}

function transcript(cwd: string, name: string, lines: string[]): string {
  const file = path.join(cwd, name);
  writeFileSync(file, lines.map((l) => `${l}\n`).join(''), 'utf8');
  return file;
}

test('a pass over transcript A does not move transcript B\'s offset', async () => {
  const { cwd, root } = project();
  try {
    const a = transcript(cwd, 'a.jsonl', [record(RULING, '2026-09-22T01:00:00Z')]);
    const b = transcript(cwd, 'b.jsonl', [record(RULING, '2026-09-22T01:05:00Z')]);

    // Neither has been read yet — a fresh workspace, both offsets are 0.
    assert.equal(lastReadTo(root, a), 0);
    assert.equal(lastReadTo(root, b), 0);

    const passA = await runPass({
      workspace: root, transcript: a, sessionId: 's-a', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: null,
    });
    assert.ok(passA.readTo > 0, 'the pass over A stopped somewhere past byte 0');

    // THE BUG, IN ONE ASSERTION: before the fix, `lastReadTo` took no
    // transcript argument and answered from the one shared scalar, so this
    // would read A's offset back for B. Post-fix, B is untouched.
    assert.equal(lastReadTo(root, b), 0, 'B was never read, so B\'s offset is still 0');
    assert.equal(lastReadTo(root, a), passA.readTo, 'A resumes from where A itself stopped');
  } finally { removeTree(cwd); }
});

test('a pass over B after a pass over A reads B from its own byte 0, and A\'s offset survives it', async () => {
  const { cwd, root } = project();
  try {
    const a = transcript(cwd, 'a.jsonl', [record(RULING, '2026-09-22T01:00:00Z')]);
    const b = transcript(cwd, 'b.jsonl', [
      record(RULING, '2026-09-22T02:00:00Z'),
      record(RULING, '2026-09-22T02:01:00Z'),
    ]);

    const passA = await runPass({
      workspace: root, transcript: a, sessionId: 's-a', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: null,
    });
    const passB = await runPass({
      workspace: root, transcript: b, sessionId: 's-b', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: null,
    });

    // What `gather` actually received for B, via the report it produced:
    // `sinceByte` is `runPass`'s own record of what it asked `gather` to
    // resume from. Before the fix this would equal `passA.readTo`, not 0.
    assert.equal(passB.sinceByte, 0, 'B was handed to gather from byte 0, not A\'s offset');
    assert.equal(passB.records, 2, 'so both of B\'s own records were read, not skipped');

    // The map carries BOTH transcripts forward — a pass over B must not
    // erase what the pass over A already recorded.
    assert.equal(Object.keys(passB.readToByTranscript).length, 2, 'A\'s entry survived a pass over B');
    assert.equal(lastReadTo(root, a), passA.readTo, 'A\'s offset is unchanged by a pass over B');
    assert.equal(lastReadTo(root, b), passB.readTo, 'B\'s offset now reflects B\'s own pass');
  } finally { removeTree(cwd); }
});

test('a pre-B8 report — a bare scalar readTo, no map — reads as the asked-about transcript\'s offset when that offset fits the file', () => {
  const { cwd, root } = project();
  try {
    mkdirSync(path.join(root, 'state'), { recursive: true });
    // The exact old shape: `readToByTranscript` did not exist yet.
    writeFileSync(passReportPath(root), JSON.stringify({ readTo: 900 }, null, 2), 'utf8');

    // Two transcripts, each at least as large as the legacy offset: 900
    // COULD be either one's own offset, so the fallback answers it for both.
    const a = transcript(cwd, 'a.jsonl', [record('x'.repeat(900), '2026-09-22T01:00:00Z')]);
    const b = transcript(cwd, 'b.jsonl', [record('x'.repeat(900), '2026-09-22T02:00:00Z')]);
    assert.ok(statSync(a).size >= 900 && statSync(b).size >= 900,
      'fixtures must be at least as large as the legacy offset for this case to mean anything');

    // A pre-B8 report cannot say which transcript its scalar described, so
    // it answers for whichever one is asked — the conservative fallback
    // `lastReadTo` documents, not a guess pinned to one transcript's key.
    assert.equal(lastReadTo(root, a), 900);
    assert.equal(lastReadTo(root, b), 900);
  } finally { removeTree(cwd); }
});

test('a pre-B8 report\'s scalar readTo does NOT apply to a transcript shorter than it', async () => {
  const { cwd, root } = project();
  try {
    mkdirSync(path.join(root, 'state'), { recursive: true });
    writeFileSync(passReportPath(root), JSON.stringify({ readTo: 900 }, null, 2), 'utf8');

    // A transcript well under 900 bytes — the legacy offset cannot possibly
    // be ITS offset, so `lastReadTo` must refuse it rather than hand
    // `gather` a `sinceByte` past this file's own end.
    const small = transcript(cwd, 'small.jsonl', [record(RULING, '2026-09-22T03:00:00Z')]);
    assert.ok(statSync(small).size < 900, 'fixture must be smaller than the legacy offset');
    assert.equal(lastReadTo(root, small), 0,
      '900 cannot be this transcript\'s own offset, so the answer is 0, not gather\'s `shrank` guard');

    // And the pass itself — not just the helper function — reads from 0.
    // Before this fix, `sinceByte` here would have been 900 against a file
    // shorter than that, tripping `gather`'s `shrank` branch: zero points,
    // `whole: false`, and `readToByTranscript` stamped at this file's full
    // size regardless — silently losing the whole transcript on every pass
    // after the first.
    const pass = await runPass({
      workspace: root, transcript: small, sessionId: 's-small', subagentDir: null,
      includeSubagents: false, dryRun: true, maxProposals: 0, queueCeiling: NO_QUEUE_CEILING,
      model: null,
    });
    assert.equal(pass.sinceByte, 0, 'gather was asked to read small.jsonl from its own byte 0');
    assert.equal(pass.whole, true, 'and it read the whole (short) file — no `shrank` skip');
    assert.equal(pass.records, 1, 'its one record was actually read, not silently dropped');
  } finally { removeTree(cwd); }
});
