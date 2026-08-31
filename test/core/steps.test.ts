/**
 * `## Steps` as a first-class Item field.
 *
 * The two invariants this file exists to hold, and they pull against each
 * other, which is why the assertions come in pairs:
 *
 *  - INV-markdown-is-the-source-of-truth: `renderItem(parseItem(f)) === f`,
 *    byte for byte, over a RAW fixture rather than one this code produced.
 *  - INV-nothing-is-dropped-silently: a line inside `## Steps` that is not a
 *    checkbox is REPORTED, never skipped. Skipping it is the exact failure
 *    mode an unrecognised `##` section already has today — parsed into the
 *    section map, read by nobody, destroyed on the next persist().
 *
 * The second block of tests below is the ugly-input ledger: every shape a
 * `## Steps` section can take that this format cannot write back. Each one
 * either throws with the offending line in the message, or is pinned here as
 * a KNOWN LIMITATION with the reason it is left alone. Nothing in between —
 * an input that is quietly normalised is the defect both invariants name.
 *
 * What this test cannot do: prove that no OTHER `##` section is still
 * silently discarded. `## Steps` is now read; a `## Notes` section is not,
 * and still round-trips to nothing. That is unchanged by this task and is
 * named here so a green file is not mistaken for a general guarantee.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { computeItemChecksum, parseItem, renderItem } from '../../src/core/item.ts';
import { itemContentHash } from '../../src/core/content-hash.ts';
import { validateBody, validateStepText } from '../../src/core/validate.ts';
import { REVISION_FIELDS } from '../../src/core/revision.ts';
import { createItem } from '../../src/core/mutate.ts';
import type { CreateInput, UpdateInput } from '../../src/core/mutate.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'procedure-with-steps.md');
const REL = 'items/procedure/PROC-rotate-the-stripe-webhook-secret.md';

/** The fixture's `## Steps` body, as three raw lines — so a test can remove
 *  or replace exactly that block without touching the checkbox-shaped lines
 *  the fixture deliberately carries inside a fenced block in its body. */
const STEP_LINES = [
  '- [ ] Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.',
  '- [ ] Roll the endpoint secret in Stripe.',
  '- [ ] Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.',
].join('\n');

function raw(): string {
  return readFileSync(FIXTURE, 'utf8');
}

/** A valid item file carrying exactly `bodyLines` as its body, written in the
 *  canonical form `renderItem` emits — every frontmatter key, in order — so
 *  that a byte-identity assertion against it is about the body and nothing
 *  else. Used for the ugly inputs, which are easier to read as a whole
 *  document than as a chain of replacements against the fixture. */
function itemWith(
  bodyLines: string[],
  fm: { id?: string; type?: string; title?: string } = {},
): string {
  const title = fm.title ?? 'X';
  return [
    '---',
    `id: ${fm.id ?? 'PROC-x'}`,
    `type: ${fm.type ?? 'procedure'}`,
    `title: ${title}`,
    'status: active',
    'severity: soft',
    'always: false',
    'scope: []',
    'tags: []',
    'origin: human',
    'source_file: null',
    'source_anchor: null',
    'source_checksum: null',
    'valid_from: null',
    'valid_until: null',
    'checksum: ""',
    '---',
    '',
    `# ${title}`,
    '',
    ...bodyLines,
    '',
  ].join('\n');
}

test('a `## Steps` section parses into steps, in file order', () => {
  const item = parseItem(raw(), REL, 'project');
  assert.deepEqual(item.steps, [
    { text: 'Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.', checked: false },
    { text: 'Roll the endpoint secret in Stripe.', checked: false },
    { text: 'Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.', checked: false },
  ]);
});

test('the raw fixture round-trips byte for byte', () => {
  assert.equal(renderItem(parseItem(raw(), REL, 'project')), raw());
});

test('the fixture\'s recorded checksum matches its own content', () => {
  // The same assertion `test/core/corpus-checksums.test.ts` makes about every
  // real item in this repo, made here about the one item that has steps: if
  // the hash of a stepful item ever moves, this fails beside that one instead
  // of only in whichever corpus first notices.
  const item = parseItem(raw(), REL, 'project');
  assert.equal(computeItemChecksum(item), item.checksum);
});

test('a hand-ticked box round-trips as ticked — the file is the source of truth', () => {
  const ticked = raw().replace('- [ ] Roll', '- [x] Roll');
  const item = parseItem(ticked, REL, 'project');
  assert.equal(item.steps[1]!.checked, true);
  assert.equal(renderItem(item), ticked);
});

test('`## Steps` renders before `## Observations`, always', () => {
  const rendered = renderItem(parseItem(raw(), REL, 'project'));
  assert.ok(rendered.indexOf('## Steps') < rendered.indexOf('## Observations'));
});

test('a step keeps "#" and a trailing parenthetical verbatim — a step line has no tag grammar', () => {
  // The one place `parseSteps` must NOT follow the `## Observations`
  // precedent: `parseObservations` strips `#tag` into `tags` and a trailing
  // `(...)` into `context`. A step has neither field, so both characters are
  // ordinary text and must survive untouched — or `- [ ] bump the #2 replica`
  // silently loses "#2 replica" the first time it is read back.
  const text = 'Roll the endpoint secret in Stripe (#2 of 3, console only)';
  const doc = raw().replace('- [ ] Roll the endpoint secret in Stripe.', `- [ ] ${text}`);
  const item = parseItem(doc, REL, 'project');
  assert.equal(item.steps[1]!.text, text);
  assert.equal(renderItem(item), doc);
});

test('checkbox-shaped lines inside a fenced block in the BODY are body, not steps', () => {
  const item = parseItem(raw(), REL, 'project');
  assert.equal(item.steps.length, 3);
  assert.ok(item.body.includes('- [ ] deploy (printed by the script, not a step of this procedure)'));
  assert.ok(item.body.includes('1. and neither is this'));
});

// ---------------------------------------------------------------------------
// The ugly-input ledger.
// ---------------------------------------------------------------------------

test('a non-checkbox line inside `## Steps` fails the item and names the line', () => {
  const doc = raw().replace('- [ ] Roll', '- Roll');
  assert.throws(() => parseItem(doc, REL, 'project'), /- Roll/);
});

test('an upper-case [X] is refused rather than silently rewritten to [x]', () => {
  const doc = raw().replace('- [ ] Roll', '- [X] Roll');
  assert.throws(() => parseItem(doc, REL, 'project'), /\[X\]/);
  // And refused as NOT A STEP — which is what pins the missing `/i` flag on
  // `STEP`. With `/i` the line still fails, but for the weaker reason that
  // it would be re-written as `[x]`; the marker is a closed two-character
  // vocabulary, not a case-insensitive one, and the message a person reads
  // has to say so.
  assert.throws(() => parseItem(doc, REL, 'project'), /is not a step/);
});

test('prose inside `## Steps` fails the item rather than being skipped', () => {
  const doc = itemWith(['## Steps', 'Do these in order, and do not skip the second one.']);
  assert.throws(
    () => parseItem(doc, 'items/procedure/PROC-x.md', 'project'),
    /Do these in order/,
  );
});

test('a numbered list inside `## Steps` is refused — steps are never renumbered because they carry no number', () => {
  // A skipped or repeated ordinal cannot arise: the ordinal of a step is its
  // position in the list and is never written to disk. A numbered list is
  // simply not this section's grammar, and saying so is the only honest
  // answer — renumbering `1. / 1. / 3.` into `1. / 2. / 3.` would rewrite
  // the file, and reading it as steps would delete the numbers.
  const doc = itemWith(['## Steps', '1. Deploy the next secret.', '1. Roll it.', '3. Promote it.']);
  assert.throws(
    () => parseItem(doc, 'items/procedure/PROC-x.md', 'project'),
    /1\. Deploy the next secret\./,
  );
});

test('a nested step is refused rather than silently un-indented', () => {
  // `parseObservations` matches against `line.trim()`, so an indented
  // observation is accepted today and re-rendered flush left — a silent
  // rewrite of the file. `parseSteps` deliberately matches the raw line so
  // the same input is reported instead.
  const doc = itemWith(['## Steps', '- [ ] Roll it.', '  - [ ] Roll it in the sandbox first.']);
  assert.throws(
    () => parseItem(doc, 'items/procedure/PROC-x.md', 'project'),
    /Roll it in the sandbox first/,
  );
});

test('a step spaced differently is refused rather than silently re-spaced', () => {
  // Each of these matches `STEP` — its `\s+` is generous — and each would
  // re-render with single spaces, rewriting the file. The renderer
  // comparison in `parseSteps` is what turns "quietly normalised" into
  // "reported".
  for (const line of ['-  [ ] Roll it.', '- [ ]  Roll it.', '-\t[ ] Roll it.']) {
    assert.throws(
      () => parseItem(itemWith(['## Steps', line]), 'items/procedure/PROC-x.md', 'project'),
      /would be re-rendered/,
      `expected ${JSON.stringify(line)} to be refused`,
    );
  }
});

test('trailing whitespace after a step is kept, because it round-trips', () => {
  // The rule is byte-identity, not tidiness: this line re-renders exactly as
  // it was written, so it is accepted and the space is part of the text. An
  // editor that strips it on save has EDITED the item, which is what the
  // recorded checksum exists to notice.
  const doc = itemWith(['## Steps', '- [ ] Roll it. ']);
  const item = parseItem(doc, 'items/procedure/PROC-x.md', 'project');
  assert.equal(item.steps[0]!.text, 'Roll it. ');
  assert.equal(renderItem(item), doc);
});

test('a blank line between steps is refused — renderItem cannot write it back', () => {
  const doc = itemWith(['## Steps', '- [ ] Roll it.', '', '- [ ] Promote it.']);
  assert.throws(
    () => parseItem(doc, 'items/procedure/PROC-x.md', 'project'),
    /blank line/,
  );
});

test('a fenced code block inside `## Steps` is refused on its fence line', () => {
  const doc = itemWith(['## Steps', '- [ ] Roll it, with:', '```', '- [ ] not a step', '```']);
  assert.throws(
    () => parseItem(doc, 'items/procedure/PROC-x.md', 'project'),
    /```/,
  );
});

test('two `## Steps` sections are refused — the first block would be destroyed', () => {
  // `splitSections` keeps the LAST block under a repeated heading and
  // `renderItem` writes exactly one, so without this the first section's
  // steps vanish on the next persist with nothing said.
  const doc = raw().replace('## Observations', `## Steps\n- [ ] A second block.\n\n## Observations`);
  assert.throws(() => parseItem(doc, REL, 'project'), /more than one "## Steps"/);
  // Mixed case is the same section, because the heading is lower-cased
  // before it is stored — so this is one heading written twice, not two.
  const mixed = itemWith(['## Steps', '- [ ] a', '', '## STEPS', '- [ ] b']);
  assert.throws(
    () => parseItem(mixed, 'items/procedure/PROC-x.md', 'project'),
    /more than one "## Steps"/,
  );
});

test('a `## Steps` heading inside a fenced block in the body is reported, not swallowed', () => {
  // `splitSections` is fence-unaware and always was: this line ends the body
  // and starts a section. Before steps existed the rest of the fence was
  // parsed into a section nothing read and deleted on the next persist.
  // It is now a load error naming the line, which is the whole of the change.
  const doc = itemWith(['Run this:', '', '```md', '## Steps', '- [ ] an example', '```']);
  assert.throws(() => parseItem(doc, 'items/procedure/PROC-x.md', 'project'), /```/);
});

test('KNOWN LIMITATION: an empty `## Steps` section parses to no steps and loses its heading', () => {
  // Exactly what an empty `## Observations` section does today, and left
  // alone for that reason: the precedent is the parser this one is modelled
  // on. No knowledge is lost — there are no steps to lose — but the heading
  // does not survive the next persist, and that is disclosed here rather
  // than discovered.
  const doc = raw().replace(`${STEP_LINES}\n`, '');
  const item = parseItem(doc, REL, 'project');
  assert.deepEqual(item.steps, []);
  assert.ok(!renderItem(item).includes('## Steps'));
});

test('KNOWN LIMITATION: a `## STEPS` heading is read, then rewritten in the canonical case', () => {
  // `splitSections` lowercases every heading, so the section is found; only
  // the heading's own spelling does not round-trip. Identical to what
  // `## OBSERVATIONS` does today, and not this task's to change: fixing it
  // would change how an existing item parses.
  const doc = itemWith(['## STEPS', '- [ ] Roll it.']);
  const item = parseItem(doc, 'items/procedure/PROC-x.md', 'project');
  assert.equal(item.steps.length, 1);
  assert.ok(renderItem(item).includes('## Steps'));
});

test('KNOWN LIMITATION: `## Steps` written after `## Observations` is moved in front of it', () => {
  // The canonical section order is `renderItem`'s, and it predates this task
  // — a file whose `## Relations` precedes its `## Observations` is
  // reordered the same way today. Pinned so the reordering is a documented
  // property of the format rather than a surprise in a diff.
  const doc = itemWith(['## Observations', '- [risk] it is the outage window', '', '## Steps', '- [ ] Roll it.']);
  const item = parseItem(doc, 'items/procedure/PROC-x.md', 'project');
  const rendered = renderItem(item);
  assert.ok(rendered.indexOf('## Steps') < rendered.indexOf('## Observations'));
  assert.notEqual(rendered, doc);
});

// ---------------------------------------------------------------------------
// The two hashes.
// ---------------------------------------------------------------------------

/**
 * The checksum this repo records for the shipped specimen below, taken
 * against the PRE-change implementation — `git stash` the working tree, run
 * `computeItemChecksum(parseItem(raw))`, paste the result. It is deliberately
 * not computed from the new code: a value the new code produced would assert
 * only that the new code agrees with itself.
 */
const STEPLESS_CHECKSUM = '32828e6ecd5defd2';

test('a stepless item hashes EXACTLY as it did before steps existed', () => {
  // If this assertion fails, `steps` entered computeItemChecksum
  // unconditionally and every corpus on earth just went red — see
  // test/core/corpus-checksums.test.ts.
  const doc = [
    '---', 'id: CONST-a', 'type: constraint', 'title: A', 'status: active',
    'severity: soft', 'always: false', 'origin: human', '---', '', '# A', '', 'Body.', '',
  ].join('\n');
  const item = parseItem(doc, 'items/constraint/CONST-a.md', 'project');
  assert.deepEqual(item.steps, []);
  assert.equal(computeItemChecksum(item), STEPLESS_CHECKSUM);
});

test('an item with no `## Steps` section is unchanged in every other field too', () => {
  // The narrower claim above is about the checksum; this is the whole item.
  // `steps: []` is the only difference between what `parseItem` returns
  // today and what it returned before this task, and the file it renders
  // back is byte-identical to the one it read.
  const doc = itemWith(['Body.'], { id: 'CONST-a', type: 'constraint', title: 'A' });
  const item = parseItem(doc, 'items/constraint/CONST-a.md', 'project');
  const { steps, ...rest } = item;
  assert.deepEqual(steps, []);
  assert.deepEqual(rest, {
    id: 'CONST-a',
    type: 'constraint',
    title: 'A',
    status: 'active',
    severity: 'soft',
    always: false,
    continuity: false, summary: null, summaryOf: null,
    scope: [],
    tags: [],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    validFrom: null,
    validUntil: null,
    checksum: '',
    extra: {},
    body: 'Body.',
    observations: [],
    relations: [],
    layer: 'project',
    filePath: 'items/constraint/CONST-a.md',
  });
  assert.equal(renderItem(item), doc);
  // ...and it is the same item the minimal spelling above parses to, so the
  // pre-change checksum covers this one too.
  assert.equal(computeItemChecksum(item), STEPLESS_CHECKSUM);
});

test('two procedures differing only in their steps do not dedupe onto each other', () => {
  const a = parseItem(raw(), REL, 'project');
  const b = { ...a, steps: [...a.steps.slice(0, 2)] };
  assert.notEqual(itemContentHash(a), itemContentHash(b));
});

test('a ticked step is different content from an unticked one', () => {
  // `canonicalStep` carries `checked`, not only `text`: a procedure whose
  // boxes a human ticked by hand asserts something different from the same
  // procedure with them clear, and `createItem`'s dedupe must not swallow
  // the difference.
  const a = parseItem(raw(), REL, 'project');
  const b = parseItem(raw().replace('- [ ] Roll', '- [x] Roll'), REL, 'project');
  assert.notEqual(itemContentHash(a), itemContentHash(b));
});

// ---------------------------------------------------------------------------
// The write boundary.
// ---------------------------------------------------------------------------

test('validateStepText refuses what would corrupt the line, and permits what would not', () => {
  assert.throws(() => validateStepText('two\nlines', 'a step'), /line break/);
  assert.throws(() => validateStepText('   ', 'a step'), /empty/);
  assert.throws(() => validateStepText('', 'a step'), /empty/);
  // Leading whitespace is swallowed by the marker's own `\s+`, so the line
  // this text produces no longer reads back as the text that was written —
  // and `parseSteps` refuses it, which would make the item this write
  // created unloadable.
  assert.throws(() => validateStepText('  indented', 'a step'), /whitespace/);
  // `#` is NOT refused: unlike an observation, a step line has no tag grammar,
  // so a step reading `bump the #2 replica` survives the round trip intact.
  assert.doesNotThrow(() => validateStepText('bump the #2 replica', 'a step'));
  // Nor is a trailing parenthetical, for the same reason: a step has no
  // `context` field for one to be moved into.
  assert.doesNotThrow(() => validateStepText('roll the secret (console only)', 'a step'));
});

test('everything validateStepText permits actually round-trips', () => {
  // The guard and the parser are two statements of one rule, and the way
  // they drift is that one of them is edited. This walks the permitted
  // shapes through the real parser rather than restating its regex.
  for (const text of [
    'bump the #2 replica',
    'roll the secret (console only)',
    'run `mycontext doctor` and read the output',
    'set A=1, B=2 — then deploy',
    '[not a checkbox] but a bracket',
  ]) {
    assert.doesNotThrow(() => validateStepText(text, 'a step'));
    const doc = itemWith(['## Steps', `- [ ] ${text}`]);
    const item = parseItem(doc, 'items/procedure/PROC-x.md', 'project');
    assert.equal(item.steps[0]!.text, text);
    assert.equal(renderItem(item), doc);
  }
});

test('validateBody now names the route a pasted procedure should take', () => {
  // A user pasting a whole procedure is refused by `validateBody` — steps
  // never enter `body` — and until steps existed the message offered only
  // observations, which is not where a procedure's steps go.
  //
  // Task 5 wrote this message naming the `## Steps` SECTION only, because the
  // flag the plan asked it to name did not exist yet, and a message naming a
  // flag the build does not have asserts a property the code lacks. Task 7
  // builds the flag, so the message now says both: the SECTION, which is where
  // steps live and the only thing a hand-editor can act on, and the two
  // COMMANDS that write one, which is what a user who has just been refused
  // actually needs. Both halves are asserted, so neither can be dropped later
  // as redundant.
  const pasted = '## Steps\n- [ ] roll it';
  assert.throws(() => validateBody(pasted), /"## Steps" section/);
  assert.throws(() => validateBody(pasted), /mycontext add procedure --step "<text>"/);
  assert.throws(() => validateBody(pasted), /create_item/);
  assert.doesNotThrow(() => validateBody('Plain prose, no heading.'));
});

test('steps is create-only, so the field-policy table is never asked about it', () => {
  assert.ok(!(REVISION_FIELDS as readonly string[]).includes('steps'));
  // UpdateInput has no `steps`; this is what keeps UPDATE_FIELD_POLICY's four
  // Assert<> types compiling untouched (spec §6m.3).
  const update: UpdateInput = { id: 'PROC-x' };
  assert.ok(!Object.hasOwn(update, 'steps'));
});

// ---------------------------------------------------------------------------
// The create boundary — `CreateInput.steps`.
//
// Everything above this line is about a file somebody wrote by hand. These are
// about a file this product wrote, and the assertion is the same one: what was
// written must parse back to what was meant, byte for byte. A test that only
// checked `file.includes(text)` would pass for a line `parseSteps` refuses,
// which is the failure this whole section exists to catch.
// ---------------------------------------------------------------------------

/** The file `filePath` names, read from disk rather than re-rendered. */
function fileOf(s: Sandbox, filePath: string): string {
  return readFileSync(path.join(s.root, ...filePath.split('/')), 'utf8');
}

test('createItem writes steps in order, unchecked, and the file round-trips byte for byte', () => {
  const s = sandbox();
  const texts = [
    'Deploy STRIPE_WEBHOOK_SECRET_NEXT beside the live secret; accept both.',
    'Roll the endpoint secret in Stripe.',
    'Promote NEXT to STRIPE_WEBHOOK_SECRET, drop NEXT, deploy again.',
  ];
  const result = createItem(s.ctx, {
    type: 'procedure',
    title: 'Rotate the webhook secret',
    body: 'The live secret leaked.',
    steps: texts,
  });

  const file = fileOf(s, result.filePath);
  const reread = parseItem(file, result.filePath, 'project');
  // Through the real parser, not `file.includes(text)`: a line this write
  // produced that `parseSteps` refuses would satisfy `includes` and make the
  // item unloadable, which is the exact defect the round trip exists to catch.
  assert.deepEqual(reread.steps, texts.map((text) => ({ text, checked: false })));
  // And it survives the NEXT persist too — `renderItem` is the other half.
  assert.equal(renderItem(reread), file);
  // The index and the file agree, so `steps` is not a field only one of them has.
  assert.deepEqual(reread, s.ctx.store.get(result.id));
  s.dispose();
});

test('a caller cannot ask for a ticked box: the field is string[], and checked is always false', () => {
  // By construction at the boundary rather than by convention. The two
  // assignments are compile-time: `string[]` is assignable to the field and
  // the field is assignable to `string[]`, so there is no shape — `Step[]`,
  // `{ text, checked }` — a caller could pass instead.
  const given: NonNullable<CreateInput['steps']> = ['Roll it', 'Deploy'];
  const asStrings: string[] = given;
  assert.deepEqual(asStrings, ['Roll it', 'Deploy']);

  const s = sandbox();
  const result = createItem(s.ctx, { type: 'procedure', title: 'Rotate it', steps: given });
  assert.deepEqual(s.ctx.store.get(result.id)!.steps.map((step) => step.checked), [false, false]);
  s.dispose();
});

test('an item created without steps is unchanged in every field, checksum included', () => {
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'procedure',
    title: 'Rotate the webhook secret',
    body: 'The live secret leaked.',
    scope: ['src/webhooks/**'],
    tags: ['security'],
    severity: 'hard',
  });
  const item = s.ctx.store.get(result.id)!;

  assert.deepEqual(item.steps, []);
  // PINNED, not recomputed. This literal was read off the build that existed
  // BEFORE `CreateInput.steps` did, by creating this exact item and printing
  // its frontmatter. A recomputed expectation would move with the code and
  // catch nothing; this one fails the moment a stepless item starts hashing
  // differently — which is what `computeItemChecksum`'s conditional `steps`
  // key exists to prevent for every item in every corpus at once (§6n.4).
  assert.equal(item.checksum, '62ce212c6ad4e08e');
  assert.deepEqual(item, {
    id: 'PROC-rotate-the-webhook-secret',
    type: 'procedure',
    title: 'Rotate the webhook secret',
    status: 'active',
    severity: 'hard',
    always: false,
    continuity: false, summary: null, summaryOf: null,
    scope: ['src/webhooks/**'],
    tags: ['security'],
    origin: 'human',
    sourceFile: null,
    sourceAnchor: null,
    sourceChecksum: null,
    // The one field that legitimately moves: it is today's date, and it is
    // not part of the checksum above.
    validFrom: item.validFrom,
    validUntil: null,
    checksum: '62ce212c6ad4e08e',
    extra: {},
    body: 'The live secret leaked.',
    steps: [],
    observations: [],
    relations: [],
    layer: 'project',
    filePath: 'items/procedure/PROC-rotate-the-webhook-secret.md',
  });

  const file = fileOf(s, result.filePath);
  assert.equal(file.includes('## Steps'), false);
  assert.equal(renderItem(parseItem(file, result.filePath, 'project')), file);
  s.dispose();
});

/**
 * The ugly-input ledger at the WRITE boundary, and the sibling of the read-side
 * ledger above. Every row states what this surface does with an input BEFORE
 * the file is written — refused with nothing on disk, or accepted because the
 * format really does hold it. Nothing in between: a step quietly repaired on
 * its way to disk is the defect both invariants name, and that is what makes
 * the `- [X]` and doubled-space rows worth pinning rather than assuming.
 */
const REFUSED_STEPS: { what: string; text: string; message: RegExp }[] = [
  { what: 'a line break', text: 'Stop the worker\nDrain the queue', message: /line break/ },
  // `\r` alone: `LINE_BREAK` covers it, and it matters because text pasted out
  // of a Windows editor carries one with no `\n` to make it visible.
  { what: 'a bare carriage return', text: 'Stop the worker\rDrain the queue', message: /line break/ },
  { what: 'an empty step', text: '', message: /is empty/ },
  { what: 'a whitespace-only step', text: '   ', message: /is empty/ },
  // Odd spacing on the LEFT only: the marker's own `\s+` swallows it, so the
  // step would read back as a different string than the one written.
  { what: 'leading whitespace', text: '  Roll the secret', message: /starts with whitespace/ },
  { what: 'a leading tab', text: '\tRoll the secret', message: /starts with whitespace/ },
];

for (const row of REFUSED_STEPS) {
  test(`createItem refuses ${row.what} in a step, and writes nothing`, () => {
    const s = sandbox();
    assert.throws(
      () => createItem(s.ctx, { type: 'procedure', title: 'Rotate it', steps: ['Fine', row.text] }),
      row.message,
    );
    // "Nothing was written" is the promise every refusal in `createItem`
    // makes, and it is the half a message cannot prove on its own.
    assert.equal(s.ctx.store.all().length, 0);
    assert.equal(existsSync(path.join(s.root, 'items', 'procedure')), false);
    s.dispose();
  });
}

test('the refusal names the offending step by its own index, not always the first', () => {
  // A refused capture of nine steps is useless if it does not say which one.
  const s = sandbox();
  assert.throws(
    () => createItem(s.ctx, {
      type: 'procedure', title: 'Rotate it', steps: ['Fine', 'Also fine', 'bad\nstep'],
    }),
    /steps\[2\]/,
  );
  s.dispose();
});

const ACCEPTED_STEPS: { what: string; text: string }[] = [
  // A caller pasting a whole Markdown line. It is NOT unwrapped and NOT
  // refused: the text renders as `- [ ] - [X] Roll the secret`, which
  // round-trips exactly, so refusing it would refuse content the format holds.
  // The upper-case `X` that `parseSteps` rejects as a MARKER is ordinary text
  // once it is inside one, which is why this row is here rather than above.
  { what: 'a pasted checkbox line, upper-case X and all', text: '- [X] Roll the secret' },
  { what: 'a Markdown list marker', text: '- Roll the secret' },
  { what: 'an interior run of spaces', text: 'Roll the secret;   then deploy' },
  // NOT collapsed, and this is the departure from `normalizeObservations`,
  // which collapses every whitespace run because `parseObservations` does.
  // `parseSteps` does not, so collapsing here would write a line that no
  // longer matches the text the caller gave.
  { what: 'a doubled interior space', text: 'Roll the secret.  Then deploy.' },
  // Trailing whitespace round-trips: the marker absorbs nothing on the right.
  { what: 'trailing whitespace', text: 'Roll the secret ' },
  { what: 'a "#" and a trailing parenthetical', text: 'bump the #2 replica (console only)' },
  { what: 'a backtick command', text: 'run `mycontext doctor` and read the output' },
];

for (const row of ACCEPTED_STEPS) {
  test(`createItem accepts ${row.what}, and it round-trips unchanged`, () => {
    const s = sandbox();
    const result = createItem(s.ctx, {
      type: 'procedure', title: 'Rotate it', steps: [row.text],
    });
    const file = fileOf(s, result.filePath);
    const reread = parseItem(file, result.filePath, 'project');
    assert.deepEqual(reread.steps, [{ text: row.text, checked: false }]);
    assert.equal(renderItem(reread), file);
    s.dispose();
  });
}

test('two procedures differing only in their steps are two items, not a duplicate', () => {
  // The one property that makes `contentHash` and `itemContentHash` agree
  // about steps: the hash taken over the INPUT and the hash taken over the
  // item recovered from the store must be the same number, or the second
  // capture is swallowed as a duplicate of the first and never written —
  // reported as success, with the steps that differ nowhere on disk.
  const s = sandbox();
  const base = { type: 'procedure', title: 'Rotate the secret', body: 'The secret leaked.' };

  const first = createItem(s.ctx, { ...base, steps: ['Deploy the next one', 'Roll it'] });
  const same = createItem(s.ctx, { ...base, steps: ['Deploy the next one', 'Roll it'] });
  const different = createItem(s.ctx, { ...base, steps: ['Deploy the next one', 'Promote it'] });

  assert.equal(first.created, true);
  assert.equal(same.created, false);
  assert.equal(same.id, first.id);
  assert.equal(different.created, true);
  assert.notEqual(different.id, first.id);
  assert.equal(s.ctx.store.all().length, 2);
  s.dispose();
});

test('steps are accepted on any category, runbook included — §6o is documentary here', () => {
  // Design decision 19, pinned so that adding the refusal later is a deliberate
  // change rather than a quiet one. §6o says a `runbook` has no `## Steps`
  // field; this plan makes that documentary rather than enforced, because
  // there is no category-conditional field rule anywhere in the product to
  // follow (`observations`, `scope` and `tags` are accepted on every category)
  // and adding the first one is a larger decision than §6o took. The direction
  // of the risk: if the refusal was meant, adding it later breaks any corpus
  // that took the offer.
  const s = sandbox();
  const result = createItem(s.ctx, {
    type: 'runbook', title: 'Restart the ingest worker', steps: ['Drain the queue'],
  });
  assert.equal(result.created, true);
  assert.deepEqual(s.ctx.store.get(result.id)!.steps, [{ text: 'Drain the queue', checked: false }]);
  s.dispose();
});
