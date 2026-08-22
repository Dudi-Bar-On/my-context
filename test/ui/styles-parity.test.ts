/**
 * **`styles.css` and the mockup's `:root` tokens, primitive rules, and now
 * the screen-level rules the `nav.inj` screens actually render, held to byte
 * identity.** Plan Task 16 Step 4b started this file in the shape of
 * `test/ui/strings-parity.test.ts`: a token or a rule edited in one file and
 * not the other fails here instead of drifting silently — the exact failure
 * the retired two-palette placeholder this file replaces already caused once
 * (`docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` · `Adding it
 * here would put the same tokens in two files with no test holding them
 * together` · ~686). This task (carrying the mockup's `.app`/`.nav`/`.card`/
 * `.chip.*`/`.pair` composition/etc. across for the three built screens)
 * extends the same discipline to every block it adds, per its own brief:
 * "Extend that test with every block you add."
 *
 * **Scope, now three tiers instead of two.** `styles.css`'s own header names
 * four tiers; the first three are checked here — the TOKENS `:root`, the
 * LEGACY SCALE `:root` (newly copied whole by this task — see styles.css's
 * own comment on that block for why cherry-picking `--fs-2` alone stopped
 * being enough), the sans/mono `:root`, and every primitive-or-screen rule
 * this file or that one declares with a real selector. The `@font-face`
 * block is deliberately NOT byte-compared (its `url()` paths differ on
 * purpose); it gets its own resolution check below instead, the same shape
 * `test/ui/fonts.test.ts` already uses for the mockup's copy. The foundation
 * rules (`*`, `html,body`, `body`) and the i18n utility classes (`.m`, `.v`,
 * `bdi`, the `[dir="rtl"]` override) stay outside this file's scope, for the
 * same reason Task 16 gave them originally.
 *
 * **Extraction is CONTENT-addressed, not position-addressed.** The mockup
 * declares FIVE `:root{}` blocks total (TOKENS, LEGACY SCALE, sans/mono, plus
 * two more nested inside its own print and reduced-transparency `@media`
 * registers that redeclare a handful of the same custom-property NAMES for a
 * different context) — "the Nth `:root`" would silently pick the wrong one
 * the moment either file's ordering changes. Each of the three this file
 * copies is found by a property marker unique to it among all five —
 * `--ground:` for TOKENS, `--fs-00:` for LEGACY SCALE (checked: `--panel:`
 * and `--paper:` each recur in the print register's override block and would
 * have picked the wrong one), `--sans:` for the font stack.
 *
 * A plain rule is found by its selector anchored at the start of a line
 * (`^\.blk\{`, `/m` flag), not a bare substring search — `.lit.linked
 * .blk{…}` contains the literal text `.blk{` too, and a substring match would
 * silently grab the wrong rule's body. Line-anchoring is safe because every
 * rule this file checks is written this way in the mockup — checked by hand
 * against the source once, and re-checked every run by the "was found at
 * all" assertions below, which fail loudly if that formatting ever changes.
 *
 * **Two selectors — `.pair` and `.chip` — are genuinely declared TWICE** in
 * the mockup's own stylesheet: once as the primitive (perspective-only /
 * font-weight-only) and once again further down, adding properties the
 * primitive doesn't set. `ruleAt`'s plain `.exec()` always returns the FIRST
 * match, so the second declaration needs its own `ruleAtNth(css, sel, 1)`
 * helper rather than reusing `ruleAt` — checked directly: `docs/design/
 * web-ui-mockup.html` declares `^\.pair\{` and `^\.chip\{` (line-anchored,
 * `/gm`) exactly twice each and nothing else in this file's scope more than
 * once, verified against the live mockup before this task's rules were
 * written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const STYLES = path.join(REPO, 'src', 'ui', 'public', 'styles.css');
const FONTS = path.join(REPO, 'src', 'ui', 'public', 'fonts');
const INDEX = path.join(REPO, 'src', 'ui', 'public', 'index.html');

const mockupHtml = readFileSync(MOCKUP, 'utf8');
const stylesCss = readFileSync(STYLES, 'utf8');
const indexHtml = readFileSync(INDEX, 'utf8');

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

/**
 * The Nth (0-based) rule for a selector the mockup declares more than once —
 * `.pair` and `.chip` only, per the header above. `ruleAt` always returns the
 * first match, which is why this exists as its own function rather than an
 * optional parameter nobody else needs.
 */
function ruleAtNth(css: string, selector: string, n: number, label: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`^${escaped}\\{[^}]*\\}`, 'gm');
  const matches = [...css.matchAll(re)];
  assert.ok(matches.length > n,
    `${label}: expected at least ${n + 1} line-anchored occurrence(s) of ${JSON.stringify(selector)}, found ${matches.length}`);
  return matches[n]![0];
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

test('the LEGACY SCALE :root block is byte-identical between the mockup and styles.css', () => {
  const mockup = rootBlockContaining(MOCKUP_CSS, '--fs-00:', 'mockup');
  const shipped = rootBlockContaining(stylesCss, '--fs-00:', 'styles.css');
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

/**
 * **This task's own carry-across.** Every screen-level selector `index.html`,
 * `app.js`, `screens/parts.js`, `screens/preview.js`, `screens/simulate.js`
 * and `screens/injected.js` actually render, minus the two that need
 * `ruleAtNth` instead (`.pair`, `.chip` — their own tests below) and the two
 * `@media` blocks (also below, since `ruleAt`'s single-selector regex cannot
 * span a wrapping `@media{}`). Reversing Task 16's own prior test — see the
 * comment where that test used to be, further down — is not a mistake: that
 * test encoded "the shell doesn't carry screen wiring" while no screen
 * existed yet to need it; this task IS that screen's wiring landing.
 */
const SCREEN_SELECTORS = [
  '.app', '.app.pane-open', '.hdr', '.logo', '.mark', '.mark::after',
  '.logo b', '.topr', '.sel', '.sel b', '.live', '.icon',
  '.icon:hover,.sel:hover', '.icon[aria-pressed="true"]', '.rail',
  '.grp', '.grp>p', '.nav', '.nav:hover', '.nav[aria-current="page"]',
  '.body', '.banner', '.banner[hidden]',
  '.phd', '.verdict', '.psub',
  '.card', '.card>h3', '.plane>.pane', '.rows', '.row .idfull', '.carrieditem',
  'table', 'caption', 'th', 'td', 'tr:last-child td',
  '.chip.gov', '.chip.ok', '.chip.warn', '.chip.crit', '.chip.carry',
  '.chip.gov::before', '.chip.ok::before', '.chip.warn::before', '.chip.crit::before', '.chip.carry::before',
  '.chip::before', '.small',
  'details.help', 'details.help>summary', 'details.help>summary::-webkit-details-marker',
  'details.help>summary::before', 'details.help[open]>summary', '.helpbox', '.helpbox b',
  '.segbar', '.segbar button', '.segbar button[aria-pressed="true"]',
  '.simctl', '.simctl input[type=range]',
  '.lit.linked .blk', '.lit.linked .blk.sel',
  // Widened from `.blk .linkid,.carrieditem .linkid` on 2026-08-22, in the
  // mockup and here together. `.linkid` is a bare `<button>` that relies on
  // this rule for its whole appearance, and it is built OUTSIDE those two
  // containers on four screens — inside a `<td>` on `injected`, in the
  // coverage detail pane, on `doctor` and on `learn`. Scoped to the two, those
  // instances fell back to the UA button chrome: 22 white rectangles on
  // coverage and 12 on injected, measured. The mockup carried the same gap and
  // was fixed in the same commit, so these stay byte-identical.
  '.linkid', '.linkid:hover',
  // The audit stream's own seven (ui3 Task 11, mockup ~907-923). Added with
  // the carry, per this file's own standing brief — "Extend that test with
  // every block you add" — so the pulse, the token bar, the not-recorded void
  // and the regime rule cannot drift from the design of record either way.
  '.pulse', '.pulse svg', '.tokbar', '.tokvoid', '.nt',
  'tr.regime td', 'tr.regime .ln', 'tr.regime .rw',
  // The injection preview's two graphics (ui3 Task 1s, mockup ~813-851 and
  // ~927-936) — the four-tier budget ribbon with its ghost lane, and the gate
  // ladder. Added with the carry, per this file's own standing brief.
  // `.track .seg`'s reduced-motion transition needs its own regex test below,
  // for the same reason `.row`'s and `.lit.linked .blk`'s do: `ruleAt`'s
  // single-selector regex cannot span a wrapping `@media{}`.
  '.ribbon', '.rlabel', '.rlabel .n', '.track', '.track .seg',
  '.seg.pinned', '.seg.jit', '.seg.restored', '.seg.index', '.seg.head',
  '.ghosts', '.ghosts .gh', '.ghosts .gap', '.notrun', '.hint', '.hint b',
  '.gladder', '.rung', '.rung:last-child', '.rung .n', '.rung.pass .n',
  '.rung.binds', '.rung.binds .n', '.rung.after', '.rung .q',
  '.idkind', '.idslug', 'h2', 'button',
  ':where(button,a,input,select,summary):focus-visible',
  '[dir="rtl"] .icon-open', '[class^="icon-"]',
];

for (const selector of SCREEN_SELECTORS) {
  test(`screen-level rule ${selector} is byte-identical between the mockup and styles.css`, () => {
    const mockup = ruleAt(MOCKUP_CSS, selector, 'mockup');
    const shipped = ruleAt(stylesCss, selector, 'styles.css');
    assert.equal(shipped, mockup);
  });
}

test('the SECOND .pair rule (the two-plane scene\'s own grid, not the perspective primitive) is byte-identical', () => {
  const mockup = ruleAtNth(MOCKUP_CSS, '.pair', 1, 'mockup');
  const shipped = ruleAtNth(stylesCss, '.pair', 1, 'styles.css');
  assert.equal(shipped, mockup);
});

test('the SECOND .chip rule (border/size/line-height, not the font-weight primitive) is byte-identical', () => {
  const mockup = ruleAtNth(MOCKUP_CSS, '.chip', 1, 'mockup');
  const shipped = ruleAtNth(stylesCss, '.chip', 1, 'styles.css');
  assert.equal(shipped, mockup);
});

test('the .pair responsive media block is byte-identical', () => {
  const re = /@media \(max-width:1000px\)\{\.pair\{grid-template-columns:1fr\}\}/;
  const mockup = re.exec(MOCKUP_CSS)?.[0];
  const shipped = re.exec(stylesCss)?.[0];
  assert.ok(mockup !== undefined, 'mockup: .pair responsive media block not found');
  assert.ok(shipped !== undefined, 'styles.css: .pair responsive media block not found');
  assert.equal(shipped, mockup);
});

test('the .lit.linked .blk reduced-motion transition block is byte-identical', () => {
  const re = /@media \(prefers-reduced-motion:no-preference\)\{\s*\n\s*\.lit\.linked \.blk\{transition:opacity var\(--dur-act\) var\(--ease\)\}\s*\n\}/;
  const mockup = re.exec(MOCKUP_CSS)?.[0];
  const shipped = re.exec(stylesCss)?.[0];
  assert.ok(mockup !== undefined, 'mockup: .lit.linked .blk transition media block not found');
  assert.ok(shipped !== undefined, 'styles.css: .lit.linked .blk transition media block not found');
  assert.equal(shipped, mockup);
});

/**
 * **The ribbon's retiming block** (spec §5) — a segment travels to its new
 * width rather than redrawing, because on this chart the movement is the data.
 * Held byte-identical for the same reason the two blocks above it are, and
 * carried even though it is inert today: both files rebuild every `.seg` on
 * each event change, so no node survives a re-render to animate from. Each
 * file records that against its own copy; what must not happen is one of them
 * fixing it and the declaration drifting.
 */
test('the .track .seg retiming media block is byte-identical', () => {
  const re = /@media \(prefers-reduced-motion:no-preference\)\{\s*\n\s*\.track \.seg\{transition:inline-size var\(--dur-retime\) var\(--ease\)\}\s*\n\}/;
  const mockup = re.exec(MOCKUP_CSS)?.[0];
  const shipped = re.exec(stylesCss)?.[0];
  assert.ok(mockup !== undefined, 'mockup: .track .seg retiming media block not found');
  assert.ok(shipped !== undefined, 'styles.css: .track .seg retiming media block not found');
  assert.equal(shipped, mockup);
});

test('the parity checks above are not vacuous — every extracted block is non-empty', () => {
  // A regex that silently matched "" would make every assert.equal above
  // pass by comparing two empty strings. Guarded once, for all of them.
  const tokens = rootBlockContaining(stylesCss, '--ground:', 'styles.css');
  const sansMono = rootBlockContaining(stylesCss, '--sans:', 'styles.css');
  const legacy = rootBlockContaining(stylesCss, '--fs-00:', 'styles.css');
  assert.ok(tokens.length > 200, 'the TOKENS block is suspiciously short');
  assert.ok(sansMono.length > 20, 'the sans/mono block is suspiciously short');
  assert.ok(legacy.length > 200, 'the LEGACY SCALE block is suspiciously short');
  for (const selector of PRIMITIVE_SELECTORS) {
    assert.ok(ruleAt(stylesCss, selector, 'styles.css').length > 5, `${selector} body is suspiciously short`);
  }
  for (const selector of SCREEN_SELECTORS) {
    assert.ok(ruleAt(stylesCss, selector, 'styles.css').length > 5, `${selector} body is suspiciously short`);
  }
  assert.ok(ruleAtNth(stylesCss, '.pair', 1, 'styles.css').length > 5, 'the second .pair rule is suspiciously short');
  assert.ok(ruleAtNth(stylesCss, '.chip', 1, 'styles.css').length > 5, 'the second .chip rule is suspiciously short');
});

/**
 * **Reversed from Task 16's own test.** `.lit.linked` and `.linkid` used to
 * be asserted ABSENT here — correct while no screen existed to compose them,
 * named explicitly in styles.css's own (now-updated) header as "a screen's
 * job to bring in, not a shell's". `screens/preview.js` and `screens/
 * parts.js` are that screen (Task 17), and `SCREEN_SELECTORS` above now
 * carries `.lit.linked .blk`/`.lit.linked .blk.sel`/`.blk .linkid,
 * .carrieditem .linkid`/`.blk .linkid:hover,.carrieditem .linkid:hover` with
 * their own byte-parity assertions — a positive check is strictly stronger
 * than the absence check it replaces, so nothing is lost by removing it.
 */

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

/**
 * **`index.html`'s icon sprite, held to the same discipline as styles.css —
 * copied byte-for-byte from the mockup, not invented, and pinned here so it
 * cannot drift.** Not a CSS block, so it lives outside every check above,
 * but it is the same kind of carry-across this whole file exists to hold:
 * `screens/parts.js`'s `openIcon()` (Task 17) has always emitted `<svg
 * class="icon-open"><use href="#i-open">`, and until this sprite existed in
 * `index.html` that `<use>` pointed at nothing — an empty 16×16 box, visually
 * indistinguishable from "loaded correctly but blank". Found by inspecting a
 * real screenshot, not by reading the CSS.
 *
 * **The six `<symbol>` bodies are checked byte-identical; the wrapping
 * `<svg>` tag is not**, for the same reason `styles.css`'s own `@font-face`
 * `url()` paths aren't: the mockup's tag carries `style="display:none"`,
 * which the server's CSP refused outright when it read `style-src 'self'` —
 * index.html's own comment on the sprite and styles.css's `body>svg[aria-
 * hidden="true"]{display:none}` explain the substitute. Checked from
 * `aria-hidden="true">` onward (present in both, unlike the differing tag
 * before it) through the six symbols to `</svg>`.
 */
test('index.html\'s icon sprite symbols are byte-identical to the mockup\'s (the wrapping tag is not — see below)', () => {
  const start = 'aria-hidden="true">';
  const end = '</svg>';
  function spriteFrom(html: string, label: string): string {
    // From the FIRST `<svg` (the sprite, always earlier in the document than
    // any screen-rendered icon) rather than the bare marker, so a future
    // `.icon-open` instance elsewhere in the static markup could never be
    // mistaken for the sprite itself.
    const svgTag = html.indexOf('<svg');
    assert.ok(svgTag !== -1, `${label}: no <svg> found at all`);
    const s = html.indexOf(start, svgTag);
    assert.ok(s !== -1, `${label}: sprite's aria-hidden="true"> not found`);
    const e = html.indexOf(end, s);
    assert.ok(e !== -1, `${label}: sprite close tag not found after its start`);
    return html.slice(s + start.length, e);
  }
  const mockup = spriteFrom(mockupHtml, 'mockup');
  const shipped = spriteFrom(indexHtml, 'index.html');
  assert.equal(shipped, mockup);
  assert.ok(shipped.length > 500, 'the sprite is suspiciously short — six symbols expected');
  for (const id of ['i-refresh', 'i-copy', 'i-open', 'i-confirm', 'i-search', 'i-add']) {
    assert.match(shipped, new RegExp(`id="${id}"`), `sprite is missing #${id}`);
  }
});

/**
 * **This assertion outlived its original reason, and is kept on a new one.**
 *
 * It was written because `style-src 'self'` refused the attribute outright.
 * The CSP now reads `style-src-attr 'unsafe-inline'` — a computed length has
 * to be applicable for any chart to draw a bar — so the platform would today
 * accept `style="display:none"` here without complaint.
 *
 * The rule it now enforces is ours rather than the browser’s: a STATIC
 * declaration belongs in the stylesheet, where this suite can hold it
 * byte-identical to the design of record. `style-src-attr` was re-opened for
 * values computed at runtime that cannot be written down in advance; spending
 * it on a constant would put one of the sprite’s declarations somewhere this
 * suite does not compare, which is how the two files drift.
 */
test('index.html\'s sprite <svg> carries no inline style attribute (CSP: style-src \'self\', no unsafe-inline)', () => {
  // Anchored on 'aria-hidden="true">' (present in both files, unlike the
  // wrapping tag) and walked BACKWARDS to the nearest preceding `<svg` —
  // never a forward search from `indexHtml.indexOf('<svg')`, which lands on
  // the literal text `<svg class="icon-<name>">` inside this file's own
  // prose comment describing how a screen consumes a glyph, not the real tag.
  const ariaIdx = indexHtml.indexOf('aria-hidden="true">');
  assert.ok(ariaIdx !== -1, 'sprite aria-hidden="true"> not found');
  const tagStart = indexHtml.lastIndexOf('<svg', ariaIdx);
  assert.ok(tagStart !== -1, 'no <svg start tag precedes aria-hidden="true">');
  const svgTag = indexHtml.slice(tagStart, ariaIdx + 'aria-hidden="true">'.length);
  assert.doesNotMatch(svgTag, /style=/, `the sprite's own <svg> tag must not carry a style attribute: ${svgTag}`);
  assert.match(svgTag, /aria-hidden="true"/, 'the sprite must still announce aria-hidden="true"');
});

/**
 * **`index.html`'s `.app` wrapper — the grid `.app{grid-template-areas:…}`
 * in styles.css has nothing to grid without an element carrying
 * `class="app"`.** Structural, not byte-identical (the mockup's own `.app`
 * also holds the provenance bar and footer strip this shell does not build —
 * §0.2, "unowned"), so this checks NESTING rather than reusing the sprite
 * test's exact-slice approach: `.hdr`, `.rail`, `.body` and the exit banner
 * must all be inside the one element carrying `id="app"`.
 */
test('index.html\'s header, rail, body and exit banner all sit inside #app', () => {
  const appStart = indexHtml.indexOf('<div class="app" id="app">');
  assert.ok(appStart !== -1, '#app wrapper not found');
  const bodyCloseTag = '</body>';
  const afterApp = indexHtml.indexOf(bodyCloseTag, appStart);
  assert.ok(afterApp !== -1, 'expected a </body> after #app opens');
  // The wrapper's own close is the last `</div>` before `<script type=
  // "module" src="/app.js">` — checked by position, not by counting nested
  // divs (the header alone has none, but a later task's markup might).
  const scriptTag = '<script type="module" src="/app.js">';
  const scriptIndex = indexHtml.indexOf(scriptTag, appStart);
  assert.ok(scriptIndex !== -1 && scriptIndex < afterApp, 'expected the app.js script tag inside <body>');
  const appRegion = indexHtml.slice(appStart, scriptIndex);
  for (const needle of [
    'id="topbar" class="hdr"',
    'class="rail" id="nav"',
    'class="body" id="screen"',
    'class="banner" id="exited"',
  ]) {
    assert.ok(appRegion.includes(needle), `#app wrapper does not contain ${JSON.stringify(needle)} before the app.js script tag`);
  }
});
