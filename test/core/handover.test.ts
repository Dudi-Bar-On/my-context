import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { handoverBlock, readHandover, type HandoverRead } from '../../src/core/handover.ts';

// --- The handover reader -----------------------------------------------------
//
// `plan:handover seq:2`. What is under test is not "does it read a file" but
// the two properties the requirement turns on: the block is BOUNDED, and it
// SAYS what it left behind. A reader that silently delivers a fifth of the
// handover is the failure the whole feature exists to prevent, arriving one
// layer further in.
//
// The marker is written `⏭` throughout rather than as the literal ⏭. The
// two are the same character; the escape is what survives an editor, a diff and
// a terminal that does not know the font, and `scripts/check-text-files.ts`
// exists because a file that stops diffing stops being reviewable.

const MARKER = '⏭';
const CONFIG = { path: 'reports/H.md', marker: MARKER, budgetTokens: 1200 };

function emptyWorkspace(): string {
  return mkdtempSync(path.join(tmpdir(), 'handover-'));
}

function workspace(body: string): string {
  const root = emptyWorkspace();
  mkdirSync(path.join(root, 'reports'), { recursive: true });
  writeFileSync(path.join(root, 'reports', 'H.md'), body, 'utf8');
  return root;
}

/** Narrows for the assertions below, and fails with the state it actually got. */
function readOf(root: string, config = CONFIG): Extract<HandoverRead, { state: 'read' }> {
  const read = readHandover(root, config);
  assert.equal(read.state, 'read', `expected a read handover, got ${read.state}`);
  return read as Extract<HandoverRead, { state: 'read' }>;
}

test('no config is off, and off says nothing at all', () => {
  assert.deepEqual(readHandover('/nowhere-at-all', null), { state: 'off' });
  assert.equal(handoverBlock({ state: 'off' }), '',
    'an unconfigured handover promised nothing, so it has nothing to disclose');
});

test('a configured file that is not there is MISSING, never silently off', () => {
  assert.deepEqual(readHandover(emptyWorkspace(), CONFIG), { state: 'missing', path: 'reports/H.md' });
});

test('a directory where a file was configured reads as missing rather than throwing', () => {
  const root = emptyWorkspace();
  mkdirSync(path.join(root, 'reports', 'H.md'), { recursive: true });
  assert.deepEqual(readHandover(root, CONFIG), { state: 'missing', path: 'reports/H.md' });
});

test('the marked section wins, and it stops at the next same-level heading', () => {
  const root = workspace([
    '# Handover',
    'preamble nobody needs',
    `### ${MARKER} DO THIS FIRST`,
    'the one instruction',
    'and its second line',
    '### SOMETHING ELSE',
    'not this',
  ].join('\n'));
  const read = readOf(root);
  assert.equal(read.source, 'marker');
  assert.match(read.text, /DO THIS FIRST/);
  assert.match(read.text, /and its second line/);
  assert.doesNotMatch(read.text, /not this/);
  assert.doesNotMatch(read.text, /preamble nobody needs/);
});

test('a HIGHER-level heading also ends the section', () => {
  const root = workspace([`### ${MARKER} NOW`, 'a', '## LATER', 'b'].join('\n'));
  assert.doesNotMatch(readOf(root).text, /LATER/);
});

test('a deeper heading inside the marked section is KEPT', () => {
  // A `####` detail under a `###` instruction belongs to the instruction. Cutting
  // at any heading would drop the half that explains the other half.
  const root = workspace([`## ${MARKER} NEXT`, 'a', '#### detail', 'b', '## OTHER', 'c'].join('\n'));
  const read = readOf(root);
  assert.match(read.text, /#### detail/);
  assert.doesNotMatch(read.text, /OTHER/);
});

test('the marker must be at the START of a heading, not anywhere in the file', () => {
  const root = workspace(['# Handover', `a paragraph mentioning ${MARKER} in passing`, '## Real', 'b'].join('\n'));
  assert.equal(readOf(root).source, 'head',
    'a marker inside prose is prose; only a heading marks a section');
});

test('no marker falls back to the HEAD, cut at a section boundary', () => {
  const body = ['# Handover', 'one', '## Second', 'two', '## Third', 'three'].join('\n');
  const read = readOf(workspace(body), { ...CONFIG, budgetTokens: 4 });
  assert.equal(read.source, 'head');
  assert.match(read.text, /# Handover/);
  assert.doesNotMatch(read.text, /Third/);
});

test('a file that fits whole is delivered whole — nothing is backed off for no reason', () => {
  const body = ['# Handover', 'one', '## Second', 'two'].join('\n');
  const read = readOf(workspace(body));
  assert.equal(read.deliveredLines, read.totalLines);
  assert.match(read.text, /two/, 'the last section survives when nothing had to be dropped');
});

test('the cut is never inside a line, however small the budget', () => {
  const long = 'a sentence that is considerably longer than the budget allows for';
  const read = readOf(workspace([`### ${MARKER} NOW`, long].join('\n')), { ...CONFIG, budgetTokens: 1 });
  for (const line of read.text.split('\n')) {
    assert.ok(line === '' || [`### ${MARKER} NOW`, long].includes(line),
      `"${line}" is a fragment — a cut sentence reads as complete and is not`);
  }
});

test('the first line is kept even when it alone exceeds the budget', () => {
  const read = readOf(workspace(`### ${MARKER} ${'x'.repeat(400)}`), { ...CONFIG, budgetTokens: 1 });
  assert.equal(read.deliveredLines, 1,
    'an empty block would claim a handover was delivered when nothing was');
});

test('the block DECLARES what it left behind — the hard list requirement', () => {
  const lines = [`### ${MARKER} NOW`, 'do it'];
  for (let i = 0; i < 400; i += 1) lines.push(`filler ${i}`);
  const read = readOf(workspace(lines.join('\n')), { ...CONFIG, budgetTokens: 20 });
  const block = handoverBlock(read);
  assert.match(block, /reports\/H\.md/);
  assert.match(block, new RegExp(`${read.deliveredLines} of ${read.totalLines}`));
  assert.match(block, /NOT here/,
    'a block that delivers a fifth of the handover and does not say so claims to be the handover');
  assert.ok(read.deliveredLines < read.totalLines);
});

test('a whole file says it is whole, rather than claiming zero lines are missing', () => {
  const block = handoverBlock(readOf(workspace([`### ${MARKER} NOW`, 'do it'].join('\n'))));
  assert.match(block, /the whole file/);
  assert.doesNotMatch(block, /0 lines are NOT here/);
});

test('a MISSING handover renders a line that names the path — silence is the defect', () => {
  const block = handoverBlock({ state: 'missing', path: 'reports/H.md' });
  assert.match(block, /reports\/H\.md/);
  assert.match(block, /handover\.path/, 'it must name the key, so the reader knows what to fix');
});

test('CRLF is read the same as LF — the handover is edited on Windows', () => {
  const read = readOf(workspace([`### ${MARKER} NOW`, 'do it', '### OTHER', 'no'].join('\r\n')));
  assert.match(read.text, /do it/);
  assert.doesNotMatch(read.text, /no/);
  assert.doesNotMatch(read.text, /\r/, 'a carriage return would reach the model as a stray glyph');
});
