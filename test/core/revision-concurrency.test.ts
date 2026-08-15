/**
 * Interrupt and concurrency for the revision store, with real OS processes.
 *
 * The ingest lock's guarantees were established with 3720 acquisitions across
 * 23 runs; nothing here is at that scale, but nothing here is single-process
 * either — a single-process test cannot observe the hazard these close, which
 * is that both racers load the workspace BEFORE either contends for the lock.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../../src/cli/index.ts';
import { createItem, type MutationContext } from '../../src/core/mutate.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import {
  pendingRevisions, revisionHistory, revisionLogPath, stageRevision,
} from '../../src/core/revision.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { removeTree } from '../helpers/tmp.ts';

const PROMOTER = fileURLToPath(new URL('../fixtures/promote-revision.ts', import.meta.url));
const STAGER = fileURLToPath(new URL('../fixtures/stage-revisions-forever.ts', import.meta.url));

const ORIGINAL = 'Never log a customer email address.';

interface Fixture {
  cwd: string;
  root: string;
  itemId: string;
  ctx: MutationContext;
  store: Store;
  dispose(): void;
}

/** A real on-disk workspace (not `:memory:`) — the child processes read the
 * Markdown files, so the files have to exist. */
function workspace(): Fixture {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-rev-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0);
  const ws = resolveWorkspace(cwd);
  const root = ws.projectRoot!;
  const store = Store.open(':memory:');
  const ctx: MutationContext = { root, store, config: ws.config };
  const itemId = createItem(ctx, {
    type: 'rule', title: 'Do not log customer email', body: ORIGINAL,
    status: 'active', origin: 'human', severity: 'hard',
  }).id;
  return {
    cwd, root, itemId, ctx, store,
    dispose() {
      try { store.close(); } catch { /* already closed */ }
      removeTree(cwd);
    },
  };
}

function reread(fx: Fixture): { body: string; title: string } {
  const ws = resolveWorkspace(fx.cwd);
  const store = Store.open(':memory:');
  try {
    const { errors } = rebuild(store, { project: ws.projectRoot! }, ws.config);
    assert.deepEqual(errors, [], 'the item file must still parse and match its own checksum');
    const item = store.get(fx.itemId)!;
    return { body: item.body, title: item.title };
  } finally { store.close(); }
}

function run(args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += String(d); });
    child.stderr.on('data', (d) => { stderr += String(d); });
    child.on('close', (code) => resolve({ code: code ?? -1, stdout, stderr }));
  });
}

test('two processes promoting two revisions of one item: one applies, the other is refused', async () => {
  const fx = workspace();
  try {
    const a = stageRevision(fx.ctx, fx.itemId, { body: 'Proposal A, from one agent.' }, 'agent');
    const b = stageRevision(fx.ctx, fx.itemId, { body: 'Proposal B, from another.' }, 'agent');
    fx.store.close();

    const startAt = String(Date.now() + 600);
    const [ra, rb] = await Promise.all([
      run([PROMOTER, fx.cwd, fx.itemId, a.revision.revisionId, startAt]),
      run([PROMOTER, fx.cwd, fx.itemId, b.revision.revisionId, startAt]),
    ]);

    const results = [ra, rb].map((r) => {
      assert.equal(r.code, 0, `racer crashed: ${r.stderr}`);
      return JSON.parse(r.stdout.trim()) as { ok: boolean; message: string };
    });

    const winners = results.filter((r) => r.ok);
    const losers = results.filter((r) => !r.ok);
    assert.equal(winners.length, 1, `exactly one promotion must apply, got ${winners.length}`);
    assert.equal(losers.length, 1);

    // The loser was told WHY, and told it in terms of the other change rather
    // than a generic failure. Both wordings are legitimate outcomes of the
    // race: it either saw the promotion (stale) or saw the log already settled.
    assert.match(losers[0].message, /STALE and was not promoted|no revision is pending/);

    // The item carries exactly one of the two proposals, never a blend, and
    // never the pre-race text.
    const { body } = reread(fx);
    assert.ok(
      body === 'Proposal A, from one agent.' || body === 'Proposal B, from another.',
      `item body is neither proposal: ${JSON.stringify(body)}`,
    );

    // And nothing was lost: both revisions are still accounted for, exactly one
    // promoted, the other still pending and readable in full.
    const store = Store.open(':memory:');
    try {
      const ws = resolveWorkspace(fx.cwd);
      rebuild(store, { project: ws.projectRoot! }, ws.config);
      const ctx: MutationContext = { root: fx.root, store, config: ws.config };
      const history = revisionHistory(ctx, fx.itemId);
      assert.equal(history.length, 2);
      assert.equal(history.filter((r) => r.state === 'promoted').length, 1);
      assert.equal(history.filter((r) => r.state === 'pending').length, 1);
      const survivor = pendingRevisions(ctx)[0];
      assert.ok(survivor.changes.body, 'the losing proposal still carries its full text');
      assert.equal(survivor.stale, true, 'and it now knows the text moved underneath it');
    } finally { store.close(); }
  } finally { fx.dispose(); }
});

test('a writer killed mid-append loses no revision it had already reported', async () => {
  const fx = workspace();
  try {
    fx.store.close();
    const child = spawn(process.execPath, [STAGER, fx.cwd, fx.itemId], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const reported: string[] = [];
    let buffer = '';
    child.stdout.on('data', (d) => {
      buffer += String(d);
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) if (line.trim() !== '') reported.push(line.trim());
    });

    // Let it get well past the first append, then kill it wherever it happens
    // to be — including inside `appendFileSync`.
    await new Promise((r) => { setTimeout(r, 400); });
    child.kill('SIGKILL');
    await new Promise((r) => { child.on('close', r); });

    assert.ok(reported.length > 5, `expected many staged revisions, got ${reported.length}`);

    const ws = resolveWorkspace(fx.cwd);
    const store = Store.open(':memory:');
    try {
      rebuild(store, { project: ws.projectRoot! }, ws.config);
      const ctx: MutationContext = { root: fx.root, store, config: ws.config };

      // The log is readable at all — a kill mid-append must not wedge it.
      const pending = pendingRevisions(ctx).map((r) => r.revisionId);
      // Every revision the child reported as staged survived the kill. stdout
      // is flushed after the append returns, so each of these was durable.
      for (const id of reported) {
        assert.ok(pending.includes(id), `revision ${id} was reported staged but is gone`);
      }

      // And the log still accepts writes: the torn tail is healed, not carried
      // forward as a line every later read has to refuse.
      const after = stageRevision(ctx, fx.itemId, { title: 'After the crash' }, 'agent');
      assert.ok(pendingRevisions(ctx).some((r) => r.revisionId === after.revision.revisionId));
      for (const id of reported) {
        assert.ok(pendingRevisions(ctx).some((r) => r.revisionId === id));
      }
    } finally { store.close(); }
  } finally { fx.dispose(); }
});

test('a corrupt log on disk is refused by a real process, not read as "nothing pending"', async () => {
  const fx = workspace();
  try {
    stageRevision(fx.ctx, fx.itemId, { body: 'A proposal.' }, 'agent');
    const log = revisionLogPath(fx.root);
    const first = readFileSync(log, 'utf8').split('\n')[0];
    // A complete, newline-terminated garbage line: not a torn write, so not
    // something to tolerate.
    writeFileSync(log, `${first}\nnot json at all\n`, 'utf8');
    fx.store.close();

    const result = await run([PROMOTER, fx.cwd, fx.itemId, 'REV-anything', '0']);
    assert.equal(result.code, 0, result.stderr);
    const parsed = JSON.parse(result.stdout.trim()) as { ok: boolean; message: string };
    assert.equal(parsed.ok, false);
    assert.match(parsed.message, /cannot be trusted — line 2/);

    // And the item was not touched by the refusal.
    assert.equal(reread(fx).body, ORIGINAL);
  } finally { fx.dispose(); }
});
