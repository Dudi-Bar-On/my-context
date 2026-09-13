// @basis TASK-the-icon-sprite-test-has-never-been-able-to-fail-and-it
/**
 * The six action glyphs spec §6 names — refresh, copy, open, confirm, search,
 * add — are inlined once as `<symbol>` definitions and consumed elsewhere with
 * `<use href="#i-name">`. Two distinct ways that link can break, both checked
 * here rather than left to be noticed on a screen:
 *
 *   - a required glyph whose `<symbol>` never landed at all;
 *   - a reference naming a symbol nobody defined (a typo, or a symbol dropped
 *     from the sprite while a screen still reaches for it).
 *
 * ── WHAT `plan:gates seq:1` FOUND, AND IT IS TWO FAULTS ───────────────────
 *
 * **1. The use-vs-defined check had NEVER been able to fail.** It read
 * `/href="#(i-[a-z-]+)"/g` over the mockup. The mockup contains exactly two
 * `href="#i-` strings and both are inside COMMENTS, both written as the
 * placeholder `href="#i-<name>"` — where the character after `i-` is `<`,
 * which `[a-z-]` does not match. So `used` was `[]` on every run this test
 * has ever had, and the assertion reduced to `deepEqual([], [])`.
 *
 * The old header saw the hazard and described it precisely — "at the point
 * this sprite lands, nothing in the document yet writes a `<use>`, so `used`
 * is `[]` and the diff passes trivially" — and then left the diff in place
 * against a file where that condition is permanent. A gate that cannot go red
 * is worse than an absent one, because the suite's green is read as evidence.
 * **So every diff below asserts its own input is NON-EMPTY first.** That is
 * the repair, and it is a rule rather than a patch: the failure mode was not
 * the regex, it was a subtraction with nothing on the left.
 *
 * **2. It was scanning the wrong file, and the right ones were scanned by
 * nothing.** `docs/design/web-ui-mockup.html` is the DESIGN OF RECORD. The
 * sprite the product actually serves is in `src/ui/public/index.html`, and the
 * only runtime consumer of it is `screens/parts.js`'s `openIcon()`, which
 * builds the reference through the DOM — `use.setAttribute('href', '#i-open')`
 * — a form the old regex could not have seen even in the right file. Neither
 * was scanned by anything at all, so the shipped sprite could have lost a
 * symbol, or `openIcon()` could have asked for one that was never defined,
 * with the whole suite green.
 *
 * ── VERIFIED RED, BY REMOVAL, EVERY ASSERTION BELOW ───────────────────────
 *
 * Each check was re-run with its subject broken one at a time — a `<symbol>`
 * deleted from the shipped sprite, a seventh added, `openIcon()`'s id changed
 * to one nobody defines, `stroke="currentColor"` replaced by a literal, and
 * the two sprites made to disagree — and each went red naming the id. The
 * mutations and their results are in the lane report for `plan:gates seq:1`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');

/** Line endings normalised — this repository is checked out CRLF on Windows. */
function read(...parts: string[]): string {
  return readFileSync(path.join(REPO, ...parts), 'utf8').replaceAll('\r\n', '\n');
}

/** The design of record. */
const MOCKUP = read('docs', 'design', 'web-ui-mockup.html');
/** The sprite the server actually serves. */
const SHELL = read('src', 'ui', 'public', 'index.html');
/** The only runtime consumer of it. */
const PARTS = read('src', 'ui', 'public', 'screens', 'parts.js');

/** Spec §6: this action set, and no category glyphs. */
const REQUIRED = ['i-refresh', 'i-copy', 'i-open', 'i-confirm', 'i-search', 'i-add'];

function definedSymbols(html: string): string[] {
  return [...html.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1] as string);
}

/**
 * Every sprite id a file REACHES FOR, in either shape the product uses.
 *
 * Two forms, because the product has two: static markup writes
 * `href="#i-open"`, and `parts.js` builds the same reference through the DOM
 * with `setAttribute('href', '#i-open')`, which is a quoted `'#i-open'` in the
 * source. Matching only the first is how the one real consumer stayed
 * invisible to this file.
 *
 * `i-[a-z]` and not `i-[a-z-]` after the hash on purpose: it must NOT match
 * the documentation placeholder `#i-<name>`, and it must not match a bare
 * `#i-` either. A pattern that swallows a placeholder turns prose into a
 * finding, and the first thing anyone would do about a false finding is
 * loosen the check.
 */
function usedIcons(text: string): string[] {
  const code = withoutComments(text);
  const hrefs = [...code.matchAll(/href="#(i-[a-z][a-z-]*)"/g)].map((m) => m[1] as string);
  const quoted = [...code.matchAll(/['"`]#(i-[a-z][a-z-]*)['"`]/g)].map((m) => m[1] as string);
  return [...new Set([...hrefs, ...quoted])];
}

/**
 * The same text with its comments removed.
 *
 * **A removal proof is what put this here.** `parts.js` carries a JSDoc line
 * above `openIcon()` that quotes the markup it emits, `href="#i-open"` and
 * all. Rewriting the REAL reference into a form no scanner could read --
 * `` `#${'i'}-open` `` -- left this file entirely green, because the sentence
 * ABOUT the code was still being counted as the code. The fixture was
 * carrying the proof, and the whole item is about a check that could not fail.
 *
 * Deliberately conservative: block comments, and lines whose first non-space
 * is `//` or `*`. It does not try to understand a trailing `//` after code,
 * because a `'https://…'` inside a string would be cut in half by anything
 * that did, and a stripper that mangles code would make this check lie in the
 * other direction. `withoutComments` is exercised directly below.
 */
function withoutComments(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !/^\s*(\/\/|\*)/.test(line))
    .join('\n');
}

/**
 * A use-vs-defined diff is only a check when something is USED.
 *
 * Spelled as a function so no caller can write the subtraction without the
 * guard: this whole item exists because one of them did.
 */
function assertEveryUseIsDefined(used: string[], defined: string[], where: string): void {
  assert.ok(
    used.length > 0,
    `${where}: nothing was found to be using the sprite, so the diff below would pass whatever `
    + 'the sprite contained. That is the vacuous state `plan:gates seq:1` was filed about — if '
    + 'this file genuinely has no consumers any more, delete the check rather than leave it green',
  );
  const dangling = used.filter((u) => !defined.includes(u));
  assert.deepEqual(dangling, [], `${where} references a symbol the sprite never defines: ${dangling.join(', ')}`);
}

test('the SHIPPED sprite defines every one of the six spec glyphs', () => {
  // `src/ui/public/index.html`, not the mockup. Nothing checked this file
  // before `plan:gates seq:1`: the product could have shipped a sprite short
  // a symbol with the whole suite green.
  const defined = definedSymbols(SHELL);
  const missing = REQUIRED.filter((id) => !defined.includes(id));
  assert.deepEqual(missing, [], `the served sprite is missing: ${missing.join(', ')}`);
});

test('the shipped sprite defines only the six named glyphs — no category glyphs', () => {
  const extra = definedSymbols(SHELL).filter((id) => !REQUIRED.includes(id));
  assert.deepEqual(extra, [], `spec §6 rules out category glyphs; the served sprite also defines: ${extra.join(', ')}`);
});

test('every icon the app reaches for is one the shipped sprite defines', () => {
  // THE CHECK THAT COULD NEVER FAIL, pointed at the file where the uses are.
  // `parts.js`'s `openIcon()` is the consumer; the guard inside
  // `assertEveryUseIsDefined` is what stops this reverting to `[] vs []` the
  // day that function is rewritten or moved.
  const used = usedIcons(PARTS);
  assert.deepEqual(
    used, ['i-open'],
    'the set of glyphs the app actually consumes has changed. That is not a failure by itself — '
    + 'it is a fact this file has to be told, because the whole value of the diff below is that '
    + 'somebody looked at this list',
  );
  assertEveryUseIsDefined(used, definedSymbols(SHELL), 'screens/parts.js');
});

test('the shipped sprite and the design of record have not drifted apart', () => {
  // `index.html`'s own comment says every symbol is "byte-identical to the
  // mockup". Asserted rather than believed: the two files are edited by
  // different hands for different reasons, and a claim in a comment is the
  // kind that stops being true without anything going red.
  const symbolsOf = (html: string): Map<string, string> => new Map(
    [...html.matchAll(/<symbol id="(i-[a-z-]+)"[\s\S]*?<\/symbol>/g)]
      .map((m) => [m[1] as string, m[0]]),
  );
  const design = symbolsOf(MOCKUP);
  const shipped = symbolsOf(SHELL);
  assert.equal(design.size, REQUIRED.length, 'the mockup no longer holds the six-glyph sprite this compares against');
  const drifted = [...design.entries()]
    .filter(([id, body]) => shipped.get(id) !== body)
    .map(([id]) => id);
  assert.deepEqual(drifted, [],
    `the served sprite no longer matches the mockup for: ${drifted.join(', ')} — index.html's own `
    + 'comment claims they are byte-identical');
});

test('only "open" mirrors under RTL', () => {
  const mirrored = [...MOCKUP.matchAll(/\[dir="rtl"\]\s*\.icon-([a-z]+)\s*\{[^}]*scaleX\(-1\)/g)]
    .map((m) => m[1] as string);
  assert.deepEqual(mirrored, ['open'], `only "open" may mirror under RTL; found: ${mirrored.join(', ')}`);
});

test('every symbol keeps currentColor rather than a baked-in colour, in both files', () => {
  for (const [where, html] of [['the mockup', MOCKUP], ['the shipped shell', SHELL]] as const) {
    const spriteMatch = /<svg[^>]*aria-hidden="true">[\s\S]*?<\/svg>/.exec(html);
    assert.ok(spriteMatch, `icon sprite not found in ${where}`);
    const symbols = [...spriteMatch[0].matchAll(/<symbol\b[^>]*>/g)].map((m) => m[0]);
    assert.equal(symbols.length, REQUIRED.length,
      `${where}: expected ${REQUIRED.length} <symbol> tags, found ${symbols.length}`);
    const notCurrentColor = symbols.filter((s) => !/stroke="currentColor"/.test(s));
    assert.deepEqual(notCurrentColor, [],
      `${where}: every symbol must inherit colour via stroke="currentColor"`);
  }
});

test('the regex that reads a use can see a real one, and still ignores the documentation', () => {
  // **THE DETECTOR IS ITSELF UNDER TEST**, because the fault this file was
  // filed for was in the detector and not in the sprite. Two directions, and
  // both matter: a pattern that cannot see a use makes every diff vacuous; a
  // pattern that sees the placeholder `#i-<name>` in a comment invents a
  // finding, and the repair anyone reaches for after a false finding is a
  // looser check.
  assert.deepEqual(usedIcons('<svg><use href="#i-copy"/></svg>'), ['i-copy'], 'the markup form');
  assert.deepEqual(usedIcons("use.setAttribute('href', '#i-open');"), ['i-open'], 'the DOM form');
  assert.deepEqual(usedIcons('<use href="#i-<name>"/>'), [], 'the documentation placeholder is not a use');
  assert.deepEqual(usedIcons('href="#i-"'), [], 'and neither is a bare prefix');

  // AND A COMMENT ABOUT A USE IS NOT A USE. `parts.js` has one directly above
  // the real call, and while it counted, removing the real call left this
  // whole file green -- measured.
  assert.deepEqual(
    usedIcons('/** emits <use href="#i-copy"> */\nconst x = 1;'), [],
    'a JSDoc line quoting the markup must not stand in for the markup',
  );
  assert.deepEqual(
    usedIcons("// use.setAttribute('href', '#i-add');\nconst y = 2;"), [],
    'nor must a commented-out call',
  );
  assert.deepEqual(
    usedIcons('const u = "https://example.test/x";\nel.setAttribute("href", "#i-search");'),
    ['i-search'],
    'and a URL in a string must not be mistaken for a comment and take the next line with it',
  );

  // AND THE OLD PATTERN, kept as the record of what was actually wrong: it
  // sees neither of the two `href="#i-` strings in the file it was pointed at.
  const oldPattern = /href="#(i-[a-z-]+)"/g;
  assert.equal(
    [...MOCKUP.matchAll(oldPattern)].length, 0,
    'the mockup now contains a real `<use>` the old pattern could match. That changes the '
    + 'evidence in this file\'s header, which says the old check was vacuous BECAUSE both of '
    + 'its two candidates were placeholders — re-read it before trusting the story',
  );
  assert.equal(
    (MOCKUP.match(/href="#i-/g) ?? []).length, 2,
    'the mockup no longer holds exactly the two `href="#i-` strings this item measured',
  );
});
