/**
 * **`styles.css` and the mockup's `:root` tokens and primitive rules, held to
 * byte identity.** Plan Task 16 Step 4b, in the shape of
 * `test/ui/strings-parity.test.ts`: a token or a primitive rule edited in one
 * file and not the other fails here instead of drifting silently — the exact
 * failure the retired two-palette placeholder this file replaces already
 * caused once (`docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md`
 * · `Adding it here would put the same tokens in two files with no test
 * holding them together` · ~686).
 *
 * **Scope, stated because it is narrower than "the whole stylesheet".** Step
 * 4b names exactly two things: "styles.css's :root block and primitive
 * rules". `styles.css`'s own header names three tiers and only the first two
 * — the TOKENS `:root`, the sans/mono `:root`, and the eight-primitives-plus-
 * plate rule set — are checked here. The `@font-face` block is deliberately
 * NOT byte-compared (its `url()` paths differ on purpose — see styles.css's
 * own comment on that block); it gets its own resolution check below instead,
 * the same shape `test/ui/fonts.test.ts` already uses for the mockup's copy.
 * The foundation rules (`*`, `html,body`, `body`) and the i18n utility
 * classes (`.m`, `.v`, `bdi`, the `[dir="rtl"]` override) are outside Step
 * 4b's named scope too and are not checked here, for the same reason.
 *
 * **Extraction is CONTENT-addressed, not position-addressed**, because the
 * mockup declares three `:root{}` blocks (TOKENS, a LEGACY SCALE block this
 * shell does not copy, then sans/mono) while `styles.css` declares only two
 * (TOKENS, sans/mono) — "the first `:root`" and "the second `:root`" name
 * different blocks in the two files. Each block is found by a property it
 * alone declares (`--ground:` for TOKENS, `--sans:` for the font stack), in
 * both files, so reordering either file cannot break this test for the wrong
 * reason.
 *
 * Primitive rules are found by an exact selector anchored at the start of a
 * line (`^\.blk\{`, `/m` flag), not a bare substring search — `.lit.linked
 * .blk{…}` (Task 17's own wiring, not copied here) contains the literal text
 * `.blk{` too, and a substring match would silently grab the wrong rule's
 * body. Line-anchoring is safe because every primitive rule in the mockup is
 * written this way — checked by hand against the source once, and re-checked
 * every run by the "was found at all" assertions below, which fail loudly if
 * that formatting ever changes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const STYLES = path.join(REPO, 'src', 'ui', 'public', 'styles.css');
const FONTS = path.join(REPO, 'src', 'ui', 'public', 'fonts');

const mockupHtml = readFileSync(MOCKUP, 'utf8');
const stylesCss = readFileSync(STYLES, 'utf8');

/** The mockup's inline `<style>` block only — never a comment ABOUT the CSS. */
function mockupStyleBlock(): string {
  const start = mockupHtml.indexOf('<style>');
  const end = mockupHtml.indexOf('</style>');
  assert.ok(start !== -1 && end !== -1, 'the mockup must carry an inline <style> block');
  return mockupHtml.slice(start, end);
}

const MOCKUP_CSS = mockupStyleBlock();

/**
 * The `:root{...}` block, in `css`, whose body contains `marker` — content-
 * addressed rather than positional, per the header above. `[^}]*` is safe
 * here because no token value in either `:root` block contains a `}`.
 */
function rootBlockContaining(css: string, marker: string, label: string): string {
  const blocks = [...css.matchAll(/:root\{[^}]*\}/g)].map((m) => m[0]);
  const hit = blocks.find((b) => b.includes(marker));
  assert.ok(hit !== undefined, `${label}: no :root{} block contains ${marker} — found ${blocks.length} :root block(s)`);
  return hit!;
}

/** One rule, found by its selector anchored at the START of a line. */
function ruleAt(css: string, selector: string, label: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\{[^}]*\\}`, 'm');
  const hit = re.exec(css)?.[0];
  assert.ok(hit !== undefined, `${label}: selector ${JSON.stringify(selector)} not found as a line-anchored rule`);
  return hit!;
}

test('the TOKENS :root block is byte-identical between the mockup and styles.css', () => {
  const mockup = rootBlockContaining(MOCKUP_CSS, '--ground:', 'mockup');
  const shipped = rootBlockContaining(stylesCss, '--ground:', 'styles.css');
  assert.equal(shipped, mockup);
});

test('the sans/mono :root block is byte-identical between the mockup and styles.css', () => {
  const mockup = rootBlockContaining(MOCKUP_CSS, '--sans:', 'mockup');
  const shipped = rootBlockContaining(stylesCss, '--sans:', 'styles.css');
  assert.equal(shipped, mockup);
});

/**
 * Every primitive rule §3 names, plus §4's plate — the same ten selectors
 * `test/ui/primitives.test.ts` enumerates for the mockup alone. `.row`'s
 * `:hover`, its reduced-motion transition and its `[aria-pressed="true"]`
 * look are checked as their own entries: each is a rule the primitive
 * genuinely owns (row.ts style header, mockup ~256-278), not screen wiring.
 */
const PRIMITIVE_SELECTORS = [
  '.pane,.rail,.hdr',
  '.scene',
  '.pair',
  '.plane.l',
  '.plane.r',
  '.row',
  '.row:hover',
  '.row[aria-pressed="true"]',
  '.plate',
  '.lit',
  '.blk',
  '.chip',
];

for (const selector of PRIMITIVE_SELECTORS) {
  test(`primitive rule ${selector} is byte-identical between the mockup and styles.css`, () => {
    const mockup = ruleAt(MOCKUP_CSS, selector, 'mockup');
    const shipped = ruleAt(stylesCss, selector, 'styles.css');
    assert.equal(shipped, mockup);
  });
}

test('the row\'s reduced-motion transition block is byte-identical', () => {
  const re = /@media \(prefers-reduced-motion:no-preference\)\{\s*\.row\{[^}]*\}\s*\}/;
  const mockup = re.exec(MOCKUP_CSS)?.[0];
  const shipped = re.exec(stylesCss)?.[0];
  assert.ok(mockup !== undefined, 'mockup: .row\'s reduced-motion media block not found');
  assert.ok(shipped !== undefined, 'styles.css: .row\'s reduced-motion media block not found');
  assert.equal(shipped, mockup);
});

test('the parity checks above are not vacuous — every extracted block is non-empty', () => {
  // A regex that silently matched "" would make every assert.equal above
  // pass by comparing two empty strings. Guarded once, for all of them.
  const tokens = rootBlockContaining(stylesCss, '--ground:', 'styles.css');
  const sansMono = rootBlockContaining(stylesCss, '--sans:', 'styles.css');
  assert.ok(tokens.length > 200, 'the TOKENS block is suspiciously short');
  assert.ok(sansMono.length > 20, 'the sans/mono block is suspiciously short');
  for (const selector of PRIMITIVE_SELECTORS) {
    assert.ok(ruleAt(stylesCss, selector, 'styles.css').length > 5, `${selector} body is suspiciously short`);
  }
});

/**
 * `.lit.linked .blk` and `.blk .linkid` — Task 17's own composition wiring,
 * living beside the primitives in the mockup — must NOT be copied into this
 * shell's stylesheet. Their absence is what keeps the `.blk{...}` extraction
 * above honest: if a substring match had been used instead of a line-
 * anchored one, this is the rule it would have grabbed by mistake.
 */
test('screen-specific wiring beside the primitives is not shipped by this shell', () => {
  // Checked with COMMENTS STRIPPED: styles.css's own header prose names
  // `.lit.linked` and `.linkid` while explaining that neither is copied here
  // — a bare substring search over the raw file would match that sentence
  // and fail for the wrong reason. What must be absent is a RULE using
  // either as a selector, not the words themselves.
  const withoutComments = stylesCss.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.doesNotMatch(withoutComments, /\.lit\.linked/, '.lit.linked is Task 17\'s wiring, not the shell\'s');
  assert.doesNotMatch(withoutComments, /\.linkid/, '.linkid is Task 17\'s wiring, not the shell\'s');
});

/**
 * `styles.css`'s own `@font-face` `url()` paths resolve relative to
 * `styles.css` ITSELF (served at `/styles.css`), not to the mockup's
 * location — the one deliberate divergence from byte parity, explained in
 * styles.css's own comment on the block. Same method
 * `test/ui/fonts.test.ts` uses for the mockup's copy, pointed at this file
 * instead.
 */
test('every @font-face src in styles.css resolves to a real file, relative to styles.css itself', () => {
  const rules = [...stylesCss.matchAll(
    /@font-face\{font-family:"([^"]+)";font-weight:(\d+);[^}]*url\("([^"]+)"\)/g,
  )];
  assert.ok(rules.length >= 9, `expected at least 9 @font-face rules, found ${rules.length}`);
  const missing: string[] = [];
  for (const [, family, weight, url] of rules) {
    const resolved = path.resolve(path.dirname(STYLES), url!);
    if (!existsSync(resolved)) missing.push(`${family} ${weight} -> ${url} (resolved: ${resolved})`);
  }
  assert.deepEqual(missing, [], 'declared in styles.css but not on disk relative to it');
});

test('the nine vendored weights styles.css declares match what static.ts can now serve', () => {
  const expected = [
    'geist-400.woff2', 'geist-450.woff2', 'geist-500.woff2', 'geist-600.woff2',
    'geist-mono-400.woff2', 'geist-mono-500.woff2',
    'plex-sans-hebrew-400.woff2', 'plex-sans-hebrew-500.woff2', 'plex-sans-hebrew-600.woff2',
  ];
  const missing = expected.filter((f) => !existsSync(path.join(FONTS, f)));
  assert.deepEqual(missing, [], 'missing from src/ui/public/fonts');
  for (const f of expected) {
    assert.match(stylesCss, new RegExp(`url\\("fonts/${f.replace('.', '\\.')}"\\)`), `styles.css never references fonts/${f}`);
  }
});
