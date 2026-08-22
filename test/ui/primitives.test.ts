/**
 * **The eight primitives, and what a static scan of the stylesheet can prove
 * about them without a browser.**
 *
 * `docs/superpowers/plans/2026-08-21-web-ui-visual-repaint.md` Task 3 names
 * this file for the hit-test too, but a hit-test needs real layout and a real
 * 3D transform — `page.$` / `page.evaluate` are Playwright fixtures, and
 * `e2e/mockup.ts`'s own header explains why a Playwright spec cannot live
 * under `test/` at all (`node:test` cannot run it, and `check:test-glob`'s
 * file-count parity would catch the mismatch either way). That test is
 * `e2e/primitives.spec.ts`. What belongs here is everything the CSS text
 * itself can attest to.
 *
 * §3 names eight primitives; the stylesheet spells ten selectors for them
 * (`.pane`, `.plate`, `.row`, `.lit`, `.blk`, `.chip`, `.rail`, `.hdr`,
 * `.plane`, `.scene`) because the plane is three cooperating rules and the
 * literal field has a container plus a child. Every one is checked below.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const html = readFileSync(MOCKUP, 'utf8');

/** The `<style>` block only, so a match can never come from a comment about
 * CSS rather than the CSS itself — the same care `faint-usage.test.ts` names
 * as the reason its own first run went red for the wrong reason. */
function styleBlock(): string {
  const start = html.indexOf('<style>');
  const end = html.indexOf('</style>');
  assert.ok(start !== -1 && end !== -1, 'the mockup must carry an inline <style> block');
  return html.slice(start, end);
}

const CSS = styleBlock();

/** True if `selector{` (any whitespace before `{`, selector possibly part of
 * a comma-separated list) appears as a rule head in the stylesheet. */
function definesRule(selector: string): boolean {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[,{}])\\s*${escaped}\\s*[,{]`, 'm').test(CSS);
}

test('every one of the eight primitives has its selector defined', () => {
  const required = ['.pane', '.row', '.lit', '.blk', '.chip', '.rail', '.hdr', '.scene', '.pair'];
  const missing = required.filter((sel) => !definesRule(sel));
  // .plane is always compound (`.plane.l` / `.plane.r`, no tilt-less bare form), so it is
  // checked separately rather than as `.plane{` or `.plane,`.
  if (!/\.plane\.[lr]\s*\{/.test(CSS)) missing.push('.plane');
  assert.deepEqual(missing, [], `primitive selector(s) never defined in the stylesheet: ${missing.join(', ')}`);
});

test('§4\'s plate is defined alongside the primitives, for Task 7 to apply', () => {
  assert.ok(definesRule('.plate'), '.plate must be defined so Task 7 has something to wrap the 18 data views in');
});

test('the static card is .pane with no :hover rule of its own', () => {
  assert.doesNotMatch(CSS, /\.pane\s*:hover/,
    'stillness is how the interface says "not a control" — .pane must never gain a :hover rule');
});

/**
 * **The scene is FLAT, by owner decision on 2026-08-22, and this test now
 * guards that rather than the tilt it used to require.**
 *
 * It previously asserted `.pair` MUST declare perspective — the container half
 * of a depth treatment where `.plane.l`/`.plane.r` each rotated 3.2°. That
 * treatment was real and deliberate, and it was removed from the design of
 * record after being rendered against this repository's own 265-item corpus.
 *
 * Why: `preview` was the ONLY one of the mockup's 21 screens carrying any
 * transform, and the only card the owner reported as wrong. Measured, the
 * transform was always exactly the specified 3.2°; what it did at real data
 * volume was shear dense monospace prose — the left edge of every line in the
 * right pane drifted, and the row labels staggered over 35px and read as a
 * diagonal. A depth cue that costs legibility on the one screen it appears on
 * is not buying what it was chosen for. Removed from BOTH
 * `docs/design/web-ui-mockup.html` and `styles.css` in the same commit, so
 * `styles-parity` still holds them byte-identical and there is no divergence
 * between the design of record and what ships.
 *
 * The half that survives is the one that was always structural: if a
 * perspective ever returns here, it belongs on the CONTAINER and never on a
 * plane, because perspective on the rotated element itself resolves per-element
 * instead of establishing one shared viewing frustum. That assertion is kept
 * live below rather than deleted, so the lesson outlives the treatment.
 */
test('the scene is flat: no perspective on the pair, no rotation on the planes', () => {
  const planeRules = [...CSS.matchAll(/\.plane\.[lr]\s*\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(planeRules.length >= 2, 'both .plane.l and .plane.r must be defined');
  for (const rule of planeRules) {
    // Kept from the tilted era: structural, and true whether or not depth returns.
    assert.doesNotMatch(rule, /perspective/,
      `perspective belongs on the container, never on .plane itself — found in: ${rule}`);
    assert.doesNotMatch(rule, /rotateY/,
      `the scene is flat by owner decision — .plane must not rotate. Reviving depth is a ` +
      `design change and needs the owner and a screenshot, not an edit here: ${rule}`);
  }
  const pairRule = /\.pair\s*\{[^}]*\}/.exec(CSS)?.[0] ?? '';
  assert.doesNotMatch(pairRule, /perspective\s*:/,
    'the scene is flat — .pair must not declare perspective. It did until 2026-08-22; ' +
    'see the header above for why it stopped.');
  assert.doesNotMatch(pairRule, /rotateY|translateZ/, '.pair must not itself transform');
});

test('.scene stays empty — the documented "not here" marker for perspective', () => {
  assert.match(CSS, /\.scene\s*\{\s*\}/, '.scene must be an explicitly empty rule, not merely absent');
});

test('no rule anywhere in the stylesheet uses a negative translateZ', () => {
  // Selector, then its body — translateZ lives in the BODY (a declaration value),
  // never in the selector, so the two must be captured separately rather than
  // hunted for as one span of text.
  const offenders: string[] = [];
  for (const m of CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const [, selector, body] = m;
    if (body !== undefined && /translateZ\(\s*-/.test(body)) offenders.push(`${(selector ?? '').trim()} { ${body.trim()} }`);
  }
  assert.deepEqual(offenders, [],
    'a negative translateZ pushes a tilted child behind its own parent\'s stacking plane, and the parent then ' +
    `answers elementFromPoint for it (§7.1) — offending rule(s): ${offenders.join(' | ')}`);
});

test('the row\'s transition lives only under prefers-reduced-motion:no-preference', () => {
  const baseRow = /(?<!@media[^{]*\{\s*)\.row\s*\{[^}]*\}/.exec(CSS)?.[0] ?? '';
  assert.doesNotMatch(baseRow, /transition\s*:/,
    'the true default must be static — a transition on the unconditional .row rule defeats the reduced-motion guard');

  const guard = /@media \(prefers-reduced-motion:no-preference\)\s*\{([^]*?)\n\}/.exec(CSS)?.[1] ?? '';
  assert.match(guard, /\.row\s*\{[^}]*transition\s*:/,
    'the animated transition itself must sit inside the prefers-reduced-motion:no-preference guard');
});

test('.row still changes state on :hover with no media query gating the state itself', () => {
  assert.match(CSS, /\.row:hover\s*\{[^}]*transform\s*:\s*translateY\(-3px\)/,
    'hover must lift the row unconditionally — only the SMOOTHING of that change is gated, not the change');
});

test('the chip primitive declares no border, so the 49 existing .chip.gov/.ok/.warn/.crit ' +
  'usages keep the border their own (higher-specificity) modifier rule already supplies', () => {
  const chipRule = /(?<!\.chip\.\w+\s*)\.chip\s*\{([^}]*)\}/.exec(CSS)?.[1] ?? '';
  assert.doesNotMatch(chipRule, /\bborder\s*:/,
    'a border on the base .chip rule would compete with the four legacy modifier classes\' border-color-only overrides');
});

test('the legacy .rail and item-detail .pane rules no longer shadow the primitive\'s material', () => {
  // Both once set their own `background` and a `border-inline-*`, which — being
  // later in source order than the primitive block above — would silently have
  // outranked it. Guards the fix in place rather than trusting it stays fixed.
  const railRule = /\.rail\s*\{[^}]*grid-area:rail[^}]*\}/.exec(CSS)?.[0] ?? '';
  assert.doesNotMatch(railRule, /background\s*:|border-inline/,
    'the grid-area .rail rule must not re-declare background or a border-inline-* side — that material now comes ' +
    'from the shared .pane,.rail,.hdr primitive rule');

  const paneRule = /\.pane\s*\{[^}]*grid-area:pane[^}]*\}/.exec(CSS)?.[0] ?? '';
  assert.doesNotMatch(paneRule, /background\s*:|border-inline/,
    'the grid-area .pane (item-detail) rule must not re-declare background or a border-inline-* side, for the same reason');
});

test('the shared pane material names every token Task 1 produced for it, and none it did not', () => {
  const shared = /\.pane,\.rail,\.hdr\s*\{([^]*?)\}/.exec(CSS)?.[1] ?? '';
  for (const token of ['--pane-edge', '--pane-gloss', '--pane-tint', '--lift', '--pane-lit']) {
    assert.ok(shared.includes(`var(${token})`), `shared pane material must reference ${token}`);
  }
});
