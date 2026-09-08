// @basis TASK-a-session-transcript-is-summarised-to-a-recipe-and-the, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * The session-transcript reader and its recipe — `plan:restore seq:1`, design
 * of record `docs/superpowers/specs/2026-09-07-session-summary-restore-design.md`
 * §4, §6, §7 and §8.
 *
 * **What is worth proving here, and what is scaffolding for it.**
 *
 *   1. **The loop guard actually guards** — `a summary this feature produced
 *      is never summarised again`. Design §6 says an injected summary joins
 *      the transcript like everything else, so the second run would summarise
 *      the first. The test feeds a real `renderPayload` output back in as a
 *      transcript record and asserts it is dropped AND counted. Both halves:
 *      a guard that dropped silently would be indistinguishable from a recipe
 *      that never saw it, which is `INV-nothing-is-dropped-silently`.
 *   2. **The snapshot makes a run repeatable** — `a byte offset pins the
 *      input, and the same offset gives the same answer after the file grows`.
 *      This is the item's addition 1, and the reason it matters is measured:
 *      the owner's transcript grew 9.9 MB between the spec being written and
 *      this module being built. The test appends to the file between two runs
 *      and asserts the pinned run is unchanged while the unpinned one moves.
 *   3. **The filter is structural, not a list of record type names** — `a
 *      record type nobody has heard of is dropped by shape, not by name`. The
 *      spec and the item both name seven types; the file carries seventeen.
 *      A whitelist would have been wrong within a day and wrong silently.
 *   4. **The cap is a quota, so the categories the owner values most cannot be
 *      crowded out** — `a flood of measurements does not evict the one
 *      correction`. Measured on the real transcript, a global top-N gave 45 of
 *      60 slots to measurements and ZERO to corrections and failures, the two
 *      §4b singles out as irreplaceable. This is the test that fails if
 *      somebody replaces the quota with a sort.
 *   5. **This reader and the archive's scanner agree** — `the reader and the
 *      archive count the same records`. Design §8 forbids a second scanner
 *      that drifts from the first; the walk could not be shared, so the counts
 *      are cross-checked instead and this is where a drift turns red.
 *
 * Everything runs against FIXTURES in a temp directory. Nothing here reads the
 * developer's own `~/.claude/projects`, nothing here writes anywhere but its
 * own temp directory, and the module under test opens no file for writing at
 * all — `plan:restore seq:1` is the READER; staging and injection are `seq:2`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  SESSION_SUMMARY_MARKER, crossCheckAgainstIndex, isMarkedSummary,
  renderPayload, renderReviewForm, scoreCandidate, snapshotBytes, summariseTranscript,
} from '../../src/core/session-summary.ts';
import { removeTree } from '../helpers/tmp.ts';

/** A throwaway transcript. Real JSONL, one record per line, as the harness writes it. */
function fixture(lines: unknown[]): { file: string; dispose: () => void } {
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-summary-'));
  const file = path.join(dir, 'session.jsonl');
  writeFileSync(file, `${lines.map((l) => JSON.stringify(l)).join('\n')}\n`, 'utf8');
  return { file, dispose: () => removeTree(dir) };
}

/** One `assistant` record carrying spoken words — the shape 1,840 real ones have. */
function answer(text: string, at = '2026-09-07T10:00:00.000Z'): unknown {
  return { type: 'assistant', timestamp: at, message: { role: 'assistant', content: [{ type: 'text', text }] } };
}

/** One `user` record carrying a typed prompt — the shape 279 real ones have. */
function prompt(text: string, at = '2026-09-07T10:00:00.000Z'): unknown {
  return { type: 'user', timestamp: at, message: { role: 'user', content: text } };
}

test('a summary this feature produced is never summarised again', () => {
  // Design §6. Build a real summary, render its real payload, and feed that
  // payload back in as a transcript record — which is exactly what happens
  // after `seq:2` injects one, because everything joins the transcript.
  const first = fixture([answer('We ruled that the index is derived, because losing it costs time and never knowledge.')]);
  const built = summariseTranscript(first.file);
  const payload = renderPayload(built);
  first.dispose();

  assert.ok(payload.includes(SESSION_SUMMARY_MARKER),
    'the payload must carry the marker, or nothing downstream can recognise it');
  assert.ok(isMarkedSummary(payload));

  const second = fixture([
    answer('We ruled that the index is derived, because losing it costs time and never knowledge.'),
    answer(payload),
    prompt(payload),
  ]);
  const again = summariseTranscript(second.file);

  // Both halves. Dropped:
  assert.equal(again.coverage.textRecords, 1,
    'only the original record survives; the two marked ones are dropped');
  // ...and COUNTED, so the review form can say the guard fired rather than
  // leaving a reader unable to tell a guard from an absence.
  assert.equal(again.coverage.droppedOwnSummary, 2,
    'the loop guard fires on BOTH sides of the exchange and says how often');
  second.dispose();
});

test('the marker survives a version bump, so a future payload is still recognised as ours', () => {
  // The stem is matched rather than the whole string, so a `/2` payload built
  // by a later build is still skipped by this one. Without this, the first
  // change to the payload shape silently disarms the loop guard.
  assert.ok(isMarkedSummary('[mycontext-session-summary/2] restored from …'));
  assert.ok(isMarkedSummary('… somewhere in the middle mycontext-session-summary/1 …'));
  assert.equal(isMarkedSummary('mycontext-carry-once/1'), false,
    'the neighbouring protocol string must not be mistaken for this one');
});

test('a byte offset pins the input, and the same offset gives the same answer after the file grows', () => {
  // The item's addition 1. Measured cause: the owner's transcript grew 9.9 MB
  // between the design being written and this module being built, and grew
  // again during the run that produced the report.
  const box = fixture([answer('We decided to keep the ledger, because the alternative loses the reason.')]);
  const pinned = snapshotBytes(box.file);
  const before = summariseTranscript(box.file, { upToBytes: pinned });

  appendFileSync(box.file,
    `${JSON.stringify(answer('We decided to drop the ledger, because it was measured at 4,000 rows.'))}\n`, 'utf8');

  const pinnedAgain = summariseTranscript(box.file, { upToBytes: pinned });
  const unpinned = summariseTranscript(box.file);

  assert.equal(pinnedAgain.coverage.records, before.coverage.records,
    'the pinned run must not see the appended record');
  assert.deepEqual(pinnedAgain.points.map((p) => p.text), before.points.map((p) => p.text),
    'the same offset over the same file is the same summary — that is what makes a review meaningful');
  assert.equal(unpinned.coverage.records, before.coverage.records + 1,
    'an unpinned run does see the growth, which is why the offset is a parameter');
  assert.ok(pinnedAgain.coverage.upToBytes < pinnedAgain.coverage.fileBytes,
    'and the result SAYS it was a snapshot rather than the whole file');
  box.dispose();
});

test('a record type nobody has heard of is dropped by shape, not by name', () => {
  // The spec and the item both list seven no-message types. Re-measured
  // 2026-09-08 the real file carries seventeen, ten of them unlisted —
  // `bridge-session`, `atis-latch`, `frame-link` and seven more. A whitelist
  // written yesterday was already wrong today, and wrong silently.
  const box = fixture([
    { type: 'attachment', timestamp: '2026-09-07T10:00:00.000Z' },
    { type: 'atis-latch', atis: {} },
    { type: 'a-type-invented-after-this-test-was-written', payload: { anything: true } },
    answer('We ruled the filter is structural, because a name list goes stale without saying so.'),
  ]);
  const summary = summariseTranscript(box.file);
  assert.equal(summary.coverage.records, 4);
  assert.equal(summary.coverage.droppedNoMessage, 3,
    'all three are dropped on the same structural test, including the invented one');
  assert.equal(summary.coverage.textRecords, 1);
  box.dispose();
});

test('a line that will not parse costs one record and never its neighbours', () => {
  // The archive scanner's tolerance rule, obeyed identically here. The COUNT
  // is asserted, not merely the neighbours' survival: a reader that swallowed
  // the bad line without counting it would pass a neighbours-only test.
  const dir = mkdtempSync(path.join(tmpdir(), 'myctx-summary-bad-'));
  const file = path.join(dir, 'session.jsonl');
  writeFileSync(file, [
    JSON.stringify(answer('We decided A, because B.')),
    '{ not json at all',
    '["a bare array, which is an object that is not a record"]',
    JSON.stringify(answer('We decided C, because D.')),
  ].join('\n') + '\n', 'utf8');

  const summary = summariseTranscript(file);
  assert.equal(summary.coverage.unreadable, 2,
    'the unparseable line AND the bare array each cost exactly one');
  assert.equal(summary.coverage.textRecords, 2, 'both neighbours survive');
  removeTree(dir);
});

test('text on the person side that no person typed is dropped, and each kind is counted separately', () => {
  // Stage 3, which the spec does not have. Measured on the real transcript:
  // `classifyTurn` calls 525 records prompts; 194 are `<task-notification>`,
  // 24 `isMeta`, 23 slash wrappers and 5 harness compaction summaries, leaving
  // 279 a person actually typed.
  const box = fixture([
    prompt('<task-notification> <task-id>abc</task-id> a lane finished and this is not something anybody said'),
    { type: 'user', isMeta: true, message: { role: 'user', content: 'injected meta text that is long enough to pass the length floor' } },
    prompt('<command-name>mycontext</command-name> a slash command wrapper, not a typed turn at all'),
    { type: 'user', isCompactSummary: true, message: { role: 'user', content: 'This session is being continued from a previous conversation. Summary: things happened.' } },
    prompt('we decided to keep the reader read-only, because injecting is a separate approval'),
  ]);
  const summary = summariseTranscript(box.file);
  assert.equal(summary.coverage.droppedTaskNotification, 1);
  assert.equal(summary.coverage.droppedMeta, 1);
  assert.equal(summary.coverage.droppedSlashCommand, 1);
  assert.equal(summary.coverage.droppedHarnessCompactionSummary, 1);
  assert.equal(summary.coverage.textRecords, 1, 'only the turn a person typed survives');
  assert.equal(summary.points.length, 1);
  assert.equal(summary.points[0]?.speaker, 'person');
  box.dispose();
});

test('a flood of measurements does not evict the one correction', () => {
  // The measured failure this quota exists to prevent. Over the real
  // transcript a global top-60 gave 45 slots to measurements and NONE to
  // corrections or failures — in a recipe whose own design calls a lost
  // correction "a mistake that will be made again". Replace `allocate` with a
  // sort and this goes red.
  const lines: unknown[] = [];
  for (let i = 0; i < 200; i += 1) {
    lines.push(answer(`We measured ${i} of 26,673 records and 1,024 items in run ${i}.`));
  }
  lines.push(answer('I was wrong about the record count; the truth is that the filter is structural.'));
  lines.push(answer('We tried the whitelist approach and it did not work, so it was abandoned.'));

  const box = fixture(lines);
  const summary = summariseTranscript(box.file, { maxPoints: 10 });

  assert.ok(summary.coverage.byCategory.measurement.admitted > 100,
    'the fixture really does flood the measurement category');
  assert.equal(summary.coverage.byCategory.correction.kept, 1,
    'the single correction survives 200 measurements');
  assert.equal(summary.coverage.byCategory.failure.kept, 1,
    'and so does the single failure');
  assert.ok(summary.coverage.byCategory.measurement.kept <= 8,
    'measurements take a quota share, not the whole summary');
  box.dispose();
});

test('the owner own words are admitted on a lower bar, and acknowledgements are not', () => {
  // Measured cause: the first run of this reader admitted 969 points and 7 of
  // them were the owner's. He typed 44,006 characters against the model's
  // 1,389,819, and the model spends much of that quoting him back — so his
  // sentence loses to the model's restatement of his sentence, in a feature
  // whose subject is his session.
  const box = fixture([
    prompt('supersede the first group and leave the rest, they are old rules from the migration'),
    prompt('ok go ahead'),
    prompt('yes'),
    answer('A paragraph with no cue words in it whatsoever, simply describing a thing plainly.'),
  ]);
  const summary = summariseTranscript(box.file);
  assert.equal(summary.coverage.personPoints, 1,
    'the substantive turn is admitted on a single cue');
  assert.equal(summary.coverage.droppedTooShort, 2,
    '"ok go ahead" and "yes" carry nothing to restore, and the count SAYS they were dropped');
});

test('a compaction boundary is read before the filter that would drop it, and anchors a range', () => {
  // A `compact_boundary` is a `system` record with no `message`, so stage 1
  // would drop it. It is the one such record this feature needs: design §4c's
  // range anchor. The real file carries five of them and 4,728,935 dropped
  // tokens behind them.
  const box = fixture([
    answer('We decided the first thing, because of the first reason.'),
    {
      type: 'system', subtype: 'compact_boundary', timestamp: '2026-09-07T11:00:00.000Z',
      compactMetadata: { trigger: 'auto', preTokens: 1000, postTokens: 30, cumulativeDroppedTokens: 970 },
    },
    answer('We decided the second thing, because of the second reason.'),
  ]);
  const whole = summariseTranscript(box.file);
  assert.equal(whole.compactions.length, 1);
  assert.equal(whole.compactions[0]?.recordIndex, 1);
  assert.equal(whole.compactions[0]?.cumulativeDroppedTokens, 970);
  assert.equal(whole.points.length, 2);

  const since = summariseTranscript(box.file, { range: { kind: 'compaction', nth: -1 } });
  assert.equal(since.points.length, 1, 'only what came after the boundary');
  assert.ok(since.points[0]?.text.includes('second'));
  assert.equal(since.coverage.droppedOutOfRange, 1, 'and it says how much it left behind');
  box.dispose();
});

test('code is skipped by default and carried when the lost thing IS the code', () => {
  // Design §4b skips code because it is already on disk and a copy goes stale;
  // §4c turns it back on for the case the whole option exists for — a reverted
  // patch, a command that worked, something that exists nowhere else.
  const fenced = 'We decided to keep this, because it is the only copy left.\n\n'
    + '```\nnode --run test -- --grep "the one command that worked"\n```';
  const box = fixture([answer(fenced)]);

  const without = summariseTranscript(box.file);
  assert.ok(without.points.some((p) => p.text.includes('only copy left')));
  assert.ok(!without.points.some((p) => p.text.includes('--grep')),
    'the fence is stripped before scoring, so no point can be earned by words inside it');

  const withCode = summariseTranscript(box.file, { includeCode: true });
  assert.ok(renderPayload(withCode).length >= renderPayload(without).length,
    'asking for code cannot produce less than not asking for it');
  box.dispose();
});

test('subjects narrow the read, and the review form says how much it left out', () => {
  const box = fixture([
    answer('We decided the ledger keeps its own DDL, because a schema bump drops the item index.'),
    answer('We decided the statusline shows the branch, because that is what a reader looks for.'),
  ]);
  const summary = summariseTranscript(box.file, { subjects: ['ledger'] });
  assert.equal(summary.points.length, 1);
  assert.equal(summary.coverage.droppedOffSubject, 1);
  assert.ok(renderReviewForm(summary).includes('off the named subjects'));
  box.dispose();
});

test('depth changes the rendering and never the points', () => {
  // Depth is a RENDERING choice on purpose, so the owner can deepen a summary
  // without paying for a second 61 MB read.
  //
  // The point is deliberately TWO sentences. A reason that is nearly the whole
  // point is the point printed twice, and `reasonOf` returns null for it — a
  // one-sentence fixture would prove the opposite of what this asserts.
  const box = fixture([answer(
    'We ruled the reader stays read-only. That is because the staging half needs an approval'
    + ' this lane does not have.',
  )]);
  const shallow = summariseTranscript(box.file, { depth: 'points' });
  const deep = summariseTranscript(box.file, { depth: 'points+reasoning' });
  assert.deepEqual(deep.points.map((p) => p.text), shallow.points.map((p) => p.text));
  assert.ok(deep.points[0]?.reason !== null, 'the "because" clause is found');
  assert.ok(renderReviewForm(deep).includes('reason:'));
  assert.ok(!renderReviewForm(shallow).includes('reason:'));
  box.dispose();
});

test('the review form is honest about coverage even when it kept nothing', () => {
  // Design §5: "A review form that reads as complete when it is partial is
  // worse than no review form." The empty case is the one most likely to read
  // as complete, so it is the one asserted.
  const box = fixture([answer('A plain sentence with nothing in it that any category recognises.')]);
  const summary = summariseTranscript(box.file);
  const form = renderReviewForm(summary);
  assert.equal(summary.points.length, 0);
  assert.ok(form.includes('nothing in range reached the admission threshold'));
  assert.ok(form.includes('records with words'), 'the coverage block prints regardless');
  assert.ok(form.includes('no message object'));
  box.dispose();
});

test('a transcript that is not there is an empty summary, never a throw', () => {
  // Design §8: Claude Code prunes old session files and a pruned session's row
  // is deleted, so a session that was never marked persistent cannot be
  // restored by this feature either. That is a state this reports.
  const summary = summariseTranscript(path.join(tmpdir(), 'myctx-summary-no-such-file.jsonl'));
  assert.equal(summary.coverage.records, 0);
  assert.equal(summary.coverage.fileBytes, 0);
  assert.equal(summary.points.length, 0);
  assert.equal(summary.marker, SESSION_SUMMARY_MARKER);
  assert.ok(renderReviewForm(summary).includes('POINTS — 0'));
});

test('the reader and the archive count the same records', async () => {
  // Design §8 forbids a second scanner that drifts from the first. The WALK
  // could not be shared — `scanTranscript` returns counts and exposes no seam
  // that yields records — so the counts are cross-checked instead, and this is
  // where a divergence turns red rather than showing up as two screens quoting
  // different numbers for one session.
  const box = fixture([
    answer('We measured 26,673 records in the file.'),
    prompt('supersede the first group and leave the rest of them alone'),
    { type: 'attachment' },
    { type: 'atis-latch' },
    { type: 'system', subtype: 'compact_boundary', compactMetadata: { trigger: 'auto' } },
  ]);
  const summary = summariseTranscript(box.file);
  assert.deepEqual(await crossCheckAgainstIndex(box.file, summary), [],
    'records, unreadable and bytes must agree with the archive scanner exactly');
  box.dispose();
});

test('a candidate needs more than a number to count as a measurement', () => {
  // The correction that made the quota usable. Before it, a grouped number and
  // a unit were worth 2 each, so ANY engineering paragraph containing "1,198"
  // and "130ms" scored 4 and walked in — which is how 550 of 969 admitted
  // points became measurements.
  assert.equal(scoreCandidate('It took 1,198 ms and used 40% of the budget.'), null,
    'numbers alone are prose in this corpus, not a measurement claim');
  assert.equal(scoreCandidate('We measured it again this morning.')?.category, 'measurement');
  assert.equal(scoreCandidate('862 of 1,198 citations moved.')?.category, 'measurement');
});

test('the reader opens no file for writing', () => {
  // `plan:restore seq:1` is the READER. Staging is `seq:2` and needs the
  // owner's approval to run at all (design §2, §3). This is asserted against
  // the SOURCE rather than by watching a run, because the dangerous case is a
  // write on a branch no fixture happens to take.
  const source = readFileSync(new URL('../../src/core/session-summary.ts', import.meta.url), 'utf8');
  for (const forbidden of ['writeFileSync', 'appendFileSync', 'mkdirSync', 'rmSync', 'openSync(file, \'w']) {
    assert.ok(!source.includes(forbidden),
      `the reader must not call ${forbidden} — injection is seq:2's, behind the owner's approval`);
  }
});
