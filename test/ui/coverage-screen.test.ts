/**
 * **The Scope coverage screen's magnitude bar — the arithmetic behind the
 * picture, and the wiring that carries it to three elements.**
 *
 * Spec §6 names the DOM glue in `app.js` and `screens/*.js` as the untested
 * surface, and `test/ui/viewmodel.test.ts`'s header says why: testing it would
 * need a browser dependency this project does not have. Nothing below builds an
 * element or stands in a `document`, and no stand-in `document` is supplied —
 * `test/ui/work-screen.test.ts` records the reason in the same words, and it is
 * the reason this file scans the render path's SOURCE instead of running it.
 *
 * **What is actually at stake here is that a graphic can be wrong quietly.**
 * `.mini` is 74 pixels wide. A bar whose three segments do not fill it, or fill
 * it twice over, still renders — `.mini` sets `overflow:hidden`, so an
 * over-wide segment is silently cropped and reads as a full bar. The screen
 * would look finished and would be lying about how much of a directory is
 * governed, which is the entire question this screen exists to answer. The
 * element-kind parity gate cannot see it: `i.g`, `i.u` and `i.x` are present
 * whatever width they carry. So the sum is asserted here, on every row of a
 * real tree, and it is asserted with a tolerance tight enough that no arithmetic
 * mistake survives it.
 *
 * What this file pins:
 *
 *   - `magnitude()` — the three shares and the three counts, over trees built
 *     by `buildTree` from `/api/coverage`'s own response shape, never from a
 *     hand-written node;
 *   - that the shares SUM to the track and the counts sum to the total, on
 *     every row, in every state the endpoint can produce;
 *   - the two states the design of record says must never be folded together:
 *     a complete walk, where "not examined" is a measured zero, and a truncated
 *     one, where it is an absence and the row says so instead;
 *   - that the render path hands each segment its OWN share, in the mockup's
 *     order, through CSSOM and never a `style` attribute (CSP);
 *   - that the four class names the bar is made of come from the mockup's own
 *     `renderTree`, and that `styles.css` still carries rules for them — a
 *     coverage screen whose stylesheet lost `.mini` draws three invisible
 *     rectangles, which is the failure that stylesheet's own carry note
 *     records;
 *   - every string key the screen names, in both tables, with its slots
 *     supplied, and every `cov.` key the English table declares placed by the
 *     screen — the two directions of the same fact.
 *
 * ── HOW A BROWSER MODULE IS LOADED HERE ───────────────────────────────────
 *
 * A screen imports its dependencies by the specifiers the BROWSER resolves —
 * `/lib/viewmodel.js`, `/screens/parts.js` — and Node resolves a leading `/`
 * from the drive root. So the module's own bytes are read, its root-absolute
 * specifiers are rewritten to `file://` URLs, and the result is imported as a
 * `data:` module. The rewrite is COUNTED and the result re-checked for a
 * surviving `/` specifier, because a rewrite that silently missed one would
 * import a different module graph than the browser runs — the only way this
 * file could pass while testing the wrong thing. The pattern, and that
 * sentence, are `test/ui/work-screen.test.ts`'s.
 *
 * None of `coverage.js`'s three dependencies touches the DOM at module scope
 * (`parts.js` calls `document.createElement` inside its factories), so the
 * import needs no `document`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { allowedClasses } from '../helpers/shipped-classes.ts';

const REPO = path.join(import.meta.dirname, '..', '..');
const PUBLIC = path.join(REPO, 'src', 'ui', 'public');
const COVERAGE_JS = path.join(PUBLIC, 'screens', 'coverage.js');
const STYLES_CSS = path.join(PUBLIC, 'styles.css');
const MOCKUP = path.join(REPO, 'docs', 'design', 'web-ui-mockup.html');

const coverageSource = readFileSync(COVERAGE_JS, 'utf8');

/**
 * The same file with its comments removed — what the browser actually
 * EXECUTES, which is not the same text a grep sees.
 *
 * This file is heavily commented and its comments quote the very constructs
 * these scans forbid: the header explains why `setAttribute('style', …)` is
 * blocked, and `renderMini`'s docblock transcribes the mockup's `'not
 * examined'` literal in order to say where it is NOT used. Scanning the raw
 * bytes made both assertions fail against a clean screen — a test that fails
 * for the wrong reason, and the most expensive kind of red this project
 * knows. Anything asserting about behaviour reads this; anything asserting
 * about the design of record still reads the mockup.
 *
 * Block comments first, then whole-line and trailing `//`. Safe on THIS file
 * because its only slashes inside string literals are the single-slash browser
 * specifiers (`'/lib/viewmodel.js'`); the sanity test below is what notices if
 * that stops being true.
 */
const coverageCode = coverageSource
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\/\/.*$/gm, '');

/** One row of `buildTree`'s roll-up, as much of it as the bar reads. */
interface TreeNode {
  name: string;
  path: string;
  children: TreeNode[];
  governs: string[];
  fileCount: number;
  governedCount: number;
}

/** What `magnitude()` answers: three counts, three shares, and one absence. */
interface Magnitude {
  total: number;
  governed: number;
  ungoverned: number;
  unexamined: number;
  unknownRemainder: boolean;
  g: number;
  u: number;
  x: number;
}

/**
 * The screen's published interface. Hand-declared rather than inferred, so it
 * is an assertion in its own right: a module that drifts from it fails here
 * rather than in a browser nobody is watching.
 */
interface CoverageModule {
  magnitude: (node: TreeNode, truncated: boolean) => Magnitude;
  render: (root: unknown, ctx: unknown) => Promise<void>;
}

interface ViewmodelModule {
  buildTree: (files: { path: string; governs: string[] }[]) => TreeNode;
  treeRows: (tree: TreeNode) => { node: TreeNode; depth: number }[];
}

/** `from '/lib/viewmodel.js'` — the browser's own specifier form. */
const ROOT_SPECIFIER = /(\bfrom\s+')\/([^']+)'/g;

async function coverageModule(): Promise<CoverageModule> {
  let rewritten = 0;
  const text = coverageSource.replace(ROOT_SPECIFIER, (_all, head: string, spec: string) => {
    rewritten += 1;
    return `${head}${pathToFileURL(path.join(PUBLIC, spec)).href}'`;
  });
  assert.equal(rewritten, 3,
    'expected coverage.js to import three browser modules (/lib/viewmodel.js, /lib/command.js, '
    + `/screens/parts.js); the rewrite matched ${rewritten}. A specifier this pattern cannot see `
    + 'is a module Node would resolve from the drive root, and the import below would fail for a '
    + 'reason that reads like a missing file.');
  assert.ok(!/\bfrom\s+'\//.test(text),
    'a root-absolute specifier survived the rewrite — the module graph imported below would not '
    + 'be the one the browser runs');
  const encoded = Buffer.from(text, 'utf8').toString('base64');
  return (await import(`data:text/javascript;charset=utf-8;base64,${encoded}`)) as CoverageModule;
}

async function viewmodel(): Promise<ViewmodelModule> {
  const file = path.join(PUBLIC, 'lib', 'viewmodel.js');
  return (await import(pathToFileURL(file).href)) as ViewmodelModule;
}

/**
 * A `/api/coverage` body's `files` array, in the endpoint's own shape — one
 * entry per WALKED path, each carrying the ids that govern it
 * (`ui/read-model.ts` · `export interface CoverageBody {` · ~1101). Trees are
 * built from this rather than assembled by hand, so what is measured below is
 * the roll-up the screen actually receives.
 */
const SERVED: { path: string; governs: string[] }[] = [
  { path: 'src/billing/prices.js', governs: ['CONST-postgres-pool-capped-at-20'] },
  { path: 'src/billing/invoice.js', governs: ['CONST-postgres-pool-capped-at-20', 'RULE-x'] },
  { path: 'src/api/routes.js', governs: ['RULE-x'] },
  { path: 'src/api/handler.js', governs: [] },
  { path: 'src/workers/queue.js', governs: [] },
  { path: 'src/workers/retry.js', governs: [] },
  { path: 'src/workers/spawn.js', governs: [] },
  { path: 'README.md', governs: [] },
];

/** `<section data-p="coverage">…</section>`, the design of record for this screen. */
function mockupSection(): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf('<section data-p="coverage"');
  assert.notEqual(start, -1, 'the mockup has no [data-p="coverage"] section');
  const end = html.indexOf('</section>', start);
  assert.notEqual(end, -1, 'the coverage section is never closed');
  return html.slice(start, end);
}

/**
 * One of the mockup's own script functions, by name — `renderTree` builds the
 * tree row and everything on it, `renderDet` the detail table. The bar exists
 * nowhere in the section's static markup, so the section alone is not the whole
 * design of record for this screen.
 *
 * The body runs to the first `}` in column zero, which is how this file is
 * indented throughout: every closer inside a function is indented at least two
 * spaces.
 */
function mockupFunction(name: string): string {
  const html = readFileSync(MOCKUP, 'utf8');
  const start = html.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `the mockup's script has no ${name}()`);
  const end = html.indexOf('\n}', start);
  assert.notEqual(end, -1, `${name}() is never closed at column zero`);
  return html.slice(start, end);
}

/* -------------------------------------------------------------------------- *
 * magnitude — the three shares, and the sum that makes them a measurement.
 * -------------------------------------------------------------------------- */

/**
 * The tolerance the sum is asserted to. Not `===`: each share is an independent
 * `n / total * 100`, so three of them add up in binary floating point and a
 * third of a track is 33.33333333333333 whatever anyone wants. `1e-9` of 74
 * pixels is 74 nanometres — far below anything that can be drawn, and far above
 * the ~1e-14 that repeated division actually costs. Every arithmetic mistake
 * this file mutates for lands orders of magnitude outside it.
 */
const SUM_EPSILON = 1e-9;

test('every row of a real tree fills its track exactly — three shares, one denominator', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree, treeRows } = await viewmodel();
  const rows = treeRows(buildTree(SERVED));

  // A scan that finds nothing reads exactly like a clean file.
  assert.ok(rows.length >= 8,
    `the tree built from ${SERVED.length} served paths flattened to ${rows.length} row(s); it `
    + 'should carry every file and every directory above it. Too few rows means buildTree changed, '
    + 'not that the bar is right.');

  for (const { node } of rows) {
    const mag = magnitude(node, false);
    assert.ok(Math.abs(mag.g + mag.u + mag.x - 100) < SUM_EPSILON,
      `${node.path}: the bar's three segments sum to ${mag.g + mag.u + mag.x}%, not 100%. `
      + '`.mini` is a fixed 74px track with overflow:hidden — a bar that does not fill it, or '
      + 'fills it twice, still renders and is a lie about how much of this directory is governed.');
    assert.equal(mag.governed + mag.ungoverned + mag.unexamined, mag.total,
      `${node.path}: the three COUNTS do not add up to the total, so the tooltip and the bar are `
      + 'answering two different questions');
    for (const share of [mag.g, mag.u, mag.x]) {
      assert.ok(Number.isFinite(share) && share >= 0 && share <= 100,
        `${node.path}: a share of ${share} is not a width — inline-size:${share}% is either `
        + 'unparsable or off the track');
    }
  }
});

test('the bar and the .covn count beside it are the same fact twice', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree, treeRows } = await viewmodel();
  // The row draws `${node.governedCount}/${node.fileCount}` next to the bar.
  // Two numbers and one picture disagreeing on one row is exactly the defect
  // that makes a reader stop trusting the screen.
  for (const { node } of treeRows(buildTree(SERVED))) {
    const mag = magnitude(node, false);
    assert.equal(mag.governed, node.governedCount);
    assert.equal(mag.total, node.fileCount);
  }
});

test('a fully governed directory is all gold; a directory nothing scopes is all warn', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree } = await viewmodel();
  const tree = buildTree(SERVED);
  const find = (p: string): TreeNode => {
    const stack = [...tree.children];
    for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
      if (node.path === p) return node;
      stack.push(...node.children);
    }
    throw new Error(`no node at ${p}`);
  };

  // Both files governed: the whole track is `i.g`, and `i.u` is not merely
  // small but zero — a sliver of warn under a fully governed directory reads
  // as an ungoverned file that is not there.
  const billing = magnitude(find('src/billing'), false);
  assert.deepEqual([billing.g, billing.u, billing.x], [100, 0, 0]);
  assert.deepEqual([billing.governed, billing.ungoverned], [2, 0]);

  // Three files, nothing scopes any of them — the mockup's own `src/workers/`
  // row, and the row `coverageGaps` names as a gap.
  const workers = magnitude(find('src/workers'), false);
  assert.deepEqual([workers.g, workers.u, workers.x], [0, 100, 0]);
  assert.deepEqual([workers.governed, workers.ungoverned], [0, 3]);

  // Mixed, and the shares are the exact fractions rather than something
  // rounded on the way to a stylesheet: 1 of 2 governed.
  const api = magnitude(find('src/api'), false);
  assert.deepEqual([api.g, api.u, api.x], [50, 50, 0]);
});

test('a leaf file is a bar too — 1/1 governed or 0/1, never a half-lit row', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree, treeRows } = await viewmodel();
  const leaves = treeRows(buildTree(SERVED))
    .map((row) => row.node)
    .filter((node) => node.children.length === 0);
  assert.equal(leaves.length, SERVED.length,
    'every served path is a leaf row and every leaf row carries a bar');
  for (const leaf of leaves) {
    const mag = magnitude(leaf, false);
    assert.equal(mag.total, 1);
    assert.deepEqual([mag.g, mag.u], leaf.governedCount === 1 ? [100, 0] : [0, 100]);
  }
});

test('a directory with no files divides by nothing and draws an empty track', async () => {
  const { magnitude } = await coverageModule();
  // `buildTree` cannot produce this — a directory node exists only because a
  // file needed it — so it is asserted against the shape directly. `0/0` is
  // NaN, `inline-size:NaN%` is an unparsable declaration, and a segment whose
  // width fails to parse keeps whatever width it had: the bar would show the
  // PREVIOUS row's magnitude under this row's name.
  const empty: TreeNode = {
    name: 'vendor', path: 'vendor', children: [], governs: [], fileCount: 0, governedCount: 0,
  };
  const mag = magnitude(empty, false);
  assert.deepEqual([mag.g, mag.u, mag.x], [0, 0, 0]);
  assert.deepEqual([mag.governed, mag.ungoverned, mag.unexamined, mag.total], [0, 0, 0, 0]);
  for (const share of [mag.g, mag.u, mag.x]) {
    assert.ok(Number.isFinite(share), 'a zero-file row produced NaN, which draws as no width at all');
  }
});

test('an over-count cannot draw a bar wider than its track', async () => {
  const { magnitude } = await coverageModule();
  // `buildTree`'s roll-up cannot report more governed files than files, and if
  // it ever does the bar must still be a bar: `.mini` sets overflow:hidden, so
  // a 150% gold segment crops to a full track and reads as a fully governed
  // directory — the most flattering possible rendering of a broken number.
  const impossible: TreeNode = {
    name: 'src', path: 'src', children: [], governs: [], fileCount: 4, governedCount: 9,
  };
  const mag = magnitude(impossible, false);
  assert.ok(Math.abs(mag.g + mag.u + mag.x - 100) < SUM_EPSILON);
  assert.equal(mag.g, 100);
  assert.equal(mag.u, 0);
});

/* -------------------------------------------------------------------------- *
 * The third segment: a measured zero and an absence, which are not the same.
 * -------------------------------------------------------------------------- */

test('on a complete walk the not-examined segment is a measured zero', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree, treeRows } = await viewmodel();
  for (const { node } of treeRows(buildTree(SERVED))) {
    const mag = magnitude(node, false);
    assert.equal(mag.x, 0);
    assert.equal(mag.unexamined, 0);
    // The walk reached everything, so zero is the true count and the row may
    // say so. `renderMini` prints it: "… · 0 not examined".
    assert.equal(mag.unknownRemainder, false);
  }
});

test('on a truncated walk the row stops CLAIMING zero — the remainder is unknown', async () => {
  const { magnitude } = await coverageModule();
  const { buildTree, treeRows } = await viewmodel();
  const rows = treeRows(buildTree(SERVED));
  assert.ok(rows.length > 0);
  for (const { node } of rows) {
    const mag = magnitude(node, true);
    // The bar is unchanged, because there is no width to draw: `/api/coverage`
    // carries one global `truncated` boolean and no path list, so no row knows
    // how many of its files the walk missed. What changes is that the row no
    // longer asserts the zero.
    assert.equal(mag.unknownRemainder, true);
    assert.equal(mag.x, 0);
    assert.ok(Math.abs(mag.g + mag.u + mag.x - 100) < SUM_EPSILON,
      'a truncated walk must not be disclosed by breaking the bar');
    // The governed/ungoverned split is a fact about the paths that WERE
    // walked and stays true whatever the walk missed.
    assert.deepEqual(
      [mag.governed, mag.ungoverned], [node.governedCount, node.fileCount - node.governedCount],
    );
  }
});

test('only the boolean true means truncated — an absent field is not an unknown remainder', async () => {
  const { magnitude } = await coverageModule();
  const node: TreeNode = {
    name: 'src', path: 'src', children: [], governs: [], fileCount: 2, governedCount: 1,
  };
  // A body that omitted `truncated` would otherwise make every row disclose a
  // truncation that never happened, which is the same defect in the other
  // direction: a screen crying "not examined" over a complete walk.
  assert.equal(magnitude(node, undefined as unknown as boolean).unknownRemainder, false);
  assert.equal(magnitude(node, false).unknownRemainder, false);
  assert.equal(magnitude(node, true).unknownRemainder, true);
});

test('the source scanned below is the code, not the commentary about it', () => {
  // Every scan in this file that asserts about BEHAVIOUR reads `coverageCode`.
  // If the stripper ever ate the file, or stopped eating comments, those scans
  // would quietly assert about nothing.
  assert.ok(coverageCode.length < coverageSource.length,
    'the comment stripper removed nothing — coverage.js is the most heavily commented screen in '
    + 'this directory and cannot have lost its docblocks');
  assert.ok(coverageCode.includes('export function magnitude'),
    'the comment stripper ate the code as well as the comments');
  assert.ok(!coverageCode.includes('design of record'),
    'a docblock survived the stripper, so the scans below can pass on prose');
  assert.ok(coverageCode.includes("from '/lib/viewmodel.js'"),
    'the stripper damaged a browser specifier, which is the one string in this file a `//` rule '
    + 'could plausibly reach');
});

test('the truncated tooltip says the state in KEYED words and never a number it lacks', () => {
  // The mockup's `mini.title` is an unkeyed English ternary in its own script,
  // so its first two clauses are transcribed as literals. The THIRD is not,
  // when the walk stopped: a `0` there would assert the opposite of the one
  // thing `gaps.note` says must never be folded into another, so the row uses
  // the two keys this screen already pairs for that state.
  const ternary = /unknownRemainder\s*\n?\s*\?([\s\S]*?)\n\s*:([\s\S]*?);/.exec(coverageCode);
  assert.ok(ternary, 'renderMini no longer branches on unknownRemainder — a truncated walk is '
    + 'being disclosed by nothing at all, or by a number the endpoint does not carry');
  const [, unknown, measured] = ternary as unknown as [string, string, string];

  assert.ok(unknown.includes("ctx.tFlat('cov.k4')"),
    'the unknown-remainder tooltip does not name cov.k4 ("not examined")');
  assert.ok(unknown.includes("ctx.tFlat('gaps.r2')"),
    'the unknown-remainder tooltip does not name gaps.r2 ("past the file limit")');
  assert.ok(!unknown.includes('not examined'),
    'the truncated branch prints "not examined" as a literal — an untranslated copy of a string '
    + 'this screen already has a key for');
  assert.ok(!/mag\.unexamined/.test(unknown),
    'the truncated branch prints a count of unreached files. The endpoint carries one global '
    + '`truncated` boolean and no path list: that number does not exist, and a 0 there asserts '
    + 'the opposite of what gaps.note says must never be folded into another state.');

  // The other half of the same fact: on a COMPLETE walk the zero IS the
  // measurement and the row must say it, the way the mockup's own tooltip does.
  assert.ok(measured.includes('not examined') && /mag\.unexamined/.test(measured),
    'the complete-walk tooltip no longer reports the measured zero — the mockup writes '
    + '"… · 0 not examined" and a walk that reached everything is entitled to say so');
});

test('the screen discloses a truncated walk in prose as well as per row', () => {
  // INV-nothing-is-dropped-silently, and the OPEN task plan:ui1 seq:17e, which
  // this screen does not close: it cannot page or filter `/api/coverage` and it
  // cannot name a path the walk missed. What it must not do is stay quiet.
  assert.ok(/if \(data\.truncated\)/.test(coverageCode),
    'nothing on this screen branches on data.truncated — a walk that stopped short would render '
    + 'as a short tree and nothing would say so');
  assert.ok(/ctx\.t\('cov\.k4'\)/.test(coverageCode) && /ctx\.t\('gaps\.r2'\)/.test(coverageCode),
    'the truncation line no longer draws the cov.k4 / gaps.r2 pair the mockup joins');
});

/* -------------------------------------------------------------------------- *
 * The wiring: three shares reaching three elements, through CSSOM.
 * -------------------------------------------------------------------------- */

test('each segment is handed its OWN share, in the mockup\'s order', () => {
  // `magnitude()` can be perfect and the bar still wrong: `sized(el('i','u'),
  // mag.g)` sums to 100 on every row and paints the ungoverned share gold.
  // Nothing else in this file could see that, because nothing else looks at
  // which number reaches which element.
  const wired = [...coverageCode.matchAll(/sized\(el\('i', '(\w+)'\), mag\.(\w+)\)/g)]
    .map((m) => [m[1]!, m[2]!]);
  assert.deepEqual(wired, [['g', 'g'], ['u', 'u'], ['x', 'x']],
    'the three segments are not `i.g`←g, `i.u`←u, `i.x`←x in that order. The order is the '
    + 'mockup\'s (governed, then ungoverned, then the hatched remainder) and a bar drawn '
    + 'right-to-left out of order is a different picture.');
});

test('the bar is sized through CSSOM, never through a style attribute', () => {
  // `ui/security.ts` sends `style-src 'self'` with no `'unsafe-inline'`, so a
  // `style="…"` attribute is blocked outright — the segments would all fall
  // back to `flex-basis:auto` and the bar would draw three equal thirds on
  // every row, which looks like a rendering rather than a failure.
  assert.ok(/style\.setProperty\('inline-size'/.test(coverageCode),
    'no segment is sized through CSSOM at all');
  assert.ok(!/setAttribute\(\s*'style'/.test(coverageCode),
    'a style attribute is set somewhere in this screen; CSP blocks it and the bar dies silently');
});

test('the bar is built from the mockup\'s own four class names', () => {
  const renderTree = mockupFunction('renderTree');
  // Read out of the design of record rather than copied into this file. A copy
  // would go stale the moment the mockup renamed a segment and nothing would
  // say so.
  for (const built of ["el('div','mini')", "el('i','g')", "el('i','u')", "el('i','x')"]) {
    assert.ok(renderTree.includes(built),
      `the mockup's renderTree no longer builds ${built} — the design of record moved`);
  }
  for (const built of ["el('div', 'mini')", "el('i', 'g')", "el('i', 'u')", "el('i', 'x')"]) {
    assert.ok(coverageCode.includes(built),
      `coverage.js no longer builds ${built}`);
  }
  // The order the mockup appends them in, which is the order the track reads.
  const order = ["el('i','g')", "el('i','u')", "el('i','x')"].map((s) => renderTree.indexOf(s));
  assert.deepEqual([...order].sort((a, b) => a - b), order,
    'the mockup appends the three segments in a different order than g, u, x');
});

test('styles.css still carries the four rules the bar is invisible without', () => {
  // The coverage screen once rendered as 957 white rectangles because
  // `styles.css` had never carried `.tree button` — the markup was faithful and
  // the rules for it were missing (that file's own carry note, ~664). Three
  // `<i>` elements with no background are the same failure in miniature: they
  // occupy exactly the right widths and are the colour of the track.
  const css = readFileSync(STYLES_CSS, 'utf8');
  for (const rule of ['.mini{', '.mini i.g{', '.mini i.u{', '.mini i.x{']) {
    assert.ok(css.includes(rule), `styles.css no longer carries ${rule} — the bar renders as `
      + 'three invisible rectangles and no test but this one can tell');
  }
});

/* -------------------------------------------------------------------------- *
 * The screen against the two string tables and against the mockup.
 * -------------------------------------------------------------------------- */

async function table(language: string): Promise<Record<string, string>> {
  const file = path.join(PUBLIC, 'strings', `${language}.js`);
  const mod = await import(pathToFileURL(file).href) as { strings: Record<string, string> };
  return mod.strings;
}

/** Every key `coverage.js` names, by the three shapes this screen names one in. */
function keysNamed(): { key: string; args: string | null }[] {
  const out: { key: string; args: string | null }[] = [];
  for (const m of coverageCode.matchAll(/ctx\.t(?:Flat)?\('([^']+)'/g)) {
    const after = coverageCode.slice(m.index + m[0].length);
    const open = after.indexOf('{');
    const close = after.indexOf(')');
    out.push({ key: m[1]!, args: open !== -1 && (close === -1 || open < close) ? after : null });
  }
  for (const m of coverageCode.matchAll(/screenHead\(ctx, root, '([^']+)', '([^']+)', '([^']+)'\)/g)) {
    for (const key of [m[1]!, m[2]!, m[3]!]) out.push({ key, args: null });
  }
  // The four legend entries are named through an array of [dot, key] pairs,
  // which the `ctx.t('…')` pattern above cannot see.
  for (const m of coverageCode.matchAll(/\['[gownwx]', '([^']+)'\]/g)) {
    out.push({ key: m[1]!, args: null });
  }
  return out;
}

test('every string key the coverage screen names is declared in both tables, with its slots supplied', async () => {
  const en = await table('en');
  const he = await table('he');
  const used = keysNamed();

  assert.ok(used.length >= 19,
    `the scan found ${used.length} key(s) in coverage.js; the screen names at least nineteen. A `
    + 'collapse means the patterns stopped matching, not that the screen stopped naming keys.');

  // The grammar has ONE parser and this is it. Eight files used to carry a
  // private scanner instead, all of them predating emphasis, and every one
  // read `{b:` as a substitution named `b:...` the day emphasis landed.
  const { slots: slotsOf } = await import(
    new URL('../../src/ui/public/lib/i18n.js', import.meta.url).href
  ) as { slots: (template: string) => string[] };

  for (const { key, args } of used) {
    assert.ok(key in en, `coverage.js names ${key}, missing from the English table`);
    assert.ok(key in he, `coverage.js names ${key}, missing from the Hebrew table`);
    // Both tables, not only English: `t()` throws on a substitution the caller
    // did not pass, and it throws in whichever language the reader chose.
    for (const template of [en[key]!, he[key]!]) {
      for (const slot of slotsOf(template)) {
        assert.ok(args !== null && args.includes(`${slot}:`),
          `${key} declares a {${slot}} slot that the call site does not supply — t() throws and `
          + 'the screen blanks');
      }
    }
  }
});

test('every cov. key the English table declares is placed by the screen', async () => {
  const en = await table('en');
  const declared = Object.keys(en).filter((key) => key.startsWith('cov.')).sort();
  const named = new Set(keysNamed().map((u) => u.key));
  // The other direction of the same fact. `strings-parity` proves the two
  // tables agree with the mockup's `data-t` set; it cannot prove the screen
  // ever draws one. `cov.magn` was declared and drawn nowhere for as long as
  // the bar it describes was refused — a sentence of the design of record that
  // silently did not render, which is what this assertion is for.
  assert.deepEqual(declared.filter((key) => !named.has(key)), [],
    'these cov. keys are declared and drawn nowhere');
  assert.equal(declared.length, 14,
    `the English table declares ${declared.length} cov. key(s); it has been 14 since this screen `
    + 'was written. A new one is a new sentence on this screen and needs placing.');
});

test('no translated string is assigned — t() returns nodes and they are appended (ruling A1)', () => {
  // `t()` returns Node[]. Assigning one to `textContent` renders `[object
  // Object]`; assigning `tFlat()` to `innerHTML` would destroy the `.m` spans
  // that carry the direction isolation. Neither is reachable by any other
  // test: this module's DOM half is never evaluated.
  assert.ok(!/textContent\s*=\s*ctx\.t\(/.test(coverageCode),
    'a translated value is assigned to textContent');
  assert.ok(!/innerHTML/.test(coverageCode), 'innerHTML has no legitimate use in a screen module');
  assert.ok(/\.append\(\.\.\.ctx\.t\(/.test(coverageCode),
    'the screen appends no translated nodes at all — the scan above is checking nothing');
  // `tFlat` fills attribute sinks and nothing else. The bar's tooltip is the
  // only one on this screen.
  for (const m of coverageCode.matchAll(/(\w+)\s*=\s*[^\n]*ctx\.tFlat\(/g)) {
    assert.ok(['title'].includes(m[1]!),
      `ctx.tFlat() fills \`${m[1]}\`, which is not an attribute sink — ctx.t() is what fills an `
      + 'element');
  }
});

test('the screen invents no class the design of record does not draw', () => {
  // The section's static markup is not the whole design of record for this
  // screen: `.mini`, `.nm` and `.covn` exist only inside `renderTree`, and
  // `.linkid` only inside `renderDet`. All three sources are read.
  const drawn = new Set<string>();
  for (const m of mockupSection().matchAll(/class="([^"]+)"/g)) {
    for (const token of m[1]!.trim().split(/\s+/)) drawn.add(token);
  }
  for (const fn of ['renderTree', 'renderDet']) {
    const body = mockupFunction(fn);
    for (const m of body.matchAll(/el\('[a-z0-9]+','([^']*)'/g)) {
      for (const token of m[1]!.trim().split(/\s+/)) if (token) drawn.add(token);
    }
    for (const m of body.matchAll(/className\s*=\s*'([^']*)'/g)) {
      for (const token of m[1]!.trim().split(/\s+/)) if (token) drawn.add(token);
    }
  }
  assert.ok(drawn.size >= 20, `the mockup scan found ${drawn.size} class token(s) — too few to be `
    + 'the coverage screen, so the extraction is broken rather than the screen clean');
  for (const required of ['mini', 'g', 'u', 'x', 'nm', 'covn']) {
    assert.ok(drawn.has(required),
      `the mockup no longer draws .${required} — the extraction above missed renderTree`);
  }

  const written: string[] = [];
  for (const m of coverageCode.matchAll(/\bel\('[a-z0-9]+',\s*'([^']*)'/g)) written.push(m[1]!);
  assert.ok(written.length >= 14,
    `the coverage.js scan found ${written.length} class string(s); the screen writes at least `
    + 'fourteen');

  for (const value of written) {
  const allowed = allowedClasses(drawn);
    for (const token of value.trim().split(/\s+/)) {
      // `allowed`, not `drawn`: the mockup's classes UNION what styles.css
      // actually styles. See test/helpers/shipped-classes.ts — the app is what
      // gets built now, so a NEW class with a real rule is ordinary development;
      // a typo still has no rule anywhere and still fails here.
      assert.ok(allowed.has(token),
        `coverage.js writes class "${token}", which the coverage screen's design of record never `
        + 'uses. A class the design of record does not draw is either a typo or a decision the '
        + 'owner has not taken.');
    }
  }

  // The composites, pinned whole rather than as loose tokens: a card that took
  // `card` without `pane` would satisfy the token check above and float data on
  // glass, which repaint spec §4 forbids.
  for (const composite of ['card pane', 'tree plate', 'chip gov']) {
    assert.ok(mockupSection().includes(`class="${composite}"`),
      `the mockup no longer draws class="${composite}" — the design of record moved`);
    assert.ok(written.includes(composite),
      `coverage.js no longer writes the "${composite}" pair the mockup draws`);
  }
});

test('the populated view sits in the mockup\'s own #covfull, beside #covempty', () => {
  // The mockup keeps both states in markup and swaps them with its `∅` toggle;
  // this screen decides between them from the data, so only one is ever built.
  // The two ids are still the design of record's, and `e2e/states.spec.ts`
  // reads both of them there.
  const section = mockupSection();
  for (const id of ['covfull', 'covempty']) {
    assert.ok(section.includes(`id="${id}"`), `the mockup no longer marks #${id}`);
    assert.ok(new RegExp(`id = '${id}'`).test(coverageCode),
      `coverage.js never builds #${id} — the populated and empty views are the two halves of `
      + 'this screen and both are the mockup\'s');
  }
});
