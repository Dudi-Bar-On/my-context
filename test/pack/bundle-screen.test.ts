/**
 * The Unicode screen at the EXPORT door.
 *
 * `bundle.test.ts` recorded this as a gap rather than a test — "the byte
 * layout says a pack's `name` and `version` are screened by the Unicode
 * screen, and `screenPackMeta` has no call site anywhere in the export plan".
 * This file is that gap closed, and it lives beside `bundle.test.ts` rather
 * than inside it because the subject is one function's one new refusal.
 *
 * **Measured on 2026-08-24, before the screen was wired, through the real
 * command** — `mycontext export --out <dir> --as-pack`:
 *
 *     --pack-name    "acme<U+202E>security"   exit 0, written to manifest.json
 *     --pack-name    "acme<U+E0041>security"  exit 0, written to manifest.json
 *     --pack-name    "acme<U+200B>security"   exit 0, written to manifest.json
 *     --pack-version "rev<U+202E>3"           exit 0, written to manifest.json
 *     --pack-version "rev<U+E0041>3"          exit 0, written to manifest.json
 *     --pack-version "rev<U+200B>3"           exit 0, written to manifest.json
 *     --pack-name    "acme\nsecurity"         exit 1, refused
 *
 * The newline is what says the guard was not absent: `refusePackName` was
 * running and catching what it catches. None of the three above is a C0 or C1
 * control, none changes under NFC, and each costs one code point, so every
 * rule that function has let them through — which is exactly the sentence
 * `screen.ts` writes about itself.
 *
 * **Why the assertions are about the ORDER as well as the outcome.** A value
 * carrying an override AND a trailing space trips both guards. The screen has
 * to be the one that answers, because `refusePackName` interpolates the value
 * it refuses and `JSON.stringify` escapes a newline while leaving U+202E
 * exactly as it arrived — so the other order refuses the attack in a sentence
 * the attack reorders.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createItem } from '../../src/core/mutate.ts';
import { buildBundle, type BundleOptions } from '../../src/pack/bundle.ts';
import { sandbox, type Sandbox } from '../helpers/workspace.ts';

/** A fixed instant, so nothing here depends on a clock. */
const NOW = Date.UTC(2026, 7, 20, 12, 0, 0);

const PACK_OPTS: BundleOptions = {
  kind: 'pack', name: 'acme security', version: '2026-08 rev 3',
  filters: {}, history: true, now: NOW,
};

const EXPORT_OPTS: BundleOptions = { ...PACK_OPTS, kind: 'export', name: null, version: null };

/** U+202E RIGHT-TO-LEFT OVERRIDE — reorders the rest of the line it lands in. */
const RLO = '‮';
/** U+E0041 TAG LATIN CAPITAL LETTER A — the Tags block, an invisible alphabet. */
const TAG = '\u{e0041}';
/** U+200B ZERO WIDTH SPACE — renders as nothing at all. */
const ZWSP = '​';

function corpus(box: Sandbox): void {
  createItem(box.ctx, { type: 'rule', title: 'a rule', body: 'B' });
}

function refusalOf(fn: () => unknown): string {
  try {
    fn();
  } catch (err) {
    return err instanceof Error ? err.message : String(err);
  }
  assert.fail('expected a refusal, got none');
}

/** Wrapping is a layout decision; a phrase assertion must not depend on it. */
function flat(text: string): string {
  return text.replace(/\s+/g, ' ');
}

/**
 * Every screened code point, on both strings, one test per pair.
 *
 * The three are not one rule tested three times: U+202E is a bidi control,
 * U+200B is an invisible and U+E0041 is the Tags block, and they are three
 * different rows of `SCREENED_RANGES`. A screen wired to one row would pass a
 * single-case test and ship the other two.
 */
for (const [label, codePoint, spelling] of [
  ['U+202E, the override', RLO, 'U+202E'],
  ['U+E0041, the Tags block', TAG, 'U+E0041'],
  ['U+200B, the zero-width space', ZWSP, 'U+200B'],
] as const) {
  test(`a pack NAME carrying ${label} is refused, and nothing is assembled`, () => {
    const box = sandbox();
    try {
      corpus(box);
      const hostile = `acme${codePoint}security`;
      const message = refusalOf(
        () => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, name: hostile }),
      );

      // The screen's own words, so the reason is the screen's and not a second
      // sentence written here that could disagree with it.
      assert.match(message, new RegExp(spelling.replace('+', '\\+')));
      assert.match(flat(message), /the pack name/);
      // The whole point: a refusal that interpolated the value would carry the
      // code point it is complaining about into the sentence a person reads.
      assert.equal(
        message.includes(codePoint), false,
        `the refusal printed ${spelling} itself: ${JSON.stringify(message)}`,
      );
    } finally { box.dispose(); }
  });

  test(`a pack VERSION carrying ${label} is refused, and nothing is assembled`, () => {
    const box = sandbox();
    try {
      corpus(box);
      const hostile = `rev${codePoint}3`;
      const message = refusalOf(
        () => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, version: hostile }),
      );

      assert.match(message, new RegExp(spelling.replace('+', '\\+')));
      // Named as the version, not as the name: `screenPackMeta` exists to say
      // which of the two strings carried it, and a refusal that named the
      // wrong one sends the author to the wrong flag.
      assert.match(flat(message), /the pack version/);
      assert.equal(
        message.includes(codePoint), false,
        `the refusal printed ${spelling} itself: ${JSON.stringify(message)}`,
      );
    } finally { box.dispose(); }
  });
}

test('the screen answers before refusePackName, so a name carrying both is refused '
  + 'in a sentence the override cannot reorder', () => {
  const box = sandbox();
  try {
    corpus(box);
    // Both guards fire on this value: the trailing space is `refusePackName`'s
    // and the override is the screen's. Measured on the import door before
    // that order was fixed — `JSON.stringify` escapes a newline and leaves
    // U+202E raw, so the other order quotes the override into its own refusal.
    const message = refusalOf(
      () => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, name: `acme${RLO}security ` }),
    );

    assert.match(message, /U\+202E/);
    assert.equal(
      message.includes(RLO), false,
      `the refusal printed U+202E itself: ${JSON.stringify(message)}`,
    );
    // The screen answered, so the trailing-space sentence — which is the one
    // that quotes the value — never ran.
    assert.equal(
      /leading or trailing whitespace/.test(message), false,
      `refusePackName answered first: ${JSON.stringify(message)}`,
    );
  } finally { box.dispose(); }
});

test('a name that is nothing but overrides names a bounded number of findings, '
  + 'and says how many it did not', () => {
  const box = sandbox();
  try {
    corpus(box);
    // `screenText` reports EVERY finding by design, which is right for an
    // artefact whose fields a file bounds and wrong for a flag: 500 overrides
    // would otherwise print 500 paragraphs at a reader who needed one.
    const message = refusalOf(
      () => buildBundle(box.root, box.ctx.config, { ...PACK_OPTS, name: RLO.repeat(500) }),
    );

    assert.ok(
      message.split('\n').length < 40,
      `500 screened code points printed ${message.split('\n').length} lines of refusal`,
    );
    // Visibly short of the whole: a reader must not mistake what is listed for
    // everything that was found.
    assert.match(flat(message), /\bmore\b/);
    assert.match(message, /500 screened code point/);
    assert.equal(message.includes(RLO), false, 'the refusal printed U+202E itself');
  } finally { box.dispose(); }
});

test('the screen runs before the corpus is walked, so a refused name reads nothing', () => {
  const box = sandbox();
  try {
    corpus(box);
    // The root is a path that does not exist. A screen that ran after
    // `loadLayer` would fail on the missing directory instead — so this
    // passing is what says nothing was even opened.
    const message = refusalOf(
      () => buildBundle(
        `${box.root}-does-not-exist`, box.ctx.config, { ...PACK_OPTS, name: `x${RLO}y` },
      ),
    );
    assert.match(message, /U\+202E/);
  } finally { box.dispose(); }
});

test('an ordinary pack name and version still build, and a full export is untouched', () => {
  const box = sandbox();
  try {
    corpus(box);
    const pack = buildBundle(box.root, box.ctx.config, PACK_OPTS);
    assert.equal(pack.manifest.name, 'acme security');
    assert.equal(pack.manifest.version, '2026-08 rev 3');

    // A full export carries neither string. The screen is asked about `''`
    // rather than branched around, which is what `planImport` does on the way
    // in — and screening the empty string finds nothing.
    const whole = buildBundle(box.root, box.ctx.config, EXPORT_OPTS);
    assert.equal(whole.manifest.name, null);
    assert.equal(whole.manifest.version, null);
  } finally { box.dispose(); }
});
