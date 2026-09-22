// @basis TASK-release-phase-3-the-defects, DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands
/**
 * **The first-session sentence — B13, owner ruling D (2026-09-21, "keep the
 * narrow spare band, add the sentence").**
 *
 * A fresh corpus injects nothing at every session start: `select`'s pinned
 * tier only ever admits `always: true` items (`core/select.ts` ·
 * `const candidates = fresh.filter((i) => i.always);` · ~1563), and a brand
 * new `mycontext init` has none. Nothing on screen told a first-time reader
 * that this is EXPECTED rather than broken — an empty pinned tier and a
 * pinned tier that cannot pin anything look identical from outside. This is
 * the one sentence that closes that gap, printed at the two moments a person
 * is in a position to act on it: right after `init`, and while approving the
 * first normative capture a still-unpinned corpus can make.
 *
 * `DEC-the-jit-tier-offers-path-scoped-items-first-in-two-bands` is cited as
 * basis because it is the decision `fitToBudget`'s band mechanism rests on —
 * the same mechanism the pinned tier's spare band (`spareFrom`, `select.ts`)
 * reuses, and ruling D chose to keep that band narrow rather than widen it,
 * which is why the sentence exists instead of a behaviour change.
 *
 * **What this file owns, and what it leaves to `src/core/pin-sentence.ts`'s
 * own tests (there are none yet; the predicate is exercised here through both
 * call sites rather than in isolation, since it has no branch this file's
 * three scenarios do not already cover).** `NOTHING_PINNED_SENTENCE` is
 * asserted BY VALUE (imported, not retyped) so this file cannot drift from
 * the constant it is testing — a copy-pasted phrase here would keep passing
 * the day the wording changes at the source and stop meaning what it says.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { NOTHING_PINNED_SENTENCE } from '../../src/core/pin-sentence.ts';
import { removeTree } from '../helpers/tmp.ts';

function sandbox(): string {
  return mkdtempSync(path.join(tmpdir(), 'myctx-pinned-sentence-'));
}

function run(args: string[], cwd: string): { code: number; out: string } {
  let out = '';
  const code = runCli(args, cwd, (s) => { out += s + '\n'; });
  return { code, out };
}

test('init prints the first-session sentence right after "initialized"', () => {
  const cwd = sandbox();
  try {
    const { code, out } = run(['init'], cwd);
    assert.equal(code, 0, out);
    const lines = out.split('\n');
    const initIdx = lines.findIndex((l) => l.includes('my_context: initialized'));
    assert.ok(initIdx !== -1, `no "initialized" line in:\n${out}`);
    assert.equal(
      lines[initIdx + 1], NOTHING_PINNED_SENTENCE,
      `expected the first-session sentence on the line right after "initialized":\n${out}`,
    );
  } finally {
    removeTree(cwd);
  }
});

test(
  '`add rule ... --yes` prints the same sentence in its confirmation when nothing is pinned',
  () => {
    const cwd = sandbox();
    try {
      assert.equal(run(['init'], cwd).code, 0);
      const { code, out } = run(
        ['add', 'rule', 'Never log customer email', '--summary-omitted',
          '--body', 'Customer email addresses are never written to logs.', '--yes'],
        cwd,
      );
      assert.equal(code, 0, out);
      assert.ok(
        out.includes(NOTHING_PINNED_SENTENCE),
        `expected the first-session sentence in the confirmation output:\n${out}`,
      );
    } finally {
      removeTree(cwd);
    }
  },
);

test(
  'after `mycontext pin <id>`, a second `add` does NOT print the sentence',
  () => {
    const cwd = sandbox();
    try {
      assert.equal(run(['init'], cwd).code, 0);
      const first = run(
        ['add', 'rule', 'Never log customer email', '--summary-omitted',
          '--body', 'Customer email addresses are never written to logs.', '--yes'],
        cwd,
      );
      assert.equal(first.code, 0, first.out);

      const pinned = run(['pin', 'RULE-never-log-customer-email', '--yes'], cwd);
      assert.equal(pinned.code, 0, pinned.out);

      const second = run(
        ['add', 'rule', 'Always validate webhook signatures', '--summary-omitted',
          '--body', 'Every inbound webhook is signature-checked before it is trusted.', '--yes'],
        cwd,
      );
      assert.equal(second.code, 0, second.out);
      assert.ok(
        !second.out.includes(NOTHING_PINNED_SENTENCE),
        `did not expect the first-session sentence once something is pinned:\n${second.out}`,
      );
    } finally {
      removeTree(cwd);
    }
  },
);

/**
 * **The `category.enabled` half of the predicate** (task 3.11 review, phase 3
 * — `isEligible`, `core/select.ts:521-525`, checks `status === 'active'` AND
 * the item's category `enabled`; `nothingPinned` checked only the first
 * half). A rule pinned while `rule` was enabled, then disabled through
 * `mycontext config`, is exactly the state `select`'s own pinned tier already
 * drops — `isEligible` is the gate every tier reads through, and a category
 * with `enabled: false` fails it regardless of `always`. Before this fix the
 * sentence stayed silent here, disagreeing with the corpus it describes: it
 * would have reported "something is pinned" for an item the selector was
 * about to deliver nothing for.
 */
test(
  'a category disabled AFTER a rule in it was pinned makes the sentence print again',
  () => {
    const cwd = sandbox();
    try {
      assert.equal(run(['init'], cwd).code, 0);
      const first = run(
        ['add', 'rule', 'Never log customer email', '--summary-omitted',
          '--body', 'Customer email addresses are never written to logs.', '--always', '--yes'],
        cwd,
      );
      assert.equal(first.code, 0, first.out);

      const pinned = run(
        ['add', 'rule', 'Always validate webhook signatures', '--summary-omitted',
          '--body', 'Every inbound webhook is signature-checked before it is trusted.', '--yes'],
        cwd,
      );
      assert.equal(pinned.code, 0, pinned.out);
      assert.ok(
        !pinned.out.includes(NOTHING_PINNED_SENTENCE),
        `something is pinned at this point, so the sentence must not print yet:\n${pinned.out}`,
      );

      const disabled = run(['config', 'rule', '--disable', '--yes'], cwd);
      assert.equal(disabled.code, 0, disabled.out);

      const after = run(
        ['add', 'requirement', 'Every export ships a manifest', '--summary-omitted',
          '--body', 'A manifest is what the reader checks a bundle against.', '--yes'],
        cwd,
      );
      assert.equal(after.code, 0, after.out);
      assert.ok(
        after.out.includes(NOTHING_PINNED_SENTENCE),
        `the only pinned item's category is now disabled, so the selector delivers nothing ` +
        `pinned and the sentence must print again:\n${after.out}`,
      );
    } finally {
      removeTree(cwd);
    }
  },
);

test(
  '`--always` at capture also counts as pinned for a later `add`',
  () => {
    const cwd = sandbox();
    try {
      assert.equal(run(['init'], cwd).code, 0);
      const first = run(
        ['add', 'rule', 'Never log customer email', '--summary-omitted',
          '--body', 'Customer email addresses are never written to logs.', '--always', '--yes'],
        cwd,
      );
      assert.equal(first.code, 0, first.out);
      assert.ok(
        first.out.includes(NOTHING_PINNED_SENTENCE),
        `the FIRST capture still has nothing pinned yet when its own confirmation prints, so it ` +
        `must still see the sentence:\n${first.out}`,
      );

      const second = run(
        ['add', 'rule', 'Always validate webhook signatures', '--summary-omitted',
          '--body', 'Every inbound webhook is signature-checked before it is trusted.', '--yes'],
        cwd,
      );
      assert.equal(second.code, 0, second.out);
      assert.ok(
        !second.out.includes(NOTHING_PINNED_SENTENCE),
        `did not expect the first-session sentence once --always pinned something:\n${second.out}`,
      );
    } finally {
      removeTree(cwd);
    }
  },
);
