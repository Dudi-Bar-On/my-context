// @basis TASK-two-browser-gates-are-red-before-any-lane-touches-them-and,
// TASK-forty-six-browser-failures-are-recorded-as-unknown-so-the
/**
 * **ONE `ResizeObserver` ON THE STATUS BAR, AND IT IS WIDTH-GUARDED.**
 *
 * ── THE DEFECT THIS PINS, WITH ITS HISTORY ────────────────────────────────
 *
 * `watchStripFit` (`src/ui/public/app.js`) refits the bar when its CONTENT or
 * its WIDTH moves. The width half is a `ResizeObserver`, and the block that
 * installs it spends a paragraph on why it must remember the last width:
 *
 *   *"Adding a row changes the strip's HEIGHT, and a height change is this
 *    observer watching its own tail — it would queue a fit, which adds a row,
 *    which queues a fit. The remembered width is what breaks that loop."*
 *
 * `d9397803` (2026-09-01) added a bare `new ResizeObserver(queue).observe(strip)`.
 * `b4a6301f`, the same day, added the width-guarded block above it — and never
 * removed the original. So the bar carried TWO observers: one that refuses to
 * queue a fit on a height change, and one directly beneath it that queues a fit
 * on every height change there has ever been. The guard's own argument was
 * defeated on the line after it was written.
 *
 * Reported rather than removed by the 2026-09-23 lane (`ui-gates/1` fix round
 * one, "A bug found and REPORTED rather than changed"), because a removal in a
 * browser-driven file wants a browser run to verify and it had none left. This
 * is the test that round asked for, in its own words: *"the removal wants a
 * source-scan test pinning 'one ResizeObserver on the strip, width-guarded'."*
 *
 * ── WHY A SOURCE SCAN AND NOT A BROWSER ───────────────────────────────────
 *
 * The claim is about the WIRING, not about a rendered pixel, and the wiring is
 * one function in one shipped file. A browser can only observe the consequence
 * — an extra fit per height change, which is invisible whenever `fitStrip`
 * happens to be idempotent, and which is exactly why this survived three weeks.
 * `test/ui/glyph-set.test.ts` makes the same move for `screenHead`'s call
 * sites, and for the same reason: a property of the source is measured on the
 * source, so that a second one cannot arrive quietly.
 *
 * The source is read through TypeScript's own parser rather than grepped, so a
 * `ResizeObserver` named in a comment (there are four, in `screens/parts.js`
 * and `screens/graph.js`) is never counted as an installation.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const APP = path.join(
  import.meta.dirname, '..', '..', 'src', 'ui', 'public', 'app.js',
);

/** `watchStripFit`'s declaration, parsed — the one function that wires the bar. */
function watchStripFit(): { node: ts.FunctionDeclaration; source: ts.SourceFile } {
  const text = readFileSync(APP, 'utf8');
  const source = ts.createSourceFile(APP, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.JS);
  let found: ts.FunctionDeclaration | undefined;
  source.forEachChild((node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === 'watchStripFit') found = node;
  });
  assert.notEqual(found, undefined,
    '`watchStripFit` is no longer a top-level function declaration in app.js — this scan has '
    + 'lost its subject and would pass by measuring nothing');
  return { node: found!, source };
}

/** Every `new ResizeObserver(…)` inside a node, in source order. */
function resizeObservers(node: ts.Node): ts.NewExpression[] {
  const found: ts.NewExpression[] = [];
  const walk = (child: ts.Node): void => {
    if (ts.isNewExpression(child) && ts.isIdentifier(child.expression)
      && child.expression.text === 'ResizeObserver') found.push(child);
    child.forEachChild(walk);
  };
  walk(node);
  return found;
}

test('the strip carries exactly one ResizeObserver', () => {
  const { node } = watchStripFit();
  const observers = resizeObservers(node);
  assert.equal(observers.length, 1,
    `watchStripFit installs ${observers.length} ResizeObservers on the status bar. Two is the `
    + 'd9397803/b4a6301f defect: the second one is unguarded, so every height change the fit '
    + 'itself causes queues another fit. One observer, or the guard above it means nothing.');
});

test('and that one observer queues a fit only when the WIDTH has moved', () => {
  const { node, source } = watchStripFit();
  const [observer] = resizeObservers(node);
  assert.notEqual(observer, undefined, 'no ResizeObserver at all — the width half is gone, so a '
    + 'window drag no longer refits the bar (owner, 2026-09-01)');

  // **The callback is a function written here, never a bare `queue`.** Handing
  // the shared `queue` straight to the constructor IS the unguarded shape: it
  // cannot compare anything, so it fires on the height changes `fitStrip` makes
  // itself.
  const [callback] = observer!.arguments ?? [];
  assert.notEqual(callback, undefined, 'the ResizeObserver was constructed with no callback');
  assert.ok(
    ts.isArrowFunction(callback!) || ts.isFunctionExpression(callback!),
    'the strip\'s ResizeObserver is handed a bare callback reference rather than a function that '
    + 'inspects the entry. A callback that never reads `contentRect.width` cannot tell a width '
    + 'change from the height change the fit itself just caused.',
  );

  // And it READS the width and RETURNS when it has not moved. Stated over the
  // callback's own text: the remembered width is the whole mechanism, and a
  // callback that measured the width and queued regardless would satisfy the
  // shape check above while behaving exactly like the line this test removed.
  const body = callback!.getText(source);
  assert.ok(body.includes('contentRect.width'),
    'the callback never reads `contentRect.width`, so it cannot be width-guarded');
  assert.match(body, /if\s*\(\s*width\s*===\s*\w+\s*\)\s*return;/,
    'the callback no longer returns early on an unchanged width — the remembered width is what '
    + 'breaks the fit-adds-a-row-queues-a-fit loop the block\'s own comment describes');
});
