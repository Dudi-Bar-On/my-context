// @basis TASK-one-number-means-nothing-cited-could-not-read-and-read-only,
//   STD-a-measured-zero-is-drawn-and-named-an-unmeasured-thing-is,
//   INV-nothing-is-dropped-silently, INV-hooks-fail-open
//
/**
 * **The three facts, on the two surfaces the number reaches.**
 *
 * `test/core/transcript-scan-states.test.ts` pins the states where they are
 * produced. This file pins what PreCompact DOES with them: the audit row is
 * the exhaustive channel and must say which of the three situations it is in,
 * and stderr — the only channel a user reads — carries the two that cost the
 * restore something it cannot get back.
 *
 * **Why only two of the three say anything on stderr.** This hook already
 * rules on that channel, for `occupancyStandDownLine`: *"a compaction is the
 * one moment where an unsolicited paragraph of ours competes with Claude
 * Code's own compaction notice for a user who did not ask for either."* The
 * exception it already makes, argued on `ignoredAskLine`, is the line that
 * *"reports that a thing the product promised did not happen, at the last
 * moment where knowing still helps"* — and a transcript that was read in part
 * or not at all is exactly that: the restore after this compaction will come
 * back short, and this is the last moment anyone could have known. A payload
 * that carried no `transcript_path` promised nothing and gets the row alone,
 * which is also what keeps `an ignored ask discloses on stderr; every other
 * verdict is silent` (test/hooks/handover-ask-verified.test.ts) true.
 *
 * **Exit 0 throughout** — `INV-hooks-fail-open`. Every case here still writes
 * its snapshot and still returns it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, mkdirSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { readAudit } from '../../src/core/audit.ts';
import { MAX_TRANSCRIPT_BYTES } from '../../src/core/ledger.ts';
import { appendSeen } from '../../src/core/seen-file.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(t: { after(fn: () => void): void }): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-precompact-transcript-'));
  t.after(() => removeTree(cwd));
  runCli(['init'], cwd, () => {});
  return cwd;
}

function addItem(cwd: string, id: string): void {
  const file = path.join(cwd, '.my_context', 'items', 'constraint', `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---\nid: ${id}\ntype: constraint\ntitle: ${id} title\nstatus: active\n---\n\n# ${id} title\n\nBody.\n`);
}

function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  store.close();
}

interface Run { ids: string[]; note: string; stderr: string }

/** One PreCompact, with the row it wrote and everything it said on stderr. */
function preCompact(cwd: string, transcriptPath?: string): Run {
  const chunks: string[] = [];
  const realWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array) => {
    chunks.push(String(chunk));
    return true;
  }) as typeof process.stderr.write;
  let result;
  try {
    result = buildRestoreSnapshot(
      {
        session_id: 's1', hook_event_name: 'PreCompact', cwd,
        ...(transcriptPath === undefined ? {} : { transcript_path: transcriptPath }),
      },
      cwd,
    );
  } finally {
    process.stderr.write = realWrite;
  }
  assert.ok(result, 'the hook returned no snapshot — it failed over a disclosure');
  const ws = resolveWorkspace(cwd);
  const note = readAudit(ws.projectRoot!)
    .filter((r) => r.op === 'pre-compact' && r.sessionId === 's1').at(-1)?.note ?? '';
  return { ids: result.itemIds, note, stderr: chunks.join('') };
}

test('a transcript read whole that cited nothing is recorded as a measured zero, in silence', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-a');
  index(cwd);
  const transcript = path.join(cwd, 't.jsonl');
  writeFileSync(transcript, '{"content":"this session cited no item at all"}\n', 'utf8');

  const run = preCompact(cwd, transcript);
  assert.deepEqual(run.ids, []);
  assert.match(run.note, /0 cited in the transcript/,
    'a zero that WAS measured must be drawn and named');
  assert.match(run.note, /whole transcript read/,
    'the row does not say the number rests on the whole file');
  assert.equal(run.stderr, '',
    'a transcript that was read in full and cited nothing is not news for the user');
});

test('a transcript that could not be read is never reported as a transcript that cited nothing', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-a');
  index(cwd);
  const ws = resolveWorkspace(cwd);
  appendSeen(ws.projectRoot!, 's1', [{ id: 'CONST-a', tier: 'jit', at: 'T0' }]);

  const run = preCompact(cwd, path.join(cwd, 'gone.jsonl'));
  assert.deepEqual(run.ids, ['CONST-a'], 'the seen-file arm still carried the snapshot');
  assert.match(run.note, /could not be read/, 'the row does not say the transcript was unreadable');
  assert.doesNotMatch(run.note, /0 cited in the transcript/,
    'an unmeasured transcript was drawn as a measured zero');
  assert.match(run.stderr, /transcript/,
    'the user was not told the restore rests on the seen file alone');
  assert.equal(run.stderr.trimEnd().split('\n').length, 1, 'the disclosure is more than one line');
});

test('a payload with no transcript path is its own row, and says nothing on stderr', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-a');
  index(cwd);

  const run = preCompact(cwd);
  assert.doesNotMatch(run.note, /0 cited in the transcript/,
    'a transcript nobody was given was drawn as a transcript that cited nothing');
  assert.match(run.note, /no transcript_path/,
    'the row does not say WHY the transcript arm contributed nothing');
  assert.equal(run.stderr, '');
});

/**
 * The case the item was raised for. ~9 MB of I/O, at the byte boundary, for
 * the reason `manual-load-restore.test.ts` gives: a smaller injectable limit
 * would test a constant rather than the bound the row now promises.
 */
test('a transcript read only to its tail says so, with both byte counts, on both channels', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-before-the-tail');
  addItem(cwd, 'CONST-inside-the-tail');
  index(cwd);

  const transcript = path.join(cwd, 't.jsonl');
  writeFileSync(transcript, '{"content":"early on we cited CONST-before-the-tail"}\n', 'utf8');
  const filler = JSON.stringify({ text: 'x'.repeat(60_000) }) + '\n';
  for (let i = 0; i < 150; i++) appendFileSync(transcript, filler);
  appendFileSync(transcript, '{"content":"later we cited CONST-inside-the-tail"}\n');

  const size = statSync(transcript).size;
  assert.ok(size > MAX_TRANSCRIPT_BYTES, 'the fixture did not exceed the tail bound');

  const run = preCompact(cwd, transcript);
  assert.deepEqual(run.ids, ['CONST-inside-the-tail'], 'the tail bound bit, as it must');
  assert.match(run.note, new RegExp(String(MAX_TRANSCRIPT_BYTES)),
    'the row does not say how many bytes were actually read');
  assert.match(run.note, new RegExp(`of ${size} bytes`),
    'the row does not say how big the transcript it read a slice of was');
  assert.match(run.stderr, new RegExp(String(MAX_TRANSCRIPT_BYTES)));
  assert.match(run.stderr, /not be restored|not captured/,
    'the user was not told what the partial read costs the restore');
  assert.equal(run.stderr.trimEnd().split('\n').length, 1, 'the disclosure is more than one line');
});

/**
 * The item's own claim, asserted as it is written: ONE figure for three
 * different situations is the defect, so three rows for the three situations
 * must not read alike.
 */
test('the three situations produce three different rows', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-a');
  index(cwd);

  const quiet = path.join(cwd, 'quiet.jsonl');
  writeFileSync(quiet, '{"content":"nothing cited"}\n', 'utf8');
  const big = path.join(cwd, 'big.jsonl');
  writeFileSync(big, `${'x'.repeat(MAX_TRANSCRIPT_BYTES + 1024)}\n`, 'utf8');

  const notes = [
    preCompact(cwd, quiet).note,
    preCompact(cwd, path.join(cwd, 'gone.jsonl')).note,
    preCompact(cwd, big).note,
  ];
  assert.equal(new Set(notes).size, 3,
    `the three situations still collapse into one row:\n${notes.join('\n')}`);
});
