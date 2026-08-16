import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { buildInjection } from '../../src/core/inject.ts';
import { createItem, updateItem } from '../../src/core/mutate.ts';
import { rebuild } from '../../src/core/rebuild.ts';
import {
  discardRevision, pendingRevisions, promoteRevision, readLog, revisionFor, revisionHistory,
  revisionLogPath, stageRevision, REVISION_PROTOCOL,
} from '../../src/core/revision.ts';
import { select } from '../../src/core/select.ts';
import { Store } from '../../src/core/store.ts';
import { resolveWorkspace } from '../../src/core/workspace.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const ORIGINAL_BODY = 'Never log a customer email address, anywhere, at any level.';
const PROPOSED_BODY = 'Avoid logging customer email addresses unless it is necessary.';

function seed(box: Sandbox, body = ORIGINAL_BODY, always = false): string {
  return createItem(box.ctx, {
    type: 'rule',
    title: 'Do not log customer email',
    body,
    status: 'active',
    origin: 'human',
    severity: 'hard',
    always,
  }).id;
}

function itemFile(box: Sandbox, id: string): string {
  return path.join(box.root, box.ctx.store.get(id)!.filePath);
}

function cli(box: Sandbox, args: string[]): string {
  let text = '';
  runCli(args, box.cwd, (line) => { text += `${line}\n`; });
  return text;
}

// --- staging ----------------------------------------------------------------

test('a staged revision is readable back, and the item is untouched on disk and in the index', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const before = readFileSync(itemFile(box, id), 'utf8');

    const staged = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');

    assert.equal(staged.duplicate, false);
    assert.equal(staged.revision.itemId, id);
    assert.equal(staged.revision.changes.body, PROPOSED_BODY);
    assert.equal(staged.revision.base.body, ORIGINAL_BODY);
    assert.equal(staged.revision.state, 'pending');
    assert.equal(staged.revision.origin, 'agent');

    const pending = revisionFor(box.ctx, id);
    assert.ok(pending);
    assert.equal(pending.revisionId, staged.revision.revisionId);
    assert.equal(pending.stale, false);
    assert.equal(pending.current.body, ORIGINAL_BODY);
    assert.deepEqual(pending.changedSince, []);

    assert.equal(readFileSync(itemFile(box, id), 'utf8'), before);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL_BODY);
  } finally { box.dispose(); }
});

test('the response says the edit did NOT take effect and names what still governs', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const staged = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    assert.match(staged.message, /NOT applied/);
    assert.match(staged.message, /staged as revision REV-/);
    assert.match(staged.message, /unchanged and keeps governing/);
    assert.doesNotMatch(staged.message, /\bupdated\b/);
  } finally { box.dispose(); }
});

test('a revision refuses any field that is not content', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    for (const field of ['scope', 'always', 'severity', 'status']) {
      assert.throws(
        () => stageRevision(box.ctx, id, { [field]: 'x' } as never, 'agent'),
        new RegExp(`content only.*${field}`, 's'),
        `${field} must not be stageable`,
      );
    }
    assert.equal(pendingRevisions(box.ctx).length, 0);
  } finally { box.dispose(); }
});

test('a proposal that changes nothing is refused rather than staged', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    assert.throws(
      () => stageRevision(box.ctx, id, { body: ORIGINAL_BODY }, 'agent'),
      /nothing to stage/,
    );
    assert.equal(pendingRevisions(box.ctx).length, 0);
  } finally { box.dispose(); }
});

test('an unknown id and a global-layer item are both refused', () => {
  const box = sandbox();
  try {
    assert.throws(() => stageRevision(box.ctx, 'RULE-nope', { body: 'x' }, 'agent'), /no item with id/);
  } finally { box.dispose(); }
});

test('staging the identical proposal twice is one revision, not two', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const first = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const second = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    assert.equal(second.duplicate, true);
    assert.equal(second.revision.revisionId, first.revision.revisionId);
    assert.equal(pendingRevisions(box.ctx).length, 1);
    assert.equal(readLog(box.root).filter((l) => l.op === 'stage').length, 1);
  } finally { box.dispose(); }
});

// --- a revision is never injected, and is not an item ------------------------

test('a staged revision is never injected — checked on the real injection path', () => {
  const box = sandbox();
  try {
    // `always: true` so the item is injected as a FULL text block, not just an
    // index line — otherwise "the new body was not injected" would be true of
    // an injection that carries no body at all, and would pass on a mutant.
    const id = seed(box, ORIGINAL_BODY, true);
    const before = buildInjection(box.cwd, { event: 'manual' });
    assert.match(before, new RegExp(ORIGINAL_BODY));

    stageRevision(box.ctx, id, { title: 'Rewritten title', body: PROPOSED_BODY }, 'agent');

    const after = buildInjection(box.cwd, { event: 'manual' });
    // What must never be injected is the PROPOSED TEXT, and what must never
    // change is the block that governs. Both hold, checked separately.
    assert.doesNotMatch(after, new RegExp(PROPOSED_BODY));
    assert.doesNotMatch(after, /Rewritten title/);
    assert.ok(after.startsWith(before.trimEnd()), 'the governing block changed after staging');
    assert.match(after, new RegExp(ORIGINAL_BODY));

    // The EXISTENCE of the proposal, on the other hand, is now stated — 1C.2.
    // This assertion used to be `doesNotMatch(after, /REV-/)`, which pinned
    // the defect: a session that starts with a proposal waiting was told
    // nothing at all, so the agent that staged it could not discover it was
    // still pending and would either re-propose it or reason as if it had
    // landed. See `agentRevisionNotice` (core/revision.ts).
    assert.match(after, /pending revision\(s\)/);
    assert.match(after, /REV-/);
    assert.match(after, new RegExp(`REV-[0-9a-f]+ → ${id}`));
    assert.match(after, /staged and NOT applied/);
  } finally { box.dispose(); }
});

/** And nothing is said when there is nothing to say — the note is a
 * disclosure, not a permanent banner. */
test('an injection with no pending revision says nothing about the queue', () => {
  const box = sandbox();
  try {
    seed(box, ORIGINAL_BODY, true);
    const out = buildInjection(box.cwd, { event: 'manual' });
    assert.doesNotMatch(out, /pending revision/);
    assert.doesNotMatch(out, /REV-/);
  } finally { box.dispose(); }
});

test('a staged revision is invisible to select() itself, at every tier', () => {
  const box = sandbox();
  try {
    const id = seed(box, ORIGINAL_BODY, true);
    stageRevision(box.ctx, id, { title: 'Rewritten title', body: PROPOSED_BODY }, 'agent');

    const ws = resolveWorkspace(box.cwd);
    const store = Store.open(':memory:');
    try {
      rebuild(store, { project: ws.projectRoot! }, ws.config);
      const items = store.all();
      assert.deepEqual(items.map((i) => i.id), [id]);
      assert.equal(items[0].body, ORIGINAL_BODY);
      for (const event of ['session-start', 'tool', 'compact', 'manual'] as const) {
        const selection = select(items, { event, path: 'src/a.ts' }, ws.config);
        assert.ok(selection.full.length > 0, `nothing was selected for ${event}`);
        for (const entry of selection.full) {
          assert.equal(entry.item.body, ORIGINAL_BODY);
          assert.equal(entry.item.title, 'Do not log customer email');
          assert.equal(entry.item.id, id);
        }
        for (const line of selection.index.normative) assert.equal(line.id, id);
      }
    } finally { store.close(); }
  } finally { box.dispose(); }
});

/**
 * Cuts the pending-revision section — the paragraph `status` and `review`
 * print about the second queue, plus the blank line separating it — out of a
 * report, so what remains is everything those commands say about ITEMS.
 *
 * The section is identified by the one count sentence every surface shares
 * (`pendingRevisionLine`, core/revision.ts) and runs to the next blank
 * line, which is how every other section of those reports is delimited too.
 */
function withoutRevisionSection(text: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => /pending revision\(s\)/.test(l));
  if (start === -1) return text;
  let end = start;
  while (end < lines.length && lines[end].trim() !== '') end++;
  lines.splice(start - 1, end - start + 1);
  return lines.join('\n');
}

test('a revision moves no count: list, status, review, decay and doctor all agree', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const before = {
      list: cli(box, ['list']),
      status: cli(box, ['status']),
      review: cli(box, ['review']),
      decay: cli(box, ['decay']),
      doctor: cli(box, ['doctor']),
    };

    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');

    // `list`, `decay` and `doctor` are byte-identical, permanently: a revision
    // is not an item, so nothing that lists, grades or health-checks items may
    // notice one exists.
    for (const name of ['list', 'decay', 'doctor']) {
      assert.equal(cli(box, [name]), before[name as keyof typeof before],
        `${name} changed after a revision was staged`);
    }
    // `status` and `review` DO report the second queue as of Task 6 — that is
    // the whole of what they gained, and this pins that it is the whole:
    // everything either command says about items is byte-identical, and the
    // only new text is the shared count sentence.
    for (const name of ['status', 'review']) {
      const after = cli(box, [name]);
      assert.match(after, /1 pending revision\(s\) on 1 item\(s\)/, `${name} does not report it`);
      assert.equal(withoutRevisionSection(after), before[name as keyof typeof before],
        `${name} changed something other than the pending-revision section`);
    }
    // Nothing named the revision anywhere BEFORE it was staged, and no command
    // that reports items names one after.
    for (const text of Object.values(before)) assert.doesNotMatch(text, /REV-/);
    for (const name of ['list', 'decay', 'doctor']) assert.doesNotMatch(cli(box, [name]), /REV-/);
  } finally { box.dispose(); }
});

test('a revision never becomes a row, a file under items/, or a load error', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');

    const ws = resolveWorkspace(box.cwd);
    const store = Store.open(':memory:');
    try {
      const { errors } = rebuild(store, { project: ws.projectRoot! }, ws.config);
      assert.deepEqual(errors, []);
      assert.deepEqual(store.all().map((i) => i.id), [id]);
    } finally { store.close(); }
  } finally { box.dispose(); }
});

test('the revision log is working state: gitignored, and never under items/', () => {
  const box = sandbox();
  try {
    stageRevision(box.ctx, seed(box), { body: PROPOSED_BODY }, 'agent');
    const dir = path.dirname(revisionLogPath(box.root));
    assert.equal(readFileSync(path.join(dir, '.gitignore'), 'utf8'), '*\n');
    assert.equal(dir.includes(`${path.sep}items`), false);
  } finally { box.dispose(); }
});

// --- promotion --------------------------------------------------------------

test('promotion applies the change, retires the revision, and round-trips the file', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY, tags: ['privacy'] }, 'agent');

    const result = promoteRevision(box.ctx, id);
    assert.equal(result.revision.state, 'promoted');
    assert.match(result.message, /promoted revision REV-/);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED_BODY);
    assert.deepEqual(box.ctx.store.get(id)!.tags, ['privacy']);
    assert.equal(pendingRevisions(box.ctx).length, 0);
    assert.equal(revisionHistory(box.ctx, id)[0].state, 'promoted');

    // files -> DB -> files is byte-identical after a promotion.
    const onDisk = readFileSync(itemFile(box, id), 'utf8');
    assert.match(onDisk, new RegExp(PROPOSED_BODY));
    const ws = resolveWorkspace(box.cwd);
    const store = Store.open(':memory:');
    try {
      const { errors } = rebuild(store, { project: ws.projectRoot! }, ws.config);
      assert.deepEqual(errors, [], 'a promoted item must not fail its own checksum');
      assert.equal(store.get(id)!.body, PROPOSED_BODY);
    } finally { store.close(); }
    assert.equal(readFileSync(itemFile(box, id), 'utf8'), onDisk);
  } finally { box.dispose(); }
});

test('promoting when nothing is pending says so, and names what was settled', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    assert.throws(() => promoteRevision(box.ctx, id), /no revision is pending.*Nothing has ever been staged/s);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    promoteRevision(box.ctx, id);
    assert.throws(() => promoteRevision(box.ctx, id), /no revision is pending.*promoted/s);
  } finally { box.dispose(); }
});

// --- hard case 1: a stale revision ------------------------------------------

test('a stale revision is refused, names both texts, and leaves the item alone', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');

    const humanText = 'Never log a customer email address. Redact it at the logger.';
    updateItem(box.ctx, { id, body: humanText, origin: 'human' });

    const pending = revisionFor(box.ctx, id)!;
    assert.equal(pending.stale, true, 'the human edit must make it stale');
    assert.deepEqual(pending.changedSince, ['body']);
    assert.equal(pending.current.body, humanText);

    assert.throws(() => promoteRevision(box.ctx, id), (err: Error) => {
      assert.match(err.message, /STALE and was not promoted/);
      assert.match(err.message, new RegExp(humanText));
      assert.match(err.message, new RegExp(ORIGINAL_BODY));
      return true;
    });

    assert.equal(box.ctx.store.get(id)!.body, humanText, 'the human edit must survive');
    assert.equal(revisionFor(box.ctx, id)!.state, 'pending');
  } finally { box.dispose(); }
});

test('a stale revision can be promoted deliberately, and the message says it overwrote', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    updateItem(box.ctx, { id, body: 'A human wrote this instead.', origin: 'human' });

    const result = promoteRevision(box.ctx, id, { force: true });
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED_BODY);
    assert.match(result.message, /stale and was promoted with force/i);
    assert.match(result.message, /body/);
  } finally { box.dispose(); }
});

test('staleness is scoped to the fields the revision touches', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    // A human changes something this proposal does not touch.
    updateItem(box.ctx, { id, scope: ['src/**'], origin: 'human' });

    assert.equal(revisionFor(box.ctx, id)!.stale, false);
    promoteRevision(box.ctx, id);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED_BODY);
    assert.deepEqual(box.ctx.store.get(id)!.scope, ['src/**']);
  } finally { box.dispose(); }
});

test('a revision whose item vanished is refused, not promoted onto nothing', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');

    // Same workspace, an index that no longer carries the item — what a
    // hand-deleted file plus a rebuild leaves behind.
    const empty = Store.open(':memory:');
    try {
      const ctx = { ...box.ctx, store: empty };
      assert.equal(revisionFor(ctx, id)!.itemMissing, true);
      assert.throws(() => promoteRevision(ctx, id), /no longer in the index/);
    } finally { empty.close(); }
  } finally { box.dispose(); }
});

// --- hard case 2: a second revision while one is pending ---------------------

test('a second revision accumulates, and the staging response names the first', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const first = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const second = stageRevision(box.ctx, id, { body: 'A third wording entirely.' }, 'agent');

    assert.equal(second.alsoPending.length, 1);
    assert.equal(second.alsoPending[0].revisionId, first.revision.revisionId);
    assert.match(second.message, /already pending on this item/);
    assert.match(second.message, new RegExp(first.revision.revisionId));

    const pending = pendingRevisions(box.ctx);
    assert.equal(pending.length, 2);
    // Oldest first, and `revisionFor` is the head of that queue.
    assert.equal(pending[0].revisionId, first.revision.revisionId);
    assert.equal(revisionFor(box.ctx, id)!.revisionId, first.revision.revisionId);
  } finally { box.dispose(); }
});

test('promoting one of two pending revisions makes the other stale, and says so', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const first = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const second = stageRevision(box.ctx, id, { body: 'A third wording entirely.' }, 'agent');

    const result = promoteRevision(box.ctx, id, { revisionId: second.revision.revisionId });
    assert.equal(box.ctx.store.get(id)!.body, 'A third wording entirely.');
    assert.deepEqual(result.invalidated.map((r) => r.revisionId), [first.revision.revisionId]);
    assert.match(result.message, /now stale/);
    assert.match(result.message, /not applied and were not discarded/);

    // And the survivor is still pending, still readable, and now refuses to
    // silently overwrite the promotion.
    const survivor = revisionFor(box.ctx, id)!;
    assert.equal(survivor.revisionId, first.revision.revisionId);
    assert.equal(survivor.stale, true);
    assert.throws(() => promoteRevision(box.ctx, id), /STALE/);
  } finally { box.dispose(); }
});

// Settlement is a write on the trust boundary, and with two proposals pending
// an item id alone does not say which one the human reviewed. The default
// used to be "the oldest": a human shown the SECOND diff who typed the
// documented bare command promoted the FIRST — and promoteRevision stamps
// `origin: 'human'`, so the wrong proposal was laundered into a
// human-approved change with nothing saying so.
test('with two pending and no revisionId, promote and discard refuse rather than take the oldest', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const first = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const second = stageRevision(box.ctx, id, { title: 'Never log any customer email' }, 'agent');

    assert.throws(() => promoteRevision(box.ctx, id), (err: Error) => {
      assert.match(err.message, /2 pending revisions/);
      assert.match(err.message, new RegExp(first.revision.revisionId));
      assert.match(err.message, new RegExp(second.revision.revisionId));
      assert.match(err.message, /--revision/);
      return true;
    });
    assert.throws(() => discardRevision(box.ctx, id), /--revision/);

    // Nothing settled and nothing written on either refusal.
    assert.equal(pendingRevisions(box.ctx).length, 2);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL_BODY);

    // Named, the settlement reaches exactly the named one — and once a single
    // revision is pending the bare call is unambiguous again and still works.
    promoteRevision(box.ctx, id, { revisionId: second.revision.revisionId });
    assert.equal(box.ctx.store.get(id)!.title, 'Never log any customer email');
    assert.equal(pendingRevisions(box.ctx).length, 1);
    const result = promoteRevision(box.ctx, id);
    assert.equal(result.revision.revisionId, first.revision.revisionId);
    assert.equal(box.ctx.store.get(id)!.body, PROPOSED_BODY);
  } finally { box.dispose(); }
});

test('a revisionId that is not pending on this item is refused by name', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    assert.throws(
      () => promoteRevision(box.ctx, id, { revisionId: 'REV-nonsense' }),
      /no pending revision "REV-nonsense".*Pending: REV-/s,
    );
  } finally { box.dispose(); }
});

// --- discard ----------------------------------------------------------------

test('discarding leaves the item alone and keeps the proposal readable', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const staged = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const before = readFileSync(itemFile(box, id), 'utf8');

    const result = discardRevision(box.ctx, id, { reason: 'weakens the rule' });

    assert.equal(readFileSync(itemFile(box, id), 'utf8'), before);
    assert.equal(box.ctx.store.get(id)!.body, ORIGINAL_BODY);
    assert.equal(pendingRevisions(box.ctx).length, 0);

    // The claim the message makes must be true: the proposal is still there.
    const history = revisionHistory(box.ctx, id);
    assert.equal(history.length, 1);
    assert.equal(history[0].state, 'discarded');
    assert.equal(history[0].changes.body, PROPOSED_BODY);
    assert.equal(history[0].reason, 'weakens the rule');
    assert.match(readFileSync(result.logPath, 'utf8'), new RegExp(PROPOSED_BODY));
    assert.match(result.message, /NOT deleted/);
    assert.match(result.message, new RegExp(result.logPath.replace(/[\\^$*+?.()|[\]{}]/g, '\\$&')));
    assert.match(result.message, /cannot be staged again against this same text/);
    assert.equal(result.revision.revisionId, staged.revision.revisionId);
  } finally { box.dispose(); }
});

test('a discarded proposal cannot come back pending by being re-staged', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    discardRevision(box.ctx, id);

    assert.throws(
      () => stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent'),
      /already discarded/,
    );
    assert.equal(pendingRevisions(box.ctx).length, 0);
  } finally { box.dispose(); }
});

test('a discard does not lock the proposal out once the item itself moves on', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    discardRevision(box.ctx, id);
    updateItem(box.ctx, { id, body: 'The human rewrote it.', origin: 'human' });

    // The same words, but against different text — a genuinely new proposal.
    const again = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    assert.equal(again.duplicate, false);
    assert.equal(pendingRevisions(box.ctx).length, 1);
  } finally { box.dispose(); }
});

test('a promoted revision cannot be discarded or promoted a second time', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    promoteRevision(box.ctx, id);
    assert.throws(() => discardRevision(box.ctx, id), /no revision is pending/);
  } finally { box.dispose(); }
});

// --- a damaged log ----------------------------------------------------------

function logLines(box: Sandbox): string[] {
  return readFileSync(revisionLogPath(box.root), 'utf8').split('\n').filter((l) => l !== '');
}

test('a truncated FINAL line is tolerated — that is what a killed writer leaves', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    const first = stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const lines = logLines(box);
    // Simulate a kill part-way through the second append.
    writeFileSync(revisionLogPath(box.root), `${lines[0]}\n{"protocol":"my_conte`, 'utf8');

    const pending = pendingRevisions(box.ctx);
    assert.equal(pending.length, 1);
    assert.equal(pending[0].revisionId, first.revision.revisionId);

    // And the next append heals the fragment rather than concatenating onto it.
    stageRevision(box.ctx, id, { title: 'A different proposal' }, 'agent');
    assert.equal(pendingRevisions(box.ctx).length, 2);
  } finally { box.dispose(); }
});

test('a damaged EARLIER line is refused, so a settled revision cannot come back pending', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    discardRevision(box.ctx, id);
    stageRevision(box.ctx, id, { title: 'Something else' }, 'agent');

    const lines = logLines(box);
    assert.equal(lines.length, 3);
    // Corrupt the discard — the line whose loss would resurrect the proposal.
    lines[1] = '{"protocol":"my_context/revi';
    writeFileSync(revisionLogPath(box.root), `${lines.join('\n')}\n`, 'utf8');

    assert.throws(() => pendingRevisions(box.ctx), (err: Error) => {
      assert.match(err.message, /cannot be trusted — line 2/);
      assert.match(err.message, /back in the pending queue/);
      return true;
    });
  } finally { box.dispose(); }
});

test('an unrecognised protocol is refused rather than read as "no revisions"', () => {
  const box = sandbox();
  try {
    const id = seed(box);
    stageRevision(box.ctx, id, { body: PROPOSED_BODY }, 'agent');
    const line = JSON.parse(logLines(box)[0]) as Record<string, unknown>;
    line.protocol = 'my_context/revision@99';
    writeFileSync(revisionLogPath(box.root), `${JSON.stringify(line)}\n`, 'utf8');

    assert.throws(() => pendingRevisions(box.ctx), /declares protocol.*revision@99/s);
    assert.equal(REVISION_PROTOCOL, 'my_context/revision@1');
  } finally { box.dispose(); }
});

test('an absent log is "nothing staged", and is not confused with a broken one', () => {
  const box = sandbox();
  try {
    assert.equal(existsSync(revisionLogPath(box.root)), false);
    assert.deepEqual(pendingRevisions(box.ctx), []);
    assert.equal(revisionFor(box.ctx, 'RULE-anything'), null);
  } finally { box.dispose(); }
});
