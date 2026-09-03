/**
 * `mycontext ack --all --code <code> [--count <n>]` — one ruling for a whole
 * class of doctor findings.
 *
 * **What this file is for.** `DEC-doctor-gets-a-bulk-settlement-overturning-the-no-bulk-ruling`,
 * owner ruling 2026-09-03, overturns his own no-bulk ruling of 2026-08-31 in one
 * word. His reason, in his words: *"for notices that could be many items, we
 * need to have a capability to fix all of them at once using doctor"*, and
 * *"doctor was added to the app for repairing this is it's role"*. The
 * measurement behind it is 71 findings on this repository, 70 of them routing to
 * `acknowledge` — seventy confirmations, one at a time.
 *
 * The decision is equally explicit about what did NOT change, and every
 * assertion here is one of those:
 *
 *  1. **The licence is bounded.** `--all` is refused without `--code`, exactly
 *     as `review promote --all` is refused without `--pack`: *"There is no
 *     unbounded bulk promote here"*. Findings of a code the human did not name
 *     must come out of this untouched.
 *  2. **Per-item acts are refused inside the bulk act.** `--clear` withdraws ONE
 *     ruling and `--list` reports on ONE item; an id positional names one item.
 *     Each is refused rather than accepted and quietly ignored.
 *  3. **The full preview precedes the gate on every path, and everything
 *     skipped is NAMED** — a bulk operation that reports only its successes is
 *     the exact shape of a silent drop (`INV-nothing-is-dropped-silently`).
 *  4. **Consent is a COUNT and never a one-token flag.**
 *     `DEC-a-stale-summary-that-is-still-correct-is-cleared-by-passing` refused
 *     a one-token flag for a bulk re-affirmation on cost — *"The guard is
 *     intrinsic to the act rather than bolted onto it"* — so `ack` still accepts
 *     no `--yes`, and a count that no longer matches what doctor finds is
 *     refused rather than settled.
 *  5. **Nothing disappears and nothing is a batch.** Each finding stays
 *     computed, reported and counted; each ruling is its own write, its own
 *     audit record and its own `--clear`.
 *
 * What this file leaves alone: the anchor and the lapse (`test/doctor/acknowledge.test.ts`),
 * and what `ack <id> <code>` does one at a time (same file). The one thing only
 * true at this seam is that the bulk path rules through the SAME
 * `acknowledgeFinding` call the one-item path uses, once per item, which the
 * audit assertions here check directly rather than by inspection.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { ackAllSkipReason, parseCount } from '../../src/cli/commands/ack.ts';
import { readAudit } from '../../src/core/audit.ts';
import { REMEDY } from '../../src/doctor/checks.ts';
import { removeTree } from '../helpers/tmp.ts';

/**
 * A body whose own wording retracts its premise, so `checkBodyAgreement`
 * reports `body_disagrees_with_meta` and NO edit to the item can clear it — the
 * measured case the whole acknowledgement mechanism exists for, borrowed from
 * `test/doctor/acknowledge.test.ts` so the two files exercise one finding.
 */
const RETRACTING_BODY =
  'THE PREMISE HERE IS RETRACTED. This rule no longer holds in the form its title claims.';

const CODE = 'body_disagrees_with_meta';

interface Box { cwd: string; run: (argv: string[]) => { code: number; text: string }; dispose(): void }

function workspace(): Box {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-ackall-'));
  const run = (argv: string[]): { code: number; text: string } => {
    const lines: string[] = [];
    let code: number;
    try {
      code = runCli(argv, cwd, (s) => lines.push(s));
    } catch (err) {
      lines.push(`THREW: ${(err as Error).message}`);
      code = 1;
    }
    return { code, text: lines.join('\n') };
  };
  assert.equal(run(['init']).code, 0, 'the probe workspace did not initialize');
  return { cwd, run, dispose: () => removeTree(cwd) };
}

/** Three rules whose bodies each retract their own title, plus one that does
 *  not — the finding of a code the bulk act must not touch has to exist, or
 *  "bounded" is untested. */
function seed(box: Box): string[] {
  const ids: string[] = [];
  for (const title of ['Never log customer email', 'Rotate tokens quarterly', 'One writer per index']) {
    const { code, text } = box.run([
      'add', 'rule', title, '--body', RETRACTING_BODY,
      '--summary', `A rule about ${title.toLowerCase()}.`, '--yes',
    ]);
    assert.equal(code, 0, `seeding "${title}" failed: ${text}`);
    const id = /\b(RULE-[a-z0-9-]+)/.exec(text)?.[1];
    assert.ok(id, `could not read the created id out of: ${text}`);
    ids.push(id);
  }
  return ids.sort();
}

/** What doctor reports for one code right now, read through the CLI's own JSON
 *  rather than by re-running the checks here: this asks the same question the
 *  command asks, so a disagreement is a real one. */
function findingsFor(box: Box, code: string): { item?: string; acknowledged?: true }[] {
  const { text } = box.run(['doctor', '--json']);
  const body = JSON.parse(text) as { findings: { code: string; item?: string; acknowledged?: true }[] };
  return body.findings.filter((f) => f.code === code);
}

// --- 1. the licence is bounded ---------------------------------------------

test('--all is refused without --code, and says there is no unbounded form', () => {
  const box = workspace();
  try {
    seed(box);
    const { code, text } = box.run(['ack', '--all']);
    assert.equal(code, 1);
    assert.match(text, /--all needs --code <code>/);
    assert.match(text, /no unbounded bulk settlement here/);
    // The refusal must TEACH: a reader who did not know a code exists needs to
    // be told where to find one (`STD-error-message-conventions`).
    assert.match(text, /mycontext doctor/);
  } finally { box.dispose(); }
});

test('--code and --count mean nothing without --all, and are refused rather than ignored', () => {
  const box = workspace();
  try {
    seed(box);
    for (const argv of [['ack', '--code', CODE], ['ack', '--count', '3']]) {
      const { code, text } = box.run(argv);
      assert.equal(code, 1, `${argv.join(' ')} was not refused`);
      assert.match(text, /belongs to the bulk form/);
      assert.match(text, /Nothing was written/);
    }
  } finally { box.dispose(); }
});

test('a code doctor does not report is refused, and the codes it DOES report are named', () => {
  const box = workspace();
  try {
    seed(box);
    const { code, text } = box.run(['ack', '--all', '--code', 'body_disagees_with_meta']);
    assert.equal(code, 1);
    assert.match(text, /doctor reports no finding with code "body_disagees_with_meta"/);
    // The vocabulary offered is THIS corpus's, derived from the run, not a
    // table — the same guarantee the one-item path makes.
    assert.match(text, new RegExp(`The codes it does report:[^\\n]*${CODE}`));
  } finally { box.dispose(); }
});

// --- 2. per-item acts are refused inside the bulk act ----------------------

test('--clear, --list and an id positional are each refused with --all', () => {
  const box = workspace();
  try {
    const ids = seed(box);
    for (const [argv, expected] of [
      [['ack', '--all', '--code', CODE, '--clear'], /--clear is refused with --all/],
      [['ack', '--all', '--code', CODE, '--list'], /--list is refused with --all/],
      [['ack', '--all', ids[0], '--code', CODE], /asks for two different rulings/],
    ] as [string[], RegExp][]) {
      const { code, text } = box.run(argv);
      assert.equal(code, 1, `${argv.join(' ')} was not refused`);
      assert.match(text, expected);
      assert.match(text, /Nothing was written/);
    }
    // And nothing was written by any of them.
    assert.equal(findingsFor(box, CODE).filter((f) => f.acknowledged === true).length, 0);
  } finally { box.dispose(); }
});

// --- 3. the preview precedes the gate, and names what it skips -------------

test('the preview prints before the gate, names every item, and writes nothing', () => {
  const box = workspace();
  try {
    const ids = seed(box);
    const { code, text } = box.run(['ack', '--all', '--code', CODE]);
    assert.equal(code, 1, 'no consent was given, so this refuses');
    for (const id of ids) assert.match(text, new RegExp(id), `${id} is not named in the preview`);
    assert.match(text, /about to acknowledge "body_disagrees_with_meta" on 3 item\(s\)/);
    // The MARK-not-filter sentence is in the PREVIEW, not only after the write:
    // it is the one property of this act a reader could get wrong, and getting
    // it wrong makes the act look like a mute button.
    assert.match(text, /a MARK and never a filter/);
    // The refusal composes the exact line that would settle it — a command a
    // refusal tells the user to type must itself run.
    assert.match(text, new RegExp(`mycontext ack --all --code ${CODE} --count 3`));
    assert.equal(findingsFor(box, CODE).filter((f) => f.acknowledged === true).length, 0,
      'the preview must not write');
  } finally { box.dispose(); }
});

test('an already-ruled-on finding is named as skipped rather than silently dropped', () => {
  const box = workspace();
  try {
    const ids = seed(box);
    assert.equal(box.run(['ack', ids[0], CODE]).code, 0, 'the one-item ruling failed');

    const { text } = box.run(['ack', '--all', '--code', CODE]);
    assert.match(text, /skipping 1 of the 3 finding\(s\)/);
    assert.match(text, new RegExp(`${ids[0]}[\\s\\S]{0,80}already acknowledged`));
    assert.match(text, /about to acknowledge "body_disagrees_with_meta" on 2 item\(s\)/);
    assert.match(text, new RegExp(`--count 2`),
      'the count offered must be what is LEFT, not what the code reports');
  } finally { box.dispose(); }
});

// --- 4. consent is a count, never a one-token flag -------------------------

test('mycontext ack accepts no --yes, and the bulk form does not introduce one', () => {
  const box = workspace();
  try {
    seed(box);
    const { code, text } = box.run(['ack', '--all', '--code', CODE, '--yes']);
    assert.equal(code, 1);
    assert.match(text, /unknown (?:flag|option) "--yes"/,
      'a one-token flag that could settle a corpus unread is refused — the guard is intrinsic '
      + 'to the act, and `approvalBoundary()` derives the boundary from exactly this answer');
  } finally { box.dispose(); }
});

test('a count that does not match what doctor finds is refused, naming both numbers', () => {
  const box = workspace();
  try {
    seed(box);
    const wrong = box.run(['ack', '--all', '--code', CODE, '--count', '2']);
    assert.equal(wrong.code, 1);
    assert.match(wrong.text, /--count says 2 and doctor reports 3/);
    assert.match(wrong.text, /the corpus moved since/,
      'the reason the two can honestly disagree is part of the refusal — the preview and the run '
      + 'are two moments, and a corpus can move between them');
    assert.match(wrong.text, /Nothing was written/);

    const notANumber = box.run(['ack', '--all', '--code', CODE, '--count', 'three']);
    assert.equal(notANumber.code, 1);
    assert.match(notANumber.text, /--count is "three", which is not a count/);

    assert.equal(findingsFor(box, CODE).filter((f) => f.acknowledged === true).length, 0);
  } finally { box.dispose(); }
});

test('parseCount takes the plain digits and nothing that merely converts to a number', () => {
  assert.equal(parseCount('34'), 34);
  assert.equal(parseCount('0'), 0);
  // Every one of these is a number to `Number()` and none of them is what the
  // preview printed. A consent token whose value a reader cannot verify by
  // looking at it is not a consent token.
  for (const raw of ['34 ', ' 34', '0x22', '3.0', '+34', '-1', '3e1', '', 'three']) {
    assert.equal(parseCount(raw), null, `"${raw}" must not be read as a count`);
  }
});

// --- 5. the write: nothing disappears, and nothing is a batch --------------

test('the ruling is recorded per item, and every finding stays reported and counted', () => {
  const box = workspace();
  try {
    const ids = seed(box);
    const before = box.run(['doctor', '--summary']).text;

    const settled = box.run(['ack', '--all', '--code', CODE, '--count', '3']);
    assert.equal(settled.code, 0, settled.text);
    assert.match(settled.text, /acknowledged "body_disagrees_with_meta" on 3 item\(s\)/);

    // NOTHING IS DROPPED. The findings are all still there, all still counted,
    // and the exit-code-bearing summary is the same sentence it was before.
    const after = findingsFor(box, CODE);
    assert.equal(after.length, 3, 'an acknowledged finding is still computed and still reported');
    assert.equal(after.filter((f) => f.acknowledged === true).length, 3);
    assert.equal(
      box.run(['doctor', '--summary']).text.split('\n')[0], before.split('\n')[0],
      'acknowledging changes the MARK and never the counts — the first line of the summary is '
      + 'the level tally and it must be identical',
    );

    // ONE AUDIT RECORD PER ITEM, never one for the batch: each ruling stays
    // individually attributable and individually clearable.
    const records = readAudit(path.join(box.cwd, '.my_context'))
      .filter((r) => r.op === 'update' && r.itemId !== undefined && ids.includes(r.itemId));
    assert.deepEqual(
      records.map((r) => r.itemId).sort(), [...ids],
      'a batch record could support neither `mycontext audit --item <id>` nor `ack --clear`',
    );
    for (const record of records) assert.equal(record.origin, 'human');

    // And each one clears on its own.
    assert.equal(box.run(['ack', ids[1], CODE, '--clear']).code, 0);
    const cleared = findingsFor(box, CODE);
    assert.equal(cleared.filter((f) => f.acknowledged === true).length, 2);
  } finally { box.dispose(); }
});

test('a second run settles nothing and says so rather than reporting success', () => {
  const box = workspace();
  try {
    seed(box);
    assert.equal(box.run(['ack', '--all', '--code', CODE, '--count', '3']).code, 0);

    const again = box.run(['ack', '--all', '--code', CODE]);
    assert.match(again.text, /skipping 3 of the 3 finding\(s\)/);
    assert.match(again.text, /nothing to settle/);
    assert.match(again.text, /Every one is named above with its reason/);
    assert.equal(again.code, 0,
      'there is nothing wrong with a corpus whose findings are all ruled on, so this is not a '
      + 'failure — it is an answer');
  } finally { box.dispose(); }
});

// --- the skip branches a real corpus cannot easily reach --------------------

/**
 * `ackAllSkipReason` is exported for the reason `promoteAllSkipReason` is: two
 * of its branches are the ones a bulk act would most plausibly get wrong and the
 * hardest to stage through a real corpus. A finding with no `item` is emitted by
 * `watched_docs_no_match` and `audit_log_size` and never by a code that also
 * names items; and a code whose findings carry MIXED routes is real rather than
 * hypothetical — `checkSourceDrift` declares `ACK` on its missing-file branch
 * and a `refresh` remedy on its drift branch, both under codes a person meets in
 * the same report.
 */
test('every reason a finding is skipped is named, and a settleable one is not', () => {
  assert.equal(ackAllSkipReason({ item: 'RULE-a', remedy: REMEDY.ACK }, true), null);

  assert.match(
    ackAllSkipReason({ remedy: REMEDY.ACK }, false)!,
    /names no item/,
    'an acknowledgement is anchored to an item\'s content, so a finding naming none cannot '
    + 'carry one — and it must be NAMED rather than quietly not settled',
  );
  assert.match(ackAllSkipReason({ item: '', remedy: REMEDY.ACK }, false)!, /names no item/,
    'an empty string is the same fact as an absent field, and must not fall through');
  assert.match(
    ackAllSkipReason({ item: 'RULE-gone', remedy: REMEDY.ACK }, false)!,
    /does not have/,
  );
  assert.match(
    ackAllSkipReason({ item: 'REF-a', remedy: { route: 'run' } }, true)!,
    /not a ruling/,
    'bulk-running a `run` remedy would rewrite N bodies — a different act with a different gate',
  );
  assert.match(
    ackAllSkipReason({ item: 'RULE-a', remedy: REMEDY.ACK, acknowledged: true }, true)!,
    /already acknowledged/,
  );
});

// --- the CLI says the bulk form exists ------------------------------------

test('both forms are on the usage line, so the second one is discoverable', () => {
  const box = workspace();
  try {
    const help = box.run(['help']).text;
    assert.match(help, /ack --all --code <code>/,
      '`mycontext --help` prints the registry usage line, and a form nobody can see is a form '
      + 'nobody uses');
  } finally { box.dispose(); }
});

/**
 * The command's own module says why consent is a count. That argument is the
 * thing a later reader is most likely to "simplify" into a `--yes`, so it is
 * pinned to the bytes: whoever removes it has to remove a test that states the
 * reason rather than deleting a comment nothing watched.
 */
test('the file records why there is no --yes, so removing the reasoning is a red test', () => {
  const source = readFileSync(
    path.join(import.meta.dirname, '..', '..', 'src', 'cli', 'commands', 'ack.ts'), 'utf8',
  );
  // Phrases that sit on ONE line of the source. A doc comment is rewrapped at
  // 79 columns, so a quotation that spans a line break would be matching the
  // formatter rather than the argument.
  assert.match(source, /is the definition of bolted on/);
  assert.match(source, /A COUNT cannot be typed without having read the preview/);
  assert.match(source, /approvalBoundary\(\)/,
    'the derivation that would start calling `ack` a boundary command is half the argument');
  // NAMED in the reasoning and never CALLED: the argument has to be able to say
  // the word, and the command must have no TTY-shaped gate — which is what makes
  // the line on the Doctor card byte for byte the line a person would type.
  assert.doesNotMatch(source, /confirmAction\(/,
    'a `confirmAction` gate would refuse off a TTY, and the Doctor card runs the CLI as a child '
    + 'process with no terminal — the exact defect `refresh` shipped on 2026-08-28');
});
