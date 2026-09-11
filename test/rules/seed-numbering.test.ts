// @basis TASK-seed-the-store-and-migrate-the-rules-that-already-exist, CONST-evidence-must-cite-a-captured-record-id
/**
 * **The first seed entry's DETECTIVE check, and the number it produced.**
 *
 * D41 spec §4 ("the first seed entry, chosen deliberately") and `plan:store
 * seq:4` Task 14. The entry is the numbering standard — *a question put to the
 * owner carries numbered options and one marked recommendation* — and it was
 * chosen first because its own history is the argument for the store existing
 * at all: the owner asked for it, it went into a memory file as prose, and
 * within the same conversation nothing could say whether it was being obeyed.
 *
 * So this file's subject is not "does the entry parse". It is **can the
 * standard be measured** — because spec §4 rules that `detective` is the only
 * enforcement available for a rule about the assistant's own output, and an
 * entry declaring `detective:` with nothing behind it would be the store
 * telling the same unmeasured story `CLAUDE.md` tells.
 *
 * ── WHY THE TRIGGER IS THE CLOSING PARAGRAPH ───────────────────────────────
 *
 * A standard names the ACT it governs (spec §5), and the act here is *putting
 * a decision to the owner*. Measured over the real archive on 2026-09-11, the
 * looser detectors are the ones that are wrong: "the turn contains a numbered
 * list" matches 131 turns, most of them explanations that happen to enumerate,
 * and "the turn contains a question mark" matches tables and shell output. The
 * turn's LAST paragraph is where the ask actually lives, and it is mechanical
 * enough that a reader can re-derive the population by hand.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import path from 'node:path';
import {
  checkAskNumbering, closingParagraph, inspect, ownerTurns, type Turn,
} from '../../scripts/check-ask-numbering.ts';
import { entriesDir, loadRules } from '../../src/rules/store.ts';

/** The first seed entry, chosen deliberately — spec §4. */
const SEED = 'numbered-options-on-a-question-put-to-the-owner';

/** A question put to the owner, in the shape the standard asks for. */
const OBEYED = [
  'Two ways to take the store update, and they differ in what a running lane sees.',
  '',
  '1 — **Recommended.** Inject only the diff, phrased as a supersession.',
  '2 — Re-inject the whole store and let the model work out what moved.',
  '',
  'Which do you want?',
].join('\n');

/** The same decision, written the way the archive actually writes them. */
const UNNUMBERED = [
  'Two ways to take the store update, and they differ in what a running lane sees.',
  '',
  '- Inject only the diff, phrased as a supersession.',
  '- Re-inject the whole store and let the model work out what moved.',
  '',
  'Which do you want? I would take the first.',
].join('\n');

function turn(text: string, recordIndex = 0): Turn {
  return { sessionId: 'S', agentId: null, recordIndex, at: null, text };
}

test('the closing paragraph is the last block, not the whole turn', () => {
  assert.equal(closingParagraph(OBEYED), 'Which do you want?');
});

test('a question whose options are not numbered is reported as a violation', () => {
  const report = checkAskNumbering([turn(UNNUMBERED)]);
  assert.equal(report.asked, 1);
  assert.equal(report.held, 0);
  assert.deepEqual(report.violations.map((v) => v.why), ['unnumbered']);
});

test('a question in the standard shape holds', () => {
  const report = checkAskNumbering([turn(OBEYED)]);
  assert.equal(report.asked, 1);
  assert.equal(report.held, 1);
  assert.deepEqual(report.violations, []);
});

test('the recommendation must be FIRST, not merely present', () => {
  const second = OBEYED
    .replace('1 — **Recommended.** Inject only the diff, phrased as a supersession.',
      '1 — Inject only the diff, phrased as a supersession.')
    .replace('2 — Re-inject the whole store and let the model work out what moved.',
      '2 — **Recommended.** Re-inject the whole store and let the model work out what moved.');
  assert.equal(inspect(second).recommended.length, 1);
  assert.equal(inspect(second).held, false);
  assert.equal(checkAskNumbering([turn(second)]).violations[0].why, 'recommendation_not_first');
});

test('two marked recommendations is not one marked recommendation', () => {
  const both = OBEYED.replace(
    '2 — Re-inject the whole store',
    '2 — I would also recommend: re-inject the whole store',
  );
  assert.deepEqual(inspect(both).recommended, [1, 2]);
  assert.equal(checkAskNumbering([turn(both)]).violations[0].why, 'not_exactly_one_recommendation');
});

test('numbered options with no recommendation at all are named as that', () => {
  const none = OBEYED.replace('1 — **Recommended.** Inject', '1 — Inject');
  assert.equal(checkAskNumbering([turn(none)]).violations[0].why, 'not_exactly_one_recommendation');
});

test('a turn that closes on a statement is not a question put to the owner', () => {
  const report = checkAskNumbering([turn('Both lanes landed. Committed as `5515ed2`.')]);
  assert.equal(report.examined, 1);
  assert.equal(report.asked, 0);
});

test('an enumerator that is not the standard shape is counted apart, not silently', () => {
  const dotted = OBEYED
    .replace('1 — **Recommended.** Inject', '1. **Recommended.** Inject')
    .replace('2 — Re-inject', '2. Re-inject');
  const verdict = inspect(dotted);
  assert.equal(verdict.numbered, 0);
  assert.equal(verdict.enumerated, 2);
});

test('the real archive is readable and the standard is measurable over it', () => {
  const turns = [...ownerTurns(process.env, process.cwd())];
  assert.ok(turns.length > 1000, `the archive yielded ${turns.length} assistant turns`);
  const report = checkAskNumbering(turns);
  assert.ok(report.asked > 0, 'no question to the owner was found in the whole archive');
  assert.equal(report.held + report.violations.length, report.asked);
});

/**
 * **The entry and the check are one thing, not two that can drift.**
 *
 * Spec §4: *"the template is the schema, the check AND the form — one thing,
 * not three that can drift."* An entry declaring `detective:` and naming
 * something no reader can run is the weaker form wearing the stronger form's
 * clothes, which is the exact failure the `check` field was added to make
 * visible.
 */
test('the seed entry declares a detective check that names a runnable file', () => {
  const loaded = loadRules(entriesDir(), true);
  const entry = loaded.entries.find((e) => e.id === SEED);
  assert.ok(entry !== undefined, `${SEED} did not load`);
  assert.equal(entry.kind, 'standard');
  assert.equal(entry.check.how, 'detective');
  // `how` is narrowed to `'detective'` by the assertion above, which is why
  // this reads the positive case rather than excluding `'none'`.
  const named = entry.check.how === 'detective' ? entry.check.name : '';
  const cited = /(scripts\/[\w-]+\.ts)/.exec(named);
  assert.ok(cited !== null, `the check names no file to run: ${JSON.stringify(named)}`);
  assert.equal(existsSync(path.join(process.cwd(), cited[1])), true, `${cited[1]} does not exist`);
});

test('the seed entry records the number its own check produced', () => {
  const loaded = loadRules(entriesDir(), true);
  const entry = loaded.entries.find((e) => e.id === SEED);
  assert.ok(entry !== undefined);
  // Structure, not a substring: a measurement line names a date, a
  // denominator and a numerator, and asserting on the shape stops a body that
  // merely mentions the words from passing.
  const measured =
    /\*\*MEASURED (\d{4}-\d{2}-\d{2})[\s\S]{0,400}?\*\*([\d,]+) questions\*\*[\s\S]{0,300}?\*\*([\d,]+) held\*\*/
      .exec(entry.body);
  assert.ok(measured !== null, `no dated measurement in the body:\n${entry.body}`);
  const count = (raw: string): number => Number(raw.replace(/,/g, ''));
  assert.ok(count(measured[2]) > 0, 'the denominator is zero, so the rate says nothing');
  assert.ok(count(measured[3]) <= count(measured[2]), 'more questions held than were asked');
});
