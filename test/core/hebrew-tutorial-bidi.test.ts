/**
 * **The two Hebrew document families keep code readable the same way.**
 *
 * Owner ruling 2026-09-06 (`TASK-the-hebrew-tutorials-adopt-dir-attributes-and-the-two`):
 * `docs/README.he.md` isolated Latin runs inside Hebrew prose with
 * `<span dir="ltr">`, and `docs/tutorials/*.he.md` did the same job with 344
 * U+200F RIGHT-TO-LEFT MARKs and 249 U+2011 NON-BREAKING HYPHENs. Both worked.
 * Nothing said which this project used, so a writer adding a Hebrew paragraph
 * picked whichever family they had open. `dir=` won on three grounds, and the
 * first is the one this test exists to defend: **a `dir=` attribute is visible
 * in the source, and a bidi control character is not.**
 *
 * That asymmetry is the whole reason a measurement has to hold this rather
 * than a review. A reviewer can see a `<span dir="ltr">` that should not be
 * there. Nobody can see a U+200F in a diff, in an editor, or in a pull request
 * — which is how the tutorials accumulated 344 of them without anyone
 * deciding to, and how one reintroduced tomorrow would go unnoticed until a
 * paragraph rendered backwards for a Hebrew reader.
 *
 * `scripts/convert-hebrew-bidi-marks.ts` did the conversion and can do it
 * again; this holds the result independently of that script, by reading the
 * files.
 *
 * **What this test does NOT claim.** It checks characters, never meaning. A
 * `<span dir="ltr">` around the wrong extent — the failure mode that makes
 * this conversion harder than a substitution, since an RLM's scope runs until
 * something ends it while an element's bounds are explicit — renders wrongly
 * and passes every assertion here. Extent was settled by reading the marks
 * against Markdown's own token boundaries and then by rendering the result;
 * see the header of the conversion script. This file guards the floor, not
 * the ceiling.
 *
 * **Why this lives in `test/core/` and not in `test/docs/`.** `test/docs/` is
 * a COUNTED directory: `test/docs/counts.test.ts` reads it back and asserts
 * that `README.md` and `docs/README.he.md` both state how many files are in
 * it, so adding a file there is also an edit to two README paragraphs. This
 * follows `test/core/tutorial-manifest.test.ts`, a `docs/tutorials/` test
 * that sits here for its own reasons. Nothing below depends on the directory.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const TUTORIALS = path.join(REPO, 'docs', 'tutorials');

/**
 * Every character that steers the bidirectional algorithm invisibly: the two
 * directional marks, the Arabic letter mark, the embedding/override set and
 * the isolate set. U+2011 NON-BREAKING HYPHEN is handled separately below
 * because it is not one of these — it is a visible glyph, and it fails the
 * ruling's SECOND reason rather than its first.
 */
const BIDI_CONTROLS: Array<[string, string]> = [
  ['‎', 'LEFT-TO-RIGHT MARK'],
  ['‏', 'RIGHT-TO-LEFT MARK'],
  ['؜', 'ARABIC LETTER MARK'],
  ['‪', 'LEFT-TO-RIGHT EMBEDDING'],
  ['‫', 'RIGHT-TO-LEFT EMBEDDING'],
  ['‬', 'POP DIRECTIONAL FORMATTING'],
  ['‭', 'LEFT-TO-RIGHT OVERRIDE'],
  ['‮', 'RIGHT-TO-LEFT OVERRIDE'],
  ['⁦', 'LEFT-TO-RIGHT ISOLATE'],
  ['⁧', 'RIGHT-TO-LEFT ISOLATE'],
  ['⁨', 'FIRST STRONG ISOLATE'],
  ['⁩', 'POP DIRECTIONAL ISOLATE'],
];

const HEBREW = readdirSync(TUTORIALS).filter((f) => f.endsWith('.he.md')).sort();
const ENGLISH = readdirSync(TUTORIALS).filter((f) => f.endsWith('.md') && !f.endsWith('.he.md')).sort();

function read(name: string): string {
  return readFileSync(path.join(TUTORIALS, name), 'utf8');
}

/** `file:line` for every occurrence of `needle`, so a failure names the place. */
function sites(name: string, text: string, needle: string): string[] {
  return text.split('\n').flatMap((line, i) => (
    line.includes(needle) ? [`${name}:${i + 1}`] : []
  ));
}

test('the Hebrew tutorial family exists and is the size the ruling measured', () => {
  assert.equal(HEBREW.length, 24, 'expected 24 Hebrew tutorials');
  assert.equal(ENGLISH.length, HEBREW.length,
    'every Hebrew tutorial mirrors an English one and vice versa');
  for (const he of HEBREW) {
    assert.ok(ENGLISH.includes(he.replace('.he.md', '.md')), `${he} has no English mirror`);
  }
});

test('no Hebrew tutorial carries an invisible bidi control character', () => {
  const found: string[] = [];
  for (const name of HEBREW) {
    const text = read(name);
    for (const [ch, label] of BIDI_CONTROLS) {
      for (const at of sites(name, text, ch)) found.push(`${at} — ${label} (U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')})`);
    }
  }
  assert.deepEqual(found, [],
    'a bidi control character is invisible in every editor and in every diff. '
    + 'Isolate the Latin run with <span dir="ltr">…</span> instead — the convention '
    + 'docs/README.he.md states in its own header comment — and run '
    + '`node scripts/convert-hebrew-bidi-marks.ts` to do it and report what it changed.');
});

test('no Hebrew tutorial carries a non-breaking hyphen', () => {
  const found: string[] = [];
  for (const name of HEBREW) {
    for (const at of sites(name, read(name), '‑')) found.push(at);
  }
  assert.deepEqual(found, [],
    'U+2011 NON-BREAKING HYPHEN does not survive a copy-paste into a terminal or an '
    + 'issue, and four of the originals sat inside fenced shell commands. The Hebrew '
    + 'prefix hyphen is an ASCII "-", which is what docs/README.he.md writes in the '
    + 'same position (ל-Claude).');
});

test('the English tutorials carry no marks either, and were never in scope', () => {
  const found: string[] = [];
  for (const name of ENGLISH) {
    const text = read(name);
    for (const [ch] of BIDI_CONTROLS) for (const at of sites(name, text, ch)) found.push(at);
    for (const at of sites(name, text, '‑')) found.push(at);
  }
  assert.deepEqual(found, [], 'an English tutorial has no bidirectional text to steer');
});

test('every <span dir="ltr"> a Hebrew tutorial opens is closed', () => {
  for (const name of HEBREW) {
    const text = read(name);
    const opened = (text.match(/<span dir="ltr">/g) ?? []).length;
    const closed = (text.match(/<\/span>/g) ?? []).length;
    assert.equal(closed, opened, `${name}: ${opened} <span dir="ltr"> opened, ${closed} </span> closed`);
  }
});

test('the family actually adopted dir=, rather than merely dropping the marks', () => {
  const total = HEBREW.reduce((n, name) => n + (read(name).match(/<span dir="ltr">/g) ?? []).length, 0);
  assert.ok(total > 100,
    `only ${total} <span dir="ltr"> runs across ${HEBREW.length} Hebrew tutorials — `
    + 'the marks were removed without the isolates that replace them');
  // Not every file needs one, but a Hebrew tutorial that quotes flags and code
  // spans and has none at all is far more likely to have been reverted than to
  // have been written without any Latin run needing isolation.
  const bare = HEBREW.filter((name) => !read(name).includes('<span dir="ltr">'));
  assert.deepEqual(bare, [], 'these Hebrew tutorials carry no LTR isolate at all');
});

test('the isolate is written exactly the way docs/README.he.md writes it', () => {
  // One spelling, so a grep for the convention finds every instance of it.
  // `dir='ltr'`, `dir=ltr` and `<span  dir="ltr">` all render, and all defeat
  // the search that makes this convention reviewable in the first place.
  const wrong: string[] = [];
  for (const name of HEBREW) {
    read(name).split('\n').forEach((line, i) => {
      for (const m of line.matchAll(/<span[^>]*\bdir\b[^>]*>/g)) {
        if (m[0] !== '<span dir="ltr">') wrong.push(`${name}:${i + 1} — ${m[0]}`);
      }
    });
  }
  assert.deepEqual(wrong, [], 'write the isolate as <span dir="ltr">, the spelling docs/README.he.md uses');
});
