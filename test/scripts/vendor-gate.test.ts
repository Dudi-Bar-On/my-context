/**
 * **The widened vendor gate, proved by planting what it must refuse.**
 *
 * `scripts/check-vendor.ts` was widened on 2026-09-06 to admit a module graph:
 * it walks subdirectories, and it allows a relative `import` only when the
 * specifier resolves to another file pinned in `VENDOR.md`. Owner ruling, in
 * his own words: *"Widen it: walk subdirectories, and allow a relative import
 * only when it resolves to another file in the pinned manifest — still refusing
 * bare specifiers."*
 *
 * A gate that was widened and never watched refuse anything is a gate nobody
 * can trust again. So every clause below is demonstrated by **planting a
 * violation and requiring the specific complaint**, not by reading the source
 * and agreeing with it. Both halves of the ruling get their own plant:
 *
 *   - a **relative** specifier that resolves OUTSIDE the pinned manifest, and
 *   - a **bare** specifier, which needs a resolver this product does not have.
 *
 * The anti-vacuity test comes first and is the one that matters most. Every
 * refusal below is worthless if the scanner cannot see an import in the first
 * place — a regex that silently stopped matching would pass the real vendor
 * directory, pass every plant that relies on it being read, and report the
 * graph closed while seeing nothing. So the scanner is first required to walk
 * the REAL 26-chunk graph from its two roots and arrive at all 26.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { removeTree } from '../helpers/tmp.ts';
import {
  FORBIDDEN, VENDOR_DIR, VENDOR_MANIFEST,
  auditVendor, moduleReach, readPins, vendorFiles, type VendorPin,
} from '../../scripts/check-vendor.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const DIR = path.join(REPO, ...VENDOR_DIR.split('/'));

const PINS = readPins(readFileSync(path.join(DIR, VENDOR_MANIFEST), 'utf8'));
const FILES = vendorFiles(DIR);

/** The two chunks `lib/wa-tree.js` enters the component graph by. */
const ROOTS = [
  'webawesome/chunks/chunk.T2SU5Q2S.js',
  'webawesome/chunks/chunk.SJBMXU7J.js',
];

/** A pin for a synthesised file, so a plant is a complete row like any other. */
function pinFor(file: string, body: string): { pin: VendorPin; bytes: Buffer } {
  const bytes = Buffer.from(body, 'utf8');
  return {
    pin: {
      file,
      pkg: 'planted',
      version: '0.0.0',
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    },
    bytes,
  };
}

/** Audit a synthetic vendor directory built from `entries`. */
function auditOf(entries: Record<string, string>): string[] {
  const pins: VendorPin[] = [];
  const files = new Map<string, Buffer>();
  for (const [file, body] of Object.entries(entries)) {
    const { pin, bytes } = pinFor(file, body);
    pins.push(pin);
    files.set(file, bytes);
  }
  return auditVendor(pins, files);
}

// ── 0. The scanner is not blind ────────────────────────────────────────────

/**
 * **Anti-vacuity, and it is the load-bearing test in this file.**
 *
 * `moduleReach` is what every import rule below depends on. If it returned an
 * empty list the whole gate would go quiet: no bare specifier could be found,
 * no unresolved target could be reported, and `check-vendor.ts` would print
 * "28 vendored file(s) match" over a directory it had not read.
 *
 * A count would not settle it either — a scanner that found SOME of the edges
 * would pass a floor and still miss the one import that leaves. So the claim
 * made here is the strongest available: walking ONLY the edges this scanner
 * reports, starting from the two roots, must arrive at every one of the 26
 * pinned chunks. A missed edge disconnects a chunk and this fails.
 */
test('the specifier scanner sees every edge — the real 26-chunk graph, walked', () => {
  const chunks = PINS.map((p) => p.file).filter((f) => f.startsWith('webawesome/chunks/'));
  assert.equal(chunks.length, 26,
    'the vendored Web Awesome closure is 26 files (89,648 B); VENDOR.md pins a different number');

  const seen = new Set<string>();
  const queue = [...ROOTS];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const bytes = FILES.get(file);
    assert.ok(bytes !== undefined, `${file} is not on disk — the graph roots moved`);
    for (const spec of moduleReach(bytes.toString('utf8')).specifiers) {
      queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(file), spec)));
    }
  }
  assert.deepEqual([...seen].sort(), chunks.sort(),
    'walking only the imports the scanner reports did not reach every pinned chunk. Either a '
    + 'chunk is pinned that nothing imports, or — much worse — the scanner is missing edges, '
    + 'in which case every refusal in this file is unproven.');

  // The three shapes, and the two lookalikes that must NOT be read as imports.
  const reach = moduleReach([
    "import './side-effect.js';",
    'import { a } from "./named.js";',
    "export { b } from '../up.js';",
    "export * from './star.js';",
    "const later = await import('./dynamic.js');",
    'export { WaTree as default };', // names no module
    'const meta = import.meta.url;', // not a dynamic import
    '.card{color:red !important}', // "important" is not "import"
  ].join('\n'));
  assert.deepEqual(reach.specifiers.sort(), [
    '../up.js', './dynamic.js', './named.js', './side-effect.js', './star.js',
  ]);
  assert.equal(reach.computed, 0);
});

// ── 1. The two halves of the ruling ────────────────────────────────────────

/**
 * **A relative import that resolves outside the pinned manifest is refused.**
 *
 * This is the half that makes "allow a relative import" safe. The permitted
 * case and the refused case are planted side by side in ONE directory, so the
 * test cannot pass by refusing everything: `inside.js` imports a sibling that
 * is pinned and must draw no complaint, while `escapes.js` and `unpinned.js`
 * import files that are not in the table and must each draw one.
 */
test('a relative import is admitted only when it lands on another pinned file', () => {
  const clean = auditOf({
    'pkg/a.js': "import { x } from './b.js';\nexport { x };\n",
    'pkg/b.js': 'export const x = 1;\n',
  });
  assert.deepEqual(clean, [],
    'a relative import resolving to a pinned sibling is the case the ruling ADMITS — if this '
    + 'complains, the gate refuses the very thing it was widened for');

  // (a) Out of the vendor directory altogether.
  const escaping = auditOf({
    'pkg/a.js': "import { x } from '../../../src/ui/app.js';\n",
  });
  assert.equal(escaping.length, 1, escaping.join(' · '));
  assert.match(escaping[0]!, /resolves to \.\.\/\.\.\/src\/ui\/app\.js/);
  assert.match(escaping[0]!, /not pinned in VENDOR\.md/);

  // (b) Inside the directory, but at a file the manifest does not pin. This is
  //     the shape a bad upgrade takes: a chunk appears, nothing pins it, and
  //     something imports it.
  const unpinned = auditOf({
    'pkg/a.js': "import './ghost.js';\n",
  });
  assert.equal(unpinned.length, 1, unpinned.join(' · '));
  assert.match(unpinned[0]!, /resolves to pkg\/ghost\.js/);

  // (c) A deeper relative hop that stays inside and IS pinned: still fine.
  assert.deepEqual(auditOf({
    'pkg/chunks/a.js': "import '../shared/b.js';\n",
    'pkg/shared/b.js': 'export const b = 1;\n',
  }), []);
});

/**
 * **A bare specifier is refused, and the ruling says so in as many words** —
 * *"still refusing bare specifiers."*
 *
 * This is not a stylistic rule. `CONST-node-24-no-build-step` means there is no
 * bundler and no import map, so `import { LitElement } from 'lit'` in a browser
 * module is a file the browser cannot find — and if it ever COULD find one, it
 * would be a byte this manifest never pinned and this scan never read. It is
 * also the difference between Web Awesome's two builds: `dist/` uses bare
 * specifiers and was rejected on exactly this line; `dist-cdn/` is what is
 * vendored.
 */
test('a bare specifier is refused, whichever shape it arrives in', () => {
  const plants = [
    "import { LitElement } from 'lit';",
    "import 'nanoid';",
    "export { x } from '@lit/context';",
    "const c = await import('lodash-es');",
    'import x from "https://cdn.example.com/thing.js";',
  ];
  for (const source of plants) {
    const problems = auditOf({ 'pkg/a.js': `${source}\n` });
    assert.equal(problems.length, 1, `${source} → ${problems.join(' · ')}`);
    assert.match(problems[0]!, /imports the bare specifier/, source);
    assert.match(problems[0]!, /no build step/, source);
  }
});

/**
 * An `import()` whose argument is not a literal cannot be resolved by anything
 * reading bytes, so it is refused rather than passed over. A scanner that
 * shrugged at what it could not read would be the hole this whole file exists
 * to close.
 */
test('a computed dynamic import is refused, because nothing can say where it goes', () => {
  const problems = auditOf({ 'pkg/a.js': 'const m = await import(`./${name}.js`);\n' });
  assert.equal(problems.length, 1, problems.join(' · '));
  assert.match(problems[0]!, /import\(\) with something other than a string literal/);
});

// ── 2. The recursive walk ──────────────────────────────────────────────────

/**
 * **The flat read was worse than a rejection: it was silence.**
 *
 * Before the widening, `vendorFiles` was one non-recursive `readdirSync`. A
 * directory of third-party JavaScript one level down was not unpinned — it was
 * invisible. No digest, no byte count, no `FORBIDDEN` scan, and the gate
 * printed green.
 *
 * This test writes a real directory tree on disk (the only way to test a
 * directory walk) and requires the nested file to be both FOUND and, because
 * nothing pins it, COMPLAINED about. A flat `readdirSync` returns an empty
 * complaint list here and fails.
 */
test('vendorFiles descends, so nothing under a subdirectory can be unaudited', () => {
  const root = mkdtempSync(path.join(tmpdir(), 'vendor-walk-'));
  try {
    mkdirSync(path.join(root, 'pkg', 'chunks'), { recursive: true });
    writeFileSync(path.join(root, 'flat.js'), 'export const a = 1;\n');
    writeFileSync(path.join(root, 'pkg', 'chunks', 'deep.js'), 'export const b = 2;\n');
    writeFileSync(path.join(root, VENDOR_MANIFEST), '# not a payload\n');
    writeFileSync(path.join(root, 'LICENSE-thing.txt'), 'MIT\n');
    writeFileSync(path.join(root, 'pkg', 'LICENSE-nested.txt'), 'MIT\n');

    const found = vendorFiles(root);
    assert.deepEqual([...found.keys()].sort(), ['flat.js', 'pkg/chunks/deep.js'],
      'the walk must descend, must key by a posix-shaped relative path, and must skip the '
      + 'manifest and every LICENSE file wherever in the tree it sits');

    // Unpinned and nested: found, and complained about.
    const problems = auditVendor([], found);
    assert.equal(problems.length, 2, problems.join(' · '));
    assert.ok(problems.some((p) => p.startsWith('pkg/chunks/deep.js is in ')),
      `a nested file must be reported as unpinned, not skipped: ${problems.join(' · ')}`);
  } finally {
    removeTree(root);
  }
});

// ── 3. What did NOT change ─────────────────────────────────────────────────

/**
 * **`FORBIDDEN` was not relaxed to let Web Awesome in, and this is the pin that
 * says so.** The seven strings are named literally here rather than compared to
 * a length, because the failure mode being prevented is somebody dropping
 * `fetch(` from the list to make a vendored barrel pass — which is exactly what
 * would have been needed for the 49-file entry-point closure, and exactly what
 * the evaluation avoided by vendoring the 26-file one instead.
 */
test('the seven forbidden constructs are unchanged, and each is still refused', () => {
  assert.deepEqual([...FORBIDDEN].sort(), [
    'WebAssembly', 'XMLHttpRequest', 'eval(', 'fetch(', 'importScripts',
    'new Function', 'new Worker',
  ], 'the forbidden list moved. Widening the gate to admit a module graph was a ruling about '
    + 'IMPORTS; it granted nothing here, and a vendored file that trips one of these is a file '
    + 'to re-derive rather than a list to shorten.');

  for (const construct of FORBIDDEN) {
    const problems = auditOf({ 'pkg/a.js': `const x = ${construct}"x");\n` });
    assert.ok(problems.some((p) => p.includes(JSON.stringify(construct))),
      `${construct} was planted and not refused: ${problems.join(' · ')}`);
  }
});

/** Digest and byte count still decide, and they now decide inside a subtree. */
test('an edited byte in a nested file still fails on its digest', () => {
  const { pin } = pinFor('pkg/chunks/a.js', 'export const a = 1;\n');
  const edited = Buffer.from('export const a = 2;\n', 'utf8');
  const problems = auditVendor([pin], new Map([['pkg/chunks/a.js', edited]]));
  assert.ok(problems.some((p) => p.includes('hashes to')), problems.join(' · '));
  assert.ok(problems.some((p) => p.includes('never edited in place')), problems.join(' · '));
});

test('a pin with nothing on disk still fails, and so does a file with no pin', () => {
  const { pin } = pinFor('pkg/chunks/gone.js', 'export const a = 1;\n');
  assert.deepEqual(
    auditVendor([pin], new Map()),
    [`pkg/chunks/gone.js is pinned in ${VENDOR_MANIFEST} and is not on disk`],
  );
  const problems = auditVendor([], new Map([['pkg/chunks/extra.js', Buffer.from('')]]));
  assert.equal(problems.length, 1);
  assert.match(problems[0]!, /is pinned nowhere/);
});

// ── 4. The real directory ──────────────────────────────────────────────────

/**
 * The gate is green over what is actually committed — all three packages —
 * and the count is asserted so that a manifest quietly emptied could not
 * satisfy every test above by having nothing to check.
 */
test('the committed vendor directory audits clean, over all three packages', () => {
  assert.deepEqual(auditVendor(PINS, FILES), []);
  assert.equal(PINS.length, 28,
    'two single-file packages plus the 26-chunk Web Awesome closure');
  assert.equal(FILES.size, PINS.length, 'every file on disk is pinned and vice versa');

  const packages = [...new Set(PINS.map((p) => p.pkg))].sort();
  assert.deepEqual(packages,
    ['@awesome.me/webawesome', 'github-markdown-css', 'markdown-it']);
});
