// @basis TASK-retiring-an-item-also-stands-it-down-it-stops-being-pinned, INV-nothing-is-dropped-silently

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * The stand-down at the surface a PERSON approves it from.
 *
 * `mycontext supersede` prints a preview and then asks. `supersedeItem` now
 * also clears `always` and drops a `hard` severity in the same act, and a
 * person who pinned the item is entitled to learn that from the approval
 * rather than from a diff afterwards — `INV-nothing-is-dropped-silently` reads
 * on the moment of consent as much as on the record left behind.
 *
 * A separate file rather than lines added to `test/cli/supersede.test.ts`:
 * that file predates `RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-
 * on-none` and is in `scripts/basis-undeclared.txt`, where the exemption is for
 * SILENCE. Editing it would ask its author-of-record to declare what fixtures
 * written months ago rest on, which is the guess that rule exists to prevent.
 */

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

function withProject(fn: (cwd: string) => void): void {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-standdown-'));
  runCli(['init'], cwd, () => {});
  try {
    fn(cwd);
  } finally {
    removeTree(cwd);
  }
}

/** A pinned, hard rule and an unrelated replacement — unrelated on purpose, so
 * the contradiction gate has no pair to raise and the act under test is the
 * explicit `supersede` rather than a disposition answering the gate. */
function pinnedPair(cwd: string): { old: string; next: string } {
  const first = run([
    'add', 'rule', 'Delegate to subagents by default', '--body', 'A wide read belongs in a subagent.',
    '--summary-omitted', '--always', '--severity', 'hard', '--yes',
  ], cwd);
  assert.equal(first.code, 0, first.out);
  const second = run([
    'add', 'rule', 'Read wide, write narrow',
    '--body', 'Read as much as you like; write only where you were asked to.',
    '--summary-omitted', '--yes',
  ], cwd);
  assert.equal(second.code, 0, second.out);
  return { old: 'RULE-delegate-to-subagents-by-default', next: 'RULE-read-wide-write-narrow' };
}

test('the preview says the pin and the severity are about to be stood down', () => {
  withProject((cwd) => {
    const { old, next } = pinnedPair(cwd);
    const { code, out } = run(['supersede', old, '--by', next, '--yes'], cwd);

    assert.equal(code, 0, out);
    assert.match(out, /stood down {2}"always" -> false; it stops being pinned/);
    assert.match(out, /"severity" -> "soft"; it stops claiming to bind/);
    assert.match(out, /not cleared silently/);
    // Why the two fields are on two lines rather than joined into one
    // sentence: the table is rendered at 100 columns
    // (REQ-cli-output-is-tabular-with-detail-levels), and a joined line naming
    // both ran to 111. Asserted on the lines this task added, not on the whole
    // preview — the `today`/`governs` rows already carry a long injection
    // phrase and are not this task's to reflow.
    for (const line of out.split('\n')) {
      // Preview ROWS only — indented two spaces. The result sentence
      // underneath is prose the surface wraps, not a column.
      if (!line.startsWith('  ')) continue;
      if (!/stood down|stops being pinned|stops claiming to bind|cleared silently/.test(line)) {
        continue;
      }
      assert.ok(line.length <= 100, line);
    }
  });
});

test('the preview draws no stand-down line when there is nothing to stand down', () => {
  withProject((cwd) => {
    run([
      'add', 'rule', 'Log every refusal', '--body', 'A refusal that is not logged did not happen.',
      '--summary-omitted', '--yes',
    ], cwd);
    run([
      'add', 'rule', 'Read wide, write narrow',
      '--body', 'Read as much as you like; write only where you were asked to.',
      '--summary-omitted', '--yes',
    ], cwd);
    const { code, out } = run([
      'supersede', 'RULE-log-every-refusal', '--by', 'RULE-read-wide-write-narrow', '--yes',
    ], cwd);

    assert.equal(code, 0, out);
    assert.doesNotMatch(out, /stood down/);
  });
});

test('the retirement is reported and the item on disk is stood down', () => {
  withProject((cwd) => {
    const { old, next } = pinnedPair(cwd);
    const { out } = run(['supersede', old, '--by', next, '--yes'], cwd);
    assert.match(out, /It was also stood down/);

    const shown = run(['show', old], cwd).out;
    assert.match(shown, /status: superseded/);
    assert.match(shown, /always: false/);
    assert.match(shown, /severity: soft/);
    assert.match(shown, /\[supersession\] Stood down on \d{4}-\d{2}-\d{2}/);
  });
});

/**
 * The stand-down rewrites the file, so the checksum has to be re-stamped with
 * it. A note stored uncollapsed and read back collapsed is a permanent mismatch
 * that `doctor` reports as a hand edit — the exact failure `normalizeObservations`
 * is called for on the way in.
 */
test('doctor is clean afterwards, and reports nothing about the item it just stood down', () => {
  withProject((cwd) => {
    const { old, next } = pinnedPair(cwd);
    run(['supersede', old, '--by', next, '--yes'], cwd);

    const { out } = run(['doctor'], cwd);
    assert.doesNotMatch(out, /retired_still_binding/);
    assert.doesNotMatch(out, /checksum/);
  });
});
