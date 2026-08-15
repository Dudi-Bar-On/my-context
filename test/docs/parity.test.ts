/**
 * Structural parity between `README.md` and its Hebrew mirror
 * `docs/README.he.md`: the same section structure, in the same order, and the
 * same documented examples, in the same order.
 *
 * The failure this prevents is the one the mirror makes cheap: a section added
 * to one language and forgotten in the other, so the Hebrew reader silently
 * gets less than the English one.
 *
 * **What this test cannot do, stated here because a green suite must not be
 * mistaken for verified Hebrew.** It compares structure, never meaning. A
 * paragraph whose Hebrew was left behind by an English edit — same heading,
 * same example, stale sentence — passes every assertion in this file, and no
 * test in this repository can catch it (spec §8). The third test below
 * *demonstrates* that blindness against the real documents rather than merely
 * asserting it in a comment: it garbles the Hebrew prose and shows the checks
 * still pass. Translation freshness is a review obligation, not a tested one.
 *
 * When a parity assertion fails, the fix is bringing the two documents into
 * line — never deleting the assertion, and never editing one document's
 * heading level to make the sequences match while the sections differ.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectExamples } from '../../scripts/gen-doc-examples.ts';

const REPO = path.join(import.meta.dirname, '..', '..');

/** LF-normalized: a working tree checked out before `.gitattributes` is CRLF. */
function read(relative: string): string {
  return readFileSync(path.join(REPO, relative), 'utf8').replaceAll('\r\n', '\n');
}

const EN = 'README.md';
const HE = path.join('docs', 'README.he.md');
const en = read(EN);
const he = read(HE);

const FENCE = /^```/;
const HEADING = /^(#{1,6}) \S/;

/**
 * The heading depths of a document, in order — `#` lines inside fenced blocks
 * excluded.
 *
 * Excluding them is deliberate. Both documents quote injected output verbatim
 * (§3, §4, §6), and that output contains `## my_context index` and similar
 * lines which are not sections of the README: they are the tool's words. As of
 * this commit the two documents agree either way — 62 `#` lines counted raw,
 * 48 headings counted here — so the choice costs no coverage today, and it
 * buys two things. A failure message that says "a section was added or removed
 * in one language only" is then true: it cannot be triggered by a change to
 * quoted output. And the quoted output is already pinned, verbatim and in both
 * documents, by `test/docs/injection.test.ts` and `test/docs/examples.test.ts`,
 * which report a drift there with the exact text to paste — a far more useful
 * failure than a depth-sequence mismatch.
 */
function headingDepths(markdown: string): number[] {
  const depths: number[] = [];
  let inFence = false;
  for (const line of markdown.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const m = HEADING.exec(line);
    if (m !== null) depths.push(m[1].length);
  }
  return depths;
}

/**
 * Guards the two ways this file could pass while checking nothing: a fence
 * toggle left open swallows the rest of the document, and a heading regex that
 * matches nothing makes two empty sequences "agree".
 *
 * The floor is well below the current 48 headings — it is here to catch a
 * broken parser, not to pin the document's size.
 */
function assertParsable(markdown: string, relative: string): number[] {
  const fences = markdown.split('\n').filter((l) => FENCE.test(l)).length;
  assert.equal(
    fences % 2, 0,
    `${relative} has an odd number of \`\`\` lines (${fences}) — an unclosed fenced block ` +
    `hides everything after it from this test`,
  );
  const depths = headingDepths(markdown);
  assert.ok(
    depths.length >= 20,
    `only ${depths.length} headings were found in ${relative}; the parser is broken, ` +
    `not the document`,
  );
  return depths;
}

test('both documents carry the same section structure', () => {
  const enDepths = assertParsable(en, EN);
  const heDepths = assertParsable(he, HE);
  assert.deepEqual(
    heDepths, enDepths,
    `a section was added or removed in one language only — update both. ` +
    `${EN} has ${enDepths.length} headings, ${HE} has ${heDepths.length}.`,
  );
});

test('both documents run the same examples, in the same order', () => {
  const enCommands = collectExamples(en).map((e) => e.command);
  const heCommands = collectExamples(he).map((e) => e.command);
  assert.ok(
    enCommands.length > 0,
    `no example markers were found in ${EN} — the marker syntax changed and this ` +
    `assertion has stopped checking anything`,
  );
  assert.deepEqual(
    heCommands, enCommands,
    `the two documents no longer demonstrate the same commands. Regenerate with ` +
    `\`npm run gen:docs\` after adding the marker to both.`,
  );
});

/**
 * The limitation, demonstrated rather than asserted.
 *
 * The plan proposed proving this point by having the test read its own source
 * and match a sentence in it. That form is vacuous here: the regex literal
 * would satisfy its own search, so the assertion passes even after the comment
 * it means to protect is deleted — and even a stricter version could only ever
 * fail when someone edits *this file*, never when the Hebrew goes stale. It
 * would report on its own prose, not on the documents.
 *
 * So the claim is exercised instead. Every Hebrew letter outside the fenced
 * blocks is replaced, which destroys the translation while leaving the
 * structure intact, and the two checks above still pass on the result. That is
 * the limitation made concrete: these assertions are blind to what the Hebrew
 * says.
 *
 * If this test ever fails, the checks above have become sensitive to prose
 * content — good news, but the disclaimers in this file, in the mirror's own
 * introduction and in spec §8 then overstate the blindness and must be
 * corrected to match.
 */
test('structural parity is blind to what the Hebrew actually says', () => {
  const HEBREW = /[֐-׿]/g;
  const lines: string[] = [];
  let inFence = false;
  for (const line of he.split('\n')) {
    if (FENCE.test(line)) {
      inFence = !inFence;
      lines.push(line);
      continue;
    }
    lines.push(inFence ? line : line.replace(HEBREW, 'ם'));
  }
  const garbled = lines.join('\n');

  assert.notEqual(garbled, he, 'the mutation changed nothing — this test would be vacuous');

  assert.deepEqual(
    headingDepths(garbled), headingDepths(en),
    'structure survived the mutation, as it must for this demonstration to mean anything',
  );
  assert.deepEqual(
    collectExamples(garbled).map((e) => e.command),
    collectExamples(en).map((e) => e.command),
  );
});
