/**
 * **The TREE inventory: what the app's element tree does that its mockup
 * section does not — order, nesting, quantity and all.**
 *
 * ── WHY A SECOND PARITY FILE ───────────────────────────────────────────────
 *
 * `screen-parity.spec.ts` is not extended and not touched. It asks a different
 * question — "is any KIND of element missing?" — and its `KNOWN_GAPS` ledger
 * is a shrink-only record that a hundred new findings would bury. This file
 * asks the question that ledger cannot: **is it the same tree?**
 *
 * ── THIS FILE ENDS AT AN INVENTORY, NOT AT A GREEN GATE ────────────────────
 *
 * Owner ruling, 2026-08-23, on `TASK-tree-parity-compare-the-element-tree-not-a-
 * sorted-set-of`: *"THIS TASK ENDS AT THE INVENTORY, NOT AT GREEN … the full
 * list is produced and reviewed BEFORE any screen is changed, so the true size
 * of the gap is the owner's to see and the fix order is the owner's to set."*
 *
 * So the inventory test asserts almost nothing. It MEASURES, and it fails only
 * for a reason that would make the measurement a lie — a screen that never
 * rendered, or a mockup section that is not there. Turning it into a ledger is
 * the NEXT task, deliberately, because a gate written before the owner has
 * seen the list decides the fix order by accident.
 *
 * ── THE SELF-CHECK COMES FIRST, AND IT IS NOT CEREMONY ─────────────────────
 *
 * A prior version of the kinds gate read `el.className`, which on an SVG
 * element is an `SVGAnimatedString` and not a string — so every `<rect>`,
 * `<path>`, `<circle>` and `<text>` was recorded as a BARE TAG with no
 * classes, and eighteen `svg.chart` rules that had never been carried into
 * `styles.css` were invisible for weeks. The gate was green the entire time.
 *
 * `the walker sees every kind of difference` below is the answer to that: six
 * deliberately mutated trees, one per class of difference this walker claims
 * to see, INCLUDING a class removed from an SVG `<rect>`. A walker with the
 * `className` bug passes five of those six and fails the SVG one. A walker
 * that reports everything as different fails the first, which asserts that two
 * identical trees diverge in NOTHING.
 */
import { test, expect } from './app.ts';
import { MOCKUP_URL, SCREENS, showScreen } from './mockup.ts';
import {
  EXTRACT_TREE, diffTrees, classify, rootDivergence, vocabulary,
  type Divergence, type TreeNode,
} from './tree-walk.ts';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const REPO = path.resolve(import.meta.dirname, '..');

/**
 * Where the inventory lands. `test-results/` is already gitignored as a run
 * artefact directory, which is what this is; `MYCONTEXT_TREE_PARITY_OUT`
 * redirects it, the same override pattern `MYCONTEXT_MOCKUP` and
 * `MYCONTEXT_E2E_CORPUS` use.
 */
const OUT_DIR = process.env['MYCONTEXT_TREE_PARITY_OUT'] !== undefined
  ? path.resolve(process.env['MYCONTEXT_TREE_PARITY_OUT'])
  : path.join(REPO, 'test-results', 'tree-parity');

/**
 * Everything a screen could possibly have used to build a node: its own
 * module, the shared DOM factories, the libraries and the shell.
 *
 * This is the second source of evidence, and `classify` explains why it is
 * needed: a DOM cannot distinguish a branch that does not exist from a branch
 * nothing reached, but SOURCE can settle one side of it. A class token that
 * appears nowhere in this blob cannot be emitted by this screen whatever the
 * corpus holds — that is a code gap, decided.
 */
function vocabularyFor(screen: string): Set<string> {
  const pub = path.join(REPO, 'src', 'ui', 'public');
  const files = [
    path.join(pub, 'app.js'),
    path.join(pub, 'screens', 'parts.js'),
    path.join(pub, 'screens', `${screen}.js`),
    ...readdirSync(path.join(pub, 'lib')).map((f) => path.join(pub, 'lib', f)),
  ];
  let blob = '';
  for (const file of files) {
    try { blob += `\n${readFileSync(file, 'utf8')}`; } catch { /* screen has no module */ }
  }
  return vocabulary(blob);
}

// ───────────────────────────────────────────────────────────────────────────
// 1. THE SELF-CHECK
// ───────────────────────────────────────────────────────────────────────────

/**
 * The control tree, and six mutations of it — one per class of difference the
 * walker claims to see. Written as whole documents rather than DOM surgery so
 * the mutation is legible in the diff between two adjacent strings.
 */
const PROBE = (body: string): string =>
  `<!doctype html><html><body><section data-p="probe">${body}</section></body></html>`;

const CONTROL = `
  <div class="card pane">
    <h3>Head</h3>
    <table><tbody><tr><td class="m">a</td></tr><tr><td class="m">b</td></tr></tbody></table>
    <svg class="chart"><rect class="bar"></rect><rect class="bar"></rect></svg>
  </div>
  <p class="small">tail</p>`;

test('the walker sees every kind of difference', async ({ page }) => {
  const read = async (body: string): Promise<TreeNode> => {
    await page.setContent(PROBE(body));
    const tree = await page.evaluate(EXTRACT_TREE, '[data-p="probe"]');
    expect(tree, 'the probe page rendered no section').not.toBeNull();
    return tree!;
  };
  const control = await read(CONTROL);

  // (a) IDENTICAL trees diverge in nothing. Without this a walker that returns
  //     "different" for everything would pass every case below.
  expect(diffTrees('probe', control, await read(CONTROL)),
    'two identical trees must produce no divergence at all — a walker that ' +
    'always reports a difference proves nothing by reporting one').toEqual([]);

  const kinds = (ds: Divergence[]): string[] =>
    ds.map((d) => `${d.type} ${d.kind}`.trim()).sort();

  // (b) ORDER — the same children, swapped. The kinds SET is identical, which
  //     is exactly the difference `screen-parity.spec.ts` cannot see.
  const reordered = await read(`
    <div class="card pane">
      <table><tbody><tr><td class="m">a</td></tr><tr><td class="m">b</td></tr></tbody></table>
      <h3>Head</h3>
      <svg class="chart"><rect class="bar"></rect><rect class="bar"></rect></svg>
    </div>
    <p class="small">tail</p>`);
  expect(kinds(diffTrees('probe', control, reordered)),
    'swapping two siblings must be reported').toContain('ORDER');

  // (c) QUANTITY — one row against three. Same set, same order, same nesting.
  const requantified = await read(CONTROL.replace(
    '<tr><td class="m">b</td></tr>',
    '<tr><td class="m">b</td></tr><tr><td class="m">c</td></tr><tr><td class="m">d</td></tr>'));
  const quantity = diffTrees('probe', control, requantified);
  expect(kinds(quantity), 'a repeated row drawn more times must be reported').toContain('QUANTITY tr');
  expect(classify(quantity.find((d) => d.type === 'QUANTITY')!, new Set()).verdict,
    'one template over more rows is DATA, not a code gap').toBe('DATA');

  // (d) NESTING — the `<p class="small">` moved INSIDE the card. The kinds set
  //     is untouched; only the depth and the parent changed.
  const renested = await read(`
    <div class="card pane">
      <h3>Head</h3>
      <table><tbody><tr><td class="m">a</td></tr><tr><td class="m">b</td></tr></tbody></table>
      <svg class="chart"><rect class="bar"></rect><rect class="bar"></rect></svg>
      <p class="small">tail</p>
    </div>`);
  const nested = diffTrees('probe', control, renested);
  expect(kinds(nested), 'a child moved into a sibling must be reported as absent from its ' +
    'old parent').toContain('ABSENT p.small');
  expect(nested.find((d) => d.type === 'ABSENT')!.detail,
    'and the report must SAY where it went, or nobody can act on it')
    .toContain('the app draws this kind elsewhere');
  expect(classify(nested.find((d) => d.type === 'ABSENT')!, new Set()).verdict,
    'a node that moved is a code difference — no corpus moves a node').toBe('STRUCTURAL');

  // (e) THE SVG CLASS. `<rect class="bar">` -> `<rect>`. A walker reading
  //     `el.className` sees `SVGAnimatedString`, records both as a bare `rect`,
  //     and reports NOTHING here. This is the assertion that catches that bug.
  const unclassed = await read(CONTROL.replaceAll('<rect class="bar">', '<rect>'));
  const svg = diffTrees('probe', control, unclassed);
  expect(kinds(svg),
    'a class REMOVED from an <svg> child must be visible — if this list is empty the walker ' +
    'is reading el.className, which is an SVGAnimatedString and never a string')
    .toEqual(['ABSENT rect.bar', 'EXTRA rect']);

  // (e2) A STATE CLASS, which is neither a deletion nor an addition. The kinds
  //      gate reports `td.m` missing and says nothing about `td.m.stale`
  //      standing in its place; a reader given both halves can see in one line
  //      that no element is missing at all.
  const stateful = await read(CONTROL.replaceAll('<td class="m">', '<td class="m stale">'));
  const state = diffTrees('probe', control, stateful);
  const absent = state.find((d) => d.type === 'ABSENT')!;
  expect(absent.detail, 'the counterpart wearing the extra class must be named')
    .toContain('same tag, class lists differ only by [stale]');
  expect(classify(absent, new Set()).verdict,
    'a state class is not a missing element, and is not decidable from the DOM either')
    .toBe('AMBIGUOUS');

  // (f) DELETION — a kind that exists nowhere on the other side.
  const deleted = await read(CONTROL.replace('<h3>Head</h3>', ''));
  const gone = diffTrees('probe', control, deleted);
  expect(kinds(gone), 'a deleted element must be reported').toContain('ABSENT h3');
  expect(gone.find((d) => d.type === 'ABSENT')!.detail,
    'and distinguished from one that merely moved').toContain('nowhere in the app section');
});

/**
 * The second evidence source, checked on markup written for the purpose.
 *
 * `vocabulary` decides whether an absent node is a decided code gap or an
 * AMBIGUOUS one, and it decides it by asking whether the screen's source can
 * spell the class. These modules are more prose than code, so a collector that
 * reads comments answers "yes" for classes the code never emits and converts
 * every real gap into a shrug.
 */
test('the source vocabulary reads code and not commentary', () => {
  const vocab = vocabulary(`
    /* A block comment that mentions the ribbon class and a tier chip. */
    // A line comment mentioning heatstrip.
     * A continuation line mentioning tokvoid.
    const a = el('div', 'card pane');
    const b = el('span', index === 0 ? 'blk sel' : 'blk');
    const c = el('div', \`rung \${state}\`);
    const d = document.createElement('td');
  `);
  expect([...vocab].sort(), 'every class and tag the code can emit, and nothing a comment said')
    .toEqual(['blk', 'card', 'div', 'pane', 'rung', 'sel', 'span', 'td']);
  expect(vocab.has('state'), 'an interpolated expression is a variable name, not a class — ' +
    'admitting it would let any identifier in the file pass as evidence').toBe(false);
  for (const fromProse of ['ribbon', 'chip', 'heatstrip', 'tokvoid']) {
    expect(vocab.has(fromProse),
      `"${fromProse}" appears only in a comment — counting it would report a real code gap ` +
      'as merely ambiguous').toBe(false);
  }
});

// ───────────────────────────────────────────────────────────────────────────
// 2. THE INVENTORY
// ───────────────────────────────────────────────────────────────────────────

interface ScreenResult {
  readonly screen: string;
  readonly measured: boolean;
  readonly note: string;
  readonly mockNodes: number;
  readonly appNodes: number;
  /** The `<section>`'s own classes, when the two sides disagree. See `rootDivergence`. */
  readonly root: string | null;
  readonly divergences: Divergence[];
  /** The raw trees, so a follow-up can re-diff without re-running a browser. */
  readonly mockTree?: TreeNode | null;
  readonly appTree?: TreeNode | null;
}

function countNodes(node: TreeNode | null): number {
  if (node === null) return 0;
  return 1 + node.kids.reduce((n, k) => n + countNodes(k), 0);
}

/**
 * **Where the wall clock went, per screen and per phase.**
 *
 * Written because this test failed at its 240s timeout IN ISOLATION and the
 * three plausible causes — a quadratic diff over a corpus that grew, a slow
 * extraction, and a settle loop that never settles — are indistinguishable
 * from a single total. They are not indistinguishable from these six columns:
 * a quadratic diff shows up in `diff`, a heavy extraction in `extract`, and a
 * bad wait condition shows up as `attempts` pinned at the cap on every screen
 * while `nodes` stays small. Kept rather than deleted after the diagnosis,
 * because the next person to see this file slow needs the same six columns and
 * should not have to re-derive them.
 */
interface ScreenTiming {
  readonly screen: string;
  /** Mockup rail click + its 300ms transition wait + the mockup extraction. */
  readonly mock: number;
  /** The settle loop: samples until the count stopped changing and nothing was in flight. */
  readonly settle: number;
  /** How many of the 25 samples were spent. 25 means the loop never settled. */
  readonly attempts: number;
  /** `/api` reads still in flight when the loop gave up or broke. */
  readonly inFlight: number;
  /** `EXTRACT_TREE` over the app section. */
  readonly extract: number;
  /** `vocabularyFor` + `diffTrees` + `classify` — all the pure work. Filled last. */
  diff: number;
  total: number;
  readonly appNodes: number;
}

function renderTimings(rows: ScreenTiming[]): string {
  const ms = (n: number): string => `${Math.round(n)}`;
  const L: string[] = [];
  L.push('**Where the time went** (ms)', '');
  L.push('| screen | mock | settle | attempts | in flight | extract | diff | app nodes | total |');
  L.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
  for (const r of rows) {
    L.push(`| ${r.screen} | ${ms(r.mock)} | ${ms(r.settle)} | ${r.attempts} | ${r.inFlight} | ` +
      `${ms(r.extract)} | ${ms(r.diff)} | ${r.appNodes} | ${ms(r.total)} |`);
  }
  const sum = (pick: (r: ScreenTiming) => number): string =>
    ms(rows.reduce((n, r) => n + pick(r), 0));
  L.push(`| **all** | ${sum((r) => r.mock)} | ${sum((r) => r.settle)} | ` +
    `${rows.reduce((n, r) => n + r.attempts, 0)} | | ${sum((r) => r.extract)} | ` +
    `${sum((r) => r.diff)} | | ${sum((r) => r.total)} |`);
  return L.join('\n');
}

test('inventory: the element TREE of every screen against its mockup section',
  async ({ app }, testInfo) => {
    // Twenty-one screens, two renders each, a settle loop on every one. The
    // kinds gate walks the same ground in ~16s alone and timed out at 30s under
    // six workers; this walk carries a deeper extraction, so it was given more.
    //
    // **The budget is not what made this pass.** It stood at 240s and this test
    // still hit it, alone, on 2026-08-29. What it actually costs, measured with
    // the per-screen table below once the in-flight SET replaced the +1/-1
    // counter: 36-57s for one project alone, of which 27-46s is the settle
    // loop's own 400ms cadence, ~8s the mockup's 300ms transition waits, ~1.2s
    // extraction and **77ms** of tree diffing across all twenty-one screens.
    // The walk was never the cost, and the corpus growing to 680 items did not
    // make it one. The budget is left where it is as headroom under contention;
    // raising it further would be treating the symptom this file just removed.
    test.setTimeout(240_000);
    const { page } = app;

    const mockupPage = await page.context().newPage();
    await mockupPage.goto(MOCKUP_URL);
    await mockupPage.waitForLoadState('domcontentloaded');

    const results: ScreenResult[] = [];
    const unmeasurable: string[] = [];
    const timings: ScreenTiming[] = [];

    /**
     * `/api` reads still in flight, excluding the shell's one live stream,
     * which never finishes. The settle loop below asks whether the element
     * count stopped changing, and a screen that has appended its cards and is
     * waiting for their data is stable while it is still half-drawn —
     * `e2e/screen-parity.spec.ts` carries the measurement (2026-08-28,
     * `/api/simulate/sweep` landing after the loop settled) and the same
     * two-part condition.
     *
     * ── IT COUNTS REQUEST OBJECTS, AND THAT IS THE WHOLE BUG THIS FILE HAD ──
     *
     * Until 2026-08-29 this was a bare `+1 / -1` over the two events, which
     * assumes every completion the page reports was also STARTED under these
     * listeners. The `app` fixture breaks that assumption by design: it
     * resolves as soon as a rail button is visible, while `screens/preview.js`
     * is still awaiting its boot reads. Those start BEFORE the handlers below
     * are attached and finish after, so the counter is decremented for
     * requests it never incremented for and lands at **-1** — measured here,
     * on this file, in three consecutive runs.
     *
     * A permanent offset of -1 does not merely make `pending === 0`
     * unreachable. It INVERTS the condition: "nothing in flight" now reads
     * false, and "exactly one read still in flight" reads true. Both halves of
     * that were measured on 2026-08-29, in one run of this spec alone:
     *
     *   preview, simulate, doctor, work, port, packs, docs, learn
     *       exhausted all 25 samples — 18.2s, 27.6s, 11.7s, 12.5s, 12.4s,
     *       19.2s, 35.5s, 31.3s of pure waiting on a screen that had finished.
     *       That is 168 of the run's 216 seconds, and it is why the same spec
     *       ran 34s one time and timed out at 240s the next.
     *   coverage, injected, ask, decay, graph, status, capture, palette,
     *   config, tut
     *       broke on the SECOND sample with **3 nodes** in the section — the
     *       heading and nothing else — because the offset made the in-flight
     *       half true while the first read was still outstanding. Compared at
     *       712, 56, 372, 903, 39, 27, 19, 66, 87 and 54 nodes on a healthy
     *       run. Ten of twenty-one screens were inventoried EMPTY and the
     *       test passed, which is the worse half: a slow spec is visible and
     *       a fabricated inventory is not.
     *
     * Clamping at zero would hide both and would also mask a real leak. A set
     * of the requests these listeners actually saw start is the counter the
     * loop always meant to have.
     */
    const inFlight = new Set<import('@playwright/test').Request>();
    const counts = (url: string): boolean =>
      url.includes('/api/') && !url.includes('/api/watch/stream');
    const done = (r: import('@playwright/test').Request): void => { inFlight.delete(r); };
    page.on('request', (r) => { if (counts(r.url())) inFlight.add(r); });
    page.on('requestfinished', done);
    page.on('requestfailed', done);

    try {
      for (const screen of SCREENS) {
        // **Switch the mockup the way the mockup switches**, by clicking its
        // own rail button, rather than assigning `hidden` from outside.
        //
        // `screen-parity.spec.ts` assigns `hidden` directly and never noticed
        // the difference, because it compares the section's DESCENDANTS. This
        // walk compares the section too, and the mockup's `go(s)` also sets
        // `printing` on the shown pane for its own `@media print` rule. Assign
        // `hidden` from outside and exactly one section — whichever `go()`
        // showed at boot — carries the class, so the root differs on ONE screen
        // for a reason that is purely an artefact of how the test drove the
        // page. Driven properly, the class is on all 21 and the difference it
        // reports is a real one about how the app prints.
        const t0 = Date.now();
        await showScreen(mockupPage, screen);
        // The mockup's own transitions run on `hidden`; sample after they settle.
        await mockupPage.waitForTimeout(300);
        const mockTree = await mockupPage.evaluate(EXTRACT_TREE, `[data-p="${screen}"]`);
        const tMock = Date.now();

        await page.evaluate((name) => { location.hash = `#/${name}`; }, screen);
        // Wait for the render to SETTLE, not merely to start: a screen draws
        // its heading synchronously and its data after fetches resolve, and
        // sampling on "has any element" is how a previous parity run reported
        // `div.scene` missing from a screen that plainly draws it.
        let previous = -1;
        let spent = 25;
        let settled = false;
        for (let attempt = 0; attempt < 25; attempt++) {
          const now = await page.evaluate(
            (s) => document.querySelectorAll(`[data-p="${s}"] *`).length, screen);
          if (now > 0 && now === previous && inFlight.size === 0) {
            spent = attempt + 1; settled = true; break;
          }
          previous = now;
          await page.waitForTimeout(400);
        }
        const tSettle = Date.now();
        const appTree = await page.evaluate(EXTRACT_TREE, `[data-p="${screen}"]`);
        const tExtract = Date.now();
        timings.push({
          screen, mock: tMock - t0, settle: tSettle - tMock, attempts: spent,
          inFlight: inFlight.size, extract: tExtract - tSettle, diff: 0,
          total: tExtract - t0, appNodes: countNodes(appTree),
        });
        // A run that dies at the timeout writes no report, and the per-screen
        // numbers are the whole diagnosis exactly then. Off by default because
        // twenty-one lines per project is noise on a run that finishes.
        if (process.env['MYCONTEXT_TREE_PARITY_TRACE'] !== undefined) {
          const t = timings[timings.length - 1]!;
          console.log(`[trace] ${screen} mock=${t.mock} settle=${t.settle} ` +
            `attempts=${t.attempts} inFlight=${t.inFlight} extract=${t.extract} ` +
            `nodes=${t.appNodes}`);
        }

        if (mockTree === null) {
          unmeasurable.push(`${screen}: the mockup has no [data-p="${screen}"] section`);
          results.push({ screen, measured: false, mockNodes: 0, appNodes: countNodes(appTree),
            note: 'NOT MEASURED — the design of record has no section for this screen',
            root: null, divergences: [] });
          continue;
        }
        if (appTree === null || previous <= 0) {
          unmeasurable.push(`${screen}: the app rendered no [data-p="${screen}"] content`);
          results.push({ screen, measured: false, mockNodes: countNodes(mockTree), appNodes: 0,
            note: 'NOT MEASURED — the app never rendered this section',
            root: null, divergences: [] });
          continue;
        }
        // **A screen that never settled is NOT MEASURED, for the same reason an
        // unrendered one is not.** This file's header says it fails only for a
        // reason that would make the measurement a lie, and comparing a screen
        // whose reads have not landed is precisely that: it reports the mockup's
        // whole subtree as ABSENT and the reader takes the next decision against
        // it. Ten screens were inventoried at three nodes apiece on 2026-08-29
        // and the run went green — see the in-flight comment above. An
        // unsettled screen now says so instead.
        if (!settled) {
          unmeasurable.push(`${screen}: still growing, or still fetching ` +
            `(${inFlight.size} \`/api\` reads in flight), after 25 samples over 10s`);
          results.push({ screen, measured: false, mockNodes: countNodes(mockTree),
            appNodes: countNodes(appTree),
            note: 'NOT MEASURED — the screen had not finished drawing when the walk reached it',
            root: null, divergences: [] });
          continue;
        }

        const tDiff0 = Date.now();
        const vocab = vocabularyFor(screen);
        const divergences = diffTrees(screen, mockTree, appTree)
          .map((d) => classify(d, vocab));
        const here = timings[timings.length - 1]!;
        here.diff = Date.now() - tDiff0;
        here.total += here.diff;
        results.push({ screen, measured: true, note: '',
          mockNodes: countNodes(mockTree), appNodes: countNodes(appTree),
          root: rootDivergence(mockTree, appTree), divergences, mockTree, appTree });
      }
    } finally {
      await mockupPage.close();
    }

    mkdirSync(OUT_DIR, { recursive: true });
    const tag = testInfo.project.name;
    writeFileSync(path.join(OUT_DIR, `trees-${tag}.json`),
      JSON.stringify({ project: tag, at: new Date().toISOString(), results, timings }, null, 2));
    writeFileSync(path.join(OUT_DIR, `inventory-${tag}.md`),
      `${renderInventory(tag, results)}\n\n---\n\n${renderTimings(timings)}\n`);
    // On stdout too, because a run that dies at the timeout writes no files and
    // the per-screen numbers are the whole diagnosis when it does.
    console.log(`\n[tree-parity ${tag}]\n${renderTimings(timings)}\n`);

    // **The only assertions.** The inventory is the deliverable; a screen that
    // could not be measured is the one thing that would make it a lie, because
    // an unmeasured screen reports zero divergences and reads as clean.
    expect(unmeasurable,
      'a screen could not be measured, so its line in the inventory would be a fabrication')
      .toEqual([]);
    expect(results.length, 'all 21 screens must appear in the inventory').toBe(SCREENS.length);
  });

/** The report, written for a person deciding what to fix and in what order. */
function renderInventory(project: string, results: ScreenResult[]): string {
  const total = results.reduce((n, r) => n + r.divergences.length, 0);
  const clean = results.filter((r) => r.measured && r.divergences.length === 0);
  const worst = [...results].sort((a, b) => b.divergences.length - a.divergences.length).slice(0, 5);
  const by = (v: string): number =>
    results.reduce((n, r) => n + r.divergences.filter((d) => d.verdict === v).length, 0);
  const type = (t: string): number =>
    results.reduce((n, r) => n + r.divergences.filter((d) => d.type === t).length, 0);

  const L: string[] = [];
  L.push(`# TREE parity inventory — ${project}`, '');
  L.push(`- **Total divergences: ${total}**`);
  L.push(`- Screens clean: **${clean.length} of ${results.length}**` +
    (clean.length > 0 ? ` (${clean.map((c) => c.screen).join(', ')})` : ''));
  L.push(`- Verdicts: STRUCTURAL ${by('STRUCTURAL')} · DATA ${by('DATA')} · ` +
    `AMBIGUOUS ${by('AMBIGUOUS')}`);
  L.push(`- Types: ABSENT ${type('ABSENT')} · EXTRA ${type('EXTRA')} · ` +
    `QUANTITY ${type('QUANTITY')} · ORDER ${type('ORDER')}`);
  L.push('', '**Five worst screens by divergence count**', '');
  L.push('| screen | divergences | STRUCTURAL | DATA | AMBIGUOUS |');
  L.push('| --- | ---: | ---: | ---: | ---: |');
  for (const w of worst) {
    const c = (v: string): number => w.divergences.filter((d) => d.verdict === v).length;
    L.push(`| ${w.screen} | ${w.divergences.length} | ${c('STRUCTURAL')} | ${c('DATA')} | ` +
      `${c('AMBIGUOUS')} |`);
  }
  // The section element's own classes, stated once. `rootDivergence` explains
  // why this is hoisted instead of repeated on every screen.
  const roots = new Map<string, string[]>();
  for (const r of results) {
    if (r.root === null) continue;
    roots.set(r.root, [...(roots.get(r.root) ?? []), r.screen]);
  }
  L.push('', '**The `<section>` element itself**', '');
  if (roots.size === 0) {
    L.push('Same classes on both sides, every screen.');
  } else {
    for (const [diff, screens] of roots) {
      L.push(`- \`${diff}\` — on ${screens.length} screen(s): ${screens.join(', ')}`);
    }
    L.push('', 'Counted once rather than per screen, and NOT included in the totals above.');
  }
  L.push('', '---', '');

  for (const r of results) {
    L.push(`## ${r.screen} — ${r.measured ? `${r.divergences.length} divergences` : r.note}`);
    L.push('', `mockup ${r.mockNodes} visible elements · app ${r.appNodes}`, '');
    if (!r.measured) { L.push(''); continue; }
    if (r.divergences.length === 0) { L.push('Tree matches the mockup section.', ''); continue; }
    for (const d of r.divergences) {
      L.push(`### ${d.verdict} · ${d.type}${d.kind === '' ? '' : ` \`${d.kind}\``} ` +
        `(depth ${d.depth})`);
      L.push('');
      // Both paths, always labelled. An ABSENT's locator is a path into the
      // MOCKUP and an EXTRA's is a path into the APP; printing one unlabelled
      // string for both is how a reader ends up pasting a mockup selector into
      // the app's devtools and concluding the report is wrong.
      if (d.mockLocator !== null) L.push(`- mockup: \`${d.mockLocator}\``);
      if (d.appLocator !== null) L.push(`- app: \`${d.appLocator}\``);
      if (d.type === 'QUANTITY' || d.type === 'ABSENT' || d.type === 'EXTRA') {
        L.push(`- mockup draws ${d.mockCount}, app draws ${d.appCount}`);
      }
      L.push(`- ${d.detail}`);
      L.push(`- **${d.verdict}**: ${d.why}`);
      if (d.sample !== '') L.push(`- sample text: \`${d.sample.replace(/`/g, "'")}\``);
      L.push('');
    }
  }
  return L.join('\n');
}
