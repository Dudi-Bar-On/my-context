/**
 * **The vendored `<wa-tree>` closure, held against the server that has to
 * serve it and the licence that has to ship with it.**
 *
 * `scripts/check-vendor.ts` answers "is it the bytes we said, and can it reach
 * out". It cannot answer the two questions that decided the LAYOUT of this
 * vendoring, and both have already cost this project once:
 *
 *   1. **Is every file an extension `src/ui/static.ts` will actually serve?**
 *      That table is five entries — `.html`, `.js`, `.css`, `.svg`, `.woff2` —
 *      and `.mjs` is not among them, which is why `markdown-it.esm.min.mjs` is
 *      committed here as `.js`. A file the server will not serve is a file the
 *      browser 404s on, and nothing else in the suite would notice: the digests
 *      would match, the gate would print green, and the page would be blank.
 *      `src/ui/*.ts` is frozen on the owner's running server, so this had to be
 *      checked BEFORE a layout was committed to rather than fixed after.
 *   2. **Is the licence beside the code, and is it upstream's?** `VENDOR.md`
 *      claims each licence is "the byte-identical copy of what the package
 *      publishes". Nothing checked that sentence until this file.
 *
 * The extension check is deliberately made by CALLING `serveStatic` over each
 * real path rather than by comparing suffixes to a copy of the table. A copy of
 * the table is a second statement of the rule that can drift from the first —
 * this project's own chronic defect — and it would also pass over a file that
 * the containment, symlink or backslash guards refuse for some other reason.
 * What is asserted is what the server does.
 *
 * Full working: `docs/superpowers/specs/2026-09-06-tree-component-evaluation.md`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { serveStatic } from '../../src/ui/static.ts';
import {
  FORBIDDEN, VENDOR_DIR, VENDOR_MANIFEST, readPins,
} from '../../scripts/check-vendor.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const VENDOR = path.join(REPO, ...VENDOR_DIR.split('/'));

const PINS = readPins(readFileSync(path.join(VENDOR, VENDOR_MANIFEST), 'utf8'));
const WA = PINS.filter((p) => p.pkg === '@awesome.me/webawesome');

/** The URL the browser asks for, for a pin — `VENDOR_DIR` is under `public/`. */
const urlFor = (file: string): string => `/${VENDOR_DIR.replace('src/ui/public/', '')}/${file}`;

test('the vendored closure is the 26 files the evaluation measured, at 89,648 B', () => {
  assert.equal(WA.length, 26,
    'the closure is 26 files. 49 would mean the DOCUMENTED barrel entries were vendored '
    + 'instead of the component classes — and those pull in wa-icon, whose fetch( the vendor '
    + 'gate refuses.');
  assert.equal(WA.reduce((sum, p) => sum + p.bytes, 0), 89_648);
  assert.deepEqual([...new Set(WA.map((p) => p.version))], ['3.12.0']);
});

/**
 * **Every vendored file is served by the real `serveStatic`, at the real path
 * the page asks for.** This is the check that had to happen before the layout
 * was chosen, and it covers all three packages rather than only the new one —
 * `markdown-it.esm.min.js`'s rename is only correct for as long as something
 * says so.
 */
test('every pinned vendor file is served by serveStatic, with a content type', () => {
  const refused: string[] = [];
  for (const pin of PINS) {
    const asset = serveStatic(urlFor(pin.file), PUBLIC);
    if (asset === null) {
      refused.push(`${urlFor(pin.file)} — serveStatic returned null`);
      continue;
    }
    if (asset.body.length !== pin.bytes) {
      refused.push(`${urlFor(pin.file)} — served ${asset.body.length} B, pinned ${pin.bytes}`);
    }
    if (!asset.contentType.includes('/')) {
      refused.push(`${urlFor(pin.file)} — no content type`);
    }
  }
  assert.deepEqual(refused, [],
    'a vendored file the server will not serve is a file the browser 404s on, and every other '
    + 'gate stays green while the page renders nothing. `.mjs` is the known trap: it is not in '
    + "`static.ts`'s five extensions, which is why markdown-it is committed as `.js`.");

  // Anti-vacuity: the loop must have had something to refuse.
  assert.ok(PINS.length >= 28, `only ${PINS.length} pins were checked`);
  assert.equal(
    serveStatic(urlFor('webawesome/chunks/chunk.T2SU5Q2S.js'), PUBLIC)!.contentType,
    'text/javascript; charset=utf-8');
});

/**
 * The shim is ours and lives OUTSIDE `vendor/` on purpose, so that the one
 * file an upgrade edits is not one the digest gate forbids editing. It must
 * point at chunks that exist and that are pinned — a shim naming a chunk from
 * the previous release is the exact failure an upgrade produces.
 */
test('lib/wa-tree.js imports only pinned chunks, and is not itself vendored', () => {
  const shim = path.join(PUBLIC, 'lib', 'wa-tree.js');
  assert.ok(existsSync(shim), 'src/ui/public/lib/wa-tree.js is missing');
  const source = readFileSync(shim, 'utf8');

  const specifiers = [...source.matchAll(/from\s*'([^']+)'/g)].map((m) => m[1]!);
  assert.equal(specifiers.length, 2, 'the shim names exactly the two component chunks');

  const pinned = new Set(WA.map((p) => p.file));
  for (const spec of specifiers) {
    const relative = spec.replace('./vendor/', '');
    assert.ok(pinned.has(relative),
      `${spec} is not pinned in ${VENDOR_MANIFEST} — the shim points at a chunk from another '
      + 'release, and the page will 404 on it`);
    assert.ok(existsSync(path.join(PUBLIC, 'lib', spec)), `${spec} is not on disk`);
  }
});

/**
 * `FORBIDDEN` re-measured over the 26 files, from this side of the wall.
 *
 * `check-vendor.ts` already asserts this and this is deliberately a second,
 * independent statement of the same claim — because the sentence it is holding
 * is the one on which the whole choice of file set rests. The barrel closure
 * has `fetch(` in it; this one has none of the seven. If that ever stops being
 * true, the answer is to re-derive the file set, never to shorten the list.
 */
test('none of the seven forbidden constructs appears in the vendored closure', () => {
  const hits: string[] = [];
  for (const pin of WA) {
    const text = readFileSync(path.join(VENDOR, ...pin.file.split('/')), 'utf8');
    for (const construct of FORBIDDEN) {
      if (text.includes(construct)) hits.push(`${pin.file}: ${construct}`);
    }
  }
  assert.deepEqual(hits, []);
});

/**
 * The palette claim, measured rather than trusted: the closure carries no
 * colour of its own and no theme switch, so the ten `--wa-*` custom properties
 * in `styles.css` are the ENTIRE visual surface. That is what let a foreign
 * component be adopted into a dark-only product without a light theme to
 * fight, and it is the property that would quietly disappear on an upgrade.
 */
test('the closure has no colour and no theme of its own, and needs exactly ten tokens', () => {
  const sources = WA.map((p) => readFileSync(path.join(VENDOR, ...p.file.split('/')), 'utf8'));
  const blob = sources.join('\n');

  assert.equal((blob.match(/#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/g) ?? []).length, 0,
    'a hard-coded colour appeared in the vendored closure — the dark palette is no longer the '
    + 'only thing deciding how the tree looks');
  assert.equal((blob.match(/prefers-color-scheme/g) ?? []).length, 0,
    'a theme query appeared — this product has one appearance and no switcher');

  const used = [...new Set((blob.match(/--wa-[a-z0-9-]+/g) ?? []))].sort();
  assert.deepEqual(used, [
    '--wa-color-brand-fill-loud', '--wa-color-neutral-fill-quiet',
    '--wa-color-surface-border', '--wa-color-text-normal', '--wa-color-text-quiet',
    '--wa-focus-ring', '--wa-focus-ring-offset', '--wa-form-control-value-line-height',
    '--wa-transition-easing', '--wa-transition-normal',
  ], 'the component reads a different set of custom properties than styles.css defines');

  const styles = readFileSync(path.join(PUBLIC, 'styles.css'), 'utf8');
  const block = /\nwa-tree\{([^}]*)\}/.exec(styles);
  assert.ok(block !== null, 'styles.css has no `wa-tree{}` block defining the ten tokens');
  const defined = [...new Set((block[1]!.match(/--wa-[a-z0-9-]+/g) ?? []))].sort();
  assert.deepEqual(defined, used,
    'styles.css defines a different set of --wa-* tokens than the component reads. Web '
    + "Awesome's own dist/styles/themes/default.css is deliberately NOT vendored, so a token "
    + 'this block forgets has no fallback anywhere — it renders as nothing.');

  // Every value comes from a token this product already owns: no second palette.
  const values = block[1]!.split('\n')
    .filter((line) => line.includes('--wa-'))
    .map((line) => line.split(':').slice(1).join(':').trim());
  assert.equal(values.filter((v) => /#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(/.test(v)).length, 0,
    'a --wa-* token was given a literal colour. Every one must resolve to a token this '
    + 'product already defines, or the tree becomes a second palette.');
});

/** The licence ships beside the code it covers, and is upstream's own bytes. */
test('LICENSE-webawesome.txt sits beside the chunks, byte-identical to the package', () => {
  const licence = path.join(VENDOR, 'webawesome', 'LICENSE-webawesome.txt');
  assert.ok(existsSync(licence), 'src/ui/public/lib/vendor/webawesome/LICENSE-webawesome.txt');
  const bytes = readFileSync(licence);
  assert.equal(bytes.length, 1059);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),
    'e024db6c0a83b08f33eedda3eb92d90439169903f7d9d7cfeb200c989cd62881',
    'this is no longer the LICENSE.md @awesome.me/webawesome@3.12.0 publishes');
  const text = bytes.toString('utf8');
  assert.match(text, /Copyright \(c\) 2025 Fonticons, Inc\./);
  assert.match(text, /Permission is hereby granted, free of charge/, 'MIT');
});

/**
 * The proof-of-life page: the smallest thing that renders the component, so the
 * lane that builds the Library browser starts from something known to work.
 * Checked for the two traps the evaluation recorded from its own RTL rehearsal
 * rather than left to be rediscovered.
 */
test('tree-proof.html slots its own chevrons and isolates every path segment', () => {
  const page = readFileSync(path.join(PUBLIC, 'tree-proof.html'), 'utf8');

  assert.match(page, /<svg slot="expand-icon"/,
    'wa-icon is not vendored (it fetches), so the page must slot its own chevron or the '
    + 'expand affordance is an undefined element with no size');
  assert.match(page, /<svg slot="collapse-icon"/);
  assert.doesNotMatch(page, /<wa-icon|<wa-spinner|<wa-checkbox/,
    'none of those three is in the 26-file closure');

  // Every label is bidi-isolated: `adr/` renders as `/adr` under dir="rtl"
  // without it, which is a Unicode effect on the trailing slash rather than a
  // component defect (evaluation §6.7).
  const labels = [...page.matchAll(/<wa-tree-item[^>]*>\s*([^<\s][^<]*)</g)];
  assert.deepEqual(labels.map((m) => m[1]!.trim()), [],
    'a wa-tree-item label is not wrapped in <bdi> — a trailing "/" flips under dir="rtl"');
  assert.ok(page.includes('<bdi>'), 'the labels must be there at all');

  assert.match(page, /src="\/lib\/wa-tree\.js"/, 'the page loads the shim, not a chunk hash');
  assert.doesNotMatch(page, /chunk\.[A-Z0-9]{8}\.js/,
    'a content hash escaped into a page — an upgrade must be a one-file edit');
});
