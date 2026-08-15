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

const FENCE = /^ {0,3}(`{3,})[ \t]*(\S*)/;
const HEADING = /^(#{1,6}) \S/;

/**
 * A CommonMark fence tracker, rather than a `/^```/` toggle.
 *
 * The toggle was wrong and stayed green by luck. Both documents now carry a
 * five-backtick example block — `mycontext ingest`'s extraction request — whose
 * body holds a ```` ```json ```` fence and a four-backtick one, and each of
 * those inner lines starts with three backticks, so the toggle flipped on all
 * of them. It happened to flip an even number of times, so the parity
 * assertions still saw the real headings; a body with one more inner fence, or
 * an opener at the wrong nesting, would have silently hidden a section of the
 * document from every check in this file.
 *
 * The rule implemented here is the one CommonMark states and the one
 * `scripts/gen-doc-examples.ts` already derives its closing fence from: while
 * open, a block ends only at a line whose backtick run is at least as long as
 * the opener's and which holds nothing else. Everything shorter is body.
 *
 * Returns a predicate that reports, for each line in order, whether that line
 * is inside a fenced block or is one of its two fence lines.
 */
function fenceTracker(): (line: string) => boolean {
  let open: number | null = null;
  return (line: string): boolean => {
    const m = FENCE.exec(line);
    if (open === null) {
      // An opening fence may carry an info string (```text); a closing one may not.
      if (m !== null) { open = m[1].length; return true; }
      return false;
    }
    if (m !== null && m[1].length >= open && m[2] === '') { open = null; return true; }
    return true;
  };
}

/**
 * The heading depths of a document, in order — `#` lines inside fenced blocks
 * excluded.
 *
 * Excluding them is deliberate. Both documents quote injected output verbatim
 * (§3, §4, §6), and that output contains `## my_context index` and similar
 * lines which are not sections of the README: they are the tool's words. As of
 * this commit that is 87 `#` lines raw against 64 headings counted here — the
 * same 64 GitHub's own renderer emits `<h1>`…`<h6>` for, checked by rendering
 * both documents through its markdown API. The exclusion buys two things. A
 * failure message that says "a section was added or removed
 * in one language only" is then true: it cannot be triggered by a change to
 * quoted output. And the quoted output is already pinned, verbatim and in both
 * documents, by `test/docs/injection.test.ts` and `test/docs/examples.test.ts`,
 * which report a drift there with the exact text to paste — a far more useful
 * failure than a depth-sequence mismatch.
 */
function headingDepths(markdown: string): number[] {
  const depths: number[] = [];
  const fenced = fenceTracker();
  for (const line of markdown.split('\n')) {
    if (fenced(line)) continue;
    const m = HEADING.exec(line);
    if (m !== null) depths.push(m[1].length);
  }
  return depths;
}

/**
 * Guards the three ways this file could pass while checking nothing: a fenced
 * block left unclosed swallows the rest of the document, a fence regex that
 * matches nothing makes every line "prose", and a heading regex that matches
 * nothing makes two empty sequences "agree".
 *
 * The floor is well below the current 64 headings — it is here to catch a
 * broken parser, not to pin the document's size.
 */
function assertParsable(markdown: string, relative: string): number[] {
  // An unclosed block hides everything after it, so the tracker must end closed.
  // Asked of a trailing sentinel line that can never itself open or close one.
  const fenced = fenceTracker();
  const inside = markdown.split('\n').map((l) => fenced(l));
  assert.ok(
    inside.length > 0 && !fenced(''),
    `${relative} ends inside an unclosed fenced block — everything after it is hidden ` +
    `from this test`,
  );
  assert.ok(
    inside.some((f) => f),
    `no fenced block was found in ${relative}; the fence tracker is broken, not the document`,
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
  const fenced = fenceTracker();
  const garbled = he
    .split('\n')
    .map((line) => (fenced(line) ? line : line.replace(HEBREW, 'ם')))
    .join('\n');

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
