import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { buildRestoreSnapshot } from '../../src/hooks/pre-compact.ts';
import { buildSessionStartOutput } from '../../src/hooks/session-start.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { runCli } from '../../src/cli/index.ts';
import { readSnapshotMeta } from '../../src/core/ledger.ts';
import { Store } from '../../src/core/store.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The behavioural half of Phase 1E.
 *
 * Four documents, one code comment and two tests all asserted that "items
 * loaded via /LoadMyContext are not restored after a compaction". Nothing in
 * the suite could tell that this was false, because every restore test wrote
 * a snapshot by hand with `writeSnapshot` — which skips the PreCompact hook,
 * and the PreCompact hook is the whole reason a manual load survives. So the
 * documentation tests pinned a sentence, and no test pinned the behaviour.
 *
 * These four run the real pipeline end to end: `load_context` (the tool
 * `/LoadMyContext` calls) → a transcript containing what it delivered →
 * `buildRestoreSnapshot` (PreCompact) → `buildSessionStartOutput('compact')`.
 * They fail if restore stops working, not if a sentence is reworded — which
 * is the gap the audit named. Each pins one clause of the corrected claim,
 * so the claim's conditions cannot be dropped without a red suite.
 */

/**
 * A workspace that is removed whether the test passes or FAILS.
 *
 * Registered on the test context rather than removed at the end of each body:
 * an `assert` that throws skips every statement after it, and the tail-bound
 * test below appends ~9.6MB of filler, so a single red run used to leave that
 * behind in the system temp directory — on the exact run where someone is
 * about to re-run the suite repeatedly. `t.after` runs on both paths.
 */
function sandbox(t: TestContext): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-manualrestore-'));
  runCli(['init'], cwd, () => {});
  t.after(() => { removeTree(cwd); });
  return cwd;
}

function addItem(cwd: string, id: string, opts: {
  type?: string; always?: boolean; body?: string;
} = {}): void {
  const type = opts.type ?? 'constraint';
  const file = path.join(cwd, '.my_context', 'items', type, `${id}.md`);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `---
id: ${id}
type: ${type}
title: ${id} title
status: active
always: ${opts.always ?? false}
---

# ${id} title

${opts.body ?? 'Body text.'}
`);
}

/**
 * PreCompact filters transcript hits against the live index, so an item that
 * has never been indexed is invisible to it. `buildInjection` rebuilds on its
 * own; the tests that do not call it have to index by hand.
 */
function index(cwd: string): void {
  const ws = resolveWorkspace(cwd);
  const store = Store.open(ws.dbPath);
  try {
    rebuild(store, { project: ws.projectRoot ?? undefined }, ws.config);
  } finally {
    store.close();
  }
}

/** A transcript file holding `text`, in the JSONL shape Claude Code writes. */
function transcript(cwd: string, name: string, text: string): string {
  const file = path.join(cwd, name);
  writeFileSync(file, JSON.stringify({ type: 'assistant', text }) + '\n', 'utf8');
  return file;
}

function snapshot(cwd: string, sessionId: string, transcriptPath: string): string[] {
  const result = buildRestoreSnapshot(
    { session_id: sessionId, cwd, transcript_path: transcriptPath }, cwd,
  );
  assert.ok(result, 'PreCompact must produce a snapshot');
  const ws = resolveWorkspace(cwd);
  assert.deepEqual(
    readSnapshotMeta(ws.projectRoot!, sessionId)?.itemIds, result.itemIds,
    'the snapshot on disk is what the restore will read',
  );
  return result.itemIds;
}

/**
 * The claim the eight surfaces now make, proven rather than asserted. The
 * manual path records NOTHING in the ledger (no trustworthy session id), so
 * the transcript arm of the snapshot is the only thing carrying this item —
 * which is precisely why "usually restored" is true and "not restored" was
 * not.
 */
test('an item delivered by a manual load is restored in full after a compaction', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-manually-loaded', { always: true, body: 'The pool is capped at 20.' });

  const manual = buildInjection(cwd, { event: 'manual' });
  assert.match(manual, /CONST-manually-loaded/, 'the manual load delivered the item');

  const ids = snapshot(cwd, 'sess-manual', transcript(cwd, 't.jsonl', manual));
  assert.deepEqual(ids, ['CONST-manually-loaded']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 'sess-manual' });
  // Body text, not the id: the id also appears on an index line, and an
  // index line is not a restore.
  assert.match(out, /The pool is capped at 20\./, 'the manually-loaded item came back in full');
});

/**
 * Condition 1 of the corrected claim. `select` runs the restore tier through
 * `isNormative`, so a rationale item is captured by the snapshot and then
 * dropped at injection. Both halves are asserted: capture WITHOUT restore is
 * the specific shape, and a test that only checked the output would pass just
 * as well if PreCompact had stopped scanning at all.
 */
test('a rationale item is snapshotted but never restored in full', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'ADR-sqlite-over-postgres', { type: 'adr', body: 'Rationale body text.' });
  addItem(cwd, 'CONST-normative-control', { body: 'Normative body text.' });

  index(cwd);

  const ids = snapshot(
    cwd, 'sess-rationale',
    transcript(cwd, 't.jsonl', 'We cited ADR-sqlite-over-postgres and CONST-normative-control.'),
  );
  assert.deepEqual(ids, ['ADR-sqlite-over-postgres', 'CONST-normative-control']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 'sess-rationale' });
  assert.match(out, /Normative body text\./, 'the normative control restored');
  assert.doesNotMatch(out, /Rationale body text\./, 'rationale items never restore in full');
});

/**
 * Condition 2. `readTail` reads the last 8MB of the transcript, so an id
 * whose only mention is older than that is invisible to PreCompact. The
 * control in the tail is what separates "the tail bound bites" from "the scan
 * broke".
 *
 * ~9.6MB of I/O per run is the cost of testing a byte boundary at the byte
 * boundary; a smaller, injectable limit would test a constant, not the
 * behaviour the documentation now promises.
 */
test('an id mentioned only beyond the 8MB transcript tail is not snapshotted', (t) => {
  const cwd = sandbox(t);
  addItem(cwd, 'CONST-before-the-tail', { body: 'Old body text.' });
  addItem(cwd, 'CONST-inside-the-tail', { body: 'Recent body text.' });

  index(cwd);

  const file = transcript(cwd, 't.jsonl', 'Early on we cited CONST-before-the-tail.');
  const filler = JSON.stringify({ text: 'x'.repeat(60_000) }) + '\n';
  for (let i = 0; i < 160; i++) appendFileSync(file, filler); // ~9.6MB > 8MB
  appendFileSync(file, JSON.stringify({ text: 'Later we cited CONST-inside-the-tail.' }) + '\n');

  assert.deepEqual(
    snapshot(cwd, 'sess-tail', file), ['CONST-inside-the-tail'],
    'only the mention inside the 8MB tail survives',
  );
});

/**
 * Condition 3. The restore tier has its own budget; what does not fit is not
 * silently dropped but demoted to an index line and named in the omission
 * note. The note is asserted, not just the absence of the body — "nothing was
 * dropped silently" is the project's one unacceptable failure, and a test
 * that only checked for absence would pass on a silent drop too.
 */
test('what does not fit the restore budget spills to an index line and is named', (t) => {
  const cwd = sandbox(t);
  const config = path.join(cwd, '.my_context', 'config.json');
  writeFileSync(config, JSON.stringify({ budgets: { restored: 40 } }, null, 2), 'utf8');
  addItem(cwd, 'CONST-too-big-to-restore', { body: 'B'.repeat(400) });

  index(cwd);

  const ids = snapshot(
    cwd, 'sess-budget', transcript(cwd, 't.jsonl', 'We cited CONST-too-big-to-restore.'),
  );
  assert.deepEqual(ids, ['CONST-too-big-to-restore']);

  const out = buildSessionStartOutput(cwd, { source: 'compact', sessionId: 'sess-budget' });
  assert.doesNotMatch(out, /BBBB/, 'the body did not fit the restore budget');
  assert.match(out, /omitted from full text for budget/, 'the spill is disclosed');
  assert.match(out, /CONST-too-big-to-restore/, 'and the omitted item is named');
});
