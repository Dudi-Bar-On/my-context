/**
 * **THE WEB STRIP SHOWS THE SAME PERCENTAGE THE TERMINAL DOES, FOR THE MYCTX
 * SHARE — `TASK-the-web-strip-reports-the-project-knowledge-share-in-tokens`.**
 *
 * Owner report, 2026-09-04: the web strip's `strip.myctx` sentence carries a
 * token count and an injection count and no percentage anywhere, while the
 * terminal (`statusline-powerline.ts`, the `myctx` `usedOfMaxSegment`) prints
 * `(tokens / windowSize) * 100`, rounded with `toFixed(1)`, qualified `≈` for
 * the ordinary case and `≥` when some deliveries carry no frozen token
 * estimate (`unrecorded > 0`).
 *
 * This file does not re-derive the arithmetic — `myctxShare`'s projection is
 * another lane's bug and stays untouched here. What it pins is the CONTRACT
 * between the two surfaces: the same formula, the same rounding, and the same
 * qualifier, so a reader can carry one figure from the terminal to the browser
 * and back. Structural (byte-pattern) checks are this file's whole method
 * because `app.js` is a bootstrap script with no exported pure function to
 * call directly — `test/ui/context-live.test.ts` reads it the same way for
 * the same reason.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.join(import.meta.dirname, '..', '..');
const APP = readFileSync(
  path.join(REPO, 'src', 'ui', 'public', 'app.js'), 'utf8',
).replace(/\r\n/gu, '\n');
const TERMINAL = readFileSync(
  path.join(REPO, 'src', 'cli', 'commands', 'statusline-powerline.ts'), 'utf8',
).replace(/\r\n/gu, '\n');

async function table(language: 'en' | 'he'): Promise<{ strings: Record<string, string> }> {
  const file = path.join(REPO, 'src', 'ui', 'public', 'strings', `${language}.js`);
  const url = new URL(`file://${file.replaceAll('\\', '/')}`);
  return (await import(url.href)) as { strings: Record<string, string> };
}

test('the terminal itself still computes the myctx share as tokens over the window, to 1 decimal', () => {
  // The control on every assertion below: if this formula ever moves, the
  // web side these tests pin has moved out from under them silently.
  assert.match(TERMINAL, /percent: \(input\.myctx\.tokens \/ win\) \* 100,/u,
    'the terminal formula this file mirrors has changed — update the web side and this file '
      + 'together, never one alone');
  assert.match(TERMINAL, /decimals: 1,/u, 'the terminal rounds the myctx share to 1 decimal');
  assert.match(TERMINAL, /const approx = input\.myctx\.unrecorded > 0 \? '≥' : '≈';/u,
    "the terminal's qualifier: '≥' when some tokens are unrecorded, '≈' otherwise");
});

test('the web strip computes the SAME percentage — tokens over the window, times 100', () => {
  assert.match(APP, /\(view\.myctx\.tokens \/ view\.size\) \* 100/u,
    'strip.myctx / strip.myctxPartial must be fed the identical formula the terminal uses — '
      + 'not a second derivation that can drift from it');
});

test('the web strip rounds the SAME way — no second rounding', () => {
  // `toFixed(1)` on the exact percent expression above, mirroring the
  // terminal's `decimals: 1`. A separate `Math.round` or a different decimal
  // count would agree with the terminal in the middle of the scale and
  // disagree at the edges.
  assert.match(APP, /\(view\.myctx\.tokens \/ view\.size\) \* 100\)\.toFixed\(1\)/u,
    'the web must format the myctx percentage with the same toFixed(1) the terminal uses, '
      + 'applied to the same expression — never a second rounding rule');
});

test('strip.myctx and strip.myctxPartial pass a pct slot to the string, in both languages', async () => {
  const en = await table('en');
  const he = await table('he');
  for (const key of ['strip.myctx', 'strip.myctxPartial']) {
    assert.match(en.strings[key]!, /\{pct\}/u, `en.js's ${key} must carry a {pct} slot`);
    assert.match(he.strings[key]!, /\{pct\}/u, `he.js's ${key} must carry a {pct} slot`);
  }
  // The tokens figure the owner asked to KEEP alongside the new percentage.
  for (const key of ['strip.myctx', 'strip.myctxPartial']) {
    assert.match(en.strings[key]!, /\{tokens\}/u, `en.js's ${key} must still carry {tokens}`);
    assert.match(he.strings[key]!, /\{tokens\}/u, `he.js's ${key} must still carry {tokens}`);
  }
});

test('the web mirrors the terminal\'s qualifiers: ≈ for the ordinary case, ≥ for the partial one', async () => {
  const en = await table('en');
  const he = await table('he');
  // Ordinary case (no unrecorded tokens): the terminal now marks this share
  // '≈' because it is always an upper bound (eviction is unobservable). A web
  // sentence reading a bare '18%' beside a terminal reading '≈18%' would
  // disagree about CERTAINTY, not arithmetic — exactly what the owner's
  // ruling forbids.
  for (const lang of [en, he]) {
    assert.match(lang.strings['strip.myctx']!, /≈/u,
      'strip.myctx (the ordinary case) must carry the ≈ qualifier the terminal now emits');
  }
  // Partial case (some tokens unrecorded): stays '≥', already the existing
  // convention on this string — pinned so it survives the percent addition.
  for (const lang of [en, he]) {
    assert.match(lang.strings['strip.myctxPartial']!, /≥/u,
      'strip.myctxPartial must keep the ≥ qualifier for an at-least share');
  }
});

test('the web strip still passes the myctx group to the banded bar, unchanged', () => {
  // The bar this fix must not touch or duplicate — it already draws the same
  // share at 60/70/80%; this test pins that the fix added a NUMBER beside it
  // rather than a second computation of the band.
  assert.match(APP, /bandUsage\(tail, \(view\.myctx\.tokens \/ view\.size\) \* 100, 'strip\.grp\.myctx'\)/u,
    'the existing banded-bar call for the myctx group must survive unchanged');
});
