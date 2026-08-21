/**
 * The three self-hosted faces the dark glass direction requires — Geist for
 * Latin, IBM Plex Sans Hebrew for Hebrew, Geist Mono for machine strings, one
 * `@font-face` declaration per weight, never a language switch (design
 * spec §3A). Vendoring is only as real as the bytes it points at: a
 * `@font-face` rule naming a file that is not on disk is exactly the kind of
 * property-without-the-code this project's own recorded defect is (the
 * mockup's header names it: "asserting a property the code does not have").
 *
 * `test/ui/strings-parity.test.ts` is the model — read the same bytes the
 * page loads, assert on what they actually declare — because reading a
 * DIFFERENT file cannot say anything about the one that ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');
const FONTS = path.join(REPO, 'src', 'ui', 'public', 'fonts');

const html = readFileSync(MOCKUP, 'utf8');

test('the Hebrew cut is declared, not left to a fallback', () => {
  assert.match(html, /font-family:\s*"IBM Plex Sans Hebrew"/,
    'Hebrew has no cut in Geist; without Plex the second language falls back to a system face');
});

test('Geist and Geist Mono are declared alongside it — one declaration, not a switch', () => {
  assert.match(html, /font-family:\s*"Geist";/, 'Latin face missing');
  assert.match(html, /font-family:\s*"Geist Mono";/, 'machine-string face missing');
});

test('--sans and --mono name all three families, Latin first then the Hebrew cut', () => {
  assert.match(html, /--sans:\s*"Geist",\s*"IBM Plex Sans Hebrew"/,
    'the token must name both families in one declaration — no per-language switch');
  assert.match(html, /--mono:\s*"Geist Mono"/);
});

/**
 * Every `@font-face src:url(...)` the mockup declares must resolve to a real
 * file, relative to the MOCKUP's own location — the file this test reads is
 * the file a browser opens directly (`e2e/mockup.ts` loads it by
 * `pathToFileURL`), not `src/ui/public/styles.css`, so that is the directory
 * a relative `url()` here resolves against.
 */
test('every vendored @font-face file exists on disk, at the weight it claims', () => {
  const rules = [...html.matchAll(
    /@font-face\{font-family:"([^"]+)";font-weight:(\d+);[^}]*url\("([^"]+)"\)/g,
  )];
  assert.ok(rules.length >= 9, `expected at least 9 @font-face rules (4 Geist, 2 Geist Mono, `
    + `3 IBM Plex Sans Hebrew weights), found ${rules.length}`);

  const missing: string[] = [];
  for (const [, family, weight, url] of rules) {
    const resolved = path.resolve(path.dirname(MOCKUP), url!);
    if (!existsSync(resolved) || statSync(resolved).size === 0) {
      missing.push(`${family} ${weight} -> ${url} (resolved: ${resolved})`);
    }
  }
  assert.deepEqual(missing, [], 'declared but not on disk (or empty)');
});

test('the nine vendored weights are all present under src/ui/public/fonts', () => {
  const expected = [
    'geist-400.woff2', 'geist-450.woff2', 'geist-500.woff2', 'geist-600.woff2',
    'geist-mono-400.woff2', 'geist-mono-500.woff2',
    'plex-sans-hebrew-400.woff2', 'plex-sans-hebrew-500.woff2', 'plex-sans-hebrew-600.woff2',
  ];
  const missing = expected.filter((f) => !existsSync(path.join(FONTS, f)));
  assert.deepEqual(missing, [], 'missing from src/ui/public/fonts');
});

test('the OFL licence ships beside the fonts it covers', () => {
  const licence = path.join(FONTS, 'LICENSE-OFL.txt');
  assert.ok(existsSync(licence), 'src/ui/public/fonts/LICENSE-OFL.txt is missing');
  assert.match(readFileSync(licence, 'utf8'), /SIL OPEN FONT LICENSE/);
});

test('font-display:swap on every face, so a missing file degrades rather than hides text', () => {
  const rules = [...html.matchAll(/@font-face\{[^}]*\}/g)].map((m) => m[0]);
  assert.ok(rules.length > 0, 'no @font-face rules found');
  const withoutSwap = rules.filter((r) => !r.includes('font-display:swap'));
  assert.deepEqual(withoutSwap, [], '@font-face rule(s) missing font-display:swap');
});
