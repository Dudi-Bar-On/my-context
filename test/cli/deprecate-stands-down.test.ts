// @basis TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned, TASK-retiring-an-item-asks-before-it-happens-wherever-it-is, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';
import { createItem } from '../../src/core/mutate.ts';
import { sandbox } from '../helpers/workspace.ts';

/**
 * **The retirement that names no replacement, at the surface a person approves
 * it from.**
 *
 * `test/cli/supersede-stand-down.test.ts` is the sibling for `mycontext
 * supersede`. This one is `mycontext edit <id> --status deprecated`, which is
 * the other supported way to take a governing item out of force — and which,
 * until 2026-09-10, left `always: true` and `severity: "hard"` on the item it
 * retired. `review discard`, `procedure done` and `inbox promote` reach the
 * same write (`updateItem`) and the semantics are pinned once, in
 * `test/core/retire-stands-down.test.ts`; what is asserted here is what the
 * PERSON is shown and asked before the write happens.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-deprecate-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

const PINNED = 'RULE-delegate-to-subagents-by-default';

function pinnedRule(cwd: string): string {
  const made = run([
    'add', 'rule', 'Delegate to subagents by default',
    '--body', 'A wide read belongs in a subagent.',
    '--summary-omitted', '--always', '--severity', 'hard', '--yes',
  ], cwd);
  assert.equal(made.code, 0, made.out);
  return PINNED;
}

test('the preview says the pin and the severity are about to be stood down', () => {
  withProject((cwd) => {
    const id = pinnedRule(cwd);
    const { code, out } = run(['edit', id, '--status', 'deprecated', '--yes'], cwd);

    assert.equal(code, 0, out);
    assert.match(out, /stood down {2}"always" -> false; it stops being pinned/);
    assert.match(out, /"severity" -> "soft"; it stops claiming to bind/);
    assert.match(out, /not cleared silently/);
    // The same wording `mycontext supersede` uses, because it is the same act
    // on the same fields — see `standingDownBy` (cli/commands/edit.ts).
    const preview = out.slice(0, out.indexOf('my_context: updated'));
    assert.ok(preview.includes('stood down'), 'the rows must come BEFORE the write, not after it');
  });
});

test('the item is retired, stood down, and says so on the file', () => {
  withProject((cwd) => {
    const id = pinnedRule(cwd);
    const { code, out } = run(['edit', id, '--status', 'deprecated', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.match(out, /It was also stood down/);

    const file = readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
    assert.match(file, /^status: deprecated$/m);
    assert.match(file, /^always: false$/m);
    assert.match(file, /^severity: soft$/m);
    assert.match(file, /- \[retirement\] Stood down on \d{4}-\d{2}-\d{2}/);
  });
});

/**
 * `contra/4` in its own words: retiring asks before it happens, wherever it is
 * triggered from. `edit`'s gate scales with what the change can do, and taking
 * a governing item OUT of force is the change a reader most needs to see — so
 * declining leaves the corpus exactly as it was, pin included.
 */
test('declining the confirmation retires nothing and stands nothing down', () => {
  withProject((cwd) => {
    const id = pinnedRule(cwd);
    // No `--yes` and no TTY: `confirmAction` refuses rather than assuming.
    const { code, out } = run(['edit', id, '--status', 'deprecated'], cwd);
    assert.notEqual(code, 0, out);

    const file = readFileSync(path.join(cwd, '.my_context', 'items', 'rule', `${id}.md`), 'utf8');
    assert.match(file, /^status: active$/m);
    assert.match(file, /^always: true$/m);
    assert.match(file, /^severity: hard$/m);
    assert.doesNotMatch(file, /Stood down/);
  });
});

test('a retirement with nothing to stand down previews no stand-down rows', () => {
  withProject((cwd) => {
    const made = run([
      'add', 'rule', 'Log every refusal', '--body', 'Every refusal is written down.',
      '--summary-omitted', '--yes',
    ], cwd);
    assert.equal(made.code, 0, made.out);
    const { code, out } = run(['edit', 'RULE-log-every-refusal', '--status', 'deprecated', '--yes'], cwd);
    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /stood down/);
    assert.doesNotMatch(out, /stands? claiming to bind/);
  });
});

/**
 * **`review discard` is a retirement too, and it composes its own sentence.**
 *
 * It prints "is now deprecated" rather than `updateItem`'s message, so before
 * `standDownSaid` was imported there it stood a pinned draft down without a
 * word said at the surface that did it — the same shape as `add --supersedes`
 * retiring an item and printing nothing. A pinned normative DRAFT is the case
 * that reaches it: an agent's capture lands `draft`, and a draft governs
 * nothing, so nothing refuses the pin on the way in.
 */
test('discarding a pinned draft says the pin was cleared, in the same words', () => {
  const s = sandbox();
  const made = createItem(s.ctx, {
    type: 'rule', title: 'Delegate to subagents by default', origin: 'agent',
    always: true, severity: 'hard',
    summary: 'A rule that wide reading is handed to a helper so the main thread keeps room.',
  });
  assert.equal(s.ctx.store.get(made.id)!.status, 'draft', 'the case needs a draft to discard');
  s.ctx.store.close();

  let out = '';
  const code = runCli(['review', 'discard', made.id, '--yes'], s.cwd, (line) => { out += line + '\n'; });
  assert.equal(code, 0, out);
  assert.match(out, /It was also stood down: "always" is now false and "severity" is now "soft"/);
  s.dispose();
});
