/**
 * `checkBodyAgreement` — the first check that reads an item's PROSE against
 * the title and fields printed above it.
 *
 * Every other doctor check compares a field with something outside the item: a
 * checksum with a file, a scope with the repository, a tag with its projection.
 * None of them opens the body. Writing summaries for the whole corpus forced
 * somebody to read every body once, and that turned up items closing
 * themselves in their own text while their fields still read as open, titles
 * asserting a defect the body withdraws, and one INJECTED rule claiming a
 * parity its body had already given up.
 *
 * Two properties decide whether this survives contact with a real corpus, and
 * both are pinned below.
 *
 * **The vocabulary is DERIVED, not listed.** `unheldValues` reads the item's
 * own declared field values through `updatesFor`, so a `state` value added to
 * `config.json` is followed with no edit to `checks.ts` — the test below adds
 * a value no shipped catalogue has and expects the check to know it.
 *
 * **The SHAPE is what makes it precise.** Only a shouted clause OPENING a line
 * is read, and a clause carrying a hedge is a plan rather than a verdict. That
 * is the whole reason `DONE WHEN:` — an acceptance criterion on eight
 * requirements in this repository's corpus — is not eight false findings.
 *
 * And it is `info`, permanently: the signal is inferential, and the remedy is
 * moving a status or rewriting a title, which is the owner's call. An error
 * would push whoever wants a green run into editing exactly those fields.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkBodyAgreement } from '../../src/doctor/checks.ts';
import { resolveConfig } from '../../src/core/config.ts';
import type { Item } from '../../src/core/types.ts';

const CONFIG = resolveConfig({
  categories: {
    task: {
      tier: 'rationale',
      prefix: 'TASK',
      description: 'A unit of planned work.',
      extraFields: ['state'],
      updates: {
        state: { store: 'field', values: ['todo', 'doing', 'blocked', 'done'] },
      },
    },
  },
});

function item(over: Partial<Item> = {}): Item {
  return {
    id: 'NOTE-a', type: 'note', title: 'A note', status: 'active',
    severity: 'soft', always: false, continuity: false, summary: null, summaryOf: null, acknowledged: {},
    scope: [], tags: [], origin: 'human', sourceFile: null, sourceAnchor: null,
    sourceChecksum: null, validFrom: null, validUntil: null, checksum: 'x', extra: {},
    body: '', steps: [], observations: [], relations: [],
    layer: 'project', filePath: 'items/note/NOTE-a.md',
    ...over,
  };
}

/** Every finding except the standing limitation note, which every run carries. */
function reported(items: Item[]): { item?: string; message: string }[] {
  return checkBodyAgreement(items, CONFIG)
    .filter((f) => f.code !== 'body_review_limits')
    .map((f) => ({ item: f.item, message: f.message }));
}

test('a body that agrees with its title and fields is not reported', () => {
  assert.deepEqual(reported([item({ body: 'The preview draws four disclosures and a carried block.' })]), []);
});

test('a clean run is SILENT — the note rides with findings, and the trade is named', () => {
  // The check can silently miss, so its reach is stated in the output. It is
  // stated BESIDE the findings rather than unconditionally, because "a clean
  // corpus's summary counts are exactly 0/0/0" is pinned in three other test
  // files and is what makes `doctor` usable in CI. Pinned here so that reversing
  // the trade is a deliberate act with a test to change, not a drift.
  assert.deepEqual(checkBodyAgreement([item({ body: 'Nothing to see.' })], CONFIG), []);
});

test('where there ARE findings, the note says the count is a floor', () => {
  const findings = checkBodyAgreement([item({ body: 'RESOLVED 2026-08-28.' })], CONFIG);
  const note = findings.find((f) => f.code === 'body_review_limits')!;
  assert.equal(note.level, 'info');
  assert.match(note.message, /are a FLOOR and not a count/);
  assert.match(note.message, /"none found" is not "none present"/);
});

test('a shouted status the item does not hold is reported against the field that holds it', () => {
  const findings = checkBodyAgreement(
    [item({ body: 'VERDICT: SUPERSEDED BY plan:walk seq:16, which is later and wider.' })],
    CONFIG,
  );
  assert.equal(findings.length, 2); // the finding, and the standing note
  assert.equal(findings[0]!.code, 'body_disagrees_with_meta');
  assert.equal(findings[0]!.level, 'info');
  assert.equal(findings[0]!.item, 'NOTE-a');
  assert.match(findings[0]!.message, /shouts "SUPERSEDED" while status is "active"/);
});

test('the vocabulary is read from CONFIG, so a value no catalogue ships is still known', () => {
  const config = resolveConfig({
    categories: {
      task: {
        tier: 'rationale', prefix: 'TASK', description: 'work', extraFields: ['state'],
        updates: { state: { store: 'field', values: ['todo', 'abandoned'] } },
      },
    },
  });
  const one = item({
    id: 'TASK-a', type: 'task', filePath: 'items/task/TASK-a.md',
    extra: { state: 'todo' }, body: 'ABANDONED 2026-08-26, under a later decision.',
  });
  const findings = checkBodyAgreement([one], config).filter((f) => f.code !== 'body_review_limits');
  assert.equal(findings.length, 1);
  assert.match(findings[0]!.message, /shouts "ABANDONED" while state is "todo"/);
});

test('a closing verdict no vocabulary declares is reported while the item is open', () => {
  const out = reported([item({ body: 'RESOLVED 2026-08-28 by `npm link`, and the fix held.' })]);
  assert.equal(out.length, 1);
  assert.match(out[0]!.message, /closing verdict "RESOLVED" on an item still open/);
});

test('the same closing verdict, on an item whose fields already say it is finished, is silent', () => {
  assert.deepEqual(
    reported([item({
      id: 'TASK-a', type: 'task', filePath: 'items/task/TASK-a.md',
      extra: { state: 'done' }, body: 'CLOSED 2026-08-26 AS MOOT, under a later decision.',
    })]),
    [],
  );
});

test('an ACCEPTANCE CRITERION is not a verdict — "DONE WHEN:" is hedged and stays quiet', () => {
  assert.deepEqual(reported([item({
    id: 'TASK-a', type: 'task', filePath: 'items/task/TASK-a.md', extra: { state: 'todo' },
    body: 'DONE WHEN: every command site in the UI is a builder.',
  })]), []);
});

test('a negated or conditional clause is not a verdict either', () => {
  assert.deepEqual(reported([
    item({ body: 'UNTIL THIS IS FIXED, INSTALLING IS REFUSED ON THIS MACHINE.' }),
    item({ id: 'NOTE-b', body: 'THIS TASK IS NOT DONE AND MUST NOT BE CLOSED ON WHAT FOLLOWS.' }),
  ]), []);
});

test('a verdict word buried mid-line is not read — only a clause OPENING a line is', () => {
  assert.deepEqual(reported([item({
    body: 'The screen handles this exactly right and that is why it is filed rather than FIXED in passing.',
  })]), []);
});

test('one verdict word shouted three times is one finding, not three', () => {
  const out = reported([item({ body: 'RESOLVED 2026-08-28.\nRESOLVED again.\nRESOLVED, still.' })]);
  assert.equal(out.length, 1);
  assert.equal((out[0]!.message.match(/RESOLVED/g) ?? []).length, 1);
});

test('a body saying its own title is now wrong is reported whatever the fields say', () => {
  const out = reported([item({
    id: 'TASK-a', type: 'task', filePath: 'items/task/TASK-a.md', extra: { state: 'done' },
    title: 'reconcile the 13 tasks whose state tag and state field disagree',
    body: 'VERDICT: STANDS. The title is now wrong and the mechanism is still live.',
  })]);
  assert.equal(out.length, 1);
  assert.match(out[0]!.message, /retracts its own premise/);
});

test('a falsity claim about the SUBJECT is not a retraction of the ITEM', () => {
  // "the snapshot is stale" and "PACKS WAS WRONG" are the finding an item
  // exists to record. Without this, every well-written known_issue is a note.
  assert.deepEqual(reported([
    item({ body: 'THE REASON: a drifted source means the SNAPSHOT is stale, not that the item is.' }),
    item({ id: 'NOTE-b', body: 'PACKS WAS WRONG. The count came from the wrong column.' }),
  ]), []);
});

test('an announced withdrawal is read even with no self-reference, when it is shouted', () => {
  const out = reported([item({
    type: 'rule', id: 'RULE-a', filePath: 'items/rule/RULE-a.md',
    title: '1:1 with the mockup, and the owner says when it is done',
    body: 'WHAT NO LONGER HOLDS: that the app must equal the mockup in BOTH directions.',
  })]);
  assert.equal(out.length, 1);
  assert.match(out[0]!.message, /NO LONGER HOLDS/);
});

test('a count in the title the body re-measures is reported', () => {
  const out = reported([item({
    title: 'ExperimentalWarning on every hook invocation, keeping 11 tests red',
    body: 'RE-MEASURED: 145 tests are red today, not the eleven this title names.',
  })]);
  assert.equal(out.length, 1);
  assert.match(out[0]!.message, /title says 11 tests; body says 145/);
});

test('a body that states the title count as well as another is elaborating, not disagreeing', () => {
  assert.deepEqual(reported([item({
    title: 'reconcile the 13 tasks whose tag and field disagree',
    body: 'It was 13 tasks on Monday and 28 tasks today; both counts are here on purpose.',
  })]), []);
});

test('a version or a sequence number in a title is not a count', () => {
  assert.deepEqual(reported([
    item({ title: 'v2.0 citations are symbol plus verbatim fragment', body: 'There are 186 citations.' }),
    item({ id: 'NOTE-b', title: 'ui2 task 11: The Work screen', body: 'It has 1 task left.' }),
  ]), []);
});

test('the standing note counts what it reported and what it read', () => {
  const findings = checkBodyAgreement(
    [item({ body: 'RESOLVED 2026-08-28.' }), item({ id: 'NOTE-b', body: 'Fine.' })],
    CONFIG,
  );
  const note = findings.find((f) => f.code === 'body_review_limits')!;
  assert.match(note.message, /the 1 finding\(s\) above, out of 2 item\(s\) read/);
});
