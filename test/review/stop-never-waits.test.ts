// @basis TASK-decide-when-to-look-at-a-session-and-read-the-whole-of-it,
// INV-hooks-fail-open
//
// ── THE LOAD-BEARING ASSERTION OF THIS WHOLE PHASE ─────────────────────────
//
// `Stop` is the hook where a person is staring at a prompt. Design §5 and §14
// both say the pass must never be awaited, and this file is the only place
// that can fail if it ever is.
//
// **It is asserted against a REAL detached child over a REAL 30 MB
// transcript**, not against an injected fake, because a fake `spawn` that
// returns instantly proves only that a fake returns instantly.
//
// ── AND IT IS A STATE ASSERTION, NOT A STOPWATCH ───────────────────────────
//
// The first draft compared `triggerMs` against the cost of the same read done
// inline and required a 4x margin. **It failed on the RESTORED code during its
// own mutation run** — a spawn on Windows costs ~100 ms of fixed overhead
// whatever the file holds, and right after a 60 MB fixture write it cost 486 ms
// against 711 ms of reading. A ratio that flaps is a mutation result nobody can
// use, and this repository has a ledger entry about a "10/10 killed" read taken
// against a red suite.
//
// So the proof is a FACT rather than a duration: **the pass has not finished
// when the trigger returns.** The report is the only thing the pass produces,
// and it does not exist yet. If the child were ever run inline — awaited,
// `execFileSync`, a synchronous fallback — the report would be on disk before
// the trigger returned, and this goes red on any machine at any speed.
//
// **There is no duration bound beside it at all**, and that is the same
// decision made twice: a `report.ms > triggerMs` net was tried and it flapped
// too, at 692ms of reading against a 1,382ms spawn on a loaded box. A stopwatch
// on a machine running other lanes measures the machine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { passReportPath, type PassReport } from '../../src/review/pass.ts';
import { reviewTrigger } from '../../src/review/trigger.ts';
import { bumpCounter } from '../../src/core/review-counter.ts';
import { removeTree } from '../helpers/tmp.ts';

/** ~30 MB. Large enough that no child could finish it inside a returning call. */
const RECORDS = 40_000;

const LINE = 'The owner ruling is that a pass reads the whole of a session and says so, ' +
  'because a conclusion drawn from a sample is one nobody can check.';

function bigTranscript(file: string): number {
  const rows: string[] = [];
  for (let n = 0; n < RECORDS; n += 1) {
    rows.push(JSON.stringify({
      type: n % 2 === 0 ? 'assistant' : 'user',
      timestamp: new Date(1_780_000_000_000 + n * 1000).toISOString(),
      message: {
        role: n % 2 === 0 ? 'assistant' : 'user',
        content: [{ type: 'text', text: `${LINE} (record ${n}, padded ${'x'.repeat(700)})` }],
      },
    }));
  }
  writeFileSync(file, rows.map((r) => `${r}\n`).join(''), 'utf8');
  return rows.length;
}

/** Wait for the detached child's report, or give up loudly. */
async function waitForReport(root: string, budgetMs: number): Promise<PassReport> {
  const until = Date.now() + budgetMs;
  for (;;) {
    if (existsSync(passReportPath(root))) {
      try {
        // The write is atomic (temp-file-and-rename), so a file that exists is
        // a file that parses — but the read can still lose a race with the
        // rename on Windows, and a retry is cheaper than a flaky suite.
        return JSON.parse(readFileSync(passReportPath(root), 'utf8')) as PassReport;
      } catch { /* fall through and retry */ }
    }
    if (Date.now() > until) {
      throw new Error(`the detached pass wrote no report within ${budgetMs}ms`);
    }
    await new Promise((resolve) => { setTimeout(resolve, 50); });
  }
}

test('Stop returns before the pass has finished, and the pass still reads the whole of it', async () => {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-never-wait-'));
  try {
    runCli(['init'], cwd, () => {});
    const root = path.join(cwd, '.my_context');
    writeFileSync(
      path.join(root, 'config.json'),
      JSON.stringify({
        profile: 'standard',
        review: { enabled: true, everyNToolCalls: 1, includeSubagents: false },
      }, null, 2) + '\n',
    );
    const transcript = path.join(cwd, 'transcript.jsonl');
    const records = bigTranscript(transcript);

    bumpCounter(root, 'live-1');
    const firedAt = Date.now();
    const decision = reviewTrigger(
      { cwd, session_id: 'live-1', transcript_path: transcript }, 'Stop',
    );
    const triggerMs = Date.now() - firedAt;
    const reportAlreadyThere = existsSync(passReportPath(root));

    assert.equal(decision?.fire, true, 'the trigger did not fire, so this test proves nothing');
    assert.equal(decision?.spawned, true, 'no child was started, so this test proves nothing');

    // ── THE ASSERTION ──────────────────────────────────────────────────────
    assert.equal(
      reportAlreadyThere, false,
      `the pass had already finished when Stop returned (the call took ${triggerMs}ms), so ` +
      'Stop waited for it. That is the hook where a person is staring at a prompt; the child ' +
      'is detached and never awaited.',
    );

    // ── AND THE WORK REALLY DID HAPPEN, WHOLE, IN THE CHILD ────────────────
    const report = await waitForReport(root, 120_000);
    assert.equal(report.whole, true, report.wholeness);
    assert.equal(
      report.records, records,
      'the detached child read a PART of the transcript and reported on it — the one thing ' +
      'this phase forbids',
    );
    assert.match(report.wholeness, /^read WHOLE:/);
    assert.deepEqual(report.created, [], 'the dry run created something');
  } finally { removeTree(cwd); }
});
