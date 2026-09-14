// @basis TASK-show-accepts-json-and-silently-drops-it-and-closing-that, INV-nothing-is-dropped-silently, CONST-the-cli-exit-code-contract, RULE-a-test-names-the-items-it-rests-on-or-says-it-rests-on-none
/**
 * **`mycontext show <id> --json` prints the item as JSON, and its refusal in
 * JSON too.**
 *
 * ── THE MEASUREMENT THIS CLOSES, WHICH IS NOT THE ONE FIRST REPORTED ───────
 *
 * `mycontext show NO-SUCH-ITEM --json` wrote **44 bytes of English prose on
 * stdout and exited 1**: `my_context: no item with id "NO-SUCH-ITEM".` An
 * earlier claim that it "emits nothing" was wrong, and the difference is the
 * whole point — empty output is a case a consumer can test for, while prose on
 * the channel it asked for JSON on hands it a `SyntaxError` at character 0,
 * with the real reason sitting inside the string that broke the parser.
 *
 * On the SUCCESS path the same flag was dropped without a word: Markdown,
 * exit 0, nothing said. That is `INV-nothing-is-dropped-silently`, and it was
 * the consolidation's own headline example — the one form left in the CLI that
 * did not do what its flag promised.
 *
 * ── THE RULING THIS RESTS ON ──────────────────────────────────────────────
 *
 * The item carried a DECISION rather than a fix: give `show` a parser and a
 * JSON form, or make it refuse `--json` by name. **A parser and a JSON form**,
 * 2026-09-14. The reasoning is in `core/command-flags.ts` at the `show` entry;
 * what matters here is that the choice is visible in one place a test can read
 * — `show` is in `COMMAND_FLAGS` and out of `FLAGLESS_COMMANDS` — so the
 * assertions below name the ruling rather than encoding it.
 *
 * ── AND THE ERROR ENVELOPE IS NOT WRITTEN TWICE ───────────────────────────
 *
 * Nothing in `cmdShow` renders a JSON refusal. `jsonEnvelopeFor` reads the
 * same flag tables `refuseUnknownFlag` is handed, so declaring `--json` is
 * what gives `show` the envelope every other `--json` command already had.
 * That is why the assertion below is about the envelope's SHAPE and not about
 * a second copy of the sentence.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { runCli } from '../../src/cli/index.ts';
import { COMMAND_FLAGS, FLAGLESS_COMMANDS } from '../../src/core/command-flags.ts';
import type { Item } from '../../src/core/types.ts';
import { spawnCli } from '../helpers/spawn-cli.ts';
import { removeTree } from '../helpers/tmp.ts';

const ID = 'NOTE-a-probe-item';

function project(): string {
  const cwd = mkdtempSync(path.join(tmpdir(), 'myctx-showjson-'));
  assert.equal(runCli(['init'], cwd, () => {}), 0, 'the probe workspace did not initialize');
  assert.equal(runCli([
    'add', 'note', 'a probe item', '--body', 'original body',
    '--summary', 'A probe item used by a test.', '--yes',
  ], cwd, () => {}), 0, 'the probe item was not created');
  return cwd;
}

function run(argv: string[], cwd: string): { code: number; out: string } {
  const lines: string[] = [];
  const code = runCli(argv, cwd, (s) => lines.push(s));
  return { code, out: lines.join('\n') };
}

interface ShowJson {
  item: Item;
  summaryStale: string | null;
  auditNote: string | null;
  loadErrors: { file: string; message: string }[];
}

/** Parses, and fails with the raw text rather than a `SyntaxError` about it. */
function parsed<T>(out: string): T {
  try { return JSON.parse(out) as T; } catch {
    throw new assert.AssertionError({
      message: `\`show --json\` emitted something that is not JSON:\n${out}`,
      actual: out, expected: 'a JSON document',
    });
  }
}

/* ══ 1. THE RULING, WHERE A TEST CAN READ IT ══════════════════════════════ */

test('the ruling is that `show` gained a parser, and it is visible in the flag tables', () => {
  assert.ok(
    Object.hasOwn(COMMAND_FLAGS, 'show'),
    'the other ruling was taken — `show` refuses --json by name — and every assertion below '
    + 'about a JSON form is now asserting a decision that was reversed.',
  );
  assert.deepEqual(COMMAND_FLAGS.show.allowed, ['json'], '`show`\'s surface is --json and nothing else');
  assert.deepEqual(COMMAND_FLAGS.show.values, [], '--json is a bare switch, so the id stays positional');
  assert.ok(
    !FLAGLESS_COMMANDS.includes('show'),
    'a command cannot both take a flag and be recorded as taking none — a Library screen reading '
    + 'the second would print "takes no flags" over a flag it takes',
  );
});

/* ══ 2. THE HEADLINE MEASUREMENT, AS A PROCESS ════════════════════════════ */

/**
 * Spawned rather than run in process, because the claim is stated in BYTES ON
 * STDOUT and in an exit code a caller's shell reports. `runCli` would answer
 * neither question at the place the measurement was taken.
 */
test('`show NO-SUCH-ITEM --json` answers in JSON, at the same exit code, as a process', () => {
  const cwd = project();
  try {
    const spawned = spawnCli(['show', 'NO-SUCH-ITEM', '--json'], cwd);
    assert.equal(spawned.status, 1, 'the exit code does not change — only the channel does');
    const envelope = parsed<{ error: { command: string; exit: number; argv: string[]; message: string } }>(
      spawned.stdout,
    );
    assert.equal(envelope.error.command, 'show');
    assert.equal(envelope.error.exit, 1);
    assert.deepEqual(envelope.error.argv, ['NO-SUCH-ITEM', '--json']);
    assert.match(
      envelope.error.message, /^my_context: no item with id "NO-SUCH-ITEM"\./,
      'the reason a human reads is carried verbatim INSIDE the envelope, not replaced by it',
    );
  } finally { removeTree(cwd); }
});

/**
 * **The half that makes the test above mean something, and it is a SEPARATE
 * test for a reason a removal proof taught.**
 *
 * If `--json` had simply been made the default, every assertion above would
 * pass and the command would have been broken for every person who uses it.
 * So the human refusal is pinned — at the exact byte count the item was filed
 * with, which is the unit its own measurement is stated in.
 *
 * It was one test with the assertions above until the removal proof was run:
 * a mutation to the refusal sentence reddened the envelope's `message`
 * assertion FIRST and returned, so the byte pin was never reached and was
 * never actually proved to be live. Two tests, two runs, and each mutation
 * reddens the assertion it is about.
 */
test('the human refusal is unchanged — 44 bytes of prose, and not JSON', () => {
  const cwd = project();
  try {
    const human = spawnCli(['show', 'NO-SUCH-ITEM'], cwd);
    assert.equal(human.status, 1);
    assert.equal(
      human.bytes, 44,
      'the human refusal is 44 bytes, and it is 44 bytes because that is the measurement this '
      + 'item was filed with. A change here is a change to what a person reads.',
    );
    assert.equal(human.stdout.startsWith('{'), false, 'the human form is not JSON');
  } finally { removeTree(cwd); }
});

/* ══ 3. THE SUCCESS PATH, WHICH IS WHERE THE FLAG WAS DROPPED ═════════════ */

test('`show <id> --json` prints the item as one JSON document', () => {
  const cwd = project();
  try {
    const asked = run(['show', ID, '--json'], cwd);
    assert.equal(asked.code, 0);
    const body = parsed<ShowJson>(asked.out);
    assert.equal(body.item.id, ID);
    assert.equal(body.item.type, 'note');
    assert.equal(body.item.title, 'a probe item');
    assert.equal(body.item.body, 'original body');
    assert.equal(body.item.summary, 'A probe item used by a test.');

    // The flag BEFORE the id, which `args[0]` could never have handled: it
    // used to read `--json` itself as the id and refuse it as a missing item.
    const reordered = run(['show', '--json', ID], cwd);
    assert.equal(reordered.code, 0, '`show --json <id>` must find the id it was given');
    assert.equal(parsed<ShowJson>(reordered.out).item.id, ID);

    // And the human form is unchanged — the whole reason this was a behaviour
    // change worth a ruling.
    const human = run(['show', ID], cwd);
    assert.equal(human.code, 0);
    assert.match(human.out, /^---\n/, '`show` without the flag still prints the Markdown item');
  } finally { removeTree(cwd); }
});

/* ══ 4. NOTHING THE HUMAN FORM PRINTS IS DROPPED FROM THE JSON ════════════ */

/**
 * **One hand-edit produces both disclosures at once, which is why it is one
 * fixture and not two.** Rewriting the body of the item's file behind the
 * CLI's back makes the summary STALE (the text it was written against is gone)
 * and the file's recorded checksum WRONG (a load error) in the same stroke.
 *
 * The assertion is a cross-channel EQUIVALENCE rather than two independent
 * expectations, because that is the property that matters: a `--json` reader
 * is the consumer most likely to quote a summary onward, and it must not be
 * the one consumer that never learns the summary stopped describing the item.
 *
 * The mutation is repaired in `finally` by writing the original bytes back —
 * read before the edit, restored after it, never through git.
 */
test('the JSON carries every note the Markdown form prints beside the item', () => {
  const cwd = project();
  const file = path.join(cwd, '.my_context', 'items', 'note', `${ID}.md`);
  const original = readFileSync(file, 'utf8');
  try {
    assert.ok(original.includes('original body'), 'the fixture no longer contains the text it edits');
    writeFileSync(file, original.replace('original body', 'a completely different body'), 'utf8');

    const human = run(['show', ID], cwd);
    const asked = run(['show', ID, '--json'], cwd);
    assert.equal(human.code, 0);
    assert.equal(asked.code, 0, 'a damaged read is disclosed, not failed (CONST rule 5)');
    const body = parsed<ShowJson>(asked.out);

    const humanSaysStale = /summary is STALE/.test(human.out);
    assert.equal(
      humanSaysStale, true,
      'the fixture did not make the summary stale, so the equivalence below would hold with '
      + 'both sides empty and would prove nothing',
    );
    assert.equal(
      body.summaryStale !== null, humanSaysStale,
      'the Markdown form warns that the summary no longer describes the item and the JSON form '
      + 'does not. A machine reader is the consumer most likely to quote that summary onward.',
    );

    const humanErrors = [...human.out.matchAll(/^my_context: error {2}(\S+):/gm)].map((m) => m[1]);
    assert.ok(humanErrors.length > 0, 'the fixture produced no load error, so the next line is vacuous');
    assert.deepEqual(
      body.loadErrors.map((e) => e.file), humanErrors,
      'a file that could not be read is named on one channel and not the other',
    );

    // The third field, asserted at its OTHER value and named as such: the
    // audit append succeeded here, so `auditNote` is null. It is checked so
    // that the key's presence is part of the shape rather than something a
    // consumer discovers only on the day something breaks.
    assert.equal(body.auditNote, null, 'nothing failed, so there is nothing to disclose');
  } finally {
    writeFileSync(file, original, 'utf8');
    removeTree(cwd);
  }
});

/* ══ 5. THE PARSER REFUSES WHAT IT DOES NOT KNOW ══════════════════════════ */

test('`show` now refuses an unknown flag BY NAME, where it used to read it as the id', () => {
  const cwd = project();
  try {
    const refused = run(['show', '--zzz-not-a-flag-any-command-accepts'], cwd);
    assert.equal(refused.code, 1);
    assert.match(
      refused.out, /^my_context: unknown option "--zzz-not-a-flag-any-command-accepts"\./,
      'the sentinel was read as an ITEM ID again — which is the disposition `show` had before it '
      + 'grew a parser, and it refuses the wrong thing',
    );
    assert.match(refused.out, /usage: mycontext show <id> \[--json\]/, 'the refusal prints the usage');

    // And the missing-operand case still answers about the operand, so the
    // refusal above is about the flag rather than about everything.
    const bare = run(['show'], cwd);
    assert.equal(bare.code, 1);
    assert.match(bare.out, /^usage: mycontext show <id> \[--json\]/);
  } finally { removeTree(cwd); }
});
