/**
 * The six action glyphs spec §6 names — refresh, copy, open, confirm, search,
 * add — are inlined once as `<symbol>` definitions in the mockup and are
 * meant to be consumed elsewhere with `<use href="#i-name">`. Two distinct
 * ways that link can break, both checked here rather than left to be noticed
 * on a screen:
 *
 *   - a `<use>` naming a symbol nobody defined (typo, or a symbol dropped
 *     from the sprite while a screen still reaches for it) — the plan's own
 *     check, kept as written.
 *   - a required glyph whose `<symbol>` never landed at all. A use-vs-defined
 *     diff alone misses this: at the point this sprite lands, nothing in the
 *     document yet writes a `<use>` (icons are wired into screens by later
 *     tasks), so `used` is `[]` and the diff passes trivially whether or not
 *     the sprite exists. That is the state this file starts from, and it is
 *     why this test is written as "every required id has a symbol" first —
 *     the one that can actually go red before the sprite is written.
 *
 * Verified red: run with `i-confirm`'s `<symbol>` deleted from the mockup —
 * the first test fails naming `i-confirm`, the rest stay green. Run with a
 * `<use href="#i-typo">` added anywhere — the third test fails naming
 * `i-typo`, the first two stay green. Restored after, both times.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

/** Spec §6: this action set, and no category glyphs. */
const REQUIRED = ['i-refresh', 'i-copy', 'i-open', 'i-confirm', 'i-search', 'i-add'];

function definedSymbols(html: string): string[] {
  return [...html.matchAll(/<symbol id="(i-[a-z-]+)"/g)].map((m) => m[1] as string);
}

function usedIcons(html: string): string[] {
  return [...html.matchAll(/href="#(i-[a-z-]+)"/g)].map((m) => m[1] as string);
}

test('every one of the six spec glyphs has a symbol defined', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const defined = definedSymbols(html);
  const missing = REQUIRED.filter((id) => !defined.includes(id));
  assert.deepEqual(missing, [], `sprite is missing: ${missing.join(', ')}`);
});

test('the sprite defines only the six named glyphs — no category glyphs', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const defined = definedSymbols(html);
  const extra = defined.filter((id) => !REQUIRED.includes(id));
  assert.deepEqual(extra, [], `spec §6 rules out category glyphs; sprite also defines: ${extra.join(', ')}`);
});

test('every icon referenced by a use element is defined in the sprite', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const used = usedIcons(html);
  const defined = definedSymbols(html);
  const dangling = used.filter((u) => !defined.includes(u));
  assert.deepEqual(dangling, [], `<use> references a symbol the sprite never defines: ${dangling.join(', ')}`);
});

test('only "open" mirrors under RTL', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const mirrored = [...html.matchAll(/\[dir="rtl"\]\s*\.icon-([a-z]+)\s*\{[^}]*scaleX\(-1\)/g)]
    .map((m) => m[1] as string);
  assert.deepEqual(mirrored, ['open'], `only "open" may mirror under RTL; found: ${mirrored.join(', ')}`);
});

test('every symbol keeps currentColor rather than a baked-in colour', () => {
  const html = readFileSync(MOCKUP, 'utf8');
  const spriteMatch = html.match(/<svg style="display:none" aria-hidden="true">[\s\S]*?<\/svg>/);
  assert.ok(spriteMatch, 'icon sprite not found');
  const sprite = spriteMatch![0];
  const symbols = [...sprite.matchAll(/<symbol\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(symbols.length, REQUIRED.length, `expected ${REQUIRED.length} <symbol> tags, found ${symbols.length}`);
  const notCurrentColor = symbols.filter((s) => !/stroke="currentColor"/.test(s));
  assert.deepEqual(notCurrentColor, [], 'every symbol must inherit colour via stroke="currentColor"');
});
