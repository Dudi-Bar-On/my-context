// @basis TASK-retiring-an-item-asks-before-it-happens-wherever-it-is

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runCli } from '../../src/cli/index.ts';
import { createItem, supersedeItem, supersedeQuestion, updateItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * TASK-retiring-an-item-asks-before-it-happens-wherever-it-is-triggered-from.
 *
 * `--supersedes <id>` can be answered from `add` and from `edit`, because the
 * contradiction gate offers it as a disposition — but `supersedeItem` itself
 * never prompted. The confirm lived in the `mycontext supersede` command, so
 * retiring a governing item THROUGH THE GATE happened with no confirmation at
 * all. `MutationContext.confirm` is the hook that closes that, and
 * `preflightSupersede` is where it is asked: before the write, so the "nothing
 * was written" the gate's own refusal promises stays true when the answer is
 * no.
 *
 * A stub hook rather than a real terminal, for `confirmAction`'s own stated
 * reason: `isTTY`/`readLine` are parameters there so the gate can be exercised
 * without a pty. Here the whole hook is the seam.
 */

/** Two rules alike enough that the gate raises the pair — see `overlap.ts`. */
const FIRST = 'Never log a customer email address';
const SECOND = 'Never log a customer email address or phone number';
const FIRST_BODY = 'A customer email address must never reach a log line.';
const SECOND_BODY = 'A customer email address or phone number must never reach a log line.';
const RETIREE = 'RULE-never-log-a-customer-email-address';

test('the gated path asks before it retires, in the SAME words mycontext supersede uses', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST });

  const asked: string[] = [];
  s.ctx.confirm = (question) => { asked.push(question); return true; };
  const next = createItem(s.ctx, { type: 'rule', title: SECOND, supersedes: old.id });

  assert.deepEqual(asked, [
    supersedeQuestion({ id: old.id, title: FIRST }, `the new rule "${SECOND}"`),
  ]);
  assert.equal(s.ctx.store.get(old.id)!.status, 'superseded');
  assert.equal(s.ctx.store.get(next.id)!.status, 'active');
  s.dispose();
});

test('the question names the retiree by id and by title, which is the irreversible half', () => {
  assert.equal(
    supersedeQuestion({ id: 'RULE-a', title: 'A rule' }, 'RULE-b'),
    'Supersede RULE-a ("A rule") with RULE-b?',
  );
});

/**
 * The whole point of asking BEFORE the write. `createItem`'s own refusals
 * promise "nothing was created"; a confirm placed after the create would have
 * left the new item on disk with the old one un-retired, which is the
 * half-done pair this task exists to stop happening silently.
 */
test('declining writes nothing at all — not the new item, not the retirement', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST });
  const before = s.ctx.store.all().length;

  s.ctx.confirm = () => false;
  assert.throws(
    () => createItem(s.ctx, { type: 'rule', title: SECOND, supersedes: old.id }),
    /was not superseded, and nothing was written/,
  );

  assert.equal(s.ctx.store.all().length, before);
  assert.equal(s.ctx.store.get(old.id)!.status, 'active');
  s.dispose();
});

test('the refusal points at the other disposition rather than only saying no', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST });
  s.ctx.confirm = () => false;
  assert.throws(
    () => createItem(s.ctx, { type: 'rule', title: SECOND, supersedes: old.id }),
    /--distinct/,
  );
  s.dispose();
});

test('edit asks too, and names the item doing the superseding by its real id', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST, body: FIRST_BODY });
  const other = createItem(s.ctx, {
    type: 'rule', title: 'Read wide, write narrow',
    body: 'Read as much as you like; write only where you were asked to.',
  });

  const asked: string[] = [];
  s.ctx.confirm = (question) => { asked.push(question); return true; };
  // The BODY has to move, not only the title: `SUMMARY_BASIS.title` is
  // `unsummarised` (content-hash.ts, owner ruling 2026-08-27), so a retitle
  // alone does not move the basis and `basisMoves` — which is what gates this
  // edit — answers false. The edit moves this item's meaning onto the ground
  // the first one holds, which is what raises the pair, so the disposition is
  // not stray and the pre-flight runs with the successor's REAL id.
  updateItem(s.ctx, { id: other.id, title: SECOND, body: SECOND_BODY, supersedes: old.id });

  assert.deepEqual(asked, [supersedeQuestion({ id: old.id, title: FIRST }, other.id)]);
  assert.equal(s.ctx.store.get(old.id)!.status, 'superseded');
  s.dispose();
});

/**
 * **A missing hook is never a silent yes on the path that matters, and it is
 * not a block either.** The MCP tools and ingestion cannot ask anybody, so
 * they leave `confirm` undefined; what protects a governing item from THEM is
 * the origin refusal in the same pre-flight, which this change does not touch.
 * An agent does not reach that refusal through `createItem` in the first
 * place — `trustedStatus` demotes a non-human normative capture to `draft`,
 * and a draft is not gated at all.
 */
test('a surface with no hook is not prompted, and is not blocked', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST });
  assert.equal(s.ctx.confirm, undefined);

  createItem(s.ctx, { type: 'rule', title: SECOND, supersedes: old.id });
  assert.equal(s.ctx.store.get(old.id)!.status, 'superseded');
  s.dispose();
});

/**
 * `supersedeItem` called DIRECTLY is unchanged: `mycontext supersede` has
 * already asked this exact question beside a preview by the time it gets here,
 * and that command deliberately does not set the hook. A confirm inside the
 * mutation itself would ask a person the same thing twice in one command.
 */
test('supersedeItem called directly does not consult the hook', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST });
  const next = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });

  let asked = 0;
  s.ctx.confirm = () => { asked += 1; return true; };
  supersedeItem(s.ctx, { id: old.id, by: next.id });

  assert.equal(asked, 0);
  assert.equal(s.ctx.store.get(old.id)!.status, 'superseded');
  s.dispose();
});

/**
 * **The half-done pair, closed on the half a pre-flight can reach.**
 *
 * The existing-successor refusal used to live only inside `supersedeItem`,
 * which runs after the create — so naming an item that already had a successor
 * left the new item on disk and the old one un-retired. It is a pure question
 * about the retiree's relations, so it is now asked before the write.
 *
 * What is NOT closed, and this test does not claim it is: an id that stops
 * being writable BETWEEN the pre-flight and the write. That is a
 * time-of-check/time-of-use window and only atomic create-plus-retire closes
 * it.
 */
test('an item that already has a successor is refused BEFORE anything is created', () => {
  const s = sandbox();
  const old = createItem(s.ctx, { type: 'rule', title: FIRST, body: FIRST_BODY });
  const first = createItem(s.ctx, { type: 'rule', title: 'Read wide, write narrow' });
  supersedeItem(s.ctx, { id: old.id, by: first.id });
  const before = s.ctx.store.all().length;

  let asked = 0;
  s.ctx.confirm = () => { asked += 1; return true; };
  assert.throws(
    () => createItem(s.ctx, { type: 'rule', title: SECOND, body: SECOND_BODY, supersedes: old.id }),
    /is already superseded by/,
  );

  assert.equal(s.ctx.store.all().length, before, 'the new item must not be on disk');
  // A refusal must never follow a prompt: a person asked to approve something
  // and then told it was never going to happen has been asked for nothing.
  assert.equal(asked, 0);
  s.dispose();
});

// --- through the CLI ------------------------------------------------------

test('mycontext add --supersedes retires under --yes, and the item is stood down', () => {
  const s = sandbox();
  const lines: string[] = [];
  const out = (line: string) => { lines.push(line); };

  assert.equal(
    runCli([
      'add', 'rule', FIRST, '--summary-omitted', '--always', '--yes',
    ], s.cwd, out),
    0,
    lines.join('\n'),
  );
  lines.length = 0;
  assert.equal(
    runCli([
      'add', 'rule', SECOND, '--summary-omitted', '--supersedes', RETIREE, '--yes',
    ], s.cwd, out),
    0,
    lines.join('\n'),
  );

  // **The retirement is SAID, and it was not before this task.** `createItem`
  // discarded `supersedeItem`'s message, so `add --supersedes ... --yes`
  // retired an item, stood it down, wrote both edges — and printed only
  // "created <id>".
  const printed = lines.join('\n');
  assert.match(printed, /is now superseded by/);
  assert.match(printed, /stood down/);

  const shown: string[] = [];
  runCli(['show', RETIREE], s.cwd, (l) => shown.push(l));
  assert.match(shown.join('\n'), /status: superseded/);
  assert.match(shown.join('\n'), /always: false/);
  s.dispose();
});

test('mycontext add --supersedes refuses off a TTY without --yes, and writes nothing', () => {
  const s = sandbox();
  const lines: string[] = [];
  const out = (line: string) => { lines.push(line); };

  assert.equal(
    runCli(['add', 'rule', FIRST, '--summary-omitted', '--yes'], s.cwd, out),
    0,
    lines.join('\n'),
  );
  lines.length = 0;

  // `add` on a normative category has its own confirmation, so this refusal
  // lands on that one first — the point of the assertion is the OUTCOME:
  // nothing was created and nothing was retired.
  assert.equal(
    runCli([
      'add', 'rule', SECOND, '--summary-omitted', '--supersedes', RETIREE,
    ], s.cwd, out),
    1,
  );
  assert.match(lines.join('\n'), /refusing without confirmation/);

  const shown: string[] = [];
  runCli(['show', RETIREE], s.cwd, (l) => shown.push(l));
  assert.match(shown.join('\n'), /status: active/);
  s.dispose();
});
