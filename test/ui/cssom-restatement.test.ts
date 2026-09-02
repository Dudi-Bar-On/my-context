/**
 * **The gate for CSSOM restatement, and the proof that the gate can still fail.**
 *
 * `scripts/check-cssom-restatement.ts` carries the rule and the reasoning; this
 * file is what makes it run. It lives in `npm test` rather than in an eighth
 * `npm run check:*` script for the reason `test/ui/faint-usage.test.ts` already
 * gives: the seven-gate list is written down in several places, and a rule
 * already inside `npm test` does not need its own entry to have teeth.
 *
 * **A checker that has never been red is not a checker.** The first assertion
 * below — the real tree is clean — is the least important one in the file, and
 * on its own it is indistinguishable from a scanner that has quietly stopped
 * finding anything. The ones that matter are the CONTROLS: the exact code that
 * was deleted from `screens/decay.js`, asserted to be FOUND; and beside each,
 * the legal shape of the same thing, asserted to be MISSED.
 *
 * The false-positive controls are the other half and they are not decoration.
 * The first run of this checker over the real tree reported one offender —
 * `screens/preview.js`'s event bar `display:flex`, matched against
 * `.ladder > div{display:flex}` from the admission staircase, a rule it has
 * never been under. A gate that reports that is a gate somebody mutes, so the
 * checker was narrowed until it could not, and `a bare tag under a combinator
 * is not an identity` below is that narrowing held in place.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SCANNED_DIR, STYLESHEET, analyse, readModules, readStylesheet, rightmostCompound,
} from '../../scripts/check-cssom-restatement.ts';
import type { Report } from '../../scripts/check-cssom-restatement.ts';

/** The `svg.chart` block as `styles.css` has carried it since 2026-08-23. */
const CHART_CSS = [
  'svg.chart{display:block;max-inline-size:100%;block-size:auto;overflow:visible}',
  'svg.chart text{font-family:var(--sans);font-size:var(--fs-chart);fill:var(--dim)}',
  'svg.chart text.mono{font-family:var(--mono);font-size:var(--fs-chart-mono)}',
].join('\n');

function judge(js: string, css = CHART_CSS): Report {
  return analyse([{ file: 'fixture.js', text: js }], css);
}

function named(report: Report): string[] {
  return report.offenders.map((o) => `${o.element} ${o.property}:${o.value} <- ${o.selector}`).sort();
}

/* ── the real tree ────────────────────────────────────────────────────────── */

test('no module restates a declaration styles.css already owns', () => {
  const report = analyse(readModules(), readStylesheet());
  assert.deepEqual(
    report.offenders.map(
      (o) => `${o.file}:${o.line} ${o.element} ${o.property}:${o.value} — ${STYLESHEET}:${o.sheetLine} \`${o.selector}\``,
    ),
    [],
    'An inline copy of a rule the stylesheet already carries changes nothing today and '
    + 'silently outranks the next edit to that rule. styles-parity cannot see it: it compares '
    + 'rule bodies, and this is a third copy applied at runtime. Delete the write.',
  );
});

test('the tree was actually scanned — the control on the assertion above', () => {
  const report = analyse(readModules(), readStylesheet());
  // A scanner that finds nothing agrees with a tree that violates nothing.
  assert.ok(report.modulesScanned > 20, `only ${report.modulesScanned} modules under ${SCANNED_DIR}`);
  assert.ok(report.rulesParsed > 200, `${STYLESHEET} parsed to ${report.rulesParsed} rules`);
  assert.ok(report.writes > 20, `only ${report.writes} CSSOM writes found in the whole tree`);
  assert.ok(report.dynamic > 5, `${report.dynamic} dynamic writes — the charts set geometry at runtime`);
});

test('every hole this check has is printed rather than silently passed', () => {
  const report = analyse(readModules(), readStylesheet());
  // Not asserted to be empty: it is a hole, and the point is that it is VISIBLE.
  // `screens/parts.js` spaces a caller's element, so no selector can be matched
  // against it. If this list grows, the checker is seeing less than it reports.
  assert.deepEqual(
    report.unjudged.map((u) => `${u.file}:${u.line}`),
    ['src/ui/public/screens/parts.js:158'],
    'the set of writes this checker cannot judge has changed; read the report and decide '
    + 'whether the checker should learn the shape or the code should not use it',
  );
});

/* ── the case this file exists for, reproduced verbatim ───────────────────── */

/**
 * `screens/decay.js` as it stood on 2026-08-29, before the deletion. Every line
 * here is the file's own, and each of them beat the stylesheet on the page.
 */
const DECAY_BEFORE = `
  const svg = sv('svg', { viewBox: '0 0 900 210', class: 'chart', role: 'img' });
  svg.style.setProperty('direction', 'ltr');
  svg.style.setProperty('display', 'block');
  svg.style.setProperty('max-inline-size', '100%');
  svg.style.setProperty('block-size', 'auto');
  svg.style.setProperty('overflow', 'visible');
  svg.style.setProperty('font-family', 'var(--sans)');
  svg.style.setProperty('font-size', 'var(--fs-chart)');
  svg.style.setProperty('fill', 'var(--dim)');
  const label = sv('text', { x: 1, y: 2, class: 'mono' });
  label.style.setProperty('font-family', 'var(--mono)');
  label.style.setProperty('font-size', 'var(--fs-chart-mono)');
`;

test('the decay restatement that defeated two fixes in one day is caught', () => {
  assert.deepEqual(named(judge(DECAY_BEFORE)), [
    'svg.chart block-size:auto <- svg.chart',
    'svg.chart display:block <- svg.chart',
    'svg.chart max-inline-size:100% <- svg.chart',
    'svg.chart overflow:visible <- svg.chart',
    'text.mono font-family:var(--mono) <- svg.chart text.mono',
    'text.mono font-size:var(--fs-chart-mono) <- svg.chart text.mono',
  ]);
});

test('`plan:walk seq:47` — an inline copy of the scale bound is the whole defect', () => {
  // `svg.chart` moved inline-size -> max-inline-size and the inline copy did
  // not; the comb rendered 1.267 while the other two rendered 1.000.
  const report = judge(`
    const svg = sv('svg', { class: 'chart' });
    svg.style.setProperty('max-inline-size', '100%');
  `);
  assert.equal(report.offenders.length, 1);
  assert.equal(report.offenders[0]?.property, 'max-inline-size');
});

test('direction:ltr is left alone — no rule gives an svg.chart a direction', () => {
  // The one line of that block that ever did any work, and the worked example
  // of what this check must never flag. `screens/simulate.js` sets the same.
  const report = judge(`
    const svg = sv('svg', { class: 'chart' });
    svg.style.setProperty('direction', 'ltr');
  `);
  assert.deepEqual(named(report), []);
  assert.equal(report.unowned, 1);
});

/* ── the line: static duplicate vs legitimate dynamic value ───────────────── */

test('a value computed from data passes — the charts set geometry at runtime', () => {
  const report = judge(
    'const bar = el(\'div\', \'seg\');\n'
    + 'bar.style.setProperty(\'inline-size\', `${(count / max) * 100}%`);\n'
    + 'bar.style.setProperty(\'block-size\', someHeight);\n',
    '.seg{inline-size:100%;block-size:auto}',
  );
  assert.deepEqual(named(report), []);
  assert.equal(report.dynamic, 2, 'both writes are values no stylesheet could hold');
});

test('a DIFFERENT value is a deliberate override, reported and never failed', () => {
  const report = judge(
    "const note = el('p', 'small');\nnote.style.setProperty('margin-block-start', '10px');\n",
    '.small{margin-block-start:8px}',
  );
  assert.deepEqual(named(report), []);
  assert.equal(report.overrides.length, 1);
  assert.equal(report.overrides[0]?.sheetValue, '8px');
});

test('whitespace and !important do not launder a duplicate', () => {
  const report = judge(
    "const svg = sv('svg', { class: 'chart' });\nsvg.style.setProperty('display', 'block');\n",
    'svg.chart{ display :   block !important }',
  );
  assert.equal(report.offenders.length, 1);
});

/* ── false positives, which are what would make this unshippable ──────────── */

test('a bare tag under a combinator is not an identity', () => {
  // The real first run: preview.js's event bar, a plain <div> on another
  // screen, matched against the admission staircase's `.ladder > div`.
  const report = judge(
    "const bar = el('div');\nbar.style.setProperty('display', 'flex');\n",
    '.ladder>div{display:flex;gap:var(--sp-2)}',
  );
  assert.deepEqual(named(report), [], 'every <div> in the tree matches the compound `div`');
  assert.equal(rightmostCompound('.ladder > div'), null);
  // A single compound has no unverified ancestor, so a bare tag is fine there.
  assert.deepEqual(rightmostCompound('div'), { tag: 'div', classes: [] });
  // And a class on the last compound is an identity even under a combinator.
  assert.deepEqual(rightmostCompound('svg.chart text.mono'), { tag: 'text', classes: ['mono'] });
});

test('a compound this checker cannot fully read never matches', () => {
  // Ids, attributes and pseudos select on state no source scan can see.
  for (const selector of ['#heat', 'a[href]', 'button:hover', '.card:not(.pane)']) {
    assert.equal(rightmostCompound(selector), null, selector);
  }
});

test('a target this file did not construct is unjudged, not failed', () => {
  const report = judge(
    "export function spaced(e) { e.style.setProperty('display', 'block'); }\n",
  );
  assert.deepEqual(named(report), []);
  assert.equal(report.unjudged.length, 1);
});

test('the class the element really carries decides, not the one nearby', () => {
  const report = judge(
    "const a = sv('text', { class: 'rel' });\na.style.setProperty('font-family', 'var(--mono)');\n",
  );
  assert.deepEqual(named(report), [], '`text.rel` does not match `svg.chart text.mono`');
});

/* ── the shapes an override can take ──────────────────────────────────────── */

test('the camelCase assignment form is the same write', () => {
  const report = judge(
    "const svg = sv('svg', { class: 'chart' });\nsvg.style.blockSize = 'auto';\n",
  );
  assert.deepEqual(named(report), ['svg.chart block-size:auto <- svg.chart']);
});

test('a class added after construction is picked up', () => {
  const report = judge(
    "const t = sv('text', {});\nt.classList.add('mono');\nt.style.setProperty('font-size', 'var(--fs-chart-mono)');\n",
  );
  assert.deepEqual(named(report), ['text.mono font-size:var(--fs-chart-mono) <- svg.chart text.mono']);
});

test('cssText is refused rather than guessed at', () => {
  const report = judge(
    "const svg = sv('svg', { class: 'chart' });\nsvg.style.cssText = 'display:block';\n",
  );
  assert.deepEqual(named(report), []);
  assert.equal(report.unjudged.length, 1);
});

test('a commented-out write is not a write', () => {
  // `screens/doctor.js` quotes another file's setProperty call inside a comment.
  const report = judge(
    "const svg = sv('svg', { class: 'chart' });\n// svg.style.setProperty('display', 'block');\n",
  );
  assert.equal(report.writes, 0);
});

test('an empty stylesheet is a parse failure, not a clean run', () => {
  const report = judge(DECAY_BEFORE, '');
  assert.equal(report.rulesParsed, 0);
  assert.deepEqual(named(report), [], 'nothing to be a duplicate of, which is why zero rules must fail loudly');
});
