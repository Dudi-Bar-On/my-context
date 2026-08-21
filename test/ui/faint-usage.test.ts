/**
 * **The gate for `--faint`, and the proof that the gate can still fail.**
 *
 * `scripts/check-faint-usage.ts` carries the rule and the reasoning; this file
 * is what makes it run. It lives in `npm test` rather than in an eighth
 * `npm run check:*` script on purpose — the seven-gate list is written down in
 * several places, and a rule already inside `npm test` does not need its own
 * entry to have teeth.
 *
 * **A checker that has never been red is not a checker.** This project has
 * found six that could never fail, so the first assertion below is not the
 * important one. The important ones are the CONTROLS: a synthetic stylesheet
 * per shape the checker claims to catch, each asserting the offender IS found,
 * paired with a legal version of the same shape asserting it is NOT. Without
 * them, a parser that silently stops finding rules reports zero offenders and
 * reads exactly like a clean file.
 *
 * That is not hypothetical here. The first run of this checker against the
 * mockup reported ten offenders AND twelve unresolvable sizes, because the
 * `<style>` scan had started nine hundred lines early, inside the header
 * comment's sentence about carrying an inline `<style>`. It was loud instead of
 * green only because an unresolvable size is treated as a failure rather than
 * as an absence. The real-file assertions below therefore check that the
 * stylesheet was PARSED — rules counted, token block read, document size
 * resolved — and not merely that no offender came back.
 *
 * Recorded so the sequence is not re-litigated: on the mockup as it stood, the
 * checker failed with ten offenders — `.pop h3` 11px/700, `.grp > p` 10px/700,
 * `.card > h3` 11px/700, `th` 10px/700, `.pane dt` 14px, `.welllabel` 10px/700,
 * `.rung .n` 11px, `.globtree div` 11px, `svg.chart text.rel` 8px and
 * `.delta .was` 11px. All ten moved to `--dim`, which is the fix the plan
 * names, and the run went green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOLD_WEIGHT, LARGE_BOLD_PX, LARGE_TEXT_PX, NO_DOCUMENT_SIZE, REPLACEMENT, SCANNED_FILES, TOKEN,
  analyse, buildCascade, customProperties, describe as describeUse, isLargeText, parseStylesheet,
  readSources,
} from '../../scripts/check-faint-usage.ts';
import type { Report, Use } from '../../scripts/check-faint-usage.ts';

/** A stylesheet with the token block and a document size already in it. */
function sheet(css: string): Report {
  return analyse([{
    file: 'fixture.css',
    text: `:root{${TOKEN}:#7d7a90;${REPLACEMENT}:#a9a6b8}\nbody{font:14px/1.5 sans-serif}\n${css}`,
  }]);
}

function selectors(uses: Use[]): string[] {
  return uses.map((u) => u.selector).sort();
}

test(`${TOKEN} is applied to no text below large-text size`, () => {
  const report = analyse(readSources());
  assert.deepEqual(
    report.offenders.map((u) => `${u.file} line ${u.line}  ${u.selector}  ${u.text}`),
    [],
    `${TOKEN} measures 3.83 against the glass, which clears 3:1 and fails 4.5, so it is legal `
    + `only at large-text size. Body-sized prose uses ${REPLACEMENT}.\n\n`
    + report.offenders.map((u) => describeUse(u).join('\n')).join('\n\n'),
  );
});

test('a size the model cannot resolve is a failure, never a pass', () => {
  const report = analyse(readSources());
  assert.deepEqual(
    report.problems.map((p) => `${p.file} line ${p.line}: ${p.detail}`),
    [],
    'a rule whose font-size comes from a custom property nothing defines cannot be judged, and an '
    + 'unjudged rule that counted as legal would be the hole this checker exists to close',
  );
});

test('the scanned files were actually parsed — the control on every check above', () => {
  const sources = readSources();
  assert.ok(sources.length > 0, `none of ${SCANNED_FILES.join(', ')} could be read`);

  const report = analyse(sources);
  assert.ok(
    report.rulesParsed > 100,
    `only ${report.rulesParsed} rule(s) parsed across ${report.filesScanned} file(s). The mockup `
    + 'alone carries hundreds; a number this low means the stylesheet scan lost its place, and a '
    + 'scan that finds no rules reports no offenders',
  );
  assert.ok(
    report.declaredAs.some((d) => d.file === SCANNED_FILES[0]),
    `${TOKEN} was not found in the token block of ${SCANNED_FILES[0]}. Either it was renamed — in `
    + 'which case this checker now polices a name nothing uses — or the block was not parsed',
  );

  const mockup = sources.find((s) => s.file === SCANNED_FILES[0])!;
  const rules = parseStylesheet(mockup);
  const cascade = buildCascade(rules, customProperties(rules), mockup.file, []);
  assert.notEqual(
    cascade.baseSize().from, NO_DOCUMENT_SIZE,
    'the document size fell back to the initial 16px, which means the rule that sets the base size '
    + 'was not found. Every inherited size in the report would then be wrong',
  );
});

test('body-sized prose in --faint is caught', () => {
  const report = sheet('.prose{color:var(--faint)}');
  assert.deepEqual(selectors(report.offenders), ['.prose']);
  assert.match(describeUse(report.offenders[0]!).join('\n'), /Use --dim\.$/);
});

test('large text in --faint is left alone — the check is size, not presence', () => {
  const report = sheet('.hero{font-size:24px;color:var(--faint)}');
  assert.deepEqual(selectors(report.offenders), []);
  assert.deepEqual(selectors(report.legal), ['.hero']);
});

test('14px bold is an offender, because 14 is the POINT size and this is pixels', () => {
  const report = sheet('.label{font-size:14px;font-weight:700;color:var(--faint)}');
  assert.deepEqual(
    selectors(report.offenders), ['.label'],
    'the repaint plan writes the large-text bar as 18px, or 14px when bold. Those are 18pt and '
    + '14pt copied across as pixels; one point is 4/3 of a pixel, so both are a third short. At '
    + `14px bold, 3.83 is measured against a 4.5 requirement — see ${LARGE_BOLD_PX}px below`,
  );
  assert.deepEqual(selectors(sheet(
    `.label{font-size:${LARGE_BOLD_PX}px;font-weight:${BOLD_WEIGHT};color:var(--faint)}`,
  ).offenders), []);
});

test('an inherited size is resolved, so a wrapper cannot hide the real one', () => {
  const report = sheet('.wrap{font-size:11px}\n.wrap span{color:var(--faint)}');
  assert.deepEqual(selectors(report.offenders), ['.wrap span']);
  assert.equal(report.offenders[0]!.sizePx, 11);
});

test('an em size is resolved against what it inherits', () => {
  assert.deepEqual(selectors(sheet('.small{font-size:.8em;color:var(--faint)}').offenders), ['.small']);
  assert.deepEqual(selectors(sheet('.big{font-size:2em;color:var(--faint)}').offenders), []);
});

test('aliasing --faint through another token does not launder it', () => {
  const report = analyse([{
    file: 'fixture.css',
    text: `:root{${TOKEN}:#7d7a90;--label:var(${TOKEN})}\nbody{font:14px/1.5 sans-serif}\n`
      + '.k{font-size:11px;color:var(--label)}',
  }]);
  assert.deepEqual(selectors(report.offenders), ['.k']);
});

test('non-text uses are exempt, because non-text owes 3:1 and 3.83 clears it', () => {
  const report = sheet(
    '.hatch{font-size:10px;background:repeating-linear-gradient(45deg,var(--faint) 0 2px,'
    + 'transparent 2px 4px)}\n.edge{font-size:10px;border:1px solid var(--faint)}\n'
    + 'svg .node{fill:var(--faint);stroke:var(--faint)}',
  );
  assert.deepEqual(selectors(report.offenders), []);
  assert.equal(report.textUses, 0);
  assert.equal(report.nonTextUses, 4);
});

test('fill on an SVG text element is text, whatever the element is called', () => {
  const report = sheet('svg text.rel{font-size:8px;fill:var(--faint)}');
  assert.deepEqual(selectors(report.offenders), ['svg text.rel']);
  assert.equal(report.offenders[0]!.property, 'fill');
});

test('a rule inside an at-rule is judged, and says which one it was in', () => {
  const report = sheet('@media print{.p{font-size:10px;color:var(--faint)}}');
  assert.deepEqual(selectors(report.offenders), ['.p']);
  assert.deepEqual(report.offenders[0]!.at, ['@media print']);
});

test('a size that cannot be resolved fails rather than passing', () => {
  const report = sheet('.u{font-size:var(--nothing-defines-this);color:var(--faint)}');
  assert.equal(report.offenders.length + report.problems.length > 0, true);
  assert.match(report.problems.map((p) => p.detail).join('\n'), /nothing defines/);
});

test('a token block that no longer declares --faint fails loudly', () => {
  const report = analyse([{ file: 'fixture.css', text: 'body{font:14px/1.5 sans-serif}\n.a{color:#777}' }]);
  assert.match(
    report.problems.map((p) => p.detail).join('\n'),
    new RegExp(`nothing declares .${TOKEN}`),
    'if the token is renamed, this checker must say so rather than pass over a file it no longer '
    + 'recognises — a checker policing a dead name is the same as no checker',
  );
});

test('--faint composed outside a stylesheet is reported, not silently skipped', () => {
  const report = analyse([{
    file: 'fixture.html',
    text: `<style>:root{${TOKEN}:#7d7a90}</style>\n<script>const c='var(${TOKEN})';</script>`,
  }]);
  assert.equal(report.unjudged.length, 1);
  assert.equal(report.unjudged[0]!.line, 2);
});

test('the large-text bar is WCAG’s, in CSS reference pixels', () => {
  assert.equal(LARGE_TEXT_PX, 24, '18pt');
  assert.equal(isLargeText(LARGE_TEXT_PX, 400), true);
  assert.equal(isLargeText(LARGE_TEXT_PX - 0.01, 400), false);
  assert.equal(isLargeText(LARGE_BOLD_PX, BOLD_WEIGHT), true);
  assert.equal(isLargeText(LARGE_BOLD_PX, BOLD_WEIGHT - 1), false, 'the 14pt allowance needs bold');
  assert.equal(isLargeText(18, BOLD_WEIGHT), false, 'the plan’s 18 is a point size, not pixels');
});
