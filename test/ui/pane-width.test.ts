/**
 * **The item pane's width is a property with a floor and a ceiling, not a
 * literal in a grid template.**
 *
 * `styles.css` seated the pane in `214px 1fr 330px` — 330 pixels, written
 * once, for every item in the corpus. Most of the normative items are a page
 * of prose, so that column is narrower than a phone for exactly the content
 * the pane exists to show (`docs/superpowers/plans/2026-08-27-the-item-pane-
 * is-resizable-and-can-float.md` §1, and the owner's own words on 2026-08-27:
 * *"it may include a long text boddy"*).
 *
 * This task moves the number and NOTHING else — no drag handler, no float
 * button, no stored preference. It is split out so a reviewer can satisfy
 * themselves that the layout is untouched without reading a pointer handler,
 * which is why these tests read the SHIPPED BYTES rather than a rendered box:
 * the whole claim is about what the stylesheet declares.
 *
 * `test/ui/styles-parity.test.ts` is the neighbouring authority on this same
 * rule and is deliberately not duplicated here — it asks whether the block
 * matches the design of record, which is a different question from whether
 * the width can be written from outside.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const CSS = readFileSync(
  path.join(import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'styles.css'), 'utf8',
);

test('the pane width is a custom property with the shipped default', () => {
  assert.match(CSS, /--pane-w:\s*330px/,
    'the default moved. 330px is what shipped; a change to it is a design change.');
});

test('the grid reads the property and no longer carries the literal', () => {
  // The template must read `--pane-w` THROUGH the clamp, not beside it: a
  // `var(--pane-w)` sitting outside the bound would be a second, unbounded
  // path to the same column.
  assert.match(CSS, /\.app\.pane-open\{grid-template-columns:214px 1fr clamp\([^)]*var\(--pane-w\)/,
    'the pane column must be var(--pane-w), read through the clamp');
  assert.doesNotMatch(CSS, /grid-template-columns:214px 1fr 330px/,
    'a second copy of the width would drift from the property the handle writes');
});

test('the width is BOUNDED in CSS, not only in the handler', () => {
  // A stored value from an older build, a corrupted store, or a handler bug
  // must not be able to leave the body with no room. `clamp` is the floor and
  // ceiling that holds whatever anything writes into the property.
  //
  // The floor is asserted by its NUMBER rather than by "a clamp is present":
  // 280px is what keeps the pane usable at all, and a clamp whose floor had
  // quietly become 0 would satisfy the weaker assertion while guaranteeing
  // nothing.
  assert.match(CSS, /clamp\(\s*280px/,
    'the 280px floor is the guarantee; a clamp without it bounds nothing worth bounding');
});

test('the bound lives in the TEMPLATE, so it holds whoever writes the property', () => {
  // Deliberate, and the reason this task exists ahead of the drag handle: a
  // handler that clamped its own writes would protect only its own writes.
  // The alternative weighed and rejected was `min()`/`max()` in the handler
  // plus a bare `var(--pane-w)` here — cheaper to read, but then a stale
  // stored value, a future feature, or a bug in some LATER writer squeezes
  // the body out of the window and no test in this file could see it.
  const rule = /^\.app\.pane-open\{[^}]*\}/m.exec(CSS)?.[0];
  assert.ok(rule !== undefined, '.app.pane-open must be a line-anchored rule');
  assert.match(rule, /clamp\(\s*280px,\s*var\(--pane-w\),\s*70vw\s*\)/,
    'the clamp belongs in the grid template itself, not only where the property is written');
});
